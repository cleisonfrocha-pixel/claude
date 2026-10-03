// Domínio puro: calendário financeiro (§6). "O sistema precisa enxergar o
// que ainda não aconteceu, porque grande parte da ansiedade financeira vem
// de compromissos futuros que já estão contratados" (texto do blueprint).
//
// Duas perguntas, uma depois da outra: que dias têm compromisso (e quanto),
// e — caminhando o saldo dia a dia — em que dia isso aperta de verdade.

import { dataVencimentoFatura, dataPagamentoPrevisto, statusEfetivo } from "./transacoes.js";
import { diasNoMes, dataDeCompetencia, somarDias } from "./tempo.js";

/** Quando a verba pesa no caixa. Mês corrente: o que falta gastar já tem
 * destino, então pesa HOJE por inteiro (é o mais seguro pro "pode gastar":
 * dinheiro de mercado e almoço não é dinheiro livre). Mês futuro: repartida
 * em semanas desde o dia 1, que é como o gasto de fato acontece. Resto de
 * centavos vai na primeira parcela. */
export function repartirVerba(t, de) {
  const competencia = t.competencia || (t.data || "").slice(0, 7);
  const primeiro = `${competencia}-01`;
  const ultimo = dataDeCompetencia(competencia, diasNoMes(competencia));
  const inicio = de > primeiro ? de : primeiro;
  if (inicio > ultimo) return [{ data: ultimo, valorCentavos: Number(t.valorCentavos) || 0 }];
  if (de >= primeiro) return [{ data: inicio, valorCentavos: Number(t.valorCentavos) || 0 }];
  const datas = [];
  for (let d = inicio; d <= ultimo && datas.length < 4; d = somarDias(d, 7)) datas.push(d);
  const total = Number(t.valorCentavos) || 0;
  const base = Math.floor(total / datas.length);
  return datas.map((data, i) => ({ data, valorCentavos: base + (i === 0 ? total - base * datas.length : 0) }));
}

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
export function compromissosPorDia({ transacoes, faturas, cartoes, de, ate, hoje, extras = [] }) {
  const porDia = new Map();
  function item(dataOriginal, valorComSinal, dados) {
    // Compromisso vencido e não pago não some do futuro: pesa hoje. Fatura cujo dia
    // habitual de pagamento (pedalada) já passou também: o dinheiro ainda não saiu.
    const data = (dados.atrasado || dados.pagamentoPassado) && dataOriginal && dataOriginal < de ? de : dataOriginal;
    if (!data || data < de || data > ate) return;
    dados = { vencimento: dataOriginal, ...dados };
    if (!porDia.has(data)) porDia.set(data, { data, entradasCentavos: 0, saidasCentavos: 0, itens: [] });
    const dia = porDia.get(data);
    // Entrada incerta aparece no dia mas não cobre nada (CLAUDE.md:
    // incerto não é dinheiro garantido). Saída incerta pesa igual.
    if (valorComSinal >= 0) { if (dados.certeza !== "incerto") dia.entradasCentavos += valorComSinal; }
    else dia.saidasCentavos += -valorComSinal;
    dia.itens.push(dados);
  }

  for (const t of transacoes || []) {
    if (t.status === "pago" || t.status === "cancelado") continue;
    if (t.tipo === "despesa" && t.contaId && t.semDia && statusEfetivo(t, hoje) !== "atrasado") {
      // Verba do mês (mercado, almoço, anúncios…): não tem dia. O que ainda
      // não foi gasto pesa nas semanas que faltam do mês, não num dia que já
      // passou (e some do caixa) nem tudo no dia 1.
      for (const parte of repartirVerba(t, de)) {
        item(parte.data, -parte.valorCentavos, {
          tipo: "despesa", descricao: t.descricao || "Despesa", valorCentavos: parte.valorCentavos, valorTotalCentavos: Number(t.valorCentavos) || 0,
          atrasado: false, certeza: t.certeza, semDia: true, transacaoId: t.id, contaId: t.contaId, categoriaId: t.categoriaId, competencia: t.competencia,
        });
      }
    } else if (t.tipo === "despesa" && t.contaId) {
      item(t.data, -(Number(t.valorCentavos) || 0), {
        tipo: "despesa", descricao: t.descricao || "Despesa", valorCentavos: Number(t.valorCentavos) || 0,
        atrasado: statusEfetivo(t, hoje) === "atrasado", certeza: t.certeza, transacaoId: t.id, contaId: t.contaId, categoriaId: t.categoriaId, competencia: t.competencia,
        origem: t.recorrenciaId ? { tipo: "recorrencia", id: t.recorrenciaId } : t.dividaId ? { tipo: "divida", id: t.dividaId } : { tipo: "transacao", id: t.id },
      });
    } else if (t.tipo === "receita") {
      item(t.data, Number(t.valorCentavos) || 0, {
        tipo: "receita", descricao: t.descricao || "Receita", valorCentavos: Number(t.valorCentavos) || 0,
        atrasado: statusEfetivo(t, hoje) === "atrasado", certeza: t.certeza, transacaoId: t.id, contaId: t.contaId, competencia: t.competencia, fonteRendaId: t.fonteRendaId || null,
        origem: t.fonteRendaId ? { tipo: "fonteRenda", id: t.fonteRendaId } : { tipo: "transacao", id: t.id },
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
    const saida = dataPagamentoPrevisto(cartao, f.competencia);
    item(saida, -total, {
      vencimento,
      tipo: "fatura", descricao: `Fatura ${cartao.apelido || "do cartão"}`, valorCentavos: total, atrasado: hoje ? vencimento < hoje : false, pagamentoPassado: hoje ? saida < hoje : false, certeza: "confirmado",
      faturaId: f.id, cartaoId: cartao.id, contaPagamentoId: cartao.contaPagamentoId || null, origem: { tipo: "fatura", id: f.id },
    });
  }

  // Eventos derivados dos cadastros (renda fixa, parcela de dívida,
  // recorrência ainda não gerada) — ver domain/previstos.js.
  for (const e of extras || []) {
    item(e.data, e.tipo === "receita" ? e.valorCentavos : -e.valorCentavos, {
      tipo: e.tipo, descricao: e.descricao, valorCentavos: e.valorCentavos, atrasado: !!e.atrasado, certeza: e.certeza, virtual: true, origem: e.origem, evento: e,
    });
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
