(function (global) {
  'use strict';

  const MIME_APK = 'application/vnd.android.package-archive';
  const MAX_APK_BYTES = 512 * 1024 * 1024;
  const CHUNK_BYTES = 8 * 1024 * 1024; // Multiplo de 256 KiB exigido por Drive.
  const analysisCache = new WeakMap();

  function emit(onProgress, stage, percent, message) {
    if (typeof onProgress === 'function') onProgress({ stage, percent, message });
  }

  function hex(buffer) {
    return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
  }

  async function analyzeApk(file, onProgress) {
    if (!(file instanceof File)) throw new Error('APK_REQUERIDA');
    if (!/\.apk$/i.test(file.name)) throw new Error('ARCHIVO_DEBE_SER_APK');
    if (file.size <= 0 || file.size > MAX_APK_BYTES) throw new Error('TAMANO_APK_NO_PERMITIDO');
    if (analysisCache.has(file)) return analysisCache.get(file);

    emit(onProgress, 'ANALISIS', 3, 'Leyendo la APK…');
    const bytes = await file.arrayBuffer();
    const signature = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
    if (signature.length < 2 || signature[0] !== 0x50 || signature[1] !== 0x4b)
      throw new Error('APK_ZIP_INVALIDA');

    emit(onProgress, 'SHA256', 8, 'Calculando SHA-256 automáticamente…');
    const sha256 = hex(await crypto.subtle.digest('SHA-256', bytes));
    emit(onProgress, 'MANIFEST', 14, 'Leyendo versión y versionCode…');
    const manifest = await readManifestFromApk(bytes);
    const result = Object.freeze({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || MIME_APK,
      versionName: manifest.versionName,
      versionCode: manifest.versionCode,
      packageName: manifest.packageName,
      sha256
    });
    analysisCache.set(file, result);
    emit(onProgress, 'LISTA', 18, `APK ${result.versionName} (${result.versionCode}) validada.`);
    return result;
  }

  async function readManifestFromApk(bytes) {
    if (typeof global.JSZip === 'undefined') throw new Error('LECTOR_APK_NO_DISPONIBLE');
    let zip;
    try { zip = await global.JSZip.loadAsync(bytes); }
    catch (_) { throw new Error('APK_ZIP_INVALIDA'); }
    const entry = zip.file('AndroidManifest.xml');
    if (!entry) throw new Error('ANDROID_MANIFEST_NO_ENCONTRADO');
    const manifestBytes = await entry.async('uint8array');
    return parseBinaryAndroidManifest(manifestBytes);
  }

  function parseBinaryAndroidManifest(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u16 = offset => offset + 2 <= view.byteLength ? view.getUint16(offset, true) : 0;
    const u32 = offset => offset + 4 <= view.byteLength ? view.getUint32(offset, true) : 0;
    if (view.byteLength < 16 || u16(0) !== 0x0003) throw new Error('ANDROID_MANIFEST_BINARIO_INVALIDO');

    let strings = [];
    let resourceMap = [];
    let offset = u16(2) || 8;
    while (offset + 8 <= view.byteLength) {
      const type = u16(offset);
      const headerSize = u16(offset + 2);
      const size = u32(offset + 4);
      if (headerSize < 8 || size < headerSize || offset + size > view.byteLength)
        throw new Error('ANDROID_MANIFEST_CHUNK_INVALIDO');

      if (type === 0x0001) strings = parseStringPool(view, offset, headerSize, size);
      else if (type === 0x0180) {
        resourceMap = [];
        for (let p = offset + headerSize; p + 4 <= offset + size; p += 4) resourceMap.push(u32(p));
      } else if (type === 0x0102 && strings.length) {
        const nodeHeaderSize = headerSize;
        const attrExt = offset + nodeHeaderSize;
        if (attrExt + 20 > offset + size) throw new Error('ANDROID_MANIFEST_ELEMENTO_INVALIDO');
        const elementName = strings[u32(attrExt + 4)] || '';
        if (elementName === 'manifest') {
          const attrStart = u16(attrExt + 8);
          const attrSize = u16(attrExt + 10) || 20;
          const attrCount = u16(attrExt + 12);
          const attrBase = attrExt + attrStart;
          const values = {};
          for (let i = 0; i < attrCount; i++) {
            const p = attrBase + i * attrSize;
            if (p + 20 > offset + size) break;
            const nameIndex = u32(p + 4);
            const rawIndex = u32(p + 8);
            const dataType = view.getUint8(p + 15);
            const data = u32(p + 16);
            const name = strings[nameIndex] || '';
            const resourceId = resourceMap[nameIndex] || 0;
            let value = rawIndex !== 0xffffffff ? strings[rawIndex] : undefined;
            if (value == null && dataType === 0x03) value = strings[data];
            if (value == null && (dataType === 0x10 || dataType === 0x11)) value = data;
            if (name) values[name] = value;
            if (resourceId === 0x0101021b) values.versionCode = value;
            if (resourceId === 0x0101021c) values.versionName = value;
          }
          const versionName = String(values.versionName == null ? '' : values.versionName).trim();
          const versionCode = Number(values.versionCode || 0);
          const packageName = String(values.package == null ? '' : values.package).trim();
          if (!versionName || !Number.isInteger(versionCode) || versionCode <= 0)
            throw new Error('VERSION_APK_NO_SE_PUDO_LEER');
          return { versionName, versionCode, packageName };
        }
      }
      offset += size;
    }
    throw new Error('MANIFEST_SIN_ELEMENTO_PRINCIPAL');
  }

  function parseStringPool(view, chunkOffset, headerSize, chunkSize) {
    const u32 = offset => view.getUint32(offset, true);
    const stringCount = u32(chunkOffset + 8);
    const flags = u32(chunkOffset + 16);
    const stringsStart = u32(chunkOffset + 20);
    if (stringCount > 100000 || stringsStart >= chunkSize) throw new Error('STRING_POOL_INVALIDO');
    const utf8 = (flags & 0x100) !== 0;
    const offsetsBase = chunkOffset + headerSize;
    const dataBase = chunkOffset + stringsStart;
    const decoder8 = new TextDecoder('utf-8');
    const decoder16 = new TextDecoder('utf-16le');
    const result = [];
    for (let i = 0; i < stringCount; i++) {
      const relative = u32(offsetsBase + i * 4);
      let p = dataBase + relative;
      if (p >= chunkOffset + chunkSize) { result.push(''); continue; }
      if (utf8) {
        const utf16Length = readLength8(view, p); p += utf16Length.bytes;
        const byteLength = readLength8(view, p); p += byteLength.bytes;
        if (p + byteLength.value > chunkOffset + chunkSize) { result.push(''); continue; }
        result.push(decoder8.decode(new Uint8Array(view.buffer, view.byteOffset + p, byteLength.value)));
      } else {
        const length = readLength16(view, p); p += length.bytes;
        const byteLength = length.value * 2;
        if (p + byteLength > chunkOffset + chunkSize) { result.push(''); continue; }
        result.push(decoder16.decode(new Uint8Array(view.buffer, view.byteOffset + p, byteLength)));
      }
    }
    return result;
  }

  function readLength8(view, offset) {
    const first = view.getUint8(offset);
    if ((first & 0x80) === 0) return { value: first, bytes: 1 };
    return { value: ((first & 0x7f) << 8) | view.getUint8(offset + 1), bytes: 2 };
  }

  function readLength16(view, offset) {
    const first = view.getUint16(offset, true);
    if ((first & 0x8000) === 0) return { value: first, bytes: 2 };
    return { value: ((first & 0x7fff) << 16) | view.getUint16(offset + 2, true), bytes: 4 };
  }

  function offsetConfirmado(response) {
    const range = response && response.headers ? response.headers.get('Range') || '' : '';
    const match = range.match(/bytes=0-(\d+)/i);
    return match ? Number(match[1]) + 1 : 0;
  }

  async function consultarEstadoCarga(sessionUrl, totalBytes) {
    const response = await fetch(sessionUrl, {
      method: 'PUT',
      headers: { 'Content-Range': `bytes */${totalBytes}` },
      body: new Blob([]),
      cache: 'no-store'
    });
    if (response.ok) {
      const metadata = await response.json();
      return { completa: true, offset: totalBytes, metadata };
    }
    if (response.status === 308)
      return { completa: false, offset: offsetConfirmado(response), metadata: null };
    if (response.status === 404 || response.status === 410)
      throw new Error('SESION_DRIVE_EXPIRADA');
    throw new Error(`DRIVE_ESTADO_HTTP_${response.status}`);
  }

  async function uploadResumable(file, sessionUrl, onProgress) {
    if (!/^https:\/\/www\.googleapis\.com\/upload\/drive\//i.test(sessionUrl || ''))
      throw new Error('SESION_DRIVE_INVALIDA');
    let offset = 0;
    let finalMetadata = null;

    while (offset < file.size) {
      const startOffset = offset;
      const endExclusive = Math.min(startOffset + CHUNK_BYTES, file.size);
      const chunk = file.slice(startOffset, endExclusive, MIME_APK);
      let response = null;
      let lastNetworkError = null;

      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          response = await fetch(sessionUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': MIME_APK,
              'Content-Range': `bytes ${startOffset}-${endExclusive - 1}/${file.size}`
            },
            body: chunk,
            cache: 'no-store'
          });
          if (response.status < 500 && response.status !== 429) break;
          lastNetworkError = new Error(`DRIVE_CARGA_HTTP_${response.status}`);
        } catch (error) {
          lastNetworkError = error;
        }

        emit(onProgress, 'RECUPERACION_DRIVE', 18 + Math.round((offset / file.size) * 72),
          `Conexión interrumpida. Recuperando carga… intento ${attempt + 1}/6`);
        try {
          const estado = await consultarEstadoCarga(sessionUrl, file.size);
          if (estado.completa && estado.metadata && estado.metadata.id)
            return estado.metadata;
          if (estado.offset !== startOffset) {
            offset = estado.offset;
            response = null;
            break;
          }
        } catch (statusError) {
          lastNetworkError = statusError;
        }
        await delay(800 * Math.pow(2, attempt));
      }

      if (offset !== startOffset) continue;
      if (!response) {
        const error = new Error('DRIVE_CARGA_INTERRUMPIDA_RECUPERABLE');
        error.cause = lastNetworkError;
        throw error;
      }
      if (response.status === 308) {
        offset = offsetConfirmado(response);
        if (offset <= startOffset) throw new Error('DRIVE_NO_CONFIRMACION_DEL_BLOQUE');
      } else if (response.ok) {
        finalMetadata = await response.json();
        offset = file.size;
      } else {
        throw new Error(`DRIVE_CARGA_HTTP_${response.status}`);
      }
      const uploadPercent = file.size ? offset / file.size : 0;
      emit(onProgress, 'CARGA_DRIVE', 18 + Math.round(uploadPercent * 72),
        `Subiendo archivo de forma segura… ${Math.round(uploadPercent * 100)}%`);
    }
    if (!finalMetadata || !finalMetadata.id) throw new Error('DRIVE_NO_DEVOLVIO_FILE_ID');
    return finalMetadata;
  }

  function errorRecuperableConfirmacion(error) {
    const message = String(error && error.message ? error.message : error || '');
    return /Failed to fetch|NetworkError|Load failed|TIEMPO_DE_ESPERA|SIN_CONEXION|CONEXION.*NO_DISPONIBLE|HTTP_(?:408|429|5\d\d)|RESPUESTA_NO_VALIDA|CARGA_DRIVE_AUN_NO_CONFIRMADA/i.test(message);
  }

  async function publish(options) {
    const file = options && options.file;
    const api = options && options.api;
    const onProgress = options && options.onProgress;
    if (!api || typeof api.request !== 'function') throw new Error('API_NO_DISPONIBLE');
    const meta = await analyzeApk(file, onProgress);
    const common = {
      FILE_NAME: meta.fileName,
      FILE_SIZE: meta.fileSize,
      MIME_TYPE: MIME_APK,
      VERSION: meta.versionName,
      VERSION_NAME: meta.versionName,
      VERSION_CODE: meta.versionCode,
      PACKAGE_NAME: meta.packageName,
      SHA256: meta.sha256,
      VERSION_MINIMA_CODE: Number(options.minimumVersionCode || 0),
      OBLIGATORIA: options.priority === 'SI' ? 'SI' : 'NO',
      NOTAS: String(options.notes || '').trim()
    };

    emit(onProgress, 'PREPARACION', 19, 'Preparando la carga segura…');
    const prepared = await api.request('prepararCargaActualizacionAndroid', { data: common });
    const sessionUrl = prepared.sessionUrl || prepared.SESSION_URL;
    const uploadId = prepared.uploadId || prepared.UPLOAD_ID;
    if (!sessionUrl || !uploadId) throw new Error('API_NO_ENTREGO_SESION_DRIVE');

    let driveFile = null;
    let uploadError = null;
    try {
      driveFile = await uploadResumable(file, sessionUrl, onProgress);
    } catch (error) {
      uploadError = error;
      emit(onProgress, 'RECUPERACION_DRIVE', 91,
        'Verificando si el archivo fue completado…');
    }

    emit(onProgress, 'VERIFICACION', 93, 'Verificando carpeta, tamaño y acceso público…');
    let result = null;
    let confirmError = null;
    const maxConfirmAttempts = 4;
    for (let attempt = 0; attempt < maxConfirmAttempts; attempt++) {
      try {
        result = await api.request('confirmarPublicacionActualizacionAndroid', {
          data: Object.assign({}, common, {
            UPLOAD_ID: uploadId,
            DRIVE_FILE_ID: driveFile && driveFile.id ? driveFile.id : '',
            RECUPERAR_DRIVE: uploadError ? 'SI' : 'NO'
          })
        });
        break;
      } catch (error) {
        confirmError = error;
        if (!errorRecuperableConfirmacion(error)) throw error;
        if (attempt + 1 < maxConfirmAttempts) {
          emit(onProgress, 'RECUPERACION_DRIVE', 92,
            `Confirmando publicación… intento ${attempt + 2}/${maxConfirmAttempts}`);
          await delay(1500 * (attempt + 1));
        }
      }
    }
    if (!result) {
      if (uploadError) throw new Error('CARGA_DRIVE_INTERRUMPIDA_REINTENTE');
      if (confirmError) throw new Error('CONFIRMACION_SERVIDOR_INTERRUMPIDA_REINTENTE');
      throw new Error('PUBLICACION_NO_CONFIRMADA');
    }
    if (!result || result.persistenciaConfirmada !== true) throw new Error('PUBLICACION_NO_CONFIRMADA');
    emit(onProgress, 'COMPLETA', 100, 'Publicada correctamente. Notificaciones enviadas.');
    return Object.assign({ metadata: meta, driveFile: driveFile || result.drive || null }, result);
  }

  function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  global.SGFPublicadorAndroid = Object.freeze({ analyzeApk, publish, parseBinaryAndroidManifest });
})(window);
