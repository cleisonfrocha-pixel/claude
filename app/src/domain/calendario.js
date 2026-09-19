// Domínio puro: calendário financeiro (§6). "O sistema precisa enxergar o
// que ainda não aconteceu, porque grande parte da ansiedade financeira vem
// de compromissos futuros que já estão contratados" (texto do blueprint).
//
// Duas perguntas, uma depois da outra: que dias têm compromisso (e quanto),
// e — caminhando o saldo dia a dia — em que dia isso aperta de verdade.

import { dataVencimentoFatura } from "./transacoes.js";

/**
 * Agrupa compromissos e receitas previstas por data, dentro de [de, ate].
 * Despesa direta (numa conta) usa sua própria data. Despesa em cartão NÃO
 * entra individualmente — o que pesa no caixa é o vencimento da fatura
 * inteira, não cada compra separada (mesma regra de não duplicar dinheiro
 * das fases anteriores, aplicada ao calendário).
 *
 * `faturas` precisa vir com `id` embutido (cruza com `transacao.faturaId`) —
 * mesma exigência de domain/caixa.js e domain/cartoes.js.
 */
export function compromissosPorDia({ transacoes, faturas, cartoes, de, ate }) {
  const porDia = new Map();
  function item(data, valorComSinal, dados) {
    if (!data || data < de || data > ate) return;
    if (!porDia.has(data)) porDia.set(data, { data, entradasCentavos: 0, saidasCentavos: 0, itens: [] });
    const dia = porDia.get(data);
    if (valorComSinal >= 0) dia.entradasCentavos += valorComSinal;
    else dia.saidasCentavos += -valorComSinal;
    dia.itens.push(dados);
  }

  for (const t of transacoes || []) {
    if (t.status === "pago" || t.status === "cancelado") continue;
    if (t.tipo === "despesa" && t.contaId) {
      item(t.data, -(Number(t.valorCentavos) || 0), {
        tipo: "despesa", descricao: t.descricao || "Despesa", valorCentavos: Number(t.valorCentavos) || 0,
        atrasado: t.status === "atrasado", certeza: t.certeza,
      });
    } else if (t.tipo === "receita") {
      item(t.data, Number(t.valorCentavos) || 0, {
        tipo: "receita", descricao: t.descricao || "Receita", valorCentavos: Number(t.valorCentavos) || 0,
        atrasado: t.status === "atrasado", certeza: t.certeza,
      });
    }
    // despesa em cartão: ignorada aqui de propósito — ver fatura abaixo.
  }

  const totalPorFatura = new Map();
  for (const t of transacoes || []) {
    if (!t.faturaId) continue;
    totalPorFatura.set(t.faturaId, (totalPorFatura.get(t.faturaId) || 0) + (Number(t.valorCentavos) || 0));
  }
  const cartaoPorId = new Map((cartoes || []).map((c) => [c.id, c]));
  for (const f of faturas || []) {
    if (f.status === "paga") continue;
    const cartao = cartaoPorId.get(f.cartaoId);
    if (!cartao) continue;
    const total = totalPorFatura.get(f.id) || 0;
    if (total <= 0) continue;
    const vencimento = dataVencimentoFatura(cartao, f.competencia);
    item(vencimento, -total, { tipo: "fatura", descricao: `Fatura ${cartao.apelido || "do cartão"}`, valorCentavos: total, atrasado: false, certeza: "confirmado" });
  }

  return Array.from(porDia.values()).sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Caminha o saldo dia a dia a partir de `saldoInicialCentavos`, aplicando
 * cada dia com compromisso/receita na ordem. Dias sem nenhum evento nem
 * precisam aparecer em `dias` — o saldo só muda em dias com evento, então
 * pular os vazios não muda a trajetória (é por isso que
 * `compromissosPorDia` só devolve dias com algo acontecendo).
 */
export function calcularCoberturaDiaria(saldoInicialCentavos, dias) {
  let saldo = saldoInicialCentavos;
  const resultado = [];
  for (const dia of dias) {
    const saldoAntes = saldo;
    saldo = saldo + dia.entradasCentavos - dia.saidasCentavos;
    resultado.push({ ...dia, saldoAntesCentavos: saldoAntes, saldoDepoisCentavos: saldo, coberto: saldo >= 0 });
  }
  return resultado;
}

/** O dia de maior pressão financeira: a maior saída líquida do período
 * (saídas menos entradas do mesmo dia). `null` quando não há nenhum dia. */
export function diaDeMaiorPressao(dias) {
  if (!dias || !dias.length) return null;
  return dias.reduce((pior, d) => {
    const pressaoAtual = d.saidasCentavos - d.entradasCentavos;
    const pressaoPior = pior.saidasCentavos - pior.entradasCentavos;
    return pressaoAtual > pressaoPior ? d : pior;
  });
}

/** Os dias em que o saldo projetado (já caminhado) fica negativo — as
 * obrigações desses dias estão sem cobertura suficiente. */
export function diasSemCobertura(diasComCobertura) {
  return (diasComCobertura || []).filter((d) => !d.coberto);
}
