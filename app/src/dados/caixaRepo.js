// Carrega os dados de que o painel de clareza de caixa (domain/caixa.js)
// precisa, e mantém a assinatura viva nas duas coleções que realmente
// mudam o resultado (contas e transações) — cartões e faturas mudam bem
// menos, então é recarregado junto sempre que as outras duas mudam, sem
// precisar de uma assinatura própria.

import { contas, cartoes } from "./repositorios.js";
import { transacoes } from "./transacoesRepo.js";
import { faturas } from "./faturasRepo.js";
import { calcularClarezaDeCaixa } from "../domain/caixa.js";
import { hojeISO } from "../domain/tempo.js";

// domain/caixa.js precisa do id de cada conta/fatura/cartão embutido no
// próprio objeto (para cruzar transacao.contaId / transacao.faturaId /
// fatura.cartaoId) — é a única camada que trabalha assim; transações
// continuam como "dados" puros, sem id, igual ao resto do app.
function comId(lista) {
  return lista.map((item) => ({ id: item.id, ...item.dados }));
}

async function carregarTudo() {
  const [listaContas, listaCartoes, listaFaturas, listaTransacoes] = await Promise.all([
    contas.listar(), cartoes.listar(), faturas.listar(), transacoes.listar(),
  ]);
  return {
    contas: comId(listaContas),
    cartoes: comId(listaCartoes),
    faturas: comId(listaFaturas),
    transacoes: listaTransacoes.map((t) => t.dados),
  };
}

/** Uma leitura única do painel — para telas que não precisam ficar ao vivo. */
export async function calcularAgora(horizonteDias) {
  const dados = await carregarTudo();
  return calcularClarezaDeCaixa({ ...dados, hoje: hojeISO(), horizonteDias });
}

/** Assina o painel ao vivo: `cb` recebe o resultado agora e de novo sempre
 * que uma conta ou transação mudar. Retorna a função de cancelamento. */
export function assinarClarezaDeCaixa(cb, horizonteDias) {
  let cancelada = false;
  async function recalcular() {
    if (cancelada) return;
    const dados = await carregarTudo();
    if (cancelada) return;
    cb(calcularClarezaDeCaixa({ ...dados, hoje: hojeISO(), horizonteDias }));
  }
  const pararContas = contas.assinar(recalcular);
  const pararTransacoes = transacoes.assinar(recalcular);
  return () => {
    cancelada = true;
    pararContas();
    pararTransacoes();
  };
}
