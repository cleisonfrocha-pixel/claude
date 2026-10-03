// "Posso gastar X?": simula um gasto sobre a trilha de caixa e devolve o
// veredito, sem escrever nada. Os dados de entrada são copiados; nenhuma
// coleção real é tocada (CLAUDE.md: simulação não escreve no dado real).

import { calcularClarezaDeCaixa } from "./caixa.js";
import { cartoesNoCaixa } from "./cartaoNoCaixa.js";
import { competenciaFatura } from "./transacoes.js";
import { somarDias, competenciaDeData } from "./tempo.js";

function saldoEm(pontos, saldoHoje, data) {
  let s = saldoHoje;
  for (const p of pontos) { if (p.data <= data) s = p.saldoCentavos; else break; }
  return s;
}

function menorDesde(pontos, saldoHoje, data) {
  const dep = pontos.filter((p) => p.data > data).map((p) => p.saldoCentavos);
  return Math.min(saldoEm(pontos, saldoHoje, data), ...dep);
}

function comGasto(estado, { valorCentavos, forma, cartaoId, dia }) {
  const sim = { id: "__sim", tipo: "despesa", status: "previsto", certeza: "confirmado", valorCentavos, data: dia, competencia: competenciaDeData(dia), descricao: "Simulação" };
  if (forma === "cartao") {
    const cartao = estado.cartoes.find((c) => c.id === cartaoId);
    const competencia = competenciaFatura(cartao, dia);
    let fatura = (estado.faturas || []).find((f) => f.cartaoId === cartaoId && f.competencia === competencia && f.status !== "paga");
    const faturas = fatura ? estado.faturas : [...(estado.faturas || []), (fatura = { id: "__sim_f", cartaoId, competencia, status: "aberta" })];
    return { ...estado, faturas, transacoes: [...estado.transacoes, { ...sim, cartaoId, faturaId: fatura.id, contaId: null, data: dia }] };
  }
  return { ...estado, transacoes: [...estado.transacoes, { ...sim, contaId: estado.contas.find((c) => c.status === "ativa" && !c.ehReserva)?.id || null }] };
}

/**
 * @param {object} estado { contas, transacoes, faturas, cartoes, dividas, recorrencias, fontesRenda, hoje, horizonteDias }
 * @param {{valorCentavos:number, forma?:"conta"|"cartao", cartaoId?:string, dia?:string}} gasto
 * @returns {{veredito:"cabe"|"cabe_no_cartao"|"adiar"|"nao_cabe", ...}}
 */
export function simularGasto(estado, { valorCentavos, forma = "conta", cartaoId = null, dia = null }) {
  const hoje = estado.hoje;
  const quando = dia || hoje;
  const antes = calcularClarezaDeCaixa(estado);
  const depoisDe = (f, id) => calcularClarezaDeCaixa(comGasto(estado, { valorCentavos, forma: f, cartaoId: id, dia: quando }));

  const resultado = { semEscrever: true, valorCentavos, forma, dia: quando, menorPontoAntesCentavos: antes.seguroParaGastarCentavos };

  const naConta = depoisDe("conta", null);
  const cabeNaConta = naConta.seguroParaGastarCentavos >= 0;

  const noCartao = (id) => {
    const lista = cartoesNoCaixa({ cartoes: estado.cartoes, faturas: estado.faturas, transacoes: estado.transacoes, pontos: antes.pontos, naContaCentavos: antes.saldoAtualCentavos, hoje });
    const info = lista.find((c) => c.cartaoId === id);
    if (!info) return null;
    const depois = depoisDe("cartao", id);
    return { info, depois, cabe: valorCentavos <= info.limiteLivreCentavos && depois.seguroParaGastarCentavos >= 0 };
  };

  if (forma === "cartao" && cartaoId) {
    const c = noCartao(cartaoId);
    if (!c) return { ...resultado, veredito: "nao_cabe", motivo: "Cartão não encontrado." };
    return {
      ...resultado, veredito: c.cabe ? "cabe" : "nao_cabe",
      menorPontoDepoisCentavos: c.depois.seguroParaGastarCentavos,
      limiteDepoisCentavos: c.info.limiteLivreCentavos - valorCentavos,
      saiDaContaEm: c.info.proximaFatura.saiEm,
      motivo: c.cabe ? `Cabe no limite e a fatura de ${c.info.proximaFatura.saiEm.split("-").reverse().slice(0, 2).join("/")} fica coberta.`
        : valorCentavos > c.info.limiteLivreCentavos ? "Passa do limite livre do cartão." : "A fatura que essa compra gera deixaria o caixa negativo.",
    };
  }

  if (cabeNaConta) return { ...resultado, veredito: "cabe", menorPontoDepoisCentavos: naConta.seguroParaGastarCentavos, quebraEm: null };

  // Não cabe na conta agora. Alternativa 1: algum cartão aguenta.
  for (const cartao of estado.cartoes.filter((c) => c.status !== "inativo")) {
    const c = noCartao(cartao.id);
    if (c?.cabe) return { ...resultado, veredito: "cabe_no_cartao", cartaoId: cartao.id, cartaoApelido: cartao.apelido, saiDaContaEm: c.info.proximaFatura.saiEm, menorPontoDepoisCentavos: c.depois.seguroParaGastarCentavos, quebraEm: naConta.primeiroBuraco?.data || null };
  }
  // Alternativa 2: adiar até o primeiro dia em que cabe na conta.
  const pontos = antes.pontos;
  const datas = [...new Set([hoje, ...pontos.map((p) => p.data)])].sort();
  for (const d of datas) {
    if (d <= quando) continue;
    if (menorDesde(pontos, antes.saldoAtualCentavos, d) - valorCentavos >= 0) {
      return { ...resultado, veredito: "adiar", adiarAte: d, menorPontoDepoisCentavos: naConta.seguroParaGastarCentavos, quebraEm: naConta.primeiroBuraco?.data || null };
    }
  }
  return { ...resultado, veredito: "nao_cabe", menorPontoDepoisCentavos: naConta.seguroParaGastarCentavos, quebraEm: naConta.primeiroBuraco?.data || null };
}
