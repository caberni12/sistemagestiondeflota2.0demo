(function () {
  'use strict';

  const TAMANO_BALDOSA = 256;
  const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));
  function coordenadasValidas(latitud, longitud) {
    const lat = Number(latitud), lng = Number(longitud);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001);
  }

  const PROVEEDORES_BALDOSAS = [
    (z,x,y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    (z,x,y) => `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`,
    (z,x,y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`
  ];


  function latitudLongitudAMundo(latitud, longitud, nivel) {
    const escala = TAMANO_BALDOSA * Math.pow(2, nivel);
    const latitudLimitada = limitar(Number(latitud), -85.05112878, 85.05112878);
    const seno = Math.sin(latitudLimitada * Math.PI / 180);
    return {
      x: (Number(longitud) + 180) / 360 * escala,
      y: (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * escala
    };
  }

  function mundoALatitudLongitud(x, y, nivel) {
    const escala = TAMANO_BALDOSA * Math.pow(2, nivel);
    const longitud = x / escala * 360 - 180;
    const n = Math.PI - 2 * Math.PI * y / escala;
    const latitud = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return { latitud, longitud };
  }

  class MapaFlotas {
    constructor(contenedor, opciones = {}) {
      if (!contenedor) throw new Error('CONTENEDOR_MAPA_NO_DISPONIBLE');
      this.contenedor = contenedor;
      this.centro = Array.isArray(opciones.centro) && coordenadasValidas(opciones.centro[0], opciones.centro[1]) ? opciones.centro.map(Number) : [-33.4489, -70.6693];
      this.nivel = limitar(Number(opciones.nivel || 12), 3, 19);
      this.marcadores = [];
      this.circulos = [];
      this.rastros = [];
      this.arrastrando = false;
      this.movimientoInicial = null;
      this.centroInicial = null;
      this.ajustadoUnaVez = false;
      this.vistaActual = null;
      this.firmaMarcadores = '';
      this.firmaCirculos = '';
      this.firmaRastros = '';
      this.firmaBaldosas = '';
      this.cuadroDibujo = null;
      this.nodosMarcadores = new Map();
      this.crearEstructura();
      this.vincularEventos();
      this.manejadorCambioTamano = () => this.programarDibujo();
      if ('ResizeObserver' in window) {
        this.observador = new ResizeObserver(this.manejadorCambioTamano);
        this.observador.observe(this.contenedor);
      } else {
        this.observador = null;
        window.addEventListener('resize', this.manejadorCambioTamano);
      }
      this.dibujar();
    }

    crearEstructura() {
      this.contenedor.innerHTML = '';
      this.contenedor.classList.add('mapa-flotas');
      this.capaBaldosas = document.createElement('div');
      this.capaBaldosas.className = 'mapa-baldosas';
      this.capaCirculos = document.createElement('div');
      this.capaCirculos.className = 'mapa-circulos';
      this.capaRastros = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.capaRastros.setAttribute('class', 'mapa-rastros');
      this.capaRastros.setAttribute('aria-hidden', 'true');
      this.capaMarcadores = document.createElement('div');
      this.capaMarcadores.className = 'mapa-marcadores';
      this.aviso = document.createElement('div');
      this.aviso.className = 'mapa-aviso';
      this.aviso.innerHTML = '<b>Mapa preparado</b><span>Las ubicaciones aparecerán cuando los conductores envíen su GPS.</span>';
      this.controles = document.createElement('div');
      this.controles.className = 'mapa-controles';
      this.controles.innerHTML = '<button type="button" data-mapa-acercar aria-label="Acercar">＋</button><button type="button" data-mapa-alejar aria-label="Alejar">−</button><button type="button" data-mapa-centrar aria-label="Centrar ubicaciones">⌖</button>';
      this.contenedor.append(this.capaBaldosas, this.capaCirculos, this.capaRastros, this.capaMarcadores, this.aviso, this.controles);
    }

    vincularEventos() {
      this.controles.querySelector('[data-mapa-acercar]').addEventListener('click', () => this.cambiarNivel(1));
      this.controles.querySelector('[data-mapa-alejar]').addEventListener('click', () => this.cambiarNivel(-1));
      this.controles.querySelector('[data-mapa-centrar]').addEventListener('click', () => this.ajustarAMarcadores());
      this.contenedor.addEventListener('wheel', evento => {
        evento.preventDefault();
        this.cambiarNivel(evento.deltaY < 0 ? 1 : -1);
      }, { passive: false });
      this.contenedor.addEventListener('pointerdown', evento => {
        if (evento.target.closest('button')) return;
        this.arrastrando = true;
        this.movimientoInicial = { x: evento.clientX, y: evento.clientY };
        this.centroInicial = latitudLongitudAMundo(this.centro[0], this.centro[1], this.nivel);
        this.contenedor.setPointerCapture(evento.pointerId);
        this.contenedor.classList.add('arrastrando');
      });
      this.contenedor.addEventListener('pointermove', evento => {
        if (!this.arrastrando) return;
        const dx = evento.clientX - this.movimientoInicial.x;
        const dy = evento.clientY - this.movimientoInicial.y;
        const nuevo = mundoALatitudLongitud(this.centroInicial.x - dx, this.centroInicial.y - dy, this.nivel);
        this.centro = [nuevo.latitud, nuevo.longitud];
        this.programarDibujo();
      });
      const terminar = () => { this.arrastrando = false; this.contenedor.classList.remove('arrastrando'); };
      this.contenedor.addEventListener('pointerup', terminar);
      this.contenedor.addEventListener('pointercancel', terminar);
    }

    cambiarNivel(cambio) {
      const nuevoNivel = limitar(this.nivel + cambio, 3, 19);
      if (nuevoNivel === this.nivel) return;
      this.nivel = nuevoNivel;
      this.dibujar();
    }

    programarDibujo() {
      if (this.cuadroDibujo !== null) return;
      this.cuadroDibujo = requestAnimationFrame(() => {
        this.cuadroDibujo = null;
        this.dibujar();
      });
    }

    establecerVista(latitud, longitud, nivel = this.nivel) {
      if (!coordenadasValidas(latitud, longitud)) return;
      const centroNuevo = [Number(latitud), Number(longitud)];
      const nivelNuevo = limitar(Number(nivel), 3, 19);
      if (this.centro[0] === centroNuevo[0] && this.centro[1] === centroNuevo[1] && this.nivel === nivelNuevo) return;
      this.centro = centroNuevo;
      this.nivel = nivelNuevo;
      this.dibujar();
    }

    actualizarMarcadores(marcadores, ajustar = false) {
      const unicos = new Map();
      (marcadores || []).forEach((item, indice) => {
        if (!coordenadasValidas(item.latitud, item.longitud)) return;
        const clave = String(item.id || `marcador-${indice}`);
        unicos.set(clave, { ...item, id: clave });
      });
      const nuevos = [...unicos.values()];
      const firma = JSON.stringify(nuevos.map(item => [
        item.id || '', Number(item.latitud), Number(item.longitud), item.nombre || '', item.direccion || '',
        Boolean(item.activo), Boolean(item.seguido), item.detalle || '', item.acciones || ''
      ]));
      const sinCambios = firma === this.firmaMarcadores;
      this.firmaMarcadores = firma;
      this.marcadores = nuevos;
      this.aviso.hidden = this.marcadores.length > 0;
      if (sinCambios && !ajustar && this.vistaActual) return;
      if ((ajustar || !this.ajustadoUnaVez) && this.marcadores.length) {
        this.ajustarAMarcadores();
        this.ajustadoUnaVez = true;
      } else if (this.vistaActual) {
        this.dibujarMarcadores(this.vistaActual.izquierda, this.vistaActual.arriba);
      } else {
        this.dibujar();
      }
    }

    actualizarCirculos(circulos = []) {
      const nuevos = (circulos || []).filter(item =>
        coordenadasValidas(item.latitud, item.longitud) &&
        Number.isFinite(Number(item.radio)) && Number(item.radio) > 0
      );
      const firma = JSON.stringify(nuevos.map(item => [item.id || '', Number(item.latitud), Number(item.longitud), Number(item.radio), item.clase || '', item.etiqueta || '']));
      if (firma === this.firmaCirculos && this.vistaActual) return;
      this.firmaCirculos = firma;
      this.circulos = nuevos;
      if (this.vistaActual) this.dibujarCirculos(this.vistaActual.izquierda, this.vistaActual.arriba);
      else this.dibujar();
    }

    actualizarRastros(rastros = []) {
      const nuevos = (rastros || []).map(item => ({
        ...item,
        puntos:(item.puntos || []).filter(punto =>
          coordenadasValidas(punto.latitud, punto.longitud)
        ).slice(-40)
      })).filter(item => item.puntos.length > 1);
      const firma = JSON.stringify(nuevos.map(item => [item.id || '', item.clase || '', item.puntos.map(punto => [Number(punto.latitud), Number(punto.longitud)])]));
      if (firma === this.firmaRastros && this.vistaActual) return;
      this.firmaRastros = firma;
      this.rastros = nuevos;
      if (this.vistaActual) this.dibujarRastros(this.vistaActual.izquierda, this.vistaActual.arriba);
      else this.dibujar();
    }

    ajustarAMarcadores() {
      if (!this.marcadores.length && !this.circulos.length) return this.dibujar();
      const puntos = this.marcadores.map(item => ({ latitud:Number(item.latitud), longitud:Number(item.longitud) }));
      this.circulos.forEach(item => {
        const latitud = Number(item.latitud), longitud = Number(item.longitud), radio = Number(item.radio);
        const deltaLatitud = radio / 111320;
        const coseno = Math.max(0.15, Math.cos(latitud * Math.PI / 180));
        const deltaLongitud = radio / (111320 * coseno);
        puntos.push(
          { latitud:latitud - deltaLatitud, longitud },
          { latitud:latitud + deltaLatitud, longitud },
          { latitud, longitud:longitud - deltaLongitud },
          { latitud, longitud:longitud + deltaLongitud }
        );
      });
      const latitudes = puntos.map(item => Number(item.latitud));
      const longitudes = puntos.map(item => Number(item.longitud));
      const minLat = Math.min(...latitudes), maxLat = Math.max(...latitudes);
      const minLng = Math.min(...longitudes), maxLng = Math.max(...longitudes);
      this.centro = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
      const ancho = Math.max(this.contenedor.clientWidth - 90, 240);
      const alto = Math.max(this.contenedor.clientHeight - 90, 220);
      let nivelElegido = 16;
      for (let nivel = 16; nivel >= 3; nivel -= 1) {
        const a = latitudLongitudAMundo(maxLat, minLng, nivel);
        const b = latitudLongitudAMundo(minLat, maxLng, nivel);
        if (Math.abs(b.x - a.x) <= ancho && Math.abs(b.y - a.y) <= alto) { nivelElegido = nivel; break; }
      }
      this.nivel = nivelElegido;
      this.dibujar();
    }

    dibujar() {
      if (this.cuadroDibujo !== null) {
        cancelAnimationFrame(this.cuadroDibujo);
        this.cuadroDibujo = null;
      }
      const ancho = this.contenedor.clientWidth || 800;
      const alto = this.contenedor.clientHeight || 480;
      const centroMundo = latitudLongitudAMundo(this.centro[0], this.centro[1], this.nivel);
      const izquierda = centroMundo.x - ancho / 2;
      const arriba = centroMundo.y - alto / 2;
      this.vistaActual = { izquierda, arriba, ancho, alto, nivel:this.nivel };
      this.dibujarBaldosas(izquierda, arriba, ancho, alto);
      this.dibujarCirculos(izquierda, arriba);
      this.dibujarRastros(izquierda, arriba);
      this.dibujarMarcadores(izquierda, arriba);
    }

    dibujarBaldosas(izquierda, arriba, ancho, alto) {
      const total = Math.pow(2, this.nivel);
      const inicioX = Math.floor(izquierda / TAMANO_BALDOSA);
      const finX = Math.floor((izquierda + ancho) / TAMANO_BALDOSA);
      const inicioY = Math.floor(arriba / TAMANO_BALDOSA);
      const finY = Math.floor((arriba + alto) / TAMANO_BALDOSA);
      const firma = `${this.nivel}|${inicioX}|${finX}|${inicioY}|${finY}`;
      if (firma === this.firmaBaldosas && this.capaBaldosas.childElementCount) {
        [...this.capaBaldosas.children].forEach(imagen => {
          imagen.style.left = `${Number(imagen.dataset.mapaX) * TAMANO_BALDOSA - izquierda}px`;
          imagen.style.top = `${Number(imagen.dataset.mapaY) * TAMANO_BALDOSA - arriba}px`;
        });
        return;
      }
      this.firmaBaldosas = firma;
      this.capaBaldosas.innerHTML = '';
      const fragmento = document.createDocumentFragment();
      for (let x = inicioX; x <= finX; x += 1) {
        for (let y = inicioY; y <= finY; y += 1) {
          if (y < 0 || y >= total) continue;
          const xNormalizado = ((x % total) + total) % total;
          const imagen = document.createElement('img');
          imagen.alt = '';
          imagen.draggable = false;
          imagen.loading = 'eager';
          imagen.referrerPolicy = 'origin-when-cross-origin';
          imagen.dataset.mapaX = String(x);
          imagen.dataset.mapaY = String(y);
          let proveedor = 0;
          const cargarProveedor = () => { imagen.src = PROVEEDORES_BALDOSAS[proveedor](this.nivel,xNormalizado,y); };
          imagen.style.left = `${x * TAMANO_BALDOSA - izquierda}px`;
          imagen.style.top = `${y * TAMANO_BALDOSA - arriba}px`;
          imagen.addEventListener('load', () => imagen.classList.remove('error-baldosa'));
          imagen.addEventListener('error', () => {
            proveedor += 1;
            if (proveedor < PROVEEDORES_BALDOSAS.length) cargarProveedor();
            else imagen.classList.add('error-baldosa');
          });
          cargarProveedor();
          fragmento.appendChild(imagen);
        }
      }
      this.capaBaldosas.appendChild(fragmento);
    }

    dibujarCirculos(izquierda, arriba) {
      if (!this.capaCirculos) return;
      this.capaCirculos.innerHTML = '';
      const fragmento = document.createDocumentFragment();
      this.circulos.forEach(item => {
        const centro = latitudLongitudAMundo(item.latitud, item.longitud, this.nivel);
        const deltaLatitud = Number(item.radio) / 111320;
        const borde = latitudLongitudAMundo(Number(item.latitud) + deltaLatitud, item.longitud, this.nivel);
        const radioPixeles = Math.max(5, Math.abs(borde.y - centro.y));
        const circulo = document.createElement('div');
        circulo.className = `mapa-radio ${item.clase || ''}`.trim();
        circulo.style.left = `${centro.x - izquierda - radioPixeles}px`;
        circulo.style.top = `${centro.y - arriba - radioPixeles}px`;
        circulo.style.width = `${radioPixeles * 2}px`;
        circulo.style.height = `${radioPixeles * 2}px`;
        circulo.title = item.titulo || item.etiqueta || `Radio: ${Math.round(item.radio)} m`;
        if (item.etiqueta) {
          const etiqueta = document.createElement('span');
          etiqueta.textContent = item.etiqueta;
          circulo.appendChild(etiqueta);
        }
        fragmento.appendChild(circulo);
      });
      this.capaCirculos.appendChild(fragmento);
    }

    dibujarRastros(izquierda, arriba) {
      if (!this.capaRastros) return;
      const ancho = this.vistaActual?.ancho || this.contenedor.clientWidth || 800;
      const alto = this.vistaActual?.alto || this.contenedor.clientHeight || 480;
      this.capaRastros.replaceChildren();
      this.capaRastros.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
      this.capaRastros.setAttribute('width', String(ancho));
      this.capaRastros.setAttribute('height', String(alto));
      this.rastros.forEach(item => {
        const coordenadas = item.puntos.map(punto => {
          const mundo = latitudLongitudAMundo(punto.latitud, punto.longitud, this.nivel);
          return `${mundo.x - izquierda},${mundo.y - arriba}`;
        }).join(' ');
        const linea = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        linea.setAttribute('points', coordenadas);
        linea.setAttribute('class', `mapa-rastro ${item.clase || ''}`.trim());
        linea.setAttribute('vector-effect', 'non-scaling-stroke');
        this.capaRastros.appendChild(linea);
        item.puntos.forEach((punto, indice) => {
          const mundo = latitudLongitudAMundo(punto.latitud, punto.longitud, this.nivel);
          const circulo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circulo.setAttribute('cx', String(mundo.x - izquierda));
          circulo.setAttribute('cy', String(mundo.y - arriba));
          circulo.setAttribute('r', indice === item.puntos.length - 1 ? '4.5' : '2.5');
          circulo.setAttribute('class', indice === item.puntos.length - 1 ? 'mapa-rastro-punto actual' : 'mapa-rastro-punto');
          this.capaRastros.appendChild(circulo);
        });
      });
    }

    dibujarMarcadores(izquierda, arriba) {
      const vigentes = new Set();
      this.marcadores.forEach((item, indice) => {
        const clave = String(item.id || `marcador-${indice}`);
        vigentes.add(clave);
        const punto = latitudLongitudAMundo(item.latitud, item.longitud, this.nivel);
        let boton = this.nodosMarcadores.get(clave);
        if (!boton) {
          boton = document.createElement('div');
          boton.tabIndex = 0;
          boton.setAttribute('role','button');
          boton.dataset.marcadorId = clave;
          const icono = document.createElement('i');
          icono.textContent = '⌖';
          const etiqueta = document.createElement('span');
          const tituloEtiqueta = document.createElement('strong');
          const direccionEtiqueta = document.createElement('small');
          direccionEtiqueta.className = 'mapa-etiqueta-direccion';
          etiqueta.append(tituloEtiqueta, direccionEtiqueta);
          const detalle = document.createElement('div');
          detalle.className = 'mapa-detalle';
          boton.append(icono, etiqueta, detalle);
          boton.addEventListener('click', evento => {
            evento.stopPropagation();
            if (evento.target.closest('[data-map-close]')) { boton.classList.remove('abierto'); return; }
            if (evento.target.closest('button,a,input,label')) return;
            this.capaMarcadores.querySelectorAll('.mapa-marcador.abierto').forEach(nodo => { if (nodo !== boton) nodo.classList.remove('abierto'); });
            boton.classList.toggle('abierto');
          });
          boton.addEventListener('keydown', evento => {
            if ((evento.key === 'Enter' || evento.key === ' ') && evento.target === boton) {
              evento.preventDefault(); boton.click();
            }
          });
          this.nodosMarcadores.set(clave, boton);
          this.capaMarcadores.appendChild(boton);
        }
        boton.style.transform = `translate3d(${punto.x - izquierda}px, ${punto.y - arriba}px, 0) translate(-50%, -50%)`;
        const firmaContenido = `${item.activo ? '1' : '0'}|${item.seguido ? '1' : '0'}|${item.nombre || ''}|${item.direccion || ''}|${item.detalle || ''}|${item.acciones || ''}`;
        if (boton.dataset.firmaContenido !== firmaContenido) {
          const abierto = boton.classList.contains('abierto');
          boton.className = `mapa-marcador ${item.activo ? 'activo' : 'antiguo'} ${item.seguido ? 'seguido' : ''} ${abierto ? 'abierto' : ''}`.trim();
          const direccion=String(item.direccion||'').trim();
          boton.setAttribute('aria-label', `Ubicación de ${item.nombre || 'conductor'}${direccion?`, en ${direccion}`:''}`);
          boton.title=direccion||item.nombre||'Ubicación';
          const etiqueta=boton.querySelector(':scope > span');
          let titulo=etiqueta?.querySelector(':scope > strong'),subtitulo=etiqueta?.querySelector(':scope > small');
          if(etiqueta&&!titulo){titulo=document.createElement('strong');subtitulo=document.createElement('small');subtitulo.className='mapa-etiqueta-direccion';etiqueta.replaceChildren(titulo,subtitulo);}
          if(titulo)titulo.textContent=item.nombre||'Conductor';
          if(subtitulo){subtitulo.textContent=direccion;subtitulo.hidden=!direccion;}
          boton.querySelector(':scope > .mapa-detalle').innerHTML = `<div class="mapa-detalle-contenido">${item.detalle || ''}</div><div class="mapa-detalle-acciones">${item.acciones || ''}<button type="button" class="btn danger small" data-map-close aria-label="Cerrar detalle">× Cerrar</button></div>`;
          boton.dataset.firmaContenido = firmaContenido;
        }
      });
      this.nodosMarcadores.forEach((nodo, clave) => {
        if (vigentes.has(clave)) return;
        nodo.remove();
        this.nodosMarcadores.delete(clave);
      });
    }

    redibujar() { this.dibujar(); }

    eliminar() {
      if (this.cuadroDibujo !== null) cancelAnimationFrame(this.cuadroDibujo);
      this.cuadroDibujo = null;
      if (this.observador) this.observador.disconnect();
      if (!this.observador && this.manejadorCambioTamano) window.removeEventListener('resize', this.manejadorCambioTamano);
      this.nodosMarcadores.clear();
      this.contenedor.innerHTML = '';
    }
  }

  window.MapaFlotas = MapaFlotas;
})();
