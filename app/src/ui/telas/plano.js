// Plano — diagnóstico (§8), central de decisões (§9) e plano vivo (§10).
// "Sai do modelo 'aqui estão seus dados' e entra no modelo 'aqui está o
// que merece sua atenção'" (texto do blueprint). Tudo aqui é recalculado
// ao vivo a partir dos outros painéis já existentes — só a disposição do
// usuário sobre cada achado (resolvido, ignorado, adiado, cancelado) é
// gravada (dados/decisoesRepo.js).

import { assinarPainelDecisoes, decidirAchado, reabrirDecisao } from "../../dados/decisoesRepo.js";
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
  em12meses: "Sem itens de longo prazo — construir reserva, reduzir passivos e iniciar patrimônio seguem como direção geral.",
};

let painel = null;
let achadosPorId = new Map();
let pararAssinatura = null;
let container = null;
let historicoAberto = false;

export default {
  montar(alvo) {
    container = alvo;
    historicoAberto = false;
    if (pararAssinatura) pararAssinatura();
    pararAssinatura = assinarPainelDecisoes((r) => {
      painel = r;
      achadosPorId = new Map(r.achadosPendentes.map((a) => [a.id, a]));
      renderizar();
    });
    renderizar();
  },
  desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    container = null;
    painel = null;
  },
};

function linhaDiagnostico(rotulo, texto) {
  return `<div class="diagnostico-linha"><div class="rotulo">${escapeHtml(rotulo)}</div><div class="texto">${texto}</div></div>`;
}

function textoDiagnostico(d) {
  const linhas = [];

  linhas.push(linhaDiagnostico("Estado do caixa",
    d.estadoCaixa.seguroParaGastarCentavos < 0
      ? `Negativo: falta ${formatarBRL(Math.abs(d.estadoCaixa.seguroParaGastarCentavos))} para cobrir o que já está comprometido.`
      : `${formatarBRL(d.estadoCaixa.seguroParaGastarCentavos)} seguros para gastar depois do que já está comprometido.`));

  linhas.push(linhaDiagnostico("Pressão das despesas fixas",
    d.pressaoFixas.totalCentavos > 0
      ? `${formatarBRL(d.pressaoFixas.fixasCentavos)} de ${formatarBRL(d.pressaoFixas.totalCentavos)} das despesas do mês (${d.pressaoFixas.percentual}%) são essenciais.`
      : "Nenhuma despesa paga registrada neste mês ainda."));

  linhas.push(linhaDiagnostico("Peso das dívidas",
    d.pesoDividas.comprometimentoMensalCentavos > 0
      ? `${formatarBRL(d.pesoDividas.comprometimentoMensalCentavos)} por mês em parcelas${d.pesoDividas.quantidadeAtrasadas > 0 ? `, ${d.pesoDividas.quantidadeAtrasadas} ${d.pesoDividas.quantidadeAtrasadas === 1 ? "delas atrasada" : "delas atrasadas"}` : ""}.`
      : "Nenhuma dívida ativa cadastrada."));

  linhas.push(linhaDiagnostico("Previsibilidade e concentração da receita",
    d.receita.totalCentavos > 0
      ? `${formatarBRL(d.receita.totalCentavos)} este mês — ${d.receita.previsibilidadePercentual}% confirmado, ${d.receita.concentracaoPercentual}% concentrado na maior fonte (${d.receita.quantidadeFontes} ${d.receita.quantidadeFontes === 1 ? "fonte" : "fontes"}).`
      : "Nenhuma receita registrada neste mês ainda."));

  linhas.push(linhaDiagnostico("Evolução do custo de vida",
    d.evolucaoCustoDeVida.anteriorCentavos > 0
      ? `${formatarBRL(d.evolucaoCustoDeVida.atualCentavos)} este mês, ${d.evolucaoCustoDeVida.variacaoCentavos >= 0 ? "alta" : "queda"} de ${Math.abs(d.evolucaoCustoDeVida.variacaoPercentual)}% sobre o mês passado.`
      : "Sem despesa paga no mês anterior para comparar."));

  if (d.foraDoPadrao.length) {
    linhas.push(linhaDiagnostico("Despesas fora do padrão",
      d.foraDoPadrao.map((f) => `categoria ${formatarBRL(f.valorCentavos)} — ${f.percentualAcima}% acima da média dos últimos meses`).join("; ") + "."));
  }

  linhas.push(linhaDiagnostico("Reserva financeira",
    d.reserva.temReserva
      ? `${formatarBRL(d.reserva.saldoReservaCentavos)} guardados em conta de reserva.`
      : "Nenhuma conta marcada como reserva."));

  linhas.push(linhaDiagnostico("Patrimônio líquido", escapeHtml(d.patrimonioLiquido.motivo)));

  linhas.push(linhaDiagnostico("Completude dos dados",
    d.completude.completo
      ? "Os dados usados neste diagnóstico estão completos."
      : escapeHtml(d.completude.pendencias.join(" "))));

  return linhas.join("");
}

function cartaoAchado(a) {
  const urgenciaClasse = CLASSE_URGENCIA[a.urgencia];
  return `
    <div class="achado-card" data-achado="${escapeHtml(a.id)}">
      <div class="achado-head">
        <span class="item-tag${urgenciaClasse ? " " + urgenciaClasse : ""}">${ROTULO_URGENCIA[a.urgencia]}</span>
        <span class="achado-origem">${escapeHtml(a.origem?.rotulo || "")}</span>
      </div>
      <div class="achado-titulo">${escapeHtml(a.titulo)}</div>
      <div class="achado-acao-sugerida">${escapeHtml(a.acaoSugerida)}${a.prazo ? ` · prazo ${escapeHtml(formatarData(a.prazo))}` : ""}</div>
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

function listaHorizonte(chave, achados) {
  return `
    <div class="plano-horizonte">
      <div class="plano-horizonte-titulo">${ROTULO_HORIZONTE[chave]}</div>
      ${achados.length
        ? achados.map((a) => `<div class="fatura-linha"><span class="rotulo">${escapeHtml(a.titulo)}</span>${a.impactoCentavos != null ? `<b>${formatarBRL(a.impactoCentavos)}</b>` : ""}</div>`).join("")
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

  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Plano</h2>
        <p class="tela-sub">Diagnóstico sem moralizar, o que merece sua atenção agora, e o plano que se atualiza sozinho.</p>
      </div>
    </div>

    <div class="tela-head" style="margin-top:0;"><div><h3 class="tela-titulo" style="font-size:17px;">Diagnóstico</h3>
      <p class="tela-sub">Fatos e relações observáveis nos seus dados — §8</p></div></div>
    <div class="divida-resumo">${textoDiagnostico(painel.diagnostico)}</div>

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Central de decisões</h3>
      <p class="tela-sub">O que merece sua atenção agora, priorizado por urgência e impacto — §9</p></div></div>
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
      <p class="tela-sub">Agora, esta semana, este mês, 90 dias e 12 meses — atualizado pela realidade, não um documento estático — §10</p></div></div>
    ${["agora", "estaSemana", "esteMes", "em90", "em12meses"].map((chave) => listaHorizonte(chave, painel.planoVivo[chave])).join("")}
  `;

  ligarEventos();
}

function ligarEventos() {
  container.querySelectorAll("[data-achado]").forEach((card) => {
    const id = card.dataset.achado;
    const a = achadosPorId.get(id);
    if (!a) return;
    card.querySelectorAll("[data-acao]").forEach((btn) => {
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
