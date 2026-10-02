#!/usr/bin/env node
// Lista os arquivos que precisam ir para o artefato publicado, pra nunca mais
// esquecer um (a tela em branco de 02/10/2026 foi um arquivo que ficou de fora).
//
//   node ferramentas/arquivos-para-publicar.js              → todos (src + estilo)
//   node ferramentas/arquivos-para-publicar.js --desde HEAD~1 → só os que mudaram desde o commit
//   node ferramentas/arquivos-para-publicar.js --conferir lista.txt
//        → compara com a lista publicada (um caminho por linha) e aponta o que falta
//
// O index.html vai sempre como a página principal; os demais entram em `files`.

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const RAIZ = new URL("..", import.meta.url).pathname;

function todos(dir) {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const rel = `${dir}/${n}`;
    return statSync(join(RAIZ, rel)).isDirectory() ? todos(rel) : [rel];
  });
}

const args = process.argv.slice(2);
const desde = args.includes("--desde") ? args[args.indexOf("--desde") + 1] : null;
const conferir = args.includes("--conferir") ? args[args.indexOf("--conferir") + 1] : null;

let lista = [...todos("src"), ...todos("estilo")].sort();

if (desde) {
  const mudou = execSync(`git diff --name-only ${desde}`, { cwd: RAIZ, encoding: "utf8" })
    .split("\n").filter(Boolean).map((p) => p.replace(/^app\//, ""));
  lista = lista.filter((p) => mudou.includes(p));
}

if (conferir) {
  const publicados = new Set(readFileSync(conferir, "utf8").split("\n").map((l) => l.trim().replace(/^- "?|"?\s.*$/g, "")).filter(Boolean));
  const faltam = [...todos("src"), ...todos("estilo")].filter((p) => !publicados.has(p));
  if (faltam.length) { console.error(`FALTAM ${faltam.length} arquivo(s) no artefato publicado:\n${faltam.join("\n")}`); process.exit(1); }
  console.log(`OK: os ${publicados.size} arquivos publicados cobrem tudo que o repositório tem em src e estilo.`);
} else {
  console.log(JSON.stringify(lista));
}
