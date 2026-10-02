// Leitura de TODAS as coleções do usuário para exportar uma cópia completa e
// para listar a atividade recente. Só leitura.

import * as db from "./db.js";
import { montarExportacao, transacoesParaCSV, atividadeRecente } from "../domain/busca.js";

const COLECOES = [
  "pessoas", "contas", "cartoes", "categorias", "dividas", "fontesRenda", "ativos", "objetivos",
  "transacoes", "faturas", "recorrencias", "decisoes", "patrimonioSnapshots", "lotesImportacao",
];

export async function coletarTudo() {
  const lista = await Promise.all(COLECOES.map((c) => db.listar(c).catch(() => [])));
  const colecoes = {};
  COLECOES.forEach((c, i) => { colecoes[c] = lista[i].map((x) => ({ id: x.id, ...x.dados })); });
  return colecoes;
}

export async function exportarJSON() {
  return montarExportacao(await coletarTudo(), new Date().toISOString());
}

export async function exportarTransacoesCSV() {
  const c = await coletarTudo();
  return transacoesParaCSV(c.transacoes, { contas: c.contas, cartoes: c.cartoes, categorias: c.categorias, pessoas: c.pessoas });
}

export async function atividade() {
  return atividadeRecente(await coletarTudo());
}
