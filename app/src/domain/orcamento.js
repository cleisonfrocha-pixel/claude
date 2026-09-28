// Domínio puro: custos essenciais, orçamento e margem (§13). "Orçamento
// deve ser instrumento de clareza, não uma prisão" (texto do blueprint) —
// por isso nada aqui trava gasto, só mostra fatos.

import { somarMeses } from "./tempo.js";

/** Meses que têm QUALQUER movimento pago registrado. Mês antes do começo
 * do histórico não é "mês em que não se gastou nada": é mês sem dado, e
 * não pode entrar numa média como zero — senão todo gasto normal parece
 * "50% acima da média" quando o histórico tem só dois meses. */
export function competenciasComDados(transacoes) {
  const set = new Set();
  for (const t of transacoes || []) if (t.status === "pago" && t.competencia) set.add(t.competencia);
  return set;
}

function despesasPorCategoria(transacoes, competencia) {
  const porCategoria = new Map();
  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || t.status !== "pago" || t.competencia !== competencia) continue;
    const chave = t.categoriaId || "sem-categoria";
    porCategoria.set(chave, (porCategoria.get(chave) || 0) + (Number(t.valorCentavos) || 0));
  }
  return porCategoria;
}

/** Custo essencial (categoria.essencial), o que foi pago de parcela de
 * dívida (categoria do grupo "dividas"), fatura de cartão paga sem NENHUMA
 * compra lançada por trás (sem-detalhe) e atual (tudo) do mês, já pagos —
 * o discricionário é o que sobra depois de tirar os três primeiros.
 *
 * Dívida fica FORA do essencial de propósito: quem paga uma parcela lança
 * uma despesa na categoria "Dívidas e parcelas" (essencial:true) E atualiza
 * a dívida (domain/dividas.js) — o mesmo pagamento nascendo em dois lugares.
 * `calcularMargem` já soma `comprometimentoMensalDividasCentavos` (o
 * cronograma da dívida, que cobre o mês mesmo sem a despesa lançada);
 * deixar a despesa de parcela dentro do essencial contaria essa parcela
 * duas vezes na margem.
 *
 * Fatura de cartão nunca é despesa quando as compras já foram lançadas
 * (CLAUDE.md: compra no cartão ≠ pagamento da fatura — contar as duas
 * coisas duplica o dinheiro). Mas quando ninguém lançou NENHUMA compra
 * daquela fatura (só "paguei R$X da fatura"), o pagamento é a ÚNICA prova
 * de gasto que existe — ignorá-lo também faz o dinheiro sumir, só que na
 * direção contrária. `faturaSemDetalheCentavos` entra no atual (é gasto
 * real) mas fica separado do essencial e do discricionário: a categoria
 * de quem não detalhou é desconhecida, não presumida. */
export function calcularCustos(transacoes, categorias, competencia) {
  const essenciaisIds = new Set((categorias || []).filter((c) => c.essencial).map((c) => c.id));
  const dividasIds = new Set((categorias || []).filter((c) => c.grupo === "dividas").map((c) => c.id));
  const faturasComCompra = new Set((transacoes || []).filter((t) => t.tipo === "despesa" && t.faturaId).map((t) => t.faturaId));
  let essencialCentavos = 0, dividasCentavos = 0, faturaSemDetalheCentavos = 0, atualCentavos = 0;
  for (const t of transacoes || []) {
    if (t.status !== "pago" || t.competencia !== competencia) continue;
    if (t.tipo === "pagamento_fatura") {
      if (t.faturaId && faturasComCompra.has(t.faturaId)) continue; // compras já contadas
      const v = Number(t.valorCentavos) || 0;
      faturaSemDetalheCentavos += v;
      atualCentavos += v;
      continue;
    }
    if (t.tipo !== "despesa") continue;
    const v = Number(t.valorCentavos) || 0;
    atualCentavos += v;
    if (dividasIds.has(t.categoriaId)) { dividasCentavos += v; continue; }
    if (essenciaisIds.has(t.categoriaId)) essencialCentavos += v;
  }
  return {
    essencialCentavos, dividasCentavos, faturaSemDetalheCentavos, atualCentavos,
    discricionarioCentavos: atualCentavos - essencialCentavos - dividasCentavos - faturaSemDetalheCentavos,
  };
}

/** Margem depois de cobrir o essencial e as parcelas de dívida — o que
 * sobra pra decidir, não pra gastar sem pensar. `custoEssencialCentavos`
 * deve vir de `calcularCustos` (que já tira a parcela de dívida do
 * essencial) para não contar a mesma parcela duas vezes. */
export function calcularMargem({ rendaAtualCentavos, custoEssencialCentavos, comprometimentoMensalDividasCentavos }) {
  return rendaAtualCentavos - custoEssencialCentavos - (comprometimentoMensalDividasCentavos || 0);
}

/** Recorrente (ligado a uma recorrência cadastrada, §1 já existente desde
 * a Fase 1) versus extraordinário (lançamento avulso). Lançamento que veio
 * de extrato não traz `recorrenciaId`, então também conta como recorrente
 * quando bate com uma recorrência ativa: mesma categoria, mesma conta ou
 * cartão e valor até 20% diferente — senão o aluguel importado do banco
 * apareceria como gasto "extraordinário". */
export function calcularRecorrenteVsExtraordinario(transacoes, competencia, recorrencias = []) {
  const ativas = (recorrencias || []).filter((r) => r.ativa !== false && r.tipo === "despesa");
  const bateComRecorrencia = (t) => ativas.some((r) => r.categoriaId === t.categoriaId
    && ((r.contaId && r.contaId === t.contaId) || (r.cartaoId && r.cartaoId === t.cartaoId))
    && Math.abs((Number(t.valorCentavos) || 0) - (Number(r.valorEstimadoCentavos) || 0)) <= (Number(r.valorEstimadoCentavos) || 0) * 0.2);
  let recorrenteCentavos = 0, extraordinarioCentavos = 0;
  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || t.status !== "pago" || t.competencia !== competencia) continue;
    const v = Number(t.valorCentavos) || 0;
    if (t.recorrenciaId || t.dividaId || bateComRecorrencia(t)) recorrenteCentavos += v; else extraordinarioCentavos += v;
  }
  return { recorrenteCentavos, extraordinarioCentavos };
}

/** Evolução das `limite` categorias de maior gasto no mês, cada uma com a
 * média dos `mesesHistorico` meses anteriores ao lado. */
export function calcularEvolucaoPorCategoria(transacoes, competencia, { mesesHistorico = 3, limite = 5 } = {}) {
  const atual = despesasPorCategoria(transacoes, competencia);
  const comDados = competenciasComDados(transacoes);
  const mapasAnteriores = [];
  for (let i = mesesHistorico; i >= 1; i--) {
    const c = somarMeses(competencia, -i);
    if (comDados.has(c)) mapasAnteriores.push(despesasPorCategoria(transacoes, c));
  }

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
