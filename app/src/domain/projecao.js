// Domínio puro: fluxo de caixa e projeção (§7). "O usuário deve conseguir
// olhar para frente" — quatro horizontes lado a lado, cada um respondendo
// a uma pergunta diferente (operação imediata, sobrevivência mensal,
// estabilidade, estratégia).
//
// Regra não negociável (CLAUDE.md): incerto não é dinheiro garantido. A
// trajetória "segura" caminhada dia a dia nunca soma um evento com
// certeza "incerto" — ele só aparece como informação à parte.

import { compromissosPorDia, calcularCoberturaDiaria } from "./calendario.js";
import { somarDias } from "./tempo.js";

export const HORIZONTES = [
  { chave: "7d", dias: 7, rotulo: "7 dias", funcao: "Operação imediata", pergunta: "Vencimentos, entradas próximas e risco de falta de caixa." },
  { chave: "30d", dias: 30, rotulo: "30 dias", funcao: "Sobrevivência mensal", pergunta: "Capacidade de fechar o mês e cobrir compromissos." },
  { chave: "90d", dias: 90, rotulo: "90 dias", funcao: "Estabilidade", pergunta: "Comportamento das obrigações, renda e dívida no curto prazo." },
  { chave: "12m", dias: 365, rotulo: "12 meses", funcao: "Estratégia", pergunta: "Trajetória financeira e possibilidade de recuperação/acumulação." },
];

/**
 * Separa os itens de cada dia em duas trilhas: "seguro" (confirmado +
 * provável — o que caminha o saldo) e "incerto" (só informativo, nunca
 * soma no saldo seguro). `dias` vem de `compromissosPorDia`, cujos itens
 * já carregam `certeza`.
 */
function separarPorCerteza(dias) {
  return (dias || []).map((dia) => {
    let entradasSeguroCentavos = 0, saidasSeguroCentavos = 0;
    let entradasIncertoCentavos = 0, saidasIncertoCentavos = 0;
    for (const item of dia.itens) {
      const incerto = item.certeza === "incerto";
      const ehEntrada = item.tipo === "receita";
      if (incerto) {
        if (ehEntrada) entradasIncertoCentavos += item.valorCentavos;
        else saidasIncertoCentavos += item.valorCentavos;
      } else {
        if (ehEntrada) entradasSeguroCentavos += item.valorCentavos;
        else saidasSeguroCentavos += item.valorCentavos;
      }
    }
    return {
      ...dia,
      entradasCentavos: entradasSeguroCentavos,
      saidasCentavos: saidasSeguroCentavos,
      entradasIncertoCentavos,
      saidasIncertoCentavos,
    };
  });
}

/**
 * Projeta um único horizonte a partir de hoje. Devolve o saldo seguro no
 * fim do período (só confirmado + provável), o saldo "com incerto"
 * (informativo, se tudo que é incerto se confirmar), e a saída crítica —
 * a PRIMEIRA data em que o saldo seguro caminhado fica negativo, com o
 * evento causador e o tamanho do gap. `null` quando não há saída crítica
 * dentro do horizonte.
 */
export function calcularHorizonte({ transacoes, faturas, cartoes, saldoInicialCentavos, hoje, dias }) {
  const horizonteAte = somarDias(hoje, dias);
  const todosOsDias = compromissosPorDia({ transacoes, faturas, cartoes, de: hoje, ate: horizonteAte });
  const diasSeparados = separarPorCerteza(todosOsDias);

  const cobertura = calcularCoberturaDiaria(saldoInicialCentavos, diasSeparados);

  const entradasSeguroCentavos = diasSeparados.reduce((s, d) => s + d.entradasCentavos, 0);
  const saidasSeguroCentavos = diasSeparados.reduce((s, d) => s + d.saidasCentavos, 0);
  const entradasIncertoCentavos = diasSeparados.reduce((s, d) => s + d.entradasIncertoCentavos, 0);
  const saidasIncertoCentavos = diasSeparados.reduce((s, d) => s + d.saidasIncertoCentavos, 0);

  const saldoFinalSeguroCentavos = saldoInicialCentavos + entradasSeguroCentavos - saidasSeguroCentavos;
  const saldoFinalComIncertoCentavos = saldoFinalSeguroCentavos + entradasIncertoCentavos - saidasIncertoCentavos;

  const diaCritico = cobertura.find((d) => !d.coberto);
  const saidaCritica = diaCritico ? {
    data: diaCritico.data,
    itens: diaCritico.itens.filter((i) => i.tipo !== "receita"),
    gapCentavos: -diaCritico.saldoDepoisCentavos,
    saldoDepoisCentavos: diaCritico.saldoDepoisCentavos,
  } : null;

  return {
    horizonteAte,
    saldoInicialCentavos,
    saldoFinalSeguroCentavos,
    saldoFinalComIncertoCentavos,
    entradasSeguroCentavos,
    saidasSeguroCentavos,
    entradasIncertoCentavos,
    saidasIncertoCentavos,
    saidaCritica,
    dias: cobertura,
  };
}

/** Os quatro horizontes do §7, lado a lado, a partir do mesmo saldo inicial. */
export function calcularProjecao({ transacoes, faturas, cartoes, saldoInicialCentavos, hoje }) {
  return {
    hoje,
    horizontes: HORIZONTES.map((meta) => ({
      ...meta,
      ...calcularHorizonte({ transacoes, faturas, cartoes, saldoInicialCentavos, hoje, dias: meta.dias }),
    })),
  };
}
