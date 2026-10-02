// Plano, visão geral: o que dá para fazer a respeito (3 alavancas) e os
// avisos agrupados. Puro (CLAUDE.md). Toda alavanca diz a premissa e aponta
// os dados de onde saiu o número; nenhuma inventa valor.

import { statusDivida, parcelasRestantes, classificarDivida } from "./dividas.js";

const PESO = { alta: 3, media: 2, baixa: 1 };
const REDUCAO_CATEGORIA_PCT = 20;
const REDUCAO_PARCELA_PCT = 30;

const TITULO_GRUPO = {
  nova_recorrencia: (n) => `${n} compromissos recorrentes novos para conferir`,
  recorrencia_valor_diferente: (n) => `${n} recorrências com valor diferente do esperado`,
};

/** Avisos do mesmo tipo (mesma `chave`), em número igual ou acima do
 * limiar, viram UMA linha com os itens dentro. O resto segue individual.
 * Ordem: urgência, depois a original. */
export function agruparAchados(achados, { limiar = 3 } = {}) {
  const porChave = new Map();
  for (const a of achados || []) {
    if (!porChave.has(a.chave)) porChave.set(a.chave, []);
    porChave.get(a.chave).push(a);
  }
  const saida = [];
  for (const [chave, itens] of porChave) {
    if (itens.length >= limiar) {
      const urgencia = itens.reduce((m, a) => (PESO[a.urgencia] > PESO[m] ? a.urgencia : m), "baixa");
      const titulo = (TITULO_GRUPO[chave] || ((n) => `${n} avisos do mesmo tipo`))(itens.length);
      saida.push({ grupo: true, chave, titulo, urgencia, tipo: itens[0].tipo, itens, impactoCentavos: itens.reduce((s, a) => s + (Number(a.impactoCentavos) || 0), 0) });
    } else {
      for (const a of itens) saida.push({ grupo: false, chave, titulo: a.titulo, urgencia: a.urgencia, tipo: a.tipo, achado: a, itens: [a], impactoCentavos: a.impactoCentavos });
    }
  }
  return saida.sort((a, b) => PESO[b.urgencia] - PESO[a.urgencia]);
}

/** Até 3 alavancas, em ordem do maior efeito mensal. */
export function alavancas({ transacoes, categorias, dividas, competencia, hoje, sobraCentavos }) {
  const lista = [];

  // 1) Cortar a maior categoria NÃO essencial do mês.
  const nao = new Map((categorias || []).filter((c) => c.natureza === "despesa" && !c.essencial && c.grupo !== "dividas").map((c) => [c.id, c]));
  const porCategoria = new Map();
  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || t.competencia !== competencia || t.status === "cancelado" || !nao.has(t.categoriaId)) continue;
    // "Outros" não diz onde cortar: fica de fora até ser aberto em categorias de verdade.
    if (/^outros?$/i.test(nao.get(t.categoriaId).nome)) continue;
    porCategoria.set(t.categoriaId, (porCategoria.get(t.categoriaId) || 0) + (Number(t.valorCentavos) || 0));
  }
  const topo = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topo && topo[1] > 0) {
    const c = nao.get(topo[0]);
    lista.push({
      id: `corte:${c.id}`, titulo: `Cortar ${REDUCAO_CATEGORIA_PCT}% de ${c.nome}`,
      impactoMensalCentavos: Math.round(topo[1] * REDUCAO_CATEGORIA_PCT / 100),
      premissa: `É o maior gasto não essencial do mês. Estimativa se você reduzir ${REDUCAO_CATEGORIA_PCT}%.`,
      baseCentavos: topo[1], origem: { tipo: "categoria", id: c.id, rotulo: c.nome }, destino: { modulo: "dinheiro", aba: "transacoes" },
    });
  }

  // 2) Renegociar a maior parcela de dívida ativa. Financiamento em dia
  // (carro pago certinho) não entra: renegociar o que está em dia não é uma
  // alavanca, é ruído.
  const ativas = (dividas || []).filter((d) => classificarDivida(d, hoje) === "divida" && (Number(d.valorParcelaCentavos) || 0) > 0);
  const maior = ativas.sort((a, b) => b.valorParcelaCentavos - a.valorParcelaCentavos)[0];
  if (maior) {
    lista.push({
      id: `divida:${maior.id}`, titulo: `Renegociar a parcela de ${maior.nome}`,
      impactoMensalCentavos: Math.round(maior.valorParcelaCentavos * REDUCAO_PARCELA_PCT / 100),
      premissa: `É a maior parcela ativa (${parcelasRestantes(maior)} parcelas restantes). Estimativa se o credor aceitar ${REDUCAO_PARCELA_PCT}% menos.`,
      baseCentavos: maior.valorParcelaCentavos, origem: { tipo: "divida", id: maior.id, rotulo: maior.nome }, destino: { modulo: "dividas" },
    });
  }

  // 3) Fechar o déficit com renda nova, ou, se sobra, destinar a sobra.
  if (Number.isFinite(sobraCentavos)) {
    if (sobraCentavos < 0) {
      lista.push({
        id: "renda:deficit", titulo: "Trazer renda nova para fechar o mês",
        impactoMensalCentavos: -sobraCentavos,
        premissa: "É quanto falta por mês entre o que entra (confirmado e provável) e o que sai.",
        baseCentavos: -sobraCentavos, origem: { tipo: "renda", id: "mes_atual", rotulo: "Renda do mês" }, destino: { modulo: "dinheiro", aba: "renda" },
      });
    } else if (sobraCentavos > 0) {
      lista.push({
        id: "renda:sobra", titulo: "Destinar a sobra do mês",
        impactoMensalCentavos: sobraCentavos,
        premissa: "É o que sobra por mês depois de tudo que está previsto. Vale mandar para a dívida mais cara ou para a reserva.",
        baseCentavos: sobraCentavos, origem: { tipo: "renda", id: "mes_atual", rotulo: "Renda do mês" }, destino: { modulo: "plano", aba: "caminhos" },
      });
    }
  }

  return lista.sort((a, b) => b.impactoMensalCentavos - a.impactoMensalCentavos).slice(0, 3);
}
