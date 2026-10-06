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
