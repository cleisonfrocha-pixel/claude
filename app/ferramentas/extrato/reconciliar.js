// Trava de reconciliação de extrato (Fase 12). Puro: só soma.
// Um extrato só entra se saldo anterior + movimentos == saldo final impresso.
// Quem monta o pedido (parser) calcula os movimentos direto das linhas do PDF,
// antes de qualquer classificação, para o erro de leitura aparecer aqui e não
// como número errado no painel.

/** @returns {{ ok: boolean, esperadoCentavos: number, obtidoCentavos: number, diferencaCentavos: number }} */
export function conferirExtrato({ saldoAnteriorCentavos, movimentosCentavos, saldoFinalCentavos }) {
  const ints = [saldoAnteriorCentavos, saldoFinalCentavos, ...(movimentosCentavos || [])];
  if (!ints.every(Number.isInteger)) throw new Error("conferência só aceita centavos inteiros");
  const obtidoCentavos = saldoAnteriorCentavos + movimentosCentavos.reduce((s, v) => s + v, 0);
  return { ok: obtidoCentavos === saldoFinalCentavos, esperadoCentavos: saldoFinalCentavos, obtidoCentavos, diferencaCentavos: saldoFinalCentavos - obtidoCentavos };
}
