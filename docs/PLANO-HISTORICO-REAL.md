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
| 5 | Transferência e pagamento de fatura sem pessoa (98 lançamentos) | baixa | **corrigido** na ferramenta (herda do cartão ou da conta) e teste; o motor já usava a conta como reserva |
| 6 | Mudança de cadastro move o plano em dezenas de milhares sem avisar (CryptoPag eventual: R$ 30 mil nos 12 meses; Sociable 5.200 para 4.500: R$ 8,4 mil) | alta | **aberto**: mostrar "o que mudou no plano" antes de gravar mudança de renda |
| 7 | A importação sozinha não muda nenhum número do plano (gasto do dia a dia continua R$ 0,00) | alta | **aberto**: depende das Sprints 5 a 7 |
| 8 | `forcar` no lote histórico desliga a checagem de duplicata: reenviar o mesmo pedido dobraria tudo | alta | **aberto**: proibir `forcar` em lote sem `idExterno`; fazer backfill de `idExterno` nos 605 já gravados |
| 9 | Desfazer o lote 1 deixaria o lote 2 com categoria apagada (a categoria Delivery nasceu no lote 1) | média | **aberto**: desfazer deve listar dependentes e recusar fora de ordem |
| 10 | Leitura da coleção inteira sem teto documentado; a consulta com limite aceita no máximo 1.000. Hoje 718 | alta, em semanas | **aberto**: aviso a partir de 900 e partição por ano (`transacoesAAAA`) |
| 11 | Banco sem cópia de segurança: só o registro do lote | média | **aberto**: `exportar` do estado completo antes e depois de cada carga |
| 12 | 637 lançamentos "não revisados" e 206 despesas em "Outros" (R$ 25,1 mil) | média | Sprint 4 |
| 13 | 7 faturas Nubank pagas sem compra lançada: R$ 20,8 mil entram como "gasto sem detalhe" | média | Sprint 8 |
| 14 | Dados de terceiros (nomes em Pix) no banco do artefato | média | conferido: o artefato está **privado** (só o dono). Para a Carolina abrir, compartilhar pelo menu Share do artefato, sabendo que ela passa a ver tudo |
| 15 | Lançamentos manuais do Next de 03 a 05/10 com data diferente do extrato (Jeep, TV, água) | baixa | aberto: conciliar quando o saldo do Next for conferido |

### Trabalho da sprint (o que falta)
1. Mostrar "o que muda no plano" ao gravar mudança de renda ou recorrência (#6).
2. `idExterno` em tudo: backfill, `forcar` bloqueado em lote, desfazer com dependências (#8, #9).
3. Partição e aviso de volume da coleção `transacoes` (#10).
4. `exportar` do estado e rodar `auditar-estado.mjs` ao fim de cada lote (#11).
5. Reauditar depois das Sprints 4, 5 e 7 com o mesmo roteiro.

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
