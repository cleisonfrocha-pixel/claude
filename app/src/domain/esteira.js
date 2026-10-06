// Dívidas com esteira: oferta de desconto, placar "nome limpo", acordo em
// parcelas e a barra do financiamento (Jeep). Puro (CLAUDE.md): sem tela, sem banco.

import { calcularSaldoAtual, parcelasRestantes, valorCobradoSemOfertaCentavos, statusDivida, classificarDivida, sujaONome } from "./dividas.js";
import { competenciaDeData } from "./tempo.js";

function diasEntre(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
}

/** O que o credor cobra hoje, sem o desconto. */
export function valorCobradoCentavos(d) {
  return valorCobradoSemOfertaCentavos(d) || calcularSaldoAtual(d);
}

/** Oferta de quitação com desconto (Serasa Limpa Nome, acordo no app do banco).
 * `oferta`: { valorCentavos, validade|null, origem }. Sem validade = sem prazo
 * conhecido; nunca se inventa um. */
export function ofertaDaDivida(d, hoje) {
  const o = d.oferta || (Number(d.ofertaValorCentavos) > 0 ? { valorCentavos: d.ofertaValorCentavos, validade: d.ofertaValidade || null, origem: d.ofertaOrigem || "" } : null);
  const valor = Number(o?.valorCentavos) || 0;
  if (!(valor > 0)) return null;
  const cobrado = valorCobradoCentavos(d);
  const economia = Math.max(0, cobrado - valor);
  return {
    valorCentavos: valor,
    cobradoCentavos: cobrado,
    originalCentavos: Number(d.saldoOriginalCentavos) || 0,
    economiaCentavos: economia,
    descontoPct: cobrado > 0 ? Math.floor((economia / cobrado) * 100) : 0,
    origem: o.origem || "",
    validade: o.validade || null,
    vencida: !!(o.validade && hoje && o.validade < hoje),
    diasParaVencer: o.validade && hoje ? diasEntre(hoje, o.validade) : null,
  };
}

const quitada = (d) => parcelasRestantes(d) <= 0 || !!d.quitadaEm;

/** "Nome limpo X de N": cada dívida que sujou o nome (negativada ou protestada)
 * conta uma vez. Marcada como `mesmaDividaDe` outra, não conta de novo (o protesto
 * da conta de luz de novembro é a mesma dívida do Serasa). */
export function placarNomeLimpo(dividas) {
  const sujas = (dividas || []).filter(sujaONome);
  const limpas = sujas.filter(quitada);
  return {
    total: sujas.length,
    limpas: limpas.length,
    faltam: sujas.length - limpas.length,
    faltamIds: sujas.filter((d) => !quitada(d)).map((d) => d.id),
    valorQueFaltaCentavos: sujas.filter((d) => !quitada(d)).reduce((s, d) => s + calcularSaldoAtual(d), 0),
  };
}

/** Aceitar a oferta e parcelar (ou pagar à vista, parcelas = 1): o patch que
 * transforma a dívida num acordo. O valor original fica guardado. */
export function acordoDaOferta(d, { parcelas = 1, primeiraParcela }) {
  const o = ofertaDaDivida(d, "0000-00-00");
  if (!o) throw new Error("Esta dívida não tem oferta cadastrada.");
  const n = Math.max(1, Math.floor(parcelas));
  return {
    valorComJurosCentavos: d.valorComJurosCentavos || o.cobradoCentavos,
    saldoOriginalCentavos: o.valorCentavos,
    quantidadeParcelas: n,
    parcelasPagas: 0,
    valorParcelaCentavos: Math.round(o.valorCentavos / n),
    dataInicio: primeiraParcela,
    oferta: null, ofertaValorCentavos: 0, ofertaValidade: "", ofertaOrigem: "",
    acordoDe: { cobradoCentavos: o.cobradoCentavos, economiaCentavos: o.economiaCentavos, origem: o.origem },
  };
}

const MARCOS = [25, 50, 75, 100];

/** A barra do financiamento: parcelas pagas / total, quanto já foi e quanto falta
 * pagar (parcelas em dia), o valor de mercado (FIPE que a pessoa informou) e o
 * próximo marco. `bem` é opcional. */
export function progressoDoFinanciamento(d, bem, hoje) {
  const total = Number(d.quantidadeParcelas) || 0;
  const pagas = Math.min(total, Number(d.parcelasPagas) || 0);
  const parcela = Number(d.valorParcelaCentavos) || 0;
  const pct = total > 0 ? Math.floor((pagas / total) * 100) : 0;
  const proximo = MARCOS.find((m) => m > pct) ?? null;
  const falta = (total - pagas) * parcela;
  const valor = Number(bem?.valorAtualCentavos) || 0;
  const dias = bem?.dataAvaliacao && hoje ? diasEntre(bem.dataAvaliacao, hoje) : null;
  return {
    pagas, total, restantes: total - pagas, percentual: pct,
    jaPagoCentavos: pagas * parcela, faltaPagarCentavos: falta,
    marcoAtingido: [...MARCOS].reverse().find((m) => m <= pct) ?? 0,
    proximoMarco: proximo,
    parcelasAteOProximoMarco: proximo != null && total > 0 ? Math.ceil((proximo / 100) * total) - pagas : null,
    valorDoBemCentavos: valor || null,
    avaliadoEm: bem?.dataAvaliacao || null,
    diasDesdeAvaliacao: dias,
    avaliacaoVelha: dias != null && dias > 45,
    liquidoDoBemCentavos: valor ? valor - falta : null,
  };
}

export const CENTROS = ["casa", "negocio", "galpao"];
export const ROTULO_CENTRO = { casa: "Casa", negocio: "Negócio", galpao: "Galpão" };

/** Quanto cada centro gastou no mês (despesas pagas e abertas, sem compra de cartão
 * duplicada: a fatura não entra, só as compras). Sem centro cai em "casa". */
export function gastoPorCentro(transacoes, competencia) {
  const soma = Object.fromEntries(CENTROS.map((c) => [c, 0]));
  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || t.status === "cancelado") continue;
    if ((t.competencia || competenciaDeData(t.data)) !== competencia) continue;
    const c = CENTROS.includes(t.centro) ? t.centro : "casa";
    soma[c] += Number(t.valorCentavos) || 0;
  }
  return soma;
}

/** O retrato das dívidas num golpe de vista: quanto se deve de verdade (já com as ofertas), de que é feito,
 * quanto as ofertas economizam e quais são as melhores para fechar primeiro (maior desconto por real pago). */
export function panoramaDeDividas(dividas, hoje) {
  const ativas = (dividas || []).filter((d) => statusDivida(d, hoje) !== "quitada" && !d.mesmaDividaDe);
  const grupos = { negativadas: { rotulo: "Nome sujo", centavos: 0, qtd: 0 }, atrasadas: { rotulo: "Atrasadas ou sem acordo", centavos: 0, qtd: 0 }, financiamento: { rotulo: "Financiamento em dia", centavos: 0, qtd: 0 }, trabalho: { rotulo: "Paga com trabalho", centavos: 0, qtd: 0 } };
  const ofertas = [];
  let cobrado = 0;
  for (const d of ativas) {
    const saldo = calcularSaldoAtual(d, hoje);
    if (!(saldo > 0)) continue;
    const classe = classificarDivida(d, hoje);
    const chave = classe === "financiamento" ? "financiamento" : classe === "trabalho" ? "trabalho" : sujaONome(d) ? "negativadas" : "atrasadas";
    grupos[chave].centavos += saldo; grupos[chave].qtd += 1;
    const of = ofertaDaDivida(d, hoje);
    cobrado += of && !of.vencida ? of.cobradoCentavos : saldo;
    if (of && !of.vencida && classe === "divida") ofertas.push({ id: d.id, nome: d.nome, credor: d.credor || "", pessoaId: d.pessoaId, valorCentavos: of.valorCentavos, cobradoCentavos: of.cobradoCentavos, economiaCentavos: of.economiaCentavos, descontoPct: of.descontoPct, validade: of.validade, diasParaVencer: of.diasParaVencer, origem: of.origem, negativada: sujaONome(d) });
  }
  ofertas.sort((a, b) => b.descontoPct - a.descontoPct || b.economiaCentavos - a.economiaCentavos);
  const lista = Object.entries(grupos).map(([chave, g]) => ({ chave, ...g })).filter((g) => g.centavos > 0);
  // O que pesa todo mês: parcela de quem tem acordo. Sem acordo não tem parcela (não pesa no mês até fechar).
  const comAcordo = ativas.filter((d) => !d.pagaComTrabalho && Number(d.valorParcelaCentavos) > 0);
  const semAcordo = ativas.filter((d) => !d.pagaComTrabalho && !(Number(d.valorParcelaCentavos) > 0) && calcularSaldoAtual(d, hoje) > 0);
  return {
    parcelasMensaisCentavos: comAcordo.reduce((s, d) => s + (Number(d.valorParcelaCentavos) || 0), 0),
    quantidadeComAcordo: comAcordo.length,
    quantidadeSemAcordo: semAcordo.length,
    ofertasSemValidade: ofertas.filter((o) => !o.validade).length,
    totalRealCentavos: lista.reduce((s, g) => s + g.centavos, 0),
    cobradoCentavos: cobrado,
    economiaCentavos: ofertas.reduce((s, o) => s + o.economiaCentavos, 0),
    grupos: lista,
    ofertas,
    totalOfertasCentavos: ofertas.reduce((s, o) => s + o.valorCentavos, 0),
    placar: placarNomeLimpo(dividas),
  };
}
