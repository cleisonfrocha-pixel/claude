// Domínio puro: simulador de dívidas (§11). Regra não negociável do
// CLAUDE.md: "simulação não escreve no dado real" — estas funções só
// recebem números e devolvem um resultado hipotético; nenhuma delas lê ou
// grava em repositório nenhum, então não há como um cenário simulado
// vazar para o dado verdadeiro.

// 100 anos — guarda contra um pagamento que nem cobre os juros do mês,
// o que faria o saldo nunca chegar a zero.
const LIMITE_MESES = 1200;

/** Caminha mês a mês: os juros incidem sobre o saldo, depois o pagamento
 * (nunca maior que o saldo) é abatido. `taxaJurosMensalPct` nulo/0 = sem
 * juros — é uma amortização linear simples. */
function caminharQuitacao(saldoInicialCentavos, pagamentoMensalCentavos, taxaJurosMensalPct) {
  const taxa = (Number(taxaJurosMensalPct) || 0) / 100;
  let saldo = Math.max(0, Math.round(saldoInicialCentavos));
  let meses = 0;
  let jurosTotalCentavos = 0;
  while (saldo > 0 && meses < LIMITE_MESES) {
    const juros = Math.round(saldo * taxa);
    jurosTotalCentavos += juros;
    saldo += juros;
    const pagamento = Math.min(Math.round(pagamentoMensalCentavos) || 0, saldo);
    if (pagamento <= 0) break; // o pagamento não cobre nem os juros: nunca quita
    saldo -= pagamento;
    meses++;
  }
  return { meses, jurosTotalCentavos, quitada: saldo <= 0 };
}

/** Simula um aporte extra por cima da parcela mensal atual, comparado ao
 * ritmo de hoje. "Impacto mensal" é literalmente quanto passaria a sair
 * do caixa todo mês a mais. */
export function simularAporteExtra({ saldoAtualCentavos, valorParcelaCentavos, taxaJurosMensalPct, aporteExtraCentavos }) {
  const base = caminharQuitacao(saldoAtualCentavos, valorParcelaCentavos, taxaJurosMensalPct);
  const comAporte = caminharQuitacao(saldoAtualCentavos, valorParcelaCentavos + aporteExtraCentavos, taxaJurosMensalPct);
  return {
    base,
    comAporte,
    mesesEconomizados: base.meses - comAporte.meses,
    jurosEconomizadosCentavos: base.jurosTotalCentavos - comAporte.jurosTotalCentavos,
    impactoMensalCentavos: aporteExtraCentavos,
  };
}

/** Simula um pagamento único hoje que abate o saldo na hora, mantendo a
 * parcela mensal igual — sem impacto no caixa dos próximos meses. */
export function simularQuitacaoAntecipada({ saldoAtualCentavos, valorParcelaCentavos, taxaJurosMensalPct, valorPagamentoUnicoCentavos }) {
  const base = caminharQuitacao(saldoAtualCentavos, valorParcelaCentavos, taxaJurosMensalPct);
  const saldoAposAporte = Math.max(0, saldoAtualCentavos - valorPagamentoUnicoCentavos);
  const comAporte = caminharQuitacao(saldoAposAporte, valorParcelaCentavos, taxaJurosMensalPct);
  return {
    base,
    comAporte,
    mesesEconomizados: base.meses - comAporte.meses,
    jurosEconomizadosCentavos: base.jurosTotalCentavos - comAporte.jurosTotalCentavos,
    impactoMensalCentavos: 0,
  };
}

/** Compara vários ritmos de pagamento lado a lado — cada um com seu prazo,
 * juros total e se de fato quita dentro do limite de simulação. */
export function compararRitmos({ saldoAtualCentavos, taxaJurosMensalPct, ritmos }) {
  return (ritmos || []).map((r) => ({
    nome: r.nome,
    valorParcelaCentavos: r.valorParcelaCentavos,
    ...caminharQuitacao(saldoAtualCentavos, r.valorParcelaCentavos, taxaJurosMensalPct),
  }));
}
