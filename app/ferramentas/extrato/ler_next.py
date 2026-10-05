"""Lê o extrato PDF da conta Next (Bradesco) e grava as linhas em JSON.

Uso: python3 ler_next.py extrato.pdf saida.json   (precisa de pdfminer.six)
Cada linha: data, tipo, detalhe, docto, credito, debito (centavos, debito negativo) e
saldo corrido. Depois de ler, confira: saldo anterior + soma == saldo final do PDF
(conferencias do pedido do subir-painel). Não guarda dado pessoal.
"""
import re, json, sys
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextContainer, LTTextLine
F=sys.argv[1]
def brl(s):
    s=s.replace('R$','').strip().replace('.','').replace(',','.')
    return round(float(s)*100)
stream=[]
for pg in extract_pages(F):
    rows=[]
    for el in pg:
        if isinstance(el,LTTextContainer):
            for ln in el:
                if isinstance(ln,LTTextLine):
                    t=ln.get_text().strip()
                    if t: rows.append((ln.y0,ln.x0,t))
    rows.sort(key=lambda r:(-round(r[0]),r[1]))
    stream.append(rows)
tx2=[]; data=None; cur=None
for pi,rows in enumerate(stream):
    for y,x,t in rows:
        if y>(610 if pi==0 else 750): continue
        if x<100:
            if re.match(r'^\d\d/\d\d/\d{4}$',t): data=t
            continue
        if 100<=x<200:
            if t=='Saldo Anterior': cur={'especial':'anterior'}; tx2.append(cur); continue
            if t=='Saldo do Dia': cur={'especial':'dia'}; tx2.append(cur); continue
            if re.match(r'^\d{3,4}-',t):
                cur={'tipo':t,'detalhe':[],'docto':'','credito':0,'debito':0,'saldo':None,'data':None}; tx2.append(cur); continue
            if cur is not None and 'tipo' in cur: cur['detalhe'].append(t)
            continue
        if cur is None: continue
        if 'tipo' in cur and cur['data'] is None and (280<x<350 or 350<x<500 or x>=500): cur['data']=data
        if 280<x<350 and t.isdigit(): cur['docto']=t
        elif 350<x<430 and t.startswith('R$'): cur['credito']=brl(t)
        elif 430<x<500 and t.startswith('R$'): cur['debito']=brl(t)
        elif x>=500 and t.startswith('R$'): cur['saldo']=brl(t)
        if cur.get('especial') and x>=500 and t.startswith('R$'): cur['saldo']=brl(t)
lista=[t for t in tx2 if 'tipo' in t]
ant=[t for t in tx2 if t.get('especial')=='anterior']
print('transacoes',len(lista),'primeiro saldo',[a.get('saldo') for a in ant][:1], 'paginas', len(stream))
json.dump(tx2,open(sys.argv[2],'w',encoding='utf-8'),ensure_ascii=False)
