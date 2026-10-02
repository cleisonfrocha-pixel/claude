# Auditoria de causa raiz — 02/10/2026

Pedido do Cleison: entender por que as telas não se conversam (conta marcada
como paga, salário marcado como recebido, "Pode gastar" confuso, atrasadas sem
data) e o que aplicar. O relatório completo está no documento "Auditoria do
Painel Financeiro", aba "Rodada 5: auditoria de causa raiz". Aqui fica o resumo
técnico, para quem abrir o repositório.

Método: baixar as coleções do banco real, rodar os motores de `src/domain`
sobre elas (sem tela) e comparar os números; e clicar Paguei no painel com o
banco real carregado, lendo o Início antes e depois.

## Falhas confirmadas

1. **Pagar conta com vencimento até a data do saldo inicial não move o saldo.**
   `darBaixaTransacao` mantém `data` = vencimento (23/09) e
   `calcularSaldoConta` ignora `data <= dataSaldoInicial` (01/10). O "Vai sair"
   cai, o saldo não, e o "Pode gastar" sobe (R$ 2.865,37 → 3.022,16 ao pagar
   R$ 156,79).
2. **A trilha diária do "Pode gastar" descarta despesa prevista com data anterior
   a hoje que não está marcada atrasada** (verbas "sem dia fixo" de outubro,
   datadas 01/10): R$ 2.435,00. `calcularComprometido` soma, `compromissosPorDia`
   descarta. Em conta + entra − sai = R$ 8.555,68; a trilha termina em
   R$ 10.990,68. Ponto mais baixo real ≈ R$ 430, não R$ 2.865. O mesmo erro está
   no Fluxo de caixa, no mapa dos 12 meses e no aviso de cobertura do calendário.
3. **Lançar à mão não concilia com a conta prevista** (Vivo SET R$ 92,00 pago
   x Vivo R$ 94,62 previsto em 10/10).
4. **Cartão:** sem forma de pagamento por conta (79 de 79 contas abertas saem do
   Next por padrão, 0 no cartão); limite disponível informado não é guardado;
   compra prevista consome limite (Nubank PJ: usado R$ 3.493,80, real
   R$ 2.297,10); fatura da Shopee cadastrada como despesa da conta.
5. **Renda sem "conta onde cai"** (Carolina, Gedi/Tony, Gábbia): o Recebi cai na
   primeira conta ativa. Del Poente (eventual) com R$ 5.000 contado como
   provável.
6. **Números do Início que não se explicam** (Em conta + Vai entrar − Vai sair
   ≠ Pode gastar), "Vai entrar" com R$ 7.700 de 01/11, sobra por competência
   sem ponte para o caixa, atrasadas sem data.

## Raiz

Seis máquinas para "quanto sai/entra" (clareza de caixa, trilha diária, visão
do mês, projeção de 12 meses, contas do mês, cenários); uma data por lançamento
fazendo papel de vencimento, pagamento e competência; faltam forma de
pagamento, conta onde cai, limite informado, verba consumível e "conferir
saldo".

Nenhuma alteração de código nesta rodada: é auditoria.
