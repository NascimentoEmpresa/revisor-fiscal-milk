# recalcula no LibreOffice e compara cada célula com fórmula com o valor gravado pelo Revisor
import sys, os, subprocess, shutil, openpyxl, math
src = sys.argv[1]; out = '/tmp/claude-0/lochk/out'; shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
tmp = os.path.join(out, 'in.xlsx'); shutil.copy(src, tmp)
subprocess.run(['soffice', '-env:UserInstallation=file:///tmp/claude-0/lochk/profile', '--headless', '--convert-to', 'xlsx:Calc MS Excel 2007 XML', '--outdir', out + '/r', tmp], capture_output=True, timeout=900)
rec = os.path.join(out, 'r', 'in.xlsx')
f = openpyxl.load_workbook(tmp, read_only=True)            # fórmulas
v0 = openpyxl.load_workbook(tmp, read_only=True, data_only=True)  # valores gravados pelo Revisor
v1 = openpyxl.load_workbook(rec, read_only=True, data_only=True)  # recalculados
nf = bad = 0; ex = []
for ws in f.worksheets:
    if ws.title not in v1.sheetnames: print('  aba sumiu no LibreOffice:', ws.title); continue
    a = v0[ws.title].iter_rows(values_only=True); b = v1[ws.title].iter_rows(values_only=True)
    for r_f, r_a, r_b in zip(ws.iter_rows(values_only=True), a, b):
        for j, x in enumerate(r_f):
            if isinstance(x, str) and x.startswith('='):
                nf += 1; ca = r_a[j] if j < len(r_a) else None; cb = r_b[j] if j < len(r_b) else None
                na = ca if isinstance(ca, (int, float)) else None; nb = cb if isinstance(cb, (int, float)) else None
                same = (na is not None and nb is not None and abs(na - nb) <= 0.011) or (ca == cb) or (na in (None, 0) and nb in (None, 0))
                if not same:
                    bad += 1
                    if len(ex) < 8: ex.append((ws.title, j, x[:60], ca, cb))
print('%s: %d fórmulas, %d divergências' % (os.path.basename(src), nf, bad))
for e in ex: print('   ', e)
