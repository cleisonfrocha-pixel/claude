// Garante que todo import relativo aponta para um arquivo que existe. Já houve
// um painel publicado em branco porque um arquivo novo (ui/navegacao.js) ficou
// de fora da publicação: aqui o teste pega o import quebrado antes.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");

function listar(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listar(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

test("todo import relativo em src/ aponta para um arquivo existente", () => {
  const quebrados = [];
  for (const arquivo of listar(path.join(raiz, "src")).filter((f) => f.endsWith(".js"))) {
    const texto = fs.readFileSync(arquivo, "utf8");
    for (const m of texto.matchAll(/(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g)) {
      const alvo = path.resolve(path.dirname(arquivo), m[1]);
      if (!fs.existsSync(alvo)) quebrados.push(`${path.relative(raiz, arquivo)} -> ${m[1]}`);
    }
  }
  assert.deepEqual(quebrados, []);
});

test("index.html só referencia arquivos que existem", () => {
  const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
  const faltando = [...html.matchAll(/(?:src|href)="((?:src|estilo)\/[^"]+)"/g)].map((m) => m[1]).filter((r) => !fs.existsSync(path.join(raiz, r)));
  assert.deepEqual(faltando, []);
});
