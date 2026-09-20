// Metas do orçamento (§13) que não são calculadas a partir de lançamento
// nenhum — são decisão do usuário: o custo de vida desejado/planejado, e
// (se o usuário quiser dar um número explícito) a meta de recuperação
// financeira do §12. Um documento único, porque não é uma coleção de
// registros, é configuração — mesmo padrão de `meta/schema` (migrador.js).

import * as db from "./db.js";

const DOC = "configuracoes/orcamento";

export async function obterMetas() {
  const dados = await db.lerDocumento(DOC);
  return {
    custoDesejadoCentavos: dados?.custoDesejadoCentavos ?? null,
    metaRecuperacaoCentavos: dados?.metaRecuperacaoCentavos ?? null,
  };
}

export async function definirMetas(campos) {
  const atual = await db.lerDocumento(DOC);
  return db.definirDocumento(DOC, { ...(atual || {}), ...campos });
}
