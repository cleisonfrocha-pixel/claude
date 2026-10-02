// Carrega a visão por pessoa (domain/pessoas.js): cada pessoa, o que não
// tem responsável, e a casa. Nada gravado — recalculado ao vivo sempre que
// pessoa, conta, cartão, transação, dívida ou ativo mudar.

import { pessoas, contas, cartoes, categorias, dividas, ativos, fontesRenda } from "./repositorios.js";
import { recorrencias } from "./recorrenciasRepo.js";
import { transacoes } from "./transacoesRepo.js";
import { calcularVisaoPorPessoa } from "../domain/pessoas.js";
import { hojeISO, competenciaAtual } from "../domain/tempo.js";

function comId(lista) {
  return lista.map((item) => ({ id: item.id, ...item.dados }));
}

export async function calcularPainelPessoas() {
  const [p, c, k, cat, d, a, t, fr, rec] = await Promise.all([
    pessoas.listar(), contas.listar(), cartoes.listar(), categorias.listar(), dividas.listar(), ativos.listar(), transacoes.listar(), fontesRenda.listar(), recorrencias.listar(),
  ]);
  return calcularVisaoPorPessoa({
    pessoas: comId(p),
    contas: comId(c), cartoes: comId(k), categorias: comId(cat), dividas: comId(d), ativos: comId(a),
    transacoes: t.map((x) => x.dados),
    fontesRenda: comId(fr), recorrencias: comId(rec),
    competencia: competenciaAtual(), hoje: hojeISO(),
  });
}

export function assinarPainelPessoas(cb) {
  let cancelada = false;
  let agendado = null;
  // Seis coleções assinadas disparam juntas ao montar: junta num recálculo só.
  function agendar() {
    if (cancelada || agendado) return;
    agendado = setTimeout(async () => {
      agendado = null;
      const r = await calcularPainelPessoas();
      if (!cancelada) cb(r);
    }, 0);
  }
  const paradas = [pessoas, contas, cartoes, dividas, ativos, transacoes, fontesRenda, recorrencias].map((repo) => repo.assinar(agendar));
  return () => {
    cancelada = true;
    clearTimeout(agendado);
    paradas.forEach((parar) => parar());
  };
}
