// Busca, filtros, exportação e atividade recente (§27). Puro (CLAUDE.md).

const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Filtra transações. Cada critério vazio é ignorado. `texto` procura na
 * descrição, no valor ("150" casa 150,00) e na data. */
export function filtrarTransacoes(lista, f = {}) {
  const termo = semAcento(f.texto).trim();
  const termoNumero = termo.replace(/\./g, "").replace(",", ".");
  return (lista || []).filter((t) => {
    if (f.pessoaId && t.pessoaId !== f.pessoaId) return false;
    if (f.contaId && t.contaId !== f.contaId) return false;
    if (f.cartaoId && t.cartaoId !== f.cartaoId) return false;
    if (f.categoriaId && t.categoriaId !== f.categoriaId) return false;
    if (f.tipo && t.tipo !== f.tipo) return false;
    if (f.status && t.status !== f.status) return false;
    if (f.de && (t.data || "") < f.de) return false;
    if (f.ate && (t.data || "") > f.ate) return false;
    if (termo) {
      const reais = ((Number(t.valorCentavos) || 0) / 100).toFixed(2);
      const alvo = `${semAcento(t.descricao)} ${t.data || ""} ${reais}`;
      if (!alvo.includes(termo) && !(termoNumero && /^\d+(\.\d+)?$/.test(termoNumero) && reais.startsWith(termoNumero))) return false;
    }
    return true;
  });
}

export function haFiltroAtivo(f = {}) {
  return Object.values(f).some((v) => v !== "" && v != null);
}

/** Busca em tudo: devolve grupos { tipo, rotulo, itens:[{id, titulo, sub, destino}] }. */
export function buscaGlobal(base, texto, { limitePorGrupo = 6 } = {}) {
  const termo = semAcento(texto).trim();
  if (termo.length < 2) return [];
  const bate = (...campos) => campos.some((c) => semAcento(c).includes(termo));
  const grupos = [];
  const add = (tipo, rotulo, itens) => { if (itens.length) grupos.push({ tipo, rotulo, total: itens.length, itens: itens.slice(0, limitePorGrupo) }); };

  add("transacao", "Transações", (base.transacoes || []).filter((t) => bate(t.descricao, t.data)).sort((a, b) => (b.data || "").localeCompare(a.data || ""))
    .map((t) => ({ id: t.id, titulo: t.descricao || t.tipo, sub: t.data, valorCentavos: t.valorCentavos, destino: { modulo: "dinheiro", aba: "transacoes" } })));
  add("divida", "Dívidas", (base.dividas || []).filter((d) => bate(d.nome, d.credor)).map((d) => ({ id: d.id, titulo: d.nome, sub: d.credor, destino: { modulo: "dividas" } })));
  add("recorrencia", "Recorrências", (base.recorrencias || []).filter((r) => bate(r.descricao)).map((r) => ({ id: r.id, titulo: r.descricao, valorCentavos: r.valorEstimadoCentavos, destino: { modulo: "dinheiro", aba: "recorrencias" } })));
  add("fonte", "Fontes de renda", (base.fontesRenda || []).filter((f) => bate(f.nome)).map((f) => ({ id: f.id, titulo: f.nome, valorCentavos: f.valorEsperadoCentavos, destino: { modulo: "dinheiro", aba: "renda" } })));
  add("ativo", "Bens", (base.ativos || []).filter((a) => bate(a.nome)).map((a) => ({ id: a.id, titulo: a.nome, valorCentavos: a.valorAtualCentavos, destino: { modulo: "plano", aba: "patrimonio" } })));
  add("cartao", "Cartões", (base.cartoes || []).filter((c) => bate(c.apelido)).map((c) => ({ id: c.id, titulo: c.apelido, destino: { modulo: "dinheiro", aba: "cartoes" } })));
  add("conta", "Contas", (base.contas || []).filter((c) => bate(c.nome, c.instituicao)).map((c) => ({ id: c.id, titulo: c.nome, sub: c.instituicao, destino: { modulo: "dinheiro", aba: "contas" } })));
  return grupos;
}

function celulaCSV(v) {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV (separador ;) das transações, valor em reais com vírgula. */
export function transacoesParaCSV(transacoes, { contas = [], cartoes = [], categorias = [], pessoas = [] } = {}) {
  const nome = (lista, id, campo = "nome") => (lista.find((x) => x.id === id) || {})[campo] || "";
  const linhas = [["data", "tipo", "descricao", "valor", "status", "certeza", "conta", "cartao", "categoria", "pessoa", "competencia"].join(";")];
  for (const t of [...(transacoes || [])].sort((a, b) => (a.data || "").localeCompare(b.data || ""))) {
    linhas.push([
      t.data, t.tipo, t.descricao, ((Number(t.valorCentavos) || 0) / 100).toFixed(2).replace(".", ","), t.status, t.certeza,
      nome(contas, t.contaId), nome(cartoes, t.cartaoId, "apelido"), nome(categorias, t.categoriaId), nome(pessoas, t.pessoaId), t.competencia,
    ].map(celulaCSV).join(";"));
  }
  return linhas.join("\n");
}

/** Cópia completa dos dados do usuário, com versão do formato. */
export function montarExportacao(colecoes, geradoEm) {
  return JSON.stringify({ formato: "painel-financeiro", versao: 1, geradoEm, colecoes }, null, 2);
}

/** Atividade recente: o que foi criado ou alterado por último, em qualquer
 * coleção. Derivada de criadoEm/atualizadoEm; não grava nada. */
export function atividadeRecente(colecoes, { limite = 30 } = {}) {
  const itens = [];
  for (const [colecao, lista] of Object.entries(colecoes || {})) {
    for (const x of lista || []) {
      const quando = x.atualizadoEm || x.criadoEm;
      if (!quando) continue;
      const novo = !x.atualizadoEm || x.atualizadoEm === x.criadoEm;
      itens.push({ colecao, id: x.id, quando, acao: novo ? "criado" : "alterado", titulo: x.descricao || x.nome || x.apelido || colecao });
    }
  }
  return itens.sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, limite);
}
