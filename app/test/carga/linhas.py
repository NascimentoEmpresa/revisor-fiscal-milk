import zipfile,re,sys
z=zipfile.ZipFile(sys.argv[1]); wb=z.read('xl/workbook.xml').decode()
names=re.findall(r'<sheet name="([^"]*)"',wb)
for i,n in enumerate(names,1):
    last=b''; 
    with z.open(f'xl/worksheets/sheet{i}.xml') as fh:
        while True:
            c=fh.read(1<<24)
            if not c: break
            last=(last+c)[-200000:]
    m=re.findall(rb'<row r="(\d+)"',last)
    r=int(m[-1]) if m else 0
    print(f'{n:28s} {r:>9}', 'ACIMA DO LIMITE' if r>1048576 else '')
