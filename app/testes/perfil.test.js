import { test } from "node:test";
import assert from "node:assert/strict";
import { padraoPerfil, validarPerfil, prazosQueVem, perfilParaIA, instrucoesDoPerfil } from "../src/domain/perfil.js";

const perfil = padraoPerfil({
  secoes: [{ id: "gedi", titulo: "GEDI", texto: "Cota de 10%\n   vale 25 mil." }, { id: "ml", titulo: "Mercado Livre", texto: "Kits." }],
  prazos: [
    { id: "obra", data: "2026-10-31", titulo: "Obra do galpão termina" },
    { id: "gedi", data: "2026-11-30", titulo: "Decidir sobre a GEDI", nota: "Entrar como sócio ou sair sem dívida" },
    { id: "velho", data: "2026-08-01", titulo: "Passou" },
    { id: "longe", data: "2028-01-01", titulo: "Longe" },
  ],
});

test("prazos que vêm: ordem por data, sem vencido antigo e sem o que está longe", () => {
  const p = prazosQueVem(perfil, "2026-10-03", { dias: 90 });
  assert.deepEqual(p.map((x) => x.id), ["obra", "gedi"]);
  assert.equal(p[0].diasAte, 28);
});

test("linhas para a IA: perfil primeiro, texto numa linha, prazos com dias e a regra do dinheiro fechado", () => {
  const l = perfilParaIA(perfil, "2026-10-03");
  assert.equal(l[0].fonte, "Perfil");
  assert.ok(l.every((x) => x.fonte && x.texto));
  assert.equal(l.find((x) => x.fonte === "Perfil · GEDI").texto, "Cota de 10% vale 25 mil.");
  assert.match(l.find((x) => x.texto.startsWith("2026-11-30")).texto, /faltam 58 dias.*Entrar como sócio/);
  assert.match(l.at(-1).texto, /dinheiro fechado/);
});

test("sem perfil, nada é inventado: sem linhas e sem instruções extras", () => {
  assert.deepEqual(perfilParaIA(padraoPerfil(), "2026-10-03"), []);
  assert.equal(instrucoesDoPerfil(null), "");
  assert.match(instrucoesDoPerfil(perfil), /sem travessão/);
});

test("validação: prazo sem data ou título é erro", () => {
  assert.deepEqual(validarPerfil(perfil), []);
  assert.equal(validarPerfil({ secoes: [], prazos: [{ titulo: "x", data: "amanhã" }] }).length, 1);
});
