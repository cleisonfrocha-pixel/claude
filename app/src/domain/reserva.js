// Domínio puro: reserva e segurança financeira (§15). Não inventa números
// novos — reaproveita o saldo de reserva já separado do "posso gastar"
// desde a Fase 2 (D8, `domain/caixa.js`) e o custo essencial já calculado
// na Fase 8 (`domain/orcamento.js`).

// Os três horizontes de meta que o §15 pede — "meta de reserva em
// diferentes horizontes".
export const HORIZONTES_RESERVA_MESES = [3, 6, 12];

/**
 * Cobertura da reserva em meses e dias de custo essencial, mais o
 * progresso até cada horizonte de meta. `custoEssencialCentavos` <= 0
 * (nenhuma despesa essencial registrada ainda) não permite calcular
 * cobertura nem meta — `null` em vez de um número inventado.
 */
export function calcularReserva({ saldoReservaCentavos, custoEssencialCentavos }) {
  const semBase = !custoEssencialCentavos || custoEssencialCentavos <= 0;

  const coberturaMeses = semBase ? null : saldoReservaCentavos / custoEssencialCentavos;
  const coberturaDias = coberturaMeses != null ? Math.round(coberturaMeses * 30) : null;

  const metas = HORIZONTES_RESERVA_MESES.map((meses) => {
    if (semBase) return { meses, metaCentavos: null, progressoPercentual: null, faltaCentavos: null };
    const metaCentavos = custoEssencialCentavos * meses;
    const progressoPercentual = Math.min(100, Math.max(0, Math.round((saldoReservaCentavos / metaCentavos) * 100)));
    return { meses, metaCentavos, progressoPercentual, faltaCentavos: Math.max(0, metaCentavos - saldoReservaCentavos) };
  });

  return { saldoReservaCentavos, custoEssencialCentavos, coberturaMeses, coberturaDias, metas };
}
