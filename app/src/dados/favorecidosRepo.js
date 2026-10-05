// Fila "Revisar" por favorecido: lê o retrato único, agrupa o que está sem
// classificação e aplica a decisão do usuário em todos os lançamentos do mesmo
// favorecido (e guarda a regra para os próximos extratos). Cálculo no domínio.

import { assinarBase, carregarBase } from "./base.js";
import { transacoes } from "./transacoesRepo.js";
import { regras } from "./repositorios.js";
import { agruparFavorecidos, camposDaDecisao, aplicarRegras } from "../domain/favorecidos.js";

function montarFila(base) {
  const categorias = base.categorias.filter((c) => c.ativa !== false);
  return { grupos: agruparFavorecidos(base.transacoes, base.categorias), categorias };
}

export async function carregarFila() {
  return montarFila(await carregarBase());
}

export function assinarFila(cb) {
  return assinarBase(async (base) => montarFila(base), cb);
}

/**
 * Aplica `decisao` a todos os itens do grupo. Devolve quantos mudaram e quantos
 * a decisão não serviu (categoria de receita num gasto, por exemplo).
 * `lembrar`: guarda a regra, e os próximos extratos já nascem classificados.
 */
export async function aplicarDecisao(grupo, decisao, { lembrar = true } = {}) {
  const base = await carregarBase();
  const porId = new Map(base.categorias.map((c) => [c.id, c]));
  const porTransacao = new Map(base.transacoes.map((t) => [t.id, t]));
  let mudados = 0, naoServiu = 0;
  for (const item of grupo.itens) {
    const t = porTransacao.get(item.id);
    const campos = t && camposDaDecisao(t, decisao, porId);
    if (!campos) { naoServiu += 1; continue; }
    await transacoes.atualizar(item.id, campos);
    mudados += 1;
  }
  if (lembrar) {
    const existente = base.regrasClassificacao.find((r) => r.chave === grupo.chave);
    const dados = { chave: grupo.chave, nome: grupo.nome, decisao, ativa: true };
    if (existente) await regras.atualizar(existente.id, dados); else await regras.criar(dados);
  }
  return { mudados, naoServiu };
}

/** Aplica as regras já guardadas ao que está pendente (útil logo depois de importar um extrato). */
export async function aplicarRegrasGuardadas() {
  const base = await carregarBase();
  const propostas = aplicarRegras(base.transacoes, base.regrasClassificacao, base.categorias);
  for (const p of propostas) await transacoes.atualizar(p.id, p.campos);
  return propostas.length;
}
