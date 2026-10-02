# Auditoria final — Sprints 30 a 39 (02/10/2026)

Feita com os dados reais do Cleison carregados num ambiente de teste isolado
(Playwright, celular 390×844 e desktop 1280×900), mais 392 testes do motor.
66 verificações automáticas, 0 falhas, 0 erros de JavaScript.

## Os 21 itens da Lista Mestra

| # | Item | Situação | Onde foi resolvido |
|---|------|----------|--------------------|
| 1 | Dois motores tratavam a renda de jeitos opostos | Resolvido | S31 `domain/mes.js` |
| 2 | Caminhos vazio | Resolvido | S31 `cenarios.js` (mês atual + aviso "sem histórico real") |
| 3 | 18 cards quase idênticos no Plano | Resolvido | S35 `agruparAchados` (uma linha, "Ver todos") |
| 4 | Patrimônio mostrava só a dívida | Resolvido | S37 aviso "Patrimônio incompleto"; falta cadastrar os bens (dado) |
| 5 | Conta e Cartão visíveis juntos | Resolvido | S30 `[hidden]` forçado |
| 6 | "Seguro pra gastar" não bate com a soma | Resolvido | Início explica: ponto mais baixo vs saldo final dos 30 dias |
| 7 | "Dia mais apertado" com datas diferentes | Resolvido | rótulos distintos ("Maior saída num dia só") |
| 8 | "Lançar" não lançava | Resolvido | S30/S32 abre o formulário; ＋ central |
| 9 | Data em mês/dia | Resolvido | S30 data por extenso sob todo campo de data |
| 10 | Texto de desenvolvedor na tela | Resolvido | S30 |
| 11 | Tudo em "Outros" | Resolvido | S30 categorias novas; 12 recorrências e ~47 lançamentos recategorizados |
| 12 | Itens sem dia viravam "Atrasado" | Resolvido | S31 `semDia`; aplicado nas 4 recorrências e 12 previstos reais |
| 13 | Metas de proteção zeradas sem empurrão | Resolvido | S39 "Completar seu retrato" pede custo desejado e meta de recuperação |
| 14 | Cartão mostrava limite como disponível | Resolvido | S38 "sem dado de uso ainda" |
| 15 | "filho" em minúsculo | Resolvido | S30 |
| 16 | Dívidas fora da barra de baixo | Resolvido | S32 Início · Dinheiro · ＋ · Dívidas · Plano |
| 17 | Desktop em coluna única | Resolvido | S34/S35 duas colunas |
| 18 | Blocos escondidos repetiam os 18 cards | Resolvido | S35/S39 listas por prazo também agrupadas |
| 19 | 4 de 7 cartões em vermelho | Resolvido | S34 grade removida |
| 20 | Carrossel cortado | Resolvido | S34 carrossel removido |
| 21 | Etiqueta "ativa" mudava de lugar | Resolvido | S39 só "pausada" tem etiqueta |

## Achados novos desta rodada (corrigidos)

- Laço infinito na dica de data (S30) travava a página ao abrir formulário com
  data. Corrigido na S32.
- Metas usavam uma "margem" diferente da "sobra" do Plano. Unificado em
  `sobraDoMes` (S36).
- Extrato duplicava gasto já previsto. Agora dá baixa no previsto (S38).

## Pendências que dependem de dado, não de código

- Cadastrar os bens: Jeep, galpão, equipamentos (hoje o patrimônio mostra só dívida).
- Del Poente R$ 5.000 e cartão Shoppe Esposa ainda não cadastrados.
- Dia de vencimento de Nubank e Pagseguro, saldo original e início do Jeep: estimados.
- Fórmula do Caio e Anúncios do Gedi lançados à mão; fatura de setembro ainda não chegou.
- Dados da Carolina: virão depois (já há aviso no Início).
- Nota honesta: o painel roda dentro do claude.ai; não instala como app separado.
