# Rastreabilidade — blueprint item a item

Garantia de que nada do blueprint ficou de fora. As 31 seções, com cada
exigência, a fase que a entrega e o estado.

Estado: `○` não iniciado · `◐` em andamento · `●` entregue

| # | Seção | Prio | Fase | Estado |
|---|---|---|---|---|
| 1 | Visão do produto — centro de comando, não registro de gastos | P0 | princípio de todas | ○ |
| 2 | Hierarquia de prioridade + regra de escopo | — | lei do plano (D7) | ● |
| 3 | Núcleo de dados financeiros | P0 | F0, F1 | ○ |
| 4 | Dinheiro: presente, comprometido e seguro | P0 | F2 | ○ |
| 5 | Cartões e crédito | P0 | F3 | ○ |
| 6 | Contas, obrigações e calendário | P0 | F4 | ○ |
| 7 | Fluxo de caixa e projeção | P0 | F5 | ○ |
| 8 | Diagnóstico financeiro | P0 | F7 | ○ |
| 9 | Central de decisões | P0 | F7 | ○ |
| 10 | Plano financeiro vivo | P0 | F7 | ○ |
| 11 | Dívidas e plano de saída | P0 | F6 | ○ |
| 12 | Renda e gap de renda | P1 | F8 | ○ |
| 13 | Custos essenciais, orçamento e margem | P1 | F8 | ○ |
| 14 | Patrimônio e construção de riqueza | P1 | F9 | ○ |
| 15 | Reserva e segurança financeira | P1 | F9 | ○ |
| 16 | Objetivos financeiros | P1 | F9 | ○ |
| 17 | Anomalias e inteligência de comportamento | P1 | F10 | ○ |
| 18 | Importação e reconciliação | P1 | F11 | ○ |
| 19 | Open Finance | P1 | F12 | ○ |
| 20 | Assistente de IA | P2 | F13 | ○ |
| 21 | Fechamento mensal e evolução | P2 | F14 | ○ |
| 22 | Cenários e simulador de realidade | P2 | F14 | ○ |
| 23 | Qualidade, completude e confiança dos dados | P1 | F10 | ○ |
| 24 | Alertas e acompanhamento | P1 | F10 | ○ |
| 25 | Experiência principal da Home | P0 | F2 (parcial), F7 (completa) | ○ |
| 26 | Navegação e módulos | P0 | F0 | ○ |
| 27 | Funções de qualidade de vida | P2 | F0 (ocultar), F15 | ○ |
| 28 | O que NÃO deve ser prioridade | P3 | fora da V1, registrado | ● |
| 29 | Critérios de sucesso — 14 perguntas | P0 | portão em F7 e F9 | ○ |
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

### §4 — Dinheiro presente, comprometido e seguro `P0`

Saldo atual · saldo comprometido · saldo livre · **dinheiro seguro para gastar**
(com a margem de segurança definida pelo sistema) · compromissos próximos no
horizonte escolhido. — **F2**
Pergunta central: "Quanto eu posso gastar sem criar um problema mais adiante?"

### §5 — Cartões e crédito `P0` — **F3**

Limite total, disponível e utilizado · fatura atual, próxima e vencimento ·
parceladas e comprometimento de meses futuros · **compra no cartão ≠ pagamento
de fatura** · sem dupla contagem · comprometimento futuro visível · alerta de
aproximação de limite e de utilização anormal · cartões de mais de uma pessoa.

### §6 — Contas, obrigações e calendário `P0` — **F4**

Contas futuras com valor, vencimento, recorrência e status · parceladas com prazo
total · recorrentes acompanhadas · calendário com impacto no caixa por data ·
dias de maior pressão · obrigações sem cobertura suficiente · status previsto,
agendado, pago, atrasado, cancelado.

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

### §8 — Diagnóstico financeiro `P0` — **F7**

Estado do caixa · pressão de fixas e recorrentes · peso de dívida e parcela ·
previsibilidade e concentração da receita · evolução do custo de vida · despesa
fora do padrão · mudança relevante versus mês anterior · condição da reserva ·
evolução do patrimônio líquido · **completude e confiabilidade dos dados usados**.
Sem moralizar: fatos, relações e causas observáveis.

### §9 — Central de decisões `P0` — **F7**

Problemas atuais · riscos futuros · oportunidades · ações pendentes ·
priorização por urgência, impacto e prazo · **cada ação ligada ao problema que a
originou** · impacto esperado quando estimável · histórico do resolvido,
ignorado, adiado ou cancelado.

### §10 — Plano financeiro vivo `P0` — **F7**

Agora · esta semana · este mês · 90 dias · 12 meses — atualizado pela realidade,
não documento estático.

### §11 — Dívidas e plano de saída `P0` — **F6**

Cadastro completo · saldo original e atual · valor e quantidade de parcelas ·
pagas e restantes · vencimentos · taxas, juros e encargos quando conhecidos ·
atrasadas ou em risco · comprometimento mensal da renda · data estimada de
quitação · visão consolidada.
Simulação: aporte adicional · quitação antecipada · comparação de ritmos · prazo,
juros e impacto mensal por cenário · **cenário simulado separado do real**.

### §12 — Renda e gap de renda `P1` — **F8**

Fontes com valor e periodicidade · fixa, recorrente, variável, eventual ·
previsibilidade por fonte · histórico por fonte · gap contra custo essencial ·
gap contra custo de vida desejado · gap contra meta de recuperação ·
concentração da renda em poucas fontes.
Pergunta central: havendo déficit, dizer se é **gasto, timing, dívida, renda ou
combinação**.

### §13 — Custos, orçamento e margem `P1` — **F8**

Custo essencial · atual · ideal ou planejado · margem após compromissos ·
essencial versus discricionário · recorrente versus extraordinário · evolução
das principais categorias · categorias que consomem margem de forma crescente.
Orçamento como clareza, não como prisão.

### §14 — Patrimônio `P1` — **F9**

Ativos líquidos · investimentos · veículos · imóveis · participações e negócios ·
outros ativos · passivos · patrimônio líquido consolidado · evolução no tempo ·
variação mensal e acumulada · composição · **relação entre reduzir dívida,
aumentar ativo e crescer patrimônio**.

### §15 — Reserva e segurança `P1` — **F9**

Valor atual · meta por horizonte · **cobertura em dias e meses de custo
essencial** · progresso até a meta · separação entre dinheiro de operação e de
segurança.

### §16 — Objetivos financeiros `P1` — **F9**

Nome, valor-alvo, valor atual, prazo · progresso percentual e financeiro · valor
necessário por período · **compatibilidade da meta com a margem atual** ·
impacto de mudança de renda ou despesa no prazo · curto, médio e longo prazo.

### §17 — Anomalias `P1` — **F10**

Gasto fora do padrão histórico · aumento persistente de categoria · nova
recorrência · mudança relevante em receita · aumento atípico de cartão ·
diferença entre esperado e realizado · **explicar de onde veio o alerta e quais
dados o sustentam**.

### §18 — Importação e reconciliação `P1` — **F11**

Manual · planilhas e históricos · formatos financeiros (OFX/CSV) · Open Finance
(chega na F12) · identificação de duplicatas · reconhecimento de transferências
internas · revisão de lançamentos ambíguos · distinção entre importado
automaticamente e revisado pelo usuário · **manutenção do histórico original**.

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

### §23 — Qualidade e confiança dos dados `P1` — **F10**

Completude da vida financeira mapeada · confiabilidade da visão atual · itens a
confirmar · saldos ou registros não conciliados · **aviso quando a conclusão se
apoiar em dados incompletos** · data da última atualização.

### §24 — Alertas `P1` — **F10**

Risco de caixa · vencimento próximo sem cobertura · cartão perto do limite ·
receita esperada não recebida · despesa fora do padrão · nova recorrência ·
aumento de dívida · queda relevante de margem · **evolução positiva** de dívida,
reserva ou patrimônio.

### §25 — Home `P0` — **F2 parcial, F7 completa**

| Bloco | Conteúdo | Fase |
|---|---|---|
| Dinheiro | Atual, comprometido, livre, seguro | F2 |
| Situação | Estado do caixa e principal risco | F7 |
| Próximas ações | O que merece atenção agora | F7 |
| Fluxo | Entradas e saídas projetadas | F5 |
| Dívidas | Saldo, parcelas, pressão sobre a renda | F6 |
| Patrimônio | Líquido e evolução | F9 |

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

### §29 — Critérios de sucesso `P0` — portão em **F7** e **F9**

| # | Pergunta | Fase que responde |
|---|---|---|
| 1 | Quanto dinheiro eu tenho hoje? | F2 |
| 2 | Quanto já está comprometido? | F2 |
| 3 | Quanto posso gastar com segurança? | F2 |
| 4 | Quais são minhas próximas obrigações? | F4 |
| 5 | Em que data meu caixa aperta? | F5 |
| 6 | Quanto devo no total? | F6 |
| 7 | Quanto as dívidas consomem por mês? | F6 |
| 8 | Quanto entra e sai por mês? | F1 · F5 |
| 9 | Existe gap de renda? Qual? | F8 |
| 10 | O que provoca a pressão financeira? | F7 |
| 11 | O que precisa da minha atenção agora? | F7 |
| 12 | Qual é meu patrimônio líquido? | F9 |
| 13 | Estou melhorando ou piorando? | F7 · F9 |
| 14 | Quais metas cabem na minha realidade? | F9 |

### §31 — Definição final — critério de aceite geral

"Uma visão financeira única e confiável, capaz de conectar presente e futuro,
mostrar caixa e dívida com clareza, revelar os principais gargalos, quantificar
gaps, acompanhar patrimônio e transformar tudo isso em um plano de ação que se
atualiza com a realidade."

O valor não está na quantidade de gráficos ou integrações — está em reduzir
incerteza e transformar confusão em sequência objetiva de decisões.
