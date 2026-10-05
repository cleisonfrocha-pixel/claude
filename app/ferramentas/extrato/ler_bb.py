"""Lê extratos PDF de conta corrente do Banco do Brasil (um PDF por mês).

Uso: python3 ler_bb.py 'pasta/*Extrato*.pdf' saida.json   (precisa de pdfminer.six)
Sai {mes: [linhas]}; as linhas Saldo Anterior / Saldo do dia / S A L D O servem para
conferir mês a mês. Linhas de Pix rejeitado e estorno de cartão podem sair fora de
alinhamento no PDF: confira o saldo final de cada mês antes de usar.
"""
import re,json,glob,sys
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextContainer,LTTextLine
def num(s):
    m=re.match(r'([\d.]+,\d\d) \(([+-])\)',s)
    if not m: return None
    v=round(float(m.group(1).replace('.','').replace(',','.'))*100)
    return v if m.group(2)=='+' else -v
out={}
for f in sorted(glob.glob(sys.argv[1])):
    mes=f.split('_-_')[1][:6]
    rows=[]
    for p in extract_pages(f):
        for el in p:
            if isinstance(el,LTTextContainer):
                for l in el:
                    if isinstance(l,LTTextLine): rows.append((round(l.y0),round(l.x0),l.get_text().strip()))
    # uma página só por arquivo? tratar como lista contínua (y decresce); se várias páginas, já vêm em ordem de página
    tx=[]
    dates=[r for r in rows if r[1]==30 and re.match(r'\d\d/\d\d/\d{4}$',r[2])]
    for y,x,d in dates:
        val=[r for r in rows if abs(r[0]-y)<=1 and r[1]>=440 and num(r[2]) is not None]
        if not val: continue
        v=num(val[0][2])
        tipo=[r for r in rows if r[1]==265 and 2<=r[0]-y<=9]
        # saldo do dia / saldo anterior ficam na mesma linha
        mesmo=[r for r in rows if abs(r[0]-y)<=1 and r[1]==265]
        det=[r for r in rows if r[1]==265 and -13<=r[0]-y<=-3]
        doc=[r[2] for r in rows if abs(r[0]-y)<=1 and r[1]==148]
        if mesmo and mesmo[0][2] in('Saldo do dia','Saldo Anterior','S A L D O'):
            tx.append(dict(data=d,tipo=mesmo[0][2],valor=v)); continue
        tx.append(dict(data=d,tipo=tipo[0][2] if tipo else '',detalhe=det[0][2] if det else '',doc=doc[0] if doc else '',valor=v))
    out[mes]=tx
json.dump(out,open(sys.argv[2],'w',encoding='utf-8'),ensure_ascii=False,indent=0)
for m,tx in out.items():
    saldo=None;err=0;n=0;ent=sai=0
    for t in tx:
        if t['tipo']=='Saldo Anterior': saldo=t['valor']; continue
        if t['tipo']=='S A L D O': print(m,'saldo final',t['valor']/100,'calc',saldo/100); continue
        if t['tipo']=='Saldo do dia':
            if t['valor']!=saldo: err+=1; print('  DIV dia',t['data'],t['valor'],saldo)
            continue
        n+=1; saldo+=t['valor']
        if t['valor']>0: ent+=t['valor']
        else: sai+=t['valor']
    print(m,'linhas',n,'erros',err,'entradas',ent/100,'saidas',sai/100)
