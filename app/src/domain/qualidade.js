// Domínio puro: qualidade, completude e confiança dos dados (§23). Um
// diagnóstico, um alerta ou uma projeção só valem o que os dados por trás
// deles valerem — esta é a peça que diz isso em voz alta, em vez de deixar
// o usuário confiar cegamente num número que pode estar apoiado em pouca
// coisa. Cada item aqui aponta o que fazer, nunca só "algo está
// incompleto" (mesma regra do §9/§17 — todo alerta aponta os dados que o
// originaram).

import { faturasContadasEmDobro } from "./cartoes.js";

const ITENS_COMPLETUDE = [
  { chave: "pessoa", rotulo: "Nenhuma pessoa cadastrada.", ok: (d) => d.pessoas.length > 0 },
  { chave: "conta", rotulo: "Nenhuma conta cadastrada.", ok: (d) => d.contas.length > 0 },
  { chave: "reserva", rotulo: "Nenhuma conta marcada como reserva.", ok: (d) => d.contas.some((c) => c.ehReserva) },
  { chave: "categoriaEssencial", rotulo: "Nenhuma categoria marcada como essencial.", ok: (d) => d.categorias.some((c) => c.essencial) },
  { chave: "renda", rotulo: "Nenhuma fonte de renda cadastrada.", ok: (d) => d.fontesRenda.length > 0 },
  { chave: "ativo", rotulo: "Nenhum ativo cadastrado. O patrimônio líquido fica incompleto.", ok: (d) => d.ativos.length > 0 },
  { chave: "transacaoRecente", rotulo: "Nenhum lançamento nos últimos 30 dias.", ok: (d) => d.transacoes.some((t) => t.data >= d.limiteTrintaDias) },
];

/** Percentual do checklist de vida financeira mapeada que está ok, e o que
 * falta pra chegar em 100% — cada pendência já diz o que fazer. */
export function calcularCompletudeGeral(dados) {
  const pendencias = ITENS_COMPLETUDE.filter((i) => !i.ok(dados)).map((i) => i.rotulo);
  const percentual = Math.round(((ITENS_COMPLETUDE.length - pendencias.length) / ITENS_COMPLETUDE.length) * 100);
  return { percentual, pendencias, completo: pendencias.length === 0 };
}

/** Registros que existem mas carregam alguma incerteza — não é "dado
 * faltando", é "dado presente mas ainda não confirmado". */
export function identificarItensAConfirmar({ transacoes, dividas }) {
  const itens = [];
  const dobro = faturasContadasEmDobro(transacoes);
  if (dobro.length) {
    itens.push({
      chave: "fatura_em_dobro", quantidade: dobro.length,
      rotulo: `${dobro.length} fatura${dobro.length > 1 ? "s" : ""} de cartão com resumo e compras detalhadas juntos (pode estar contando em dobro). Veja em Dinheiro › Cartões.`,
    });
  }
  const incertas = (transacoes || []).filter((t) => t.certeza === "incerto" && t.status !== "cancelado");
  if (incertas.length) {
    itens.push({
      chave: "transacoes_incertas", quantidade: incertas.length,
      rotulo: `${incertas.length} lançamento${incertas.length > 1 ? "s" : ""} marcado${incertas.length > 1 ? "s" : ""} como incerto.`,
    });
  }
  const semTaxa = (dividas || []).filter((d) => d.taxaJurosMensalPct == null);
  if (semTaxa.length) {
    itens.push({
      chave: "dividas_sem_taxa", quantidade: semTaxa.length,
      rotulo: `${semTaxa.length} dívida${semTaxa.length > 1 ? "s" : ""} sem taxa de juros informada.`,
    });
  }
  return itens;
}

/** Saldos/registros que não são conferidos há muito tempo — a data do
 * saldo inicial de uma conta ou a avaliação de um ativo envelhecendo sem
 * ninguém confirmar se ainda reflete a realidade. */
export function identificarSaldosNaoConciliados({ contas, ativos }, { limiteData }) {
  const itens = [];
  for (const c of contas || []) {
    if (c.status !== "ativa") continue;
    if (c.dataSaldoInicial && c.dataSaldoInicial < limiteData) {
      itens.push({ tipo: "conta", id: c.id, rotulo: c.nome, desde: c.dataSaldoInicial });
    }
  }
  for (const a of ativos || []) {
    if (a.dataAvaliacao && a.dataAvaliacao < limiteData) {
      itens.push({ tipo: "ativo", id: a.id, rotulo: a.nome, desde: a.dataAvaliacao });
    }
  }
  return itens;
}

/** A data mais recente de `atualizadoEm` entre todas as coleções — a
 * "clareza sobre a data da última atualização dos dados" do §23. */
export function calcularUltimaAtualizacao(colecoes) {
  let maisRecente = null;
  for (const lista of colecoes || []) {
    for (const item of lista || []) {
      if (item.atualizadoEm && (!maisRecente || item.atualizadoEm > maisRecente)) maisRecente = item.atualizadoEm;
    }
  }
  return maisRecente;
}

/**
 * Confiabilidade da visão atual: síntese dos três sinais anteriores num
 * nível só (alta/média/baixa) e a lista de motivos — é isso que vira o
 * "aviso quando uma conclusão estiver baseada em dados incompletos" em
 * qualquer tela que mostre um diagnóstico.
 */
export function calcularConfiabilidade({ completude, itensAConfirmar, saldosNaoConciliados }) {
  const motivos = [...completude.pendencias, ...itensAConfirmar.map((i) => i.rotulo)];
  if (saldosNaoConciliados.length) {
    motivos.push(`${saldosNaoConciliados.length} registro${saldosNaoConciliados.length > 1 ? "s" : ""} sem conferência recente.`);
  }
  const nivel = motivos.length === 0 ? "alta" : completude.percentual >= 70 ? "media" : "baixa";
  return { nivel, confiavel: motivos.length === 0, motivos };
}

export const AVISO_VOLUME_TRANSACOES = 900;
export const LIMITE_VOLUME_TRANSACOES = 1000;

/** O banco do painel lê a coleção inteira de uma vez e é pensado para "centenas a poucos milhares" de
 * documentos; a consulta com limite aceita no máximo 1.000. Avisa antes de virar problema. */
export function avisoDeVolume(quantidadeTransacoes) {
  const n = Number(quantidadeTransacoes) || 0;
  if (n >= LIMITE_VOLUME_TRANSACOES) return { nivel: "alto", quantidade: n, texto: `O painel já guarda ${n} lançamentos, acima de ${LIMITE_VOLUME_TRANSACOES}. É hora de dividir por ano antes que a leitura fique lenta ou incompleta.` };
  if (n >= AVISO_VOLUME_TRANSACOES) return { nivel: "medio", quantidade: n, texto: `O painel guarda ${n} lançamentos e o aviso é a partir de ${AVISO_VOLUME_TRANSACOES}. Antes de carregar mais um ano de extrato, é preciso dividir por ano.` };
  return null;
}
