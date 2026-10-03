// Plano, visão geral: onde você está, pra onde vai (3, 6 e 12 meses) e as
// alavancas. Tudo calculado na leitura, sobre o retrato único.

import { assinarBase } from "./base.js";
import { calcularSaldoConta } from "../domain/caixa.js";
import { calcularHorizonte } from "../domain/projecao.js";
import { gastoDiaADiaMensal } from "../domain/previstos.js";
import { visaoDoMes, sobraDoMes } from "../domain/mes.js";
import { calcularVisaoConsolidada, calcularSaldoAtual, statusDivida } from "../domain/dividas.js";
import { alavancas } from "../domain/planoGeral.js";
import { mapaDeMeses } from "../domain/mapa12.js";
import { hojeISO, competenciaDeData } from "../domain/tempo.js";

const HORIZONTES = [
  { chave: "3m", rotulo: "Em 3 meses", dias: 90 },
  { chave: "6m", rotulo: "Em 6 meses", dias: 180 },
  { chave: "12m", rotulo: "Em 12 meses", dias: 365 },
];

export function calcularPlanoGeral(base, hoje = hojeISO()) {
  const competencia = competenciaDeData(hoje);
  const visao = visaoDoMes({ ...base, competencia, hoje });
  const consolidada = calcularVisaoConsolidada(base.dividas, hoje);
  const parcelasMes = consolidada.comprometimentoMensalCentavos || 0;
  const sobraCentavos = sobraDoMes(visao, parcelasMes);

  const operacao = base.contas.filter((c) => c.status === "ativa" && !c.ehReserva);
  const saldoInicialCentavos = operacao.reduce((s, c) => s + calcularSaldoConta(c, base.transacoes), 0);
  const gastoDiaADiaMensalCentavos = gastoDiaADiaMensal({ ...base, competencia });
  const futuro = HORIZONTES.map((h) => {
    const r = calcularHorizonte({ ...base, gastoDiaADiaMensalCentavos, saldoInicialCentavos, hoje, dias: h.dias });
    return { ...h, saldoFinalSeguroCentavos: r.saldoFinalSeguroCentavos, saidaCritica: r.saidaCritica, entradasIncertoCentavos: r.entradasIncertoCentavos };
  });

  // Dívidas ativas sem parcela e sem data de pagamento: não entram no mapa dos meses, e o saldo futuro
  // aparece mais folgado do que é. O plano diz isso em voz alta em vez de esconder.
  const foraDoPlano = base.dividas.filter((d) => statusDivida(d, hoje) !== "quitada" && !d.mesmaDividaDe && !(Number(d.valorParcelaCentavos) > 0))
    .map((d) => ({ id: d.id, nome: d.nome, valorCentavos: calcularSaldoAtual(d, hoje) })).filter((d) => d.valorCentavos > 0);

  const mapa = mapaDeMeses({ ...base, saldoInicialCentavos, gastoDiaADiaMensalCentavos, hoje });

  return {
    competencia,
    mapa,
    foraDoPlano: { quantidade: foraDoPlano.length, totalCentavos: foraDoPlano.reduce((t, d) => t + d.valorCentavos, 0), itens: foraDoPlano },
    agora: {
      saldoInicialCentavos,
      rendaConfirmadaCentavos: visao.rendaConfirmadaCentavos,
      rendaProvavelCentavos: visao.rendaProvavelCentavos,
      rendaIncertaCentavos: visao.rendaIncertaCentavos,
      gastoCentavos: visao.gastoCentavos,
      parcelasCentavos: parcelasMes,
      sobraCentavos,
    },
    futuro,
    alavancas: alavancas({ transacoes: base.transacoes, categorias: base.categorias, dividas: base.dividas, competencia, hoje, sobraCentavos }),
  };
}

export function assinarPlanoGeral(cb) {
  return assinarBase((base) => calcularPlanoGeral(base), cb);
}
