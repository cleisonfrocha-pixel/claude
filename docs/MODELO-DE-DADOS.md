# Modelo de dados

Coleções no `db` do artefato (ver `ARQUITETURA.md`, D2). Proposta da Fase 0 —
as fases seguintes só acrescentam campos, nunca renomeiam os existentes sem
migração versionada.

**Regra que vale para tudo:** valor monetário é **inteiro em centavos**.
`R$ 1.234,56` é `123456`. Ponto flutuante só existe na formatação, na borda da
tela. Um erro de arredondamento em "quanto posso gastar" custa a confiança no
produto inteiro.

**Segunda regra:** nada de total gravado. Saldo, comprometido, livre e seguro são
**calculados na leitura** pelo motor. Total gravado dessincroniza — e o `db` é
última-escrita-vence, sem transação.

---

## Cadastros — Fase 0

```
pessoas/<id>        { nome, papel, userId?, ativo }
contas/<id>         { pessoaId, instituicao, nome, tipo, saldoInicial,
                      dataSaldoInicial, moeda, status, ehReserva }
cartoes/<id>        { pessoaId, contaPagamentoId, apelido, bandeira,
                      limiteTotal, diaFechamento, diaVencimento, status }
categorias/<id>     { nome, grupo, natureza, essencial, ativa }
```

`natureza`: `receita | despesa | transferencia`
`essencial`: separa essencial de discricionário (§13)
`ehReserva`: separa dinheiro de operação de dinheiro de segurança (§15)

## Movimentação — Fase 1

```
transacoes/<id>     { data, competencia, valor, tipo, contaId?, cartaoId?,
                      categoriaId, pessoaId, descricao, status, certeza,
                      transferenciaId?, faturaId?, parcelaDe?, parcelaNum?,
                      parcelaTotal?, recorrenciaId?, fonteRendaId?, origem,
                      origemId?, revisado, criadoEm, atualizadoEm }
```

| Campo | Papel |
|---|---|
| `tipo` | `receita \| despesa \| transferencia \| pagamento_fatura` |
| `competencia` | Sempre o mês-calendário da `data` (ou, numa parcela, da data + N meses) — é "em que mês eu gastei isso". **Deliberadamente independente** da competência da fatura: uma compra no cartão depois do fechamento cai na fatura do mês seguinte, mas continua contando como despesa do mês em que foi feita. As duas perguntas — "quanto gastei em setembro" e "o que está na minha fatura de outubro" — têm respostas diferentes de propósito |
| `status` | `previsto \| agendado \| pago \| atrasado \| cancelado` (§6) |
| `certeza` | `confirmado \| provavel \| incerto` (§7) |
| `transferenciaId` | Une as duas pontas de uma transferência. **Par com este campo preenchido nunca entra em receita nem em despesa** (§3) |
| `direcao` | `entrada \| saida` — só preenchido quando `tipo` é `transferencia`. As duas pernas compartilham o mesmo `valorCentavos` positivo; sem isto não dá para saber qual perna soma e qual subtrai do saldo da conta (precisou existir na Fase 2, para calcular saldo por conta) |
| `faturaId` | Compra no cartão aponta para a fatura. O `pagamento_fatura` quita a fatura, **não** é uma segunda despesa (§5) |
| `parcelaDe` | Agrupa as parcelas de uma compra; `parcelaNum/parcelaTotal` dão a visão de compromisso futuro (§3) |
| `fonteRendaId` | Liga uma receita a uma fonte de renda cadastrada (§12) — opcional, só usado quando `tipo` é `receita`. Sem ele, a receita ainda soma no total do mês, só não entra na previsibilidade/histórico de nenhuma fonte específica |
| `origem` | `manual \| planilha \| ofx \| drive \| open_finance` (§18) |
| `origemId` | Chave do lançamento na fonte — é o que detecta reimportação duplicada (§18) |
| `revisado` | Distingue o que veio automático do que você conferiu (§18) |

```
transacoes_originais/<id>   { transacaoId, payloadBruto, importadoEm }
```
O §18 exige manter o histórico original do lançamento. Guardado à parte para não
inchar a transação e para permitir reconciliar depois.

## Compromissos — Fases 1, 3, 4

```
recorrencias/<id>   { descricao, valorEstimado, categoriaId, contaId?, cartaoId?,
                      periodicidade, diaBase, inicio, fim?, ativa, ultimaGerada }
faturas/<id>        { cartaoId, competencia, fechamento, vencimento,
                      valorFechado?, status }
```
Recorrência **não** cria transação até a janela de provisionamento — herdado do
`ensureProvisionedEntries` do GEDI. Gerar cedo demais suja a projeção.

## Dívidas — Fase 6

```
dividas/<id>  { pessoaId, nome, credor, saldoOriginalCentavos,
                valorParcelaCentavos, quantidadeParcelas, parcelasPagas,
                dataInicio, taxaJurosMensalPct?, emRisco }
```

`saldoAtualCentavos` e `status` (ativa/atrasada/quitada) **não são campos
gravados** — são sempre calculados na leitura a partir de
`saldoOriginalCentavos`, `valorParcelaCentavos` e `parcelasPagas` (regra
"nada de total gravado" do CLAUDE.md; ver `domain/dividas.js`).
`dataInicio` é o vencimento da 1ª parcela — próximo vencimento e data de
quitação rolam o mês a partir dela, mesmo padrão de `dataVencimentoFatura`
(§5). `emRisco` é uma marcação manual: é julgamento subjetivo do usuário
(renegociação incerta, credor pressionando), não algo que dá pra derivar
dos números — diferente de "atrasada", que é sempre derivado.

Nenhuma coleção `simulacoes`: o simulador do §11 (aporte extra, quitação
antecipada, comparação de ritmos) é implementado como funções puras em
`domain/simuladorDividas.js` que recebem números e devolvem um resultado
hipotético, sem acesso a nenhum repositório — o cenário simulado existe só
como estado da tela enquanto o usuário mexe nos campos, nunca é escrito em
lugar nenhum. Isso já cumpre a exigência do §11 ("cenário simulado nunca
escreve no dado real") por construção, não por convenção. Uma coleção
dedicada a **guardar** cenários nomeados para comparar depois é outra
exigência, do §22 (Cenários e simulador de realidade, Fase 14) — se e
quando essa fase chegar, é o lugar certo para essa coleção nascer.

## Renda e orçamento — Fase 8

```
fontesRenda/<id>            { pessoaId, nome, tipo, valorEsperadoCentavos, ativa }
configuracoes/orcamento     { custoDesejadoCentavos?, metaRecuperacaoCentavos? }
```

`tipo` da fonte: `fixa | recorrente | variavel | eventual` (§12, os quatro do
blueprint). `previsibilidade` **não é campo gravado** — é sempre calculada na
leitura (`domain/renda.js`, `calcularPrevisibilidadeFonte`) a partir das
transações da própria fonte, mesma regra "nada de total gravado" das dívidas
(Fase 6). Uma receita se liga a uma fonte por `transacao.fonteRendaId`
(opcional, campo novo em `transacoes/<id>`) — sem isso, a transação ainda
soma no total do mês, só não entra na previsibilidade/histórico de nenhuma
fonte específica.

`configuracoes/orcamento` é documento único, não coleção: as duas únicas
metas do §12/§13 que não vêm de lançamento nenhum — custo de vida desejado e
meta de recuperação financeira — são decisão do usuário, não cálculo. Sem
meta de recuperação definida, `domain/renda.js` usa um padrão honesto
(custo essencial + parcelas de dívida) em vez de inventar um número; sem
custo desejado definido, o gap correspondente fica `null` (a tela mostra
"—", nunca um valor fabricado).

## Patrimônio, objetivos — Fase 9

```
ativos/<id>         { pessoaId, classe, nome, valorAtual, dataAvaliacao, liquido }
passivos/<id>       { pessoaId, tipo, valorAtual, dividaId?, dataAvaliacao }
patrimonio_snap/<id>{ competencia, ativos, passivos, liquido, composicao }
objetivos/<id>      { nome, valorAlvo, valorAtual, prazo, horizonte,
                      contaVinculadaId?, ativo }
```
`classe` do ativo: `liquido | investimento | veiculo | imovel | participacao | outro` (§14)
`patrimonio_snap` é fotografia mensal — é o que permite a evolução do §14 sem
recalcular anos de histórico a cada abertura.

## Inteligência — Fases 7 e 10

```
decisoes/<id>  { status, chave, tipo, titulo, origemRotulo, impactoCentavos,
                 prazo, decididoEm }
```

Nenhuma coleção `diagnosticos`: o diagnóstico do §8 (`domain/diagnostico.js`)
é recalculado do zero a cada leitura, a partir dos painéis que já existem
(clareza de caixa, dívidas, transações) — não há indicador nenhum gravado.

`decisoes` também não guarda o achado inteiro, só a disposição do usuário
sobre ele — o achado em si (`domain/decisoes.js`, `detectarAchados`) é
recalculado ao vivo enquanto está pendente; a existência de um documento
aqui, com `status !== "pendente"`, é o que tira um achado da lista de
pendentes e o coloca no histórico. `id` do documento é o **mesmo id do
achado** (determinístico, ex.: `divida_atrasada:<dividaId>`), nunca um id
gerado à parte — é o que faz a disposição persistir sobre o achado certo
mesmo depois de recalculado. Apagar o documento (`reabrirDecisao`) devolve
o achado aos pendentes.

`status`: `pendente` (implícito — ausência de documento) `| resolvida |
ignorada | adiada | cancelada` (§9)

Guardar essa disposição não fere "nada de total gravado" (CLAUDE.md): não é
um saldo nem um indicador, é o registro de uma decisão tomada — um fato
histórico, como uma transação. `origemRotulo`/`impactoCentavos`/`prazo`
são um retrato do achado no momento da decisão, para o histórico continuar
legível mesmo se o achado que o originou não existir mais (ex.: a dívida
que motivou o achado foi quitada).

Nenhuma coleção `alertas` ainda: o §17 (Anomalias e inteligência de
comportamento) é Fase 10, com histórico suficiente para julgar "anormal"
de verdade — é o lugar certo para essa coleção nascer.

## Conexões e sistema — Fases 11, 12 e 15

```
conexoes/<id>       { provedor, instituicao, status, ultimaSync,
                      proximaSync?, erro?, contasVinculadas[] }
sincronizacoes/<id> { conexaoId, iniciadoEm, terminadoEm, resultado,
                      novos, duplicados, ambiguos }
anexos/<id>         { registroTipo, registroId, assetId, nome, enviadoEm }
auditoria/<id>      { entidade, entidadeId, campo, de, para, quem, quando }
meta/schema         { versao, migradoEm }
```
`anexos.assetId` aponta para a capability `assets`. `meta/schema` é o que permite
migração de formato sem perder dado — herdeiro do `normalizeState` do GEDI.

---

## Índices de cálculo que o motor precisa

Como o `db` não tem junção, o motor carrega por competência e indexa em memória:

- transações por `competencia` → agregação mensal (§21)
- transações por `contaId` + `data` → saldo por conta (§3)
- transações por `faturaId` → fatura de cartão sem dupla contagem (§5)
- transações com `status` em (`previsto`, `agendado`) por `data` → compromissos e calendário (§6)
- transações por `parcelaDe` → compromisso futuro de parceladas (§3, §5)
