// Guarda o "roxo com letra preta" (Sprint 11) de voltar: lê os tokens de
// cor direto de estilo/tokens.css (nunca hardcoda os valores — senão o
// teste para de proteger o arquivo real na primeira reformulação de
// paleta) e mede contraste WCAG 2.1 para todo par texto/fundo que existe
// hoje na interface, nos dois temas.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(AQUI, "..", "estilo", "tokens.css"), "utf8");

function extrairBloco(texto, marcador) {
  const inicioMarcador = texto.indexOf(marcador);
  assert.ok(inicioMarcador !== -1, `marcador não encontrado: ${marcador}`);
  const abre = texto.indexOf("{", inicioMarcador);
  let profundidade = 0;
  for (let i = abre; i < texto.length; i++) {
    if (texto[i] === "{") profundidade++;
    else if (texto[i] === "}") {
      profundidade--;
      if (profundidade === 0) return texto.slice(abre + 1, i);
    }
  }
  throw new Error(`bloco sem fechamento: ${marcador}`);
}

function extrairTokens(bloco) {
  const tokens = {};
  for (const m of bloco.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) tokens[m[1]] = m[2];
  return tokens;
}

function luminancia(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(hexA, hexB) {
  const [l1, l2] = [luminancia(hexA), luminancia(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

const TEMAS = {
  claro: extrairTokens(extrairBloco(CSS, ":root {")),
  escuro: extrairTokens(extrairBloco(CSS, ':root[data-theme="dark"]')),
};

// [token de texto, token de fundo, mínimo exigido, o que é na tela]
const PARES = [
  ["text", "bg", 4.5, "texto principal sobre o fundo da página"],
  ["text", "surface", 4.5, "texto principal sobre cartão"],
  ["text-muted", "surface", 4.5, "texto secundário sobre cartão"],
  ["text-faint", "surface", 3, "texto apagado (rótulo, legenda) sobre cartão — grande/maiúsculo"],
  ["accent", "bg", 4.5, "texto/ícone de marca (nav ativo, foco) sobre o fundo"],
  ["accent-ink", "accent-fill", 4.5, "letra sobre bloco preenchido de marca (botão, chip ativo, hero, dia selecionado)"],
  ["accent-ink", "accent-fill-2", 4.5, "letra sobre a ponta clara do degradê de marca"],
  ["good", "surface", 4.5, "texto de valor positivo sobre cartão"],
  ["warn", "surface", 4.5, "texto de atenção sobre cartão"],
  ["danger", "surface", 4.5, "texto de valor negativo/alerta sobre cartão"],
];

for (const [nomeTema, tokens] of Object.entries(TEMAS)) {
  test(`tema ${nomeTema}: todos os tokens usados no teste existem`, () => {
    for (const [fg, bg] of PARES) {
      assert.ok(tokens[fg], `token --${fg} não encontrado no tema ${nomeTema}`);
      assert.ok(tokens[bg], `token --${bg} não encontrado no tema ${nomeTema}`);
    }
  });

  for (const [fg, bg, minimo, descricao] of PARES) {
    test(`tema ${nomeTema}: ${descricao} (--${fg} sobre --${bg}) passa ${minimo}:1`, () => {
      const razao = contraste(tokens[fg], tokens[bg]);
      assert.ok(razao >= minimo, `contraste ${razao.toFixed(2)}:1, precisa de ${minimo}:1 (--${fg} ${tokens[fg]} sobre --${bg} ${tokens[bg]})`);
    });
  }
}
