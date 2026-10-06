// Histórico do ano (Fase 12, Sprint 5). Domínio puro: lê os lançamentos e devolve,
// mês a mês, quanto entrou (por fonte), quanto saiu (por grupo) e o resultado, mais
// a tendência e o piso de cada fonte de renda. Nada é gravado.
//
// Regras que valem aqui (as mesmas do resto do produto):
// - só conta o que está PAGO (dinheiro fechado); previsto fica fora;
// - repasse e transferência nunca são renda nem gasto;
// - compra no cartão conta uma vez; pagamento de fatura só entra quando a fatura
//   não tem nenhuma compra detalhada (vira "cartão sem detalhe", categoria desconhecida);
// - cada número devolve os ids dos lançamentos que o formam (§9 e §17).

import { parteSemDetalhePorPagamento } from "./transacoes.js";
import { competenciaDeData } from "./tempo.js";
import { NOME_GRUPO } from "./relatorios.js";
import { precisaRevisar } from "./favorecidos.js";
import { seloDaFonte, media } from "./pisoDaRenda.js";

export { seloDaFonte };

export const GRUPO_CARTAO_SEM_DETALHE = "cartao_sem_detalhe";
const NOME_SEM_FONTE = "Sem fonte cadastrada";

const valor = (t) => Number(t.valorCentavos) || 0;
const soma = (itens) => itens.reduce((s, i) => s + i.valorCentavos, 0);

function janela(competencias, n) {
  return competencias.slice(Math.max(0, competencias.length - n));
}

/** Meses de transferência entre pessoas: quanto uma mandou para a outra (não é renda). */
function apoioEntrePessoas(transacoes, contas) {
  const pessoaDaConta = new Map((contas || []).map((c) => [c.id, c.pessoaId]));
  const pares = new Map();
  for (const t of transacoes || []) {
    if (t.tipo !== "transferencia" || t.status !== "pago" || !t.transferenciaId) continue;
    if (!pares.has(t.transferenciaId)) pares.set(t.transferenciaId, []);
    pares.get(t.transferenciaId).push(t);
  }
  const eventos = [];
  for (const pernas of pares.values()) {
    const saida = pernas.find((p) => p.direcao === "saida"), entrada = pernas.find((p) => p.direcao === "entrada");
    if (!saida || !entrada) continue;
    const de = pessoaDaConta.get(saida.contaId), para = pessoaDaConta.get(entrada.contaId);
    if (!de || !para || de === para) continue;
    eventos.push({ competencia: competenciaDeData(saida.data), dePessoaId: de, paraPessoaId: para, valorCentavos: valor(saida), ids: [saida.id, entrada.id].filter(Boolean) });
  }
  return eventos;
}

/**
 * @param {object} p
 * @param {Array} p.transacoes
 * @param {Array} p.categorias
 * @param {Array} [p.fontesRenda]
 * @param {Array} [p.contas]      para separar o apoio entre pessoas
 * @param {string} p.hoje         AAAA-MM-DD; o mês de hoje é "parcial" e não entra em tendência nem piso
 * @param {string} [p.pessoaId]   só os lançamentos dessa pessoa
 * @param {number} [p.mesesJanela=6]  quantos meses fechados olhar para selo, piso e tendência
 */
export function montarHistoricoAno({ transacoes, categorias, fontesRenda, contas, hoje, pessoaId = null, mesesJanela = 6 }) {
  const atual = competenciaDeData(hoje);
  const cat = new Map((categorias || []).map((c) => [c.id, c]));
  const nomeFonte = new Map((fontesRenda || []).map((f) => [f.id, f.nome]));
  const todos = (transacoes || []).filter((t) => t.status === "pago" && (!pessoaId || t.pessoaId === pessoaId));
  const semDetalhe = parteSemDetalhePorPagamento(transacoes);

  const meses = new Map(); // competência -> { renda: Map(fonteKey -> itens), saidas: Map(grupo -> itens), repasses }
  const mes = (c) => {
    if (!meses.has(c)) meses.set(c, { renda: new Map(), saidas: new Map(), repasseEntrada: [], repasseSaida: [] });
    return meses.get(c);
  };
  const empurrar = (mapa, k, item) => { if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(item); };

  for (const t of todos) {
    const c = t.competencia || competenciaDeData(t.data);
    if (!c) continue;
    const m = mes(c);
    const item = { id: t.id, valorCentavos: valor(t), data: t.data, descricao: t.descricao || "" };
    if (t.tipo === "receita") {
      const k = t.fonteRendaId && nomeFonte.has(t.fonteRendaId) ? t.fonteRendaId : "sem-fonte";
      empurrar(m.renda, k, item);
    } else if (t.tipo === "despesa") {
      empurrar(m.saidas, cat.get(t.categoriaId)?.grupo || "outros", item);
    } else if (t.tipo === "pagamento_fatura") {
      // Só o que a fatura teve sem compra detalhada (inteira, ou o pedaço além das compras lançadas).
      const parte = semDetalhe.get(t.id ?? t) || 0;
      if (parte > 0) empurrar(m.saidas, GRUPO_CARTAO_SEM_DETALHE, { ...item, valorCentavos: parte });
    } else if (t.tipo === "repasse") {
      (t.direcao === "entrada" ? m.repasseEntrada : m.repasseSaida).push(item);
    }
  }

  const apoio = apoioEntrePessoas(transacoes, contas);
  const apoioDoMes = (c) => {
    const doMes = apoio.filter((e) => e.competencia === c);
    if (!pessoaId) return { movimentadoCentavos: doMes.reduce((s, e) => s + e.valorCentavos, 0), recebidoCentavos: null, enviadoCentavos: null, ids: doMes.flatMap((e) => e.ids) };
    const rec = doMes.filter((e) => e.paraPessoaId === pessoaId), env = doMes.filter((e) => e.dePessoaId === pessoaId);
    return { movimentadoCentavos: null, recebidoCentavos: rec.reduce((s, e) => s + e.valorCentavos, 0), enviadoCentavos: env.reduce((s, e) => s + e.valorCentavos, 0), ids: [...rec, ...env].flatMap((e) => e.ids) };
  };

  const ordenadas = [...meses.keys()].sort();
  const linhas = ordenadas.map((c) => {
    const m = meses.get(c);
    const fontes = [...m.renda.entries()].map(([k, itens]) => ({ fonteId: k === "sem-fonte" ? null : k, nome: k === "sem-fonte" ? NOME_SEM_FONTE : nomeFonte.get(k), totalCentavos: soma(itens), ids: itens.map((i) => i.id) }))
      .sort((a, b) => b.totalCentavos - a.totalCentavos);
    const grupos = [...m.saidas.entries()].map(([g, itens]) => ({ grupo: g, nome: g === GRUPO_CARTAO_SEM_DETALHE ? "Cartão sem detalhe" : NOME_GRUPO[g] || g, totalCentavos: soma(itens), ids: itens.map((i) => i.id) }))
      .sort((a, b) => b.totalCentavos - a.totalCentavos);
    const rendaCentavos = fontes.reduce((s, f) => s + f.totalCentavos, 0);
    const saidaCentavos = grupos.reduce((s, g) => s + g.totalCentavos, 0);
    return {
      competencia: c, parcial: c >= atual,
      rendaCentavos, saidaCentavos, resultadoCentavos: rendaCentavos - saidaCentavos,
      fontes, grupos,
      repasses: { entradaCentavos: soma(m.repasseEntrada), saidaCentavos: soma(m.repasseSaida), ids: [...m.repasseEntrada, ...m.repasseSaida].map((i) => i.id) },
      apoio: apoioDoMes(c),
    };
  });

  const fechados = linhas.filter((l) => !l.parcial);
  const janelaFechada = janela(fechados.map((l) => l.competencia), mesesJanela);
  const linhaDe = new Map(linhas.map((l) => [l.competencia, l]));

  // Fonte a fonte: valor em cada mês fechado da janela (0 quando não veio), piso e selo.
  const chavesFonte = new Map();
  for (const l of linhas) for (const f of l.fontes) chavesFonte.set(f.fonteId || "sem-fonte", f.nome);
  const fontes = [...chavesFonte.entries()].map(([k, nome]) => {
    const fonteId = k === "sem-fonte" ? null : k;
    const porMes = linhas.map((l) => ({ competencia: l.competencia, totalCentavos: l.fontes.find((f) => (f.fonteId || "sem-fonte") === k)?.totalCentavos || 0 }));
    const naJanela = janelaFechada.map((c) => linhaDe.get(c).fontes.find((f) => (f.fonteId || "sem-fonte") === k)?.totalCentavos || 0);
    const ids = linhas.flatMap((l) => l.fontes.find((f) => (f.fonteId || "sem-fonte") === k)?.ids || []);
    // Só olha desde o primeiro mês em que a fonte apareceu: antes dela existir não é "mês sem receber".
    const primeiro = naJanela.findIndex((v) => v > 0);
    const desdeAparecer = primeiro < 0 ? [] : naJanela.slice(primeiro);
    return {
      fonteId, nome,
      totalCentavos: porMes.reduce((s, m) => s + m.totalCentavos, 0),
      porMes, ids,
      mesesComRenda: porMes.filter((m) => m.totalCentavos > 0).length,
      pisoCentavos: desdeAparecer.length ? Math.min(...desdeAparecer) : 0,
      mediaCentavos: media(desdeAparecer),
      selo: fonteId ? seloDaFonte(desdeAparecer) : "avulsa", // "sem fonte" junta vários clientes: não tem piso próprio
      baseadoEmMeses: desdeAparecer.length,
    };
  }).sort((a, b) => b.totalCentavos - a.totalCentavos);

  // Tendência: média dos 3 últimos meses fechados contra os 3 anteriores.
  const ult = fechados.slice(-3), ant = fechados.slice(-6, -3);
  const tendencia = ult.length >= 2 && ant.length >= 2 ? {
    base: { ultimos: ult.map((l) => l.competencia), anteriores: ant.map((l) => l.competencia) },
    rendaMediaCentavos: media(ult.map((l) => l.rendaCentavos)), rendaAnteriorCentavos: media(ant.map((l) => l.rendaCentavos)),
    saidaMediaCentavos: media(ult.map((l) => l.saidaCentavos)), saidaAnteriorCentavos: media(ant.map((l) => l.saidaCentavos)),
    resultadoMedioCentavos: media(ult.map((l) => l.resultadoCentavos)), resultadoAnteriorCentavos: media(ant.map((l) => l.resultadoCentavos)),
  } : null;
  const ordenadosPorResultado = [...fechados].sort((a, b) => a.resultadoCentavos - b.resultadoCentavos);

  // Quanto do gasto ainda está sem classificação (despesa em "Outros" ou marcada a classificar).
  const desp = todos.filter((t) => t.tipo === "despesa");
  const pendentes = desp.filter((t) => precisaRevisar(t, cat));
  const totalDesp = desp.reduce((s, t) => s + valor(t), 0);
  const semClassificar = {
    quantidade: pendentes.length, valorCentavos: pendentes.reduce((s, t) => s + valor(t), 0),
    percentual: totalDesp > 0 ? pendentes.reduce((s, t) => s + valor(t), 0) / totalDesp : 0,
    ids: pendentes.map((t) => t.id),
  };

  return {
    atual, pessoaId, linhas, fontes, tendencia,
    mesesFechados: fechados.length,
    melhorMes: fechados.length ? ordenadosPorResultado[ordenadosPorResultado.length - 1] : null,
    piorMes: fechados.length ? ordenadosPorResultado[0] : null,
    resultadoMedioCentavos: media(fechados.map((l) => l.resultadoCentavos)),
    semClassificar,
    janela: janelaFechada,
    de: linhas[0]?.competencia || null,
    ate: linhas[linhas.length - 1]?.competencia || null,
  };
}

/**
 * Em que o plano se apoia: quantos meses fechados reais existem, quanto do gasto ainda não foi classificado
 * e quais fontes de renda não são garantidas. Toda tela de plano mostra isso ("baseado em N meses reais").
 */
export function baseRealDoPlano({ transacoes, categorias, fontesRenda, contas, hoje }) {
  const h = montarHistoricoAno({ transacoes, categorias, fontesRenda, contas, hoje });
  const naoGarantidas = h.fontes.filter((f) => f.fonteId && (f.selo === "irregular" || f.selo === "caiu")).map((f) => ({ nome: f.nome, selo: f.selo }));
  const pct = Math.round(h.semClassificar.percentual * 100);
  const frase = h.mesesFechados
    ? `Baseado em ${h.mesesFechados} ${h.mesesFechados === 1 ? "mês real fechado" : "meses reais fechados"}${pct >= 10 ? `; ${pct}% do gasto ainda está sem classificação` : ""}${naoGarantidas.length ? `; renda não garantida: ${naoGarantidas.map((f) => f.nome).join(", ")}` : ""}.`
    : "Ainda não há mês fechado: o plano usa só o que foi cadastrado.";
  return { mesesFechados: h.mesesFechados, de: h.de, semClassificarPercentual: h.semClassificar.percentual, naoGarantidas, frase };
}
