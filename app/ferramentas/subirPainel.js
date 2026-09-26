// Subir dados no painel a partir do chat. O Claude interpreta a mensagem do
// usuário e escreve um "pedido" (lista de itens com nomes, não ids); este
// módulo resolve os nomes contra o estado real do banco e monta os
// documentos com os MESMOS padrões, validações e regras do app
// (src/domain/). O resultado é uma lista de escritas para o ArtifactData.
//
// Puro: não lê arquivo nem banco. `agora` e `gerarId` vêm de quem chama.
// Uso pelo chat: ver .claude/skills/subir-painel/SKILL.md.

import { paraCentavos, formatarBRL } from "../src/domain/dinheiro.js";
import { somarMeses, dataDeCompetencia, formatarData } from "../src/domain/tempo.js";
import { competenciaFatura, gerarParcelas, construirParTransferencia, competenciasFaltantes } from "../src/domain/transacoes.js";
import * as E from "../src/domain/esquema.js";

const HORIZONTE_RECORRENCIA_MESES = 3; // mesmo de dados/recorrenciasRepo.js
const JANELA_DUPLICATA_DIAS = 1; // mesmo de domain/importacao.js
export const COLECAO_LOTES = "lotesImportacao";

export const COLECOES = {
  pessoas: { padrao: E.padraoPessoa, validar: E.validarPessoa, nomes: ["nome"] },
  contas: { padrao: E.padraoConta, validar: E.validarConta, nomes: ["nome", "instituicao"] },
  cartoes: { padrao: E.padraoCartao, validar: E.validarCartao, nomes: ["apelido"] },
  categorias: { padrao: E.padraoCategoria, validar: E.validarCategoria, nomes: ["nome"] },
  fontesRenda: { padrao: E.padraoFonteRenda, validar: E.validarFonteRenda, nomes: ["nome"] },
  dividas: { padrao: E.padraoDivida, validar: E.validarDivida, nomes: ["nome", "credor"] },
  ativos: { padrao: E.padraoAtivo, validar: E.validarAtivo, nomes: ["nome"] },
  objetivos: { padrao: E.padraoObjetivo, validar: E.validarObjetivo, nomes: ["nome"] },
  recorrencias: { padrao: E.padraoRecorrencia, validar: E.validarRecorrencia, nomes: ["descricao"] },
};

export const COLECOES_LIDAS = [...Object.keys(COLECOES), "faturas", "transacoes", COLECAO_LOTES];

// Campo de id que cada referência por nome preenche, por coleção.
const CAMPO_REF = {
  pessoa: () => ["pessoas", "pessoaId"],
  categoria: () => ["categorias", "categoriaId"],
  cartao: () => ["cartoes", "cartaoId"],
  fonteRenda: () => ["fontesRenda", "fonteRendaId"],
  conta: (colecao) => ["contas", colecao === "cartoes" ? "contaPagamentoId" : colecao === "objetivos" ? "contaVinculadaId" : "contaId"],
};

export function normalizar(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function diasEntre(a, b) {
  return Math.round(Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
}

function competenciaDe(dataISO) {
  return dataISO.slice(0, 7);
}

class Pendencia extends Error {}

function exigir(condicao, motivo) {
  if (!condicao) throw new Pendencia(motivo);
}

function centavos(valor, rotulo = "valor") {
  const c = Math.abs(paraCentavos(valor));
  exigir(Number.isInteger(c) && c > 0, `${rotulo} ausente ou inválido`);
  return c;
}

function rotuloDoc(colecao, doc) {
  const campo = (COLECOES[colecao] || { nomes: ["nome"] }).nomes[0];
  return doc[campo] || doc.id;
}

/** Acha um documento por id ou por nome (sem acento/caixa). Exato primeiro;
 * depois "contém" e primeiro nome — mas só aceita se sobrar UM. */
export function resolver(estado, colecao, ref) {
  exigir(ref != null && String(ref).trim() !== "", `faltou dizer qual ${colecao}`);
  const lista = estado[colecao] || [];
  const porId = lista.find((d) => d.id === ref);
  if (porId) return porId;
  const alvo = normalizar(ref);
  const campos = (COLECOES[colecao] || { nomes: ["nome"] }).nomes;
  const valores = (d) => campos.map((c) => normalizar(d[c])).filter(Boolean);
  const exatos = lista.filter((d) => valores(d).includes(alvo));
  if (exatos.length === 1) return exatos[0];
  exigir(exatos.length < 2, `"${ref}" bate com mais de um em ${colecao}`);
  const parciais = lista.filter((d) => valores(d).some((v) => v.includes(alvo) || v.split(" ")[0] === alvo));
  if (parciais.length === 1) return parciais[0];
  const opcoes = lista.map((d) => rotuloDoc(colecao, d)).join(", ") || "nenhum cadastrado";
  throw new Pendencia(parciais.length > 1
    ? `"${ref}" é ambíguo em ${colecao} (${parciais.map((d) => rotuloDoc(colecao, d)).join(", ")})`
    : `"${ref}" não existe em ${colecao} (existem: ${opcoes})`);
}

function pessoaPadrao(estado) {
  const titulares = (estado.pessoas || []).filter((p) => p.papel === "titular" && p.ativo !== false);
  exigir(titulares.length === 1, "faltou dizer de qual pessoa é");
  return titulares[0].id;
}

/** Troca referências por nome (`pessoa`, `conta`, ...) pelo campo de id, e
 * valores em reais (`saldoOriginal`) pelo campo em centavos do esquema. */
function traduzirCampos(estado, colecao, campos, modelo) {
  const saida = {};
  for (const [chave, valor] of Object.entries(campos || {})) {
    if (CAMPO_REF[chave]) {
      const [colRef, campoId] = CAMPO_REF[chave](colecao);
      saida[campoId] = valor == null || valor === "" ? null : resolver(estado, colRef, valor).id;
    } else if (!(chave in modelo) && `${chave}Centavos` in modelo) {
      saida[`${chave}Centavos`] = valor == null ? 0 : Math.abs(paraCentavos(valor));
    } else {
      saida[chave] = valor;
    }
  }
  return saida;
}

function validarData(data, hoje) {
  const d = data || hoje;
  exigir(/^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)), `data inválida: ${data}`);
  return d;
}

export function montarEscritas({ estado: estadoOriginal, pedido, agora, gerarId }) {
  exigir(pedido && Array.isArray(pedido.itens), "pedido sem itens");
  const hoje = pedido.hoje || agora.slice(0, 10);
  const estado = Object.fromEntries(COLECOES_LIDAS.map((c) => [c, [...(estadoOriginal[c] || [])]]));
  const loteId = gerarId();
  const escritas = [];
  const resumo = [];
  const pendencias = [];
  const alteracoes = [];
  let quantidade = 0;

  pedido.itens.forEach((item, indice) => {
    // Cada item é tudo-ou-nada: acumula aqui e só aplica se não houver pendência.
    const local = { escritas: [], resumo: [], alteracoes: [], criados: [], quantidade: 0 };

    const criar = (colecao, dados, { revisado } = {}) => {
      const id = gerarId();
      const doc = { ...dados, origem: "chat", origemId: loteId, criadoEm: agora, atualizadoEm: agora };
      if (colecao === "transacoes") doc.revisado = revisado ?? false;
      if (colecao === "faturas") { delete doc.criadoEm; delete doc.atualizadoEm; }
      local.escritas.push({ op: "set", collection: colecao, doc_id: id, data: doc });
      local.criados.push([colecao, { id, ...doc }]);
      estado[colecao].push({ id, ...doc });
      return id;
    };

    const atualizar = (colecao, doc, campos) => {
      const antes = {};
      for (const k of Object.keys(campos)) antes[k] = k in doc ? doc[k] : null;
      local.escritas.push({ op: "update", collection: colecao, doc_id: doc.id, data: { ...campos, atualizadoEm: agora } });
      local.alteracoes.push({ colecao, id: doc.id, antes });
      Object.assign(doc, campos);
    };

    const faturaDe = (cartao, competencia) => {
      const existente = estado.faturas.find((f) => f.cartaoId === cartao.id && f.competencia === competencia);
      if (existente) return existente.id;
      return criar("faturas", E.padraoFatura({ cartaoId: cartao.id, competencia }));
    };

    const transacao = (dados, opcoes) => {
      const t = E.padraoTransacao({ ...dados, competencia: dados.competencia || competenciaDe(dados.data), origem: "chat", origemId: loteId });
      const erros = E.validarTransacao(t);
      exigir(!erros.length, erros.join(" "));
      local.quantidade += 1;
      return criar("transacoes", t, opcoes);
    };

    const duplicataDe = (filtro, valor, data) => (estadoOriginal.transacoes || []).find((t) =>
      filtro(t) && t.valorCentavos === valor && diasEntre(t.data, data) <= JANELA_DUPLICATA_DIAS);

    const avisarDuplicata = (existente) => {
      exigir(!existente || item.forcar,
        `parece repetido: já existe "${existente?.descricao}" de ${formatarBRL(existente?.valorCentavos || 0)} em ${formatarData(existente?.data || "")} (mande de novo com "forcar" se for outro)`);
    };

    try {
      const acao = item.acao;
      if (acao === "despesa" || acao === "receita") {
        const data = validarData(item.data, hoje);
        const valor = centavos(item.valor);
        const conta = item.conta ? resolver(estado, "contas", item.conta) : null;
        const cartao = item.cartao ? resolver(estado, "cartoes", item.cartao) : null;
        exigir(conta || cartao, "faltou dizer a conta ou o cartão");
        exigir(!(acao === "receita" && cartao), "receita entra numa conta, não num cartão");
        const categoria = resolver(estado, "categorias", item.categoria);
        exigir(categoria.natureza === acao, `a categoria "${categoria.nome}" é de ${categoria.natureza}, não de ${acao}`);
        avisarDuplicata(duplicataDe((t) => t.tipo === acao && (cartao ? t.cartaoId === cartao.id : t.contaId === conta.id), valor, data));
        const dados = {
          tipo: acao, valorCentavos: valor, data,
          contaId: cartao ? null : conta.id, cartaoId: cartao ? cartao.id : null,
          categoriaId: categoria.id,
          pessoaId: item.pessoa ? resolver(estado, "pessoas", item.pessoa).id : pessoaPadrao(estado),
          descricao: item.descricao || categoria.nome,
          status: item.status || "pago", certeza: item.certeza || "confirmado",
          fonteRendaId: acao === "receita" && item.fonteRenda ? resolver(estado, "fontesRenda", item.fonteRenda).id : null,
        };
        if (cartao) dados.faturaId = faturaDe(cartao, competenciaFatura(cartao, data));
        transacao(dados);
        local.resumo.push(`${acao === "despesa" ? "Despesa" : "Receita"} · ${formatarBRL(valor)} · ${dados.descricao} · ${(cartao ? cartao.apelido : conta.nome)} · ${categoria.nome} · ${formatarData(data)}${dados.status !== "pago" ? ` · ${dados.status}` : ""}${dados.certeza !== "confirmado" ? ` · ${dados.certeza}` : ""}`);
      } else if (acao === "transferencia") {
        const data = validarData(item.data, hoje);
        const valor = centavos(item.valor);
        const de = resolver(estado, "contas", item.de);
        const para = resolver(estado, "contas", item.para);
        exigir(de.id !== para.id, "origem e destino são a mesma conta");
        avisarDuplicata(duplicataDe((t) => t.tipo === "transferencia" && t.direcao === "saida" && t.contaId === de.id, valor, data));
        const transferenciaId = `tr_${gerarId()}`;
        for (const perna of construirParTransferencia({ contaOrigemId: de.id, contaDestinoId: para.id, valorCentavos: valor, data, competencia: competenciaDe(data), descricao: item.descricao, transferenciaId })) {
          transacao(perna);
        }
        local.quantidade -= 1; // as duas pernas são um lançamento só para o usuário
        local.resumo.push(`Transferência · ${formatarBRL(valor)} · ${de.nome} → ${para.nome} · ${formatarData(data)} (não conta como receita nem despesa)`);
      } else if (acao === "parcelamento") {
        const data = validarData(item.data, hoje);
        const total = centavos(item.valorTotal, "valor total");
        const quantidadeParcelas = Number(item.parcelas);
        exigir(Number.isInteger(quantidadeParcelas) && quantidadeParcelas >= 2, "parcelamento precisa de 2 ou mais parcelas");
        const cartao = item.cartao ? resolver(estado, "cartoes", item.cartao) : null;
        const conta = !cartao && item.conta ? resolver(estado, "contas", item.conta) : null;
        exigir(cartao || conta, "faltou dizer a conta ou o cartão");
        const categoria = resolver(estado, "categorias", item.categoria);
        const parcelaDeId = `pc_${gerarId()}`;
        const comuns = {
          tipo: "despesa", cartaoId: cartao ? cartao.id : null, contaId: cartao ? null : conta.id, categoriaId: categoria.id,
          pessoaId: item.pessoa ? resolver(estado, "pessoas", item.pessoa).id : pessoaPadrao(estado),
          descricao: item.descricao || categoria.nome, data, status: "previsto", certeza: "provavel",
        };
        const partes = gerarParcelas({ valorTotalCentavos: total, quantidade: quantidadeParcelas, competenciaInicial: competenciaDe(data), parcelaDeId, camposComuns: comuns });
        avisarDuplicata(duplicataDe((t) => t.parcelaNum === 1 && (cartao ? t.cartaoId === cartao.id : t.contaId === conta.id), partes[0].valorCentavos, data));
        const competenciaFaturaInicial = cartao ? competenciaFatura(cartao, data) : null;
        for (const parte of partes) {
          const dados = { ...parte };
          if (cartao) dados.faturaId = faturaDe(cartao, somarMeses(competenciaFaturaInicial, parte.parcelaNum - 1));
          if (parte.parcelaNum === 1) { dados.status = "pago"; dados.certeza = "confirmado"; }
          transacao(dados);
        }
        local.quantidade -= quantidadeParcelas - 1;
        local.resumo.push(`Parcelado · ${formatarBRL(total)} em ${quantidadeParcelas}x de ~${formatarBRL(partes[0].valorCentavos)} · ${comuns.descricao} · ${cartao ? cartao.apelido : conta.nome} · ${categoria.nome} · 1ª em ${formatarData(data)}`);
      } else if (acao === "pagamento_fatura") {
        const data = validarData(item.data, hoje);
        const valor = centavos(item.valor);
        const cartao = resolver(estado, "cartoes", item.cartao);
        const conta = resolver(estado, "contas", item.conta || cartao.contaPagamentoId);
        const abertas = estado.faturas.filter((f) => f.cartaoId === cartao.id && f.status !== "paga");
        const fatura = item.competencia
          ? abertas.find((f) => f.competencia === item.competencia)
          : abertas.filter((f) => f.competencia <= competenciaDe(data)).sort((a, b) => b.competencia.localeCompare(a.competencia))[0];
        exigir(fatura, `não achei fatura em aberto do ${cartao.apelido}${item.competencia ? ` em ${item.competencia}` : ""}`);
        avisarDuplicata(duplicataDe((t) => t.tipo === "pagamento_fatura" && t.faturaId === fatura.id, valor, data));
        transacao({ tipo: "pagamento_fatura", contaId: conta.id, faturaId: fatura.id, valorCentavos: valor, data, descricao: item.descricao || "Pagamento de fatura", categoriaId: null });
        atualizar("faturas", fatura, { status: "paga" });
        local.resumo.push(`Pagamento de fatura · ${formatarBRL(valor)} · ${cartao.apelido} (${fatura.competencia}) · saiu da ${conta.nome} · ${formatarData(data)} (não é despesa nova: as compras já contaram)`);
      } else if (acao === "criar") {
        const colecao = item.colecao;
        const def = COLECOES[colecao];
        exigir(def, `não sei criar "${colecao}"`);
        const modelo = def.padrao({});
        const campos = traduzirCampos(estado, colecao, item.dados, modelo);
        if ("pessoaId" in modelo && !campos.pessoaId && colecao !== "pessoas") campos.pessoaId = pessoaPadrao(estado);
        const dados = def.padrao(campos);
        const erros = def.validar(dados);
        exigir(!erros.length, erros.join(" "));
        const nome = normalizar(dados[def.nomes[0]]);
        const existente = estado[colecao].find((d) => normalizar(d[def.nomes[0]]) === nome);
        exigir(!existente || item.forcar, `já existe "${rotuloDoc(colecao, existente || {})}" em ${colecao} (use atualizar)`);
        const id = criar(colecao, dados);
        local.quantidade += 1;
        local.resumo.push(`Novo em ${colecao} · ${rotuloDoc(colecao, dados)}${descreverValores(dados)}`);
        if (colecao === "recorrencias" && dados.ativa) {
          const faltantes = competenciasFaltantes(dados, { competenciaAtual: competenciaDe(hoje), horizonteMeses: HORIZONTE_RECORRENCIA_MESES, competenciasExistentes: [] });
          const cartao = dados.cartaoId ? estado.cartoes.find((c) => c.id === dados.cartaoId) : null;
          for (const competencia of faltantes) {
            const data = dataDeCompetencia(competencia, dados.diaBase);
            const t = {
              tipo: dados.tipo, valorCentavos: dados.valorEstimadoCentavos, data, competencia,
              contaId: dados.contaId, cartaoId: dados.cartaoId, categoriaId: dados.categoriaId, pessoaId: dados.pessoaId,
              descricao: dados.descricao, status: "previsto", certeza: "provavel", recorrenciaId: id,
            };
            if (cartao && dados.tipo === "despesa") t.faturaId = faturaDe(cartao, competenciaFatura(cartao, data));
            transacao(t, { revisado: true });
            local.quantidade -= 1;
          }
          if (faltantes.length) local.resumo.push(`  previstos gerados: ${faltantes.join(", ")}`);
        }
      } else if (acao === "atualizar") {
        const colecao = item.colecao;
        const def = COLECOES[colecao];
        exigir(def, `não sei atualizar "${colecao}"`);
        const doc = resolver(estado, colecao, item.ref);
        const campos = traduzirCampos(estado, colecao, item.campos, def.padrao({}));
        exigir(Object.keys(campos).length, "nada para mudar");
        const { id: _id, ...atual } = doc;
        const erros = def.validar(def.padrao({ ...atual, ...campos }));
        exigir(!erros.length, erros.join(" "));
        atualizar(colecao, doc, campos);
        local.quantidade += 1;
        local.resumo.push(`Atualizado em ${colecao} · ${rotuloDoc(colecao, doc)} · ${Object.keys(campos).join(", ")}`);
      } else if (acao === "pagar_parcela_divida") {
        const divida = resolver(estado, "dividas", item.divida);
        const q = item.quantidade == null ? 1 : Number(item.quantidade);
        exigir(Number.isInteger(q) && q >= 1, "quantidade de parcelas inválida");
        const novo = (Number(divida.parcelasPagas) || 0) + q;
        exigir(novo <= divida.quantidadeParcelas, `${divida.nome} tem ${divida.quantidadeParcelas} parcelas e já estão pagas ${divida.parcelasPagas}`);
        atualizar("dividas", divida, { parcelasPagas: novo });
        local.quantidade += 1;
        local.resumo.push(`Dívida · ${divida.nome} · parcelas pagas ${novo - q} → ${novo} de ${divida.quantidadeParcelas}`);
      } else {
        throw new Pendencia(`ação desconhecida: ${acao}`);
      }

      escritas.push(...local.escritas);
      resumo.push(...local.resumo);
      alteracoes.push(...local.alteracoes);
      quantidade += local.quantidade;
    } catch (erro) {
      if (!(erro instanceof Pendencia)) throw erro;
      for (const [colecao, doc] of local.criados) estado[colecao] = estado[colecao].filter((d) => d.id !== doc.id);
      for (const { colecao, id, antes } of local.alteracoes.reverse()) {
        const doc = estado[colecao].find((d) => d.id === id);
        for (const [k, v] of Object.entries(antes)) { if (v === null) delete doc[k]; else doc[k] = v; }
      }
      pendencias.push({ item: indice + 1, descricao: item.descricao || item.acao, motivo: erro.message });
    }
  });

  if (escritas.length) {
    escritas.unshift({
      op: "set", collection: COLECAO_LOTES, doc_id: loteId,
      data: { formato: "chat", contaId: null, texto: pedido.mensagemOriginal || "", quantidadeCandidatos: quantidade, alteracoes, criadoEm: agora },
    });
  }
  return { loteId: escritas.length ? loteId : null, escritas, resumo, pendencias };
}

function descreverValores(dados) {
  const partes = Object.entries(dados)
    .filter(([k, v]) => k.endsWith("Centavos") && v)
    .map(([k, v]) => `${k.replace(/Centavos$/, "")} ${formatarBRL(v)}`);
  return partes.length ? ` · ${partes.join(" · ")}` : "";
}

/** Desfaz um envio do chat: apaga tudo que nasceu dele e devolve os campos
 * que ele alterou ao valor de antes. Só lotes do chat. */
export function montarDesfazer({ estado, loteId }) {
  const lote = (estado[COLECAO_LOTES] || []).find((l) => l.id === loteId);
  if (!lote) throw new Error(`lote ${loteId} não encontrado`);
  if (lote.formato !== "chat") throw new Error("só desfaço envios do chat; importação de planilha se desfaz pela tela");
  const escritas = [];
  for (const colecao of COLECOES_LIDAS) {
    if (colecao === COLECAO_LOTES) continue;
    for (const doc of estado[colecao] || []) {
      if (doc.origem === "chat" && doc.origemId === loteId) escritas.push({ op: "delete", collection: colecao, doc_id: doc.id });
    }
  }
  const apagados = new Set(escritas.map((e) => `${e.collection}/${e.doc_id}`));
  for (const { colecao, id, antes } of [...(lote.alteracoes || [])].reverse()) {
    if (apagados.has(`${colecao}/${id}`)) continue;
    const data = Object.fromEntries(Object.entries(antes).map(([k, v]) => [k, v === null ? { __delete__: true } : v]));
    escritas.push({ op: "update", collection: colecao, doc_id: id, data });
  }
  escritas.push({ op: "delete", collection: COLECAO_LOTES, doc_id: loteId });
  return { escritas, resumo: [`Desfazendo o envio de ${formatarData((lote.criadoEm || "").slice(0, 10))}: ${escritas.length - 1} alteração(ões)`] };
}
