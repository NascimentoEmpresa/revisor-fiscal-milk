"""Monta public/ a partir do código do app (../app): sistema (index), login, usuários (admin) e instalação (setup).
Uso: python3 scripts/montar_front.py  (rode antes antes o build.py do app)."""
import os, re
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
APP = os.environ.get('RF_APP', os.path.join(RAIZ, '..', 'app'))
ler = lambda p: open(os.path.join(APP, p), encoding='utf-8').read()
pub = lambda n, s: open(os.path.join(RAIZ, 'public', n), 'w', encoding='utf-8').write(s)
head = ler('src/head.html'); body = ler('src/body.html')
LOGO = 'data:image/png;base64,' + __import__('base64').b64encode(open(os.path.join(APP, 'src/assets/milk-logo.png'), 'rb').read()).decode()
pag = lambda titulo, cabeca, corpo: '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow">' + cabeca.replace('<title>Revisor Fiscal PIS/COFINS</title>', '<title>' + titulo + '</title>') + '</head><body>' + corpo + '</body></html>\n'

# 1) sistema: a versão offline (bibliotecas embutidas, nada de CDN) com o modo servidor ligado
off = ler('dist/Revisor Fiscal - offline.html')
# o leitor de PDF não vai embutido no servidor (1,5 MB a cada abertura): fica em /vendor/ e só baixa quando um PDF é importado
off = re.sub(r'<script type="text/plain" id="rf-pdfjs(?:-worker)?">.*?</script>\n', '', off, flags=re.S)
import shutil
os.makedirs(os.path.join(RAIZ, 'public', 'vendor'), exist_ok=True)
for n in ('pdf.min.js', 'pdf.worker.min.js'): shutil.copy(os.path.join(APP, 'vendor', 'pdfjs-3.11.174', n), os.path.join(RAIZ, 'public', 'vendor', n))
pub('index.html', pag('Revisor Fiscal', '<script>window.RF_SERVIDOR=true</script>', off))

# 2) login: a mesma abertura (símbolo da Milk + e-mail e senha), conferindo no servidor
ini = body.index('<div class="login"'); fimdiv = body.index('<header class="top"')
tela = body[ini:fimdiv].replace('{{MILK_LOGO}}', LOGO)
a = body.index('<script>\n/* entrada:'); b = body.index('</script>', a) + 9
js = body[a:b]
velho = js[js.index("    if (sha256hex(em.value"):js.index("  document.getElementById('lg-entrar')")]
novo = """    saindo = true; err.textContent = '';
    fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em.value.trim(), senha: pw.value }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (x.ok) { if (document.activeElement) document.activeElement.blur(); L.classList.add('ok'); setTimeout(desfazer, 1500); return; }
        saindo = false; err.textContent = (x.d && x.d.erro) || 'E-mail ou senha incorretos.'; form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); pw.value = ''; pw.focus();
      })
      .catch(function () { saindo = false; err.textContent = 'Sem conexão com o servidor. Tente de novo.'; });
  }
"""
js = js.replace(velho, novo)
js = js.replace("function fim() { L.hidden = true;", "function fim() { location.replace('/'); return; L.hidden = true;")
pub('login.html', pag('Entrar · Revisor Fiscal', head, '<main class="rf-fundo" aria-hidden="true"></main>' + tela + js))

# 3) usuários (admin) e 4) instalação: páginas simples com o visual do sistema
estilo = open(os.path.join(AQUI, 'paginas.css'), encoding='utf-8').read()
for nome in ('admin', 'setup'):
    html = open(os.path.join(AQUI, nome + '.html'), encoding='utf-8').read().replace('{{LOGO}}', LOGO)
    pub(nome + '.html', pag({'admin': 'Usuários · Revisor Fiscal', 'setup': 'Instalação · Revisor Fiscal'}[nome], head + '<style>' + estilo + '</style>', html))
print('public/: index, login, admin, setup')
