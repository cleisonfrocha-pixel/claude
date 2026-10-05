// Fila "Revisar" por favorecido (Fase 12, Sprint 4). Domínio puro: agrupa o que
// ainda não foi classificado pelo nome de quem recebeu ou pagou, para que UMA
// resposta ("é repasse", "é escritório") resolva todos os lançamentos do mesmo
// favorecido, hoje e nos próximos extratos (regra). Nada aqui grava.

const PREFIXOS = /^(servi[cç]o:\s*|pix no cr[eé]dito para\s*)/i;
const SUFIXOS = /\s*\((a classificar|a revisar|cliente cnpj)[^)]*\)\s*$/i;

/** Nome do favorecido sem enfeite do importador, sem acento e em minúsculas. */
export function chaveDoFavorecido(descricao) {
  let s = String(descricao || "").trim();
  s = s.replace(PREFIXOS, "").replace(SUFIXOS, "");
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  s = s.replace(/^(\d+\s+)+/, "").replace(/\s+/g, " ").trim();
  return s;
}

/** Despesa em "Outros" ou marcada pelo importador como "a classificar"/"a revisar". */
export function precisaRevisar(t, categoriaPorId) {
  if (t.tipo !== "despesa" && t.tipo !== "receita") return false;
  if (t.status !== "pago") return false; // previsto não é extrato: ainda não aconteceu
  if (/^compras at[eé] o fechamento/i.test(t.descricao || "")) return false; // marcador de fatura, não é favorecido
  if (/\((a classificar|a revisar)[^)]*\)\s*$/i.test(t.descricao || "")) return true;
  const cat = categoriaPorId.get(t.categoriaId);
  return t.tipo === "despesa" && cat?.nome === "Outros";
}

function nomeLegivel(descricao) {
  return String(descricao || "").replace(PREFIXOS, "").replace(SUFIXOS, "").replace(/^(\d+\s+)+/, "").trim() || "(sem nome)";
}

/**
 * Grupos pendentes, os de mais dinheiro primeiro. Cada grupo guarda os itens
 * (id, tipo, valor, data) para a tela mostrar exemplos e para aplicar a decisão.
 */
export function agruparFavorecidos(transacoes, categorias) {
  const porId = new Map((categorias || []).map((c) => [c.id, c]));
  const grupos = new Map();
  for (const t of transacoes || []) {
    if (!precisaRevisar(t, porId)) continue;
    const chave = chaveDoFavorecido(t.descricao);
    if (!chave) continue;
    if (!grupos.has(chave)) grupos.set(chave, { chave, nome: nomeLegivel(t.descricao), quantidade: 0, saiuCentavos: 0, entrouCentavos: 0, desde: t.data, ate: t.data, itens: [] });
    const g = grupos.get(chave);
    const v = Number(t.valorCentavos) || 0;
    g.quantidade += 1;
    if (t.tipo === "despesa") g.saiuCentavos += v; else g.entrouCentavos += v;
    if (t.data < g.desde) g.desde = t.data;
    if (t.data > g.ate) g.ate = t.data;
    g.itens.push({ id: t.id, tipo: t.tipo, valorCentavos: v, data: t.data });
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, itens: g.itens.sort((a, b) => b.data.localeCompare(a.data)) }))
    .sort((a, b) => (b.saiuCentavos + b.entrouCentavos) - (a.saiuCentavos + a.entrouCentavos));
}

/**
 * Campos a gravar num lançamento para uma decisão.
 *   { tipo: "categoria", categoriaId }  -> só troca a categoria (a natureza tem que bater)
 *   { tipo: "repasse" }                 -> vira repasse: mexe no saldo, não é renda nem gasto
 * Devolve null quando a decisão não serve para esse lançamento.
 */
export function camposDaDecisao(t, decisao, categoriaPorId) {
  if (decisao.tipo === "repasse") {
    if (t.tipo !== "despesa" && t.tipo !== "receita") return null;
    return { tipo: "repasse", direcao: t.tipo === "receita" ? "entrada" : "saida", categoriaId: "", revisado: true };
  }
  if (decisao.tipo === "categoria") {
    const cat = categoriaPorId.get(decisao.categoriaId);
    if (!cat || cat.natureza !== t.tipo) return null;
    const campos = { categoriaId: cat.id, revisado: true };
    if (/\((a classificar|a revisar)[^)]*\)\s*$/i.test(t.descricao || "")) campos.descricao = nomeLegivel(t.descricao);
    return campos;
  }
  return null;
}

/** A regra (se houver) que vale para essa descrição: o nome da regra aparece na chave do favorecido. */
export function regraDoFavorecido(regras, descricao) {
  const chave = chaveDoFavorecido(descricao);
  if (!chave) return null;
  return (regras || []).filter((r) => r.ativa !== false && r.chave && chave.includes(r.chave))
    .sort((a, b) => b.chave.length - a.chave.length)[0] || null;
}

/** Para uma lista de lançamentos pendentes, o que as regras já resolvem: [{ id, campos, regraId }]. */
export function aplicarRegras(transacoes, regras, categorias) {
  const porId = new Map((categorias || []).map((c) => [c.id, c]));
  const saida = [];
  for (const t of transacoes || []) {
    if (!precisaRevisar(t, porId)) continue;
    const regra = regraDoFavorecido(regras, t.descricao);
    if (!regra) continue;
    const campos = camposDaDecisao(t, regra.decisao, porId);
    if (campos) saida.push({ id: t.id, campos, regraId: regra.id || null });
  }
  return saida;
}
