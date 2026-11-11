#!/usr/bin/env python3
"""Monta o Revisor Fiscal em dois arquivos:
   dist/revisor-fiscal.html          -> página publicada como Artifact (bibliotecas via CDN)
   dist/Revisor Fiscal - offline.html -> arquivo único que funciona sem internet (bibliotecas embutidas)"""
import glob, os, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
src = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()
import base64
LOGO = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(ROOT, 'src/assets/milk-logo.png'), 'rb').read()).decode()
MODELO = base64.b64encode(open(os.path.join(ROOT, 'src/assets/modelo-milk.docx'), 'rb').read()).decode()  # diagnóstico da Milk sem dados de cliente (tools/modelo_padrao.js)
head, body = src('src/head.html'), src('src/body.html').replace('{{MILK_LOGO}}', LOGO)
js = '\n'.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(ROOT, 'src/js/*.js')))).replace('{{MILK_LOGO}}', LOGO).replace('{{MODELO_MILK}}', MODELO)
assert '</script' not in js.lower()

XLSX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
FFLATE_CDN = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js'

def vendor(path):
    t = open(os.path.join(ROOT, path), encoding='utf-8').read()
    return t.replace('<!--', '<\\!--').replace('</script', '<\\/script')

app = '<script>\n' + js + '\n</script>\n'
artifact = head + '\n' + body + '\n<script src="' + XLSX_CDN + '"></script>\n<script src="' + FFLATE_CDN + '"></script>\n' + app
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
open(os.path.join(ROOT, 'dist/revisor-fiscal.html'), 'w', encoding='utf-8').write(artifact)

offline = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
           + head + '\n</head>\n<body>\n' + body
           + '\n<script>\n' + vendor('vendor/xlsx-0.18.5/package/dist/xlsx.full.min.js') + '\n</script>\n<script>\n'
           + vendor('vendor/fflate-0.8.2/package/umd/index.js') + '\n</script>\n'
           # leitor de PDF (PER/DCOMP): só é executado quando um PDF é importado; no servidor vem de /vendor/
           + '<script type="text/plain" id="rf-pdfjs-worker">' + vendor('vendor/pdfjs-3.11.174/pdf.worker.min.js') + '</script>\n'
           + '<script type="text/plain" id="rf-pdfjs">' + vendor('vendor/pdfjs-3.11.174/pdf.min.js') + '</script>\n' + app + '</body>\n</html>\n')
open(os.path.join(ROOT, 'dist/Revisor Fiscal - offline.html'), 'w', encoding='utf-8').write(offline)
for f in ('dist/revisor-fiscal.html', 'dist/Revisor Fiscal - offline.html'):
    print(f, round(os.path.getsize(os.path.join(ROOT, f)) / 1024), 'KB')
