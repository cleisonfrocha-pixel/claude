import { test } from "node:test";
import assert from "node:assert/strict";
import { montarRecuperacao } from "../src/domain/recuperacao.js";
import { alavancas } from "../src/domain/planoGeral.js";

const placar = { total: 10, limpas: 2, faltam: 8, valorQueFaltaCentavos: 5000000 };

test("recuperação: meta mostra quanto falta no pior dia e quantos nomes sujos", () => {
  const r = montarRecuperacao({ situacao: { menorPontoCentavos: -90189 }, placar, panorama: { totalOfertasCentavos: 1000000, economiaCentavos: 400000 }, passos: [{ quando: "depois", titulo: "x" }, { quando: "hoje", titulo: "Pagar" }], instantaneos: [], competencia: "2026-10", competenciaAnterior: "2026-09" });
  assert.equal(r.meta.faltaCaixaCentavos, 90189);
  assert.match(r.meta.frase, /R\$\s?901,89/);
  assert.equal(r.progresso.percentual, 20);
  assert.equal(r.proximoPasso.titulo, "Pagar");
  assert.equal(r.semComparacao, true);
});

test("recuperação: caixa fechando e sem nome sujo", () => {
  const r = montarRecuperacao({ situacao: { menorPontoCentavos: 5000 }, placar: { total: 0, limpas: 0, faltam: 0 }, passos: [], instantaneos: [], competencia: "2026-10", competenciaAnterior: "2026-09" });
  assert.equal(r.meta.faltaCaixaCentavos, 0);
  assert.equal(r.proximoPasso, null);
  assert.match(r.meta.frase, /nome limpo/);
});

test("recuperação: compara com o instantâneo do mês passado", () => {
  const inst = [
    { competencia: "2026-09", atrasadasQuantidade: 6, menorPontoCentavos: -200000 },
    { competencia: "2026-10", atrasadasQuantidade: 4, menorPontoCentavos: -90000 },
  ];
  const r = montarRecuperacao({ situacao: { menorPontoCentavos: -90000 }, placar, passos: [], instantaneos: inst, competencia: "2026-10", competenciaAnterior: "2026-09" });
  assert.equal(r.semComparacao, false);
  assert.match(r.mudou.join(" "), /2 contas atrasadas a menos/);
  assert.match(r.mudou.join(" "), /melhor/);
});

test("alavancas: estoque do negócio não é sugestão de corte; renda vem das fontes reais", () => {
  const categorias = [{ id: "c1", natureza: "despesa", essencial: false, grupo: "negocio", nome: "Estoque e revenda" }];
  const transacoes = [{ tipo: "despesa", competencia: "2026-10", categoriaId: "c1", valorCentavos: 200000, status: "pago" }];
  const fontesRenda = [
    { nome: "Gedi / Tony (passa direto: paga equipe)", valorEsperadoCentavos: 350000, fim: "2026-12", ativa: true },
    { nome: "CryptoPag", valorEsperadoCentavos: 250000, fim: "2026-12", ativa: true },
    { nome: "Sociable", valorEsperadoCentavos: 450000, ativa: true },
  ];
  const r = alavancas({ transacoes, categorias, dividas: [], competencia: "2026-10", hoje: "2026-10-06", sobraCentavos: -100000, fontesRenda });
  assert.equal(r.some((a) => a.id.startsWith("corte:")), false);
  const renda = r.find((a) => a.id === "renda:deficit");
  assert.match(renda.titulo, /CryptoPag/);
  assert.match(renda.titulo, /12\/26/);
  assert.match(renda.premissa, /Sociable/);
});
