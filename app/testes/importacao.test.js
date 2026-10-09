import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dividirLinhaCSV, detectarDelimitadorCSV, parseCSV, parseOFX,
  detectarDuplicatas, detectarTransferencias, classificarAmbiguidade, prepararCandidatos,
} from "../src/domain/importacao.js";

// ---------- dividirLinhaCSV / detectarDelimitadorCSV ----------

test("dividirLinhaCSV: respeita aspas com o delimitador dentro do campo", () => {
  const r = dividirLinhaCSV('15/03/2026,"Mercado, Supermercado Ltda",-150.00', ",");
  assert.deepEqual(r, ["15/03/2026", "Mercado, Supermercado Ltda", "-150.00"]);
});

test("dividirLinhaCSV: aspas duplicadas viram uma aspa literal", () => {
  const r = dividirLinhaCSV('a,"disse ""oi""",c', ",");
  assert.deepEqual(r, ["a", 'disse "oi"', "c"]);
});

test("detectarDelimitadorCSV: escolhe ponto e vírgula quando predomina", () => {
  assert.equal(detectarDelimitadorCSV("15/03/2026;Mercado;-150,00"), ";");
});

test("detectarDelimitadorCSV: escolhe vírgula quando predomina", () => {
  assert.equal(detectarDelimitadorCSV("15/03/2026,Mercado,-150.00"), ",");
});

// ---------- parseCSV ----------

test("parseCSV: linha comum vira candidato válido, com tipo derivado do sinal", () => {
  const r = parseCSV("15/03/2026,Mercado,-150,00\n16/03/2026,Salário,3000,00");
  assert.equal(r.length, 2);
  assert.equal(r[0].data, "2026-03-15");
  assert.equal(r[0].descricao, "Mercado");
  assert.equal(r[0].valorCentavos, -15000);
  assert.equal(r[0].tipo, "despesa");
  assert.equal(r[0].valido, true);
  assert.equal(r[1].tipo, "receita");
});

test("parseCSV: ignora a primeira linha quando temCabecalho", () => {
  const r = parseCSV("data,descricao,valor\n15/03/2026,Mercado,-150,00", { temCabecalho: true });
  assert.equal(r.length, 1);
  assert.equal(r[0].descricao, "Mercado");
});

test("parseCSV: data ilegível vira candidato inválido, não derruba a importação", () => {
  const r = parseCSV("data-esquisita,Mercado,-150,00");
  assert.equal(r[0].data, null);
  assert.equal(r[0].valido, false);
});

test("parseCSV: respeita colunas em ordem diferente quando configurado", () => {
  const r = parseCSV("Mercado;-150,00;15/03/2026", { colunaDescricao: 0, colunaValor: 1, colunaData: 2 });
  assert.equal(r[0].data, "2026-03-15");
  assert.equal(r[0].descricao, "Mercado");
});

// ---------- parseOFX ----------

const OFX_EXEMPLO = `
<OFX>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260315120000[-03:EST]
<TRNAMT>-150.00
<FITID>2026031500001
<MEMO>PADARIA CENTRAL
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260316120000[-03:EST]
<TRNAMT>3000.00
<FITID>2026031600002
<MEMO>SALARIO
</STMTTRN>
</BANKTRANLIST>
</OFX>
`;

test("PORTÃO §18: OFX extrai data, valor e FITID de cada STMTTRN", () => {
  const r = parseOFX(OFX_EXEMPLO);
  assert.equal(r.length, 2);
  assert.equal(r[0].data, "2026-03-15");
  assert.equal(r[0].valorCentavos, -15000);
  assert.equal(r[0].tipo, "despesa");
  assert.equal(r[0].externoId, "2026031500001");
  assert.equal(r[0].descricao, "PADARIA CENTRAL");
  assert.equal(r[1].tipo, "receita");
});

test("parseOFX: texto sem nenhum STMTTRN retorna lista vazia", () => {
  assert.deepEqual(parseOFX("<OFX></OFX>"), []);
});

// ---------- detectarDuplicatas ----------

test("detectarDuplicatas: mesmo FITID (origemId) já existente é duplicata certa", () => {
  const candidatos = [{ data: "2026-03-15", valorCentavos: -15000, externoId: "FIT1" }];
  const existentes = [{ id: "t1", contaId: "c1", data: "2026-03-15", valorCentavos: -15000, origemId: "FIT1" }];
  const r = detectarDuplicatas(candidatos, existentes, "c1");
  assert.equal(r[0].possivelDuplicata, true);
  assert.equal(r[0].duplicataDe, "t1");
});

test("detectarDuplicatas: sem id externo, mesma data e valor na mesma conta vira possível duplicata", () => {
  const candidatos = [{ data: "2026-03-15", valorCentavos: -15000, externoId: null }];
  const existentes = [{ id: "t1", contaId: "c1", data: "2026-03-15", valorCentavos: -15000, origemId: null }];
  const r = detectarDuplicatas(candidatos, existentes, "c1");
  assert.equal(r[0].possivelDuplicata, true);
});

test("detectarDuplicatas: mesma data e valor mas em OUTRA conta não é duplicata", () => {
  const candidatos = [{ data: "2026-03-15", valorCentavos: -15000, externoId: null }];
  const existentes = [{ id: "t1", contaId: "outra-conta", data: "2026-03-15", valorCentavos: -15000, origemId: null }];
  const r = detectarDuplicatas(candidatos, existentes, "c1");
  assert.equal(r[0].possivelDuplicata, false);
});

test("detectarDuplicatas: nada parecido, não é duplicata", () => {
  const candidatos = [{ data: "2026-03-15", valorCentavos: -15000, externoId: null }];
  const r = detectarDuplicatas(candidatos, [], "c1");
  assert.equal(r[0].possivelDuplicata, false);
});

// ---------- detectarTransferencias ----------

test("detectarTransferencias: saída aqui e entrada em outra conta própria, valor igual e data próxima, vira possível transferência", () => {
  const candidatos = [{ data: "2026-03-15", valorCentavos: -50000, possivelDuplicata: false }];
  const existentes = [{ id: "t1", contaId: "conta-b", data: "2026-03-16", valorCentavos: 50000, tipo: "receita" }];
  const r = detectarTransferencias(candidatos, existentes, "conta-a");
  assert.equal(r[0].possivelTransferencia, true);
  assert.equal(r[0].transferenciaCom.contaId, "conta-b");
});

test("detectarTransferencias: já marcado como duplicata não é analisado como transferência", () => {
  const candidatos = [{ data: "2026-03-15", valorCentavos: -50000, possivelDuplicata: true }];
  const existentes = [{ id: "t1", contaId: "conta-b", data: "2026-03-16", valorCentavos: 50000, tipo: "receita" }];
  const r = detectarTransferencias(candidatos, existentes, "conta-a");
  assert.equal(r[0].possivelTransferencia, undefined);
});

test("detectarTransferencias: valor igual e mesmo sinal (duas despesas) não é transferência", () => {
  const candidatos = [{ data: "2026-03-15", valorCentavos: -50000, possivelDuplicata: false }];
  const existentes = [{ id: "t1", contaId: "conta-b", data: "2026-03-16", valorCentavos: -50000, tipo: "despesa" }];
  const r = detectarTransferencias(candidatos, existentes, "conta-a");
  assert.equal(r[0].possivelTransferencia, false);
});

// ---------- classificarAmbiguidade ----------

test("classificarAmbiguidade: descrição contém o nome de uma categoria ativa, sugere e não é ambíguo", () => {
  const candidatos = [{ descricao: "Compra no Mercado Central", possivelDuplicata: false, possivelTransferencia: false }];
  const categorias = [{ id: "cat1", nome: "Mercado", ativa: true, natureza: "despesa" }];
  const r = classificarAmbiguidade(candidatos, categorias);
  assert.equal(r[0].ambiguo, false);
  assert.equal(r[0].categoriaSugeridaId, "cat1");
});

test("classificarAmbiguidade: nenhuma categoria bate, fica ambíguo", () => {
  const candidatos = [{ descricao: "XYZ123 loja desconhecida", possivelDuplicata: false, possivelTransferencia: false }];
  const categorias = [{ id: "cat1", nome: "Mercado", ativa: true, natureza: "despesa" }];
  const r = classificarAmbiguidade(candidatos, categorias);
  assert.equal(r[0].ambiguo, true);
});

// ---------- prepararCandidatos (pipeline) ----------

test("PORTÃO §18: importar o mesmo extrato duas vezes marca tudo como duplicata na segunda vez", () => {
  const bruto = parseOFX(OFX_EXEMPLO);
  const categorias = [{ id: "cat1", nome: "Padaria", ativa: true, natureza: "despesa" }];

  // Primeira importação: nada existe ainda, nenhum candidato é duplicata.
  const primeira = prepararCandidatos(bruto, { transacoesExistentes: [], categorias, contaId: "c1" });
  assert.equal(primeira.every((c) => !c.possivelDuplicata), true);

  // Depois de "confirmar" a primeira importação, as transações reais
  // existem com o FITID guardado em origemId (mesma convenção do repositório).
  const existentesDepois = primeira.map((c, i) => ({
    id: `real-${i}`, contaId: "c1", data: c.data, valorCentavos: c.valorCentavos, origemId: c.externoId,
  }));

  // Reimportar o MESMO extrato: todo candidato tem que ser reconhecido
  // como duplicata — nunca um segundo lançamento igual.
  const segunda = prepararCandidatos(bruto, { transacoesExistentes: existentesDepois, categorias, contaId: "c1" });
  assert.equal(segunda.every((c) => c.possivelDuplicata === true), true);
});

import { conciliarComPrevistos, prepararCandidatos as prepararCand } from "../src/domain/importacao.js";

test("conciliar: linha do extrato casa com o previsto (valor e data próximos) e não vira duplicata", () => {
  const existentes = [{ id: "t1", contaId: "c1", tipo: "despesa", status: "previsto", valorCentavos: 15000, data: "2026-10-13", descricao: "Conta de Luz", categoriaId: "cat1" }];
  const [r] = prepararCand([{ data: "2026-10-14", descricao: "ENEL LUZ", valorCentavos: -15650, tipo: "despesa", valido: true }], { transacoesExistentes: existentes, categorias: [], contaId: "c1" });
  assert.equal(r.possivelDuplicata, false);
  assert.equal(r.conciliaCom.id, "t1");
  assert.equal(r.categoriaSugeridaId, "cat1");
});

test("conciliar: um previsto só casa com uma linha; longe demais não casa", () => {
  const existentes = [{ id: "t1", contaId: "c1", tipo: "despesa", status: "previsto", valorCentavos: 10000, data: "2026-10-10", descricao: "Internet" }];
  const cands = [
    { data: "2026-10-10", descricao: "A", valorCentavos: -10000, tipo: "despesa", valido: true },
    { data: "2026-10-11", descricao: "B", valorCentavos: -10000, tipo: "despesa", valido: true },
    { data: "2026-12-01", descricao: "C", valorCentavos: -10000, tipo: "despesa", valido: true },
  ];
  const r = conciliarComPrevistos(cands.map((c) => ({ ...c, possivelDuplicata: false, possivelTransferencia: false })), existentes, "c1");
  assert.equal(r.filter((x) => x.conciliaCom).length, 1);
  assert.equal(r[2].conciliaCom, null);
});

test("conciliar: valor só parecido (sem nome parecido) não casa", () => {
  const existentes = [{ id: "t1", contaId: "c1", tipo: "despesa", status: "previsto", valorCentavos: 8500, data: "2026-10-13", descricao: "Galão de água" }];
  const [r] = prepararCand([{ data: "2026-10-13", descricao: "Algo que não existe", valorCentavos: -7700, tipo: "despesa", valido: true }], { transacoesExistentes: existentes, categorias: [], contaId: "c1" });
  assert.equal(r.conciliaCom, null);
});

import { comIdentificadorEstavel, detectarDuplicatas as detectarDup2 } from "../src/domain/importacao.js";

test("importação idempotente: linha sem id do banco ganha identificador estável e reimportar acusa duplicata", () => {
  const cand = [
    { data: "2026-10-01", valorCentavos: -5040, descricao: "Pix Mercado", tipo: "despesa" },
    { data: "2026-10-01", valorCentavos: -5040, descricao: "Pix Mercado", tipo: "despesa" },
  ];
  const [a, b] = comIdentificadorEstavel(cand, "c1");
  assert.notEqual(a.idExterno, b.idExterno, "duas linhas idênticas no mesmo arquivo continuam sendo duas");
  const gravadas = [{ id: "t1", contaId: "c1", status: "pago", idExterno: a.idExterno, valorCentavos: 5040, data: "2026-10-05" }];
  const r = detectarDup2(cand, gravadas, "c1");
  assert.equal(r[0].possivelDuplicata, true);
  assert.equal(r[0].motivoDuplicata, "mesmo identificador do banco");
  assert.equal(r[1].possivelDuplicata, false, "a segunda linha idêntica não foi gravada ainda");
});
