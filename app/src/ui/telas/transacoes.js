// Transações — o coração da Fase 1. Cinco formas de lançar algo: receita ou
// despesa simples, transferência entre contas próprias, compra parcelada,
// recorrência (compromisso mensal) e pagamento de fatura. As cinco passam
// pelas mesmas regras do domínio (dados/transacoesRepo.js e
// dados/recorrenciasRepo.js) — esta tela só coleta os campos certos para
// cada uma e mostra o resultado.

import * as tempo from "../../domain/tempo.js";
import { formatarBRL, paraCentavos } from "../../domain/dinheiro.js";
import { totalizarMes, statusEfetivo } from "../../domain/transacoes.js";
import { STATUS_TRANSACAO, CERTEZAS_TRANSACAO } from "../../domain/esquema.js";
import { escapeHtml, mostrarToast } from "../utilitarios.js";
import { abrir as abrirModal, fechar as fecharModal } from "../modal.js";
import {
  transacoes, criarSimples, criarTransferencia, criarParcelamento,
  registrarPagamentoFatura, ErroDeValidacao,
} from "../../dados/transacoesRepo.js";
import { marcarRevisado } from "../../dados/importacaoRepo.js";
import { pessoas, contas, cartoes, categorias, fontesRenda } from "../../dados/repositorios.js";
import { faturas } from "../../dados/faturasRepo.js";
import { recorrencias } from "../../dados/recorrenciasRepo.js";

const ROTULO_STATUS = { previsto: "Previsto", agendado: "Agendado", pago: "Pago", atrasado: "Atrasado", cancelado: "Cancelado" };
const ROTULO_CERTEZA = { confirmado: "Confirmado", provavel: "Provável", incerto: "Incerto" };
const ROTULO_TIPO_TAG = { receita: "Receita", despesa: "Despesa", transferencia: "Transferência", pagamento_fatura: "Pagamento de fatura" };

let mes = tempo.competenciaAtual();
let lista = [];
let contexto = { pessoas: [], contas: [], cartoes: [], categorias: [], faturas: [], fontesRenda: [] };
let pararAssinatura = null;
let container = null;

export default {
  async montar(alvo) {
    container = alvo;
    await carregarContexto();
    if (pararAssinatura) pararAssinatura();
    pararAssinatura = transacoes.assinar((novaLista) => { lista = novaLista; renderizar(); });
    renderizar();
  },
  desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    container = null;
  },
};

async function carregarContexto() {
  const [p, c, ca, cat, fa, fr] = await Promise.all([
    pessoas.listar(), contas.listar(), cartoes.listar(), categorias.listar(), faturas.listar(), fontesRenda.listar(),
  ]);
  contexto = { pessoas: p, contas: c, cartoes: ca, categorias: cat, faturas: fa, fontesRenda: fr };
}

function nomePessoa(id) { return (contexto.pessoas.find((p) => p.id === id) || {}).dados?.nome || "-"; }
function nomeConta(id) { return (contexto.contas.find((c) => c.id === id) || {}).dados?.nome || "-"; }
function nomeCartao(id) { return (contexto.cartoes.find((c) => c.id === id) || {}).dados?.apelido || "-"; }
function nomeCategoria(id) { return (contexto.categorias.find((c) => c.id === id) || {}).dados?.nome || "-"; }

function opcoes(lista2, valorFn, rotuloFn) {
  return lista2.map((i) => ({ valor: valorFn(i), rotulo: rotuloFn(i) }));
}

// ---------- render principal ----------

function renderizar() {
  if (!container) return;
  const doMes = lista.filter((t) => t.dados.competencia === mes);
  const totais = totalizarMes(lista.map((t) => t.dados), mes);

  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Transações</h2>
        <p class="tela-sub">Toda movimentação: receitas, despesas, transferências, parceladas e recorrências.</p>
      </div>
      <button class="btn btn-primary" id="btn-nova-transacao">+ Nova transação</button>
    </div>

    <div class="mes-nav">
      <button class="icon-btn" id="mes-prev" aria-label="Mês anterior">‹</button>
      <div class="mes-nav-label">${escapeHtml(tempo.competenciaLabel(mes))}</div>
      <button class="icon-btn" id="mes-next" aria-label="Próximo mês">›</button>
      ${mes !== tempo.competenciaAtual() ? '<button class="btn btn-ghost btn-sm" id="mes-hoje">Mês atual</button>' : ""}
    </div>

    <div class="resumo-mes">
      <div class="resumo-item"><span>Receitas</span><b class="mono valor-pos" data-valor>${formatarBRL(totais.receitas)}</b></div>
      <div class="resumo-item"><span>Despesas</span><b class="mono valor-neg" data-valor>${formatarBRL(totais.despesas)}</b></div>
      <div class="resumo-item"><span>Resultado</span><b class="mono ${totais.resultado < 0 ? "valor-neg" : "valor-pos"}" data-valor>${formatarBRL(totais.resultado)}</b></div>
    </div>

    <div class="lista-cartoes" id="lista-transacoes"></div>
  `;

  renderizarLista(doMes);

  container.querySelector("#btn-nova-transacao").addEventListener("click", abrirModalNovaTransacao);
  container.querySelector("#mes-prev").addEventListener("click", () => { mes = tempo.somarMeses(mes, -1); renderizar(); });
  container.querySelector("#mes-next").addEventListener("click", () => { mes = tempo.somarMeses(mes, 1); renderizar(); });
  const btnHoje = container.querySelector("#mes-hoje");
  if (btnHoje) btnHoje.addEventListener("click", () => { mes = tempo.competenciaAtual(); renderizar(); });
}

function renderizarLista(doMes) {
  const alvo = container.querySelector("#lista-transacoes");
  if (!alvo) return;
  if (!doMes.length) {
    alvo.innerHTML = `<div class="vazio">Nenhuma transação em ${escapeHtml(tempo.competenciaLabel(mes))}.
      <div><button class="btn btn-primary" id="vazio-nova">+ Nova transação</button></div></div>`;
    alvo.querySelector("#vazio-nova").addEventListener("click", abrirModalNovaTransacao);
    return;
  }
  const ordenada = doMes.slice().sort((a, b) => (b.dados.data || "").localeCompare(a.dados.data || ""));
  alvo.innerHTML = ordenada.map((t) => linhaTransacao(t)).join("");
  alvo.querySelectorAll("[data-apagar]").forEach((btn) => {
    btn.addEventListener("click", () => confirmarApagar(btn.getAttribute("data-apagar")));
  });
  alvo.querySelectorAll("[data-editar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = doMes.find((t) => t.id === btn.getAttribute("data-editar"));
      if (item) abrirModalEditarTransacao(item);
    });
  });
  alvo.querySelectorAll("[data-revisar]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await marcarRevisado(btn.getAttribute("data-revisar"));
      mostrarToast("Lançamento marcado como revisado.");
    });
  });
}

function linhaTransacao(item) {
  const d = item.dados;
  const destino = d.cartaoId ? nomeCartao(d.cartaoId) : (d.contaId ? nomeConta(d.contaId) : "");
  const parcelaTag = d.parcelaTotal ? `<span class="item-tag">${d.parcelaNum}/${d.parcelaTotal}</span>` : "";
  const classeValor = d.tipo === "receita" ? "valor-pos" : (d.tipo === "despesa" ? "valor-neg" : "");
  const sinal = d.tipo === "receita" ? "+" : (d.tipo === "despesa" ? "−" : "");
  // Transferência: a direção (de/para qual conta própria) precisa aparecer
  // na lista, senão parece só mais uma saída/entrada solta — não é.
  let subTransferencia = destino;
  if (d.tipo === "transferencia") {
    const par = lista.find((t) => t.id !== item.id && t.dados.transferenciaId === d.transferenciaId);
    const contraparte = par ? nomeConta(par.dados.contaId) : "-";
    subTransferencia = d.direcao === "saida" ? `${destino} → ${contraparte}` : `${contraparte} → ${destino}`;
  }
  const sub = [tempo.formatarData(d.data), subTransferencia, d.categoriaId ? nomeCategoria(d.categoriaId) : null].filter(Boolean).join(" · ");
  // §18: lançamento importado (origem !== "manual") e ainda não conferido
  // pelo usuário — distinção entre "veio automático" e "foi revisado".
  const naoRevisado = d.origem && d.origem !== "manual" && d.revisado === false;
  // Previsto/agendado cuja data já passou aparece como atrasado de
  // verdade, não fica "previsto" pra sempre — mesma leitura da Home.
  const statusMostrado = statusEfetivo(d, tempo.hojeISO());
  return `
    <div class="item-cartao">
      <div class="item-corpo">
        <div class="item-titulo">${escapeHtml(d.descricao || ROTULO_TIPO_TAG[d.tipo] || d.tipo)}</div>
        <div class="item-sub">${escapeHtml(sub)}</div>
      </div>
      <div class="item-valor mono ${classeValor}" data-valor>${sinal}${formatarBRL(d.valorCentavos)}</div>
      <span class="item-tag${d.status === "cancelado" ? " inativa" : ""}${statusMostrado === "atrasado" ? " critico" : ""}">${ROTULO_STATUS[statusMostrado] || statusMostrado}</span>
      ${parcelaTag}
      ${naoRevisado ? `<span class="item-tag atencao">não revisado</span>` : ""}
      <div class="item-acoes">
        ${naoRevisado ? `<button class="icon-btn" title="Marcar como revisado" aria-label="Marcar como revisado" data-revisar="${escapeHtml(item.id)}">✓</button>` : ""}
        <button class="icon-btn" title="Editar" aria-label="Editar" data-editar="${escapeHtml(item.id)}">✎</button>
        <button class="icon-btn danger" title="Apagar" aria-label="Apagar" data-apagar="${escapeHtml(item.id)}">✕</button>
      </div>
    </div>`;
}

async function confirmarApagar(id) {
  abrirModal(`
    <div class="modal">
      <h2>Apagar esta transação?</h2>
      <p class="tela-sub" style="margin-bottom:20px;">Se for uma perna de transferência, o par inteiro é apagado junto. Não pode ser desfeito.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
        <button class="btn btn-primary" style="background:var(--danger);" data-acao="confirmar">Apagar</button>
      </div>
    </div>`);
  document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
  document.querySelector('[data-acao="confirmar"]').addEventListener("click", async () => {
    await transacoes.apagar(id);
    fecharModal();
    mostrarToast("Transação apagada.");
  });
}

// ---------- modal: editar transação existente ----------

/** Receita/despesa simples, parcela individual ou ocorrência gerada por
 * recorrência — todas são o mesmo formato de documento, editáveis com o
 * mesmo formulário da criação, só que pré-preenchido e gravando com
 * `transacoes.atualizar` em vez de criar um novo lançamento. */
function abrirModalEditarTransacaoSimples(item) {
  const d = item.dados;
  const html = `
    <div class="modal">
      <h2>Editar transação</h2>
      <div id="erro-formulario"></div>
      <form id="form-editar-transacao" novalidate>
        <div class="field"><label>Tipo</label>
          <div class="radio-group">
            <label class="radio-opt"><input type="radio" name="e-tipo" value="despesa" ${d.tipo === "despesa" ? "checked" : ""}> Despesa</label>
            <label class="radio-opt"><input type="radio" name="e-tipo" value="receita" ${d.tipo === "receita" ? "checked" : ""}> Receita</label>
          </div>
        </div>
        ${campoOndeConta("e", true, d)}
        <div class="row2">
          <div class="field"><label for="e-valor">Valor</label><input type="text" inputmode="decimal" id="e-valor" placeholder="0,00" value="${formatarBRL(d.valorCentavos).replace("R$ ", "")}"></div>
          <div class="field"><label for="e-data">Data</label><input type="date" id="e-data" value="${escapeHtml(d.data || "")}"></div>
        </div>
        <div id="e-categoria-wrap">${campoCategoria("e", d.tipo, d.categoriaId)}</div>
        ${campoPessoa("e", d.pessoaId)}
        <div id="e-fonteRenda-wrap">${d.tipo === "receita" ? campoFonteRenda("e", d.fonteRendaId) : ""}</div>
        <div class="field"><label for="e-descricao">Descrição</label><input type="text" id="e-descricao" value="${escapeHtml(d.descricao || "")}"></div>
        <div class="row2">
          <div class="field"><label for="e-status">Status</label>
            <select id="e-status">${STATUS_TRANSACAO.map((s) => `<option value="${s}" ${s === d.status ? "selected" : ""}>${ROTULO_STATUS[s]}</option>`).join("")}</select></div>
          <div class="field"><label for="e-certeza">Certeza</label>
            <select id="e-certeza">${CERTEZAS_TRANSACAO.map((c) => `<option value="${c}" ${c === d.certeza ? "selected" : ""}>${ROTULO_CERTEZA[c]}</option>`).join("")}</select></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>`;
  abrirModal(html);
  document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
  ligarAlternanciaOnde("e");
  document.querySelectorAll('input[name="e-tipo"]').forEach((r) => {
    r.addEventListener("change", () => {
      document.getElementById("e-categoria-wrap").innerHTML = campoCategoria("e", r.value);
      document.getElementById("e-fonteRenda-wrap").innerHTML = r.value === "receita" ? campoFonteRenda("e") : "";
    });
  });
  document.getElementById("form-editar-transacao").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const erroEl = document.getElementById("erro-formulario");
    erroEl.innerHTML = "";
    try {
      const tipo = document.querySelector('input[name="e-tipo"]:checked').value;
      const onde = document.getElementById("e-onde") ? document.getElementById("e-onde").value : "conta";
      await transacoes.atualizar(item.id, {
        tipo,
        valorCentavos: paraCentavos(document.getElementById("e-valor").value),
        data: document.getElementById("e-data").value,
        competencia: tempo.competenciaDeData(document.getElementById("e-data").value),
        contaId: onde === "conta" ? document.getElementById("e-conta").value : null,
        cartaoId: onde === "cartao" ? document.getElementById("e-cartao").value : null,
        categoriaId: document.getElementById("e-categoria")?.value || "",
        pessoaId: document.getElementById("e-pessoa").value,
        fonteRendaId: document.getElementById("e-fonteRenda")?.value || null,
        descricao: document.getElementById("e-descricao").value.trim(),
        status: document.getElementById("e-status").value,
        certeza: document.getElementById("e-certeza").value,
      });
      mostrarToast("Transação atualizada.");
      fecharModal();
    } catch (erro) {
      const msg = erro instanceof ErroDeValidacao ? erro.erros.join(" ") : "Não foi possível salvar. Tente novamente.";
      erroEl.innerHTML = `<div class="erro-form">${escapeHtml(msg)}</div>`;
    }
  });
}

/** Transferência: as duas pernas precisam continuar com o mesmo valor e a
 * mesma data — editar só uma desincronizaria o par (dinheiro "mudando de
 * tamanho" entre sair de uma conta e entrar na outra). */
function abrirModalEditarTransferencia(item) {
  const d = item.dados;
  const par = lista.find((t) => t.id !== item.id && t.dados.transferenciaId === d.transferenciaId);
  const html = `
    <div class="modal">
      <h2>Editar transferência</h2>
      <p class="tela-sub" style="margin-bottom:16px;">Valor, data e descrição valem para as duas pontas da transferência.</p>
      <div id="erro-formulario"></div>
      <form id="form-editar-transferencia" novalidate>
        <div class="row2">
          <div class="field"><label for="e-valor">Valor</label><input type="text" inputmode="decimal" id="e-valor" placeholder="0,00" value="${formatarBRL(d.valorCentavos).replace("R$ ", "")}"></div>
          <div class="field"><label for="e-data">Data</label><input type="date" id="e-data" value="${escapeHtml(d.data || "")}"></div>
        </div>
        <div class="field"><label for="e-descricao">Descrição</label><input type="text" id="e-descricao" value="${escapeHtml(d.descricao || "")}"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>`;
  abrirModal(html);
  document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
  document.getElementById("form-editar-transferencia").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const erroEl = document.getElementById("erro-formulario");
    erroEl.innerHTML = "";
    try {
      const campos = {
        valorCentavos: paraCentavos(document.getElementById("e-valor").value),
        data: document.getElementById("e-data").value,
        competencia: tempo.competenciaDeData(document.getElementById("e-data").value),
        descricao: document.getElementById("e-descricao").value.trim(),
      };
      await transacoes.atualizar(item.id, campos);
      if (par) await transacoes.atualizar(par.id, campos);
      mostrarToast("Transferência atualizada.");
      fecharModal();
    } catch (erro) {
      const msg = erro instanceof ErroDeValidacao ? erro.erros.join(" ") : "Não foi possível salvar. Tente novamente.";
      erroEl.innerHTML = `<div class="erro-form">${escapeHtml(msg)}</div>`;
    }
  });
}

/** Pagamento de fatura: só o essencial (valor, data, descrição) — trocar a
 * fatura ou a conta de um pagamento já registrado é raro o bastante pra
 * não valer a complexidade agora; quem precisa disso apaga e relança. */
function abrirModalEditarPagamentoFatura(item) {
  const d = item.dados;
  const html = `
    <div class="modal">
      <h2>Editar pagamento de fatura</h2>
      <div id="erro-formulario"></div>
      <form id="form-editar-pagamento" novalidate>
        <div class="row2">
          <div class="field"><label for="e-valor">Valor</label><input type="text" inputmode="decimal" id="e-valor" placeholder="0,00" value="${formatarBRL(d.valorCentavos).replace("R$ ", "")}"></div>
          <div class="field"><label for="e-data">Data</label><input type="date" id="e-data" value="${escapeHtml(d.data || "")}"></div>
        </div>
        <div class="field"><label for="e-descricao">Descrição</label><input type="text" id="e-descricao" value="${escapeHtml(d.descricao || "")}"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>`;
  abrirModal(html);
  document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
  document.getElementById("form-editar-pagamento").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const erroEl = document.getElementById("erro-formulario");
    erroEl.innerHTML = "";
    try {
      await transacoes.atualizar(item.id, {
        valorCentavos: paraCentavos(document.getElementById("e-valor").value),
        data: document.getElementById("e-data").value,
        competencia: tempo.competenciaDeData(document.getElementById("e-data").value),
        descricao: document.getElementById("e-descricao").value.trim(),
      });
      mostrarToast("Pagamento atualizado.");
      fecharModal();
    } catch (erro) {
      const msg = erro instanceof ErroDeValidacao ? erro.erros.join(" ") : "Não foi possível salvar. Tente novamente.";
      erroEl.innerHTML = `<div class="erro-form">${escapeHtml(msg)}</div>`;
    }
  });
}

function abrirModalEditarTransacao(item) {
  const tipo = item.dados.tipo;
  if (tipo === "transferencia") return abrirModalEditarTransferencia(item);
  if (tipo === "pagamento_fatura") return abrirModalEditarPagamentoFatura(item);
  return abrirModalEditarTransacaoSimples(item);
}

// ---------- modal: nova transação (5 modos) ----------

const MODOS = [
  { id: "simples", rotulo: "Receita / Despesa" },
  { id: "transferencia", rotulo: "Transferência" },
  { id: "parcelamento", rotulo: "Parcelada" },
  { id: "recorrencia", rotulo: "Recorrente" },
  { id: "pagamento_fatura", rotulo: "Pagar fatura" },
];

function abrirModalNovaTransacao() {
  const html = `
    <div class="modal">
      <h2>Nova transação</h2>
      <div class="subabas" role="tablist" id="modos-transacao" style="margin-bottom:16px;">
        ${MODOS.map((m, i) => `<button type="button" class="modulo-chip${i === 0 ? " ativo" : ""}" data-modo="${m.id}">${escapeHtml(m.rotulo)}</button>`).join("")}
      </div>
      <div id="erro-formulario"></div>
      <form id="form-transacao" novalidate>
        <div id="campos-modo"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">Lançar</button>
        </div>
      </form>
    </div>`;
  abrirModal(html);
  document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
  document.querySelectorAll("#modos-transacao [data-modo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#modos-transacao [data-modo]").forEach((b) => b.classList.toggle("ativo", b === btn));
      renderCamposModo(btn.getAttribute("data-modo"));
    });
  });
  renderCamposModo("simples");
  document.getElementById("form-transacao").addEventListener("submit", onSubmitTransacao);
}

function modoAtivo() {
  const el = document.querySelector("#modos-transacao .ativo");
  return el ? el.getAttribute("data-modo") : "simples";
}

function campoOndeConta(idPrefixo, permiteCartao, atual) {
  const contasOpts = opcoes(contexto.contas.filter((c) => c.dados.status === "ativa"), (c) => c.id, (c) => c.dados.nome);
  if (!permiteCartao) {
    return `<div class="field"><label for="${idPrefixo}-conta">Conta</label>
      <select id="${idPrefixo}-conta">${contasOpts.map((o) => `<option value="${escapeHtml(o.valor)}" ${atual?.contaId === o.valor ? "selected" : ""}>${escapeHtml(o.rotulo)}</option>`).join("")}</select></div>`;
  }
  const cartoesOpts = opcoes(contexto.cartoes.filter((c) => c.dados.status === "ativo"), (c) => c.id, (c) => c.dados.apelido);
  const ondeAtual = atual?.cartaoId ? "cartao" : "conta";
  return `
    <div class="field"><label for="${idPrefixo}-onde">Onde</label>
      <select id="${idPrefixo}-onde">
        <option value="conta" ${ondeAtual === "conta" ? "selected" : ""}>Conta</option>
        <option value="cartao" ${ondeAtual === "cartao" ? "selected" : ""}>Cartão</option>
      </select>
    </div>
    <div class="field" id="${idPrefixo}-campo-conta" ${ondeAtual === "cartao" ? "hidden" : ""}><label for="${idPrefixo}-conta">Conta</label>
      <select id="${idPrefixo}-conta">${contasOpts.map((o) => `<option value="${escapeHtml(o.valor)}" ${atual?.contaId === o.valor ? "selected" : ""}>${escapeHtml(o.rotulo)}</option>`).join("")}</select></div>
    <div class="field" id="${idPrefixo}-campo-cartao" ${ondeAtual === "conta" ? "hidden" : ""}><label for="${idPrefixo}-cartao">Cartão</label>
      <select id="${idPrefixo}-cartao">${cartoesOpts.map((o) => `<option value="${escapeHtml(o.valor)}" ${atual?.cartaoId === o.valor ? "selected" : ""}>${escapeHtml(o.rotulo)}</option>`).join("")}</select></div>`;
}

function ligarAlternanciaOnde(idPrefixo) {
  const onde = document.getElementById(`${idPrefixo}-onde`);
  if (!onde) return;
  onde.addEventListener("change", () => {
    document.getElementById(`${idPrefixo}-campo-conta`).hidden = onde.value !== "conta";
    document.getElementById(`${idPrefixo}-campo-cartao`).hidden = onde.value !== "cartao";
  });
}

function campoCategoria(idPrefixo, natureza, atual) {
  const cats = opcoes(contexto.categorias.filter((c) => c.dados.ativa && c.dados.natureza === natureza), (c) => c.id, (c) => c.dados.nome);
  return `<div class="field"><label for="${idPrefixo}-categoria">Categoria</label>
    <select id="${idPrefixo}-categoria">${cats.length ? cats.map((o) => `<option value="${escapeHtml(o.valor)}" ${atual === o.valor ? "selected" : ""}>${escapeHtml(o.rotulo)}</option>`).join("") : '<option value="">Nenhuma categoria cadastrada</option>'}</select></div>`;
}

function campoPessoa(idPrefixo, atual) {
  const ps = opcoes(contexto.pessoas.filter((p) => p.dados.ativo), (p) => p.id, (p) => p.dados.nome);
  return `<div class="field"><label for="${idPrefixo}-pessoa">Pessoa</label>
    <select id="${idPrefixo}-pessoa">${ps.map((o) => `<option value="${escapeHtml(o.valor)}" ${atual === o.valor ? "selected" : ""}>${escapeHtml(o.rotulo)}</option>`).join("")}</select></div>`;
}

// Opcional — liga a receita a uma fonte de renda cadastrada (§12). Sem
// fonte nenhuma cadastrada, o campo nem aparece, pra não pedir algo que
// não existe.
function campoFonteRenda(idPrefixo, atual) {
  const fr = opcoes(contexto.fontesRenda.filter((f) => f.dados.ativa), (f) => f.id, (f) => f.dados.nome);
  if (!fr.length) return "";
  return `<div class="field"><label for="${idPrefixo}-fonteRenda">Fonte de renda (opcional)</label>
    <select id="${idPrefixo}-fonteRenda"><option value="">Nenhuma</option>${fr.map((o) => `<option value="${escapeHtml(o.valor)}" ${atual === o.valor ? "selected" : ""}>${escapeHtml(o.rotulo)}</option>`).join("")}</select></div>`;
}

function renderCamposModo(modo) {
  const alvo = document.getElementById("campos-modo");
  const hoje = new Date().toISOString().slice(0, 10);
  if (modo === "simples") {
    alvo.innerHTML = `
      <div class="field"><label>Tipo</label>
        <div class="radio-group">
          <label class="radio-opt"><input type="radio" name="s-tipo" value="despesa" checked> Despesa</label>
          <label class="radio-opt"><input type="radio" name="s-tipo" value="receita"> Receita</label>
        </div>
      </div>
      ${campoOndeConta("s", true)}
      <div class="row2">
        <div class="field"><label for="s-valor">Valor</label><input type="text" inputmode="decimal" id="s-valor" placeholder="0,00" required></div>
        <div class="field"><label for="s-data">Data</label><input type="date" id="s-data" value="${hoje}" required></div>
      </div>
      <div id="s-categoria-wrap">${campoCategoria("s", "despesa")}</div>
      ${campoPessoa("s")}
      <div id="s-fonteRenda-wrap"></div>
      <div class="field"><label for="s-descricao">Descrição</label><input type="text" id="s-descricao" placeholder="Ex.: Supermercado"></div>
      <div class="row2">
        <div class="field"><label for="s-status">Status</label>
          <select id="s-status">${STATUS_TRANSACAO.map((s) => `<option value="${s}"${s === "pago" ? " selected" : ""}>${ROTULO_STATUS[s]}</option>`).join("")}</select></div>
        <div class="field"><label for="s-certeza">Certeza</label>
          <select id="s-certeza">${CERTEZAS_TRANSACAO.map((c) => `<option value="${c}"${c === "confirmado" ? " selected" : ""}>${ROTULO_CERTEZA[c]}</option>`).join("")}</select></div>
      </div>`;
    ligarAlternanciaOnde("s");
    document.querySelectorAll('input[name="s-tipo"]').forEach((r) => {
      r.addEventListener("change", () => {
        document.getElementById("s-categoria-wrap").innerHTML = campoCategoria("s", r.value);
        document.getElementById("s-fonteRenda-wrap").innerHTML = r.value === "receita" ? campoFonteRenda("s") : "";
        const ondeSel = document.getElementById("s-onde");
        if (r.value === "receita") { ondeSel.value = "conta"; ondeSel.dispatchEvent(new Event("change")); ondeSel.closest(".field").style.display = "none"; document.getElementById("s-campo-cartao").hidden = true; }
        else { ondeSel.closest(".field").style.display = ""; }
      });
    });
    return;
  }
  if (modo === "transferencia") {
    const contasOpts = opcoes(contexto.contas.filter((c) => c.dados.status === "ativa"), (c) => c.id, (c) => c.dados.nome);
    alvo.innerHTML = `
      <div class="row2">
        <div class="field"><label for="tr-origem">De</label><select id="tr-origem">${contasOpts.map((o) => `<option value="${escapeHtml(o.valor)}">${escapeHtml(o.rotulo)}</option>`).join("")}</select></div>
        <div class="field"><label for="tr-destino">Para</label><select id="tr-destino">${contasOpts.map((o) => `<option value="${escapeHtml(o.valor)}">${escapeHtml(o.rotulo)}</option>`).join("")}</select></div>
      </div>
      <div class="row2">
        <div class="field"><label for="tr-valor">Valor</label><input type="text" inputmode="decimal" id="tr-valor" placeholder="0,00" required></div>
        <div class="field"><label for="tr-data">Data</label><input type="date" id="tr-data" value="${hoje}" required></div>
      </div>
      <div class="field"><label for="tr-descricao">Descrição (opcional)</label><input type="text" id="tr-descricao" placeholder="Ex.: Reserva de emergência"></div>`;
    return;
  }
  if (modo === "parcelamento") {
    alvo.innerHTML = `
      <div class="field"><label>Tipo</label>
        <div class="radio-group">
          <label class="radio-opt"><input type="radio" name="p-tipo" value="despesa" checked> Despesa</label>
          <label class="radio-opt"><input type="radio" name="p-tipo" value="receita"> Receita</label>
        </div>
      </div>
      ${campoOndeConta("p", true)}
      <div class="row2">
        <div class="field"><label for="p-valor">Valor total</label><input type="text" inputmode="decimal" id="p-valor" placeholder="0,00" required></div>
        <div class="field"><label for="p-qtd">Quantidade de parcelas</label><input type="number" id="p-qtd" min="2" value="2" required></div>
      </div>
      <div class="field"><label for="p-data">Data da 1ª parcela</label><input type="date" id="p-data" value="${hoje}" required></div>
      <div id="p-categoria-wrap">${campoCategoria("p", "despesa")}</div>
      ${campoPessoa("p")}
      <div class="field"><label for="p-descricao">Descrição</label><input type="text" id="p-descricao" placeholder="Ex.: Geladeira nova"></div>`;
    ligarAlternanciaOnde("p");
    document.querySelectorAll('input[name="p-tipo"]').forEach((r) => {
      r.addEventListener("change", () => { document.getElementById("p-categoria-wrap").innerHTML = campoCategoria("p", r.value); });
    });
    return;
  }
  if (modo === "recorrencia") {
    alvo.innerHTML = `
      <div class="field"><label>Tipo</label>
        <div class="radio-group">
          <label class="radio-opt"><input type="radio" name="r-tipo" value="despesa" checked> Despesa</label>
          <label class="radio-opt"><input type="radio" name="r-tipo" value="receita"> Receita</label>
        </div>
      </div>
      ${campoOndeConta("r", true)}
      <div class="row2">
        <div class="field"><label for="r-valor">Valor estimado</label><input type="text" inputmode="decimal" id="r-valor" placeholder="0,00" required></div>
        <div class="field"><label for="r-dia">Dia do mês</label><input type="number" id="r-dia" min="1" max="31" value="1" required></div>
      </div>
      <div id="r-categoria-wrap">${campoCategoria("r", "despesa")}</div>
      ${campoPessoa("r")}
      <div class="field"><label for="r-descricao">Descrição</label><input type="text" id="r-descricao" placeholder="Ex.: Aluguel" required></div>
      <p class="tela-sub" style="margin-top:-4px; margin-bottom:14px;">Isto cadastra um compromisso mensal. O sistema já gera os próximos lançamentos como "previsto".</p>`;
    ligarAlternanciaOnde("r");
    document.querySelectorAll('input[name="r-tipo"]').forEach((r) => {
      r.addEventListener("change", () => { document.getElementById("r-categoria-wrap").innerHTML = campoCategoria("r", r.value); });
    });
    return;
  }
  if (modo === "pagamento_fatura") {
    const abertas = contexto.faturas.filter((f) => f.dados.status !== "paga");
    const faturasOpts = abertas.map((f) => ({ valor: f.id, rotulo: `${nomeCartao(f.dados.cartaoId)} · ${tempo.competenciaLabel(f.dados.competencia)}` }));
    const contasOpts = opcoes(contexto.contas.filter((c) => c.dados.status === "ativa"), (c) => c.id, (c) => c.dados.nome);
    if (!faturasOpts.length) {
      alvo.innerHTML = `<div class="vazio">Nenhuma fatura em aberto ainda. Uma fatura nasce automaticamente quando você lança uma despesa num cartão.</div>`;
      return;
    }
    alvo.innerHTML = `
      <div class="field"><label for="f-fatura">Fatura</label>
        <select id="f-fatura">${faturasOpts.map((o) => `<option value="${escapeHtml(o.valor)}">${escapeHtml(o.rotulo)}</option>`).join("")}</select></div>
      <div class="field"><label for="f-conta">Pagar com a conta</label>
        <select id="f-conta">${contasOpts.map((o) => `<option value="${escapeHtml(o.valor)}">${escapeHtml(o.rotulo)}</option>`).join("")}</select></div>
      <div class="row2">
        <div class="field"><label for="f-valor">Valor</label><input type="text" inputmode="decimal" id="f-valor" placeholder="0,00" required></div>
        <div class="field"><label for="f-data">Data</label><input type="date" id="f-data" value="${hoje}" required></div>
      </div>`;
    return;
  }
}

async function onSubmitTransacao(ev) {
  ev.preventDefault();
  const modo = modoAtivo();
  const erroEl = document.getElementById("erro-formulario");
  erroEl.innerHTML = "";
  try {
    if (modo === "simples") {
      const tipo = document.querySelector('input[name="s-tipo"]:checked').value;
      const onde = document.getElementById("s-onde") ? document.getElementById("s-onde").value : "conta";
      await criarSimples({
        tipo,
        valorCentavos: paraCentavos(document.getElementById("s-valor").value),
        data: document.getElementById("s-data").value,
        contaId: onde === "conta" ? document.getElementById("s-conta").value : null,
        cartaoId: onde === "cartao" ? document.getElementById("s-cartao").value : null,
        categoriaId: document.getElementById("s-categoria")?.value || "",
        pessoaId: document.getElementById("s-pessoa").value,
        fonteRendaId: document.getElementById("s-fonteRenda")?.value || null,
        descricao: document.getElementById("s-descricao").value.trim(),
        status: document.getElementById("s-status").value,
        certeza: document.getElementById("s-certeza").value,
      });
      mostrarToast("Transação lançada.");
    } else if (modo === "transferencia") {
      await criarTransferencia({
        contaOrigemId: document.getElementById("tr-origem").value,
        contaDestinoId: document.getElementById("tr-destino").value,
        valorCentavos: paraCentavos(document.getElementById("tr-valor").value),
        data: document.getElementById("tr-data").value,
        descricao: document.getElementById("tr-descricao").value.trim(),
      });
      mostrarToast("Transferência lançada.");
    } else if (modo === "parcelamento") {
      const tipo = document.querySelector('input[name="p-tipo"]:checked').value;
      const onde = document.getElementById("p-onde") ? document.getElementById("p-onde").value : "conta";
      await criarParcelamento({
        tipo,
        valorTotalCentavos: paraCentavos(document.getElementById("p-valor").value),
        quantidade: parseInt(document.getElementById("p-qtd").value, 10),
        data: document.getElementById("p-data").value,
        contaId: onde === "conta" ? document.getElementById("p-conta").value : null,
        cartaoId: onde === "cartao" ? document.getElementById("p-cartao").value : null,
        categoriaId: document.getElementById("p-categoria")?.value || "",
        pessoaId: document.getElementById("p-pessoa").value,
        descricao: document.getElementById("p-descricao").value.trim(),
      });
      mostrarToast("Parcelamento lançado.");
    } else if (modo === "recorrencia") {
      const tipo = document.querySelector('input[name="r-tipo"]:checked').value;
      const onde = document.getElementById("r-onde") ? document.getElementById("r-onde").value : "conta";
      await recorrencias.criar({
        tipo,
        descricao: document.getElementById("r-descricao").value.trim(),
        valorEstimadoCentavos: paraCentavos(document.getElementById("r-valor").value),
        diaBase: parseInt(document.getElementById("r-dia").value, 10),
        contaId: onde === "conta" ? document.getElementById("r-conta").value : null,
        cartaoId: onde === "cartao" ? document.getElementById("r-cartao").value : null,
        categoriaId: document.getElementById("r-categoria")?.value || "",
        pessoaId: document.getElementById("r-pessoa").value,
        inicio: tempo.competenciaAtual(),
      });
      mostrarToast("Recorrência criada. Os próximos meses já foram provisionados.");
    } else if (modo === "pagamento_fatura") {
      await registrarPagamentoFatura({
        faturaId: document.getElementById("f-fatura").value,
        contaId: document.getElementById("f-conta").value,
        valorCentavos: paraCentavos(document.getElementById("f-valor").value),
        data: document.getElementById("f-data").value,
      });
      mostrarToast("Pagamento de fatura registrado.");
    }
    fecharModal();
    await carregarContexto();
    renderizar(); // a assinatura viva já deve ter redesenhado a lista, mas com o
    // contexto antigo (carregarContexto ainda não tinha terminado) — redesenha
    // de novo agora que pessoas/contas/cartões/faturas estão atualizados.
  } catch (erro) {
    const msg = erro instanceof ErroDeValidacao ? erro.erros.join(" ") : "Não foi possível salvar. Tente novamente.";
    erroEl.innerHTML = `<div class="erro-form">${escapeHtml(msg)}</div>`;
  }
}
