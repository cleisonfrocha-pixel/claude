# Plano de implantação: histórico real do ano (Fase 12)

Objetivo: o painel conhece o ano de 2026 do Cleison e da Carolina, mostra
histórico, evolução e clareza, e **todo plano futuro nasce desses números reais**,
sem palpite. Regras do CLAUDE.md valem em tudo: centavos inteiros, transferência
não é receita nem despesa, compra no cartão não é pagamento da fatura, nada de
total gravado, incerto fora do saldo seguro, todo número aponta os lançamentos
que o originaram.

## Princípio anti-alucinação (vale para todas as sprints)

1. **Fato** é o lançamento que veio do extrato, com o ID do banco guardado.
2. **Classificação** (categoria, pessoa) tem estado: `regra`, `confirmada` ou
   `pendente`. Relatório mostra quanto do gasto ainda está pendente.
3. **Inferência** só aparece rotulada ("estimado") e nunca é gravada como fato.
4. **Todo lote tem trava de reconciliação**: saldo anterior + entradas + saídas
   precisa fechar com o saldo impresso no PDF. Se não fecha, o lote não sobe.
5. Reimportar o mesmo extrato nunca duplica (chave: ID do banco, não valor e data).

## Estado em 05/10/2026 (feito)

_Atualizado após a Sprint 1, a Sprint 3 e a auditoria da Sprint 9 (abaixo)._

- Next jan a set e Nubank PJ (CNPJ 46.040.348/0001-03) jan a set: **560 lançamentos**,
  9 faturas históricas, 3 categorias novas, lote único (dá para desfazer).
- Conferido no motor do app: saldo das contas idêntico antes e depois.
- Ferramenta de subir ganhou `pagamento_fatura` com `historico: true` (cria a
  fatura do mês e aceita mais de um pagamento nela). Teste incluso.
- Fora do lote, de propósito: Invest Fácil e poupança (movimento neutro), 2 boletos
  do cartão Next (falta o dia de fechamento), Zapay pago e devolvido, reembolsos
  de bet e de 99 Food, transferências para conta própria sem conta cadastrada.

## Sprint 1: cadastro certo (dados, sem código)

Pela skill `subir-painel`, com "desfaz":
- Sociable R$ 4.500 (fonte e o recebimento de 01/10 que está como R$ 5.200).
- CryptoPag como eventual (só apareceu uma vez no ano).
- Pagseguro com uso mensal 0 (sem fatura ainda, não há base).
- Seguro fiança R$ 222,11 sem data de fim.
- DAS: 8 guias (mar R$ 108,92, abr 108,01, mai 107,04, jun 105,99, jul 100,90,
  ago 90,88 em atraso; set 86,05 vence 20/10; out 86,05 vence 23/11) e recorrência
  mensal de R$ 86,05 a partir da competência de novembro.
- Cartão Next (precisa do dia de fechamento) e as faturas de R$ 328,66 e R$ 2.832,80.
- Datas do Jeep, água e luz de 03/10 que saíram em 05/10 (conferir contra o extrato).
Portão: Início mostra as DAS em atraso e o saldo das contas bate com o app dos bancos.

## Sprint 2: Carolina (Banco do Brasil) 2026 (feita)

- Parser `app/ferramentas/extrato/ler_bb.py` reescrito: lê cada página separada e junta o texto
  de operações que quebram em 2 ou 3 linhas. Os 9 extratos (jan a set) fecham dia a dia e mês
  a mês com o saldo impresso no PDF. A trava `conferencias` do `subir-painel` conferiu antes de gravar.
- Lote `99672ess8f1v4gsfa92d`: 149 lançamentos + 9 faturas do Crédito Shoppe + categoria "Tarifas bancárias".
  - 9 salários da Secretaria da Educação (R$ 4,6 mil a 5,2 mil) na conta dela, fonte "Salário - Carolina".
  - Pix para a Shopee viram `pagamento_fatura` histórico do Crédito Shoppe (28 pagamentos, 9 faturas).
  - Pix para o Cleison **não** viraram lançamento novo: 15 casaram com as transferências que já existiam
    (valor e data até 4 dias). Os R$ 2.650 de 24/09 (depósito em dinheiro do Gedi) já estavam como receita.
  - Pix entre contas dela e entre ela e o Cleison sem par viram `repasse` (não é renda nem gasto).
  - Pix rejeitado/devolvido anula o envio (Ana Maria 03/08 x2, 99 de 06/07) ou abate do Pix anterior (Shopee 19/03).
  - Principia (3 mensalidades), Claro, mercado, iFood, tarifas do banco classificados; o resto é "(a classificar)" e vai para a fila Revisar.
- Corrigido junto: a ferramenta gravava despesa/receita no nome do titular mesmo na conta da Carolina.
  Agora herda a pessoa do cartão ou da conta (teste novo). 207 lançamentos antigos acertados no banco
  (141 da Carolina que estavam no nome do Cleison + 98 transferências/faturas que estavam sem dono).
- Saldo dela: continua R$ 0,00 (a conta só conta lançamentos depois de 02/10). O extrato fecha 30/09 com R$ 12,33.
Em aberto (perguntas ao Cleison): 17 transferências Next <-> Carolina antigas não existem no extrato do BB
(ex.: R$ 2.300 de 29/05); parecem de outra conta dela. Pix da Carolina para a mãe dela (R$ 150, 50, 500) contam como gasto.

## Sprint 3: trava de reconciliação e ID do banco (código)

- Campo `idExterno` na transação (UUID do Nubank, documento do Bradesco e do BB).
- `importacao.js` recusa lote cujo saldo não fecha e ignora o que já tem `idExterno`.
- Parsers de Next, Nubank e BB saem do scratchpad para `app/ferramentas/extrato/`.
Portão: reimportar o mesmo PDF devolve 0 novos; PDF adulterado é recusado. Testes.

## Sprint 4: fila "Revisar" por favorecido (feita)

Hoje cerca de 190 despesas estavam como "Outros (a classificar)". Agora existe a aba
**Dinheiro > Revisar**: os lançamentos pendentes aparecem agrupados por favorecido, os de
mais dinheiro primeiro. Uma resposta resolve todos do mesmo nome e, se marcado "Lembrar",
vira regra para os próximos extratos.
- Novo tipo de lançamento **repasse**: dinheiro de outra pessoa que passou por você (a sogra que
  vendeu a geladeira, o pai que deu o dinheiro do IPVA dele). Mexe no saldo, não é renda nem gasto.
- Coleção `regrasClassificacao` {chave, decisao}. O `subir-painel` aplica a regra quando o
  pedido vem sem categoria (repasse vira repasse, categoria preenche a que faltou).
- Domínio puro em `domain/favorecidos.js`, dados em `dados/favorecidosRepo.js`, tela `ui/telas/revisar.js`.
- Respostas do Cleison de 05/10 já aplicadas: sogra e pai = repasse; Guillermo (sócio) = Escritório;
  Giuliana (editora de vídeo) = Equipe e freelancers; Francielen = compra; 4 regras guardadas.
Portão cumprido no navegador: clicar "É repasse" em um favorecido atualiza todos os lançamentos
dele, grava a regra e some da fila; escolher categoria faz o mesmo. 536 testes.

## Sprint 5: motor `historicoAno.js` (feita)

`domain/historicoAno.js`, puro e com 11 testes. Por mês: renda por fonte, saída por grupo (fatura paga
sem compras vira "cartão sem detalhe"), resultado, repasses e apoio entre pessoas à parte. Por fonte: piso,
média e selo (fixa, irregular, caiu, eventual, avulsa) só dos meses fechados. Tendência (3 contra 3),
melhor e pior mês e % do gasto sem classificar. Cada número devolve os ids dos lançamentos. Filtra por pessoa.
Números reais (jan a set): resultado médio R$ 292 por mês, pior mês setembro (-R$ 6.283), Sociable e salário
da Carolina fixos, Gábia irregular (piso R$ 0), 21% do gasto sem classificar.

## Sprint 6: tela "Meu ano" e card no Início (feita)

Plano > Meu ano (Casa toda, Cleison, Carolina): resumo, mês a mês com detalhe de cada mês, de onde vem o dinheiro
(com selo e piso), para onde foi (rosca) e quanto falta classificar. Card "Seu ano até agora" no Início
leva para a tela. Conferido no navegador com o estado real.

## Sprint 7: plano e cenários passam a usar o histórico real (feita)

- `domain/pisoDaRenda.js`: piso, média e selo de cada fonte pelos meses fechados (mês sem receber conta como zero).
- Projeção (`previstos.js`): fonte fixa em dia conta o menor mês real (nunca acima do combinado); irregular ou que caiu
  entra pela média real **como incerta** (fora do saldo seguro); menos de 3 meses de história, vale o cadastro.
- Gasto do dia a dia: categoria a categoria, o que passou da recorrência cadastrada (mercado real maior que "mercado do mês")
  vira gasto habitual; antes uma categoria folgada escondia o estouro de outra. Com os dados reais passou de R$ 0 para
  R$ 4,5 mil por mês, a maior parte ainda em "Outros" (sem classificar).
- Cartão: uso mensal = média das últimas 3 faturas fechadas (compras ou pagamento); cadastro só quando há menos de 2.
- Cenários: renda garantida de fonte fixa/recorrente também usa o piso real.
- "Baseado em N meses reais" no Fluxo de caixa e na visão geral do Plano; a IA (Perguntar) lê a mesma frase;
  `app/ferramentas/auditoria/resumo-historico.mjs` e a skill `gerar-plano` leem o resumo antes de escrever plano.
- Efeito medido no estado real (12 meses, saldo seguro): de R$ -61 mil para R$ -140 mil. O número está mais feio porque
  agora conta o que a vida real gasta; classificar o "Outros" mostra quanto disso é gasto de verdade.
Testes: `testes/rendaPeloHistorico.test.js` (inclui "o plano muda quando o piso da fonte muda").

## Sprint 8: faturas dos cartões e extratos que faltam

- Faturas Nubank PF e PJ em PDF ou CSV (abre os cerca de R$ 2,9 mil por mês).
- Extrato Pagseguro/Next cartão quando existir.
- Mercado Pago (loja).
Portão: gasto sem detalhe de fatura cai para zero nos meses cobertos.

## Sprint 9 (extra): endurecimento depois da carga em massa

Auditoria feita em 05/10/2026, com o painel real (718 lançamentos, 480 KB) e o app
rodando no navegador. Ferramenta: `app/ferramentas/auditoria/auditar-estado.mjs`.

### O que a auditoria confirmou (sem problema)
- Referências: nenhuma quebrada (conta, cartão, categoria, pessoa, fatura, fonte, dívida).
- Validade: todos os lançamentos passam no validador do app; datas e centavos inteiros.
- Transferências: as 40 têm duas pernas, mesmo valor, mesma data, contas diferentes.
- **Conservação:** documentos gravados mais o que ficou de fora igual ao extrato, centavo a
  centavo, no Next e no Nubank. Saldos de hoje pelo motor: Next R$ 2.287,96, Nubank R$ 2.430,33.
- App abre em cerca de 0,6 s com o volume novo, plano calculado em menos de 80 ms, sem erro de página.
- Desfazer o lote grande apaga 573 documentos (560 lançamentos, 9 faturas, 3 categorias, 1 registro).
- As 3 "duplicatas" idênticas têm documento bancário diferente: são reais.

### Achados e situação
| # | Achado | Gravidade | Situação |
|---|---|---|---|
| 1 | Saldo do Nubank no painel R$ 514 acima do extrato (compras no débito de 02 a 05/10 sem lançar) | alta | **corrigido** (saldo pelo extrato, lote da janela 20/09 a 05/10) |
| 2 | Conta de luz de R$ 156,79 lançada no Next; saiu do Nubank | média | **corrigido** |
| 3 | Gedi de setembro (R$ 2.650 em espécie, depositado na conta da Carolina) sem receita | média | **corrigido** (receita na fonte Gedi / Tony) |
| 4 | Alerta falso "receita subiu 241%": comparava o previsto do mês com o recebido do anterior | média | **corrigido** (só compara recebido com recebido, a partir do dia 20) e teste |
| 5 | Transferência e pagamento de fatura sem pessoa (98 lançamentos) | baixa | **corrigido** na ferramenta e nos dados. Na Sprint 2 apareceu o mesmo defeito em despesa e receita (caíam no titular): corrigido também, com teste, e 207 lançamentos acertados no banco |
| 6 | Mudança de cadastro move o plano em dezenas de milhares sem avisar (CryptoPag eventual: R$ 30 mil nos 12 meses; Sociable 5.200 para 4.500: R$ 8,4 mil) | alta | **aberto**: mostrar "o que mudou no plano" antes de gravar mudança de renda |
| 7 | A importação sozinha não muda nenhum número do plano (gasto do dia a dia continua R$ 0,00) | alta | **corrigido** pela Sprint 7: gasto do dia a dia agora R$ 4,5 mil por mês, renda e cartão pelo real |
| 8 | `forcar` no lote histórico desliga a checagem de duplicata: reenviar o mesmo pedido dobraria tudo | alta | **corrigido**: pedido com mais de 20 itens e `forcar` sem `idExterno` é recusado, com teste. Backfill dos 605 antigos não é necessário: o que já entrou fica protegido pela checagem de valor e data, e todo extrato novo traz `idExterno` |
| 9 | Desfazer o lote 1 deixaria o lote 2 com categoria apagada (a categoria Delivery nasceu no lote 1) | média | **corrigido**: desfazer recusa e lista o que depende do lote, com teste |
| 10 | Leitura da coleção inteira sem teto documentado; a consulta com limite aceita no máximo 1.000. Hoje 718 | alta, em semanas | aviso **feito** (900 médio, 1.000 alto, no Plano > Qualidade dos dados e na auditoria). Hoje 867. Partição por ano é a próxima tarefa antes de carregar 2025 ou novas faturas |
| 11 | Banco sem cópia de segurança: só o registro do lote | média | **feito como rotina**: a skill `subir-painel` baixa o estado antes de cada carga e roda `auditar-estado.mjs` depois; essa pasta é a cópia |
| 12 | 637 lançamentos "não revisados" e 206 despesas em "Outros" (R$ 25,1 mil) | média | Sprint 4 feita, ficaram 21% do gasto sem classificar (R$ 21 mil, 229 lançamentos): resolver na aba Revisar |
| 13 | 7 faturas Nubank pagas sem compra lançada: R$ 20,8 mil entram como "gasto sem detalhe" | média | Sprint 8 |
| 14 | Dados de terceiros (nomes em Pix) no banco do artefato | média | conferido: o artefato está **privado** (só o dono). Para a Carolina abrir, compartilhar pelo menu Share do artefato, sabendo que ela passa a ver tudo |
| 15 | Lançamentos manuais do Next de 03 a 05/10 com data diferente do extrato (Jeep, TV, água) | baixa | aberto: conciliar quando o saldo do Next for conferido |

### Trabalho da sprint (o que falta)
1. Mostrar "o que muda no plano" ao gravar mudança de renda ou recorrência (#6). Aberto.
2. Partição por ano da coleção `transacoes` (#10), antes de passar de 1.000.
3. Conciliar as datas dos lançamentos manuais do Next (#15).
4. Reauditar depois de cada carga com `auditar-estado.mjs` (feito após as Sprints 2, 4 e 7).

## Pendências de dados (precisam do Cleison)

1. CryptoPag é recorrente? Só aparece uma vez em 2026 (R$ 2.500 em 01/10); mudar para eventual
   tirou R$ 30 mil da projeção de 12 meses. Se começou em outubro, volta a recorrente com início 2026-10.
2. Saldo atual do Next no app (corrente mais Invest Fácil), para fechar a conciliação.
3. Favorecidos de saída sem nome (Gringo Pay R$ 1.400, José Roberto R$ 1.200,
   Ana Maria R$ 1.000, Francielen R$ 1.000, Guillermo R$ 955, Giuliana R$ 700).
4. Outra conta da Carolina que também manda dinheiro (R$ 2.414 em jan a mai que
   não vêm do Banco do Brasil).

## Ordem sugerida

1 e 2 (dados) agora; 3 antes de qualquer novo extrato; 4 junto com 3; 5, 6 e 7 em
seguida, nessa ordem, porque cada uma depende da anterior; 8 quando os arquivos
chegarem. Regra de escopo do CLAUDE.md: nada de P2 ou P3 no meio.
