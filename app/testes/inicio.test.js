import { test } from "node:test";
import assert from "node:assert/strict";
import { confiancaDoNumero, proximosDias, completarRetrato } from "../src/domain/inicio.js";

test("confiança: tudo confirmado é alta; sem entradas também", () => {
  assert.equal(confiancaDoNumero([{ valorCentavos: 1000, certeza: "confirmado" }]).nivel, "alta");
  assert.equal(confiancaDoNumero([]).nivel, "alta");
});

test("confiança: Cleison, renda cadastrada e nada recebido = baixa", () => {
  const c = confiancaDoNumero([{ valorCentavos: 900000, certeza: "provavel" }, { valorCentavos: 100000, certeza: "confirmado" }]);
  assert.equal(c.nivel, "baixa");
  assert.equal(c.esperadoCentavos, 900000);
});

test("confiança: metade esperada é média", () => {
  assert.equal(confiancaDoNumero([{ valorCentavos: 500, certeza: "provavel" }, { valorCentavos: 500, certeza: "confirmado" }]).nivel, "media");
});

test("próximos dias: corta em 7 dias e põe atrasado primeiro", () => {
  const r = proximosDias({
    hoje: "2026-10-03",
    compromissos: [{ data: "2026-10-05", descricao: "Luz" }, { data: "2026-10-20", descricao: "Longe" }, { data: "2026-10-03", descricao: "Velho", atrasado: true }],
    entradas: [{ data: "2026-10-04", descricao: "Salário" }],
  });
  assert.deepEqual(r.map((i) => i.descricao), ["Velho", "Salário", "Luz"]);
});

test("completar retrato: pessoa sem renda e sem bens/metas", () => {
  const f = completarRetrato({
    pessoas: [{ id: "p1", nome: "Carolina", papel: "conjuge" }, { id: "p2", nome: "Filho", papel: "filho" }],
    contas: [], cartoes: [], fontesRenda: [], dividas: [], ativos: [], objetivos: [],
  }).map((x) => x.id);
  assert.ok(f.includes("renda-p1") && f.includes("conta-p1") && f.includes("bens") && f.includes("meta"));
  assert.ok(!f.some((id) => id.endsWith("p2")));
});

test("completar retrato: metas de proteção em branco pedem preenchimento; investimento zero não", () => {
  const base = { pessoas: [], contas: [], cartoes: [], fontesRenda: [], dividas: [], ativos: [{}], objetivos: [{}] };
  assert.ok(completarRetrato({ ...base, metas: { custoDesejadoCentavos: null, metaRecuperacaoCentavos: null, investimentoMinimoMensalCentavos: 0 } }).some((f) => f.id === "metas-protecao"));
  assert.ok(!completarRetrato({ ...base, metas: { custoDesejadoCentavos: 1, metaRecuperacaoCentavos: 1, investimentoMinimoMensalCentavos: 0 } }).some((f) => f.id === "metas-protecao"));
});

test("próximos dias: verba sem dia fixo vai por último e nunca disfarça de data", () => {
  const r = proximosDias({
    compromissos: [{ descricao: "Mercado", data: "2026-10-01", valorCentavos: 100, semDia: true }, { descricao: "Luz", data: "2026-10-05", valorCentavos: 100 }],
    entradas: [], hoje: "2026-10-02", dias: 7,
  });
  assert.deepEqual(r.map((i) => i.descricao), ["Luz", "Mercado"]);
});

test("agenda da Home: uma lista só, com as saídas que pesam marcadas e sem repetir", async () => {
  const { agendaDaHome } = await import("../src/domain/inicio.js");
  const jeep = { tipo: "saida", descricao: "Jeep", valorCentavos: 331637, data: "2026-11-04", vencimento: "2026-11-04" };
  const luz = { tipo: "saida", descricao: "Luz", valorCentavos: 15000, data: "2026-10-05", vencimento: "2026-10-05" };
  const entrada = { tipo: "entrada", descricao: "Salário", valorCentavos: 475000, data: "2026-10-07" };
  const atrasada = { tipo: "saida", descricao: "EDP", valorCentavos: 24338, data: "2026-10-03", vencimento: "2026-09-20", atrasado: true };
  const lista = agendaDaHome({ proximos: [entrada, luz, atrasada], pesa: [{ ...luz, razoes: ["essencial"] }, { ...jeep, razoes: ["parcela"] }] });
  assert.equal(lista.length, 4);                                     // luz não repete
  assert.equal(lista[0].descricao, "EDP");                           // atrasado primeiro
  assert.equal(lista.find((i) => i.descricao === "Luz").pesa, true);
  assert.deepEqual(lista.find((i) => i.descricao === "Luz").razoes, ["essencial"]);
  assert.equal(lista.find((i) => i.descricao === "Jeep").pesa, true); // pesado fora dos 7 dias não some
  assert.equal(lista.find((i) => i.descricao === "Salário").pesa, undefined);
});
