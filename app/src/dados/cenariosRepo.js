// Carrega a BASE dos cenários (domain/cenarios.js) a partir dos dados
// reais. A simulação em si roda na tela, na hora, a cada ajuste de
// parâmetro — nada de cenário é gravado (CLAUDE.md: simulação não escreve
// no dado real), então esta camada só lê.

import { contas, cartoes, categorias, dividas, ativos, fontesRenda } from "./repositorios.js";
import { transacoes } from "./transacoesRepo.js";
import { faturas } from "./faturasRepo.js";
import { calcularClarezaDeCaixa } from "../domain/caixa.js";
import { montarBaseCenarios } from "../domain/cenarios.js";
import { hojeISO, competenciaAtual } from "../domain/tempo.js";

function comId(lista) {
  return lista.map((item) => ({ id: item.id, ...item.dados }));
}

export async function calcularBaseCenarios() {
  const [c, k, f, cat, d, a, fr, t] = await Promise.all([
    contas.listar(), cartoes.listar(), faturas.listar(), categorias.listar(),
    dividas.listar(), ativos.listar(), fontesRenda.listar(), transacoes.listar(),
  ]);
  const hoje = hojeISO();
  const listaTransacoes = t.map((x) => x.dados);
  const clareza = calcularClarezaDeCaixa({ contas: comId(c), cartoes: comId(k), faturas: comId(f), transacoes: listaTransacoes, hoje, horizonteDias: 30 });
  return montarBaseCenarios({
    transacoes: listaTransacoes, categorias: comId(cat), dividas: comId(d), fontesRenda: comId(fr), ativos: comId(a),
    clareza, competencia: competenciaAtual(), hoje,
  });
}

export function assinarBaseCenarios(cb) {
  let cancelada = false;
  let agendado = null;
  function agendar() {
    if (cancelada || agendado) return;
    agendado = setTimeout(async () => {
      agendado = null;
      const base = await calcularBaseCenarios();
      if (!cancelada) cb(base);
    }, 0);
  }
  const paradas = [contas, dividas, ativos, fontesRenda, transacoes].map((repo) => repo.assinar(agendar));
  return () => {
    cancelada = true;
    clearTimeout(agendado);
    paradas.forEach((parar) => parar());
  };
}
