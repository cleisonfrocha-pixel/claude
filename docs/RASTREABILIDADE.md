# Rastreabilidade — blueprint item a item

Garantia de que nada do blueprint ficou de fora. As 31 seções, com cada
exigência, a fase que a entrega e o estado.

**V1 completa (F0–F9):** as 14 perguntas do §29 têm resposta no produto —
ver a tabela de §29 abaixo. Todo P0 e o P1 central (§11–§16) estão
entregues. O que resta (§17 em diante) é P1 secundário, P2 e P3 — nenhum
deles bloqueava a V1.

Estado: `○` não iniciado · `◐` em andamento · `●` entregue

| # | Seção | Prio | Fase | Estado |
|---|---|---|---|---|
| 1 | Visão do produto — centro de comando, não registro de gastos | P0 | princípio de todas | ○ |
| 2 | Hierarquia de prioridade + regra de escopo | — | lei do plano (D7) | ● |
| 3 | Núcleo de dados financeiros | P0 | F0, F1 | ● |
| 4 | Dinheiro: presente, comprometido e seguro | P0 | F2 | ● |
| 5 | Cartões e crédito | P0 | F3 | ● |
| 6 | Contas, obrigações e calendário | P0 | F4 | ● |
| 7 | Fluxo de caixa e projeção | P0 | F5 | ● |
| 8 | Diagnóstico financeiro | P0 | F7 | ● |
| 9 | Central de decisões | P0 | F7 | ● |
| 10 | Plano financeiro vivo | P0 | F7 | ● |
| 11 | Dívidas e plano de saída | P0 | F6 | ● |
| 12 | Renda e gap de renda | P1 | F8 | ● |
| 13 | Custos essenciais, orçamento e margem | P1 | F8 | ● |
| 14 | Patrimônio e construção de riqueza | P1 | F9 | ● |
| 15 | Reserva e segurança financeira | P1 | F9 | ● |
| 16 | Objetivos financeiros | P1 | F9 | ● |
| 17 | Anomalias e inteligência de comportamento | P1 | F10 | ● |
| 18 | Importação e reconciliação | P1 | F11 | ● |
| 19 | Open Finance | P1 | F12 | ○ |
| 20 | Assistente de IA | P2 | F13 | ○ |
| 21 | Fechamento mensal e evolução | P2 | F14 | ○ |
| 22 | Cenários e simulador de realidade | P2 | F14 | ○ |
| 23 | Qualidade, completude e confiança dos dados | P1 | F10 | ● |
| 24 | Alertas e acompanhamento | P1 | F10 | ● |
| 25 | Experiência principal da Home | P0 | F2, F5, F6, F7, F9 | ● |
| 26 | Navegação e módulos | P0 | F0 | ● |
| 27 | Funções de qualidade de vida | P2 | F0 (ocultar), F15 | ◐ |
| 28 | O que NÃO deve ser prioridade | P3 | fora da V1, registrado | ● |
| 29 | Critérios de sucesso — 14 perguntas | P0 | portão em F7 e F9 | ● |
| 30 | Ordem de entrega recomendada | — | é a ordem das fases | ● |
| 31 | Definição final do produto | — | critério de aceite geral | ○ |

---

## Detalhamento por seção

### §3 — Núcleo de dados financeiros `P0`

| Exigência | Fase |
|---|---|
| Núcleo financeiro: vida individual **ou familiar** num só espaço | F0 |
| Pessoas: quem responde por receita, conta, cartão, despesa, dívida e ativo | F0 |
| Contas: dinheiro por instituição e por conta, com saldo e status | F0 |
| Cartões: limite, utilização, fatura, vencimento e compromisso futuro | F0 cadastro · F3 inteligência |
| Transações: registradas, identificadas e classificadas **sem duplicar dinheiro** | F1 |
| Transferências: movimentação interna, nunca receita ou despesa | F1 |
| Receitas: por fonte, previsibilidade e status | F1 |
| Despesas: categoria, natureza e situação de pagamento | F1 |
| Recorrências reconhecidas e acompanhadas | F1 |
| Parcelamentos: parcela atual **e** compromisso futuro | F1 · F3 |

**Estado em 19/09/2026:** F0 e F1 entregues. F0: pessoas, contas, cartões e
categorias funcionando, com validação e sincronização real (capability `db`).
F1: transações, transferências, compras parceladas, recorrências e pagamento
de fatura — tudo passando pelas mesmas regras do domínio. Portão de cada fase
verificado com Playwright, incluindo o teste literal da Fase 1: transferir
R$ 1.000 entre contas próprias não altera receita nem despesa do mês, e pagar
uma fatura de cartão não soma a despesa uma segunda vez.

Duas descobertas reais no caminho, corrigidas e cobertas por teste:
- O checkbox "Ativa" de pessoas/categorias nascia **desmarcado** em registros
  novos, mesmo o padrão do domínio sendo `true` — cadastros novos ficavam
  invisíveis nos seletores que filtram por ativo. Corrigido em
  `telaCadastro.js`, com um `padrao` explícito por campo.
- O checkbox "Encerrada" de contas gravava um **booleano** (`true`/`false`)
  num campo que precisa ser a string `"ativa"`/`"encerrada"` — e
  `validarConta` nunca conferia isso, então passava batido. Corrigido com um
  mapeamento `valorMarcado`/`valorDesmarcado` no campo, e `validarConta`
  agora rejeita qualquer status fora do enum.

### §4 — Dinheiro presente, comprometido e seguro `P0` — ✅ **F2** (19/09/2026)

Saldo atual · saldo comprometido · saldo livre · **dinheiro seguro para gastar**
(com a margem de segurança definida pelo sistema) · compromissos próximos no
horizonte escolhido. — **F2**
Pergunta central: "Quanto eu posso gastar sem criar um problema mais adiante?"

**Como foi entregue:** `domain/caixa.js`. Margem de segurança = contas
marcadas reserva (§15), ficam fora do "posso gastar" (decisão D8 em
`ARQUITETURA.md`). Horizonte fixo de 30 dias até a Fase 5 trazer os quatro
horizontes do §7 (decisão D9). Cada número vem com a lista de itens que o
compõe — nenhum é uma caixa preta. Portão verificado com Playwright: o
painel Início responde com o número, e os detalhes batem exatamente com os
lançamentos que os originaram.

### §5 — Cartões e crédito `P0` — ✅ **F3** (19/09/2026)

Limite total, disponível e utilizado · fatura atual, próxima e vencimento ·
parceladas e comprometimento de meses futuros · **compra no cartão ≠ pagamento
de fatura** · sem dupla contagem · comprometimento futuro visível · alerta de
aproximação de limite e de utilização anormal · cartões de mais de uma pessoa.

**Como foi entregue:** `domain/cartoes.js`. "Utilizado" soma **todo**
compromisso ainda não pago — inclusive parcelas que só vão fechar fatura
daqui a meses, não só a fatura corrente (é a leitura correta de
"comprometimento futuro" do §5, não uma limitação). Tela de Cartões ganhou
detalhe expansível: barra de utilização, fatura atual/próxima e a lista de
compromisso futuro, uma linha por parcela. Cartões de mais de uma pessoa já
existiam desde a Fase 0 (`cartao.pessoaId`), agora visíveis na tela.

Alerta de **aproximação de limite**: dois degraus (70% atenção, 90%
crítico). Alerta de **utilização anormal** (comparada ao padrão histórico)
é §17 — Fase 10, Anomalias — não esta fase: sem histórico acumulado ainda,
qualquer "anormal" agora seria palpite.

Bug real achado e corrigido no caminho: o texto da fatura em aberto dizia
"fecha e vence [mesma data]" — fechamento e vencimento são datas
diferentes (ex.: fecha dia 28, vence dia 5 do mês seguinte); o texto usava
a data de vencimento para as duas coisas. Corrigido calculando o
fechamento de verdade (`dataFechamentoFatura`).

### §6 — Contas, obrigações e calendário `P0` — **F4**

Contas futuras com valor, vencimento, recorrência e status · parceladas com prazo
total · recorrentes acompanhadas · calendário com impacto no caixa por data ·
dias de maior pressão · obrigações sem cobertura suficiente · status previsto,
agendado, pago, atrasado, cancelado.

**Como foi entregue:** `domain/calendario.js` — `compromissosPorDia` agrupa
despesa e receita diretas por data (despesa em cartão nunca entra sozinha:
só o vencimento da fatura inteira conta, mesma regra de não duplicar
dinheiro do §5); `calcularCoberturaDiaria` caminha o saldo dia a dia;
`diaDeMaiorPressao` e `diasSemCobertura` identificam o aperto e a
obrigação causadora, sempre apontando os dados de origem (§9/§17). A tela
Planejamento (§26) traz a grade navegável por mês e um resumo preso a uma
janela fixa de 90 dias a partir de hoje (D10) — a mesma ideia do painel da
Home (D9): navegar de mês na grade não muda o que o resumo aponta. Os cinco
status de transação (`STATUS_TRANSACAO`) já existiam desde a Fase 1 e são
respeitados aqui: pago/cancelado não entram no calendário, atrasado aparece
marcado.

### §7 — Fluxo de caixa e projeção `P0` — **F5**

| Horizonte | Responde |
|---|---|
| 7 dias | Vencimentos, entradas próximas, risco de falta de caixa |
| 30 dias | Capacidade de fechar o mês |
| 90 dias | Comportamento de obrigação, renda e dívida |
| 12 meses | Trajetória e possibilidade de recuperação |

Estados de certeza: confirmado · provável · **incerto (nunca tratado como
garantido)**.
Saída crítica: saldo negativo → **quando**, **qual evento provoca**, **tamanho do gap**.

**Como foi entregue:** `domain/projecao.js` reaproveita `domain/calendario.js`
(Fase 4) para os eventos por dia, e separa cada um em duas trilhas por
certeza: "segura" (confirmado + provável — a única que caminha o saldo
projetado) e "incerto" (informativo, nunca somado — é a aplicação direta
da regra não negociável do CLAUDE.md). `saidaCritica` é a primeira data em
que a trilha segura caminhada fica negativa, com o(s) item(ns) causador(es)
e o gap — os três elementos exigidos pelo blueprint, não dois. A tela
Planejamento ganhou a aba "Fluxo de caixa": os quatro horizontes lado a
lado (cartão com ponto vermelho quando há saída crítica), e o detalhe do
horizonte selecionado com o alerta ou a confirmação de cobertura, mais uma
nota separada do saldo hipotético se o incerto se confirmasse — nunca
misturada ao saldo seguro. Verificado com Playwright: uma receita incerta
de R$ 5.000 no mesmo dia de uma despesa confirmada de R$ 3.500 **não evita**
a saída crítica sinalizada pelos horizontes de 30/90 dias e 12 meses.

### §8 — Diagnóstico financeiro `P0` — **F7**

Estado do caixa · pressão de fixas e recorrentes · peso de dívida e parcela ·
previsibilidade e concentração da receita · evolução do custo de vida · despesa
fora do padrão · mudança relevante versus mês anterior · condição da reserva ·
evolução do patrimônio líquido · **completude e confiabilidade dos dados usados**.
Sem moralizar: fatos, relações e causas observáveis.

**Como foi entregue:** `domain/diagnostico.js` não inventa nenhum número
novo — cada bullet reaproveita um cálculo que já existe em outra parte do
domínio: estado do caixa e reserva vêm da clareza de caixa (§4), peso das
dívidas vem da visão consolidada (§11). Pressão de fixas usa
`categoria.essencial` (já existia desde a Fase 0). Despesas fora do padrão
comparam o gasto do mês por categoria com a média dos 3 meses anteriores
(nunca incluindo o próprio mês na média, senão um gasto alto se esconderia
puxando-a junto) — é uma leitura do próprio §8, diferente e mais simples
que o motor de anomalias dedicado do §17 (Fase 10), que vai ter histórico
suficiente para julgar "anormal" de verdade. Evolução do patrimônio
líquido não é inventada: o diagnóstico diz explicitamente que só existe a
partir da Fase 9 (§14, ativos e passivos consolidados). Completude dos
dados aponta pendências concretas (nenhuma conta de reserva, nenhuma
categoria essencial, lançamento sem categoria) — não só "dados
incompletos" solto.

### §9 — Central de decisões `P0` — **F7**

Problemas atuais · riscos futuros · oportunidades · ações pendentes ·
priorização por urgência, impacto e prazo · **cada ação ligada ao problema que a
originou** · impacto esperado quando estimável · histórico do resolvido,
ignorado, adiado ou cancelado.

**Como foi entregue:** `domain/decisoes.js` — `detectarAchados` lê os
painéis já calculados (clareza de caixa, projeção de 30 dias, dívidas,
cartões) e gera achados tipados (problema/risco/oportunidade), cada um com
`origem` apontando o dado exato que o gerou (regra do CLAUDE.md: "todo
alerta e toda ação apontam os dados que os originaram") e uma
`acaoSugerida` — a ação já nasce amarrada ao achado, não como registro
separado. `priorizarAchados` ordena por urgência, depois impacto
financeiro, depois prazo — os três critérios do blueprint, nessa ordem.
O histórico (resolvida/ignorada/adiada/cancelada) é a única coisa gravada
(`dados/decisoesRepo.js`, coleção `decisoes`) — um retrato do achado no
momento da decisão, não o achado em si, que continua recalculado ao vivo
enquanto pendente. Verificado com Playwright: uma dívida atrasada gera o
achado; corrigi-la faz o achado sumir sozinho, sem nenhuma ação manual —
prova de que a central reflete o dado real, não uma lista fixa.

### §10 — Plano financeiro vivo `P0` — **F7**

Agora · esta semana · este mês · 90 dias · 12 meses — atualizado pela realidade,
não documento estático.

**Como foi entregue:** `montarPlanoVivo` (`domain/decisoes.js`) rebaixa os
mesmos achados pendentes da central de decisões (§9) nos cinco horizontes,
por urgência e proximidade do prazo — não é um documento separado, é uma
segunda leitura dos mesmos dados. "12 meses" sem achado nenhum mostra uma
orientação geral (reserva, passivos, patrimônio) em vez de ficar vazio.

### §11 — Dívidas e plano de saída `P0` — **F6**

Cadastro completo · saldo original e atual · valor e quantidade de parcelas ·
pagas e restantes · vencimentos · taxas, juros e encargos quando conhecidos ·
atrasadas ou em risco · comprometimento mensal da renda · data estimada de
quitação · visão consolidada.
Simulação: aporte adicional · quitação antecipada · comparação de ritmos · prazo,
juros e impacto mensal por cenário · **cenário simulado separado do real**.

**Como foi entregue:** `domain/dividas.js` — saldo atual e status
(ativa/atrasada/quitada) nunca são gravados, sempre calculados a partir do
saldo original e das parcelas pagas ("nada de total gravado"); próximo
vencimento e data de quitação rolam o mês mantendo o dia, mesmo padrão de
`dataVencimentoFatura` (§5). "Em risco" é uma marcação manual (é
julgamento, não é algo que dá pra derivar dos números). `domain/simuladorDividas.js`
— aporte extra, quitação antecipada e comparação de ritmos, cada um
caminhando a quitação mês a mês com juros compostos quando há taxa
conhecida; são funções puras sem acesso a repositório nenhum, então o
cenário simulado não tem COMO vazar para o dado real — é a mesma garantia
estrutural que a pureza do domínio (D3) já dava para todo o resto.

A tela reaproveita a fábrica de cadastro (Fase 0) com dois hooks novos: o
simulador interativo dentro do painel expandido (`aoRenderizarExtra`, que
liga eventos ao HTML de `renderExtra` sem duplicar a lógica de lista) e a
visão consolidada acima da lista (`resumo`). "Comprometimento mensal da
renda" mostra o valor em centavos até a Fase 8 trazer a renda cadastrada
(§12) para dividir de verdade — decisão de escopo registrada, mesmo
padrão da Fase 3 adiando "utilização anormal" para a Fase 10. Bloco
"Dívidas" do §25 entrou na Home.

### §12 — Renda e gap de renda `P1` — **F8**

Fontes com valor e periodicidade · fixa, recorrente, variável, eventual ·
previsibilidade por fonte · histórico por fonte · gap contra custo essencial ·
gap contra custo de vida desejado · gap contra meta de recuperação ·
concentração da renda em poucas fontes.
Pergunta central: havendo déficit, dizer se é **gasto, timing, dívida, renda ou
combinação**.

**Como foi entregue:** `domain/renda.js` — cadastro de fonte com os quatro
tipos do blueprint; `calcularPrevisibilidadeFonte` usa a fatia confirmada
das entradas da própria fonte nos últimos meses (não inventa uma nota,
`null` quando não há dado); `historicoFonte` lista as entradas, mais
recente primeiro; `calcularConcentracaoRenda` é a fatia da maior fonte no
total do mês. `diagnosticarCausaDeficit` é a pergunta central: quatro
checks independentes (renda, gasto, dívida, timing) sobre números já
calculados em outro lugar do domínio (clareza de caixa §4, dívidas §11) —
mais de um dispara junto quando é combinação de fato, não é um quinto
tipo. Transações de receita ganharam um `fonteRendaId` opcional
(tela Transações) pra ligar a entrada à fonte.

### §13 — Custos, orçamento e margem `P1` — **F8**

Custo essencial · atual · ideal ou planejado · margem após compromissos ·
essencial versus discricionário · recorrente versus extraordinário · evolução
das principais categorias · categorias que consomem margem de forma crescente.
Orçamento como clareza, não como prisão.

**Como foi entregue:** `domain/orcamento.js` — essencial/atual/discricionário
a partir de `categoria.essencial` (já existia desde a Fase 0); margem =
renda menos essencial menos parcelas de dívida; recorrente vs.
extraordinário reaproveita `transacao.recorrenciaId` (Fase 1), não inventa
um conceito novo; evolução por categoria compara as maiores despesas do
mês com a média dos meses anteriores; categorias crescentes exigem alta em
TODOS os últimos meses, sem nenhuma queda — mais estrito que "fora do
padrão" do §8 (um pico isolado já entra lá; aqui é tendência sustentada).
Custo de vida desejado e meta de recuperação são as únicas duas metas que
não vêm de lançamento nenhum — moram num documento de configuração único
(`dados/orcamentoRepo.js`); sem meta de recuperação definida, o sistema
usa um padrão honesto (essencial + parcelas de dívida) em vez de inventar
um número.

### §14 — Patrimônio `P1` — ✅ **F9** (20/09/2026)

Ativos líquidos · investimentos · veículos · imóveis · participações e negócios ·
outros ativos · passivos · patrimônio líquido consolidado · evolução no tempo ·
variação mensal e acumulada · composição · **relação entre reduzir dívida,
aumentar ativo e crescer patrimônio**.

**Como foi entregue:** `domain/patrimonio.js` — patrimônio líquido é sempre
`ativos − passivos` na leitura ("nada de total gravado"); passivo é a mesma
dívida do §11 (`dividas`), não um cadastro novo, para não abrir dois
lugares onde o mesmo número poderia divergir. Composição por classe
(líquido, investimento, veículo, imóvel, participação, outro) com
percentual. Evolução mensal/acumulada exige um número gravado num
instante — a única exceção real desta fase à regra: `patrimonioSnapshots`
(`dados/patrimonioRepo.js`) é um retrato datado, criado uma vez por
competência na primeira leitura do mês e nunca sobrescrito depois, mesmo
raciocínio já usado no histórico de decisões (§9/F7). A relação
dívida/ativo/patrimônio compara os três sinais (passivo caiu, ativo subiu,
patrimônio cresceu) contra o snapshot anterior. Tela bespoke (como Renda e
Dívidas) porque a composição precisa reagir a ativo, dívida e conta
mudando, não só à lista de ativos.

### §15 — Reserva e segurança `P1` — ✅ **F9** (20/09/2026)

Valor atual · meta por horizonte · **cobertura em dias e meses de custo
essencial** · progresso até a meta · separação entre dinheiro de operação e de
segurança.

**Como foi entregue:** `domain/reserva.js` — reaproveita
`saldoReservaCentavos` (clareza de caixa, F2) e `custoEssencialCentavos`
(orçamento, F8) em vez de recalcular do zero; cobertura em meses e dias é
saldo dividido pelo custo essencial (`null` sem custo essencial
calculado, nunca um zero enganoso). Metas nos três horizontes do
blueprint (3, 6 e 12 meses), cada uma com valor-meta, progresso percentual
(nunca passa de 100%) e quanto falta. A separação operação/segurança já
existia desde a Fase 0 (`conta.ehReserva`) — esta fase é a primeira a
mostrar o que essa marcação significa na prática.

### §16 — Objetivos financeiros `P1` — ✅ **F9** (20/09/2026)

Nome, valor-alvo, valor atual, prazo · progresso percentual e financeiro · valor
necessário por período · **compatibilidade da meta com a margem atual** ·
impacto de mudança de renda ou despesa no prazo · curto, médio e longo prazo.

**Como foi entregue:** `domain/objetivos.js` — horizonte (curto/médio/longo)
nunca é gravado, é sempre derivado do prazo na leitura (curto ≤ 12 meses,
médio ≤ 36, longo depois disso). Progresso, falta e valor necessário por
mês vêm de `valorAtual` (digitado à mão ou lido ao vivo de uma conta
vinculada) contra `valorAlvo`. A verificação central do §16 —
`verificarCompatibilidadeComMargem` — compara o valor necessário por mês
com a margem atual (§13, já com dívidas descontadas); incompatível mostra
exatamente quanto falta por mês. "Impacto de mudança de renda/despesa no
prazo" é `simularNovoPrazo`, uma função pura sem acesso a repositório —
mesma garantia estrutural do simulador de dívidas (§11/F6): o cenário
simulado não tem como vazar para o objetivo real.

### §17 — Anomalias `P1` — ✅ **F10** (20/09/2026)

Gasto fora do padrão histórico · aumento persistente de categoria · nova
recorrência · mudança relevante em receita · aumento atípico de cartão ·
diferença entre esperado e realizado · **explicar de onde veio o alerta e quais
dados o sustentam**.

**Como foi entregue:** as duas primeiras detecções já existiam antes desta
fase — `calcularDespesasForaDoPadrao` (`domain/diagnostico.js`, §8) e
`identificarCategoriasCrescentes` (`domain/orcamento.js`, §13) — e
`dados/decisoesRepo.js` só passou a reaproveitá-las como achados; nenhuma das
duas foi duplicada. `domain/anomalias.js` (novo) tem as quatro que ainda não
existiam: `detectarNovaRecorrencia` (uma recorrência cujo `inicio` é a
competência atual — sinal mais confiável que a data de criação do registro),
`detectarRecorrenciaValorDiferente` (o lançamento real de uma recorrência
difere do valor estimado — "diferença entre esperado e realizado"),
`detectarAumentoCartao` (fatura de um cartão muito acima da média das
anteriores — mesmo raciocínio de `calcularDespesasForaDoPadrao`, mas para
gasto de cartão) e `compararComPeriodoAnterior`, um comparador genérico
"isso mudou muito desde o mês passado?" reaproveitado tanto para "mudança
relevante em receita" (aqui) quanto para "queda de margem" (§24). Todo
achado gerado a partir de uma anomalia carrega `dados.lancamentos` — os
lançamentos concretos por trás do número — cumprindo a exigência de
"explicar de onde veio o alerta" ao mesmo tempo que o portão da própria
Fase 10.

### §18 — Importação e reconciliação `P1` — ✅ **F11** (20/09/2026)

Manual · planilhas e históricos · formatos financeiros (OFX/CSV) · Open Finance
(chega na F12) · identificação de duplicatas · reconhecimento de transferências
internas · revisão de lançamentos ambíguos · distinção entre importado
automaticamente e revisado pelo usuário · **manutenção do histórico original**.

**Como foi entregue:** `domain/importacao.js` — `parseCSV` (delimitador `;`
ou `,` autodetectado, colunas configuráveis porque a ordem varia de banco
pra banco, aspas com o delimitador dentro do campo tratadas por um
divisor de linha próprio) e `parseOFX` (lê os blocos `STMTTRN` por regex,
não por um parser de XML — OFX 1.x é SGML, bancos não fecham toda tag, e
`DOMParser` nem existe no motor puro, CLAUDE.md/D3). Os dois reaproveitam
`paraCentavos` (§4) pra converter o valor — a função já desambigua vírgula
e ponto decimais, então serve tanto pro CSV brasileiro quanto pro ponto do
OFX sem precisar de um segundo parser de dinheiro. `detectarDuplicatas`
usa o FITID do OFX (identificador do próprio banco, guardado em
`transacao.origemId`) quando existe — prova quase certa — e cai pra
"mesma conta + mesmo valor + data muito próxima" quando não (CSV não tem
id nenhum). `detectarTransferencias` cobre a regra não-negociável do
CLAUDE.md: uma saída aqui que bate com uma entrada já existente em OUTRA
conta própria vira sugestão de transferência, nunca duas coisas separadas
somando receita e despesa ao mesmo tempo. `classificarAmbiguidade` marca
pra revisão manual todo candidato sem categoria com o nome batendo na
descrição.

Nenhum campo novo no esquema da transação: `origem`/`origemId`/`revisado`
já existiam desde a Fase 1, sem uso até agora — só passaram a ser
preenchidos de verdade (`origem: "importado"`, `revisado: false`) na
importação, exatamente a distinção que o §18 pede entre "veio automático"
e "foi conferido". `lotesImportacao` (novo, `dados/importacaoRepo.js`) é
a única coisa gravada além disso: o texto colado, intacto, nunca editado
depois — a "manutenção do histórico original" — mesmo que os lançamentos
que nasceram dele sejam depois editados ou apagados. A tela (aba
"Importar", dentro de Dinheiro) separa análise (só leitura, nada
gravado) de confirmação — duplicata nasce desmarcada por padrão.

**Portão:** verificado com Playwright — importar o mesmo extrato OFX duas
vezes marca as duas linhas como "possível duplicata" (pelo FITID) na
segunda vez, ambas desmarcadas por padrão; confirmar sem tocar em nada
não cria nenhum lançamento novo (a contagem de transações continua a
mesma antes e depois).

### §19 — Open Finance `P1` — **F12** ⚠️ requer infraestrutura externa

Conexão de instituições · atualização de contas · importação de movimentações ·
atualização de saldos · dados de cartão quando disponíveis · status e atualidade
de cada conexão · tratamento de indisponibilidade e atraso · histórico de
sincronizações · reconciliação com o que já existe · **modelo não preso a um
único fornecedor** · **V1 viável sem custo recorrente de plano comercial caro**.
Princípio: reduz trabalho manual, não pode reduzir confiabilidade.

### §20 — Assistente de IA `P2` — **F13**

Responder sobre a própria vida financeira · explicar variações · explicar por que
um alerta apareceu · simular cenários · resumir o mês · sugerir pontos de revisão
· ajudar a interpretar o plano · **mostrar os dados de origem** · **não alterar
dado crítico sem confirmação**.

### §21 — Fechamento mensal `P2` — **F14**

Resumo do mês · receitas e despesas realizadas · resultado · variação de dívida,
reserva e patrimônio · maiores mudanças de comportamento · principais alertas e
decisões do período · histórico mensal comparável.

### §22 — Cenários `P2` — **F14**

Atual · recuperação · aumento de renda · redução de despesa · quitação de dívida
· conservador · comparação **sem alterar dados reais** · impacto em caixa,
dívida, reserva e patrimônio.

### §23 — Qualidade e confiança dos dados `P1` — ✅ **F10** (20/09/2026)

Completude da vida financeira mapeada · confiabilidade da visão atual · itens a
confirmar · saldos ou registros não conciliados · **aviso quando a conclusão se
apoiar em dados incompletos** · data da última atualização.

**Como foi entregue:** `domain/qualidade.js` (novo) — completude é um
checklist de sete itens (pessoa, conta, conta de reserva, categoria essencial,
fonte de renda, ativo, lançamento nos últimos 30 dias), cada um com um
percentual e uma pendência que já diz o que fazer, nunca só "algo está
incompleto" (mesma regra do §9/§17). Itens a confirmar (transação marcada
como incerta, dívida sem taxa de juros) são diferentes de completude — não é
"dado faltando", é "dado presente mas ainda não confirmado". Saldos não
conciliados são contas ou ativos sem confirmação (saldo inicial ou avaliação)
há mais de 180 dias. `calcularConfiabilidade` sintetiza os três num nível só
(alta/média/baixa) — e é esse nível que vira o aviso "esta conclusão usa
dados incompletos" na tela de Plano, amarrado direto ao bloco de Diagnóstico
que a conclusão pertence, não solto em outro canto da tela.

### §24 — Alertas `P1` — ✅ **F10** (20/09/2026)

Risco de caixa · vencimento próximo sem cobertura · cartão perto do limite ·
receita esperada não recebida · despesa fora do padrão · nova recorrência ·
aumento de dívida · queda relevante de margem · **evolução positiva** de dívida,
reserva ou patrimônio.

**Como foi entregue:** os três primeiros já existiam desde a Fase 7
(`caixa_seguro_negativo`, `projecao_saida_critica`, `cartao_limite`) — nada
mudou neles além de ganharem `dados.lancamentos`. Os seis restantes são
novos geradores em `domain/decisoes.js`: `receita_esperada_nao_recebida`
(fonte fixa/recorrente sem receita paga registrada, já perto do fim do mês —
`domain/anomalias.js`), `despesa_fora_padrao` e `nova_recorrencia`
(compartilhados com o §17), `divida_aumentou` e `patrimonio_evoluiu_positivo`
(reaproveitam a `relacao` dívida/ativo/patrimônio inteira da Fase 9 —
`domain/patrimonio.js`, `calcularRelacaoDividaAtivoPatrimonio` — sem
recalcular nada) e `margem_caiu` (`compararComPeriodoAnterior` aplicado à
margem do mês atual contra a do mês anterior, calculada com as mesmas funções
do §13). Nenhuma dessas seis exige uma coleção nova: margem e receita do mês
anterior são recalculadas ao vivo com os dados que já existem, e a evolução
de dívida/patrimônio reaproveita o snapshot mensal que a Fase 9 já grava.
**Portão da fase:** todo alerta, ao abrir (chevron no card, tela Plano),
mostra os lançamentos concretos que o geraram — retrofit aplicado aos seis
alertas antigos também, não só aos novos; quando não há lançamento
individual por trás (ex.: saldo consolidado), o alerta diz isso
explicitamente em vez de mostrar uma lista vazia sem explicação. Verificado
com Playwright: uma dívida atrasada e uma recorrência nova, ambas expandidas,
mostram exatamente a parcela e o lançamento que as originaram.

### §25 — Home `P0` — ✅ **F2, F5, F6, F7, F9 — os seis blocos completos**

| Bloco | Conteúdo | Fase |
|---|---|---|
| Dinheiro | Atual, comprometido, livre, seguro | ✅ F2 |
| Situação | Estado do caixa e principal risco | ✅ F7 |
| Próximas ações | O que merece atenção agora | ✅ F7 |
| Fluxo | Entradas e saídas projetadas | ✅ F5 |
| Dívidas | Saldo, parcelas, pressão sobre a renda | ✅ F6 |
| Patrimônio | Líquido, ativos/passivos e cobertura da reserva | ✅ F9 |

### §26 — Navegação e módulos `P0` — **F0**

Início · Dinheiro · Planejamento · Dívidas · Renda · Patrimônio · Objetivos ·
Plano · Open Finance · IA · Configurações.
Sem virar planilha gigante.

### §27 — Qualidade de vida `P2` — **F0 + F15**

Ocultar valores (**F0**) · busca global · filtros por período, pessoa, conta,
cartão e categoria · exportação completa dos próprios dados · histórico de
alterações · documentos e comprovantes (F15).

### §28 — Fora de prioridade `P3` — registrado, não construído

Marketplace · compra e venda de investimento · crédito e empréstimo · pagamento
pelo produto · gamificação complexa · rede social financeira · comparadores
sofisticados · integrações não essenciais em volume · **app nativo antes de
validar a experiência central**.

### §29 — Critérios de sucesso `P0` — ✅ portão fechado em **F9** — **V1 completa**

| # | Pergunta | Fase que responde | Onde no produto |
|---|---|---|---|
| 1 | Quanto dinheiro eu tenho hoje? | F2 | Início — "Saldo atual" |
| 2 | Quanto já está comprometido? | F2 | Início — "Comprometido (30 dias)" |
| 3 | Quanto posso gastar com segurança? | F2 | Início — "Dinheiro seguro para gastar" |
| 4 | Quais são minhas próximas obrigações? | F4 | Planejamento — calendário |
| 5 | Em que data meu caixa aperta? | F5 | Planejamento — Fluxo de caixa (4 horizontes) |
| 6 | Quanto devo no total? | F6 | Dívidas — visão consolidada |
| 7 | Quanto as dívidas consomem por mês? | F6 | Dívidas — comprometimento mensal |
| 8 | Quanto entra e sai por mês? | F1 · F5 | Transações · Planejamento |
| 9 | Existe gap de renda? Qual? | F8 | Renda — diagnóstico de déficit |
| 10 | O que provoca a pressão financeira? | F7 | Plano — diagnóstico + achados |
| 11 | O que precisa da minha atenção agora? | F7 | Início — "Próximas ações" · Plano |
| 12 | Qual é meu patrimônio líquido? | F9 | Patrimônio — hero "Patrimônio líquido" |
| 13 | Estou melhorando ou piorando? | F7 · F9 | Plano — histórico de decisões · Patrimônio — variação mensal/acumulada e relação dívida/ativo/patrimônio |
| 14 | Quais metas cabem na minha realidade? | F9 | Objetivos — compatibilidade com a margem atual |

Verificado item a item com o produto na mão (não é uma alegação de
completude — cada linha aponta a tela real que responde a pergunta),
mais Playwright cobrindo o caminho ponta a ponta: pessoa → conta → renda
→ despesa essencial → dívida → ativo → dois objetivos (um dentro e um
fora do ritmo) → patrimônio líquido e cobertura de reserva corretos na
tela de Patrimônio e replicados no bloco da Home. **V1 completa: P0 +
P1 central (§3–§16) entregues.**

### §31 — Definição final — critério de aceite geral

"Uma visão financeira única e confiável, capaz de conectar presente e futuro,
mostrar caixa e dívida com clareza, revelar os principais gargalos, quantificar
gaps, acompanhar patrimônio e transformar tudo isso em um plano de ação que se
atualiza com a realidade."

O valor não está na quantidade de gráficos ou integrações — está em reduzir
incerteza e transformar confusão em sequência objetiva de decisões.

---

## Pós-V1: auditoria de UX/UI e sprints de correção

Fase 12 (Open Finance) em espera — depende de agregador pago ou de virar
Receptor de Dados certificado (D4), infraestrutura fora do escopo deste
painel. Antes de avançar para Fase 13 (IA), auditoria de UX/UI do produto
real (Playwright, telas populadas e vazias, desktop e mobile) levantou 14
achados de confiança e superfície — nada de blueprint faltando, mas gaps que
faziam o produto entregue parecer menos pronto do que o motor por trás dele.
Vira um plano em 4 sprints, fora da numeração de Fases porque não é escopo
novo do blueprint — é qualidade do que já foi entregue.

### Sprint 1 — corrigir os 14 achados da auditoria — ✅ (20/09/2026)

- Cobertura de `[data-valor]` (ocultar valores, §27) em ~50 pontos que
  escapavam do blur: Início, Patrimônio, Objetivos, Renda, Dívidas,
  Calendário, Fluxo de caixa, Importar, Transações.
- Gênero do modal de cadastro ("Nova"/"Novo") corrigido por tipo cadastrado.
- Validação nativa do navegador (inglês) desligada (`novalidate`) em favor
  da validação em português já existente.
- Patrimônio líquido do diagnóstico (Plano) deixou de ser texto fixo —
  reaproveita o motor da Fase 9 (`calcularComposicaoAtivos` /
  `calcularPatrimonioLiquido`).
- `calcularConcentracaoRenda` parou de contar receita sem `fonteRendaId`
  como se fosse uma fonte cadastrada — o dinheiro continua contado, a
  contagem de fontes não inventa mais uma que não existe.
- Edição de transação: antes só dava para apagar e relançar. Agora
  receita/despesa simples, parcela e ocorrência de recorrência têm edição
  completa; transferência edita as duas pernas em sincronia (mesmo valor e
  data); pagamento de fatura edita o essencial.
- `statusEfetivo(t, hoje)` — mesmo padrão de `statusDivida()` (Fase 6):
  "previsto"/"agendado" com data no passado lê como atrasado na hora,
  sem precisar ninguém marcar. Aplicado em Transações, Calendário e no
  comprometido de Caixa.
- Legenda de direção nas transferências da lista de Transações
  (`Conta corrente → Poupança`), usando o par pela `transferenciaId`.
- Tela nova "Recorrências" (aba em Dinheiro): listar, pausar/retomar,
  editar e apagar — antes só existia `recorrencias.criar()`, sem forma de
  gerenciar o que já tinha sido criado.
- Estados vazios sóbrios em Renda e Plano: com zero fonte/transação ou zero
  pessoa/conta, mostrar o diagnóstico inteiro (gaps zerados, banner "tudo
  coberto") é enganoso — troca por uma chamada direta para cadastrar o
  primeiro dado.
- Indicador visual de mais módulos fora da tela na nav mobile — sombra nas
  bordas que liga/desliga conforme a posição do scroll.
- Testes do motor: 262 passando, incluindo os novos de `statusEfetivo` e
  `calcularConcentracaoRenda`.

### Sprint 2 — novo sistema de design (referência Nubank) — ✅ (20/09/2026)

Só tokens e componentes de base (`estilo/tokens.css`,
`estilo/componentes.css`) — nenhuma tela mudou de estrutura, todas herdam o
visual novo automaticamente por já rodarem sobre as mesmas classes
compartilhadas (`.btn`, `.item-cartao`, `.hero-caixa`, `.modulo-chip`,
`.field input` etc.), confirmando que o "sistema" de fato é um sistema.

- Cor de marca: preto neutro (`#14161B`) trocado por um roxo
  (`#7C3AED` claro / `#A78BFA` escuro) — referência Nubank pedida pelo
  usuário. Fica reservada a marca/interação (CTA, chip ativo, foco, avatar
  com iniciais); `--good`/`--warn`/`--danger` continuam só sobre dinheiro,
  para as duas linguagens de cor não colidirem (saldo negativo não pode
  competir visualmente com "botão de marca").
- Token novo `--accent-soft` (tinta roxa fraca) para estados ativos/hoje
  sem virar um bloco cinza neutro (dia de hoje no calendário, horizonte
  ativo no fluxo de caixa, avatar de iniciais).
- Marca mínima no topo: quadrado roxo antes do wordmark (`.wordmark::before`,
  puro CSS, sem asset) — acompanha o tema sozinho.
- Cantos mais arredondados em toda a superfície de cartão (`--radius`
  14→18px; cartões de lista, achados, horizontes de fluxo, modal, resumo
  12→16-22px) e tags viraram pill — leitura de "app", não de painel.
- Sombra um pouco mais presente (`--shadow`) para dar profundidade sem
  pesar.
- Validado com Playwright: telas populadas e vazias, claro e escuro,
  desktop e mobile. 262 testes do motor passando (mudança é só CSS).

### Sprint 3 — Home como dashboard — ✅ (20/09/2026)

Pedido literal do usuário: "a página inicial deveria ter um resumo e uns
botões, tipo cards, assim, pra você ir clicando... simples, pra uma pessoa
leiga conseguir olhar e resolver tudo que ela tem que resolver... igual o
app do Nubank faz". A Home empilhava os seis blocos do §25 inteiros, um
embaixo do outro (por que esse número, compromissos, situação, próximas
ações, fluxo de 4 horizontes, dívidas, patrimônio) — útil pra auditar, ruim
pra abrir o app e agir.

- Mantido: hero "dinheiro seguro para gastar" (§4) + resumo de 3 números
  (saldo/comprometido/livre) — o "resumo" pedido, sem cortar informação
  que já era o núcleo do §25.
- Novo: alerta compacto do item mais urgente da Central de Decisões
  (§9) logo abaixo do hero — só aparece quando existe urgência de verdade
  (nunca inventa pressão), toque leva direto pra Plano.
- Novo: grade de 7 cartões clicáveis — um por módulo (Transações em
  destaque como atalho principal, Planejamento, Dívidas, Renda, Patrimônio,
  Objetivos, Plano) — cada um com um número/rótulo e uma linha de contexto,
  lidos de painéis que já existiam (nenhum cálculo novo, só uma leitura
  compacta). Cada cartão é a porta de entrada pro bloco de prosa completo,
  que continua existindo na tela de origem — nada de informação foi
  perdido, só saiu da Home.
- Cada cartão respeita §27 (ocultar valores) individualmente: um total em
  R$ borra, um rótulo de status ("Em dia", "Zerado", "3/5 no ritmo") não
  borra — testado com Playwright ligando o modo por CSS e conferindo que
  só o dinheiro sumiu.
- Testado em claro/escuro, desktop/mobile: grade em 2 colunas no celular,
  3 no desktop. Cliques nos cartões navegam pro módulo certo (verificado
  com Playwright — Dívidas e Objetivos abrem na tela certa a partir do
  cartão). 262 testes do motor passando (mudança é só de tela — nenhuma
  função de domínio mudou de assinatura).

### Sprint 4 — propagar o visual para as demais telas — ✅ (20/09/2026)

Nenhuma mudança de código necessária — e isso é o resultado esperado, não
um atalho: o Sprint 2 foi feito como sistema de tokens (`estilo/tokens.css`
+ `estilo/componentes.css`), não como retoque tela por tela, então toda
tela que já usava as classes compartilhadas (`.item-cartao`, `.btn`,
`.modulo-chip`, `.field input`, `.resumo-item`, `.horizonte-card` etc.)
herdou o roxo, os cantos mais arredondados e as tags em pill sozinha.
Confirmado com `grep` (zero cor em hexadecimal ou `style="...color/
background"` fora de `var(--...)` em qualquer tela) e com Playwright,
varrendo Dinheiro (Transações/Recorrências/Contas/Cartões), Dívidas,
Planejamento (Calendário — dia de hoje com tinta roxa — e Fluxo de caixa
— horizonte ativo com tinta roxa), Renda, Objetivos, Plano e os modais de
cadastro: tudo consistente, nada preso ao visual antigo. Fecha o plano de
4 sprints aberto após a auditoria de UX/UI.
