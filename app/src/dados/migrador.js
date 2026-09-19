// Versionador de esquema: garante que `meta/schema` existe e está na
// versão atual, e é o lugar onde futuras migrações (Fase 1 em diante)
// vão se registrar. Ver docs/ARQUITETURA.md, D1, e MODELO-DE-DADOS.md.
//
// NOTA SOBRE A CÓPIA DO PAINEL GEDI: este produto nasceu de uma cópia do
// artefato "Painel GEDI", que gerencia receita/custo de uma agência
// (clientes, provedores, lançamentos mensais). O domínio deste produto é
// outro — vida financeira pessoal/familiar (pessoas, contas, cartões,
// dívidas). Não existe correspondência 1:1 entre "cliente da agência" e
// "pessoa da família", nem entre "custo de fornecedor" e "despesa
// doméstica" — inventar esse mapeamento produziria dados incorretos.
// Por isso este migrador NÃO tenta importar o estado antigo do GEDI: ele
// prepara a infraestrutura de versionamento (o padrão herdado do
// `normalizeState` do GEDI) para as migrações reais que vêm a partir da
// Fase 1, quando o próprio esquema deste produto evoluir.

import * as db from "./db.js";
import { VERSAO_ESQUEMA } from "../domain/esquema.js";

const DOC_SCHEMA = "meta/schema";

/**
 * Garante meta/schema. Retorna { versao, primeiraExecucao }.
 * Idempotente e seguro para chamar toda vez que o app inicia.
 */
export async function garantirEsquema() {
  const atual = await db.lerDocumento(DOC_SCHEMA);
  if (!atual) {
    await db.definirDocumento(DOC_SCHEMA, {
      versao: VERSAO_ESQUEMA,
      migradoEm: new Date().toISOString(),
      origem: "novo",
    });
    return { versao: VERSAO_ESQUEMA, primeiraExecucao: true };
  }
  if (atual.versao < VERSAO_ESQUEMA) {
    // Migrações futuras entram aqui, uma por versão, em ordem — cada uma
    // lendo o formato da versão anterior e escrevendo o novo, sem perder
    // dado. Nenhuma existe ainda porque VERSAO_ESQUEMA acabou de nascer.
    await db.definirDocumento(DOC_SCHEMA, {
      ...atual,
      versao: VERSAO_ESQUEMA,
      migradoEm: new Date().toISOString(),
    });
  }
  return { versao: atual.versao, primeiraExecucao: false };
}
