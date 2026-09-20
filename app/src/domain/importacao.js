// Domínio puro: importação e reconciliação (§18). A entrada manual (Fase 1)
// já é uma forma de trazer dado pra dentro — este arquivo cobre as outras
// duas do §18 que cabem num artefato sem infraestrutura externa: planilha
// (CSV) e formato financeiro (OFX). Ver docs/ARQUITETURA.md, D4
// (`ConectorDeDados`) — Open Finance (Fase 12) entra depois como mais um
// adaptador atrás da mesma forma de candidato: `{ data, descricao,
// valorCentavos, tipo, externoId? }`.

import { paraCentavos } from "./dinheiro.js";

const JANELA_TRANSFERENCIA_DIAS = 3;
const JANELA_DUPLICATA_DIAS = 1;

// ---------- CSV ----------

/** Divide uma linha de CSV respeitando campos entre aspas (que podem
 * conter o próprio delimitador) — um split ingênuo por vírgula quebraria
 * em "Mercado, Supermercado Ltda". */
export function dividirLinhaCSV(linha, delimitador) {
  const campos = [];
  let atual = "";
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') { atual += '"'; i++; }
      else dentroDeAspas = !dentroDeAspas;
    } else if (c === delimitador && !dentroDeAspas) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

/** `;` é o delimitador mais comum em exportação de banco brasileiro; `,`
 * é o padrão internacional — decide pelo que aparece mais na 1ª linha. */
export function detectarDelimitadorCSV(texto) {
  const primeiraLinha = (texto || "").split(/\r?\n/).find((l) => l.trim()) || "";
  const pontoVirgula = (primeiraLinha.match(/;/g) || []).length;
  const virgula = (primeiraLinha.match(/,/g) || []).length;
  return pontoVirgula >= virgula ? ";" : ",";
}

/** Normaliza uma data de planilha ("15/03/2026", "2026-03-15") pra
 * "YYYY-MM-DD" — nunca lança: uma data ilegível vira `null`, pra a linha
 * entrar como candidato ambíguo em vez de derrubar a importação inteira. */
function normalizarData(texto) {
  const s = (texto || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const [, d, mes, ano] = m;
    const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
    return `${anoCompleto}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/**
 * CSV genérico: a ordem das colunas varia de banco pra banco, então quem
 * chama informa qual coluna é qual (índice, base 0) — sem tentar adivinhar
 * nomes de cabeçalho, que também variam demais pra confiar.
 */
export function parseCSV(texto, { colunaData = 0, colunaDescricao = 1, colunaValor = 2, temCabecalho = false } = {}) {
  const delimitador = detectarDelimitadorCSV(texto);
  const linhas = (texto || "").split(/\r?\n/).filter((l) => l.trim());
  const linhasDados = temCabecalho ? linhas.slice(1) : linhas;

  return linhasDados.map((linha, i) => {
    const campos = dividirLinhaCSV(linha, delimitador);
    const dataOriginal = campos[colunaData] || "";
    const descricao = campos[colunaDescricao] || "";
    const valorTexto = campos[colunaValor] || "";
    const valorCentavos = paraCentavos(valorTexto);
    const data = normalizarData(dataOriginal);
    return {
      linha: i + 1, linhaOriginal: linha,
      data, descricao, valorCentavos,
      tipo: valorCentavos < 0 ? "despesa" : "receita",
      externoId: null,
      valido: !!data && !!descricao && valorCentavos !== 0,
    };
  });
}

// ---------- OFX ----------

function valorDaTag(bloco, tag) {
  const m = bloco.match(new RegExp(`<${tag}>([^\r\n<]*)`, "i"));
  return m ? m[1].trim() : "";
}

/**
 * OFX 1.x (SGML, não XML estrito — bancos não fecham toda tag) é lido por
 * regex, não por um parser de XML: pegar cada bloco `<STMTTRN>...</STMTTRN>`
 * e extrair os campos de dentro é suficiente e não depende de `DOMParser`
 * (que nem existe no motor puro — CLAUDE.md, D3).
 */
export function parseOFX(texto) {
  const blocos = (texto || "").match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || [];
  return blocos.map((bloco, i) => {
    const dtposted = valorDaTag(bloco, "DTPOSTED");
    const data = dtposted.length >= 8
      ? `${dtposted.slice(0, 4)}-${dtposted.slice(4, 6)}-${dtposted.slice(6, 8)}`
      : null;
    const trnamt = valorDaTag(bloco, "TRNAMT");
    const valorCentavos = paraCentavos(trnamt);
    const descricao = valorDaTag(bloco, "MEMO") || valorDaTag(bloco, "NAME") || "";
    const fitid = valorDaTag(bloco, "FITID") || null;
    return {
      linha: i + 1, linhaOriginal: bloco.trim(),
      data, descricao, valorCentavos,
      tipo: valorCentavos < 0 ? "despesa" : "receita",
      externoId: fitid,
      valido: !!data && valorCentavos !== 0,
    };
  });
}

// ---------- reconciliação ----------

function diferencaEmDias(dataA, dataB) {
  if (!dataA || !dataB) return Infinity;
  return Math.round(Math.abs(new Date(dataA) - new Date(dataB)) / 86400000);
}

/**
 * Marca cada candidato com a transação existente que ele provavelmente já
 * é — o FITID do OFX é prova quase certa (mesmo banco, mesmo id, nunca
 * muda); sem id externo (CSV), é mesma conta + mesmo valor + data muito
 * próxima. Não decide sozinho: só aponta, quem confirma é o usuário na
 * revisão (§18 — "revisão de lançamentos ambíguos").
 */
export function detectarDuplicatas(candidatos, transacoesExistentes, contaId) {
  const existentesDaConta = (transacoesExistentes || []).filter((t) => t.contaId === contaId);
  return candidatos.map((c) => {
    if (c.externoId) {
      const porId = existentesDaConta.find((t) => t.origemId === c.externoId);
      if (porId) return { ...c, possivelDuplicata: true, duplicataDe: porId.id, motivoDuplicata: "mesmo identificador do banco" };
    }
    const porSemelhanca = existentesDaConta.find((t) =>
      Math.abs(t.valorCentavos) === Math.abs(c.valorCentavos) && diferencaEmDias(t.data, c.data) <= JANELA_DUPLICATA_DIAS,
    );
    if (porSemelhanca) return { ...c, possivelDuplicata: true, duplicataDe: porSemelhanca.id, motivoDuplicata: "mesma data e valor de um lançamento existente" };
    return { ...c, possivelDuplicata: false, duplicataDe: null };
  });
}

/**
 * Reconhece transferência interna (§18, e a regra não-negociável do
 * CLAUDE.md: transferência entre contas próprias não é receita nem
 * despesa): um candidato de saída aqui que bate com uma entrada já
 * existente em OUTRA conta própria, valor igual, data próxima — provável
 * ida-e-volta da mesma movimentação, não duas coisas separadas.
 */
export function detectarTransferencias(candidatos, transacoesExistentes, contaId) {
  const emOutrasContas = (transacoesExistentes || []).filter((t) => t.contaId && t.contaId !== contaId && t.tipo !== "transferencia");
  return candidatos.map((c) => {
    if (c.possivelDuplicata) return c;
    const par = emOutrasContas.find((t) =>
      Math.abs(t.valorCentavos) === Math.abs(c.valorCentavos) &&
      Math.sign(t.valorCentavos) === -Math.sign(c.valorCentavos) &&
      diferencaEmDias(t.data, c.data) <= JANELA_TRANSFERENCIA_DIAS,
    );
    if (par) return { ...c, possivelTransferencia: true, transferenciaCom: { contaId: par.contaId, transacaoId: par.id } };
    return { ...c, possivelTransferencia: false, transferenciaCom: null };
  });
}

/** Sem categoria nenhuma cuja palavra apareça na descrição — não é erro,
 * é "precisa de uma escolha manual antes de confirmar" (§18 — "revisão de
 * lançamentos ambíguos"). */
export function classificarAmbiguidade(candidatos, categorias) {
  const cats = (categorias || []).filter((c) => c.ativa && c.natureza !== "transferencia");
  return candidatos.map((c) => {
    if (c.possivelDuplicata || c.possivelTransferencia) return { ...c, ambiguo: false, categoriaSugeridaId: null };
    const descricaoBaixa = (c.descricao || "").toLowerCase();
    const sugestao = cats.find((cat) => descricaoBaixa.includes(cat.nome.toLowerCase()));
    return { ...c, ambiguo: !sugestao, categoriaSugeridaId: sugestao ? sugestao.id : null };
  });
}

/** O pipeline inteiro: bruto -> candidato pronto pra revisão, com todas as
 * marcações que a tela de importação precisa mostrar. */
export function prepararCandidatos(candidatosBrutos, { transacoesExistentes, categorias, contaId }) {
  const comDuplicata = detectarDuplicatas(candidatosBrutos, transacoesExistentes, contaId);
  const comTransferencia = detectarTransferencias(comDuplicata, transacoesExistentes, contaId);
  return classificarAmbiguidade(comTransferencia, categorias);
}
