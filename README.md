# Sistema de Gestão Financeira Pessoal/Familiar

Centro de comando financeiro pessoal e familiar, construído sobre a base do
**Painel GEDI** e guiado pelo `Blueprint de Produto V1`.

> Transformar uma vida financeira desorganizada em uma visão única, confiável e
> acionável: mostrar a realidade, revelar os problemas, projetar o futuro e
> deixar claro o que precisa acontecer agora.

## Estado

**Fase 10 concluída (20/09/2026).** Confiança, alertas e anomalias:
completude da vida financeira mapeada (checklist de sete itens, com
percentual), itens a confirmar, saldos sem conferência recente, e um
nível de confiabilidade que vira aviso explícito sempre que o
Diagnóstico (Plano) se apoia em dados incompletos (§23). Nove alertas do
§24 — três já existiam desde a Fase 7 (risco de caixa, vencimento sem
cobertura, cartão no limite), os outros seis são novos, incluindo dois
que reaproveitam a evolução de patrimônio da Fase 9 sem recalcular nada
(dívida aumentando, patrimônio evoluindo). Seis detecções de anomalia do
§17 — duas já existiam (gasto fora do padrão, categoria em alta
persistente), quatro nasceram nesta fase (nova recorrência, recorrência
com valor diferente do esperado, gasto atípico de cartão, mudança
relevante em receita). Portão cumprido: todo alerta, novo ou antigo,
mostra ao expandir os lançamentos concretos que o originaram. V1 (F0–F9)
segue completa — Fase 10 é P1 secundário, construído sobre ela.

Produto ao vivo: <https://claude.ai/artifact/LgXc37oyU6rwCZTguZf5j6>
Roadmap visual: <https://claude.ai/artifact/GWUhPYHc3Xq44CYL1tGTah>

## Documentos

| Documento | O que responde |
|---|---|
| [`docs/PLANO-DE-IMPLANTACAO.md`](docs/PLANO-DE-IMPLANTACAO.md) | As 16 fases, o que cada uma entrega e o portão de cada uma |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | As 10 decisões técnicas e o porquê de cada uma |
| [`docs/RASTREABILIDADE.md`](docs/RASTREABILIDADE.md) | Onde cada uma das 31 seções do blueprint é entregue |
| [`docs/MODELO-DE-DADOS.md`](docs/MODELO-DE-DADOS.md) | As coleções de dados e o significado de cada campo |
| [`docs/blueprint-extraido-do-pdf.txt`](docs/blueprint-extraido-do-pdf.txt) | Texto integral do blueprint, para consulta |

## Código

`app/` — o produto em si (ver `app/src/domain`, `app/src/dados`, `app/src/ui`).
`app/testes` roda com `node --test testes/*.test.js` dentro de `app/`.

## Caminho até a V1

| Onda | Fases | Sessões | Entrega |
|---|---|---|---|
| 0 · Fundação | F0 | 2 | Esqueleto navegável com dados reais |
| 1 · Ver a realidade | F1–F4 | 13 | Vida financeira representada sem erro |
| 2 · Ver o futuro e decidir | F5–F7 | 13 | Núcleo P0 completo |
| 3 · Fechar os gaps | F8–F11 | 15 | **V1 — as 14 perguntas do §29 respondidas** |
| 4 · Automatizar e interpretar | F12–F15 | 15 | Open Finance, IA, cenários, conforto |

A V1 fecha em **43 sessões**, na Fase 9.

## Como está construído

Repositório como fonte da verdade, publicado como artefato multi-arquivo; dados
no banco do artefato; motor financeiro puro e testável, isolado da interface.
O raciocínio de cada uma dessas escolhas está em `docs/ARQUITETURA.md`.
