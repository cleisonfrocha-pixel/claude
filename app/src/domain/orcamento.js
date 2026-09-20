// Domínio puro: custos essenciais, orçamento e margem (§13). "Orçamento
// deve ser instrumento de clareza, não uma prisão" (texto do blueprint) —
// por isso nada aqui trava gasto, só mostra fatos.

import { somarMeses } from "./tempo.js";

function despesasPorCategoria(transacoes, competencia) {
  const porCategoria = new Map();
  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || t.status !== "pago" || t.competencia !== competencia) continue;
    const chave = t.categoriaId || "sem-categoria";
    porCategoria.set(chave, (porCategoria.get(chave) || 0) + (Number(t.valorCentavos) || 0));
  }
  return porCategoria;
}

/** Custo essencial (categoria.essencial) e atual (tudo) do mês, já pagos —
 * a diferença entre os dois é o discricionário. */
export function calcularCustos(transacoes, categorias, competencia) {
  const essenciaisIds = new Set((categorias || []).filter((c) => c.essencial).map((c) => c.id));
  let essencialCentavos = 0, atualCentavos = 0;
  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || t.status !== "pago" || t.competencia !== competencia) continue;
    const v = Number(t.valorCentavos) || 0;
    atualCentavos += v;
    if (essenciaisIds.has(t.categoriaId)) essencialCentavos += v;
  }
  return { essencialCentavos, atualCentavos, discricionarioCentavos: atualCentavos - essencialCentavos };
}

/** Margem depois de cobrir o essencial e as parcelas de dívida — o que
 * sobra pra decidir, não pra gastar sem pensar. */
export function calcularMargem({ rendaAtualCentavos, custoEssencialCentavos, comprometimentoMensalDividasCentavos }) {
  return rendaAtualCentavos - custoEssencialCentavos - (comprometimentoMensalDividasCentavos || 0);
}

/** Recorrente (ligado a uma recorrência cadastrada, §1 já existente desde
 * a Fase 1) versus extraordinário (lançamento avulso) — reaproveita o
 * campo que já existe, não inventa um conceito novo. */
export function calcularRecorrenteVsExtraordinario(transacoes, competencia) {
  let recorrenteCentavos = 0, extraordinarioCentavos = 0;
  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || t.status !== "pago" || t.competencia !== competencia) continue;
    const v = Number(t.valorCentavos) || 0;
    if (t.recorrenciaId) recorrenteCentavos += v; else extraordinarioCentavos += v;
  }
  return { recorrenteCentavos, extraordinarioCentavos };
}

/** Evolução das `limite` categorias de maior gasto no mês, cada uma com a
 * média dos `mesesHistorico` meses anteriores ao lado. */
export function calcularEvolucaoPorCategoria(transacoes, competencia, { mesesHistorico = 3, limite = 5 } = {}) {
  const atual = despesasPorCategoria(transacoes, competencia);
  const mapasAnteriores = [];
  for (let i = mesesHistorico; i >= 1; i--) mapasAnteriores.push(despesasPorCategoria(transacoes, somarMeses(competencia, -i)));

  return Array.from(atual.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([categoriaId, valorCentavos]) => {
      const serieCentavos = mapasAnteriores.map((m) => m.get(categoriaId) || 0);
      const mediaCentavos = serieCentavos.length ? Math.round(serieCentavos.reduce((s, v) => s + v, 0) / serieCentavos.length) : 0;
      return { categoriaId, valorCentavos, mediaCentavos, serieCentavos };
    });
}

/** Categorias em alta consistente: o gasto cresceu em CADA um dos
 * últimos `meses` meses, sem nenhuma queda no meio — "comendo margem de
 * forma crescente", não um pico isolado (isso já é o §8, fora do padrão). */
export function identificarCategoriasCrescentes(transacoes, competencia, { meses = 3 } = {}) {
  const competencias = [];
  for (let i = meses - 1; i >= 0; i--) competencias.push(somarMeses(competencia, -i));
  const mapas = competencias.map((c) => despesasPorCategoria(transacoes, c));

  const categoriasVistas = new Set();
  mapas.forEach((m) => m.forEach((_, cat) => categoriasVistas.add(cat)));

  const crescentes = [];
  for (const categoriaId of categoriasVistas) {
    const serieCentavos = mapas.map((m) => m.get(categoriaId) || 0);
    let sempreCresceu = true;
    for (let i = 1; i < serieCentavos.length; i++) {
      if (serieCentavos[i - 1] <= 0 || serieCentavos[i] <= serieCentavos[i - 1]) { sempreCresceu = false; break; }
    }
    if (sempreCresceu) {
      crescentes.push({
        categoriaId, serieCentavos,
        crescimentoTotalPercentual: Math.round(((serieCentavos[serieCentavos.length - 1] - serieCentavos[0]) / serieCentavos[0]) * 100),
      });
    }
  }
  return crescentes.sort((a, b) => b.crescimentoTotalPercentual - a.crescimentoTotalPercentual);
}
