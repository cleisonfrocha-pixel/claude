"""Lê o CSV de extrato do Nubank (Data, Valor, Identificador, Descrição).

Uso: python3 ler_nubank_csv.py extrato.csv saida.json
Sai a lista [{iso, c (centavos com sinal), id (UUID do Nubank), desc}]. O Identificador
vira `idExterno` no pedido: reimportar o mesmo CSV nunca duplica. Confira o saldo
inicial e o final do PDF equivalente (saldo inicial + soma == saldo final).
"""
import csv, json, sys

linhas = []
with open(sys.argv[1], encoding="utf-8") as f:
    for r in csv.DictReader(f):
        d, m, y = r["Data"].split("/")
        linhas.append({"iso": f"{y}-{m}-{d}", "c": round(float(r["Valor"]) * 100), "id": r["Identificador"], "desc": r["Descrição"]})
json.dump(linhas, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)
print(len(linhas), "linhas, soma", sum(l["c"] for l in linhas) / 100)
