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
import { escapeHtml, ajudaHtml, iniciais, mostrarToast } from "../utilitarios.js";

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
      return `Falta <span data-valor>${formatarBRL(c.dados.faltaCentavos)}</span> para a renda (<span data-valor>${formatarBRL(c.dados.rendaAtualCentavos)}</span>) cobrir o essencial (<span data-valor>${formatarBRL(c.dados.custoEssencialCentavos)}</span>).`;
    case "gasto":
      return `O gasto do mês (<span data-valor>${formatarBRL(c.dados.custoAtualCentavos)}</span>) passou <span data-valor>${formatarBRL(c.dados.excedenteCentavos)}</span> do que a renda ou o essencial sustentam.`;
    case "divida":
      return `Depois do essencial sobram <span data-valor>${formatarBRL(c.dados.sobraAposEssencial)}</span>, mas as parcelas de dívida somam <span data-valor>${formatarBRL(c.dados.comprometimentoMensalDividasCentavos)}</span>. Faltam <span data-valor>${formatarBRL(c.dados.faltaCentavos)}</span>.`;
    case "timing":
      return `O mês fecha no papel, mas o caixa está em <span data-valor>${formatarBRL(c.dados.seguroParaGastarCentavos)}</span> agora. É questão de datas, não de dinheiro insuficiente no total.`;
    default:
      return "";
  }
}

function blocoCausaDeficit(cd) {
  if (!cd.temDeficit) {
    return `<div class="alerta-tudo-coberto">Sem déficit este mês: a renda cobre o essencial, os compromissos e ainda sobra caixa.</div>`;
  }
  const soTiming = cd.causas.length === 1 && cd.causas[0].tipo === "timing";
  return `
    <div class="alerta-cobertura">
      <div class="titulo">${soTiming ? "O mês fecha, mas o caixa aperta por datas" : cd.causas.length > 1 ? "Déficit por combinação de causas" : "Há déficit este mês"}</div>
      ${cd.causas.map((c) => soTiming
        ? `<div class="texto" style="margin-top:6px;">${textoCausa(c)}</div>`
        : `<div class="texto" style="margin-top:6px;"><b>${escapeHtml(ROTULO_CAUSA[c.tipo])}</b>: ${escapeHtml(c.titulo)}. ${textoCausa(c)}</div>`).join("")}
      ${!cd.causas.length ? `<div class="texto">O caixa fechou negativo por uma diferença pequena, sem uma causa que se destaque.</div>` : ""}
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
      <div class="item-valor mono" data-valor>${formatarBRL(f.valorEsperadoCentavos)}</div>
      ${!f.ativa ? `<span class="item-tag inativa">inativa</span>` : ""}
      <button class="btn-mini${aberto ? " ativo" : ""}" data-acao="expandir" data-id="${escapeHtml(f.id)}" aria-expanded="${aberto}">${aberto ? "Fechar" : "Detalhes"}</button>
      <div class="item-acoes">
        <button class="btn-mini" data-acao="editar" data-id="${escapeHtml(f.id)}" >Editar</button>
        <button class="btn-mini perigo" data-acao="apagar" data-id="${escapeHtml(f.id)}" >Apagar</button>
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
        <b data-valor>${formatarBRL(t.valorCentavos)}</b>
      </div>`).join("") : `<div class="vazio">Nenhuma entrada lançada ainda para esta fonte.</div>`}
  `;
}

function linhaGap(rotulo, gapCentavos) {
  if (gapCentavos == null) return `<div class="resumo-item"><span>${escapeHtml(rotulo)}</span><b class="mono" data-valor>-</b></div>`;
  return `<div class="resumo-item"><span>${escapeHtml(rotulo)}</span><b class="mono ${gapCentavos < 0 ? "valor-neg" : "valor-pos"}" data-valor>${formatarBRL(gapCentavos)}</b></div>`;
}

function linhaEvolucao(item, painel) {
  const cat = (painel.categorias || []).find((c) => c.id === item.categoriaId);
  const nome = cat ? cat.nome : (item.categoriaId === "sem-categoria" ? "Sem categoria" : item.categoriaId);
  const diffPct = item.mediaCentavos > 0 ? Math.round(((item.valorCentavos - item.mediaCentavos) / item.mediaCentavos) * 100) : null;
  return `
    <div class="fatura-linha">
      <span class="rotulo">${escapeHtml(nome)}<small>média dos meses anteriores: <span data-valor>${formatarBRL(item.mediaCentavos)}</span></small></span>
      <b class="${diffPct != null && diffPct > 0 ? "valor-neg" : ""}" data-valor>${formatarBRL(item.valorCentavos)}${diffPct != null ? ` <span style="font-weight:400;font-size:13px;">(${diffPct >= 0 ? "+" : ""}${diffPct}%)</span>` : ""}</b>
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

  // Sem fonte cadastrada e sem transação nenhuma: mostrar o diagnóstico
  // inteiro é enganoso — os gaps em zero e o banner "sem déficit" parecem
  // dizer que está tudo bem, quando na verdade não há nada para avaliar
  // ainda (achado #13 da auditoria de UX).
  if (!painel.fontes.length && !painel.transacoes.length) {
    container.innerHTML = `
      <div class="tela-head" style="margin-top:0;">
        <div>
          <h2 class="tela-titulo">Renda</h2>
          <p class="tela-sub">Quanto entra, de onde vem e se dá pra fechar o mês.</p>
        </div>
      </div>
      <div class="vazio">
        Ainda não há nenhuma fonte de renda nem transação cadastrada. Sem isso não dá pra saber quanto falta ou sobra no mês.
        <div><button class="btn btn-primary" data-acao="nova-fonte">+ Nova fonte de renda</button></div>
      </div>`;
    container.querySelector('[data-acao="nova-fonte"]').addEventListener("click", () => abrirFormularioFonte(null));
    return;
  }

  const { gaps, custos, concentracao, metas, recorrenteVsExtraordinario, evolucaoCategorias, categoriasCrescentes } = painel;
  // Item 65 da lista de 05/10: as fontes de renda à vista; os resumos e métricas fechados, um por vez.

  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Renda</h2>
        <p class="tela-sub">Quanto entra, de onde vem e se dá pra fechar o mês.</p>
      </div>
    </div>

    ${blocoCausaDeficit(painel.causaDeficit)}

    <div class="tela-head" style="margin-top:0;"><div><h3 class="tela-titulo" style="font-size:17px;">Renda do mês</h3>
      <p class="tela-sub"><span data-valor>${formatarBRL(painel.rendaAtualCentavos)}</span> no mês${painel.rendaEmCamadas ? ` (${formatarBRL(painel.rendaEmCamadas.confirmadaCentavos)} já recebidos + ${formatarBRL(painel.rendaEmCamadas.provavelCentavos)} esperados${painel.rendaEmCamadas.incertaCentavos ? `; ${formatarBRL(painel.rendaEmCamadas.incertaCentavos)} incertos ficam de fora` : ""})` : ""}${concentracao.quantidadeFontes > 0
        ? ` · ${concentracao.concentracaoPercentual}% concentrado na maior fonte (${concentracao.quantidadeFontes} ${concentracao.quantidadeFontes === 1 ? "fonte" : "fontes"})`
        : " · nenhuma receita ligada a uma fonte cadastrada"}</p></div>
      <button class="btn btn-primary" data-acao="nova-fonte">+ Nova fonte</button>
    </div>
    <div class="lista-cartoes" id="lista-fontes" style="margin-bottom:20px;"></div>

    <details class="inicio-detalhe renda-secao"><summary>Dá pra pagar o mês?</summary>

    <div class="resumo-mes">
      ${linhaGap("Pra pagar só o essencial", gaps.gapEssencialCentavos)}
      ${linhaGap("Pra manter o padrão que você quer", gaps.gapDesejadoCentavos)}
      ${linhaGap("Pra se recuperar", gaps.gapRecuperacaoCentavos)}
    </div>
    ${metas.custoDesejadoCentavos == null || metas.metaRecuperacaoCentavos == null ? `
      <div class="nota-incerto">
        <span>${metas.custoDesejadoCentavos == null ? "Você ainda não definiu quanto quer gastar por mês" : ""}${metas.custoDesejadoCentavos == null && metas.metaRecuperacaoCentavos == null ? " · " : ""}${metas.metaRecuperacaoCentavos == null ? `Pra se recuperar, usando o mínimo (essencial + parcelas de dívida): <span data-valor>${formatarBRL(metas.metaRecuperacaoEfetivaCentavos)}</span>` : ""}</span>
      </div>` : ""}

    </details>
    <details class="inicio-detalhe renda-secao"><summary>Metas (quanto quer gastar, quanto precisa, quanto investir)</summary>
<p class="tela-sub">Quanto você quer gastar, quanto precisa pra se recuperar e quanto investir. Só você define, o painel nunca inventa.</p>
    <div class="simulador-linha" style="margin-bottom:10px;">
      <div class="field"><label for="input-custo-desejado">Quanto quero gastar por mês</label>
        <input type="text" inputmode="decimal" id="input-custo-desejado" placeholder="0,00" value="${metas.custoDesejadoCentavos != null ? formatarBRL(metas.custoDesejadoCentavos).replace("R$ ", "") : ""}"></div>
      <button class="btn btn-ghost btn-sm" type="button" data-acao="salvar-custo-desejado">Salvar</button>
    </div>
    <div class="simulador-linha" style="margin-bottom:10px;">
      <div class="field"><label for="input-meta-recuperacao">Quanto preciso por mês pra me recuperar (opcional)</label>
        <input type="text" inputmode="decimal" id="input-meta-recuperacao" placeholder="0,00" value="${metas.metaRecuperacaoCentavos != null ? formatarBRL(metas.metaRecuperacaoCentavos).replace("R$ ", "") : ""}"></div>
      <button class="btn btn-ghost btn-sm" type="button" data-acao="salvar-meta-recuperacao">Salvar</button>
    </div>
    <div class="simulador-linha">
      <div class="field"><label for="input-investimento-minimo">Investimento mínimo por mês</label>
        <input type="text" inputmode="decimal" id="input-investimento-minimo" placeholder="0,00" value="${metas.investimentoMinimoMensalCentavos ? formatarBRL(metas.investimentoMinimoMensalCentavos).replace("R$ ", "") : ""}"></div>
      <button class="btn btn-ghost btn-sm" type="button" data-acao="salvar-investimento-minimo">Salvar</button>
    </div>
    <div class="tela-sub" style="margin:6px 0 0;">Continua saindo todo mês em Plano › Caminhos, mesmo com dívida em aberto — protegido como o essencial, nunca vira dinheiro pra pagar dívida.</div>

    </details>
    <details class="inicio-detalhe renda-secao"><summary>Pra onde vai o dinheiro</summary>

    <div class="resumo-mes">
      <div class="resumo-item"><span>Gastos essenciais</span><b class="mono" data-valor>${formatarBRL(custos.essencialCentavos)}</b></div>
      <div class="resumo-item"><span>Gasto total do mês</span><b class="mono" data-valor>${formatarBRL(custos.atualCentavos)}</b></div>
      <div class="resumo-item"><span>Gastos que dá pra cortar</span><b class="mono" data-valor>${formatarBRL(custos.discricionarioCentavos)}</b></div>
    </div>
    <div class="resumo-mes">
      <div class="resumo-item"><span>Sobra do mês ${ajudaHtml("Renda do mês (recebida e esperada) menos todos os gastos do mês e as parcelas de dívida. É o mesmo número do Início e do Plano.")}</span><b class="mono ${painel.sobraMesCentavos < 0 ? "valor-neg" : "valor-pos"}" data-valor>${formatarBRL(painel.sobraMesCentavos)}</b></div>
      ${recorrenteVsExtraordinario.recorrenteCentavos || recorrenteVsExtraordinario.extraordinarioCentavos ? `
      <div class="resumo-item"><span>Gastos fixos</span><b class="mono" data-valor>${formatarBRL(recorrenteVsExtraordinario.recorrenteCentavos)}</b></div>
      <div class="resumo-item"><span>Gastos fora do normal</span><b class="mono" data-valor>${formatarBRL(recorrenteVsExtraordinario.extraordinarioCentavos)}</b></div>` : ""}
    </div>
    ${custos.faturaSemDetalheCentavos > 0 ? `
      <div class="nota-incerto">
        <span><b data-valor>${formatarBRL(custos.faturaSemDetalheCentavos)}</b> de fatura de cartão paga sem nenhuma compra lançada por trás — entra no custo atual, mas sem categoria (não sabemos se é essencial ou não). Lance as compras da fatura pra esse número ficar honesto.</span>
      </div>` : ""}

    </details>
    <details class="inicio-detalhe renda-secao"><summary>Gasto por categoria, mês a mês</summary>

    ${evolucaoCategorias.length ? evolucaoCategorias.map((i) => linhaEvolucao(i, painel)).join("") : `<div class="vazio">Nenhuma despesa paga neste mês ainda.</div>`}

    ${categoriasCrescentes.length ? `
      <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Gastos que só sobem</h3>
        <p class="tela-sub">Subiram em todos os últimos meses, sem nenhuma queda no meio</p></div></div>
      ${categoriasCrescentes.map((c) => {
        const cat = (painel.categorias || []).find((x) => x.id === c.categoriaId);
        return `<div class="fatura-linha"><span class="rotulo">${escapeHtml(cat ? cat.nome : c.categoriaId)}</span><b class="valor-neg">+${c.crescimentoTotalPercentual}%</b></div>`;
      }).join("")}
    ` : ""}
    </details>
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
  const btnInvestimentoMinimo = container.querySelector('[data-acao="salvar-investimento-minimo"]');
  if (btnInvestimentoMinimo) {
    btnInvestimentoMinimo.addEventListener("click", async () => {
      const valor = container.querySelector("#input-investimento-minimo").value;
      await definirMetas({ investimentoMinimoMensalCentavos: valor ? paraCentavos(valor) : 0 });
      mostrarToast("Investimento mínimo salvo.");
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
    <div class="field"><label for="campo-fonte-dia">Dia do mês em que costuma cair (opcional)</label>
      <input type="number" min="1" max="31" inputmode="numeric" id="campo-fonte-dia" value="${f?.diaRecebimento || ""}" placeholder="Ex.: 5">
      <small class="tela-sub" style="display:block;margin-top:4px;">Sem o dia, a agenda usa o dia do último recebimento. Renda variável entra na previsão pelo pior mês recente.</small></div>
    <div class="field"><label for="campo-fonte-conta">Conta onde cai (opcional)</label>
      <select id="campo-fonte-conta"><option value="">Não sei / varia</option>${(painel?.contas || []).map((c) => `<option value="${escapeHtml(c.id)}"${f?.contaId === c.id ? " selected" : ""}>${escapeHtml(c.nome)}</option>`).join("")}</select></div>
    <div class="field"><label for="campo-fonte-fim">Último mês em que paga (opcional)</label>
      <input type="month" id="campo-fonte-fim" value="${escapeHtml(f?.fim || "")}">
      <small class="tela-sub" style="display:block;margin-top:4px;">Contrato com data para acabar: depois desse mês o painel para de contar essa renda.</small></div>
    <label class="field-check"><input type="checkbox" id="campo-fonte-ativa" ${f ? (f.ativa ? "checked" : "") : "checked"}> Ativa</label>
  `;
}

function abrirFormularioFonte(f) {
  const editando = !!f;
  abrirModal(`
    <div class="modal">
      <h2>${editando ? "Editar" : "Nova"} fonte de renda</h2>
      <div id="erro-formulario"></div>
      <form id="form-fonte" novalidate>
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
      diaRecebimento: (() => { const n = Number(document.getElementById("campo-fonte-dia").value); return n >= 1 && n <= 31 ? Math.round(n) : null; })(),
      contaId: document.getElementById("campo-fonte-conta").value || null,
      fim: document.getElementById("campo-fonte-fim").value || null,
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
