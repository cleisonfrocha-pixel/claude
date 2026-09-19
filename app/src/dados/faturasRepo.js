// Faturas de cartão — nascem automaticamente quando uma despesa é lançada
// num cartão (ver transacoesRepo.js). Nesta fase o cadastro é gerenciado
// pelo próprio sistema; a UI dedicada de fatura (limite, vencimento,
// destaque de proximidade) é da Fase 3 (§5).

import * as db from "./db.js";
import { padraoFatura } from "../domain/esquema.js";

const CAMINHO = "faturas";

export const faturas = {
  caminho: CAMINHO,
  listar: () => db.listar(CAMINHO),
  assinar: (cb) => db.assinar(CAMINHO, cb),
  apagar: (id) => db.apagar(CAMINHO, id),
};

/** Acha a fatura de um cartão numa competência; cria se ainda não existir. */
export async function obterOuCriarFatura(cartaoId, competencia) {
  const todas = await db.listar(CAMINHO);
  const existente = todas.find((f) => f.dados.cartaoId === cartaoId && f.dados.competencia === competencia);
  if (existente) return existente.id;
  const dados = padraoFatura({ cartaoId, competencia });
  return db.criar(CAMINHO, dados);
}

/** Marca a fatura como paga (chamado ao registrar o pagamento). */
export async function marcarFaturaPaga(faturaId) {
  return db.atualizar(CAMINHO, faturaId, { status: "paga" });
}
