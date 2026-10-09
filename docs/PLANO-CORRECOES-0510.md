# Fase 13: correções e simplificação (lista de 05/10/2026)

Origem: a lista de 90 problemas que o Cleison mandou em 05/10/2026 (painel usado com os dados reais, no celular e no
desktop). Ordem: primeiro o que dá número errado, depois o que dá número diferente em telas diferentes, depois a
simplificação das telas, e por último a limpeza dos dados reais (que depende de respostas dele).

| Sprint | Tema | Itens da lista |
|---|---|---|
| 13.1 | Saldo e caixa certos | 1, 2, 3, 4, 8, 15, 18 |
| 13.2 | Verbas e projeção honesta | 5, 6, 7, 13, 16, 70, 71, 73, 74 |
| 13.3 | Vínculos, faturas e parcelas | 9, 10, 11, 12, 14, 26, 27, 28, 63 |
| 13.4 | Uma conta só para o mês | 19, 20, 21, 22, 23, 24, 25 |
| 13.5 | Dívidas claras | 31, 32, 33, 34, 35, 36, 37, 38 |
| 13.6 | Início enxuto | 50, 51, 52, 53, 54, 55, 56, 57, 58 |
| 13.7 | Dinheiro e Agenda simplificados | 29, 30, 60 a 69, 72, 75 |
| 13.8 | Plano de recuperação | 76 a 83 |
| 13.9 | Textos, fonte e telas que não se atualizam | 17, 84 a 90 |
| 13.10 | Dados reais (limpeza e perguntas) | 39 a 49 e as perguntas K |

Regra de cada sprint: teste no motor para cada regra nova, conferência no navegador com o estado real, commit,
artefato republicado, este arquivo atualizado com o que foi feito e o que ficou.

## Andamento

### 13.1 Saldo e caixa certos (feita, 06/10)

- **Itens 1, 2 e 15.** Cada lançamento guarda `movimentadoEm`, a hora em que virou pago (Paguei, Recebi, edição
  para "pago" ou criação já paga; lançamento antigo usa `criadoEm`). No dia do saldo conferido, entra no saldo só
  o que se mexeu depois de `saldoConferidoEm`. `atualizadoEm` não conta mais: editar um lançamento que já estava
  no saldo não soma de novo. Saldo novo digitado no cadastro da conta, pelo "Conferir" ou pelo chat grava a hora.
  Dado real: Next conferido 05/10 14:16 (R$ 2.252,98), Nubank 05/10 14:07 (R$ 2.430,33). Del Poente
  (+R$ 5.000) e a equipe (Giu, Brena, Felipe, -R$ 3.000) foram marcados depois: o Next passou a R$ 4.252,98.
- **Item 3.** Pagar pelo Paguei tira da conta na hora; o "pode gastar" fica igual (conferido no navegador com o
  estado real: DAS de R$ 108,92 pelo Next, conta R$ 4.252,98 para R$ 4.144,06, pode gastar sem mudar).
- **Item 4.** "Livre garantido" passou a ser o ponto mais baixo dos próximos 30 dias contando só o confirmado.
  Antes era "até a próxima entrada confirmada": receber uma entrada empurrava a janela e o número piorava.
  Teste: receber nunca piora o garantido.
- **Item 8.** Receita atrasada aparece hoje (para cobrar ou dar Recebi) mas não cobre nada no caixa.
- **Item 18.** `valorDigitadoValido` recusa "1.2.3", "12,345,6", texto e vazio. Os formulários (Lançar, editar,
  Paguei/Recebi, conferir saldo, cadastros) mostram "Valor não reconhecido" em vez de gravar R$ 0,00.

### 13.2 Verbas e projeção honesta (feita, 06/10)

- **Itens 5, 6 e 7.** Novo `domain/verbas.js`: o que falta de cada verba do mês é derivado na leitura, verba menos
  o gasto real da categoria no mês (despesa paga ou compra no cartão; pedaço já baixado da verba não conta duas
  vezes). Duas verbas na mesma categoria (café e almoço no escritório) dividem o gasto na proporção. O que falta é
  repartido em partes iguais, uma por semana, de hoje até o fim do mês (antes caía tudo hoje). Verba de mês que
  passou expira: não pesa mais nem vira atrasada. Verba de mês futuro vinda da recorrência também é repartida.
- **Item 13.** Parcelado fora do cartão (no app e pela ferramenta do chat) vence um mês por parcela, no mesmo dia.
  Não havia nenhum no dado real.
- **Item 16.** O gasto do dia a dia (média) não conta mais as compras de cartão que a projeção já conta pelo uso
  habitual do cartão. No casal de teste a média caiu de R$ 2.358,40 para R$ 252,50: era o mesmo gasto duas vezes.
  O rateio semanal da média não perde mais centavo.
- **Itens 70, 71, 72 (parte), 73, 74.** Calendário: uma linha "Em DD/MM o saldo fica negativo" com as 3 saídas
  que mais pesam (antes, 18 nomes numa frase); sumiu o "maior saída num dia só"; só o dia em que o saldo cruza o
  zero fica vermelho. Fluxo: só 7 e 30 dias (90 dias e 12 meses saíram), e "entra / sai" aberto por origem:
  confirmado, provável, atrasadas, contas com data, parcelas, cartões, o que falta das verbas, dia a dia.
- **Dado real (06/10):** "pode gastar até 07/10" foi de -R$ 1.410,77 para R$ 1.657,82. O primeiro dia negativo
  passou de hoje para 15/10 (-R$ 1.060,79, pesam as camisetas de R$ 1.400 e as compras do ML).

### 13.3 Vínculos, faturas e parcelas (feita, 06/10)

- **Item 10.** `totaisPorFatura` em `domain/transacoes.js` é a conta única da fatura: compras (sem canceladas),
  pago, o que falta, total e o pedaço sem detalhe. Caixa, calendário, contas do mês, cartões e anomalias usam ela.
- **Item 11.** Pagamento parcial não quita mais a fatura (no app e na ferramenta do chat): ela fica aberta com o
  resto, e só o resto pesa no caixa. O casal de teste pagava menos que as faturas de agosto e setembro e o painel
  escondia a diferença; o fixture passou a pagar o valor certo.
- **Item 12.** Editar data ou cartão de uma compra recalcula a fatura e o mês (parcela mantém o deslocamento).
- **Item 14.** Pagar hoje a parcela atrasada de setembro gravava o pagamento como outubro e escondia a parcela de
  outubro. Agora o lançamento leva o mês do vencimento. O contador `parcelasPagas` continua (há parcelas pagas
  antes do painel, como as 20 do Jeep, que não existem como lançamento); a troca por valor derivado fica para a 13.5.
- **Item 9.** Renda lançada à mão ou do extrato sem vínculo (o salário) não faz a fonte aparecer de novo no mês:
  casa por nome e valor (15%) ou pela conta da fonte. Conta mensal e parcela **não** casam sozinhas: no dado real
  isso juntaria o Vivo de setembro pago em 02/10 com o de outubro, e a Brena, a Giu e o Felipe do Gedi com os do
  Del Poente. Para esses, o vínculo é gravado no Lançar: o "isso paga uma conta?" agora oferece também as contas
  que ainda só existem no cadastro (renda da fonte, parcela, conta mensal); escolher grava o lançamento ligado
  (conferido no navegador: o salário da Carolina lançado à mão ficou com `fonteRendaId`).
- **Item 63.** A sugestão só aparece quando nome **e** valor batem (até 30%). R$ 100 de mercado não sugere mais
  Vivo, Claude nem DAS.
- **Item 26.** Fatura paga com detalhe parcial: o pedaço sem compra lançada entra como "cartão sem detalhe" no
  histórico do ano e no orçamento (antes sumia; no dado real eram R$ 5.072,74). `parteSemDetalhePorPagamento`.
- **Item 27.** A tela Cartões já mostra a da Shopee como "Fechada · vence 10/10". O "aberta" do banco quer dizer
  "não paga". O relatório passou a dizer "Fatura a pagar por cartão".
- **Item 28.** Uso mensal informado igual ao limite, sem fatura que mostre isso, é ignorado (Nubank PF projetava
  R$ 400 todo mês). Com 2 ou mais faturas fechadas vale a média real (Nubank PJ R$ 3.174,85, Shopee R$ 1.403,51).
- **Para a 13.10 (dado):** DAS "(setembro)" previsto em outubro sem vínculo com a recorrência do DAS: aparece duas
  vezes na projeção (R$ 86,05).

### 13.4 Uma conta só para o mês (feita, 06/10)

- **Itens 19, 20 e 21.** `resumoDoMes` (`domain/mes.js`) é a conta do mês: mês de referência, sem cancelados, sem
  transferência, sem repasse, sem pagamento de fatura (só o pedaço sem compra lançada), "já entrou / já saiu"
  separado de "ainda marcado". Transações usa ela no topo ("Já entrou, Já saiu, Resultado até agora" e uma linha com
  o que ainda está marcado). Dado real de outubro, igual em Transações, Fechamento e Meu ano: entrou R$ 12.000,
  saiu R$ 7.308,02, resultado R$ 4.691,98. Setembro também bate nas três (R$ 14.056,32, R$ 20.338,91, -R$ 6.282,59).
  Compra no cartão ainda "prevista" (as "Compras previstas" de novembro, o corte do dia 08) é plano: vai em
  "ainda vai sair", não em "já saiu".
- **Item 22.** Cada tela diz o critério: Transações "compra no cartão conta no mês em que foi feita"; Contas do mês
  "pelo dia de vencimento".
- **Item 23.** Contas do mês mostra "Contas pagas" e, numa linha, o gasto do mês com os avulsos (o mesmo número
  de Transações).
- **Item 24.** Saiu o `resultadoMes` de Pessoas; fica só a "sobra do mês", a mesma do Início, do Plano e da Renda.
- **Item 25.** `sujaONome` (negativada ou protestada, sem repetir a mesma dívida) é a regra única: Dívidas, Plano,
  Por pessoa, Caminhos e alertas contam 10 (8 do Cleison, 2 da Carolina). O "100% do gasto no Cleison" é o dado:
  o extrato da Carolina vai até setembro e o gasto da casa fica no nome de quem pagou; a tela agora diz isso.

### 13.5 Dívidas claras (feita, 06/10)

- **Itens 31 e 38.** O topo da tela Dívidas responde três perguntas: quanto você deve (com as ofertas R$ 113.103,30
  e sem as ofertas R$ 172.587,30, lado a lado, com o aviso de que 4 ofertas não têm validade cadastrada), quanto
  custa por mês (R$ 3.316,37, só o Jeep tem parcela) e o que fechar primeiro (ofertas pela ordem de desconto). A barra
  "de que é feito" e o placar de nome limpo saíram do topo (o placar vai para o progresso do Plano, 13.8).
- **Item 32.** "10 estão sem acordo: não têm parcela e não pesam no mês até você fechar." É o dado: sem acordo não
  existe parcela para cadastrar.
- **Item 33.** Dívida paga com trabalho: a barra parte do saldo em que o abatimento começou (R$ 12.000 em 03/10),
  não do valor original da cota (R$ 25.000). Antes mostrava R$ 14.500 "abatidos"; agora R$ 1.500.
- **Item 34.** A cotação de quitação do banco só desconta parcela paga **depois** do dia da cotação (pelos
  lançamentos, não pelo contador). Jeep: a parcela 21 foi paga em 03/10 e o print é de 05/10, então vale
  R$ 85.541,86 como veio do banco. Os pagamentos atrasados com R$ 427,10 a mais (juros de atraso) seguem como dado.
- **Item 37.** Dívida sem acordo não fica "atrasada" nem "em dia" pela data em que foi cadastrada.
- **Itens 35 e 36 (dado, ficam para a 13.10 com resposta sua):** os 3 protestos sem credor (R$ 4.927,09) podem
  ser a mesma dívida de Bradesco, Mercado Pago ou EDP (o cadastro tem "é a mesma dívida de"); as 2 faturas do
  cartão Next cancelado (R$ 328,66 em 12/08 e R$ 2.832,80 em 14/09) estão como "Dívidas e parcelas" sem dívida
  cadastrada: falta saber se ainda resta saldo desse cartão.

### 13.6 Início enxuto (feita, 06/10)

- **Item 50.** O topo é o saldo de cada conta com "atualizado em dd/mm às hh:mm" (hora da conferência) e o botão
  "Atualizar saldo". Saiu o "Boa noite" e o "Pode gastar".
- **Item 51.** "A receber" mostra só o que é confirmado, com a data; o provável fica num "Esperado, ainda não é
  certo" fechado. Incerto não aparece (não conta em nada).
- **Item 52.** A zona de risco virou uma linha: "Você chega em 07/10 (quando entra Salário - Carolina, esperado)
  com R$ 1.657,82", e "Em 15/10 falta dinheiro" quando falta. "Ver a conta" abre: na conta agora, entra até lá,
  sai até lá, você chega com (a conta fecha; `chegadaAteAProximaEntrada`, com teste).
- **Item 53.** O selo "Confiança baixa" saiu do topo.
- **Item 54.** Saíram da Início: Cartões, "Posso gastar?", "Seu ano até agora", "Completar seu retrato" e o atalho
  dos alertas (tudo continua nas abas de origem).
- **Item 55.** Atrasado numa faixa vermelha própria; "Próximos 7 dias" à parte. Cada linha tem nome, data
  ("venceu 20/04" ou "10/10"), valor e o botão "Paguei" (lançamento, fatura ou conta que ainda só existe no
  cadastro). Estimativa (uso do cartão) e verba não têm "Paguei". Os primeiros 4 atrasados e 6 da semana à vista,
  o resto em "Ver mais".
- **Item 56.** A fatura da Shopee aparece uma vez só (o bloco Cartões saiu).
- **Item 57.** O botão grande "Lançar" saiu; fica o "+" do menu.
- **Item 58.** Uma coluna só, centralizada, no celular e no desktop.
- Conferido no navegador com o estado real (390 px e 1366 px, sem rolagem lateral, sem erro; Paguei abre a folha).

### 13.7 Dinheiro e Agenda simplificados (feita, 06/10)

- **Itens 60 e 86.** Dinheiro tem 6 abas, sem o título "Dinheiro" repetido em cima: A pagar, Transações, Agenda
  (calendário e fluxo na mesma tela, um embaixo do outro), Renda, Contas fixas, Contas e cartões. Importar extrato e
  Revisar lançamentos foram para Configurações. Atalhos antigos (dinheiro/importar, dinheiro/cartoes) caem no lugar novo.
- **Item 61.** A pagar sem o título repetido; atrasadas há mais de 30 dias numa faixa fechada, com o aviso de
  conferir no extrato se já não foram pagas (os DAS de março a agosto).
- **Itens 62 e 87.** Cada lançamento mostra só a ação principal (Paguei, Recebi); "Os dados estão certos", Editar e
  Apagar foram para o "⋯", com Apagar em vermelho. O mesmo "⋯" em contas, cartões, dívidas, fontes e contas fixas.
- **Item 64.** Nova transação: valor, conta, descrição e categoria à vista; data, pessoa, "já foi pago?" e "é certo?"
  em "Mais opções" (abre sozinho quando é conta a pagar, que precisa do vencimento). Abas renomeadas: "Gasto ou
  recebimento", "Conta fixa".
- **Item 65.** Renda mostra as fontes; "Dá pra pagar o mês?", Metas, "Pra onde vai o dinheiro" e o gasto por
  categoria ficam fechados, um por vez.
- **Item 66.** Contas fixas separadas das verbas do mês; conta fixa diz "já pago neste mês"; verba diz quanto já foi
  e quanto falta (a mesma conta de `domain/verbas.js`).
- **Item 67.** Contas: "atualizado em 05/10 às 14:16" na linha; o botão é "Atualizar saldo" e mostra o saldo
  informado, o que mudou desde então e o saldo de agora.
- **Item 68.** Revisar mostra 10 favorecidos por vez (os de mais dinheiro); resolveu um, sobe o próximo.
- **Item 69.** Importar pergunta "Data na coluna 1, Descrição na 2, Valor na 3", contando da esquerda, com exemplo.
- **Item 29.** Cartão sem bandeira não mostra "Outra"; o "disponível" virou "limite livre". O "cabe agora" saiu com
  o bloco de cartões do Início.
- **Item 72.** Tocar num dia do calendário mostra o que tem nele (conferido); só o dia que cruza o zero é vermelho (13.2).
- **Item 75.** O parágrafo gigante sumiu da Agenda, do Fluxo e do Início (13.2 e 13.6); o do Plano sai na 13.8.
- **Item 30 (dado):** a fatura que veio só como "Compras até o fechamento" continua num lançamento só porque não há
  extrato com as compras; quando vier, a tela de Cartões já avisa e cancela o resumo.
- Conferido no navegador (390 px): as 6 abas, Configurações > Importar e Revisar, sem erro.

### 13.8 Plano de recuperação (feita, 09/10)

- **Item 76.** O gráfico de 12 meses saiu da abertura. Os números mês a mês continuam em "Os números por trás do plano".
- **Item 77.** "O que fazer agora" mostra só passos de hoje (até 3), sem parágrafo; "Mais adiante" guarda a virada de
  dezembro, limpar o nome, prazos longe e reserva (`quando: "hoje" | "depois"` em `montarPlanoDeAcao`).
- **Item 78.** Os rótulos deixaram de gritar ("ver logo", "com calma", "quando der") e Já resolvi / Lembrar depois /
  Não se aplica ficam no menu "⋯" de cada alerta.
- **Item 79.** Alavancas da vida real: Estoque e revenda (grupo negócio) deixou de ser sugestão de corte e a renda
  nova virou "Renovar ou repor CryptoPag, que acaba em 12/26", com as fontes do cadastro (repasse da GEDI fora).
- **Item 80.** Caminhos ficou recolhido em "Simular caminhos", no fim do Plano.
- **Item 81.** Cabeçalho "Sua recuperação" (`domain/recuperacao.js`, com teste): meta (quanto falta no pior dia e
  quantos nomes sujos), progresso (nome limpo X de N), próximo passo e o que mudou desde o mês passado (usa os
  instantâneos; sem mês anterior, diz isso em vez de inventar).
- **Item 82.** As metas (gastar, recuperar, investir) têm um lugar só: Plano › Metas. Renda aponta para lá e a
  pendência do Início também.
- **Item 83.** Plano tem 3 abas: Plano, Ano (Meu ano, Evolução, Relatórios, Por pessoa, em seções) e Metas
  (metas + patrimônio). Destinos antigos redirecionam.
- Conferido no navegador com o estado real (390 px), sem erro de página. 597 testes passando.

### 13.9 Textos, fonte e telas que não se atualizam (feita, 09/10)

- **Item 17.** O contexto das telas de cadastro (Cartões, Dívidas, Contas) é lido de novo a cada mudança de
  lançamento ou fatura (`assinarTambem`), então cancelar um resumo ou pagar uma parcela atualiza na hora. O painel de
  decisões também assina cartões e faturas. Objetivos e patrimônio já assinavam lançamentos, contas e dívidas.
- **Itens 84 e 85.** "Retrato", "baixar", "livre garantido", "cobertura" e "sobra depois do essencial" saíram dos
  textos. O botão "i" deixou de existir (`ajudaHtml` devolve vazio): quando o título precisa de ajuda, o título muda.
- **Item 86.** Dinheiro (13.7) e Plano (13.8) abrem sem título repetido em cima das abas.
- **Item 87.** Editar e Apagar ficam no menu "⋯" em Renda, Patrimônio, Metas e Perfil (os cadastros e
  lançamentos já estavam desde a 13.7); Apagar em vermelho dentro do menu.
- **Item 88.** Poppins e IBM Plex Mono vêm de `estilo/fontes/` (woff2, só o latim, ~80 KB), pela mesma origem. Não há
  mais chamada a serviço externo de fonte.
- **Item 89.** Leitura em andamento antes de uma gravação não pode mais guardar no cache o resultado velho
  (`versaoEscrita` por coleção em `dados/db.js`). Teste `testes/dbCache.test.js` falha sem a correção.
- **Item 90.** O nome do arquivo exportado usa a data local (`hojeISO`), não a UTC.

### 13.10 Dados reais e perguntas (feita no que é código, 09/10; o resto espera as respostas)

- **Item 48 (código).** Importar extrato é idempotente: cada linha ganha um `idExterno` estável (o do banco, ou
  conta + data + valor + descrição, com contador para linhas idênticas no mesmo arquivo), gravado no lançamento.
  Reimportar o mesmo arquivo acusa "mesmo identificador do banco" em vez de duplicar. Teste em `importacao.test.js`.
- **Não mexi nos dados** dos itens 39 a 47 e 49: cada um depende de uma resposta sua (abaixo). Gravar palpite no
  banco seria inventar. Assim que responder, entra pela skill `subir-painel`.
- **Perguntas abertas:** aluguel em out/nov; DAS de mar a ago pagos ou duplicados; aporte GEDI de R$ 1.500 saiu?;
  hora do saldo do Next (R$ 4.252,98) e se o R$ 0,00 da Carolina é real; validade das 4 ofertas do Serasa; Gedi/Tony
  é renda ou repasse; 3 protestos sem credor (R$ 4.927,09) são os mesmos de Bradesco/Mercado Pago/EDP?; cartão Next
  cancelado ainda deve saldo (R$ 328,66 e R$ 2.832,80)?; Jeep: a cotação de 05/10 já considera a parcela de 03/10?;
  "Equipe e freelancers" e "Ferramentas" contam como essencial?; água de outubro (R$ 319,61 previsto) está certa?

### Respostas do Cleison (09/10) e o que entrou no banco

- Aluguel só em dezembro, DAS de mar a ago não pagos, aporte GEDI ainda não saiu, R$ 0 da Carolina é real, ofertas do
  Serasa sem validade, Gedi/Tony é só repasse, cotação do Jeep já considera a parcela paga, água de outubro certa
  (vazamento já arrumado), equipe/ferramentas seguem como essencial: nada a mudar nesses dados.
- Salário da Carolina: outubro e novembro caem juntos em 07/11 (2 × R$ 4.750, provável). A de outubro ficou com
  competência 2026-10 para o painel não gerar outra.
- Aporte GEDI de R$ 1.500 passou para 10/11 (repassa no mês que vem, usando o dinheiro do Del Poente agora).
- As duas faturas do cartão Next cancelado (R$ 328,66 e R$ 2.832,80) ficaram ligadas à dívida do Bradesco.
- `COLECOES_LIDAS` voltou a ser exportado em `ferramentas/subirPainel.js` (a ferramenta de montar não rodava).

### Verbas à vista no Início (pedido do Cleison, 09/10)

- "Suas verbas do mês" no Início: para cada verba (lazer, combustível, mercado, almoço, fórmula do Caio, anúncios), o
  quanto já foi da cota, quanto ainda pode e uns quanto por semana, com o ritmo (no ritmo, gastando rápido, passou da
  cota). Tudo derivado dos lançamentos da categoria no mês (`painelDeVerbas`, com teste), nada gravado.
- O botão "Gastei" abre o lançamento já na categoria da verba. Gastar na mesma categoria é o que abate a cota.
- Conta com valor e data (internet, celular, fatura) continua sendo conta fixa, não verba.
