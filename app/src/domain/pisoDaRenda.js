// Piso e selo de uma fonte de renda a partir dos meses FECHADOS. Separado para o histórico do ano
// (leitura) e a projeção (que decide quanto contar de cada fonte) usarem a mesma regra, sem import circular.

const MIN_MESES_PARA_QUEDA = 4;

export const media = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);

/**
 * Selo de uma fonte a partir do valor recebido em cada mês fechado, do primeiro mês em que ela apareceu.
 *   eventual   -> apareceu em um mês só (ou nunca)
 *   caiu       -> nenhum dos 3 últimos meses chegou à metade da média que ela pagava antes
 *   fixa       -> presente em todos os meses, variação de até 15%
 *   irregular  -> o resto
 */
export function seloDaFonte(valoresPorMes) {
  const presentes = valoresPorMes.filter((v) => v > 0);
  if (presentes.length <= 1) return "eventual";
  if (valoresPorMes.length >= MIN_MESES_PARA_QUEDA) {
    const ultimos = valoresPorMes.slice(-3);
    const antes = valoresPorMes.slice(0, -3);
    const positivos = antes.filter((v) => v > 0);
    // Caiu de verdade: nenhum dos 3 últimos meses chegou à metade do que ela costumava pagar.
    if (positivos.length >= 2 && Math.max(...ultimos) < media(positivos) / 2) return "caiu";
  }
  const maior = Math.max(...valoresPorMes), menor = Math.min(...valoresPorMes);
  if (menor > 0 && (maior - menor) / maior <= 0.15) return "fixa";
  return "irregular";
}

/**
 * Leitura de uma fonte pelo que ela realmente pagou: valores por mês (só meses fechados, do primeiro
 * em que apareceu) com selo, piso e média. `null` quando não há mês fechado com recebimento.
 */
export function leituraDaFonte(receitasDaFonte, competenciaHoje, { mesesJanela = 6 } = {}) {
  const porMes = new Map();
  for (const t of receitasDaFonte || []) {
    if (t.status !== "pago" || !t.competencia || t.competencia >= competenciaHoje) continue;
    porMes.set(t.competencia, (porMes.get(t.competencia) || 0) + (Number(t.valorCentavos) || 0));
  }
  const meses = [...porMes.keys()].sort();
  if (!meses.length) return null;
  // Meses corridos desde o primeiro recebimento até o último mês fechado: mês sem receber (inclusive os mais recentes) conta como zero.
  const primeiro = meses[0];
  const [ha, hm] = competenciaHoje.split("-").map(Number);
  const ultimoFechado = hm === 1 ? `${ha - 1}-12` : `${ha}-${String(hm - 1).padStart(2, "0")}`; // o mês de hoje ainda não fechou
  const valores = [];
  for (let [a, m] = primeiro.split("-").map(Number); `${a}-${String(m).padStart(2, "0")}` <= ultimoFechado; m = m === 12 ? (a++, 1) : m + 1) {
    valores.push(porMes.get(`${a}-${String(m).padStart(2, "0")}`) || 0);
  }
  const janela = valores.slice(-mesesJanela);
  return { valores: janela, meses: janela.length, selo: seloDaFonte(janela), pisoCentavos: Math.min(...janela), mediaCentavos: media(janela), mediaUltimosTresCentavos: media(janela.slice(-3)) };
}
