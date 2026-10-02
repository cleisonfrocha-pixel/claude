import { test } from "node:test";
import assert from "node:assert/strict";
import { diaDaFonte } from "../src/domain/previstos.js";

const pago = (data) => ({ status: "pago", data });

test("dia típico: com 3 recebimentos reais vale a mediana, não o cadastro", () => {
  const f = { diaRecebimento: 5 };
  assert.equal(diaDaFonte(f, [pago("2026-07-10"), pago("2026-08-12"), pago("2026-09-11")]), 11);
});

test("dia típico: com menos de 3 recebimentos vale o dia cadastrado", () => {
  assert.equal(diaDaFonte({ diaRecebimento: 5 }, [pago("2026-08-12"), pago("2026-09-11")]), 5);
});

test("dia típico: sem cadastro e sem histórico cai no fim do mês", () => {
  assert.equal(diaDaFonte({}, []), 31);
});
