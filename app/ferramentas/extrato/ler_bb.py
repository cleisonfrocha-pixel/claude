"""Lê extratos PDF de conta corrente do Banco do Brasil (um PDF por mês).

Uso: python3 ler_bb.py 'pasta/*Extrato*.pdf' saida.json   (precisa de pdfminer.six)
Sai {mes: [linhas]}. Cada linha tem data, tipo, detalhe, doc e valor em centavos com sinal.
As linhas Saldo Anterior / Saldo do dia / S A L D O servem para conferir dia a dia e mês a mês;
o script imprime qualquer divergência. Cada página é lida separada (as coordenadas se repetem
de página para página), e o texto de uma operação pode vir em duas ou três linhas.
"""
import re, json, glob, sys
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextContainer, LTTextLine

SALDOS = ("Saldo do dia", "Saldo Anterior", "S A L D O")
RODAPE = ("Informações Adicionais", "Taxa Limite", "Informações Complementares")


def num(s):
    m = re.match(r"([\d.]+,\d\d) \(([+-])\)", s)
    if not m:
        return None
    v = round(float(m.group(1).replace(".", "").replace(",", ".")) * 100)
    return v if m.group(2) == "+" else -v


def linhas_da_pagina(pagina):
    rows = []
    for el in pagina:
        if isinstance(el, LTTextContainer):
            for l in el:
                if isinstance(l, LTTextLine):
                    rows.append((round(l.y0), round(l.x0), l.get_text().strip()))
    corte = max((y for y, x, t in rows if x == 30 and t.startswith(RODAPE)), default=-1)
    return [r for r in rows if r[0] > corte and r[0] < 742 and r[1] != 25 and not (r[1] == 20)]


def ler_pagina(rows):
    datas = sorted((r for r in rows if r[1] == 30 and re.match(r"\d\d/\d\d/\d{4}$", r[2])), key=lambda r: -r[0])
    textos = sorted((r for r in rows if r[1] == 265), key=lambda r: -r[0])
    saida = []
    for i, (y, _, d) in enumerate(datas):
        val = next((num(r[2]) for r in rows if abs(r[0] - y) <= 1 and r[1] >= 440 and num(r[2]) is not None), None)
        if val is None:
            continue
        mesmo = [r for r in textos if abs(r[0] - y) <= 1]
        if mesmo and mesmo[0][2] in SALDOS:
            saida.append(dict(data=d, tipo=mesmo[0][2], valor=val, _y=y))
            continue
        acima = [r for r in textos if y + 1 < r[0] <= y + 14]
        tipo = min(acima, key=lambda r: r[0] - y) if acima else None
        saida.append(dict(data=d, tipo=tipo[2] if tipo else "", valor=val, _y=y, _tipo_y=tipo[0] if tipo else None,
                          doc=next((r[2] for r in rows if abs(r[0] - y) <= 1 and r[1] == 148), "")))
    # detalhe: linhas x=265 que não são tipo, entre a data (inclusive) e o tipo da próxima operação
    tipos_y = {e["_tipo_y"] for e in saida if e.get("_tipo_y") is not None}
    saldos_y = {e["_y"] for e in saida if e["tipo"] in SALDOS}
    for k, e in enumerate(saida):
        if e["tipo"] in SALDOS:
            continue
        proximos = [x["_tipo_y"] if x.get("_tipo_y") is not None else x["_y"] + 6 for x in saida[k + 1:]]
        limite = max(proximos[0], -1) if proximos else -1
        partes = [r[2] for r in textos if r[0] <= e["_y"] + 1 and r[0] > limite and r[0] not in tipos_y and r[0] not in saldos_y]
        e["detalhe"] = " ".join(partes).strip()
    for e in saida:
        e.pop("_y", None); e.pop("_tipo_y", None)
    return saida


def ler_pdf(arquivo):
    tx = []
    for pagina in extract_pages(arquivo):
        tx += ler_pagina(linhas_da_pagina(pagina))
    return tx


def conferir(mes, tx):
    saldo = None
    erros = 0
    n = ent = sai = 0
    for t in tx:
        if t["tipo"] == "Saldo Anterior":
            saldo = t["valor"]
            continue
        if t["tipo"] == "S A L D O":
            ok = "ok" if saldo == t["valor"] else "DIVERGE"
            print(mes, "saldo final impresso", t["valor"] / 100, "calculado", saldo / 100, ok)
            erros += 0 if ok == "ok" else 1
            continue
        if t["tipo"] == "Saldo do dia":
            if t["valor"] != saldo:
                erros += 1
                print("  DIV dia", t["data"], t["valor"], saldo)
            continue
        n += 1
        saldo += t["valor"]
        if t["valor"] > 0:
            ent += t["valor"]
        else:
            sai += t["valor"]
    print(mes, "linhas", n, "erros", erros, "entradas", ent / 100, "saidas", sai / 100)
    return erros


if __name__ == "__main__":
    out = {}
    for f in sorted(glob.glob(sys.argv[1])):
        out[f.split("_-_")[1][:6]] = ler_pdf(f)
    json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    total = sum(conferir(m, tx) for m, tx in out.items())
    sys.exit(1 if total else 0)
