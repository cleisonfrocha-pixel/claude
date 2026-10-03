// Domínio puro: a verdade do mês corrente, num lugar só. Até aqui cada tela
// contava de um jeito: Início somava o que está confirmado e o que
// provavelmente entra; Renda e Por pessoa só contavam o que já estava
// marcado como "pago" — então, com R$ 16.900 de renda cadastrada e nada
// recebido ainda, uma tela dizia "sobra" e a outra "você não tem renda".
//
// Aqui o mês tem três camadas de renda (CLAUDE.md: incerto não é dinheiro
// garantido) e duas de gasto:
//   confirmada — já entrou (receita paga);
//   provável   — falta entrar e a fonte tem padrão (fixa/recorrente, ou
//                variável pelo pior mês recente);
//   incerta    — falta entrar e não há padrão: aparece, nunca é contada.
//   gasto pago + gasto previsto (o que ainda vai sair no mês).
// "Contável" = confirmada + provável. É ela que decide déficit.

import { eventosFuturos } from "./previstos.js";
import { diasNoMes, dataDeCompetencia } from "./tempo.js";
import { statusEfetivo } from "./transacoes.js";

const ABERTO = new Set(["previsto", "agendado", "atrasado"]);

/**
 * @param {object} p
 * @param {string} [p.pessoaId] - restringe a uma pessoa (renda e gasto dela)
 */
export function visaoDoMes({ transacoes, categorias, fontesRenda, recorrencias, dividas, cartoes, faturas, competencia, hoje, pessoaId }) {
  const essencialPorCategoria = new Map((categorias || []).map((c) => [c.id, !!c.essencial]));
  const grupoDividas = new Set((categorias || []).filter((c) => c.grupo === "dividas").map((c) => c.id));
  const recPorId = new Map((recorrencias || []).map((r) => [r.id, r]));
  const fonteDe = (id) => (fontesRenda || []).find((f) => f.id === id);
  const daPessoa = (id) => !pessoaId || id === pessoaId;

  const r = {
    rendaConfirmadaCentavos: 0, rendaProvavelCentavos: 0, rendaIncertaCentavos: 0,
    gastoPagoCentavos: 0, gastoPrevistoCentavos: 0,
    essencialPagoCentavos: 0, essencialPrevistoCentavos: 0,
    verbaCentavos: 0,
  };

  const somaGasto = (valor, categoriaId, pago) => {
    if (grupoDividas.has(categoriaId)) return; // parcela de dívida entra à parte, no comprometimento
    if (pago) r.gastoPagoCentavos += valor; else r.gastoPrevistoCentavos += valor;
    if (essencialPorCategoria.get(categoriaId)) {
      if (pago) r.essencialPagoCentavos += valor; else r.essencialPrevistoCentavos += valor;
    }
  };

  for (const t of transacoes || []) {
    if (t.competencia !== competencia || t.status === "cancelado") continue;
    if (!daPessoa(t.pessoaId)) continue;
    const v = Number(t.valorCentavos) || 0;
    if (t.tipo === "receita") {
      if (t.status === "pago") r.rendaConfirmadaCentavos += v;
      else if (ABERTO.has(statusEfetivo(t, hoje))) {
        if (t.certeza === "incerto") r.rendaIncertaCentavos += v; else r.rendaProvavelCentavos += v;
      }
    } else if (t.tipo === "despesa") {
      if (t.status === "pago") somaGasto(v, t.categoriaId, true);
      else if (ABERTO.has(statusEfetivo(t, hoje))) {
        somaGasto(v, t.categoriaId, false);
        if (t.semDia) r.verbaCentavos += v;
      }
    }
  }

  const fim = dataDeCompetencia(competencia, diasNoMes(competencia));
  const eventos = eventosFuturos({ transacoes, dividas, recorrencias, fontesRenda, cartoes, faturas, de: hoje, ate: fim, hoje });
  for (const e of eventos) {
    if (e.data < `${competencia}-01`) continue;
    const v = e.valorCentavos;
    if (e.origem?.tipo === "fonteRenda") {
      if (!daPessoa(fonteDe(e.origem.id)?.pessoaId)) continue;
      if (e.certeza === "incerto") r.rendaIncertaCentavos += v; else r.rendaProvavelCentavos += v;
    } else if (e.origem?.tipo === "recorrencia") {
      const rec = recPorId.get(e.origem.id);
      if (!rec || !daPessoa(rec.pessoaId)) continue;
      if (e.tipo === "receita") { if (e.certeza === "incerto") r.rendaIncertaCentavos += v; else r.rendaProvavelCentavos += v; }
      else somaGasto(v, rec.categoriaId, false);
    }
  }

  r.rendaContavelCentavos = r.rendaConfirmadaCentavos + r.rendaProvavelCentavos;
  r.essencialCentavos = r.essencialPagoCentavos + r.essencialPrevistoCentavos;
  r.gastoCentavos = r.gastoPagoCentavos + r.gastoPrevistoCentavos;
  return r;
}

/** Troca "o que já foi pago" por "o que o mês tem de verdade" (pago + o que
 * ainda vai entrar/sair), pra renda, essencial e discricionário saírem do
 * mesmo critério em toda tela. `custos` vem de calcularCustos; `rendaPagaCentavos`
 * de calcularRendaAtual. Sem `visao`, devolve exatamente o que já era. */
export function numerosDoMes({ rendaPagaCentavos, custos, visao }) {
  if (!visao) return { rendaCentavos: rendaPagaCentavos, custos, renda: null };
  const atualCentavos = custos.atualCentavos + visao.gastoPrevistoCentavos;
  const essencialCentavos = custos.essencialCentavos + visao.essencialPrevistoCentavos;
  return {
    rendaCentavos: rendaPagaCentavos + visao.rendaProvavelCentavos,
    custos: {
      ...custos,
      atualCentavos,
      essencialCentavos,
      discricionarioCentavos: atualCentavos - essencialCentavos - custos.dividasCentavos - custos.faturaSemDetalheCentavos,
    },
    renda: {
      confirmadaCentavos: rendaPagaCentavos,
      provavelCentavos: visao.rendaProvavelCentavos,
      incertaCentavos: visao.rendaIncertaCentavos,
    },
  };
}

/** Quanto sobra (ou falta) no mês: renda contável menos tudo que o mês tem
 * de gasto (pago e previsto) menos as parcelas de dívida. É O número de
 * "sobra" do produto — Plano e Metas leem daqui, para não existirem duas
 * sobras diferentes. */
export function sobraDoMes(visao, parcelasMesCentavos = 0) {
  return visao.rendaContavelCentavos - visao.gastoCentavos - (Number(parcelasMesCentavos) || 0);
}
