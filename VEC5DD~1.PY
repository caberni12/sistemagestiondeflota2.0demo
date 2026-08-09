#!/usr/bin/env python3
"""Validación local de estructura, estilos y referencias de la Web 4.2.47."""
from __future__ import annotations

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import re
import sys

ROOT = Path(__file__).resolve().parent
CACHE_TAG = "4.2.47-ui9"
MODERN_CSS = f"interfaz-moderna.css?v={CACHE_TAG}"


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.refs: list[str] = []
        self.inline_styles: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(values["id"])
        if values.get("style"):
            self.inline_styles.append(f"{tag}#{values.get('id', '')}")
        for key in ("href", "src"):
            if values.get(key):
                self.refs.append(values[key])


def local_path(reference: str) -> Path | None:
    if reference.startswith(("#", "data:", "mailto:", "tel:", "javascript:")):
        return None
    parsed = urlsplit(reference)
    if parsed.scheme or parsed.netloc:
        return None
    return ROOT / parsed.path


def balanced_css(text: str) -> bool:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r'"(?:\\.|[^"\\])*"', '""', text)
    text = re.sub(r"'(?:\\.|[^'\\])*'", "''", text)
    depth = 0
    for char in text:
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth < 0:
                return False
    return depth == 0


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    html_files = sorted(ROOT.glob("*.html"))
    css_files = sorted(ROOT.glob("*.css"))
    js_files = sorted(p for p in ROOT.glob("*.js") if p.name != "jszip.min.js")

    required = {
        "index.html", "main.html", "estilos.css", "responsive.css",
        "acceso.css", "menu-principal.css", "interfaz-moderna.css",
        "aplicacion.js", "menu-principal.js", "tema.js", "logo.svg",
    }
    for name in sorted(required):
        if not (ROOT / name).exists():
            errors.append(f"Falta archivo obligatorio: {name}")

    for page in html_files:
        text = page.read_text(encoding="utf-8")
        parser = PageParser()
        parser.feed(text)
        duplicates = [name for name, count in Counter(parser.ids).items() if count > 1]
        if duplicates:
            errors.append(f"{page.name}: IDs duplicados: {', '.join(duplicates)}")
        if parser.inline_styles:
            errors.append(f"{page.name}: estilos inline: {', '.join(parser.inline_styles)}")
        for ref in parser.refs:
            path = local_path(ref)
            if path is not None and not path.exists():
                errors.append(f"{page.name}: referencia local inexistente: {ref}")
        if page.name != "inicio-nativo.html" and MODERN_CSS not in text:
            errors.append(f"{page.name}: no carga {MODERN_CSS}")
        if "?v=4.2.36" in text:
            errors.append(f"{page.name}: conserva la etiqueta de caché antigua 4.2.36")

    for sheet in css_files:
        text = sheet.read_text(encoding="utf-8")
        if not balanced_css(text):
            errors.append(f"{sheet.name}: llaves CSS desbalanceadas")

    modern = (ROOT / "interfaz-moderna.css").read_text(encoding="utf-8")
    required_tokens = (
        "--ui-primary", "--ui-surface", "--ui-text", "--ui-border",
        "--success", "--danger", "--surface-soft", "prefers-reduced-motion",
        ":focus-visible", "@media print",
    )
    for token in required_tokens:
        if token not in modern:
            errors.append(f"interfaz-moderna.css: falta token/regla requerida {token}")

    all_css = "\n".join(p.read_text(encoding="utf-8") for p in css_files)
    defined = set(re.findall(r"--([A-Za-z0-9_-]+)\s*:", all_css))
    used = set(re.findall(r"var\(\s*--([A-Za-z0-9_-]+)", all_css))
    unresolved = sorted(used - defined)
    if unresolved:
        warnings.append("Variables con fallback o definición externa: " + ", ".join(unresolved))

    for script in js_files:
        text = script.read_text(encoding="utf-8")
        if "?v=4.2.36" in text:
            errors.append(f"{script.name}: conserva la etiqueta de caché antigua 4.2.36")

    print("VALIDACIÓN WEB 4.2.47")
    print(f"HTML revisados: {len(html_files)}")
    print(f"CSS revisados: {len(css_files)}")
    print(f"JavaScript inventariados: {len(js_files)}")
    if warnings:
        print("ADVERTENCIAS:")
        for item in warnings:
            print(f"- {item}")
    if errors:
        print("ERRORES:")
        for item in errors:
            print(f"- {item}")
        return 1
    print("RESULTADO: APROBADO")
    return 0


if __name__ == "__main__":
    sys.exit(main())
