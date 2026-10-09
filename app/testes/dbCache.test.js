import { test } from "node:test";
import assert from "node:assert/strict";

// Banco falso que deixa a leitura "demorar": simula uma leitura em voo que termina depois de uma escrita.
const store = { cx: {} };
let liberar = null;
globalThis.window = {
  claude: {
    use: async () => ({
      collection: (c) => ({
        get: () => new Promise((res) => {
          const foto = Object.entries(store[c]).map(([id, d]) => ({ id, exists: true, data: () => d }));
          if (liberar === "segurar") liberar = () => res({ docs: foto }); else res({ docs: foto });
        }),
        doc: (id) => ({
          set: async (d) => { store[c][id] = d; },
          update: async (d) => { store[c][id] = { ...store[c][id], ...d }; },
          delete: async () => { delete store[c][id]; },
          get: async () => ({ exists: !!store[c][id], data: () => store[c][id] }),
        }),
        add: async (d) => { const id = `n${Object.keys(store[c]).length + 1}`; store[c][id] = d; return { id }; },
        onSnapshot: () => () => {},
      }),
    }),
  },
};

const db = await import("../src/dados/db.js");

test("cache de leitura: leitura em voo antes da escrita não esconde o dado novo", async () => {
  store.cx = { a: { v: 1 } };
  liberar = "segurar";
  const velha = db.listar("cx"); // começa antes da escrita e termina depois
  await new Promise((r) => setTimeout(r, 5));
  await db.definir("cx", "b", { v: 2 });
  liberar();
  await velha;
  const nova = await db.listar("cx");
  assert.deepEqual(nova.map((x) => x.id).sort(), ["a", "b"]);
});
