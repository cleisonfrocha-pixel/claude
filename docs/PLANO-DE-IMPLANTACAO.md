# Plano de implantação — Sistema de Gestão Financeira Pessoal/Familiar

Base: `Blueprint de Produto V1` (31 seções, PDF de referência).
Ponto de partida: artefato **Painel GEDI (Copy)**, já duplicado.
Decisões técnicas: `ARQUITETURA.md`. Cobertura item a item: `RASTREABILIDADE.md`.

---

## 1. O que já está pronto antes da primeira linha

O Painel GEDI não é um rascunho — é um produto financeiro funcionando, com
layout de computador e um aplicativo mobile completo por baixo. O que dele
atravessa para o produto novo:

| O que | Onde está no GEDI | Como entra no produto novo |
|---|---|---|
| Sistema de design (tokens, claro/escuro, Poppins + IBM Plex Mono) | CSS, ~390 linhas | Direto, sem alteração |
| Casca mobile (barra de abas, bottom sheets, navegação por mês) | classes `.m-*` | Direto; a barra de abas cresce de 3 para os módulos do §26 |
| Formatação de dinheiro e datas em pt-BR | `fmtBRL`, `fmtBRLshort`, `fmtPct`, `monthLabel`, `addMonths` | Direto, vira `domain/formato.js` |
| Provisionamento automático de meses futuros | `ensureProvisionedEntries` | Vira o motor de **recorrências** (§3) |
| Agregação por mês e acumulada | `entryTotals`, `monthTotalsFor`, `globalTotalsAte` | Vira o motor de agregação |
| Status pago / a receber | campo `status` | Expande para `previsto, agendado, pago, atrasado, cancelado` (§6) |
| Custos por lançamento | array `costs[]` | Vira **despesas** e **parcelas** |
| Migração de formato de dados | `normalizeState` | Vira o versionador de schema |
| Gráficos SVG desenhados à mão | `svg.chart` | Base dos gráficos de fluxo e patrimônio |
| Persistência republicando a página | `fullDocument` + capability `artifact` | **Substituído** pelo `db` na Fase 0 |

Aproveitamento estimado: **~40% do trabalho de interface e ~20% do motor**.
O que sobra de trabalho real é o miolo do blueprint — projeção, dívida,
diagnóstico e decisão — que o GEDI nunca teve porque nunca precisou.

## 2. Como o plano está organizado

16 fases, agrupadas em 5 ondas. A ordem segue exatamente a "ordem de entrega
recomendada" do §30 do blueprint — não é coincidência, é o critério.

Cada fase tem um **portão**: uma pergunta que precisa ser respondida com o
produto na mão. Fase sem portão fechado não libera a próxima. Isso existe para
evitar o modo de falha clássico deste tipo de projeto — dez módulos pela metade
e nenhuma pergunta respondida.

Esforço em **sessões de trabalho** (uma sessão = um bloco de trabalho focado com
entrega publicada ao fim), não em dias de calendário.

---

## Onda 0 — Fundação

### Fase 0 · Esqueleto e mudança de fundação · 2 sessões — ✅ concluída (19/09/2026)

O único momento em que se mexe em encanamento. Depois disso, só produto.

- Renomear a cópia do GEDI para o produto novo e assumir o repositório como fonte.
- Quebrar o arquivo único em módulos: `domain/`, `ui/`, `dados/`.
- Trocar a persistência: do estado embutido no HTML para a capability `db`.
- Migrador que lê um estado GEDI antigo e escreve no formato novo, sem perder nada.
- Cadastros-base: **pessoas, contas, cartões, categorias** (§3).
- Navegação dos 11 módulos do §26, com as telas ainda vazias.
- Modo de ocultar valores já aqui — custa 10 linhas e é o que permite abrir o
  painel na frente de outra pessoa desde o primeiro dia.

**Portão:** dá para cadastrar uma pessoa, uma conta e um cartão, fechar o
navegador, abrir no celular e os dados estarem lá.

**Entregue:** repositório organizado em `app/src/{domain,dados,ui}` (D1);
persistência migrada para a capability `db`, com fallback local documentado
para quando ela não está disponível (D2); motor de dinheiro e tempo puros,
24 testes automatizados (`app/testes`, `node --test`); cadastros de pessoas,
contas, cartões e categorias com validação; navegação dos 11 módulos do §26
(4 funcionais, 7 como placeholder honesto apontando a fase que os entrega);
ocultar valores (§27). Publicado em
[Vida Financeira](https://claude.ai/artifact/LgXc37oyU6rwCZTguZf5j6), com
`capabilities: {db: {}}` apenas — as capabilities `artifact`/`user` herdadas
do GEDI foram revogadas por não serem mais usadas. Portão verificado com
Playwright (cadastro sobrevive a fechar/reabrir a página).

Decisão registrada em `migrador.js`: os dados de agência que estavam nessa
cópia do GEDI (clientes, prestadores, lançamentos) **não foram migrados** —
o domínio é outro (agência × família), e inventar esse mapeamento produziria
dados errados. Eles continuam intactos no artefato original "Painel GEDI",
do qual esta era uma cópia feita para servir de base a este projeto.

---

## Onda 1 — Ver a realidade

O blueprint é explícito: "dados primeiro, decisões depois". Nada de inteligência
nesta onda. O objetivo é que o sistema represente a vida financeira sem mentir.

### Fase 1 · Núcleo financeiro · 4 sessões — §3 — ✅ concluída (19/09/2026)

Transações, transferências, receitas, despesas, recorrências, parcelamentos.

O item que decide a qualidade de tudo que vem depois: **transferência entre
contas próprias não é receita nem despesa**. Se isso vazar, todo indicador do
produto fica errado e o usuário para de confiar. Mesma regra para compra no
cartão versus pagamento da fatura (§5).

**Portão:** transferir R$ 1.000 entre duas contas próprias não altera nenhum
total de receita ou despesa do mês. Teste automatizado, não conferência no olho.

**Entregue:** as cinco formas de lançamento na tela Transações (dentro de
Dinheiro) — receita/despesa simples, transferência, parcelamento, recorrência
e pagamento de fatura — todas passando por `dados/transacoesRepo.js` e
`dados/recorrenciasRepo.js`, que aplicam as regras do domínio
(`domain/transacoes.js`) antes de gravar. Fatura de cartão nasce sozinha
quando uma despesa é lançada nele (§5). 47 testes de domínio, incluindo o
teste literal do portão. Verificado de ponta a ponta com Playwright: as duas
regras não-negociáveis do CLAUDE.md (transferência não conta, fatura paga não
duplica a despesa), parcelamento sem perder centavo, e recorrência
provisionando os próximos meses sozinha.

Decisão de design registrada em `docs/MODELO-DE-DADOS.md`: a competência de
uma transação (mês em que ela conta como despesa/receita) e a competência da
fatura que ela pertence (mês da cobrança no cartão) são **eixos
independentes** e podem divergir — uma compra feita depois do fechamento cai
na fatura do mês seguinte, mas continua sendo despesa do mês em que aconteceu.
Primeira versão do parcelamento confundia os dois; ficou como teste de
regressão.

No caminho, dois bugs reais da Fase 0 apareceram e foram corrigidos (detalhe
em `docs/RASTREABILIDADE.md`, §3): o checkbox "Ativa" nascia desmarcado em
registros novos, e o checkbox "Encerrada" de contas gravava um booleano num
campo que precisa ser texto — sem `validarConta` conferir, o que deixava a
falha passar batido.

### Fase 2 · Clareza de caixa · 3 sessões — §4 + bloco Dinheiro do §25 — ✅ concluída (19/09/2026)

Saldo atual, comprometido, livre e **seguro para gastar** — mais a margem de
segurança que o sistema define e os compromissos próximos no horizonte escolhido.

É o primeiro momento em que o produto entrega algo que uma planilha não entrega.

**Portão:** o painel responde "Quanto eu posso gastar sem criar um problema mais
adiante?" com um número, e esse número é explicável linha a linha.

**Entregue:** `domain/caixa.js` — saldo por conta (respeitando transferências,
sem contar de novo o que o saldo inicial já embutia), comprometido (despesas
previstas/agendadas/atrasadas dentro do horizonte, mais faturas de cartão em
aberto pelo vencimento), livre e seguro para gastar. A Home (Início) virou o
bloco Dinheiro real do §25: o número central em destaque, os três números de
apoio, e duas listas explicando cada um — saldo por conta e compromissos
próximos, com o rótulo "Atrasado" quando cabe. 27 testes de domínio novos
(eram 47, agora 74). Portão verificado de ponta a ponta com Playwright.

Duas decisões de design registradas em `ARQUITETURA.md`: a margem de
segurança do §4 é a reserva que o próprio usuário já separou (D8), não um
número inventado; e o horizonte é fixo em 30 dias até a Fase 5 trazer os
quatro horizontes do §7 lado a lado (D9).

Um bug real da Fase 0 apareceu no caminho e foi corrigido: `modal.js` focava
o primeiro campo do formulário num `setTimeout` de 30ms sem checar se algo
já estava em foco — quem preenchesse um segundo campo rápido demais (ou um
teste automatizado) tinha o texto roubado de volta para o primeiro campo.
Nunca chegou a afetar dado publicado (só sessões de teste local), mas era
uma corrida de verdade. Corrigido trocando o timeout por
`requestAnimationFrame` com checagem de foco ativo.

### Fase 3 · Cartões e crédito · 3 sessões — §5

Limite total, disponível e utilizado; fatura atual, próxima e vencimento;
parceladas e comprometimento de meses futuros; alerta de aproximação de limite;
cartões de mais de uma pessoa no mesmo núcleo.

**Portão:** uma compra parcelada em 10x aparece como parcela no mês corrente
**e** como compromisso nos 9 meses seguintes, sem contar o dinheiro duas vezes.

### Fase 4 · Compromissos e calendário · 3 sessões — §6

Contas futuras com valor, vencimento, recorrência e status; calendário com
impacto no caixa por data; dias de maior pressão; obrigações sem cobertura;
os cinco status (previsto, agendado, pago, atrasado, cancelado).

**Portão:** o calendário aponta o dia do mês que aperta, e aponta qual obrigação
está sem cobertura suficiente.

---

## Onda 2 — Ver o futuro e decidir

Aqui o produto deixa de ser registro e vira centro de comando. É a onda que
justifica o projeto.

### Fase 5 · Fluxo de caixa e projeção · 4 sessões — §7

Horizontes de 7, 30, 90 dias e 12 meses, cada um respondendo a sua pergunta.
Estados de certeza: confirmado, provável, incerto — e incerto **nunca** é
tratado como dinheiro garantido.

**Portão** (o blueprint chama de "saída crítica"): quando o saldo projetado fica
negativo, o sistema diz **em que data**, **qual evento provoca** e **de quanto é
o gap**. Os três, não dois.

### Fase 6 · Dívidas e plano de saída · 4 sessões — §11

Cadastro completo, saldo original e atual, parcelas pagas e restantes,
vencimentos, juros quando conhecidos, atrasos, comprometimento mensal da renda,
data estimada de quitação, visão consolidada.
Mais o simulador: aporte extra, quitação antecipada, comparação de ritmos.

Regra inegociável do blueprint: **o cenário simulado fica separado do real.**
Simulação nunca escreve no dado verdadeiro.

**Portão:** simular um aporte de R$ 500/mês mostra prazo novo, juros economizados
e impacto mensal — e ao sair da simulação nada mudou de verdade.

### Fase 7 · Diagnóstico, decisões e plano vivo · 5 sessões — §8, §9, §10, §25

- **Diagnóstico** (§8): estado do caixa, pressão de fixas, peso da dívida,
  previsibilidade da receita, evolução do custo de vida, gastos fora do padrão,
  mudanças versus mês anterior, reserva, patrimônio, e a completude dos dados
  usados. Sem moralizar — fatos e causas observáveis, como o blueprint exige.
- **Central de decisões** (§9): problemas, riscos, oportunidades e ações
  pendentes, priorizados por urgência, impacto e prazo; cada ação amarrada ao
  problema que a originou; histórico do que foi resolvido, ignorado ou adiado.
- **Plano vivo** (§10): agora, esta semana, este mês, 90 dias, 12 meses —
  atualizando sozinho conforme a realidade muda.
- **Home completa** (§25): os seis blocos obrigatórios.

### ⛳ PORTÃO DA V1 — as 14 perguntas do §29

A V1 só está pronta quando o produto responde, com clareza e confiança:

1. Quanto dinheiro eu tenho hoje?
2. Quanto desse dinheiro já está comprometido?
3. Quanto eu posso gastar com segurança?
4. Quais são minhas próximas obrigações?
5. Em que data meu caixa aperta?
6. Quanto eu devo no total?
7. Quanto minhas dívidas consomem por mês?
8. Quanto entra e quanto sai por mês?
9. Existe um gap de renda? Qual?
10. O que está provocando a pressão financeira?
11. O que precisa da minha atenção agora?
12. Qual é meu patrimônio líquido?
13. Estou melhorando ou piorando ao longo do tempo?
14. Quais metas são compatíveis com minha realidade atual?

> As perguntas 9, 12 e 14 dependem de renda (§12), patrimônio (§14) e
> objetivos (§16) — que são P1 e caem na Onda 3. Ou seja: **a V1 fecha ao fim da
> Fase 9, não da Fase 7.** A Fase 7 fecha o *núcleo P0*; as perguntas do §29
> atravessam as duas ondas. Está assim de propósito, para não haver ilusão de
> pronto no meio do caminho.

---

## Onda 3 — Fechar os gaps

### Fase 8 · Renda, gap, custo essencial e margem · 4 sessões — §12, §13

Fontes com valor e periodicidade; fixa, recorrente, variável e eventual;
previsibilidade de cada fonte; histórico por fonte; concentração da renda.
Os três gaps: contra o custo essencial, contra o custo desejado e contra a meta
de recuperação. Custo essencial, atual e ideal; margem; essencial versus
discricionário; categorias que comem margem de forma crescente.

**Portão** (pergunta central do §12): havendo déficit, o sistema diz se o
problema é de **gasto**, de **timing de caixa**, de **dívida**, de **renda** ou
de combinação — não apenas que existe déficit.

### Fase 9 · Patrimônio, reserva e objetivos · 4 sessões — §14, §15, §16

Ativos líquidos, investimentos, veículos, imóveis, participações, outros;
passivos; patrimônio líquido e sua evolução, variação e composição; e a relação
entre reduzir dívida, aumentar ativo e crescer patrimônio.
Reserva: valor, meta por horizonte, cobertura em dias e meses de custo
essencial, progresso, e separação entre dinheiro de operação e de segurança.
Objetivos: alvo, prazo, progresso, valor necessário por período e — o que quase
nenhum app faz — **verificação de compatibilidade da meta com a margem atual**.

**⛳ Portão: as 14 perguntas do §29 respondidas. V1 COMPLETA (P0 + P1 central).**

### Fase 10 · Confiança, alertas e anomalias · 3 sessões — §23, §24, §17

Completude da vida financeira mapeada e confiabilidade da visão; itens a
confirmar; saldos não conciliados; **aviso quando uma conclusão estiver baseada
em dados incompletos**; data da última atualização.
Nove alertas do §24. Detecção de anomalias do §17 — e cada alerta explicando de
onde veio e quais dados o sustentam.

Vem **depois** do diagnóstico de propósito: alerta sem base de dados confiável é
ruído, e ruído destrói a confiança no produto mais rápido que a ausência do alerta.

**Portão:** todo alerta na tela abre e mostra os lançamentos que o geraram.

### Fase 11 · Importação e reconciliação · 4 sessões — §18

Importação manual, de planilhas e históricos, e de formatos financeiros (OFX/CSV);
planilha do Google Drive pela conexão que você já tem; identificação de
duplicatas; reconhecimento de transferências internas; revisão de lançamentos
ambíguos; distinção entre o que veio automático e o que você revisou;
**manutenção do histórico original** dos lançamentos.

Aqui nasce a interface `ConectorDeDados` (ver `ARQUITETURA.md`, D4) que a Fase 12
vai reusar.

**Portão:** importar o mesmo extrato duas vezes não cria um único lançamento
duplicado.

---

## Onda 4 — Automatizar e interpretar

### Fase 12 · Open Finance · 5 sessões + decisão de custo — §19

**A única fase que exige infraestrutura fora do artefato.** Precisa de servidor,
certificado, redirect OAuth e webhook — nada disso existe dentro de um artefato.

Entra: conexão de instituições, atualização de contas e saldos, importação de
movimentações e de dados de cartão, status e atualidade de cada conexão,
tratamento de indisponibilidade, histórico de sincronizações, reconciliação com
o que já existe.

Antes de começar, uma decisão sua: qual provedor e a que custo. O §19 pede
explicitamente "sem custo recorrente de um plano comercial caro" e modelo não
preso a um fornecedor — por isso o adaptador. **Se o custo não fechar, esta fase
espera e o produto segue completo**, porque a Fase 11 já cobre a entrada de dados
com trabalho manual.

Princípio do blueprint a respeitar: Open Finance reduz trabalho manual, mas não
pode reduzir a confiabilidade do sistema.

### Fase 13 · Assistente de IA · 3 sessões — §20

Roda **dentro da própria página**, sem backend, pela capability `sample`.

Responder perguntas sobre a própria vida financeira, explicar variações, explicar
por que um alerta apareceu, simular cenários, resumir o mês, sugerir pontos de
revisão, ajudar a interpretar o plano — **sempre mostrando os dados de origem** e
**nunca alterando dado financeiro crítico sem confirmação**.

Depende do `db` (Fase 0): é ele que permite à IA ler os dados reais em vez de
inventar. Vem depois do diagnóstico porque o §20 é claro — a IA é camada de
interpretação sobre dados confiáveis, não a inteligência do produto.

### Fase 14 · Fechamento mensal e cenários · 4 sessões — §21, §22

Fechamento: resumo do mês, realizados, resultado, variação de dívida, reserva e
patrimônio, maiores mudanças de comportamento, principais alertas e decisões,
histórico mensal comparável.
Cenários: atual, recuperação, aumento de renda, redução de despesa, quitação,
conservador — comparados **sem alterar os dados reais**, mostrando impacto em
caixa, dívida, reserva e patrimônio.

### Fase 15 · Qualidade de vida · 3 sessões — §27

Busca global; filtros por período, pessoa, conta, cartão e categoria; exportação
completa dos próprios dados; histórico de alterações relevantes; documentos e
comprovantes anexados a registros importantes.
(O modo de ocultar valores já entrou na Fase 0.)

---

## Fora de escopo na V1 — §28

Registrado para que não volte pela porta dos fundos: marketplace financeiro,
compra e venda de investimento dentro da plataforma, crédito e empréstimo,
pagamento e movimentação bancária pelo produto, gamificação complexa, rede social
financeira, comparador sofisticado de produtos, integrações não essenciais em
volume, e **aplicativo nativo antes de validar a experiência central**.

## Resumo de esforço

| Onda | Fases | Sessões | Entrega |
|---|---|---|---|
| 0 · Fundação | F0 | 2 | Esqueleto navegável com dados reais |
| 1 · Ver a realidade | F1–F4 | 13 | Vida financeira representada sem erro |
| 2 · Ver o futuro e decidir | F5–F7 | 13 | Núcleo P0 do blueprint completo |
| 3 · Fechar os gaps | F8–F11 | 15 | **V1 completa — 14 perguntas do §29** |
| 4 · Automatizar e interpretar | F12–F15 | 15 | Open Finance, IA, cenários, conforto |
| | | **58** | |

A V1 fecha na Fase 9 — **43 sessões**. A Onda 4 é melhoria contínua sobre um
produto que já resolve o problema, e por regra do §2 ela nunca atrasa o que vem
antes.

## Riscos, com o que fazer a respeito

| Risco | Por que importa | O que fazer |
|---|---|---|
| Dinheiro contado duas vezes (transferência, fatura de cartão) | Erra todo indicador e mata a confiança no produto | Teste automatizado no portão das Fases 1 e 3, antes de qualquer tela nova |
| Open Finance virar o gargalo | É a única fase com custo e dependência externa, e é P1 | Adaptador (D4); a Fase 11 já entrega entrada de dados sem ele |
| Volume de dados crescer além do confortável | Trava a Trilha A | `db` desde a Fase 0; medir a partir da Fase 11 |
| Cadastro inicial ser grande demais e o projeto morrer no começo | O produto exige a vida financeira mapeada para funcionar | Fase 0 entrega o modo de ocultar valores e a Fase 10 entrega o medidor de completude — o progresso fica visível |
| P2 atrair mais que P0 (a IA é mais divertida que parcelamento) | É o erro que o §2 antecipa | Nenhuma fase P2 começa antes da Fase 9 fechar |
| Precisão financeira em ponto flutuante | R$ 0,01 de erro destrói a confiança | Centavos em inteiro dentro do motor; formatação só na borda |

## Como cada sessão de trabalho termina

1. Portão da fase verificado com o produto na mão, não no papel.
2. Testes do motor financeiro passando.
3. Commit na branch, com a fase no nome.
4. Artefato republicado — o que está publicado é sempre o que está no repositório.
5. `RASTREABILIDADE.md` atualizado: item do blueprint marcado como entregue.

## Habilidades que ajudam no caminho

| Quando | Qual | Para quê |
|---|---|---|
| Fases 5, 6, 9, 14 | `dataviz` | Gráficos de projeção, dívida e patrimônio com escala e cor corretas |
| Toda fase com tela | `artifact-design` | Consistência visual com o sistema herdado do GEDI |
| Fases 0 e 13 | `artifact-capabilities` | Contrato correto de `db`, `sample`, `mcp`, `downloads` |
| Fim de cada onda | `code-review` | Erro de cálculo financeiro antes de virar decisão errada |
| Antes da Fase 12 | `security-review` | Fase que toca credencial bancária |
| Depois da Fase 2 | `skill-creator` | Criar a habilidade do projeto, com as regras do domínio, para toda sessão futura já nascer sabendo |
