// Início — uma pergunta, uma resposta: "quanto posso gastar até quando, e
// o quanto confiar nisso". Em volta, só o que ajuda a agir: UM ponto de
// atenção (o mais urgente, com os dados que o originaram), o que vence ou
// entra nos próximos 7 dias, e o que ainda falta cadastrar para o painel
// enxergar a vida inteira. Sem grade de módulos e sem carrossel: cada
// módulo já tem seu lugar na barra de navegação.

import { pessoas, contas } from "../../dados/repositorios.js";
import { assinarInicio, simularPeloPainel } from "../../dados/inicioRepo.js";
import { ROTULO_GRUPO, GRUPOS, ROTULO_ZONA } from "../../domain/situacao.js";
import { assinarPainelDecisoes } from "../../dados/decisoesRepo.js";
import { formatarBRL, paraCentavos } from "../../domain/dinheiro.js";
import { formatarData, competenciaLabel } from "../../domain/tempo.js";
import { escapeHtml, ajudaHtml } from "../utilitarios.js";
import { icone } from "../icones.js";
import * as privacidade from "../privacidade.js";
import { navegar } from "../navegacao.js";
import { abrirAtualizarSaldo } from "../atualizarSaldo.js";

let pararInicio = null;
let pararDecisoes = null;
let estadoInicio = null;
let estadoDecisoes = null;
let container = null;

function irPara(destino) {
  navegar(typeof destino === "string" ? { modulo: destino } : destino);
}

export default {
  async montar(alvo) {
    container = alvo;
    container.innerHTML = `<div class="tela-sub" style="margin-top:18px;">Carregando…</div>`;
    const [p, c] = await Promise.all([pessoas.listar(), contas.listar()]);
    if (!p.length) return renderizarPedindo("Ainda não há nenhuma pessoa cadastrada. Comece por aí: tudo no sistema pertence a alguém.", "Cadastrar pessoas", { modulo: "configuracoes", aba: "pessoas" });
    if (!c.length) return renderizarPedindo("Ainda não há nenhuma conta cadastrada. Sem isso não dá pra saber quanto dinheiro existe.", "Cadastrar conta", { modulo: "dinheiro", aba: "contas" });

    estadoInicio = null;
    estadoDecisoes = null;
    pararInicio = assinarInicio((r) => { estadoInicio = r; renderizar(); });
    pararDecisoes = assinarPainelDecisoes((r) => { estadoDecisoes = r; renderizar(); });
  },
  desmontar() {
    if (pararInicio) { pararInicio(); pararInicio = null; }
    if (pararDecisoes) { pararDecisoes(); pararDecisoes = null; }
    estadoInicio = null;
    estadoDecisoes = null;
    container = null;
  },
};

function renderizarPedindo(texto, botao, destino) {
  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Início</h2></div></div>
    <div class="vazio">${escapeHtml(texto)}<div><button class="btn btn-primary" id="ir-pedido">${escapeHtml(botao)}</button></div></div>`;
  container.querySelector("#ir-pedido").addEventListener("click", () => irPara(destino));
}

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function blocoContasDoMes(c) {
  if (!c || !c.resumo.quantidade) return "";
  const r = c.resumo;
  const tudo = r.faltaCentavos === 0;
  return `
    <section class="inicio-bloco">
      <h3>Contas de ${escapeHtml(competenciaLabel(c.competencia).split(" ")[0].toLowerCase())}</h3>
      <div class="mes-progresso-topo"><b>${r.quantidadePagas} de ${r.quantidade}</b> <span>pagas</span><span class="mes-progresso-pct">${r.percentualPago}%</span></div>
      <div class="barra-limite ${r.quantidadeAtrasadas ? "critico" : ""}"><span style="width:${r.percentualPago}%"></span></div>
      ${r.quantidadeAtrasadas
        ? `<div class="mes-progresso-msg alerta">${r.quantidadeAtrasadas} ${r.quantidadeAtrasadas === 1 ? "conta atrasada" : "contas atrasadas"} (<span data-valor>${formatarBRL(r.atrasadasCentavos)}</span>): ${escapeHtml(c.atrasadas.map((i) => i.descricao).join(", "))}${r.quantidadeAtrasadas > c.atrasadas.length ? "…" : ""}</div>`
        : `<div class="mes-progresso-msg ${tudo ? "ok" : ""}">${tudo ? "Mês em dia: tudo pago." : `Nada atrasado. Faltam <span data-valor>${formatarBRL(r.faltaCentavos)}</span>.`}</div>`}
      <button class="btn-link" data-ir-contas>Ver as contas e dar baixa</button>
    </section>`;
}

function blocoAteAProximaEntrada(caixa) {
  const e = caixa.proximaEntrada;
  const buraco = caixa.primeiroBuraco;
  if (!e && !buraco) return "";
  const v = caixa.seguroAteAProximaEntradaCentavos;
  const linhaEntrada = e ? `
      <div class="fatura-linha"><span class="rotulo">Até a próxima entrada certa (${escapeHtml(e.descricao || "entrada")}, ${escapeHtml(formatarData(e.data).slice(0, 5))}${e.certeza && e.certeza !== "confirmado" ? ", esperada" : ""})</span><b class="${v < 0 ? "valor-neg" : ""}" data-valor>${formatarBRL(v)}</b></div>
      <div class="tela-sub" style="margin:2px 0 8px;">Entram <span data-valor>${formatarBRL(e.valorCentavos)}</span> nesse dia. Esse é o quanto dá pra gastar até lá sem faltar.</div>` : "";
  const linhaBuraco = buraco ? `
      <div class="mes-progresso-msg alerta"><b>O que quebra:</b> em ${escapeHtml(formatarData(buraco.data).slice(0, 5))} faltam <span data-valor>${formatarBRL(buraco.faltaCentavos)}</span>. ${buraco.causas.length ? "Pesam nesse dia: " + escapeHtml(buraco.causas.slice(0, 3).map((c) => `${c.descricao} (${formatarBRL(c.valorCentavos)})`).join(", ")) + "." : ""}</div>` : "";
  return `<section class="inicio-bloco"><h3>Até o dinheiro entrar</h3>${linhaEntrada}${linhaBuraco}</section>`;
}

const curto = (t) => String(t || "").replace(/\s*\(.*$/, "").trim();
const COR_ZONA = { confortavel: "var(--accent)", apertado: "var(--warn)", risco: "var(--danger)" };

function blocoSituacao(sit) {
  const z = sit.zona;
  const ate = sit.ate ? `até ${formatarData(sit.ate.data).slice(0, 5)} (${escapeHtml(curto(sit.ate.descricao) || "próxima entrada")})` : "no horizonte";
  const grupos = GRUPOS.filter((g) => sit.comprometido.grupos[g].totalCentavos > 0);
  return `
    <section class="inicio-bloco">
      <h3><span style="color:${COR_ZONA[z]};">●</span> ${escapeHtml(ROTULO_ZONA[z])} ${ajudaHtml("A zona compara o ponto mais baixo que o seu caixa toca nos próximos 30 dias com o que você já precisa pagar num mês. Negativo ou abaixo de meio mês de obrigações é risco; até um mês, apertado; acima, confortável.")}</h3>
      <p class="tela-sub" style="margin:0 0 6px;color:var(--text);">${escapeHtml(sit.decisao.texto)}</p>
      <p class="tela-sub" style="margin:0 0 12px;opacity:.75;">Pior dia dos próximos ${estadoInicio?.horizonteDias || 30} dias: ${sit.diaMaisApertado ? escapeHtml(formatarData(sit.diaMaisApertado).slice(0, 5)) : "nenhum"}, com o caixa em <span data-valor>${formatarBRL(sit.menorPontoCentavos)}</span>${sit.menorPontoGarantidoCentavos !== sit.menorPontoCentavos ? ` (<span data-valor>${formatarBRL(sit.menorPontoGarantidoCentavos)}</span> contando só o confirmado)` : ""}.</p>
      <div class="home-saldo-metricas" style="margin:0 0 8px;">
        <div class="home-metrica"><span>Na conta hoje</span><b data-valor>${formatarBRL(sit.naContaCentavos)}</b></div>
        <div class="home-metrica"><span>Já tem dono ${ate}</span><b data-valor>−${formatarBRL(sit.comprometido.totalCentavos)}</b></div>
      </div>
      <button class="btn btn-ghost btn-atualizar-saldo" data-atualizar-saldo>Saldo diferente do banco? Atualizar saldo</button>
      <div class="home-saldo-metricas" style="margin:0 0 8px;">
        <div class="home-metrica"><span>Livre garantido ${ajudaHtml("Conta só entrada confirmada. É o número mais seguro.")}</span><b class="${sit.livreGarantidoCentavos < 0 ? "valor-neg" : ""}" data-valor>${formatarBRL(sit.livreGarantidoCentavos)}</b></div>
        <div class="home-metrica"><span>Livre com o provável ${ajudaHtml("Conta também a entrada provável (renda fixa que ainda não caiu). Entrada incerta nunca entra.")}</span><b class="${sit.livreProvavelCentavos < 0 ? "valor-neg" : ""}" data-valor>${formatarBRL(sit.livreProvavelCentavos)}</b></div>
      </div>
      ${grupos.length ? `<details class="inicio-detalhe"><summary>O que já tem dono</summary>
        ${grupos.map((g) => `<div class="fatura-linha"><span class="rotulo">${escapeHtml(ROTULO_GRUPO[g])}</span><b data-valor>${formatarBRL(sit.comprometido.grupos[g].totalCentavos)}</b></div>
          <div class="tela-sub" style="margin:0 0 6px;">${escapeHtml(sit.comprometido.grupos[g].itens.slice(0, 3).map((i) => i.descricao).join(", "))}${sit.comprometido.grupos[g].itens.length > 3 ? "…" : ""}</div>`).join("")}
      </details>` : ""}
    </section>`;
}

function blocoPesaAgora(pesa) {
  if (!pesa.length) return "";
  return `
    <section class="inicio-bloco">
      <h3>O que pesa agora</h3>
      <div class="inicio-lista">
        ${pesa.map((i) => `
          <div class="inicio-linha">
            <span class="inicio-data">${i.atrasado ? `<span class="tag-atrasado">Atrasado</span>` : escapeHtml(formatarData(i.vencimento || i.data).slice(0, 5))}</span>
            <span class="inicio-desc">${escapeHtml(i.descricao || "")}<small style="display:block;opacity:.7;">${escapeHtml(i.razoes.slice(0, 2).join(" · "))}</small></span>
            <b class="mono valor-neg" data-valor>−${formatarBRL(i.valorCentavos)}</b>
          </div>`).join("")}
      </div>
      <button class="btn-link" data-ir-contas>Ver todas as contas</button>
    </section>`;
}

function blocoCartoes(cartoes) {
  const lista = (cartoes || []).filter((c) => c.limiteTotalCentavos > 0 || c.proximaFatura.jaNaFaturaCentavos > 0);
  if (!lista.length) return "";
  return `
    <section class="inicio-bloco">
      <h3>Cartões ${ajudaHtml("Compra no cartão já é compromisso, mas o dinheiro só sai da conta no dia em que você paga a fatura. O limite livre nunca é somado ao seu saldo.")}</h3>
      ${lista.map((c) => `
        <div class="fatura-linha"><span class="rotulo">${escapeHtml(c.apelido)}<small>fatura ${formatarBRL(c.proximaFatura.jaNaFaturaCentavos)} · sai da conta ${escapeHtml(formatarData(c.proximaFatura.saiEm).slice(0, 5))}${c.caixaCobreAFatura ? "" : " · <span class='valor-neg'>o caixa não cobre</span>"}</small></span>
          <b data-valor>${formatarBRL(c.quantoCabeCentavos)}<small style="display:block;font-weight:400;opacity:.7;">cabe agora${c.limiteDecide ? " (limite)" : " (caixa)"}</small></b></div>`).join("")}
    </section>`;
}

function blocoPosso() {
  return `
    <section class="inicio-bloco">
      <h3>Posso gastar? ${ajudaHtml("Digite um valor e veja se cabe, se cabe no cartão ou se é melhor adiar. É só uma conta: nada é lançado.")}</h3>
      <div class="simulador-linha">
        <div class="field"><label for="posso-valor">Valor</label><input type="text" inputmode="decimal" id="posso-valor" placeholder="0,00"></div>
        <button class="btn btn-ghost btn-sm" type="button" data-posso>Ver</button>
      </div>
      <div id="posso-resultado" class="tela-sub" style="margin-top:8px;"></div>
    </section>`;
}

function textoDoVeredito(v) {
  const dm = (d) => formatarData(d).slice(0, 5);
  if (v.veredito === "cabe") return `<b class="valor-pos">Cabe.</b> O ponto mais baixo do caixa fica em <span data-valor>${formatarBRL(v.menorPontoDepoisCentavos)}</span>.`;
  if (v.veredito === "cabe_no_cartao") return `<b>Na conta, não. No cartão ${escapeHtml(v.cartaoApelido)}, sim.</b> A fatura sai da conta em ${dm(v.saiDaContaEm)} e fica coberta.${v.quebraEm ? ` Na conta, faltaria dinheiro em ${dm(v.quebraEm)}.` : ""}`;
  if (v.veredito === "adiar") return `<b>Agora faltaria dinheiro${v.quebraEm ? ` em ${dm(v.quebraEm)}` : ""}.</b> Cabe se você esperar até ${dm(v.adiarAte)}.`;
  return `<b class="valor-neg">Não cabe.</b> ${v.quebraEm ? `Faltaria dinheiro em ${dm(v.quebraEm)}. ` : ""}${escapeHtml(v.motivo || "Nem adiando dentro dos próximos 30 dias.")}`;
}

function ligarPosso() {
  const botao = container?.querySelector("[data-posso]");
  if (!botao) return;
  botao.addEventListener("click", async () => {
    const alvo = container.querySelector("#posso-resultado");
    const valor = paraCentavos(container.querySelector("#posso-valor").value);
    if (!(valor > 0)) { alvo.textContent = "Informe um valor maior que zero."; return; }
    alvo.textContent = "Calculando…";
    try { alvo.innerHTML = textoDoVeredito(await simularPeloPainel({ valorCentavos: valor })) + `<div style="opacity:.7;margin-top:4px;">Isto é uma simulação. Nada foi lançado.</div>`; }
    catch { alvo.textContent = "Não consegui simular agora."; }
  });
}

function blocoPontoDeAtencao(temPesa) {
  const achado = (estadoDecisoes?.achadosPendentes || [])[0];
  if (!achado) return "";
  const mais = estadoDecisoes.achadosPendentes.length - 1;
  // Já há "o que pesa agora" no topo: os alertas do Plano viram um atalho, não uma segunda lista.
  if (temPesa) return `<section class="inicio-bloco"><button class="btn-link" data-ir-plano>${mais + 1} ${mais === 0 ? "alerta no Plano" : "alertas no Plano"}</button></section>`;
  return `
    <section class="inicio-bloco">
      <h3>Pede atenção agora</h3>
      <button class="inicio-atencao" data-ir-plano>
        <span class="icone-caixa">${icone("alerta", 19)}</span>
        <span>
          <b>${escapeHtml(achado.titulo)}</b>
          <small>${escapeHtml(achado.acaoSugerida || "")}</small>
        </span>
      </button>
      ${mais > 0 ? `<button class="btn-link" data-ir-plano>Ver mais ${mais} no Plano</button>` : ""}
    </section>`;
}

function blocoPrazos(prazos) {
  if (!prazos || !prazos.length) return "";
  return `
    <section class="inicio-bloco">
      <h3>Datas que pesam ${ajudaHtml("São as datas do seu perfil (Configurações > Sobre nós) que mudam o plano, como a decisão da GEDI e o fim da obra.")}</h3>
      ${prazos.map((p) => `<div class="fatura-linha"><span class="rotulo">${escapeHtml(p.titulo)}<small>${escapeHtml(formatarData(p.data))}${p.nota ? " · " + escapeHtml(p.nota) : ""}</small></span><b>${p.diasAte < 0 ? "passou" : p.diasAte === 0 ? "hoje" : p.diasAte === 1 ? "amanhã" : `${p.diasAte} dias`}</b></div>`).join("")}
    </section>`;
}

function blocoProximos(proximos) {
  if (!proximos.length) {
    return `<section class="inicio-bloco"><h3>Próximos 7 dias</h3><p class="tela-sub" style="margin:0;">Nada vence nem entra nesta semana.</p></section>`;
  }
  return `
    <section class="inicio-bloco">
      <h3>Próximos 7 dias</h3>
      <div class="inicio-lista">
        ${proximos.slice(0, 8).map((i) => `
          <div class="inicio-linha">
            <span class="inicio-data">${i.atrasado ? `<span class="tag-atrasado">Atrasado</span><small class="inicio-venc">venceu ${escapeHtml(formatarData(i.vencimento || i.data).slice(0, 5))}</small>` : i.semDia ? "no mês" : escapeHtml(formatarData(i.data))}</span>
            <span class="inicio-desc">${escapeHtml(i.descricao || "")}${i.certeza && i.certeza !== "confirmado" && i.tipo === "entrada" ? " <small>(esperado)</small>" : ""}</span>
            <b class="mono ${i.tipo === "entrada" ? "valor-pos" : "valor-neg"}" data-valor>${i.tipo === "entrada" ? "+" : "−"}${formatarBRL(i.valorCentavos)}</b>
          </div>`).join("")}
      </div>
      <button class="btn-link" data-ir-agenda>Abrir a agenda</button>
    </section>`;
}

function blocoRetrato(retrato) {
  if (!retrato.length) return "";
  return `
    <section class="inicio-bloco">
      <h3>Completar seu retrato</h3>
      <p class="tela-sub" style="margin:0 0 8px;">Quanto mais o painel sabe, mais certo fica o número lá em cima.</p>
      <div class="inicio-lista">
        ${retrato.map((r, i) => `<button class="inicio-pendencia" data-retrato="${i}">${escapeHtml(r.texto)}<span>${icone("chevron", 15)}</span></button>`).join("")}
      </div>
    </section>`;
}

function renderizar() {
  if (!container || !estadoInicio) return;
  const { caixa, confianca, proximos, retrato, horizonteDias, contasMes, situacao, pesa, cartoes } = estadoInicio;
  const { saldoAtualCentavos, saldoReservaCentavos, comprometidoCentavos, entradasPrevistasCentavos, seguroParaGastarCentavos, diaMaisApertado, horizonteAte } = caixa;
  const negativo = seguroParaGastarCentavos < 0;
  const explicacao = negativo
    ? `Mesmo contando o que vai entrar, faltam <b data-valor>${formatarBRL(-seguroParaGastarCentavos)}</b> em ${escapeHtml(formatarData(diaMaisApertado))}.`
    : `É o ponto mais baixo que o saldo toca nos próximos ${horizonteDias} dias${diaMaisApertado ? `, em ${escapeHtml(formatarData(diaMaisApertado))}` : ""}. Gastando até aqui, não falta dinheiro em dia nenhum.`;
  const esperado = confianca.esperadoCentavos <= 0 ? ""
    : confianca.esperadoCentavos >= confianca.totalCentavos
      ? " Nenhum dos valores que vão entrar foi recebido ainda."
      : ` <span data-valor>${formatarBRL(confianca.esperadoCentavos)}</span> dos <span data-valor>${formatarBRL(confianca.totalCentavos)}</span> que vão entrar ainda são esperados.`;

  container.innerHTML = `
    <div class="inicio-grade">
      <div class="inicio-principal">
        <div class="home-saldo-card">
          <div class="home-saldo-topo">
            <div class="home-saudacao">${escapeHtml(saudacao())}</div>
            <div class="home-topo-acoes">
              <button class="home-topo-acao" id="botao-ocultar-home" title="Ocultar valores" aria-label="Ocultar valores"></button>
            </div>
          </div>
          <div class="home-saldo-rotulo" style="cursor:default;">Pode gastar até ${situacao.ate ? escapeHtml(formatarData(situacao.ate.data)) + " (" + escapeHtml(curto(situacao.ate.descricao) || "próxima entrada") + ")" : escapeHtml(formatarData(horizonteAte))} ${ajudaHtml("É o que dá pra gastar sem faltar dinheiro pra nenhuma conta até o dinheiro entrar de novo: o que está em conta, menos o que já tem dono, olhando o pior momento do caminho.")}</div>
          <div class="home-saldo-valor${situacao.livreProvavelCentavos < 0 ? " negativo" : ""}" data-valor>${formatarBRL(situacao.livreProvavelCentavos)}</div>
          <div class="selo-confianca ${confianca.nivel}" title="${escapeHtml(confianca.frase)}">
            <span class="selo-simbolo">${confianca.simbolo}</span>
            <span><b>${escapeHtml(confianca.rotulo)}.</b> ${escapeHtml(confianca.frase)}${esperado}</span>
          </div>
          ${saldoReservaCentavos !== 0 ? `
            <div class="home-reserva-inline"><span>Em reserva/segurança</span><b data-valor>${formatarBRL(saldoReservaCentavos)}</b></div>` : ""}
        </div>
        <button class="btn btn-primary inicio-lancar" data-lancar>${icone("adicionar", 18)} Lançar</button>
        ${blocoSituacao(situacao)}
        ${blocoPesaAgora(pesa)}
        ${blocoCartoes(cartoes)}
        ${blocoPosso()}
        ${blocoContasDoMes(contasMes)}
        ${blocoPontoDeAtencao(pesa.length > 0)}
      </div>
      <div class="inicio-lateral">
        ${blocoPrazos(estadoInicio.prazos)}
        ${blocoProximos(proximos)}
        ${blocoRetrato(retrato)}
      </div>
    </div>`;

  container.querySelector("[data-lancar]").addEventListener("click", () => irPara({ modulo: "dinheiro", aba: "transacoes", acao: "nova-transacao" }));
  container.querySelectorAll("[data-atualizar-saldo]").forEach((b) => b.addEventListener("click", abrirAtualizarSaldo));
  container.querySelectorAll("[data-ir-contas]").forEach((b) => b.addEventListener("click", () => irPara({ modulo: "dinheiro", aba: "apagar" })));
  container.querySelectorAll("[data-ir-plano]").forEach((b) => b.addEventListener("click", () => irPara("plano")));
  container.querySelectorAll("[data-ir-agenda]").forEach((b) => b.addEventListener("click", () => irPara("planejamento")));
  container.querySelectorAll("[data-retrato]").forEach((b) => b.addEventListener("click", () => irPara(retrato[Number(b.dataset.retrato)].destino)));
  ligarBotaoOcultar();
  ligarPosso();
}

function ligarBotaoOcultar() {
  const botao = container?.querySelector("#botao-ocultar-home");
  if (!botao) return;
  const desenhar = () => {
    const oculto = privacidade.estaOculto();
    botao.innerHTML = icone(oculto ? "olhoFechado" : "olho", 19);
    botao.setAttribute("title", oculto ? "Mostrar valores" : "Ocultar valores");
  };
  desenhar();
  botao.addEventListener("click", () => { privacidade.alternar(); desenhar(); });
}
