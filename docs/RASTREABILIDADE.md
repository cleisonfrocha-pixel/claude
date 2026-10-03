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
| 22 | Cenários e simulador de realidade | P2 | F14 | ● |
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

### §22 — Cenários `P2` — ✅ **F14** (27/09/2026)

Atual · recuperação · aumento de renda · redução de despesa · quitação de dívida
· conservador · comparação **sem alterar dados reais** · impacto em caixa,
dívida, reserva e patrimônio.

**Como foi entregue:** `domain/cenarios.js` + aba Plano › Caminhos. Os seis
caminhos simulados mês a mês (12/24/36 meses) sobre uma base tirada dos dados
reais; cada um mostra quando o nome limpa, quando a dívida zera, quando a
reserva fecha, sobra mensal, juros de dívida parada e patrimônio em 12 e no
fim; um gráfico compara dívida/reserva/patrimônio de todos. Caminho sugerido
por regra escrita (não quebrar > limpar o nome > colchão > zerar dívida >
crescer, preferindo menos esforço quando a diferença é de até 3 meses), sempre
com o motivo. Premissas ficam na tela. Nada é gravado: os ajustes vivem só na
memória da tela. A outra metade da Fase 14 (§21, fechamento mensal) continua
aberta.

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

---

## Pós-Sprint 4: segunda leva de ajustes visuais (referência Nubank Empresas)

O usuário anexou um print do app de verdade do Nubank Empresas e pediu que
o produto chegasse mais perto dele: tema escuro como identidade (não só
claro com um fallback de sistema), ícones em vez de só texto, navegação
inferior fixa (não a fileira de chips grande no topo), textos maiores e
sem travessão. Virou um plano de 6 sprints (5 a 10), executado inteiro
numa sessão a pedido do usuário ("Pode iniciar").

### Sprint 5 — tema escuro como identidade principal — ✅ (20/09/2026)

A estrutura de tema exigida pela plataforma de artifact (`:root` claro,
escuro nos blocos guardados por `prefers-color-scheme`/`data-theme`) foi
mantida — é o que faz o alternador funcionar certo — mas qual tema abre
por padrão passou a ser decisão nossa, não só do sistema operacional de
quem acessa.

- `src/ui/tema.js` (novo, mesmo padrão de `privacidade.js`): sem escolha
  salva em localStorage, abre escuro. Quem prefere claro troca em
  Preferências e a escolha persiste por aparelho.
- Script inline no topo de `index.html`, antes de qualquer CSS: lê a
  mesma chave de localStorage e já marca `data-theme` no documento antes
  da primeira pintura, para não haver flash de tema errado.
- Paleta escura reconstruída em `estilo/tokens.css`: preto quase puro
  (`#0A0A0D`) no lugar do azul-marinho de painel que tínhamos antes,
  roxo mais vívido (`#A855F7`) para ficar legível sobre o preto.
- Nova linha em Preferências para trocar de tema a qualquer momento.
- Testado com Playwright: abre escuro por padrão, alternar pra claro
  funciona e sobrevive a um recarregamento (localStorage). 262 testes do
  motor passando (mudança é só de tema/CSS).

### Sprint 6 — sistema de ícones SVG inline — ✅ (20/09/2026)

`src/ui/icones.js` (novo): ~25 ícones de traço (24×24, `currentColor`)
desenhados no próprio projeto, cobrindo os módulos de navegação e as
ações mais comuns (olho/ocultar valores, ajuda, perfil, editar, apagar,
alerta etc.). Nenhuma fonte de ícone nem pacote externo: só scripts de
cdnjs/jsdelivr são permitidos pelo CLAUDE.md, e um SVG embutido é arquivo
nosso, da mesma origem. Verificado visualmente antes de integrar em
qualquer tela (grade isolada com todos os ícones lado a lado) — inclusive
corrigiu de saída um ícone de "dívidas" que, copiado do de "renda", tinha
saído com a seta apontando pro lado errado (subindo, não descendo).

### Sprint 7 — navegação inferior fixa (bottom tab bar) — ✅ (20/09/2026)

Pedido direto do usuário: "o menu fica na parte inferior, não aquele...
gigante" (referindo-se à fileira de chips rolável que ocupava o topo no
celular). `src/ui/shell.js` ganhou uma segunda árvore de navegação:

- Barra fixa embaixo (só abaixo de 860px de largura): Início, Dinheiro,
  Planejamento, Plano e um "Mais" que abre uma folha (reaproveita o modal
  existente) com os módulos secundários (Dívidas, Renda, Patrimônio,
  Objetivos, Open Finance, IA, Configurações) — mesmo padrão do app de
  banco de verdade, que também não cabe tudo em 5 ícones.
- Acima de 860px, o topo continua com todos os 11 módulos — uma barra
  fixa embaixo não faz sentido de uso em tela larga (mouse e espaço
  sobram) — só que agora com ícone em cada chip.
- As duas árvores existem sempre no DOM (uma função `renderizarNavegacao`
  atualiza as duas juntas); o CSS decide qual aparece, então trocar de
  módulo mantém o estado ativo sincronizado nas duas, sem duplicar lógica.
- Testado com Playwright: clique na barra inferior navega certo, "Mais"
  abre e navega certo, e o estado ativo da barra inferior reflete quando
  o módulo aberto é um dos secundários (mostra "Mais" destacado).

### Sprint 8 — Home no molde do print do Nubank — ✅ (20/09/2026)

Reestruturação da Home seguindo a ordem visual do print anexado: zona
roxa no topo com ações rápidas e um item flutuando por cima, corpo escuro
com o saldo em texto puro (não mais dentro de um cartão roxo — o roxo
virou só a faixa de cima), e a grade de cartões do Sprint 3 ganhando
ícone em cada um.

- `.home-topo-roxo`: ícones de "ocultar valores" (liga de verdade
  `privacidade.alternar()`, com o ícone trocando de olho aberto/fechado
  na hora) e "configurações" (atalho pra tela).
- `.home-banner-flutuante`: o achado mais urgente (só quando existe um de
  urgência alta de verdade), num cartão claro flutuando sobre o roxo —
  o mesmo padrão do banner "Pagar DAS" do print.
- Saldo em texto puro, direto no fundo escuro, sem cartão ao redor.
- `.home-carrossel`: os próximos achados (até 3, descontado o que já
  virou banner), em scroll-snap nativo com bolinhas de paginação
  clicáveis e sincronizadas com o arrasto — sem biblioteca nenhuma.
- Testado com Playwright: banner aparece só quando há urgência real
  (forçado com uma despesa grande deixando o caixa negativo), ícone de
  olho borra os valores certos e mantém rótulos de status legíveis,
  mobile e desktop, claro e escuro. 262 testes passando (nenhuma função
  de domínio mudou de assinatura).

### Sprint 9 — revisão de texto sem travessão — ✅ (20/09/2026)

Passada em toda a interface (telas e o texto gerado pelo motor que chega
até a tela — pendências de completude, rótulos de origem dos achados,
mensagens de validação) trocando travessão por frases diretas: ponto,
dois-pontos ou vírgula, o que couber melhor em cada frase. Rótulos de
navegação tipo "Início — Dinheiro seguro para gastar" viraram
"Início · Dinheiro seguro para gastar" (ponto médio, não travessão).
Valores de reposição para campo vazio (contraparte de transferência sem
par, data de quitação sem dívida) trocaram de "—" para "-" (hífen simples,
tecnicamente não é travessão). Tamanhos de texto secundário abaixo de
12px (badges, tags, legendas) subiram um degrau para ficarem mais
legíveis. Um teste (`decisoes.test.js`) tinha uma asserção presa ao texto
antigo com travessão — atualizado junto. 262 testes passando.

### Sprint 10 — verificação e publicação do redesign — ✅ (20/09/2026)

Varredura final com Playwright em desktop e mobile, claro e escuro, todas
as telas principais e a barra inferior/"Mais": sem erros de console, sem
regressão visual. 262 testes do motor passando. Commit, push, artefato
republicado e esta seção do `docs/RASTREABILIDADE.md` escrita como parte
do mesmo commit. Fecha os 6 sprints (5–10) da segunda leva de ajustes
visuais pedida pelo usuário depois de ver o print do Nubank Empresas.

---

## Entrada de dados pelo chat ("subir no painel") — ✅ (26/09/2026)

Pedido do usuário: parar de organizar planilha e alimentar o painel mandando
as coisas do jeito dele (texto, print, áudio ditado) pelo chat, sem confirmar
item por item. Decisão: em vez de construir a captura por IA dentro do app
(Fase 13 antecipada), o próprio Claude Code vira a porta de entrada, porque o
banco do artefato (`db`) é gravável pelo `ArtifactData` numa sessão deste
repositório. Zero código novo na página, zero custo por uso além da conversa.

- `app/ferramentas/subirPainel.js`: o Claude interpreta a mensagem num
  "pedido" com nomes (não ids); o núcleo resolve os nomes contra o estado real
  e monta os documentos com os mesmos padrões, validações e regras do motor
  (`src/domain/`): fatura pelo dia de fechamento, parcelamento sem perder
  centavo, transferência em duas pernas, pagamento de fatura que não vira
  despesa, recorrência que já gera os previstos, checagem de duplicata,
  item tudo-ou-nada. Nada entra no banco montado à mão.
- `app/ferramentas/subir-painel.js`: linha de comando que lê o estado baixado
  com `out_dir` e devolve as escritas prontas para o `batch` do ArtifactData.
- Rastreabilidade (§9, §17): cada envio grava um lote em `lotesImportacao`
  (`formato: "chat"`) com o texto original e o que foi alterado; todo registro
  aponta para ele (`origem: "chat"`, `origemId`). Lançamentos entram como
  "não revisado". "Desfaz o último envio" apaga o que nasceu do lote e devolve
  os campos alterados.
- `.claude/skills/subir-painel/SKILL.md`: qualquer sessão nova do repositório
  sabe fazer isso sozinha; a autorização do usuário está registrada lá e no
  `CLAUDE.md`.
- Tela Importar: histórico mostra "Enviado pelo chat". Artefato versão 19.
- 16 testes novos (`testes/subirPainel.test.js`), 278 passando. Ensaio contra o
  banco real sem gravar: 5 itens montados, 1 barrado com motivo claro.

---

## Banho de loja visual — pós "segunda leva" (26-27/09/2026)

Pedido do usuário depois de ver o app pronto: contraste roxo/texto ilegível,
visual chapado sem profundidade, logo genérico, e texto técnico demais
(referências de seção, valores em fonte de programador). Seis sprints,
sem mexer em domínio nem dado — só CSS, HTML e os textos das telas.

### Sprint 11 — contraste — ✅ (26/09/2026)

Achado real: o roxo de marca (`--accent`) tinha ~5:1 de contraste como
TEXTO sobre fundo neutro, mas usado como FUNDO com letra em cima (botão,
chip ativo, cartão de saldo, dia selecionado) caía pra ~4:1 — o "roxo com
letra preta" relatado. Correção: `--accent-fill` (roxo escuro, ~9:1 com
branco) para todo fundo que carrega texto; `--accent` continua só pra
texto/ícone/borda. Auditoria pega de quebra dois valores de cor que também
falhavam (`--good`/`--warn` no tema claro, 2.6:1 e 3.2:1) — escurecidos
pra 5:1. Teste novo `testes/contraste.test.js`: lê os tokens direto de
`estilo/tokens.css` (nunca hardcoda) e mede WCAG pra todo par texto/fundo
real da interface, nos dois temas — 300 testes passando.

### Sprint 12 — logo Cleison Rocha — ✅ (27/09/2026)

3 variações de monograma CR mostradas ao usuário (selo circular, quadrado
entrelaçado, lettermark sem caixa) — o topo do app passou de "Vida
Financeira" genérico pra "Cleison Rocha · Painel financeiro", com o
usuário confirmando a troca de nome antes de qualquer código. Aplicado o
quadrado entrelaçado (consistência com o resto do sistema de cantos
arredondados). SVG embutido, sem asset externo.

### Sprint 13 — profundidade — ✅ (27/09/2026)

3 níveis de sombra (`--shadow-sm/--shadow/--shadow-lg`) e um filete de luz
(`--sheen`) — os 8 cartões que eram só superfície+borda ganharam sombra e
filete; blocos de marca (saldo, hero de patrimônio, chip ativo, botão
primário, dia selecionado) ganharam degradê (`--accent-fill` →
`--accent-fill-2`) no lugar de cor chapada; botão primário responde ao
toque (leve elevação, sombra maior no hover, compressão no active).

### Sprint 14 — Home: cartão de saldo único — ✅ (27/09/2026)

Bloco roxo de topo + saldo solto embaixo virou um cartão só: saudação por
horário, ações, valor central e as três métricas de apoio (saldo,
comprometido, livre) todos dentro do mesmo degradê. O alerta mais urgente
saiu de dentro do roxo e virou cartão próprio logo abaixo. Nova fileira de
atalhos redondos (Lançar, Plano, Dívidas, Renda — sem deep-link de aba
ainda, então trocado "Importar" do pedido original por "Renda", os 4
destinos hoje alcançáveis direto).

### Sprint 15 — textos — ✅ (27/09/2026)

Nenhum texto visível abaixo de 13px (24 pontos no CSS + 2 inline
ajustados); removidas as 9 referências de seção do blueprint que
vazavam pra tela (`(§8)`, `(§13)` etc. — as internas em comentário de
código continuam, são pra quem lê o código, não pra quem usa o app);
rótulo da barra inferior "Planejamento" (truncava "Planejame...") virou
"Agenda", só ali. Valores em dinheiro trocaram `IBM Plex Mono` por
`Poppins` com `font-variant-numeric: tabular-nums` (números ainda
alinham) — a fonte mono ficou só pro badge "modo local" e a referência de
fase nas telas ainda não construídas, onde o ar técnico é proposital.

### Sprint 16 — verificação e publicação — ✅ (27/09/2026)

Varredura com Playwright: 8 módulos em tema escuro, Início e Plano em tema
claro, Início e o menu "Mais" em mobile — sem erro de console, sem
regressão visual, atalhos de bottom nav lendo "Agenda" corretamente. 300
testes do motor + contraste passando. Artefato republicado (versão 20).

---

## Casa com duas pessoas e caminhos de virada (27/09/2026)

Pedido do usuário: ele e a esposa vão cadastrar contas, extratos e dívidas
(inclusive Serasa), sem renda conjunta. O sistema precisa diferenciar cada um,
somar a casa e gerar um plano que mostre opções de caminho, não só pendências.
Auditoria antes de construir: `pessoaId` era gravado em tudo, mas nenhum
cálculo o lia; e o "qual caminho seguir" era a Fase 14 (§22), nunca construída.

### Sprint 17 · motor por pessoa + negativada — ✅

- `domain/pessoas.js`: por pessoa (renda, gasto, essencial, parcelas,
  cobertura do próprio mês, saldo, reserva, dívidas, negativadas, patrimônio,
  participação na renda e no gasto da casa), a casa, o "sem responsável",
  repasses entre contas de pessoas diferentes e o desequilíbrio (quanto da
  falta de um a folga do outro cobre). Dono da transação: responsável marcado
  → dono da conta → dono do cartão. Saldo é da conta, não de quem gastou.
  Invariante testada: pessoas + sem dono = casa, campo a campo.
- Dívida `negativada` (Serasa/SPC); sem acordo, a parcela pode ser zero — só
  nesse caso. Sem acordo não tem data de quitação e zera a previsão do
  conjunto. Achado "Nome negativado" (urgente) substitui o de "atrasada" pra
  mesma dívida. Contagem de atrasadas separada das negativadas.

### Sprint 18 · Plano › Por pessoa — ✅

Plano virou tela com abas (Visão geral, Por pessoa, Caminhos). Por pessoa: a
casa somada, negativadas da casa, a leitura principal ("fulano fica X abaixo;
a folga de ciclano cobre Y"), um cartão por pessoa e quem passou dinheiro pra
quem. Dívidas ganhou o campo e a etiqueta "negativada", e explica dívida sem
acordo.

### Sprint 19 · motor de cenários — ✅ (ver §22 acima)

Modelo: dívida com acordo segue a parcela (juros já embutidos); sem acordo
cresce com o juros informado; sobra vai pras negativadas (menor saldo
primeiro), depois juros mais alto; falta sai da reserva e, acabando, o caminho
"aperta". Renda garantida = fontes fixas/recorrentes (ou o pior mês).

### Sprint 20 · Plano › Caminhos — ✅

Caminho sugerido com motivo, ajustes (corte, renda extra, meses de reserva,
horizonte), gráfico de linhas desenhado na largura real (texto sempre 13px),
um eixo só, dica ao tocar com o valor de cada caminho, "seguir como está"
tracejado (é a referência e costuma coincidir com outro), paleta categórica
validada nos dois temas (cor segue o cenário, não o ranking), legenda + os
cartões como tabela de números.

### Sprint 21 · verificação e publicação — ✅

325 testes (motor por pessoa 11, cenários 13, chat 1 novo). Prints com casal
semeado (duas pessoas, transferência entre elas, duas negativadas sem acordo)
em desktop e celular, claro e escuro. Skill `subir-painel` ensinada a marcar
responsável e negativada. Artefato republicado.

---

## Auditoria antes dos dados reais e Sprint 22 (28/09/2026)

Pedido do usuário: antes de mandar o fechamento do mês com dados reais dele e
da esposa, uma auditoria completa e a fundo no motor de plano/cenários,
"pegue todos os possíveis problemas", pra não sair um plano genérico nem
irreal. Auditoria feita escrevendo um script que roda o motor de verdade
(`domain/*.js`) sobre cenários pequenos e conferíveis à mão, não só lendo o
código — provou 5 erros de cálculo com número exato esperado vs. calculado, e
mapeou 11 lacunas estruturais (sem plano de pagamento mensal, sem despesa
anual/irregular, sem separação PF/PJ, etc. — viram Sprints 23+, ainda não
construídos). Pedido de correção ("faça as correções agora") cobre os 5 erros
de cálculo confirmados: Sprint 22.

### Sprint 22 · corrigir os 5 erros de cálculo confirmados — ✅

1. **Parcela de dívida contada duas vezes na margem.** Quem paga uma parcela
   lança despesa na categoria "Dívidas e parcelas" (essencial) E atualiza a
   dívida — o mesmo pagamento nascia em dois lugares, e a margem descontava
   os dois. `orcamento.js#calcularCustos` agora tira o grupo `dividas` do
   essencial e devolve num balde à parte (`dividasCentavos`); quem soma
   `comprometimentoMensalDividasCentavos` por cima não duplica mais.
   Efeito em cascata: `reserva.js` (via `patrimonioRepo.js`) passou a somar
   o comprometimento de dívida no denominador da cobertura em meses — antes
   ficava de fora quando a parcela não tinha sido lançada como despesa no
   mês, e sobrava dentro quando tinha, inconsistente.
2. **Fatura de cartão paga sem nenhuma compra lançada sumia do gasto.**
   `calcularCustos` detecta pagamento de fatura sem nenhuma despesa com o
   mesmo `faturaId` e conta esse valor à parte (`faturaSemDetalheCentavos`,
   dentro do atual, fora do essencial e do discricionário — categoria
   desconhecida não é presumida). Aviso novo na tela Renda quando isso
   acontece, apontando o valor.
3. **Caixa inicial dos Cenários descontado duas vezes.** A base partia de
   `livreCentavos` (que já tira os compromissos dos próximos 30 dias), e o
   mês 1 da simulação tirava de novo um mês inteiro de custo médio — o
   mesmo boleto descontado duas vezes. Base passa a usar `saldoAtualCentavos`
   (saldo em conta, sem desconto prévio); só a simulação mês a mês desconta,
   uma vez.
4. **Mês corrente incompleto entrando na média histórica com peso de mês
   fechado.** `mesesComMovimento` incluía o mês em andamento — perto do
   início do mês, quase sem lançamento, derrubando a média de renda e gasto.
   Passa a olhar só meses FECHADOS (nunca o corrente).
5. **Saldo de dívida podia zerar antes da última parcela.** Quando o
   principal cadastrado não inclui os juros embutidos na parcela (comum em
   financiamento), `saldoOriginal − parcelasPagas×parcela` chegava a zero
   antes de `parcelasPagas` alcançar `quantidadeParcelas` — a dívida sumia
   do Cenários (que só simula saldo > 0) com parcela real ainda por pagar.
   `calcularSaldoAtual` agora nunca fica abaixo do que as parcelas que
   faltam ainda somam.

Cada correção com teste provando o número certo (e o errado, antes da
correção, documentado no comentário do teste). 332 testes passando (327 →
+5 novos, mais os 2 recalculados que a correção do mês corrente exigiu).

---

## Segunda auditoria com um casal realista e Sprints 23-26 (28/09/2026)

Pedido do usuário: auditoria a fundo antes de mandar os dados reais: o
sistema vai fazer certo? um leigo entende no celular e no computador?
Método: um casal fictício realista (renda variável dele, salário fixo dela,
dois cartões, um que fecha dia 25 e vence dia 5, financiamento, empréstimo,
duas dívidas no Serasa, três meses de extrato) montado pela MESMA
ferramenta do chat, e o app aberto no navegador com esses dados em todas
as telas, desktop e celular. Cada número conferido à mão.

### Sprint 23 · motor — ✅

- **Futuro que o sistema não enxergava** (`domain/previstos.js`, novo):
  renda cadastrada (fixa pelo valor, variável pelo pior mês fechado, sem
  histórico = incerta), parcela de cada dívida nas datas do contrato (vencida
  e não paga pesa hoje) e conta mensal além dos meses já gerados. Entra na
  agenda, no fluxo de caixa e na tela inicial. Antes: projeção de 12 meses
  sem salário nem parcela (-R$ 5.260 e "caixa aperta" falso).
- **"Dinheiro seguro para gastar"** passa a ser o ponto mais baixo do saldo
  nos próximos 30 dias, contando o que entra e o que sai (§4 de verdade).
  Antes: saldo menos saídas, sem nenhuma entrada (-R$ 2.070 com salário
  caindo em uma semana).
- **Projeção longa com o gasto do dia a dia** na média dos meses fechados,
  menos o que as recorrências já projetam. Sem isso 12 meses era só entrada.
- **Pagamento de fatura na fatura certa**: a que já fechou até a data
  (`faturaParaPagamento`). Antes, no cartão que fecha 25 e vence 5, pagava a
  fatura seguinte e a certa ficava "aberta" pra sempre, comendo limite.
- **Parcela paga ligada à dívida** (`transacao.dividaId`): conta como parcela
  nova só a que está em aberto; extrato antigo só liga. Fim das dívidas
  "atrasadas" que estavam pagas.
- **Saldo devedor = valor pra quitar hoje**: valor presente das parcelas na
  taxa do contrato (informada ou implícita no principal/parcela/prazo). O
  Sprint 22 tinha trocado "zera antes da hora" por "cobra juros futuros"
  (carro: R$ 33.350 em vez de ~R$ 25.120).
- **Caminhos**: dívida com acordo rende a taxa e a parcela abate (pagar a
  mais corta juros de verdade); parcela descontada uma vez só (o Sprint 22
  não tinha chegado aqui: sobra mensal errada em R$ 1.630); conservador usa o
  pior mês da renda variável em vez de zero; aviso quando o mês fecha mas um
  dia específico aperta.
- **Alarmes falsos**: mês antes do começo do histórico não entra na média
  como zero (eram 4 de 10 alertas); "déficit" só quando o mês não fecha ou o
  caixa aperta (a tela Renda acusava déficit num mês com sobra de R$ 4.400);
  "caixa aperta" e "saída crítica" não aparecem duplicados.
- **Consistência entre telas**: leitura única de dados (`dados/base.js`); a
  Renda passou a ler faturas (dava -R$ 300 onde a Início dava -R$ 2.070);
  "essencial" com a mesma definição em todo lugar; recorrente vs.
  extraordinário reconhece conta mensal que veio de extrato.

### Sprint 24 · casal de teste permanente — ✅

`testes/fixtures/casal.js` + `testes/casal.test.js`: o casal montado pela
ferramenta do chat e 10 conferências com a conta à mão ao lado (faturas,
parcelas, dinheiro seguro, custos, dívidas, por pessoa, caminhos, projeção,
alertas). `testes/previstos.test.js` cobre os eventos futuros. 350 testes.

### Sprint 25 · telas pra leigo — ✅

- Listas no celular: o nome sumia (largura zero) e a tela rolava pro lado.
  Agora nome em cima, valor e botões embaixo.
- Todo botão com palavra (Editar, Apagar, Detalhes, Conferido, Pausar),
  nada de ✎ ✕ ▾ soltos. Decisões: "Já resolvi", "Lembrar depois", "Não se
  aplica".
- Transferência aparece uma vez, não duas; pagamento de fatura e
  transferência explicam que não são gasto; "a conferir" + "Conferi todos".
- Plano › Visão geral começa pelo que fazer; prazo, diagnóstico, qualidade e
  histórico recolhidos (a tela no celular caiu de ~12 pra ~4 alturas).
- Início: "Em conta hoje / Vai entrar / Vai sair" e a frase diz o dia mais
  apertado; cartões sem alerta repetido; texto de Objetivos voltou a
  aparecer (botão não herdava a cor); Planejamento mostra quanto fica em
  conta em 30 dias.
- Fluxo de caixa mostra quanto fica em conta em cada prazo (antes, uma
  variação que não batia com o detalhe). Nome da categoria no diagnóstico,
  vírgula decimal, dia do recebimento no cadastro de renda.

---

## Sprint 27 · sobrevivência, filho e investimento protegidos; dívida prioriza (28/09/2026)

Pedido do usuário: ele não vai ter dinheiro pra pagar todas as contas —
vai ter dívida que fica pra depois, de propósito, enquanto ele decide
prioridade. Mas o plano não pode assumir que ele para de viver: padrão de
vida, o filho de 9 meses, e o investimento continuam, mesmo com dívida em
aberto. Pediu pra eu ajustar a base de dados/domínio pra isso — não pra
esperar os dados reais.

- **Categoria "Filho"** (grupo novo `filho`) nasce essencial por padrão:
  protegida do corte em Caminhos igual moradia, mercado e saúde.
- **Investimento mínimo mensal** (`configuracoes/orcamento`, definido pelo
  usuário em Renda › Metas): protegido como o essencial em toda simulação
  de Caminhos — sai antes de qualquer parcela de dívida, puxando da
  reserva se precisar. Ajustável também na hora, na aba Caminhos.
- **Prioridade de pagamento por dívida** (`dividas/<id>.prioridadePagamento`,
  opcional): quando a renda do mês não fecha pra pagar a parcela de todas
  as dívidas com acordo, a simulação (`ordemDePagamento`) paga primeiro a
  de número menor e deixa as demais sem pagamento naquele mês — não dreno
  mais a reserva pra forçar pagar tudo, nem marco o caminho inteiro como
  inviável só por isso. Sem prioridade definida, protege primeiro a de
  juro mais alto. A tela de Caminhos mostra, por caminho, quem fica sem
  pagar e por quantos meses.
- **"Inviável" mudou de sentido**: antes, qualquer parcela que drenasse a
  reserva até zerar marcava o caminho inteiro como "aperta". Agora só
  conta como aperto de verdade quando nem o essencial + investimento
  mínimo fecham — a dívida pode ficar pra trás sem isso ser uma crise.
- 8 testes novos provando `ordemDePagamento` (prioridade do usuário manda,
  sem prioridade protege o juro mais alto), a dívida certa ficando sem
  pagamento, o investimento mínimo derrubando uma parcela, e a diferença
  entre "dívida sem pagar" (reserva intocada, viável) e "essencial sem
  cobrir" (reserva usada, pode apertar de verdade). 358 testes.

## Sprint 28 · rede de segurança contra tela em branco no boot (02/10/2026)

- Motivo: relato do Cleison de que "o app aparentemente tá com erro para
  abrir". Investigação extensa (sintaxe, clique em cada módulo do zero,
  integridade dos 76 arquivos publicados) não reproduziu nenhum erro — mas
  só cobria o modo local (sem a capability `db` real), que é justamente o
  caminho usado quando ele abre pelo link de verdade, e o Cleison não
  conseguiu descrever o sintoma com mais detalhe.
- Achado real, independente da causa exata: `index.html`/`src/main.js` não
  tinham nenhuma rede de segurança — se qualquer passo da inicialização
  (resolver a capability `db`, `garantirEsquema`, semear categorias)
  lançasse uma exceção, a tela ficava em branco sem nenhuma pista, nem
  para o usuário reportar, nem para depurar depois. Era exatamente o
  formato do sintoma relatado.
- Correção: `index.html` ganhou `window.mostrarErroFatal` + listeners de
  `error`/`unhandledrejection` (cobre até falha no carregamento de um
  módulo, antes de `main.js` sequer rodar); `src/main.js` envolve
  `iniciar()` num try/catch que chama `mostrarErroFatal` com a stack. Em
  vez de tela em branco, agora aparece "O painel não conseguiu abrir" com
  o erro exato — o que o Cleison pode printar e mandar.
- Verificado via Playwright: carga normal sem regressão (358 testes
  continuam passando) e acionamento manual de `mostrarErroFatal`
  mostrando a tela de erro corretamente.

## Sprint 29 · renda prevista sem confirmar vira "atrasado" na agenda (02/10/2026)

- Primeiro upload real de dados pelo chat: pessoas (Cleison Rocha, Carolina
  de Jesus), contas (Next, Nubank, com saldo de 01/10) e 5 fontes de renda
  (Carolina salário fixo; Sociable, CryptoPag, Projeto Gábbia e Gedi/Tony
  recorrentes, freelas do Cleison). Corrigi de passagem um cadastro de
  pessoa com nome errado, resquício de teste ("Cleison Fiorin").
- Pedido do Cleison: "no calendário deveriam ter os dias que vão entrar
  esse aporte... com alertas, tipo: precisa entrar, hein? ou preciso
  cobrar." Achado ao investigar: `eventosFuturos` (domain/previstos.js) já
  projetava o dia esperado de cada fonte de renda pro calendário, mas se o
  dia passava sem receita confirmada, o evento simplesmente sumia — sem
  aviso nenhum. A mesma função já tratava isso certo pra parcela de dívida
  (vencida e não paga pesa hoje, marcada `atrasado`); faltava o mesmo pra
  renda prevista.
- Correção: o laço de `fontesRenda` em `eventosFuturos` agora usa o mesmo
  padrão — dia esperado já passado neste mês sem receita lançada pesa hoje
  como `atrasado: true`, em vez de desaparecer. A tela Agenda
  (`calendario.js`) já sabia renderizar essa etiqueta "Atrasado" pra outros
  tipos de evento; não precisou mudar nada na UI. Recorrências (aluguel,
  etc.) ficaram de fora de propósito: aquele comportamento de "não virar
  cobrança retroativa" foi uma decisão deliberada de sprint anterior, não
  o mesmo problema.
- 2 testes novos em `previstos.test.js` provando o atraso (com e sem
  receita no mês) e 1 teste existente atualizado pra refletir o
  comportamento novo (antes ele verificava — sem querer documentar isso —
  que renda variável vencida e não recebida sumia do calendário). 360
  testes.

### Sprint 30–31 — Navegação por ação e motor único do mês — ✅ (02/10/2026)

- Sprint 30: barramento `ui/navegacao.js` (Lançar abre o formulário direto),
  categorias novas (Equipe e freelancers, Ferramentas de trabalho = essenciais;
  Escritório = não essencial), dica de data por extenso, `[hidden]` forçado.
- Sprint 31: causa-raiz dos números divergentes eram dois motores — `caixa.js`
  contava renda provável, e orçamento/renda/diagnóstico/cenários só contavam
  "pago". Novo `domain/mes.js` (`visaoDoMes`, `numerosDoMes`) separa renda
  confirmada, provável e incerta (incerta nunca entra) e gasto pago/previsto;
  todas as telas e repositórios passaram a usá-lo. Renda e Por pessoa mostram
  "já recebidos + esperados". Cenários sem histórico usam o mês atual e avisam.
- Recorrência/transação com `semDia` (dia incerto) só atrasa após o fim do mês.
- 7 testes novos em `mes.test.js` (incl. cenário Cleison: renda cadastrada,
  nada recebido). 367 testes passando; Playwright com dados reais sem erro JS.

### Sprint 32 — Navegação nova e correção de travamento — ✅ (02/10/2026)

- Barra de baixo: Início · Dinheiro · ＋ · Dívidas · Plano. O ＋ abre uma folha
  (lançar, importar, ver o que vence, ver dívidas). Configurações virou a
  engrenagem do topo. Agenda e Renda viraram abas de Dinheiro; Patrimônio e
  Metas viraram abas de Plano. Destinos antigos redirecionam
  (`REDIRECIONAMENTOS` em `ui/shell.js`).
- Celular: alvos de toque de 44px, campos de 16px (sem zoom), abas rolam de lado.
- **Bug grave corrigido:** `ligarDicaDeData` (Sprint 30) regravava o texto da
  dica a cada mutação e travava a página ao abrir qualquer formulário com data.
  Agora só escreve quando o texto muda.

### Sprint 33 — "Recebi" e "Paguei" em um toque — ✅ (02/10/2026)

- `dados/baixaRepo.js`: `darBaixaTransacao` (previsto/atrasado vira pago, data real
  = hoje se a data estava no futuro) e `darBaixaEvento` (renda esperada, parcela de
  dívida ou recorrência sem lançamento viram lançamento real; parcela de dívida
  também soma `parcelasPagas`). Nada é digitado: conta, categoria e pessoa vêm do
  cadastro.
- Botão na lista de Transações e no detalhe do dia da Agenda.
- Dia típico de cada fonte de renda (`diaDaFonte`): com 3+ recebimentos reais, a
  mediana dos últimos 3 vale mais que o dia cadastrado. 3 testes novos (370).

### Sprint 34 — Início novo — ✅ (02/10/2026)

- Uma pergunta: "Pode gastar até DD/MM: R$ X", com selo de confiança (● alta,
  ◐ média, ○ baixa) calculado de quanto do dinheiro que vai entrar ainda é só
  esperado (`domain/inicio.js` → `confiancaDoNumero`).
- Um único ponto de atenção (o achado mais urgente, com link para o Plano),
  "Próximos 7 dias" (atrasados primeiro) e "Completar seu retrato" (pessoa sem
  renda/conta, sem bens, sem metas, dívida sem parcela).
- Removidos: grade de 7 cartões, carrossel e atalhos redondos. Duas colunas no
  desktop. `dados/inicioRepo.js` lê tudo do retrato único (`dados/base.js`).
- 5 testes novos em `inicio.test.js` (375 no total).

### Sprint 35 — Plano reconstruído (Visão geral) — ✅ (02/10/2026)

- Visão geral do Plano: "Onde você está" (conta, renda recebida + esperada,
  gastos, parcelas, sobra/falta), "Pra onde você vai" (3, 6 e 12 meses, só
  renda confirmada/provável) e "3 coisas que mudam o jogo" (alavancas com
  premissa e base do cálculo; `domain/planoGeral.js`, `dados/planoGeralRepo.js`).
- Revisões agrupadas por tipo: 18 "novo compromisso recorrente" viram uma linha
  com "Ver todos" (resolve o achado da rodada 2 da auditoria).
- Duas colunas no desktop. "Prazo", "Diagnóstico completo", "Qualidade dos
  dados" e histórico seguem recolhidos abaixo.
- 5 testes novos em `planoGeral.test.js` (380 no total).

### Sprint 36 — Metas plausíveis — ✅ (02/10/2026)

- "Quero chegar em… dá?" (`simularMetaReversa`): valor + prazo → "Dá, com folga de
  R$X" ou "Não dá, faltam R$X por mês", mais o prazo em que a sobra de hoje chega
  lá e o quanto dá pra juntar no prazo. Simulação, não grava nada.
- Uma sobra só: `sobraDoMes` (`domain/mes.js`) alimenta Plano e Metas. Antes a
  tela de Metas usava uma "margem" só com o essencial e mostrava um número
  diferente do Plano.
- Patrimônio e Objetivos viraram uma tela, "Patrimônio & Metas", dentro do Plano.
- 4 testes novos (384 no total).

### Sprint 37 — Dívidas e patrimônio reais — ✅ (02/10/2026)

- Dívidas em duas listas: "Com acordo, andando" e "Negativadas ou sem acordo",
  cada uma com o total que pesa (`separarDividas`, `domain/bens.js`; hook
  `secoes` em `telaCadastro.js`).
- Bem líquido da própria dívida: ativo ganhou `dividaId` (Jeep: vale X, deve Y,
  líquido Z). O patrimônio total continua descontando a dívida uma vez só.
- Custos ligados ao bem: recorrência ganhou `ativoId` ("Bem ligado"); o bem
  mostra o custo mensal (galpão: aluguel, água, luz...).
- Aviso "Patrimônio incompleto" quando há dívida sem nenhum bem do outro lado,
  bem sem valor ou avaliação com mais de 1 ano.
- 4 testes novos em `bens.test.js` (388 no total).

### Sprint 38 — Extrato e conciliação — ✅ (02/10/2026)

- `conciliarComPrevistos` (`domain/importacao.js`): a linha do extrato casa com o
  compromisso previsto que ela confirma (mesma conta e tipo; nome parecido, ou
  valor a até 5% e data a até 5 dias). Ao confirmar, o previsto é baixado com o
  valor e a data reais em vez de criar um segundo lançamento (antes o mês
  contava o mesmo gasto duas vezes). Previsto em aberto deixou de ser tratado
  como "duplicata". A tela deixa desmarcar.
- Histórico de importações único: lotes de extrato e envios do chat aparecem na
  mesma lista, com o texto original.
- Cartão sem compra nem fatura mostra "sem dado de uso ainda", não "0% usado".
- 3 testes novos (391 no total).

### Sprint 39 — Acabamento e reauditoria final — ✅ (02/10/2026)

- Fechou os itens que sobravam da Lista Mestra: #6/#7 (explicação dos números
  e rótulos distintos), #13 (metas de proteção no "Completar seu retrato"),
  #18 (lista por prazo agrupada), #21 (etiqueta "ativa" removida).
- `semDia` aplicado no banco real (4 recorrências e 12 previstos).
- Auditoria final completa em `docs/AUDITORIA-FINAL.md`: 21/21 itens resolvidos,
  66 verificações automáticas em celular e desktop, 392 testes do motor.

### Fase 14 (restante) — Fechamento mensal (§21) — ✅ (02/10/2026)

- Aba Plano › Fechamento: entrou (recebido), saiu (pago), resultado, comparação
  com o mês anterior, o que ficou aberto (fora do resultado), maiores mudanças
  nos gastos por categoria, dívida e patrimônio do mês (retrato guardado),
  decisões tomadas no mês e os últimos 6 meses lado a lado. Só leitura.
- `domain/fechamento.js` (puro), `dados/fechamentoRepo.js`, `ui/telas/fechamento.js`.
  Mês sem dado anterior não inventa variação. 3 testes novos (395 no total).
- Fase 14 completa (cenários na Sprint 19-21, fechamento agora).

### Fase 15 — Qualidade de vida (§27) — ✅ parcial (02/10/2026)

- Busca global (lupa no topo): transações, dívidas, recorrências, fontes de renda,
  bens, cartões e contas; leva à tela certa (`domain/busca.js`, `ui/buscaGlobal.js`).
- Transações: busca por descrição, valor ou data e filtros por pessoa, conta,
  cartão, categoria, situação e período; com filtro, procura em todo o histórico.
- Configurações › Dados: exportação completa (JSON, 14 coleções) e dos lançamentos
  (CSV para planilha), com Copiar e Baixar; atividade recente derivada de
  `criadoEm/atualizadoEm` (nada gravado a mais).
- Ainda aberto: comprovantes anexados (depende de a capability de arquivos do
  artefato) e histórico detalhado campo a campo.
- 5 testes novos (400 no total).

### Fase 13 — Assistente de IA (§20) — ✅ (02/10/2026)

- Plano › Perguntar: conversa em português simples sobre o dinheiro da casa, via
  capability `sample` (roda no claude.ai do próprio usuário, sem backend).
- A IA só lê: nenhuma ferramenta de gravação está ligada a ela. Recebe um retrato
  calculado na hora (caixa, mês, 3/6/12 meses, alavancas, renda, dívidas, bens,
  fechamento, alertas) em que cada linha traz a fonte; as instruções proíbem
  inventar número, tratam renda esperada como não garantida, não recomendam
  produto financeiro e exigem a linha "Baseado em:". A tela mostra, recolhido,
  exatamente o que vai junto (`domain/ia.js`, `dados/iaRepo.js`).
- 3 testes novos (404 no total). O link do painel foi restringido pelo Cleison
  antes de habilitar a capability.

### Correção de cadastro (02/10/2026)

Conferência da planilha "Possíveis lançamentos" e das mensagens contra o banco:
faltavam Del Poente (R$ 5.000 em 05/10), cartão Crédito Shoppe (limite R$ 4.000),
Fórmula do Caio (R$ 300/mês), Anúncios do Gedi (R$ 1.000/mês) e as faturas
Nubank (PJ OUT R$ 2.297,10, PF OUT R$ 241,10, PJ NOV previsto R$ 1.196,70).
Subidos pelo chat. Fonte de renda ganhou `fim` ("só até dezembro" do Gedi/Tony).
- Também corrigido no cadastro: Sociable (R$ 5.200) e CryptoPag (R$ 2.500) de
  outubro, marcados "RECEBIDO" na planilha, entram como receita paga em 01/10
  (já estão dentro do saldo de 01/10, então não mexem no saldo) e deixam de ser
  contados de novo em "Vai entrar". "Pode gastar até" passou de R$ 6.432 para
  R$ 2.992 por causa disso e das faturas do Nubank.
- Ajuste do Cleison: CryptoPag caiu no Nubank e Sociable no Next. Fonte de renda
  ganhou `contaId` ("Conta onde cai"): o "Recebi" lança na conta certa. Receita de
  outubro do CryptoPag movida para o Nubank.

### Correção: tela preta ao abrir (02/10/2026)

- Causa provável: a rede de segurança do `index.html` cobria TODA a tela com a
  mensagem de erro em qualquer erro solto ou promessa rejeitada, mesmo com o
  painel já aberto; e o painel fazia ~200 leituras do banco só para abrir
  (cada tela relia as 13 coleções), o que num limite de requisições vira
  rejeição solta. Agora: (1) depois de aberto, erro solto vira só um aviso
  pequeno ("Recarregar"/"Fechar") e o painel continua mexível; antes de abrir,
  a tela de erro tem o botão "Tentar de novo"; (2) cache de leitura em `db.js`
  (leituras simultâneas viram uma, assinaturas mantêm o cache fresco): 196 → 10
  leituras; (3) `assinarBase` não deixa falha de leitura escapar;
  (4) retrato mensal do patrimônio com id fixo por mês (antes criava cópias).

### Correção: painel em branco (só o logo) — 02/10/2026

- Causa real: `src/ui/navegacao.js` (criado na Sprint 30 e importado pelo
  `shell.js`) nunca foi publicado. Sem ele o módulo principal falha ao carregar
  e a página fica só com o cabeçalho, sem nenhuma mensagem. Vinha quebrado desde
  a Sprint 32. Publicado; a lista de arquivos publicados (95) agora bate com o
  repositório.
- Prevenção: `testes/publicacao.test.js` falha se algum import relativo ou
  `src`/`href` do `index.html` apontar para arquivo inexistente (406 testes).
  Ao republicar, conferir a lista de arquivos publicados contra `find src estilo`.

## Rodada 4 — pente fino (Sprints 40 a 47)

### Sprint 40: financiamento em dia não é dívida — 02/10/2026

- Pedido do Cleison: o Jeep Compass (parcelado, pago em dia) aparecia como uma
  dívida vermelha de R$135.971; pra ele é um bem que está sendo pago, e dívida
  é o que está atrasado e suja o nome.
- `classificarDivida` (`domain/dividas.js`): "financiamento" (parcelado, com
  acordo, em dia, sem nome sujo), "divida" (atrasada, negativada, sem acordo ou
  em risco) ou "quitada". Campo `tipo` no cadastro força um lado, mas atraso e
  nome sujo sempre viram dívida.
- `calcularVisaoConsolidada` ganhou saldo/parcelas/quantidade separados por
  grupo. A tela Dívidas mostra "Dívidas pra resolver" (vazia = "Nome limpo") e
  "Financiamentos em dia" (parcela por mês, parcelas que faltam, quando quita,
  etiqueta verde "em dia").
- Patrimônio: o Jeep mostra valor, parcelas que faltam e quando quita; o hero
  só fica vermelho se o negativo vem de dívida de verdade; o sinal "dívida
  caiu" passou a olhar só dívida de verdade; retratos zerados antigos não
  entram mais na variação.
- Alerta `divida_aumentou` só conta dívida de verdade (retrato antigo sem esse
  recorte não gera alerta). "Renegociar parcela" não sugere mais financiamento
  em dia. Por pessoa e IA separam os dois grupos.
- Testes: bens (classificação, visão consolidada, leitura do bem), patrimônio
  (variação de dívidas), decisões. 410 passando.

### Sprint 41: contas com estado visual (Dinheiro › A pagar) — 02/10/2026

- Pedido do Cleison: conta paga, conta a pagar e conta atrasada não podem ter o
  mesmo peso visual; sensação de aplicativo, nível intermediário.
- `domain/contasDoMes.js`: cada conta do mês (lançamento previsto, parcela de
  dívida, recorrência, fatura) com estado `atrasada | hoje | a_pagar | paga`,
  dias de atraso e progresso (pago/total, calculado na leitura). Compra no
  cartão não é conta (entra pela fatura). Conta atrasada de mês anterior
  aparece no mês atual; conta de setembro paga hoje conta como paga em outubro
  (campo `pagoEm`).
- Tela "A pagar" (primeira aba de Dinheiro): barra de progresso do mês,
  grupos Atrasadas (vermelho, pesa mais), Vencem hoje (âmbar), A pagar (por
  semana) e Pagas (recolhido, esmaecido, com ✓). "Paguei" em um toque com aviso
  curto e **Desfazer**; menu ⋯ com "Paguei outro valor" e "Abrir o cadastro".
- `baixaRepo`: baixa devolve como desfazer; nova baixa de fatura (conta de
  pagamento do cartão, sem virar despesa nova); `desfazerBaixa` apaga o
  lançamento criado, restaura o anterior, devolve a parcela da dívida e reabre
  a fatura. Schema: `foiPrevisto`, `pagoEm`. `base.js` passou a trazer o `id`
  das transações.
- Testes: `contasDoMes.test.js` (estados, progresso, cartão x fatura, atraso
  herdado, parcela de dívida, verba sem dia, paga em outro mês). 418 passando.

### Sprint 42: mapa dos próximos 12 meses e o que vem em dezembro — 02/10/2026

- Pedido do Cleison: o aluguel (R$ 2.900, dia 2, a partir de dezembro) precisa
  caber na renda "sem me afogar".
- `domain/mapa12.js`: mês a mês, quanto entra e sai de dinheiro seguro
  (confirmado + provável, nunca o incerto), a sobra e o saldo em conta no fim
  do mês. Sai do mesmo motor diário da projeção, cortado por mês (sem conta
  própria). `marcosDosProximosMeses`: aluguel que começa, renda que acaba
  (fonte com `fim`), recorrência que termina, parcela que quita.
  `acharBuraco`: mês em que a sobra despenca e passa a ser negativa, ponto
  mais baixo do saldo e quanto falta (por mês e no total). O mês corrente
  (só o resto) nunca conta como virada.
- Plano › Visão geral › "Pra onde você vai": cartão "O que vem aí, e cabe"
  (ou "muda o jogo" com o buraco, três jeitos de fechar e link pro cadastro
  de origem, §17) e a lista mês a mês com barra de sobra e marcos.
- Com os dados reais de hoje: dezembro fecha com +R$ 4.167 mesmo com o aluguel;
  janeiro (Gedi/Tony deixa de pagar, custos do Gedi terminam) com +R$ 3.167.
  Aviso explícito: ainda não há histórico de gasto do dia a dia (mercado,
  lazer), então os meses de frente estão mais folgados do que a vida real.
- Testes: `mapa12.test.js` (7). 425 passando.

### Sprint 43: um número por pergunta, sem jargão — 02/10/2026

- Renda reescrita em português de gente: "Dá pra pagar o mês?" (no lugar de
  "Os três gaps"), "Pra onde vai o dinheiro", "Gastos que dá pra cortar",
  "Gastos fixos", "Gastos fora do normal", "Gastos que só sobem". "Margem" saiu
  da tela: a Renda passou a mostrar a mesma **Sobra do mês** do Início e do
  Plano. Por pessoa e Casa também: "Sobra do mês" (renda menos todos os gastos
  e parcelas); a conta de "quem cobre o essencial" ficou separada, com
  explicação.
- Botão "i" com explicação curta (`ajudaHtml`) em Pode gastar até, Sobra do
  mês e Dá pra pagar o mês. Linhas zeradas sem sentido (fixos/fora do normal
  quando nada foi pago ainda) deixam de aparecer.
- `testes/linguagem.test.js`: falha se qualquer tela mostrar margem, gap,
  discricionário, extraordinário, passivo, snapshot, comprometimento ou
  competência. 426 passando.

### Sprint 44: menos ruído nos alertas — 02/10/2026

- "Revisar" no Plano caiu de 24 pontos para os que pedem ação de verdade:
  - "22 compromissos recorrentes novos": recorrência cadastrada pelo próprio
    usuário (à mão ou pelo chat) não é novidade; só avisa o que apareceu por
    importação ou detecção.
  - "Sobra dinheiro mesmo no dia mais apertado" saiu: já é o número grande do
    Início.
  - Cartão no limite/perto do limite passou a urgência média (não "urgente").
  - "Dívidas aumentaram" só conta dívida de verdade (Sprint 40).
- Início ganhou "Contas de outubro" (progresso e atrasadas, com atalho pra dar
  baixa) e o saldo previsto virou uma linha com explicação em vez de um
  parágrafo.
- Plano passou de 6 para 4 abas: Fechamento virou um card na Visão geral e
  Perguntar virou botão flutuante.
- Testes ajustados (anomalias, decisões, casal). 426 passando.

### Sprint 45: A receber e polimento mobile/desktop — 02/10/2026

- Dinheiro › A pagar ganhou o outro lado: **A receber** (seletor no topo). Mesmos
  estados (caiu, cai hoje, a receber, "ainda não caiu" quando passou do dia
  esperado), barra de progresso e **Recebi** em um toque com Desfazer. Entrada
  incerta aparece tracejada e nunca entra nos totais. `entradasDoMes`
  (`domain/contasDoMes.js`) + 3 testes.
- Abas que não cabem na tela mostram esmaecido na borda e rolam até a aba
  ativa; botões e chips com alvo de toque de 44px em tela de toque.
- Início: verba "sem dia fixo" aparece como "no mês" (e por último), não como
  uma data que já passou.
- Fora do pacote por decisão: campo de data em dd/mm/aaaa. O navegador mostra
  o formato do aparelho; a data por extenso aparece embaixo de todo campo de
  data pra nunca haver dúvida. 430 testes passando.

### Sprint 46: fatura em resumo x compras, IA com o mapa, checklist de publicação — 02/10/2026

- Fatura lançada em resumo ("Compras até o fechamento…") + compras detalhadas
  da mesma fatura contam o mesmo dinheiro duas vezes. `faturasContadasEmDobro`
  (`domain/cartoes.js`) detecta; Dinheiro › Cartões mostra o aviso e o botão
  **Cancelar o resumo** (cancelar, não apagar: dá pra reverter); Plano ›
  Qualidade dos dados também avisa. Nada é decidido sozinho.
- IA: o retrato agora inclui o mapa dos próximos 12 meses (sobra, saldo e
  marcos como o aluguel de dezembro) e as contas do mês (atrasadas); o prompt
  tem teto de 12.000 caracteres, com aviso de corte pra IA dizer "não tenho
  esse dado". O teste real com a IA do claude.ai só pode ser feito pelo
  usuário abrindo o painel (a capacidade `sample` não existe fora dele): fica
  como validação pendente do dono.
- `ferramentas/arquivos-para-publicar.js` + `docs/PUBLICACAO.md`: lista o que
  publicar (tudo ou só o que mudou) e confere a lista publicada contra o
  repositório, pra não repetir o arquivo esquecido de 02/10. 434 testes.

### Sprint 47: reauditoria final — 02/10/2026

- 15 telas, celular (390) e desktop (1280), com os dados reais: nenhum erro de
  console nem de página. Conferido: Início, Dinheiro (A pagar/A receber,
  Transações, Agenda, Renda, Recorrências, Contas, Cartões, Importar), Dívidas,
  Plano (Visão geral, Por pessoa, Caminhos, Patrimônio & Metas, Perguntar).
- Achado e corrigido na reauditoria: a aba Caminhos usava como "histórico" um
  mês sem nenhuma renda lançada (setembro, só fatura em resumo) e concluía
  "sobra por mês −R$ 5.854; Jeep fica sem pagar por 23 meses", contradizendo o
  resto do painel. Mês sem renda lançada não é mês fechado: a base passou a
  ser o mês corrente projetado, e "Seguir como está" agora mostra a mesma sobra
  do Início e do Plano (+R$ 3.750). 435 testes.
- Em aberto, de propósito (dependem do dono): teste real da IA (`sample`) no
  claude.ai; investimentos, galpão e dívidas do Serasa (dados que ainda não
  chegaram); custos do Gedi depois de dezembro (hoje contam como terminando);
  extrato do Nubank pra trocar o lançamento resumido da fatura pelas compras;
  campo de data em dd/mm/aaaa (limite do navegador).
- Caminhos: o cenário "Conservador" (só renda garantida) ainda pode avisar que
  o Jeep fica sem pagar: é um teste de estresse, não o caso base, mas vale
  rever se deve vir marcado como "sugerido".

## Rodada 6 — plano da auditoria (Sprints 48 a 55)

### Sprint 48: o número certo — 02/10/2026

- **Saldo pela data real.** `calcularSaldoConta` usa `pagoEm` (o dia em que o
  dinheiro saiu/entrou), não o vencimento. Pagar hoje a Luz que venceu em
  23/09 agora derruba o saldo em R$ 156,79 (antes não mexia e o "pode gastar"
  subia).
- **Uma trilha só no Início.** "Vai sair", "Vai entrar", saldo previsto e "pode
  gastar" saem dos mesmos itens (antes "vai sair" somava uma lista e o "pode
  gastar" caminhava outra). A trilha descartava despesa de data passada que não
  era atrasada: as verbas de 01/10 (R$ 2.435,00) sumiam. Hoje: verba do mês
  corrente pesa hoje por inteiro; a de mês futuro é repartida em semanas.
  Resultado nos dados reais: pode gastar R$ 430,37 (era R$ 2.865,37).
- **Dois bugs de fuso horário** (aparecem só no horário de Brasília):
  `competenciaDeData("2026-10-01")` devolvia 2026-09 e `formatarData` mostrava
  todo dia um dia antes (23/09 virava 22/09). Corrigidos; a suíte agora roda
  também com `TZ=America/Sao_Paulo`. Datas "de hoje" usam o relógio local.
- Início: conta atrasada mostra "venceu dd/mm".
- Testes: `numeroCerto.test.js`. 443 passando (nos dois fusos).

### Sprint 49: Paguei/Recebi perguntam de onde, conferir saldo, Lançar concilia — 02/10/2026

- **Folha de pagamento** (`ui/folhaDePagamento.js`, `ui/baixaUI.js`): todo Paguei
  e Recebi (A pagar, A receber, Transações, Calendário) pergunta o valor, **de
  onde saiu** (cada conta com o saldo de agora, cada cartão com o limite livre)
  ou **em qual conta caiu**, e quando (hoje, ontem, outro dia). Mostra o efeito
  antes de confirmar ("Nubank: R$ 3.002 → R$ 2.845"). Pagamento parcial deixa o
  resto como conta a pagar. Pagar no cartão vira compra da fatura certa.
  Desfazer devolve tudo, inclusive o resto.
- **`baixaRepo`** aceita `contaId`, `cartaoId`, `dataPagamento`; o saldo da conta
  escolhida muda na hora. Testado na camada de dados (`baixaRepo.test.js`).
- **Conferir saldo** (Dinheiro › Contas › Conferir): o painel passa a contar do
  saldo informado, guarda a diferença (`conferencias`) e, no mesmo dia, ainda
  conta o que for lançado depois da conferência. Contas agora mostram o saldo de
  agora (antes mostravam o saldo inicial).
  Com os dados reais: Next calculado R$ 5.829,07, informado R$ 5.829,33 → +R$ 0,26.
- **Lançar concilia** (`domain/conciliacao.js`): ao lançar um pagamento, o painel
  procura a conta aberta parecida ("Vivo SET" x "Vivo 10/10") e pergunta se é
  ela; sim dá baixa nela, em vez de duplicar.
- 450 testes passando (nos dois fusos).

## Sprint 50 — linha do tempo única
- `contasDoMes` (itens abertos de A pagar) passa a sair da mesma linha do tempo (`compromissosPorDia` + `eventosFuturos`) usada pelo Início e pelo Plano; verba do mês volta a ser um item só; conta sem conta de saída continua aparecendo.
- Itens da linha do tempo carregam ids de origem (transação, conta, categoria, fatura, cartão).
- Testes de invariantes: A pagar aberto == saídas da linha do tempo; parcela atrasada pesa uma vez com o vencimento original. 452 testes nos dois fusos.

## Sprint 51 — cartão e pedalada
- `diaPagamentoHabitual` no cartão: a fatura pesa no caixa no dia em que você costuma pagar (entre fechamento e vencimento); o vencimento real continua visível (`dataPagamentoPrevisto`).
- Limite livre informado (valor + dia em que foi visto): só compras posteriores o reduzem. "Compras previstas" não gastam limite.
- `cabeNoCartao` (limite + saldo da conta que paga). A folha Paguei mostra de qual conta a fatura sai, quando, e se o saldo cobre.
- Campos novos na tela Cartões. 457 testes nos dois fusos.
- Pendente do sprint: Shopee Carolina e Morelli no cartão serão cadastrados no Sprint 55 (dados).

## Sprint 52 — verbas consumíveis
- Lançar um gasto (na conta ou no cartão) que combina com uma verba do mês (nome ou categoria) pergunta se desconta dela; a verba fica com o resto, sem dia, e Desfazer restaura.
- A pagar mostra "verba do mês: gastou X de Y". Teste de camada de dados e de motor. 459 testes nos dois fusos.
- Os valores das verbas (mercado, lazer, almoço, combustível, anúncios, galão, café, fórmula do Caio) entram no Sprint 55.

## Sprint 53 — dívidas com esteira, Jeep, centros
- `domain/esteira.js`: oferta (de/por, desconto, economia, validade sem inventar prazo), placar "nome limpo X de N" (protesto que é a mesma dívida não conta duas vezes), acordo da oferta em parcelas, barra do financiamento (pagas/total, já pago, falta pagar, marcos, valor do bem com aviso de avaliação velha), gasto por centro (casa, negócio, galpão).
- Dívida sem acordo pesa pelo valor cobrado com juros em todas as telas (Bradesco R$ 10.064,16, não R$ 5.546,04).
- Tela Dívidas: placar, tag "oferta −64%", bloco com valor de origem, cobrado, oferta, economia e validade; Jeep com barra, já pago e falta pagar. Campos novos: valor com juros, oferta, protesto, CNPJ, cartório, o que trava.
- Campo `centro` nas transações e dívidas (preenchido no Sprint 55; a leitura por centro entra nas telas do Sprint 54). 466 testes nos dois fusos.

## Sprint 54 — Início com "até o dinheiro entrar"
- Caixa devolve `proximaEntrada` (primeira entrada não incerta depois de hoje), `seguroAteAProximaEntradaCentavos` (menor saldo antes dela) e `primeiroBuraco` (primeiro dia negativo com as contas que pesam nele). Mesma trilha do restante, sem lista paralela.
- Início: bloco "Até o dinheiro entrar" com o quanto dá pra gastar até a próxima entrada certa e "o que quebra". 469 testes nos dois fusos.
- Decidido não fazer agora: reagrupar Dinheiro em 3 abas (risco alto, ganho baixo diante do problema real, que era dado incoerente) e a ponte "sobra do mês x caixa" (o mapa de 12 meses do Plano já cobre o caminho mês a mês).

## Sprint 55 — dados cadastrados e reauditoria (02/10/2026)
Subido pelo chat (lote nwm5rxt5f20rhynoa4cs, desfaz com "desfaz o último envio"):
- Next conferido em R$ 5.829,33 (hoje); conta da Carolina criada; salário dela cai nela e a fatura Shopee sai dela (o repasse ao Next não precisa de valor: transferência não muda o total da casa).
- Shopee R$ 650 virou compra na fatura do cartão da Carolina (vence 10/10); o lançamento antigo foi cancelado, não apagado.
- Verbas: Mercado R$ 1.000 (o "Compra Supermercado" de outubro virou verba; a cópia nova de outubro foi cancelada) e Lazer R$ 500.
- Del Poente R$ 5.000 (05/10) agora confirmado. Morelli R$ 600 no centro Galpão.
- Jeep Compass Longitude T270 1.3 Turbo Flex; Galpão como bem (R$ 450 mil estimado, custou R$ 150 mil).
- Dívidas: EDP ×3 (nov/dez/jan; a de nov também tem protesto), Bradesco (de R$ 10.064,16 por R$ 3.522,46, −64%), Mercado Pago (R$ 12.857,70 por R$ 3.214,42, −75%), protestos de R$ 3.473,75, R$ 1.164,98 e R$ 288,36, água do galpão (~R$ 1.000). Placar: nome limpo 0 de 8.
Reauditoria com o banco real: Em conta R$ 8.831,61; "o que quebra" mostra 04/10 faltando R$ 69,37 (Jeep vence um dia antes do Del Poente cair), por conta das 3 atrasadas e das camisetas de R$ 1.400. Início e A pagar batem; o Início olha 30 dias e A pagar olha o mês, por isso os totais diferem.
Pendente: validade das ofertas (não informada, ficou "sem prazo informado"), valor do repasse da Carolina, custos/aluguel do galpão (ele disse que atualiza depois), FIPE mensal.

## Sprints 56 a 60: do painel de dados ao painel de situação (Rodada 7)
- S56 `domain/situacao.js`: na conta, o que já tem dono até a próxima entrada (por grupo), livre garantido (só confirmado) e livre com o provável (incerto fora dos dois), zona (cortes explícitos: negativo ou abaixo de meio mês de obrigações = risco; até um mês = apertado) e a próxima decisão em uma frase. `calcularClarezaDeCaixa` ganhou `soConfirmado` e devolve `pontos`.
- S57 `domain/prioridade.js`: peso por consequência real (atraso, cartão, parcela, essencial, dívida em risco, trava, vence em até 3 dias, valor); assinatura e verba pesam menos. `oQuePesa` devolve no máximo 3.
- S58 `domain/cartaoNoCaixa.js`: por cartão, limite livre, fatura, dia em que sai da conta, se o caixa cobre e quanto cabe agora (o menor entre o limite e a folga do caixa no dia da fatura). Limite nunca soma ao saldo.
- S59 `domain/simularGasto.js`: veredito cabe, cabe no cartão, adiar até dd/mm ou não cabe. Não escreve nada.
- S60 Início: zona e frase de decisão, os quatro números, "o que pesa agora", cartões, "Posso gastar?" e os alertas do Plano viram atalho quando já há "o que pesa". Testes de motor: 486 nos dois fusos.
Decisões padrão usadas (a confirmar com o Cleison): cortes da zona 0,5 e 1 mês de obrigações; verbas de anúncios e Morelli não foram movidas para o cartão.

## Sprint 61: evolução
- `domain/evolucao.js`: série dos últimos 6 meses (contas pagas com atraso, resultado, pior momento do caixa, dívida total, patrimônio líquido) e tendência (melhorando, estável, piorando, sem dados) comparando os dois últimos meses fechados. Mês sem dado fica "sem dado". Indicador de bola de neve (tendência piorando com parcelas ≥ 40% da renda do último mês ou dívida sem acordo).
- `dados/evolucaoRepo.js`: guarda o instantâneo do caixa do mês (`instantaneosCaixa`, um documento por competência, pior momento e máximo de atrasadas) quando o Início é calculado.
- Plano ganhou a aba Evolução. 490 testes nos dois fusos.

## Sprint 62: reauditoria da Rodada 7 (03/10/2026, banco real, celular e desktop)
As 12 perguntas e onde cada uma é respondida hoje:
| Pergunta | Onde |
|---|---|
| Como estou hoje? | Início: zona (hoje, Zona de risco) e a frase de decisão |
| Quanto tenho disponível? | Início: Livre garantido e Livre com o provável |
| Quanto preciso guardar? | Início: "Já tem dono" por grupo |
| Quanto posso gastar? | Início: número do topo e "Posso gastar?" |
| O que vai sair? | Início: "O que pesa agora" e Próximos 7 dias |
| Quando entra dinheiro? | Início: "até a próxima entrada" (Del Poente, 05/10) |
| Momento mais apertado? | Início: frase de decisão e Evolução (pior momento) |
| Posso usar o cartão? | Início: Cartões (quanto cabe agora) e "Posso gastar?" |
| Quanto da próxima fatura? | Início: Cartões |
| Bola de neve? | Plano › Evolução |
| O que precisa de atenção? | Início: "O que pesa agora" |
| Saindo do buraco? | Plano › Evolução (precisa de dois meses fechados com dados) |
Resultado com os dados reais: Em conta R$ 8.831,61, 04/10 faltam R$ 69,37 antes do Del Poente, zona de risco, e com "Posso gastar?" R$ 1.000 o painel diz que na conta não cabe e no Nubank PJ cabe. Sem erros de página, celular e desktop.
Limites conhecidos: a Evolução só compara com dois meses fechados com movimento; o pior momento do caixa só existe a partir de 03/10 (quando o painel começou a guardar). Verbas de anúncios e Morelli continuam fora do cartão.

## Rodada 8: auditoria funcional ação por ação (03/10/2026)
Método: com o banco real carregado num navegador (celular), cada ação do usuário foi feita pela tela e os números de Início, A pagar, Contas e Agenda foram comparados antes e depois (modo local e modo `db` simulado, com leituras assíncronas).
Funcionam e propagam certo: Paguei (A pagar e Transações), Recebi, Paguei a parcela do Jeep (parcela paga, contagem de parcelas, saldo), pagar fatura, lançar gasto pago e previsto, transferência, conferir saldo, cancelar conta.
Quebras encontradas e corrigidas:
1. **Editar > Situação "Pago" não descontava do saldo.** A conta sumia dos compromissos e o saldo não mexia: o "pode gastar" subia o valor da conta (R$ 1.400 de dinheiro que não existia) e a conta não contava como paga. Agora marcar Pago pela edição abre a pergunta "de onde saiu" e dá baixa como o Paguei. Também pegou um erro de leitura do formulário depois de fechado.
2. **Conta padrão do Lançar** vinha a primeira por ordem alfabética (Conta da Carolina) e o gasto caía na conta errada sem aviso. Agora vem a mais usada.
3. **Gasto pago com data até o dia do saldo conferido** não muda o saldo (o saldo já inclui). Sem aviso, parecia que "não mudou nada". Agora o aviso aparece ao lançar.
4. **"✓ Conferido"** parecia "tá ok" e não muda número nenhum. Virou "✓ Dados certos", com texto e aviso dizendo que para dar baixa é Paguei ou Recebi.
5. **Zona de risco com número positivo** confundia. O Início agora diz o pior dia dos próximos 30 dias e o valor do caixa nele (e, se difere, o valor só com o confirmado).
Pendências conhecidas: Paguei em compra planejada de cartão ("Compras previstas") e a mensagem da aba Renda ("Há déficit" com "o mês fecha no papel") ainda se contradizem; "Sobra no mês" (Plano) e "resto de outubro" usam bases diferentes e precisam de uma ponte escrita; contas Nubank e Next têm datas de saldo diferentes.

## Modo app no celular (03/10/2026)
- `estilo/app-mobile.css` (até 860px): barra do topo fixa com vidro e área segura, abas do módulo coladas sob o topo (rolam de lado, com encaixe), navegação de baixo com vidro e marcador da aba ativa, folhas que sobem de baixo com alça e botões fixos no rodapé, alvos de toque de 44 a 48px, campos de 16px (sem zoom do iPhone), toque com resposta (encolhe ao apertar), entrada suave de tela, aviso e botão flutuante acima da navegação.
- Corrigido: o Início passava da largura da tela (430px em 390px) por causa de uma coluna de grade sem limite; Receita/Despesa eram bolinhas soltas sem estilo e agora são um controle segmentado; título repetido dentro de cada aba some no celular.
- `index.html`: viewport com `viewport-fit=cover`, `theme-color` e metas de aplicativo (tela cheia ao "Adicionar à tela de início").
- Medido em 390px e 360px com o banco real: nenhuma tela com rolagem lateral, nenhum botão abaixo de 36px, nenhum campo abaixo de 16px.

## Rodada 9a: valor real da dívida (03/10/2026)
- Dívida com oferta de desconto vigente vale a oferta, em todas as telas (Bradesco R$ 3.522,46, não R$ 10.064,16; Mercado Pago R$ 3.214,42). O valor cobrado e a economia aparecem ao lado ("de R$ 10.064,16 por R$ 3.522,46, economiza R$ 6.541,70"). Oferta com validade vencida volta ao valor cobrado. `calcularSaldoAtual` é a única regra.
- "Fechei esse acordo": a oferta vira dívida com parcelas (à vista ou em N vezes) e passa a aparecer em A pagar; o valor antigo fica guardado em `acordoDe`.
- Financiamento (Jeep): a linha mostra "19 de 60 parcelas pagas, próxima: parcela 20, dia 04/10", barra de evolução com "Já pago R$ 63.011,03" e "Falta R$ 135.971,17", e o botão "Paguei a parcela 20" abre a pergunta de onde saiu e dá baixa (parcela vira 20 de 60).
- Folha Paguei: se a data escolhida é igual ou anterior ao dia em que o saldo da conta foi conferido, ela diz que o saldo já considera o pagamento.

## Rodada 9b: aba Relatórios (03/10/2026)
Auditoria do que vale graficar (e onde): o que o Cleison pediu foi "pra onde o dinheiro está indo". Ficou no Plano, como aba nova, porque é leitura e análise, não lançamento; a navegação de baixo continua com 4 itens.
- Pra onde vai o dinheiro do mês: rosca por grupo (parte do todo) e barras por categoria em dois tons (já pago x ainda a pagar), mais os 5 maiores gastos. Navega por mês.
- Entra e sai nos próximos 12 meses: colunas de entra e sai e a linha do saldo (uma escala só, em reais), do mesmo cálculo do Plano.
- Gastos que passam batido: assinaturas e pequenos fixos, por mês e por ano.
- Cartões: fatura em aberto, dia em que sai da conta e limite livre.
- Quanto você deve de verdade: dívidas pelo valor real (com o desconto das ofertas) e a economia.
- Toda figura tem legenda, valores à vista e "Ver em tabela". Paleta categórica de 8 posições, claro e escuro. Sem biblioteca: HTML e SVG.
- Novo grupo de categoria "Negócio" (Equipe e freelancers, Ferramentas de trabalho e Escritório passam para ele), senão 46% do mês aparecia como "Outros".
- Motor: `domain/relatorios.js` (gastosDoMes, vazamentos, composicaoDeDividas, serieMensal), 4 testes. 495 testes nos dois fusos.
