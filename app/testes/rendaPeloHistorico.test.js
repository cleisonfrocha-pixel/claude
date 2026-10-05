import test from "node:test";
import assert from "node:assert/strict";
import { eventosFuturos, usoMensalDoCartao } from "../src/domain/previstos.js";
import { calcularHorizonte } from "../src/domain/projecao.js";
import { leituraDaFonte } from "../src/domain/pisoDaRenda.js";

let n = 0;
const rec = (fonteRendaId, competencia, valorCentavos) => ({ id: `r${++n}`, tipo: "receita", status: "pago", fonteRendaId, competencia, data: `${competencia}-07`, valorCentavos });
const meses = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const hoje = "2026-10-05";
const eventos = (fontesRenda, transacoes) => eventosFuturos({ transacoes, dividas: [], recorrencias: [], fontesRenda, cartoes: [], faturas: [], de: hoje, ate: "2026-12-31", hoje })
  .filter((e) => e.origem?.tipo === "fonteRenda");

test("fonte fixa em dia: conta o menor mês real, nunca mais que o cadastrado", () => {
  const f = [{ id: "f1", nome: "Sociable", tipo: "recorrente", valorEsperadoCentavos: 450000, diaRecebimento: 1 }];
  const tx = meses.map((m, i) => rec("f1", m, i === 2 ? 410000 : 450000));
  const ev = eventos(f, tx);
  assert.ok(ev.length > 0);
  assert.ok(ev.every((e) => e.valorCentavos === 410000 && e.certeza === "provavel" && e.baseadoEmMeses === 6));
});

test("fonte irregular: conta a média real como incerta (fora do saldo seguro)", () => {
  const f = [{ id: "f2", nome: "Gábia", tipo: "recorrente", valorEsperadoCentavos: 170000, diaRecebimento: 7 }];
  const tx = [rec("f2", "2026-04", 170000), rec("f2", "2026-06", 100000), rec("f2", "2026-08", 170000)];
  const ev = eventos(f, tx);
  assert.ok(ev.length > 0);
  assert.ok(ev.every((e) => e.certeza === "incerto" && e.valorCentavos < 170000 && e.valorCentavos > 0));
});

test("fonte que caiu: conta a média dos 3 últimos meses, incerta", () => {
  const f = [{ id: "f3", nome: "Cliente", tipo: "recorrente", valorEsperadoCentavos: 300000, diaRecebimento: 7 }];
  const tx = [rec("f3", "2026-03", 300000), rec("f3", "2026-04", 300000), rec("f3", "2026-05", 300000), rec("f3", "2026-06", 50000)];
  const ev = eventos(f, tx);
  assert.ok(ev.every((e) => e.certeza === "incerto" && e.valorCentavos < 100000));
});

test("pouca história (menos de 3 meses): continua valendo o valor cadastrado", () => {
  const f = [{ id: "f4", nome: "Nova", tipo: "fixa", valorEsperadoCentavos: 200000, diaRecebimento: 5 }];
  const ev = eventos(f, [rec("f4", "2026-08", 150000), rec("f4", "2026-09", 150000)]);
  assert.ok(ev.every((e) => e.valorCentavos === 200000 && e.baseadoEmMeses === 0));
});

test("o plano muda quando o piso da fonte muda", () => {
  const f = [{ id: "f1", nome: "Sociable", tipo: "recorrente", valorEsperadoCentavos: 450000, diaRecebimento: 1 }];
  const comPiso = (piso) => meses.map((m, i) => rec("f1", m, i === 2 ? piso : 450000));
  const saldo = (tx) => calcularHorizonte({ transacoes: tx, faturas: [], cartoes: [], dividas: [], recorrencias: [], fontesRenda: f, saldoInicialCentavos: 0, hoje, dias: 90 });
  const a = saldo(comPiso(450000)), b = saldo(comPiso(300000));
  const ultimo = (r) => JSON.stringify(r).length; // forma não importa: o resultado tem que diferir
  assert.notEqual(JSON.stringify(a), JSON.stringify(b));
  assert.ok(ultimo(a) > 0);
});

test("leituraDaFonte: mês sem receber conta como zero desde o primeiro recebimento", () => {
  const l = leituraDaFonte([rec("x", "2026-04", 100), rec("x", "2026-06", 100), rec("x", "2026-08", 100)], "2026-10");
  assert.deepEqual(l.valores, [100, 0, 100, 0, 100, 0]); // vai até setembro: a fonte não pagou em setembro
  assert.equal(l.pisoCentavos, 0);
  assert.equal(l.selo, "irregular");
});

test("cartão: o uso mensal vem da média das últimas faturas fechadas, não do cadastro", () => {
  const cartao = { id: "c1", usoMensalCentavos: 65000 };
  const faturas = [{ id: "fa1", cartaoId: "c1", competencia: "2026-07" }, { id: "fa2", cartaoId: "c1", competencia: "2026-08" }, { id: "fa3", cartaoId: "c1", competencia: "2026-09" }];
  const tx = [
    { tipo: "pagamento_fatura", status: "pago", faturaId: "fa1", valorCentavos: 150000 },
    { tipo: "pagamento_fatura", status: "pago", faturaId: "fa2", valorCentavos: 100000 }, { tipo: "pagamento_fatura", status: "pago", faturaId: "fa2", valorCentavos: 50000 },
    { tipo: "despesa", status: "pago", faturaId: "fa3", valorCentavos: 180000 },
  ];
  const r = usoMensalDoCartao(cartao, { transacoes: tx, faturas, competenciaHoje: "2026-10" });
  assert.equal(r.valorCentavos, 160000);
  assert.equal(r.origem, "faturas");
  assert.equal(usoMensalDoCartao(cartao, { transacoes: [], faturas: [], competenciaHoje: "2026-10" }).valorCentavos, 65000);
});

test("cenários: renda garantida de fonte irregular é o piso real, não o combinado", async () => {
  const { montarBaseCenarios } = await import("../src/domain/cenarios.js");
  const f = [{ id: "f2", nome: "Gábia", tipo: "recorrente", valorEsperadoCentavos: 170000, ativa: true }, { id: "f1", nome: "Sociable", tipo: "recorrente", valorEsperadoCentavos: 450000, ativa: true }];
  const tx = [...meses.map((m) => rec("f1", m, 450000)), rec("f2", "2026-04", 170000), rec("f2", "2026-06", 100000), rec("f2", "2026-08", 170000)];
  const base = montarBaseCenarios({ transacoes: tx, categorias: [], dividas: [], fontesRenda: f, recorrencias: [], cartoes: [], faturas: [], ativos: [], clareza: { saldoAtualCentavos: 0, saldoReservaCentavos: 0 }, competencia: "2026-10", hoje });
  assert.equal(base.rendaGarantidaCentavos, 450000); // Sociable inteira, Gábia pelo piso real (0)
});
