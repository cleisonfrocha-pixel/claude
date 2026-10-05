import { test } from "node:test";
import assert from "node:assert/strict";
import { montarPlanoDeAcao } from "../src/domain/planoDeAcao.js";

const hoje = "2026-10-05";
const linhas = [
  { competencia: "2026-11", sobraCentavos: 36736, saldoFimCentavos: -69220, marcos: [] },
  { competencia: "2026-12", sobraCentavos: -253264, saldoFimCentavos: -322484, marcos: [{ texto: "Aluguel da casa começa", valorCentavos: 290000 }] },
];
const mapa = { linhas, buraco: { mesDaVirada: "2026-12", deficitMensalCentavos: 253264, pontoMaisBaixoCentavos: -322484, mesDoPontoMaisBaixo: "2026-12", faltaParaAguentarCentavos: 322484 } };
const panorama = { ofertas: [{ id: "a", credor: "Banco do Brasil", nome: "BB", valorCentavos: 381793, descontoPct: 88 }, { id: "b", credor: "Bradesco", nome: "B", valorCentavos: 352246, descontoPct: 64 }], totalOfertasCentavos: 734039, economiaCentavos: 3000000 };

test("plano de ação: curto prazo e atrasados vêm antes da virada, e o nome limpo depois", () => {
  const situacao = { buraco: { data: "2026-10-06", faltaCentavos: 7921, causas: [{ descricao: "Xbox", valorCentavos: 7690 }] }, decisao: { texto: "Adie o Lazer." }, comprometido: { grupos: { atrasado: { totalCentavos: 24338, itens: [{ descricao: "EDP", valorCentavos: 24338 }] } } }, livreGarantidoCentavos: 68063 };
  const r = montarPlanoDeAcao({ situacao, mapa, panorama, prazos: [{ id: "gedi", titulo: "Decidir a GEDI", data: "2026-11-30", diasAte: 56, nota: "dia exato a confirmar" }], hoje });
  assert.deepEqual(r.passos.map((p) => p.id), ["caixa-curto", "atrasadas", "virada", "nome", "prazo:gedi"]);
  assert.equal(r.passos[0].prazo, "Esta semana");
  assert.equal(r.veredito.tom, "urgente");
  const virada = r.passos.find((p) => p.id === "virada");
  assert.equal(virada.valorCentavos, 253264);
  assert.match(virada.titulo, /Dezembro/);
  assert.match(r.passos.find((p) => p.id === "nome").texto, /menos que a menor oferta/); // livre 680,63 < 3.522,46
});

test("plano de ação: sem buraco nem virada o plano diz que fecha; reserva zerada vira passo no fim", () => {
  const situacao = { buraco: null, comprometido: { grupos: { atrasado: { totalCentavos: 0, itens: [] } } }, livreGarantidoCentavos: 500000 };
  const folga = { linhas: [{ competencia: "2026-11", sobraCentavos: 100000, saldoFimCentavos: 900000, marcos: [] }], buraco: null };
  const r = montarPlanoDeAcao({ situacao, mapa: folga, panorama: { ofertas: [] }, reservaCentavos: 0, custoEssencialMesCentavos: 1200000, hoje });
  assert.equal(r.veredito.tom, "bom");
  assert.deepEqual(r.passos.map((p) => p.id), ["reserva"]);
  const cabe = montarPlanoDeAcao({ situacao, mapa: folga, panorama, hoje });
  assert.match(cabe.passos.find((p) => p.id === "nome").texto, /Dá para fechar a primeira agora/);
});
