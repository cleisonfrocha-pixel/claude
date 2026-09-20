// Importação e reconciliação (§18). Duas etapas sempre separadas: analisar
// (só leitura — nada é gravado, é a pré-visualização que a tela de revisão
// mostra) e confirmar (grava o lote original intacto — "manutenção do
// histórico original" — e comita só os candidatos que o usuário aceitou,
// via a mesma criarSimples/criarTransferencia da Fase 1, nunca uma
// segunda forma de escrever transação).

import * as db from "./db.js";
import { categorias } from "./repositorios.js";
import { transacoes, criarSimples, criarTransferencia } from "./transacoesRepo.js";
import { parseCSV, parseOFX, prepararCandidatos } from "../domain/importacao.js";

const CAMINHO_LOTES = "lotesImportacao";

function comId(lista) {
  return lista.map((item) => ({ id: item.id, ...item.dados }));
}

function agora() {
  return new Date().toISOString();
}

/** Só leitura: lê o texto colado (CSV ou OFX) e devolve os candidatos já
 * marcados (duplicata/transferência/ambiguidade) para a tela de revisão.
 * `colunas` (CSV): { colunaData, colunaDescricao, colunaValor, temCabecalho }. */
export async function analisarTexto(texto, { formato, contaId, colunas } = {}) {
  const brutos = formato === "ofx" ? parseOFX(texto) : parseCSV(texto, colunas || {});
  const [listaTransacoes, listaCategorias] = await Promise.all([transacoes.listar(), categorias.listar()]);
  const transacoesExistentes = comId(listaTransacoes);
  return prepararCandidatos(brutos, { transacoesExistentes, categorias: comId(listaCategorias), contaId });
}

/**
 * Grava o lote (texto bruto + metadados — nunca editado depois) e comita
 * os candidatos aceitos. `aceitos`: [{ candidato, categoriaId?, pessoaId?,
 * confirmarComoTransferencia? }] — só o que passou pela revisão do
 * usuário. Todo lançamento nasce com `origem: "importado"` e
 * `revisado: false` (campos que já existiam desde a Fase 1, sem uso até
 * agora) — a distinção do §18 entre "veio automático" e "foi conferido".
 */
export async function confirmarImportacao({ texto, formato, contaId, aceitos }) {
  const loteId = await db.criar(CAMINHO_LOTES, {
    formato, contaId, texto, quantidadeCandidatos: aceitos.length, criadoEm: agora(),
  });
  const origem = formato === "ofx" ? "ofx" : "planilha";

  const criadas = [];
  for (const item of aceitos) {
    const c = item.candidato;
    if (c.possivelTransferencia && item.confirmarComoTransferencia) {
      const saiDaqui = c.valorCentavos < 0;
      const id = await criarTransferencia({
        contaOrigemId: saiDaqui ? contaId : c.transferenciaCom.contaId,
        contaDestinoId: saiDaqui ? c.transferenciaCom.contaId : contaId,
        valorCentavos: Math.abs(c.valorCentavos),
        data: c.data,
        descricao: c.descricao,
        origem, origemId: loteId,
      });
      criadas.push(id);
      continue;
    }
    const id = await criarSimples({
      tipo: c.tipo, contaId, valorCentavos: Math.abs(c.valorCentavos), data: c.data,
      categoriaId: item.categoriaId || c.categoriaSugeridaId || "",
      pessoaId: item.pessoaId || "",
      descricao: c.descricao,
      status: "pago", certeza: "confirmado",
      origem, origemId: c.externoId || loteId,
      revisado: false,
    });
    criadas.push(id);
  }
  return { loteId, criadas };
}

export async function listarLotes() {
  const lista = await db.listar(CAMINHO_LOTES);
  return comId(lista).sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
}

/** Assina a lista de lotes já importados — histórico só de leitura, nunca
 * editado depois de criado. */
export function assinarLotes(cb) {
  let cancelada = false;
  async function recalcular() {
    if (cancelada) return;
    const lista = await listarLotes();
    if (cancelada) return;
    cb(lista);
  }
  const parar = db.assinar(CAMINHO_LOTES, recalcular);
  return () => { cancelada = true; parar(); };
}

/** Marca um lançamento importado como conferido pelo usuário. */
export async function marcarRevisado(transacaoId) {
  return transacoes.atualizar(transacaoId, { revisado: true });
}
