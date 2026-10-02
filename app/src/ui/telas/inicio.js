// Início — uma pergunta, uma resposta: "quanto posso gastar até quando, e
// o quanto confiar nisso". Em volta, só o que ajuda a agir: UM ponto de
// atenção (o mais urgente, com os dados que o originaram), o que vence ou
// entra nos próximos 7 dias, e o que ainda falta cadastrar para o painel
// enxergar a vida inteira. Sem grade de módulos e sem carrossel: cada
// módulo já tem seu lugar na barra de navegação.

import { pessoas, contas } from "../../dados/repositorios.js";
import { assinarInicio } from "../../dados/inicioRepo.js";
import { assinarPainelDecisoes } from "../../dados/decisoesRepo.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { formatarData, competenciaLabel } from "../../domain/tempo.js";
import { escapeHtml, ajudaHtml } from "../utilitarios.js";
import { icone } from "../icones.js";
import * as privacidade from "../privacidade.js";
import { navegar } from "../navegacao.js";

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

function blocoPontoDeAtencao() {
  const achado = (estadoDecisoes?.achadosPendentes || [])[0];
  if (!achado) {
    return `<section class="inicio-bloco"><h3>Atenção</h3><p class="tela-sub" style="margin:0;">Nada pedindo atenção agora.</p></section>`;
  }
  const mais = estadoDecisoes.achadosPendentes.length - 1;
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
            <span class="inicio-data">${i.atrasado ? '<span class="tag-atrasado">Atrasado</span>' : escapeHtml(formatarData(i.data))}</span>
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
  const { caixa, confianca, proximos, retrato, horizonteDias, contasMes } = estadoInicio;
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
          <div class="home-saldo-rotulo" style="cursor:default;">Pode gastar até ${escapeHtml(formatarData(horizonteAte))} ${ajudaHtml("É o que dá pra gastar sem faltar dinheiro pra nenhuma conta até essa data: o que está em conta, mais o que vai entrar, menos o que vai sair, olhando o pior momento do caminho.")}</div>
          <div class="home-saldo-valor${negativo ? " negativo" : ""}" data-valor>${formatarBRL(seguroParaGastarCentavos)}</div>
          <div class="home-saldo-sub">${explicacao}</div>
          <div class="selo-confianca ${confianca.nivel}" title="${escapeHtml(confianca.frase)}">
            <span class="selo-simbolo">${confianca.simbolo}</span>
            <span><b>${escapeHtml(confianca.rotulo)}.</b> ${escapeHtml(confianca.frase)}${esperado}</span>
          </div>
          <div class="home-saldo-metricas">
            <div class="home-metrica"><span>Em conta hoje</span><b data-valor>${formatarBRL(saldoAtualCentavos)}</b></div>
            <div class="home-metrica"><span>Vai entrar</span><b data-valor>+${formatarBRL(entradasPrevistasCentavos || 0)}</b></div>
            <div class="home-metrica"><span>Vai sair</span><b data-valor>−${formatarBRL(comprometidoCentavos)}</b></div>
          </div>
          <div class="home-saldo-sub" style="margin-top:10px;">Saldo previsto em ${horizonteDias} dias: <b data-valor>${formatarBRL(saldoAtualCentavos + (entradasPrevistasCentavos || 0) - comprometidoCentavos)}</b> ${ajudaHtml("É o que sobra em conta no fim do período: em conta hoje, mais o que vai entrar, menos o que vai sair. O número de cima é o ponto mais baixo no caminho, por isso é menor.")}</div>
          ${saldoReservaCentavos !== 0 ? `
            <div class="home-reserva-inline"><span>Em reserva/segurança</span><b data-valor>${formatarBRL(saldoReservaCentavos)}</b></div>` : ""}
        </div>
        <button class="btn btn-primary inicio-lancar" data-lancar>${icone("adicionar", 18)} Lançar</button>
        ${blocoContasDoMes(contasMes)}
        ${blocoPontoDeAtencao()}
      </div>
      <div class="inicio-lateral">
        ${blocoProximos(proximos)}
        ${blocoRetrato(retrato)}
      </div>
    </div>`;

  container.querySelector("[data-lancar]").addEventListener("click", () => irPara({ modulo: "dinheiro", aba: "transacoes", acao: "nova-transacao" }));
  container.querySelectorAll("[data-ir-contas]").forEach((b) => b.addEventListener("click", () => irPara({ modulo: "dinheiro", aba: "apagar" })));
  container.querySelectorAll("[data-ir-plano]").forEach((b) => b.addEventListener("click", () => irPara("plano")));
  container.querySelectorAll("[data-ir-agenda]").forEach((b) => b.addEventListener("click", () => irPara("planejamento")));
  container.querySelectorAll("[data-retrato]").forEach((b) => b.addEventListener("click", () => irPara(retrato[Number(b.dataset.retrato)].destino)));
  ligarBotaoOcultar();
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
