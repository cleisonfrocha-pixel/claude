// Renda, gap de renda (§12) e custos/orçamento/margem (§13). A pergunta
// central do §12 — havendo déficit, dizer se é gasto, timing de caixa,
// dívida, renda ou combinação — fica em destaque no topo, não escondida
// atrás de um número solto. Tela bespoke (como Plano e Transações): o
// resumo precisa reagir a conta/transação/dívida mudando, não só à lista
// de fontes — a fábrica de cadastro não dá conta disso sozinha.

import { fontesRenda, ErroDeValidacao } from "../../dados/repositorios.js";
import { assinarPainelRenda, calcularPainelRenda } from "../../dados/rendaRepo.js";
import { definirMetas } from "../../dados/orcamentoRepo.js";
import { historicoFonte } from "../../domain/renda.js";
import { TIPOS_FONTE_RENDA } from "../../domain/esquema.js";
import { paraCentavos, formatarBRL } from "../../domain/dinheiro.js";
import { formatarData } from "../../domain/tempo.js";
import { abrir as abrirModal, fechar as fecharModal } from "../modal.js";
import { escapeHtml, iniciais, mostrarToast } from "../utilitarios.js";

const ROTULO_TIPO_FONTE = { fixa: "Fixa", recorrente: "Recorrente", variavel: "Variável", eventual: "Eventual" };
const ROTULO_CAUSA = { renda: "Renda", gasto: "Gasto", divida: "Dívida", timing: "Timing de caixa" };

let painel = null;
let pararAssinatura = null;
let container = null;
const expandidos = new Set();

export default {
  montar(alvo) {
    container = alvo;
    expandidos.clear();
    if (pararAssinatura) pararAssinatura();
    pararAssinatura = assinarPainelRenda((r) => { painel = r; renderizar(); });
    renderizar();
  },
  desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    container = null;
    painel = null;
  },
};

function textoCausa(c) {
  switch (c.tipo) {
    case "renda":
      return `Falta ${formatarBRL(c.dados.faltaCentavos)} para a renda (${formatarBRL(c.dados.rendaAtualCentavos)}) cobrir o essencial (${formatarBRL(c.dados.custoEssencialCentavos)}).`;
    case "gasto":
      return `O gasto do mês (${formatarBRL(c.dados.custoAtualCentavos)}) passou ${formatarBRL(c.dados.excedenteCentavos)} do que a renda ou o essencial sustentam.`;
    case "divida":
      return `Depois do essencial sobram ${formatarBRL(c.dados.sobraAposEssencial)}, mas as parcelas de dívida somam ${formatarBRL(c.dados.comprometimentoMensalDividasCentavos)} — faltam ${formatarBRL(c.dados.faltaCentavos)}.`;
    case "timing":
      return `O mês fecha no papel, mas o caixa está em ${formatarBRL(c.dados.seguroParaGastarCentavos)} agora — é questão de datas, não de dinheiro insuficiente no total.`;
    default:
      return "";
  }
}

function blocoCausaDeficit(cd) {
  if (!cd.temDeficit) {
    return `<div class="alerta-tudo-coberto">Sem déficit este mês: a renda cobre o essencial, os compromissos e ainda sobra caixa.</div>`;
  }
  return `
    <div class="alerta-cobertura">
      <div class="titulo">${cd.causas.length > 1 ? "Déficit por combinação de causas" : "Há déficit este mês"}</div>
      ${cd.causas.map((c) => `
        <div class="texto" style="margin-top:6px;"><b>${escapeHtml(ROTULO_CAUSA[c.tipo])}</b> — ${escapeHtml(c.titulo)}. ${textoCausa(c)}</div>
      `).join("")}
      ${!cd.causas.length ? `<div class="texto">O caixa fechou negativo por uma margem pequena, sem uma causa específica se destacar.</div>` : ""}
    </div>`;
}

function cartaoFonte(f, painel) {
  const pessoa = (painel.pessoas || []).find((p) => p.id === f.pessoaId);
  const aberto = expandidos.has(f.id);
  return `
    <div class="item-cartao" data-id="${escapeHtml(f.id)}">
      <div class="item-avatar">${escapeHtml(iniciais(f.nome))}</div>
      <div class="item-corpo">
        <div class="item-titulo">${escapeHtml(f.nome)}</div>
        <div class="item-sub">${ROTULO_TIPO_FONTE[f.tipo]}${pessoa ? " · " + escapeHtml(pessoa.nome) : ""}</div>
      </div>
      <div class="item-valor mono">${formatarBRL(f.valorEsperadoCentavos)}</div>
      ${!f.ativa ? `<span class="item-tag inativa">inativa</span>` : ""}
      <button class="icon-btn item-chevron${aberto ? " aberto" : ""}" data-acao="expandir" data-id="${escapeHtml(f.id)}" title="Ver detalhes" aria-label="Ver detalhes">▾</button>
      <div class="item-acoes">
        <button class="icon-btn" data-acao="editar" data-id="${escapeHtml(f.id)}" title="Editar" aria-label="Editar">✎</button>
        <button class="icon-btn danger" data-acao="apagar" data-id="${escapeHtml(f.id)}" title="Apagar" aria-label="Apagar">✕</button>
      </div>
    </div>
    ${aberto ? `<div class="item-extra">${detalheFonte(f, painel)}</div>` : ""}`;
}

function detalheFonte(f, painel) {
  const prev = f.previsibilidade;
  const historico = historicoFonte(f, painel.transacoes).slice(0, 6);
  return `
    <div class="tela-sub" style="margin:0 0 8px;">${prev
      ? `Previsibilidade: ${prev.previsibilidadePercentual}% confirmado, entrou em ${prev.mesesComEntrada} de ${prev.mesesLookback} últimos meses.`
      : "Sem entradas registradas ainda para calcular previsibilidade."}</div>
    ${historico.length ? historico.map((t) => `
      <div class="fatura-linha">
        <span class="rotulo">${escapeHtml(formatarData(t.data))}<small>${t.certeza === "confirmado" ? "confirmado" : t.certeza === "provavel" ? "provável" : "incerto"}</small></span>
        <b>${formatarBRL(t.valorCentavos)}</b>
      </div>`).join("") : `<div class="vazio">Nenhuma entrada lançada ainda para esta fonte.</div>`}
  `;
}

function linhaGap(rotulo, gapCentavos) {
  if (gapCentavos == null) return `<div class="resumo-item"><span>${escapeHtml(rotulo)}</span><b class="mono" data-valor>—</b></div>`;
  return `<div class="resumo-item"><span>${escapeHtml(rotulo)}</span><b class="mono ${gapCentavos < 0 ? "valor-neg" : "valor-pos"}" data-valor>${formatarBRL(gapCentavos)}</b></div>`;
}

function linhaEvolucao(item, painel) {
  const cat = (painel.categorias || []).find((c) => c.id === item.categoriaId);
  const nome = cat ? cat.nome : (item.categoriaId === "sem-categoria" ? "Sem categoria" : item.categoriaId);
  const diffPct = item.mediaCentavos > 0 ? Math.round(((item.valorCentavos - item.mediaCentavos) / item.mediaCentavos) * 100) : null;
  return `
    <div class="fatura-linha">
      <span class="rotulo">${escapeHtml(nome)}<small>média dos meses anteriores: ${formatarBRL(item.mediaCentavos)}</small></span>
      <b class="${diffPct != null && diffPct > 0 ? "valor-neg" : ""}">${formatarBRL(item.valorCentavos)}${diffPct != null ? ` <span style="font-weight:400;font-size:11px;">(${diffPct >= 0 ? "+" : ""}${diffPct}%)</span>` : ""}</b>
    </div>`;
}

function renderizar() {
  if (!container) return;

  if (!painel) {
    container.innerHTML = `
      <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Renda</h2></div></div>
      <p class="tela-sub">Carregando…</p>`;
    return;
  }

  const { gaps, custos, margemCentavos, concentracao, metas, recorrenteVsExtraordinario, evolucaoCategorias, categoriasCrescentes } = painel;

  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Renda</h2>
        <p class="tela-sub">Capacidade de geração de renda, os gaps que ela precisa cobrir, e por que existe déficit quando existe.</p>
      </div>
    </div>

    ${blocoCausaDeficit(painel.causaDeficit)}

    <div class="tela-head" style="margin-top:0;"><div><h3 class="tela-titulo" style="font-size:17px;">Renda do mês</h3>
      <p class="tela-sub">${formatarBRL(painel.rendaAtualCentavos)} realizados · ${concentracao.concentracaoPercentual}% concentrado na maior fonte (${concentracao.quantidadeFontes} ${concentracao.quantidadeFontes === 1 ? "fonte" : "fontes"})</p></div>
      <button class="btn btn-primary" data-acao="nova-fonte">+ Nova fonte</button>
    </div>
    <div class="lista-cartoes" id="lista-fontes" style="margin-bottom:20px;"></div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Os três gaps</h3>
      <p class="tela-sub">Renda atual menos cada patamar de custo — positivo é sobra, negativo é falta</p></div></div>
    <div class="resumo-mes">
      ${linhaGap("Contra o essencial", gaps.gapEssencialCentavos)}
      ${linhaGap("Contra o custo desejado", gaps.gapDesejadoCentavos)}
      ${linhaGap("Contra a meta de recuperação", gaps.gapRecuperacaoCentavos)}
    </div>
    ${metas.custoDesejadoCentavos == null || metas.metaRecuperacaoCentavos == null ? `
      <div class="nota-incerto">
        <span>${metas.custoDesejadoCentavos == null ? "Custo desejado não definido" : ""}${metas.custoDesejadoCentavos == null && metas.metaRecuperacaoCentavos == null ? " · " : ""}${metas.metaRecuperacaoCentavos == null ? `Meta de recuperação usando o padrão (essencial + parcelas de dívida): ${formatarBRL(metas.metaRecuperacaoEfetivaCentavos)}` : ""}</span>
      </div>` : ""}

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Metas</h3>
      <p class="tela-sub">Custo de vida desejado e meta de recuperação — só você define, o sistema nunca inventa</p></div></div>
    <div class="simulador-linha" style="margin-bottom:10px;">
      <div class="field"><label for="input-custo-desejado">Custo de vida desejado</label>
        <input type="text" inputmode="decimal" id="input-custo-desejado" placeholder="0,00" value="${metas.custoDesejadoCentavos != null ? formatarBRL(metas.custoDesejadoCentavos).replace("R$ ", "") : ""}"></div>
      <button class="btn btn-ghost btn-sm" type="button" data-acao="salvar-custo-desejado">Salvar</button>
    </div>
    <div class="simulador-linha">
      <div class="field"><label for="input-meta-recuperacao">Meta de recuperação (opcional)</label>
        <input type="text" inputmode="decimal" id="input-meta-recuperacao" placeholder="0,00" value="${metas.metaRecuperacaoCentavos != null ? formatarBRL(metas.metaRecuperacaoCentavos).replace("R$ ", "") : ""}"></div>
      <button class="btn btn-ghost btn-sm" type="button" data-acao="salvar-meta-recuperacao">Salvar</button>
    </div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Custos e margem</h3>
      <p class="tela-sub">§13 — orçamento como instrumento de clareza, não uma prisão</p></div></div>
    <div class="resumo-mes">
      <div class="resumo-item"><span>Custo essencial</span><b class="mono" data-valor>${formatarBRL(custos.essencialCentavos)}</b></div>
      <div class="resumo-item"><span>Custo atual</span><b class="mono" data-valor>${formatarBRL(custos.atualCentavos)}</b></div>
      <div class="resumo-item"><span>Discricionário</span><b class="mono" data-valor>${formatarBRL(custos.discricionarioCentavos)}</b></div>
    </div>
    <div class="resumo-mes">
      <div class="resumo-item"><span>Margem</span><b class="mono ${margemCentavos < 0 ? "valor-neg" : "valor-pos"}" data-valor>${formatarBRL(margemCentavos)}</b></div>
      <div class="resumo-item"><span>Recorrente</span><b class="mono" data-valor>${formatarBRL(recorrenteVsExtraordinario.recorrenteCentavos)}</b></div>
      <div class="resumo-item"><span>Extraordinário</span><b class="mono" data-valor>${formatarBRL(recorrenteVsExtraordinario.extraordinarioCentavos)}</b></div>
    </div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Evolução por categoria</h3>
      <p class="tela-sub">As maiores despesas do mês, comparadas com a média dos meses anteriores</p></div></div>
    ${evolucaoCategorias.length ? evolucaoCategorias.map((i) => linhaEvolucao(i, painel)).join("") : `<div class="vazio">Nenhuma despesa paga neste mês ainda.</div>`}

    ${categoriasCrescentes.length ? `
      <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Categorias consumindo margem de forma crescente</h3>
        <p class="tela-sub">Subiram em todos os últimos meses, sem nenhuma queda no meio</p></div></div>
      ${categoriasCrescentes.map((c) => {
        const cat = (painel.categorias || []).find((x) => x.id === c.categoriaId);
        return `<div class="fatura-linha"><span class="rotulo">${escapeHtml(cat ? cat.nome : c.categoriaId)}</span><b class="valor-neg">+${c.crescimentoTotalPercentual}%</b></div>`;
      }).join("")}
    ` : ""}
  `;

  renderizarListaFontes();
  ligarEventosGerais();
}

function renderizarListaFontes() {
  const alvo = container.querySelector("#lista-fontes");
  if (!alvo) return;
  if (!painel.fontes.length) {
    alvo.innerHTML = `<div class="vazio">Nenhuma fonte de renda cadastrada.<div><button class="btn btn-primary" data-acao="nova-fonte-vazio">+ Nova fonte</button></div></div>`;
    alvo.querySelector('[data-acao="nova-fonte-vazio"]').addEventListener("click", () => abrirFormularioFonte(null));
    return;
  }
  alvo.innerHTML = painel.fontes.map((f) => cartaoFonte(f, painel)).join("");

  alvo.querySelectorAll('[data-acao="expandir"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (expandidos.has(id)) expandidos.delete(id); else expandidos.add(id);
      renderizarListaFontes();
    });
  });
  alvo.querySelectorAll('[data-acao="editar"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = painel.fontes.find((x) => x.id === btn.dataset.id);
      if (f) abrirFormularioFonte(f);
    });
  });
  alvo.querySelectorAll('[data-acao="apagar"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = painel.fontes.find((x) => x.id === btn.dataset.id);
      if (f) confirmarApagarFonte(f);
    });
  });
}

function ligarEventosGerais() {
  const btnNova = container.querySelector('[data-acao="nova-fonte"]');
  if (btnNova) btnNova.addEventListener("click", () => abrirFormularioFonte(null));

  const btnCustoDesejado = container.querySelector('[data-acao="salvar-custo-desejado"]');
  if (btnCustoDesejado) {
    btnCustoDesejado.addEventListener("click", async () => {
      const valor = container.querySelector("#input-custo-desejado").value;
      await definirMetas({ custoDesejadoCentavos: valor ? paraCentavos(valor) : null });
      mostrarToast("Custo de vida desejado salvo.");
      await recarregarPainel();
    });
  }
  const btnMetaRecuperacao = container.querySelector('[data-acao="salvar-meta-recuperacao"]');
  if (btnMetaRecuperacao) {
    btnMetaRecuperacao.addEventListener("click", async () => {
      const valor = container.querySelector("#input-meta-recuperacao").value;
      await definirMetas({ metaRecuperacaoCentavos: valor ? paraCentavos(valor) : null });
      mostrarToast("Meta de recuperação salva.");
      await recarregarPainel();
    });
  }
}

// As metas de orçamento vivem num único documento (orcamentoRepo.js), que
// não tem uma assinatura ao vivo como as coleções (db.js só sabe assinar
// coleções inteiras) — por isso, depois de salvar uma meta, recarrega o
// painel na mão em vez de esperar a assinatura de contas/transações/
// dívidas/fontes disparar sozinha (ela não vai disparar nesse caso).
async function recarregarPainel() {
  painel = await calcularPainelRenda();
  renderizar();
}

function campoFonteHtml(f) {
  const pessoasOpts = (painel.pessoas || []).map((p) => `<option value="${escapeHtml(p.id)}" ${f?.pessoaId === p.id ? "selected" : ""}>${escapeHtml(p.nome)}</option>`).join("");
  return `
    <div class="field"><label for="campo-fonte-nome">Nome</label>
      <input type="text" id="campo-fonte-nome" value="${escapeHtml(f?.nome || "")}" placeholder="Ex.: Salário CLT" required></div>
    <div class="field"><label for="campo-fonte-pessoa">Responsável</label>
      <select id="campo-fonte-pessoa" required><option value="" ${f?.pessoaId ? "" : "selected"}>Selecione uma pessoa</option>${pessoasOpts}</select></div>
    <div class="field"><label for="campo-fonte-tipo">Tipo</label>
      <select id="campo-fonte-tipo">${TIPOS_FONTE_RENDA.map((t) => `<option value="${t}" ${f?.tipo === t ? "selected" : ""}>${ROTULO_TIPO_FONTE[t]}</option>`).join("")}</select></div>
    <div class="field"><label for="campo-fonte-valor">Valor esperado por mês</label>
      <input type="text" inputmode="decimal" id="campo-fonte-valor" placeholder="0,00" value="${f ? formatarBRL(f.valorEsperadoCentavos).replace("R$ ", "") : ""}"></div>
    <label class="field-check"><input type="checkbox" id="campo-fonte-ativa" ${f ? (f.ativa ? "checked" : "") : "checked"}> Ativa</label>
  `;
}

function abrirFormularioFonte(f) {
  const editando = !!f;
  abrirModal(`
    <div class="modal">
      <h2>${editando ? "Editar" : "Nova"} fonte de renda</h2>
      <div id="erro-formulario"></div>
      <form id="form-fonte">
        ${campoFonteHtml(f)}
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editando ? "Salvar" : "Criar"}</button>
        </div>
      </form>
    </div>
  `);
  document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
  document.getElementById("form-fonte").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const campos = {
      nome: document.getElementById("campo-fonte-nome").value,
      pessoaId: document.getElementById("campo-fonte-pessoa").value,
      tipo: document.getElementById("campo-fonte-tipo").value,
      valorEsperadoCentavos: paraCentavos(document.getElementById("campo-fonte-valor").value),
      ativa: document.getElementById("campo-fonte-ativa").checked,
    };
    try {
      if (editando) {
        await fontesRenda.atualizar(f.id, campos);
        mostrarToast("Fonte de renda atualizada.");
      } else {
        await fontesRenda.criar(campos);
        mostrarToast("Fonte de renda criada.");
      }
      fecharModal();
    } catch (erro) {
      const el = document.getElementById("erro-formulario");
      const msg = erro instanceof ErroDeValidacao ? erro.erros.join(" ") : "Não foi possível salvar. Tente novamente.";
      if (el) el.innerHTML = `<div class="erro-form">${escapeHtml(msg)}</div>`;
    }
  });
}

function confirmarApagarFonte(f) {
  abrirModal(`
    <div class="modal">
      <h2>Apagar “${escapeHtml(f.nome)}”?</h2>
      <p class="tela-sub" style="margin-bottom:20px;">Esta ação não pode ser desfeita.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-acao="cancelar">Cancelar</button>
        <button class="btn btn-primary" style="background:var(--danger);" data-acao="confirmar">Apagar</button>
      </div>
    </div>
  `);
  document.querySelector('[data-acao="cancelar"]').addEventListener("click", fecharModal);
  document.querySelector('[data-acao="confirmar"]').addEventListener("click", async () => {
    await fontesRenda.apagar(f.id);
    fecharModal();
    mostrarToast("Fonte de renda apagada.");
  });
}
