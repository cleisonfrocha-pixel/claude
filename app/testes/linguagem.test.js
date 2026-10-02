// Linguagem de quem não é de finanças: termos técnicos não aparecem pra
// pessoa na tela. A lista é curta de propósito; cresce quando um termo novo
// escapar. Vale pro texto das telas (src/ui), não pro nome de variável.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PROIBIDAS = /\b(margem|gaps?|discricion[aá]ri[oa]s?|extraordin[aá]ri[oa]s?|passivos?|snapshots?|comprometimento|competência)\b/i;

function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith(".js") ? [p] : [];
  });
}

/** Só o texto que a pessoa pode ver: sem comentários, sem expressões ${...},
 * sem atributos técnicos (id, for, data-*, class, style). */
function textoVisivel(codigo) {
  return codigo.split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*|const \{|import )/.test(l))
    .map((l) => l.replace(/\/\/ .*$/, ""))
    .map((l) => l.replace(/\$\{[^}]*\}/g, " "))
    .map((l) => l.replace(/\b(id|for|class|style|data-[a-z-]+|aria-[a-z]+)="[^"]*"/g, " "))
    .map((l) => l.replace(/gap:\s*\d+px/g, " "))
    .join("\n");
}

test("nenhuma tela mostra termo técnico (margem, gap, discricionário, passivo…)", () => {
  const achados = [];
  for (const arq of arquivos("src/ui")) {
    textoVisivel(readFileSync(arq, "utf8")).split("\n").forEach((l, i) => {
      if (PROIBIDAS.test(l)) achados.push(`${arq}:${i + 1}: ${l.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(achados, []);
});
