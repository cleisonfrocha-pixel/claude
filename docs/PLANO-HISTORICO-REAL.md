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

## Sprint 2: Carolina (Banco do Brasil) 2026

- Parser do extrato BB em `app/ferramentas/extrato/` (já existe a versão de trabalho).
- Salário da Secretaria da Educação como receita da fonte dela.
- Pix para o Cleison **não** viram lançamento novo: já existem como transferência
  no lado do Next (casar por valor e data ±1 dia).
- Pix para a Shopee viram `pagamento_fatura` do Crédito Shoppe (histórico).
- Principia Educação: mensalidade jan a mar, quitada. Depósito em dinheiro de
  R$ 2.650 em 24/09: perguntar a origem.
Portão: a conta dela fecha com o saldo do PDF mês a mês.

## Sprint 3: trava de reconciliação e ID do banco (código)

- Campo `idExterno` na transação (UUID do Nubank, documento do Bradesco e do BB).
- `importacao.js` recusa lote cujo saldo não fecha e ignora o que já tem `idExterno`.
- Parsers de Next, Nubank e BB saem do scratchpad para `app/ferramentas/extrato/`.
Portão: reimportar o mesmo PDF devolve 0 novos; PDF adulterado é recusado. Testes.

## Sprint 4: fila "Revisar" por favorecido (código + tela)

Hoje cerca de 190 despesas estão como "Outros (a classificar)". A tela agrupa por
favorecido ("Gringo Pay, 1 lançamento, R$ 1.400") e uma resposta classifica todos
os lançamentos do mesmo favorecido, e fica como **regra** para os próximos extratos.
- Coleção `regrasClassificacao` {contem, categoria, pessoa}.
- Importação futura aplica regra e só pergunta o favorecido desconhecido.
Portão: classificar 1 favorecido atualiza todos; novo extrato só pergunta o novo.

## Sprint 5: motor `historicoAno.js` (domínio puro, com teste)

Calculado na leitura, nada gravado:
- Renda por fonte e por mês (Sociable, Gábia, clientes, salário da Carolina).
- Saídas por grupo e por mês, resultado do mês, **apoio entre os dois** separado
  de renda.
- Tendência (3 meses contra os 3 anteriores), pior e melhor mês, piso observado
  de cada fonte, % do gasto ainda pendente de classificação.
- Cada número devolve os lançamentos que o formam (exigência do §9 e do §17).

## Sprint 6: tela "Meu ano" e card no Início

- Aba em Relatórios: linha por mês, composição das saídas, renda por fonte com o
  selo "fixa", "irregular" ou "caiu".
- Card no Início: "Seu ano até agora" com resultado médio e pior mês, apontando
  para a tela.
Portão: os totais da tela batem com o extrato conferido.

## Sprint 7: plano e cenários passam a usar o histórico real

- Renda garantida de cada fonte = **piso observado** nos últimos meses, não o valor
  cadastrado. Fonte que só apareceu uma vez entra como eventual.
- Gasto variável = média real das categorias variáveis (mercado, delivery,
  transporte), sem contar o que já está em recorrência (evita dupla contagem).
- Cartão: uso mensal vem da média das faturas pagas, não de estimativa.
- Todo plano mostra "baseado em N meses reais".
- `perfil/casa` e a skill `gerar-plano` passam a ler o resumo do histórico.
Portão: o plano de 12 meses muda quando se troca o piso de uma fonte; teste cobre.

## Sprint 8: faturas dos cartões e extratos que faltam

- Faturas Nubank PF e PJ em PDF ou CSV (abre os cerca de R$ 2,9 mil por mês).
- Extrato Pagseguro/Next cartão quando existir.
- Mercado Pago (loja).
Portão: gasto sem detalhe de fatura cai para zero nos meses cobertos.

## Pendências de dados (precisam do Cleison)

1. Dia de fechamento do cartão Next.
2. Origem do depósito em dinheiro de R$ 2.650 na conta da Carolina (24/09).
3. Favorecidos de saída sem nome (Gringo Pay R$ 1.400, José Roberto R$ 1.200,
   Ana Maria R$ 1.000, Francielen R$ 1.000, Guillermo R$ 955, Giuliana R$ 700).
4. Outra conta da Carolina que também manda dinheiro (R$ 2.414 em jan a mai que
   não vêm do Banco do Brasil).

## Ordem sugerida

1 e 2 (dados) agora; 3 antes de qualquer novo extrato; 4 junto com 3; 5, 6 e 7 em
seguida, nessa ordem, porque cada uma depende da anterior; 8 quando os arquivos
chegarem. Regra de escopo do CLAUDE.md: nada de P2 ou P3 no meio.
