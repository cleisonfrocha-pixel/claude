// Plano — diagnóstico (§8), central de decisões (§9) e plano vivo (§10).
// "Sai do modelo 'aqui estão seus dados' e entra no modelo 'aqui está o
// que merece sua atenção'" (texto do blueprint). Tudo aqui é recalculado
// ao vivo a partir dos outros painéis já existentes — só a disposição do
// usuário sobre cada achado (resolvido, ignorado, adiado, cancelado) é
// gravada (dados/decisoesRepo.js).

import { assinarPainelDecisoes, decidirAchado, reabrirDecisao } from "../../dados/decisoesRepo.js";
import { assinarPainelQualidade } from "../../dados/qualidadeRepo.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { formatarData } from "../../domain/tempo.js";
import { escapeHtml } from "../utilitarios.js";

const ROTULO_URGENCIA = { alta: "urgente", media: "atenção", baixa: "oportuno" };
const CLASSE_URGENCIA = { alta: "critico", media: "atencao", baixa: "" };
const ROTULO_TIPO = { problema: "Problemas", risco: "Riscos", oportunidade: "Oportunidades" };
const ROTULO_STATUS = { resolvida: "Resolvida", ignorada: "Ignorada", adiada: "Adiada", cancelada: "Cancelada" };
const ROTULO_HORIZONTE = {
  agora: "Agora", estaSemana: "Esta semana", esteMes: "Este mês", em90: "90 dias", em12meses: "12 meses",
};
const NOTA_HORIZONTE_VAZIO = {
  agora: "Nada ameaçando o caixa agora.",
  estaSemana: "Nenhum gargalo previsto para esta semana.",
  esteMes: "Nenhuma pendência para fechar o mês.",
  em90: "Nenhuma oportunidade identificada nos próximos 90 dias.",
  em12meses: "Sem itens de longo prazo. Construir reserva, reduzir passivos e iniciar patrimônio seguem como direção geral.",
};

let painel = null;
let qualidade = null;
let achadosPorId = new Map();
let pararAssinatura = null;
let pararAssinaturaQualidade = null;
let container = null;
let historicoAberto = false;
const achadosExpandidos = new Set();

export default {
  montar(alvo) {
    container = alvo;
    historicoAberto = false;
    achadosExpandidos.clear();
    if (pararAssinatura) pararAssinatura();
    pararAssinatura = assinarPainelDecisoes((r) => {
      painel = r;
      achadosPorId = new Map(r.achadosPendentes.map((a) => [a.id, a]));
      renderizar();
    });
    if (pararAssinaturaQualidade) pararAssinaturaQualidade();
    pararAssinaturaQualidade = assinarPainelQualidade((r) => { qualidade = r; renderizar(); });
    renderizar();
  },
  desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    if (pararAssinaturaQualidade) { pararAssinaturaQualidade(); pararAssinaturaQualidade = null; }
    container = null;
    painel = null;
    qualidade = null;
  },
};

function linhaDiagnostico(rotulo, texto) {
  return `<div class="diagnostico-linha"><div class="rotulo">${escapeHtml(rotulo)}</div><div class="texto">${texto}</div></div>`;
}

function textoDiagnostico(d) {
  const linhas = [];

  linhas.push(linhaDiagnostico("Estado do caixa",
    d.estadoCaixa.seguroParaGastarCentavos < 0
      ? `Negativo: falta <span class="valor-neg" data-valor>${formatarBRL(Math.abs(d.estadoCaixa.seguroParaGastarCentavos))}</span> para cobrir o que já está comprometido.`
      : `<span data-valor>${formatarBRL(d.estadoCaixa.seguroParaGastarCentavos)}</span> seguros para gastar depois do que já está comprometido.`));

  linhas.push(linhaDiagnostico("Pressão das despesas fixas",
    d.pressaoFixas.totalCentavos > 0
      ? `<span data-valor>${formatarBRL(d.pressaoFixas.fixasCentavos)}</span> de <span data-valor>${formatarBRL(d.pressaoFixas.totalCentavos)}</span> das despesas do mês (${d.pressaoFixas.percentual}%) são essenciais.`
      : "Nenhuma despesa paga registrada neste mês ainda."));

  linhas.push(linhaDiagnostico("Peso das dívidas",
    d.pesoDividas.comprometimentoMensalCentavos > 0
      ? `<span data-valor>${formatarBRL(d.pesoDividas.comprometimentoMensalCentavos)}</span> por mês em parcelas${d.pesoDividas.quantidadeAtrasadas > 0 ? `, ${d.pesoDividas.quantidadeAtrasadas} ${d.pesoDividas.quantidadeAtrasadas === 1 ? "delas atrasada" : "delas atrasadas"}` : ""}.`
      : "Nenhuma dívida ativa cadastrada."));

  linhas.push(linhaDiagnostico("Previsibilidade e concentração da receita",
    d.receita.totalCentavos > 0
      ? `<span data-valor>${formatarBRL(d.receita.totalCentavos)}</span> este mês, ${d.receita.previsibilidadePercentual}% confirmado${d.receita.quantidadeFontes > 0 ? `, ${d.receita.concentracaoPercentual}% concentrado na maior fonte (${d.receita.quantidadeFontes} ${d.receita.quantidadeFontes === 1 ? "fonte" : "fontes"})` : ""}.`
      : "Nenhuma receita registrada neste mês ainda."));

  linhas.push(linhaDiagnostico("Evolução do custo de vida",
    d.evolucaoCustoDeVida.anteriorCentavos > 0
      ? `<span data-valor>${formatarBRL(d.evolucaoCustoDeVida.atualCentavos)}</span> este mês, ${d.evolucaoCustoDeVida.variacaoCentavos >= 0 ? "alta" : "queda"} de ${Math.abs(d.evolucaoCustoDeVida.variacaoPercentual)}% sobre o mês passado.`
      : "Sem despesa paga no mês anterior para comparar."));

  if (d.foraDoPadrao.length) {
    linhas.push(linhaDiagnostico("Despesas fora do padrão",
      d.foraDoPadrao.map((f) => `categoria <span data-valor>${formatarBRL(f.valorCentavos)}</span>, ${f.percentualAcima}% acima da média dos últimos meses`).join("; ") + "."));
  }

  linhas.push(linhaDiagnostico("Reserva financeira",
    d.reserva.temReserva
      ? `<span data-valor>${formatarBRL(d.reserva.saldoReservaCentavos)}</span> guardados em conta de reserva.`
      : "Nenhuma conta marcada como reserva."));

  linhas.push(linhaDiagnostico("Patrimônio líquido",
    `<b class="mono${d.patrimonioLiquido.liquidoCentavos < 0 ? " valor-neg" : ""}" data-valor>${formatarBRL(d.patrimonioLiquido.liquidoCentavos)}</b>: <span data-valor>${formatarBRL(d.patrimonioLiquido.ativosCentavos)}</span> em ativos, <span data-valor>${formatarBRL(d.patrimonioLiquido.passivosCentavos)}</span> em passivos.`));

  linhas.push(linhaDiagnostico("Completude dos dados",
    d.completude.completo
      ? "Os dados usados neste diagnóstico estão completos."
      : escapeHtml(d.completude.pendencias.join(" "))));

  return linhas.join("");
}

/** O portão da Fase 10: abrir um achado mostra os lançamentos concretos
 * que o originaram — nunca só um número solto. Quando não há lançamento
 * individual por trás (ex.: leitura de um saldo consolidado), diz isso
 * explicitamente em vez de mostrar uma lista vazia sem explicação. */
function painelLancamentos(a) {
  const lancamentos = a.dados?.lancamentos || [];
  if (!lancamentos.length) {
    return `<div class="tela-sub" style="margin:0;">Baseado num painel consolidado, sem lançamentos individuais por trás.</div>`;
  }
  return lancamentos.map((l) => `
    <div class="fatura-linha">
      <span class="rotulo">${escapeHtml(l.descricao || "Lançamento")}${l.data ? `<small>${escapeHtml(formatarData(l.data))}</small>` : ""}</span>
      ${l.valorCentavos != null ? `<b data-valor>${formatarBRL(l.valorCentavos)}</b>` : ""}
    </div>`).join("");
}

function cartaoAchado(a) {
  const urgenciaClasse = CLASSE_URGENCIA[a.urgencia];
  const aberto = achadosExpandidos.has(a.id);
  return `
    <div class="achado-card" data-achado="${escapeHtml(a.id)}">
      <div class="achado-head">
        <span class="item-tag${urgenciaClasse ? " " + urgenciaClasse : ""}">${ROTULO_URGENCIA[a.urgencia]}</span>
        <span class="achado-origem">${escapeHtml(a.origem?.rotulo || "")}</span>
        <button class="icon-btn item-chevron${aberto ? " aberto" : ""}" data-acao="expandir" title="Ver os lançamentos que originaram este alerta" aria-label="Ver lançamentos">▾</button>
      </div>
      <div class="achado-titulo">${escapeHtml(a.titulo)}</div>
      <div class="achado-acao-sugerida">${escapeHtml(a.acaoSugerida)}${a.prazo ? ` · prazo ${escapeHtml(formatarData(a.prazo))}` : ""}</div>
      ${aberto ? `<div class="item-extra" style="margin:8px 0;">${painelLancamentos(a)}</div>` : ""}
      <div class="achado-rodape">
        ${a.impactoCentavos != null ? `<b class="mono" data-valor>${formatarBRL(a.impactoCentavos)}</b>` : "<span></span>"}
        <div class="achado-botoes">
          <button class="btn btn-ghost btn-sm" data-acao="resolvida">Resolver</button>
          <button class="btn btn-ghost btn-sm" data-acao="ignorada">Ignorar</button>
          <button class="btn btn-ghost btn-sm" data-acao="adiada">Adiar</button>
          <button class="btn btn-ghost btn-sm" data-acao="cancelada">Cancelar</button>
        </div>
      </div>
    </div>`;
}

function listaAchadosPorTipo(achados) {
  const tipos = ["problema", "risco", "oportunidade"];
  return tipos.map((tipo) => {
    const doTipo = achados.filter((a) => a.tipo === tipo);
    if (!doTipo.length) return "";
    return `
      <div class="tela-head" style="margin:18px 0 8px;"><div><h3 class="tela-titulo" style="font-size:15px;">${ROTULO_TIPO[tipo]} <span class="tela-sub" style="display:inline;">(${doTipo.length})</span></h3></div></div>
      ${doTipo.map(cartaoAchado).join("")}`;
  }).join("");
}

/** "Aviso quando uma conclusão estiver baseada em dados incompletos"
 * (§23) — amarrado direto ao bloco que faz a conclusão (o Diagnóstico),
 * não um aviso solto em outro lugar da tela. */
function avisoConfiabilidade(confiabilidade) {
  if (!confiabilidade || confiabilidade.nivel === "alta") return "";
  const resto = confiabilidade.motivos.length > 1 ? ` (+${confiabilidade.motivos.length - 1} outro${confiabilidade.motivos.length > 2 ? "s" : ""} motivo${confiabilidade.motivos.length > 2 ? "s" : ""})` : "";
  return `<div class="erro-form" style="margin-bottom:12px;">Aviso: este diagnóstico usa dados incompletos. ${escapeHtml(confiabilidade.motivos[0])}${resto}</div>`;
}

function blocoQualidade(q) {
  if (!q) return "";
  const { completude, itensAConfirmar, saldosNaoConciliados, ultimaAtualizacao, confiabilidade } = q;
  const classeNivel = confiabilidade.nivel === "alta" ? "" : confiabilidade.nivel === "media" ? " atencao" : " critico";
  return `
    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Qualidade dos dados</h3>
      <p class="tela-sub">O quanto dá pra confiar no que está sendo mostrado (§23)</p></div>
      <span class="item-tag${classeNivel}">confiabilidade ${escapeHtml(confiabilidade.nivel)}</span>
    </div>
    <div class="divida-resumo">
      <div class="diagnostico-linha">
        <div class="rotulo">Completude da vida financeira mapeada</div>
        <div class="texto">${completude.percentual}%${completude.pendencias.length ? ". " + escapeHtml(completude.pendencias.join(" ")) : ", tudo cadastrado."}</div>
      </div>
      <div class="diagnostico-linha">
        <div class="rotulo">Itens a confirmar</div>
        <div class="texto">${itensAConfirmar.length ? escapeHtml(itensAConfirmar.map((i) => i.rotulo).join(" ")) : "Nada pendente de confirmação."}</div>
      </div>
      <div class="diagnostico-linha">
        <div class="rotulo">Saldos e registros sem conferência recente</div>
        <div class="texto">${saldosNaoConciliados.length
          ? `${saldosNaoConciliados.length} ${saldosNaoConciliados.length > 1 ? "registros" : "registro"}: ${escapeHtml(saldosNaoConciliados.map((s) => s.rotulo).join(", "))}`
          : "Tudo conferido nos últimos 180 dias."}</div>
      </div>
      <div class="diagnostico-linha" style="border-bottom:none;">
        <div class="rotulo">Última atualização</div>
        <div class="texto">${ultimaAtualizacao ? escapeHtml(formatarData(ultimaAtualizacao.slice(0, 10))) : "Sem lançamento nenhum ainda."}</div>
      </div>
    </div>`;
}

function listaHorizonte(chave, achados) {
  return `
    <div class="plano-horizonte">
      <div class="plano-horizonte-titulo">${ROTULO_HORIZONTE[chave]}</div>
      ${achados.length
        ? achados.map((a) => `<div class="fatura-linha"><span class="rotulo">${escapeHtml(a.titulo)}</span>${a.impactoCentavos != null ? `<b data-valor>${formatarBRL(a.impactoCentavos)}</b>` : ""}</div>`).join("")
        : `<div class="plano-horizonte-vazio">${NOTA_HORIZONTE_VAZIO[chave]}</div>`}
    </div>`;
}

function renderizar() {
  if (!container) return;

  if (!painel) {
    container.innerHTML = `
      <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Plano</h2></div></div>
      <p class="tela-sub">Carregando…</p>`;
    return;
  }

  // Produto recém-começado (nem pessoa, nem conta cadastrada): o
  // diagnóstico inteiro é ruído — nenhum dos números diz nada ainda.
  // Mostrar isso como "tudo coberto" ou uma lista de achados vazia
  // confundiria mais do que ajudaria (achado #13 da auditoria de UX).
  const semDadosNenhum = painel.diagnostico.completude.pendencias.includes("Nenhuma pessoa cadastrada.")
    && painel.diagnostico.completude.pendencias.includes("Nenhuma conta cadastrada.");
  if (semDadosNenhum) {
    container.innerHTML = `
      <div class="tela-head" style="margin-top:0;">
        <div>
          <h2 class="tela-titulo">Plano</h2>
          <p class="tela-sub">Diagnóstico sem moralizar, o que merece sua atenção agora, e o plano que se atualiza sozinho.</p>
        </div>
      </div>
      <div class="vazio">
        Ainda não há pessoa nem conta cadastrada. O Plano nasce dos seus dados reais: comece em Configurações → Pessoas e Dinheiro → Contas.
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Plano</h2>
        <p class="tela-sub">Diagnóstico sem moralizar, o que merece sua atenção agora, e o plano que se atualiza sozinho.</p>
      </div>
    </div>

    <div class="tela-head" style="margin-top:0;"><div><h3 class="tela-titulo" style="font-size:17px;">Diagnóstico</h3>
      <p class="tela-sub">Fatos e relações observáveis nos seus dados (§8)</p></div></div>
    ${avisoConfiabilidade(qualidade?.confiabilidade)}
    <div class="divida-resumo">${textoDiagnostico(painel.diagnostico)}</div>

    ${blocoQualidade(qualidade)}

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Central de decisões</h3>
      <p class="tela-sub">O que merece sua atenção agora, priorizado por urgência e impacto (§9)</p></div></div>
    <div id="achados-lista">
      ${painel.achadosPendentes.length ? listaAchadosPorTipo(painel.achadosPendentes) : `<div class="alerta-tudo-coberto">Nenhum problema, risco ou oportunidade pendente agora.</div>`}
    </div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Histórico</h3>
      <p class="tela-sub">O que já foi resolvido, ignorado, adiado ou cancelado</p></div></div>
    <button class="btn btn-ghost btn-sm" id="btn-historico">${historicoAberto ? "Esconder" : "Mostrar"} histórico (${painel.historico.length})</button>
    <div id="historico-lista" style="margin-top:10px;${historicoAberto ? "" : "display:none;"}">
      ${painel.historico.length ? painel.historico.map((h) => `
        <div class="historico-item">
          <span class="rotulo">${escapeHtml(h.titulo)}</span>
          <span class="status">${ROTULO_STATUS[h.status] || h.status}</span>
          <button class="icon-btn" data-acao="reabrir" data-id="${escapeHtml(h.id)}" title="Reabrir" aria-label="Reabrir">↺</button>
        </div>`).join("") : `<div class="vazio">Nada no histórico ainda.</div>`}
    </div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Plano vivo</h3>
      <p class="tela-sub">Agora, esta semana, este mês, 90 dias e 12 meses. Atualizado pela realidade, não um documento estático (§10)</p></div></div>
    ${["agora", "estaSemana", "esteMes", "em90", "em12meses"].map((chave) => listaHorizonte(chave, painel.planoVivo[chave])).join("")}
  `;

  ligarEventos();
}

function ligarEventos() {
  container.querySelectorAll("[data-achado]").forEach((card) => {
    const id = card.dataset.achado;
    const a = achadosPorId.get(id);
    if (!a) return;
    const btnExpandir = card.querySelector('[data-acao="expandir"]');
    if (btnExpandir) {
      btnExpandir.addEventListener("click", () => {
        if (achadosExpandidos.has(id)) achadosExpandidos.delete(id); else achadosExpandidos.add(id);
        renderizar();
      });
    }
    card.querySelectorAll('[data-acao]:not([data-acao="expandir"])').forEach((btn) => {
      btn.addEventListener("click", async () => {
        await decidirAchado(a, btn.dataset.acao);
      });
    });
  });

  const btnHistorico = container.querySelector("#btn-historico");
  if (btnHistorico) {
    btnHistorico.addEventListener("click", () => {
      historicoAberto = !historicoAberto;
      renderizar();
    });
  }

  container.querySelectorAll('[data-acao="reabrir"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      await reabrirDecisao(btn.dataset.id);
    });
  });
}
