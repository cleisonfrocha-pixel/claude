// Domínio puro: patrimônio e construção de riqueza (§14). "O objetivo
// final não é apenas sair das dívidas — é acompanhar a transformação do
// fluxo de caixa em patrimônio" (texto do blueprint).
//
// Passivo aqui é a mesma dívida do §11 (Fase 6): dívida já É passivo, não
// existe um segundo cadastro pro mesmo número dois lugares poderem
// divergir.

/** Total de ativos e a composição por classe — "composição do
 * patrimônio" do §14. */
export function calcularComposicaoAtivos(ativos) {
  const porClasse = new Map();
  let totalCentavos = 0;
  for (const a of ativos || []) {
    const v = Number(a.valorAtualCentavos) || 0;
    totalCentavos += v;
    porClasse.set(a.classe, (porClasse.get(a.classe) || 0) + v);
  }
  const composicao = Array.from(porClasse.entries())
    .map(([classe, valorCentavos]) => ({
      classe, valorCentavos, percentual: totalCentavos > 0 ? Math.round((valorCentavos / totalCentavos) * 100) : 0,
    }))
    .sort((a, b) => b.valorCentavos - a.valorCentavos);
  return { totalCentavos, composicao };
}

/** Patrimônio líquido: ativos menos passivos. */
export function calcularPatrimonioLiquido({ ativosCentavos, passivosCentavos }) {
  return ativosCentavos - (passivosCentavos || 0);
}

/** Monta o retrato (snapshot) de uma competência. É isto que fica
 * gravado — um retrato datado, não um saldo vivo (ver
 * dados/patrimonioRepo.js e a nota em MODELO-DE-DADOS.md). */
export function montarSnapshot({ competencia, ativosCentavos, passivosCentavos, composicao }) {
  return {
    competencia,
    ativosCentavos,
    passivosCentavos,
    liquidoCentavos: calcularPatrimonioLiquido({ ativosCentavos, passivosCentavos }),
    composicao,
  };
}

/** Variação entre dois retratos — mensal (contra o anterior) ou
 * acumulada (contra o primeiro já registrado): mesma função, snapshot
 * base diferente. `null` quando falta um dos dois lados. */
export function calcularVariacao(snapshotAtual, snapshotBase) {
  if (!snapshotAtual || !snapshotBase) return null;
  const variacaoCentavos = snapshotAtual.liquidoCentavos - snapshotBase.liquidoCentavos;
  const variacaoPercentual = snapshotBase.liquidoCentavos !== 0
    ? Math.round((variacaoCentavos / Math.abs(snapshotBase.liquidoCentavos)) * 100)
    : null;
  return { variacaoCentavos, variacaoPercentual };
}

/** A relação entre reduzir dívida, aumentar ativo e crescer patrimônio —
 * três perguntas de sim/não sobre dois retratos consecutivos. */
export function calcularRelacaoDividaAtivoPatrimonio(snapshotAtual, snapshotAnterior) {
  if (!snapshotAtual || !snapshotAnterior) return null;
  return {
    passivoCaiu: snapshotAtual.passivosCentavos < snapshotAnterior.passivosCentavos,
    ativoSubiu: snapshotAtual.ativosCentavos > snapshotAnterior.ativosCentavos,
    patrimonioSubiu: snapshotAtual.liquidoCentavos > snapshotAnterior.liquidoCentavos,
    variacaoPassivoCentavos: snapshotAtual.passivosCentavos - snapshotAnterior.passivosCentavos,
    variacaoAtivoCentavos: snapshotAtual.ativosCentavos - snapshotAnterior.ativosCentavos,
    variacaoPatrimonioCentavos: snapshotAtual.liquidoCentavos - snapshotAnterior.liquidoCentavos,
  };
}
