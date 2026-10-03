// Plano — diagnóstico (§8), central de decisões (§9) e plano vivo (§10).
// "Sai do modelo 'aqui estão seus dados' e entra no modelo 'aqui está o
// que merece sua atenção'" (texto do blueprint). Tudo aqui é recalculado
// ao vivo a partir dos outros painéis já existentes — só a disposição do
// usuário sobre cada achado (resolvido, ignorado, adiado, cancelado) é
// gravada (dados/decisoesRepo.js).

import { assinarPainelDecisoes, decidirAchado, reabrirDecisao } from "../../dados/decisoesRepo.js";
import { assinarPainelQualidade } from "../../dados/qualidadeRepo.js";
import { assinarPlanoGeral } from "../../dados/planoGeralRepo.js";
import { agruparAchados } from "../../domain/planoGeral.js";
import { navegar } from "../navegacao.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { formatarData, competenciaLabel } from "../../domain/tempo.js";
import { escapeHtml, ajudaHtml } from "../utilitarios.js";

const ROTULO_URGENCIA = { alta: "urgente", media: "atenção", baixa: "oportuno" };
const CLASSE_URGENCIA = { alta: "critico", media: "atencao", baixa: "" };
const ROTULO_TIPO = { problema: "Problemas", risco: "Riscos", oportunidade: "Oportunidades" };
const ROTULO_STATUS = { resolvida: "Resolvido", ignorada: "Não se aplica", adiada: "Lembrar depois", cancelada: "Descartado" };
const ROTULO_HORIZONTE = {
  agora: "Agora", estaSemana: "Esta semana", esteMes: "Este mês", em90: "90 dias", em12meses: "12 meses",
};
const NOTA_HORIZONTE_VAZIO = {
  agora: "Nada ameaçando o caixa agora.",
  estaSemana: "Nenhum gargalo previsto para esta semana.",
  esteMes: "Nenhuma pendência para fechar o mês.",
  em90: "Nenhuma oportunidade identificada nos próximos 90 dias.",
  em12meses: "Sem itens de longo prazo. Construir reserva, reduzir dívidas e começar a juntar patrimônio seguem como direção geral.",
};

let painel = null;
let qualidade = null;
let geral = null;
let pararAssinaturaGeral = null;
const gruposAbertos = new Set();
let achadosPorId = new Map();
let pararAssinatura = null;
let pararAssinaturaQualidade = null;
let container = null;
const achadosExpandidos = new Set();

export default {
  montar(alvo) {
    container = alvo;
    achadosExpandidos.clear();
    if (pararAssinatura) pararAssinatura();
    pararAssinatura = assinarPainelDecisoes((r) => {
      painel = r;
      achadosPorId = new Map(r.achadosPendentes.map((a) => [a.id, a]));
      renderizar();
    });
    if (pararAssinaturaQualidade) pararAssinaturaQualidade();
    pararAssinaturaQualidade = assinarPainelQualidade((r) => { qualidade = r; renderizar(); });
    if (pararAssinaturaGeral) pararAssinaturaGeral();
    pararAssinaturaGeral = assinarPlanoGeral((r) => { geral = r; renderizar(); });
    renderizar();
  },
  desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    if (pararAssinaturaQualidade) { pararAssinaturaQualidade(); pararAssinaturaQualidade = null; }
    if (pararAssinaturaGeral) { pararAssinaturaGeral(); pararAssinaturaGeral = null; }
    geral = null;
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
      ? `Nos próximos 30 dias, mesmo contando o que entra, faltam <span class="valor-neg" data-valor>${formatarBRL(Math.abs(d.estadoCaixa.seguroParaGastarCentavos))}</span> no dia mais apertado.`
      : `<span data-valor>${formatarBRL(d.estadoCaixa.seguroParaGastarCentavos)}</span> seguros pra gastar no dia a dia nos próximos 30 dias, contando o que entra e o que sai.`));

  linhas.push(linhaDiagnostico("Pressão das despesas fixas",
    d.pressaoFixas.totalCentavos > 0
      ? `<span data-valor>${formatarBRL(d.pressaoFixas.fixasCentavos)}</span> de <span data-valor>${formatarBRL(d.pressaoFixas.totalCentavos)}</span> do gasto do mês (${d.pressaoFixas.percentual}%) é fixo: <span data-valor>${formatarBRL(d.pressaoFixas.essencialCentavos ?? d.pressaoFixas.fixasCentavos)}</span> de essencial e <span data-valor>${formatarBRL(d.pressaoFixas.parcelasCentavos || 0)}</span> de parcelas.`
      : "Nenhuma despesa paga registrada neste mês ainda."));

  linhas.push(linhaDiagnostico("Peso das dívidas",
    d.pesoDividas.comprometimentoMensalCentavos > 0
      ? `<span data-valor>${formatarBRL(d.pesoDividas.comprometimentoMensalCentavos)}</span> por mês em parcelas${d.pesoDividas.quantidadeAtrasadas > 0 ? `, ${d.pesoDividas.quantidadeAtrasadas} ${d.pesoDividas.quantidadeAtrasadas === 1 ? "atrasada" : "atrasadas"}` : ""}${d.pesoDividas.quantidadeNegativadas > 0 ? `; ${d.pesoDividas.quantidadeNegativadas} no Serasa sem parcela combinada` : ""}.`
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
      d.foraDoPadrao.map((f) => `${escapeHtml(f.nomeCategoria || "Sem categoria")}: <span data-valor>${formatarBRL(f.valorCentavos)}</span>, ${f.percentualAcima}% acima da média dos meses anteriores (<span data-valor>${formatarBRL(f.mediaCentavos)}</span>)`).join("; ") + "."));
  }

  linhas.push(linhaDiagnostico("Reserva financeira",
    d.reserva.temReserva
      ? `<span data-valor>${formatarBRL(d.reserva.saldoReservaCentavos)}</span> guardados em conta de reserva.`
      : "Nenhuma conta marcada como reserva."));

  linhas.push(linhaDiagnostico("Patrimônio líquido",
    `<b class="mono${d.patrimonioLiquido.liquidoCentavos < 0 ? " valor-neg" : ""}" data-valor>${formatarBRL(d.patrimonioLiquido.liquidoCentavos)}</b>: <span data-valor>${formatarBRL(d.patrimonioLiquido.ativosCentavos)}</span> em ativos, <span data-valor>${formatarBRL(d.patrimonioLiquido.passivosCentavos)}</span> em dívidas e parcelas.`));

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
        <button class="btn-mini${aberto ? " ativo" : ""}" data-acao="expandir" aria-expanded="${aberto}">${aberto ? "Fechar" : "De onde veio"}</button>
      </div>
      <div class="achado-titulo">${escapeHtml(a.titulo)}</div>
      <div class="achado-acao-sugerida">${escapeHtml(a.acaoSugerida)}${a.prazo ? ` · prazo ${escapeHtml(formatarData(a.prazo))}` : ""}</div>
      ${aberto ? `<div class="item-extra" style="margin:8px 0;">${painelLancamentos(a)}</div>` : ""}
      <div class="achado-rodape">
        ${a.impactoCentavos != null ? `<b class="mono" data-valor>${formatarBRL(a.impactoCentavos)}</b>` : "<span></span>"}
        <div class="achado-botoes">
          <button class="btn-mini" data-acao="resolvida" title="Some da lista e vai pro histórico">Já resolvi</button>
          <button class="btn-mini" data-acao="adiada" title="Some agora e volta depois">Lembrar depois</button>
          <button class="btn-mini" data-acao="ignorada" title="Não vale pra sua situação">Não se aplica</button>
        </div>
      </div>
    </div>`;
}

function cartaoRevisao(c) {
  if (!c.grupo) return cartaoAchado(c.achado);
  const aberto = gruposAbertos.has(c.chave);
  return `
    <div class="achado-card achado-grupo" data-grupo="${escapeHtml(c.chave)}">
      <div class="achado-head">
        <span class="item-tag${CLASSE_URGENCIA[c.urgencia] ? " " + CLASSE_URGENCIA[c.urgencia] : ""}">${ROTULO_URGENCIA[c.urgencia]}</span>
        <button class="btn-mini${aberto ? " ativo" : ""}" data-acao="abrir-grupo" aria-expanded="${aberto}">${aberto ? "Fechar" : "Ver todos"}</button>
      </div>
      <div class="achado-titulo">${escapeHtml(c.titulo)}</div>
      ${aberto ? c.itens.map(cartaoAchado).join("") : ""}
    </div>`;
}

function blocoOndeVoceEsta(g) {
  const a = g.agora;
  const sobra = a.sobraCentavos;
  return `
    <section class="inicio-bloco">
      <h3>Onde você está</h3>
      <div class="plano-onde">
        <div><span>Em conta hoje</span><b class="mono" data-valor>${formatarBRL(a.saldoInicialCentavos)}</b></div>
        <div><span>Renda do mês</span><b class="mono" data-valor>${formatarBRL(a.rendaConfirmadaCentavos + a.rendaProvavelCentavos)}</b>
          <small data-valor>${formatarBRL(a.rendaConfirmadaCentavos)} recebidos + ${formatarBRL(a.rendaProvavelCentavos)} esperados</small></div>
        <div><span>Gastos do mês</span><b class="mono" data-valor>${formatarBRL(a.gastoCentavos)}</b></div>
        <div><span>Parcelas de dívida</span><b class="mono" data-valor>${formatarBRL(a.parcelasCentavos)}</b></div>
      </div>
      <div class="plano-sobra ${sobra < 0 ? "negativa" : ""}">
        <span>${sobra < 0 ? "Falta no mês" : "Sobra no mês"} ${ajudaHtml("Renda do mês (recebida e esperada) menos todos os gastos do mês e as parcelas de dívida. Renda incerta não entra na conta.")}</span>
        <b class="mono" data-valor>${formatarBRL(Math.abs(sobra))}</b>
      </div>
      ${a.rendaIncertaCentavos > 0 ? `<p class="tela-sub" style="margin:8px 0 0;"><span data-valor>${formatarBRL(a.rendaIncertaCentavos)}</span> de renda incerta ficou de fora da conta.</p>` : ""}
    </section>`;
}

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesCurto = (c) => `${MES_CURTO[Number(c.slice(5, 7)) - 1]}/${c.slice(2, 4)}`;
const DESTINO_MARCO = { recorrencia: { modulo: "dinheiro", aba: "recorrencias" }, fonteRenda: { modulo: "dinheiro", aba: "renda" }, divida: { modulo: "dividas" } };

function cartaoVemAi(mapa) {
  if (!mapa.marcos.length) return "";
  const meses = mapa.linhas.filter((l) => !l.atual);
  const pior = meses.reduce((m, l) => (!m || l.sobraCentavos < m.sobraCentavos ? l : m), null);
  const sinal = (m) => (m.tipo === "saida_nova" || m.tipo === "entrada_acaba" ? "−" : "+");
  const classe = (m) => (m.tipo === "saida_nova" || m.tipo === "entrada_acaba" ? "valor-neg" : "valor-pos");
  return `
    <div class="mapa-buraco${pior && pior.sobraCentavos < 0 ? "" : " cabe"}">
      <div class="titulo">O que vem aí${pior && pior.sobraCentavos < 0 ? "" : ", e cabe"}</div>
      <ul class="mapa-marcos">${mapa.marcos.map((m) => `<li><b>${escapeHtml(mesCurto(m.competencia))}</b> <span class="${classe(m)}">${sinal(m)}<span data-valor>${formatarBRL(m.valorCentavos)}</span></span> ${escapeHtml(m.texto)}</li>`).join("")}</ul>
      ${pior ? `<div class="texto">Mesmo com isso, o pior mês dos próximos 12 (${escapeHtml(mesCurto(pior.competencia))}) ainda fecha com <b class="${pior.sobraCentavos < 0 ? "valor-neg" : "valor-pos"}" data-valor>${pior.sobraCentavos >= 0 ? "+" : ""}${formatarBRL(pior.sobraCentavos)}</b>, contando só renda confirmada ou provável.</div>` : ""}
    </div>`;
}

function cartaoDoBuraco(mapa) {
  const b = mapa.buraco;
  if (!b || !b.mesDaVirada) return cartaoVemAi(mapa);
  const virada = mapa.linhas.find((l) => l.competencia === b.mesDaVirada);
  const antes = mapa.linhas[mapa.linhas.indexOf(virada) - 1];
  const rotulo = competenciaLabel(b.mesDaVirada).split(" ")[0];
  const meses = b.deficitMensalCentavos > 0 && b.saldoAntesDaViradaCentavos > 0 ? Math.floor(b.saldoAntesDaViradaCentavos / b.deficitMensalCentavos) : 0;
  const marcos = virada.marcos;
  return `
    <div class="mapa-buraco">
      <div class="titulo">${escapeHtml(rotulo)} muda o jogo: o mês deixa de se pagar</div>
      <div class="texto">${antes ? `A sobra mensal vai de <b data-valor>${formatarBRL(antes.sobraCentavos)}</b> pra <b class="valor-neg" data-valor>${formatarBRL(virada.sobraCentavos)}</b>.` : `A sobra do mês fica em <b class="valor-neg" data-valor>${formatarBRL(virada.sobraCentavos)}</b>.`}
        A partir daí faltam <b data-valor>${formatarBRL(b.deficitMensalCentavos)}</b> por mês.</div>
      ${marcos.length ? `<ul class="mapa-marcos">${marcos.map((m, i) => `<li><span class="${m.tipo.startsWith("entrada_acaba") || m.tipo === "saida_nova" ? "valor-neg" : "valor-pos"}">${m.tipo === "saida_nova" || m.tipo === "entrada_acaba" ? "−" : "+"}<span data-valor>${formatarBRL(m.valorCentavos)}</span></span> ${escapeHtml(m.texto)} <button class="btn-link" data-marco="${i}">ver</button></li>`).join("")}</ul>` : ""}
      ${b.saldoAntesDaViradaCentavos != null ? `<div class="texto">Seu saldo previsto no fim de ${escapeHtml(antes ? mesCurto(antes.competencia) : "agora")} é <b data-valor>${formatarBRL(b.saldoAntesDaViradaCentavos)}</b>${meses > 0 ? `, o que cobre cerca de ${meses} ${meses === 1 ? "mês" : "meses"} nesse ritmo` : ""}.</div>` : ""}
      ${b.faltaParaAguentarCentavos > 0
        ? `<div class="texto">Pra atravessar os 12 meses sem o saldo ficar negativo ainda faltam <b class="valor-neg" data-valor>${formatarBRL(b.faltaParaAguentarCentavos)}</b>.</div>`
        : `<div class="texto">Com o que você junta até lá, o saldo aguenta os 12 meses.</div>`}
      <div class="texto"><b>Pra fechar:</b> entrar <span data-valor>${formatarBRL(b.deficitMensalCentavos)}</span> a mais por mês, cortar o mesmo valor por mês, ou juntar antes o que falta acima.</div>
    </div>`;
}

function blocoPraOndeVai(g) {
  const m = g.mapa;
  const maior = Math.max(1, ...m.linhas.map((l) => Math.abs(l.sobraCentavos)));
  return `
    <section class="inicio-bloco">
      <h3>Pra onde você vai</h3>
      <p class="tela-sub" style="margin:0 0 10px;">Saldo em conta no ritmo de hoje, só com renda confirmada ou provável.</p>
      <div class="plano-futuro">
        ${g.futuro.map((h) => `
          <div class="${h.saldoFinalSeguroCentavos < 0 ? "negativo" : ""}">
            <span>${escapeHtml(h.rotulo)}</span>
            <b class="mono" data-valor>${formatarBRL(h.saldoFinalSeguroCentavos)}</b>
            ${h.saidaCritica ? `<small>aperta em ${escapeHtml(formatarData(h.saidaCritica.data))}</small>` : ""}
          </div>`).join("")}
      </div>
      ${cartaoDoBuraco(m)}
      <h4 class="mapa-titulo">Mês a mês</h4>
      ${m.semDiaADia ? `<p class="tela-sub" style="margin:0 0 8px;">Ainda sem histórico de gasto do dia a dia (mercado, lazer, imprevistos): os meses de frente aparecem mais folgados do que a vida real. Conforme você lança, isso se corrige.</p>` : ""}
      <div class="mapa-meses">
        ${m.linhas.map((l) => `
          <div class="mapa-mes${l.sobraCentavos < 0 ? " negativo" : ""}">
            <div class="mapa-mes-topo">
              <span class="mapa-mes-nome">${escapeHtml(mesCurto(l.competencia))}${l.atual ? " <small>(resto)</small>" : ""}</span>
              <span class="mapa-barra"><i style="width:${Math.round(Math.abs(l.sobraCentavos) / maior * 100)}%"></i></span>
              <b class="mono ${l.sobraCentavos < 0 ? "valor-neg" : "valor-pos"}" data-valor>${l.sobraCentavos >= 0 ? "+" : ""}${formatarBRL(l.sobraCentavos)}</b>
            </div>
            <div class="mapa-mes-sub">${l.atual ? "só o que falta entrar e sair até o fim do mês (a Sobra no mês lá em cima olha o mês inteiro, inclusive o que já aconteceu) · " : ""}termina com <span class="mono ${l.saldoFimCentavos < 0 ? "valor-neg" : ""}" data-valor>${formatarBRL(l.saldoFimCentavos)}</span> em conta${l.entradasIncertasCentavos > 0 ? ` · <span data-valor>${formatarBRL(l.entradasIncertasCentavos)}</span> incertos fora da conta` : ""}</div>
            ${l.marcos.map((x) => `<div class="mapa-chip ${x.tipo.endsWith("acaba") && x.tipo.startsWith("saida") ? "bom" : x.tipo === "entrada_nova" ? "bom" : "ruim"}">${escapeHtml(x.texto)} · <span data-valor>${formatarBRL(x.valorCentavos)}</span></div>`).join("")}
          </div>`).join("")}
      </div>
    </section>`;
}

function blocoAlavancas(g) {
  if (!g.alavancas.length) return "";
  return `
    <section class="inicio-bloco">
      <h3>3 coisas que mudam o jogo</h3>
      ${g.alavancas.map((l, i) => `
        <div class="plano-alavanca">
          <div class="plano-alavanca-topo">
            <b>${escapeHtml(l.titulo)}</b>
            <span class="mono valor-pos" data-valor>+${formatarBRL(l.impactoMensalCentavos)}/mês</span>
          </div>
          <small>${escapeHtml(l.premissa)} Base: <span data-valor>${formatarBRL(l.baseCentavos)}</span>/mês.</small>
          <button class="btn-link" data-alavanca="${i}">Ver ${escapeHtml(l.origem.rotulo)}</button>
        </div>`).join("")}
    </section>`;
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
      <p class="tela-sub">O quanto dá pra confiar no que está sendo mostrado</p></div>
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

const secoesAbertas = new Set();

/** Bloco que abre e fecha — a tela começa curta, só com o que fazer; o
 * resto está a um toque. Lembra o que estava aberto entre um recálculo e
 * outro. */
function recolhivel(id, titulo, resumo, conteudo) {
  return `
    <details class="bloco-recolhivel" data-secao="${id}"${secoesAbertas.has(id) ? " open" : ""}>
      <summary><span class="titulo">${titulo}</span><span class="resumo">${resumo}</span></summary>
      <div class="conteudo">${conteudo}</div>
    </details>`;
}

function resumoDiagnostico(d) {
  const partes = [];
  partes.push(d.estadoCaixa.seguroParaGastarCentavos < 0 ? "caixa aperta nos próximos 30 dias" : "caixa cobre os próximos 30 dias");
  if (d.pesoDividas.comprometimentoMensalCentavos > 0) partes.push(`${formatarBRL(d.pesoDividas.comprometimentoMensalCentavos)}/mês em parcelas`);
  if (d.foraDoPadrao.length) partes.push(`${d.foraDoPadrao.length} gasto${d.foraDoPadrao.length > 1 ? "s" : ""} fora do padrão`);
  return `<span data-valor>${escapeHtml(partes.join(" · "))}</span>`;
}

function listaHorizonte(chave, achados) {
  return `
    <div class="plano-horizonte">
      <div class="plano-horizonte-titulo">${ROTULO_HORIZONTE[chave]}</div>
      ${achados.length
        ? agruparAchados(achados).map((c) => `<div class="fatura-linha"><span class="rotulo">${escapeHtml(c.titulo)}</span>${c.impactoCentavos != null && c.impactoCentavos !== 0 ? `<b data-valor>${formatarBRL(c.impactoCentavos)}</b>` : ""}</div>`).join("")
        : `<div class="plano-horizonte-vazio">${NOTA_HORIZONTE_VAZIO[chave]}</div>`}
    </div>`;
}

function renderizar() {
  if (!container) return;

  if (!painel) {
    container.innerHTML = `<p class="tela-sub">Carregando…</p>`;
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
      <div class="vazio">
        Ainda não há pessoa nem conta cadastrada. O Plano nasce dos seus dados reais: comece em Configurações → Pessoas e Dinheiro → Contas.
      </div>`;
    return;
  }

  const pendentes = painel.achadosPendentes;
  const urgentes = pendentes.filter((a) => a.urgencia === "alta").length;
  const cards = agruparAchados(pendentes);
  container.innerHTML = `
    <div class="inicio-grade">
      <div class="inicio-principal">
        ${geral ? blocoOndeVoceEsta(geral) : ""}
        ${geral ? blocoPraOndeVai(geral) : ""}
        ${geral ? blocoAlavancas(geral) : ""}
      </div>
      <div class="inicio-lateral">
        <section class="inicio-bloco">
          <h3>Revisar</h3>
          <p class="tela-sub" style="margin:0 0 10px;">${pendentes.length
            ? `${pendentes.length} ${pendentes.length === 1 ? "ponto" : "pontos"}${urgentes ? `, ${urgentes} urgente${urgentes > 1 ? "s" : ""}` : ""}. Toque em "De onde veio" pra ver os lançamentos por trás de cada um.`
            : "Nada pedindo atenção agora."}</p>
          <div id="achados-lista">
            ${cards.length ? cards.map(cartaoRevisao).join("") : `<div class="alerta-tudo-coberto">Nenhum problema, risco ou oportunidade pendente agora.</div>`}
          </div>
        </section>
      </div>
    </div>

    <button class="bloco-link" data-ir-fechamento>
      <span class="titulo">Fechamento do mês</span>
      <span class="resumo">Como o mês fechou: quanto entrou, quanto saiu e o que mudou</span>
      <span class="seta">Abrir</span>
    </button>

    ${recolhivel("prazo", "Os mesmos pontos, por prazo", "Agora, esta semana, este mês, 90 dias e 12 meses",
      ["agora", "estaSemana", "esteMes", "em90", "em12meses"].map((chave) => listaHorizonte(chave, painel.planoVivo[chave])).join(""))}

    ${recolhivel("diagnostico", "Diagnóstico completo", resumoDiagnostico(painel.diagnostico),
      `${avisoConfiabilidade(qualidade?.confiabilidade)}<div class="divida-resumo">${textoDiagnostico(painel.diagnostico)}</div>`)}

    ${qualidade ? recolhivel("qualidade", "Qualidade dos dados", `Confiabilidade ${escapeHtml(qualidade.confiabilidade.nivel)}: o quanto dá pra confiar nestes números`, blocoQualidade(qualidade)) : ""}

    ${recolhivel("historico", `Já decididos (${painel.historico.length})`, "O que você já marcou como resolvido, que não se aplica ou pra lembrar depois",
      painel.historico.length ? painel.historico.map((h) => `
        <div class="historico-item">
          <span class="rotulo">${escapeHtml(h.titulo)}</span>
          <span class="status">${ROTULO_STATUS[h.status] || h.status}</span>
          <button class="btn-mini" data-acao="reabrir" data-id="${escapeHtml(h.id)}">Reabrir</button>
        </div>`).join("") : `<div class="vazio">Nada decidido ainda.</div>`)}
  `;

  container.querySelectorAll("details[data-secao]").forEach((d) => {
    d.addEventListener("toggle", () => { if (d.open) secoesAbertas.add(d.dataset.secao); else secoesAbertas.delete(d.dataset.secao); });
  });
  ligarEventos();
}

function ligarEventos() {
  container.querySelector("[data-ir-fechamento]")?.addEventListener("click", () => navegar({ modulo: "plano", aba: "fechamento" }));
  container.querySelectorAll("[data-marco]").forEach((b) => {
    b.addEventListener("click", () => {
      const virada = geral.mapa.linhas.find((l) => l.competencia === geral.mapa.buraco?.mesDaVirada);
      const marco = virada?.marcos[Number(b.dataset.marco)];
      if (marco) navegar(DESTINO_MARCO[marco.origem.tipo] || { modulo: "dinheiro" });
    });
  });
  container.querySelectorAll("[data-alavanca]").forEach((b) => {
    b.addEventListener("click", () => navegar(geral.alavancas[Number(b.dataset.alavanca)].destino));
  });
  container.querySelectorAll("[data-grupo] > .achado-head [data-acao=\"abrir-grupo\"]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const chave = btn.closest("[data-grupo]").dataset.grupo;
      if (gruposAbertos.has(chave)) gruposAbertos.delete(chave); else gruposAbertos.add(chave);
      renderizar();
    });
  });
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


  container.querySelectorAll('[data-acao="reabrir"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      await reabrirDecisao(btn.dataset.id);
    });
  });
}
