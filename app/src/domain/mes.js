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
import { statusEfetivo, parteSemDetalhePorPagamento } from "./transacoes.js";

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

/**
 * A conta do mês que toda tela mostra (item 19 a 22 da lista de 05/10: a despesa de outubro tinha cinco
 * valores e o resultado tinha três sinais, porque cada tela somava de um jeito). Uma regra só:
 * - mês de referência (`competencia`): compra no cartão conta no mês em que foi feita;
 * - sem cancelados, sem transferência entre contas, sem repasse, sem pagamento de fatura (a não ser o
 *   pedaço da fatura que não tem compra lançada, que é gasto de verdade);
 * - "já" = pago; "ainda" = aberto (previsto, agendado, atrasado). Receita incerta fica à parte.
 * `resultadoAteAgoraCentavos` só com o que já aconteceu; `resultadoSeTudoAcontecerCentavos` soma o aberto.
 */
export function resumoDoMes({ transacoes, competencia, hoje, pessoaId = null }) {
  const semDetalhe = parteSemDetalhePorPagamento(transacoes);
  const r = { entrouCentavos: 0, vaiEntrarCentavos: 0, incertoCentavos: 0, saiuCentavos: 0, vaiSairCentavos: 0, ids: { entrou: [], vaiEntrar: [], saiu: [], vaiSair: [] } };
  for (const t of transacoes || []) {
    if ((t.competencia || (t.data || "").slice(0, 7)) !== competencia || t.status === "cancelado") continue;
    if (pessoaId && t.pessoaId !== pessoaId) continue;
    const v = Number(t.valorCentavos) || 0;
    const pago = t.status === "pago";
    const aberto = !pago && ABERTO.has(statusEfetivo(t, hoje));
    if (t.tipo === "receita") {
      if (pago) { r.entrouCentavos += v; r.ids.entrou.push(t.id); }
      else if (aberto && t.certeza === "incerto") r.incertoCentavos += v;
      else if (aberto) { r.vaiEntrarCentavos += v; r.ids.vaiEntrar.push(t.id); }
    } else if (t.tipo === "despesa") {
      if (pago) { r.saiuCentavos += v; r.ids.saiu.push(t.id); }
      else if (aberto) { r.vaiSairCentavos += v; r.ids.vaiSair.push(t.id); }
    } else if (t.tipo === "pagamento_fatura" && pago) {
      const parte = semDetalhe.get(t.id ?? t) || 0;
      if (parte > 0) { r.saiuCentavos += parte; r.ids.saiu.push(t.id); }
    }
  }
  r.resultadoAteAgoraCentavos = r.entrouCentavos - r.saiuCentavos;
  r.resultadoSeTudoAcontecerCentavos = r.entrouCentavos + r.vaiEntrarCentavos - r.saiuCentavos - r.vaiSairCentavos;
  return r;
}
