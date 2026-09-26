#!/usr/bin/env node
// Linha de comando do subirPainel.js. Ver .claude/skills/subir-painel/SKILL.md.
//
//   node ferramentas/subir-painel.js montar   --estado DIR --pedido ARQ.json --saida DIR
//   node ferramentas/subir-painel.js desfazer --estado DIR --lote ID --saida DIR
//
// --estado: pasta com uma subpasta por coleção e um <id>.json por documento
// (exatamente o que o ArtifactData grava com `out_dir`).
// Saída: <saida>/escritas.json (lotes de até 50 escritas, prontos para o
// `batch` do ArtifactData, com file_path) e <saida>/docs/*.json.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { montarEscritas, montarDesfazer, COLECOES_LIDAS } from "./subirPainel.js";

function argumentos(lista) {
  const [comando, ...resto] = lista;
  const opcoes = {};
  for (let i = 0; i < resto.length; i += 2) opcoes[resto[i].replace(/^--/, "")] = resto[i + 1];
  return { comando, opcoes };
}

function lerEstado(pasta) {
  const estado = {};
  for (const colecao of COLECOES_LIDAS) {
    const dir = join(pasta, colecao);
    estado[colecao] = existsSync(dir)
      ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => ({ ...JSON.parse(readFileSync(join(dir, f), "utf8")), id: f.slice(0, -5) }))
      : [];
  }
  return estado;
}

function gerarId() {
  const alfabeto = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(randomBytes(20), (b) => alfabeto[b % alfabeto.length]).join("");
}

function gravarSaida(pasta, escritas) {
  const saida = resolve(pasta);
  rmSync(join(saida, "docs"), { recursive: true, force: true });
  rmSync(join(saida, "escritas.json"), { force: true });
  mkdirSync(join(saida, "docs"), { recursive: true });
  const entradas = escritas.map((e, i) => {
    if (!e.data) return { op: e.op, collection: e.collection, doc_id: e.doc_id };
    const arquivo = join(saida, "docs", `${String(i).padStart(3, "0")}-${e.collection}-${e.doc_id}.json`);
    writeFileSync(arquivo, JSON.stringify(e.data, null, 2));
    return { op: e.op, collection: e.collection, doc_id: e.doc_id, file_path: arquivo };
  });
  const lotes = [];
  for (let i = 0; i < entradas.length; i += 50) lotes.push(entradas.slice(i, i + 50));
  writeFileSync(join(saida, "escritas.json"), JSON.stringify(lotes, null, 2));
  return lotes;
}

const { comando, opcoes } = argumentos(process.argv.slice(2));
if (!opcoes.estado || !opcoes.saida || !["montar", "desfazer"].includes(comando)) {
  console.error("uso: subir-painel.js montar --estado DIR --pedido ARQ --saida DIR | desfazer --estado DIR --lote ID --saida DIR");
  process.exit(2);
}

const estado = lerEstado(opcoes.estado);
const resultado = comando === "montar"
  ? montarEscritas({ estado, pedido: JSON.parse(readFileSync(opcoes.pedido, "utf8")), agora: new Date().toISOString(), gerarId })
  : montarDesfazer({ estado, loteId: opcoes.lote });

const lotes = gravarSaida(opcoes.saida, resultado.escritas);
if (resultado.loteId) console.log(`LOTE: ${resultado.loteId}`);
console.log(`ESCRITAS: ${resultado.escritas.length} em ${lotes.length} batch(es) -> ${join(resolve(opcoes.saida), "escritas.json")}`);
console.log("\nVAI SUBIR:");
for (const linha of resultado.resumo) console.log(`  ${linha}`);
if (resultado.pendencias?.length) {
  console.log("\nFICOU DE FORA (precisa de você):");
  for (const p of resultado.pendencias) console.log(`  item ${p.item} (${p.descricao}): ${p.motivo}`);
}
