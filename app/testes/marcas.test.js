import { test } from "node:test";
import assert from "node:assert/strict";
import { marcaDe, ICONES } from "../src/domain/marcas.js";

test("marcas: nomes do dia a dia viram o logo certo, com ou sem acento e erro de grafia", () => {
  assert.equal(marcaDe("Nubank PJ").titulo, ICONES.nubank.titulo);
  assert.equal(marcaDe("Fatura Crédito Shoppe (Carolina)").titulo, ICONES.shopee.titulo);
  assert.equal(marcaDe("Mercado Pago (galpão)").titulo, ICONES.mercadopago.titulo);
  assert.equal(marcaDe("Financiamento Jeep Compass").titulo, ICONES.jeep.titulo);
  assert.equal(marcaDe("iCloud+").titulo, ICONES.icloud.titulo);
  assert.equal(marcaDe("Armazenamento Google (Gmail)").titulo, ICONES.google.titulo);
  assert.equal(marcaDe("Claude IA").titulo, ICONES.claude.titulo);
});

test("marcas: sem logo livre, vira sigla na cor da marca; o título tem prioridade sobre o resto", () => {
  const b = marcaDe("Bradesco (cartão da obra do galpão)");
  assert.equal(b.tipo, "sigla");
  assert.equal(b.sigla, "B");
  assert.equal(marcaDe("Parcela da obra", "Bradesco").sigla, "B");     // cai no segundo texto se o primeiro não diz nada
  assert.equal(marcaDe("Mercado do mês").tipo, "sigla");               // "mercado" sozinho não é Mercado Pago nem Livre
  assert.notEqual(marcaDe("Mercado do mês").sigla, "ML");
  assert.equal(marcaDe("Meta de reserva").tipo, "sigla");              // "meta" não é a empresa Meta
});

test("marcas: a cor do nome sem marca é estável e nomes diferentes não ficam todos iguais", () => {
  assert.equal(marcaDe("Aluguel da casa").fundo, marcaDe("Aluguel da casa").fundo);
  const cores = new Set(["Aluguel da casa", "Galão de água", "Internet residencial", "TV por assinatura", "Café e itens", "Seguro fiança"].map((n) => marcaDe(n).fundo));
  assert.ok(cores.size >= 3);
});

test("marcas: a sigla ignora parênteses e ligações (da, de, na)", async () => {
  const { iniciaisDoNome } = await import("../src/domain/marcas.js");
  assert.equal(iniciaisDoNome("Aporte na GEDI (do Del Poente, abate a cota)"), "AG");
  assert.equal(iniciaisDoNome("Brena Coordenadora (Del Poente, final)"), "BC");
  assert.equal(iniciaisDoNome("Aluguel da casa"), "AC");
  assert.equal(iniciaisDoNome("(10%)"), "?");
});
