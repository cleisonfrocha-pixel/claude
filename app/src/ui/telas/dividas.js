// Dívidas e plano de saída (§11): a central mostra saldo original e atual,
// parcelas pagas/restantes, vencimentos e o comprometimento mensal — mais
// o simulador (aporte extra, quitação antecipada), que nunca escreve na
// dívida real (CLAUDE.md). Reaproveita a fábrica de cadastro (Fase 0) com
// os hooks de item expansível (Fase 3) e de visão consolidada / interação
// no painel expandido (Fase 6).

import { barraEvolucao } from "../barraEvolucao.js";
import { resumoVisualHtml, abrirComoResolver, abrirSimuladorDeVenda } from "../dividasVisual.js";
import { panoramaDeDividas } from "../../domain/esteira.js";
import { criarTelaCadastro } from "./telaCadastro.js";
import { transacoes } from "../../dados/transacoesRepo.js";
import { dividas, pessoas, ativos } from "../../dados/repositorios.js";
import { paraCentavos, formatarBRL } from "../../domain/dinheiro.js";
import { formatarData, hojeISO, somarDias } from "../../domain/tempo.js";
import {
  calcularSaldoAtual, parcelasRestantes, dataProximoVencimento, dataEstimadaQuitacao, evolucaoDaDivida, cotacaoDeQuitacao,
  statusDivida, calcularVisaoConsolidada, taxaMensalEfetiva, classificarDivida,
} from "../../domain/dividas.js";
import { separarDividas } from "../../domain/bens.js";
import { simularAporteExtra, simularQuitacaoAntecipada } from "../../domain/simuladorDividas.js";
import { ofertaDaDivida, placarNomeLimpo, progressoDoFinanciamento, acordoDaOferta } from "../../domain/esteira.js";
import { baixarComPergunta } from "../baixaUI.js";
import * as modal from "../modal.js";
import { escapeHtml } from "../utilitarios.js";

const ROTULO_STATUS = { atrasada: "atrasada", quitada: "quitada" };

function mesesTxt(n) {
  return `${n} ${n === 1 ? "mês" : "meses"}`;
}

function resultadoSimulacaoHtml(r) {
  return `
    <div class="resumo-mes" style="margin:0;">
      <div class="resumo-item"><span>Prazo novo</span><b class="mono" data-valor>${mesesTxt(r.comAporte.meses)}</b></div>
      <div class="resumo-item"><span>Juros economizados</span><b class="mono${r.jurosEconomizadosCentavos > 0 ? " valor-pos" : ""}" data-valor>${formatarBRL(r.jurosEconomizadosCentavos)}</b></div>
      <div class="resumo-item"><span>Impacto mensal</span><b class="mono" data-valor>${r.impactoMensalCentavos > 0 ? "+" : ""}${formatarBRL(r.impactoMensalCentavos)}</b></div>
    </div>
    <div class="simulador-aviso">
      ${r.mesesEconomizados > 0 ? `${mesesTxt(r.mesesEconomizados)} a menos que o ritmo atual (${mesesTxt(r.base.meses)}).` : "Não muda o prazo em relação ao ritmo atual."}
      Isto é uma simulação. Nada foi alterado na dívida.
    </div>`;
}

/** "Fechei esse acordo": a oferta vira dívida com parcelas, que passam a aparecer em A pagar. O valor antigo fica guardado. */
function abrirFechamentoDeAcordo(id, dados) {
  const oferta = ofertaDaDivida(dados, hojeISO());
  if (!oferta) return;
  modal.abrir(`
    <div class="modal">
      <h2>Fechar acordo: ${escapeHtml(dados.nome)}</h2>
      <p class="tela-sub" style="margin-bottom:12px;">De <span data-valor>${formatarBRL(oferta.cobradoCentavos)}</span> por <b data-valor>${formatarBRL(oferta.valorCentavos)}</b>. A dívida passa a valer só isso e vira conta a pagar.</p>
      <div class="field"><label for="ac-parcelas">Em quantas vezes?</label><input type="number" id="ac-parcelas" min="1" max="60" value="1" inputmode="numeric"></div>
      <div class="field"><label for="ac-data">Dia da 1ª parcela (ou do pagamento à vista)</label><input type="date" id="ac-data" value="${hojeISO()}"></div>
      <div class="erro-form" id="ac-erro" hidden></div>
      <div class="modal-actions"><button class="btn btn-ghost" data-ac="cancelar">Cancelar</button><button class="btn btn-primary" data-ac="ok">Fechar acordo</button></div>
    </div>`);
  const raiz = document.getElementById("overlay-modal");
  raiz.querySelector('[data-ac="cancelar"]').addEventListener("click", () => modal.fechar());
  raiz.querySelector('[data-ac="ok"]').addEventListener("click", async () => {
    const parcelas = Number(raiz.querySelector("#ac-parcelas").value);
    const data = raiz.querySelector("#ac-data").value;
    const erro = raiz.querySelector("#ac-erro");
    if (!(parcelas >= 1) || !data) { erro.textContent = "Informe em quantas vezes e o dia da primeira parcela."; erro.hidden = false; return; }
    try {
      await dividas.atualizar(id, acordoDaOferta(dados, { parcelas, primeiraParcela: data }));
      modal.fechar();
    } catch (e) { erro.textContent = e.message || "Não consegui fechar o acordo."; erro.hidden = false; }
  });
}

const ddmm = (d) => formatarData(d).slice(0, 5);
const mesAno = (d) => `${d.slice(5, 7)}/${d.slice(2, 4)}`;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** Barra de evolução do financiamento ou da dívida paga com trabalho: total, já pago, já previsto e falta. */
function evolucaoHtml(dados, hoje) {
  const e = evolucaoDaDivida(dados, hoje);
  if (e.tipo === "trabalho") {
    return barraEvolucao({
      totalRotulo: "Valor da cota", totalCentavos: e.totalCentavos,
      segmentos: [
        { tipo: "pago", rotulo: "Já abatido com trabalho", centavos: e.pagoCentavos },
        { tipo: "previsto", rotulo: "Já previsto, ainda vai entrar", centavos: e.previstoCentavos, detalhe: e.unidadesPrevistas ? `${plural(e.unidadesPrevistas, "abatimento", "abatimentos")}, até ${ddmm(e.previstoAte)}` : "" },
        { tipo: "falta", rotulo: "Falta além do que já está previsto", centavos: e.depoisCentavos },
      ],
      rodape: e.faltaCentavos > 0
        ? `Falta abater <b data-valor>${formatarBRL(e.faltaCentavos)}</b>. Previsão, não garantia: depende de o trabalho seguir até lá.`
        : "Cota toda abatida.",
    });
  }
  const prox = dataProximoVencimento(dados);
  return barraEvolucao({
    totalRotulo: `Valor total (${e.unidadesTotal} parcelas)`, totalCentavos: e.totalCentavos,
    segmentos: [
      { tipo: "pago", rotulo: "Já pago", centavos: e.pagoCentavos, detalhe: `${e.unidadesPagas} de ${e.unidadesTotal} parcelas` },
      { tipo: "falta", rotulo: "Falta pagar", centavos: e.faltaCentavos, detalhe: `${plural(e.unidadesRestantes, "parcela", "parcelas")}${e.quitaEm ? `, quita em ${formatarData(e.quitaEm)}` : ""}` },
    ],
    rodape: `${prox ? `Próxima: parcela ${e.unidadesPagas + 1}, dia ${formatarData(prox).slice(0, 5)}. ` : ""}As próximas ${e.unidadesPrevistas} parcelas (<span data-valor>${formatarBRL(e.previstoCentavos)}</span>) já estão no seu plano de caixa.`,
  });
}

const tela = criarTelaCadastro({
  repo: dividas,
  titulo: "Dívidas",
  subtitulo: "Cada dívida, a pressão que ela exerce no mês, e o que aconteceria se você pagasse mais.",
  rotuloNovo: "Nova dívida",
  singular: "Dívida",
  generoFeminino: true,
  campos: [
    { id: "nome", rotulo: "Nome da dívida", tipo: "texto", obrigatorio: true, placeholder: "Ex.: Financiamento do carro" },
    { id: "credor", rotulo: "Credor", tipo: "texto", placeholder: "Ex.: Banco XPTO" },
    { id: "pessoaId", rotulo: "Responsável", tipo: "select-contexto", origemContexto: "pessoas", obrigatorio: true, permiteVazio: true, rotuloVazio: "Selecione uma pessoa" },
    { id: "saldoOriginalCentavos", rotulo: "Saldo original", tipo: "moeda" },
    { id: "valorParcelaCentavos", rotulo: "Valor da parcela", tipo: "moeda" },
    { id: "quantidadeParcelas", rotulo: "Quantidade de parcelas", tipo: "numero", min: 1, obrigatorio: true },
    { id: "parcelasPagas", rotulo: "Parcelas já pagas", tipo: "numero", min: 0, obrigatorio: true, padrao: 0 },
    { id: "dataInicio", rotulo: "Vencimento da 1ª parcela", tipo: "data", obrigatorio: true },
    { id: "taxaJurosMensalPct", rotulo: "Juros ao mês, % (opcional)", tipo: "numero", min: 0, step: 0.01 },
    { id: "tipo", rotulo: "Como tratar", tipo: "select", opcoes: [
      { valor: "", rotulo: "Automático (parcelado em dia é financiamento)" },
      { valor: "financiamento", rotulo: "Financiamento: bem que estou pagando em dia" },
      { valor: "divida", rotulo: "Dívida: preciso resolver" },
    ] },
    { id: "prioridadePagamento", rotulo: "Prioridade de pagamento (opcional): 1 paga primeiro se faltar dinheiro pro mês", tipo: "numero", min: 1, step: 1 },
    { id: "valorComJurosCentavos", rotulo: "Valor cobrado hoje, com juros (opcional)", tipo: "moeda" },
    { id: "ofertaValorCentavos", rotulo: "Oferta de quitação: valor (opcional)", tipo: "moeda" },
    { id: "ofertaOrigem", rotulo: "Onde veio a oferta", tipo: "texto", placeholder: "Ex.: Serasa Limpa Nome" },
    { id: "ofertaValidade", rotulo: "Validade da oferta (deixe vazio se não souber)", tipo: "data" },
    { id: "protestada", rotulo: "Tem protesto em cartório", tipo: "check" },
    { id: "credorCnpj", rotulo: "CNPJ do credor (opcional)", tipo: "texto" },
    { id: "cartorio", rotulo: "Cartório do protesto (opcional)", tipo: "texto" },
    { id: "bloqueio", rotulo: "O que ela trava (opcional)", tipo: "texto", placeholder: "Ex.: luz do galpão cortada" },
    { id: "emRisco", rotulo: "Em risco (renegociação incerta, credor pressionando, etc.)", tipo: "check" },
    { id: "negativada", rotulo: "Nome negativado (Serasa/SPC). Sem acordo ainda? Deixe a parcela em 0,00", tipo: "check" },
  ],
  async carregarContexto() {
    const [listaPessoas, listaAtivos, listaTransacoes] = await Promise.all([pessoas.listar(), ativos.listar(), transacoes.listar()]);
    return { pessoas: listaPessoas.map((p) => ({ valor: p.id, rotulo: p.dados.nome })), ativos: listaAtivos.map((a) => ({ id: a.id, ...a.dados })), transacoes: listaTransacoes.map((t) => ({ id: t.id, ...t.dados })) };
  },

  secoes(itens) {
    const d = separarDividas(itens.map((i) => ({ id: i.id, ...i.dados })), hojeISO());
    const ids = (l) => l.map((x) => x.id);
    return [
      ...(d.problemas.length ? [{ titulo: "Dívidas pra resolver", sub: `<span data-valor>${formatarBRL(d.totalProblemasCentavos)}</span> atrasados, negativados ou sem acordo`, ids: ids(d.problemas) }] : []),
      { titulo: "Financiamentos em dia", sub: d.financiamentos.length ? `<span data-valor>${formatarBRL(d.parcelasFinanciamentosCentavos)}</span> por mês, pagos certinho` : "", ids: ids(d.financiamentos) },
      ...(d.trabalho.length ? [{ titulo: "Pagas com trabalho", sub: `<span data-valor>${formatarBRL(d.totalTrabalhoCentavos)}</span> a abater, sem sair dinheiro do bolso`, ids: ids(d.trabalho) }] : []),
      ...(d.quitadas.length ? [{ titulo: "Quitadas", ids: ids(d.quitadas) }] : []),
    ];
  },

  resumo(itens, contexto) {
    const hoje = hojeISO();
    const todas = itens.map((i) => ({ id: i.id, ...i.dados }));
    const pessoaNome = (id) => (contexto?.pessoas || []).find((p) => p.valor === id)?.rotulo || "";
    return resumoVisualHtml(panoramaDeDividas(todas, hoje), pessoaNome);
  },

  exibir(dados, contexto) {
    const pessoa = (contexto.pessoas || []).find((p) => p.valor === dados.pessoaId);
    const hoje = hojeISO();
    const status = statusDivida(dados, hoje);
    const restantes = parcelasRestantes(dados);
    const semAcordo = !(Number(dados.valorParcelaCentavos) > 0);
    const negativadaAtiva = dados.negativada && status !== "quitada";
    const financiamento = classificarDivida(dados, hoje) === "financiamento";
    const oferta = ofertaDaDivida(dados, hoje);
    if (dados.pagaComTrabalho) {
      const zera = dataEstimadaQuitacao(dados);
      return {
        titulo: dados.nome,
        sub: `${dados.credor ? dados.credor + " · " : ""}paga com trabalho, não sai dinheiro${dados.abatimentoMensalCentavos ? ` · abate ${formatarBRL(dados.abatimentoMensalCentavos)} por mês${dados.abatimentoAte ? " até " + dados.abatimentoAte.slice(5, 7) + "/" + dados.abatimentoAte.slice(2, 4) : ""}` : ""}${zera ? ` · zera em ${formatarData(zera)}` : ""}`,
        valorDireita: formatarBRL(calcularSaldoAtual(dados, hoje)),
        evolucaoHtml: evolucaoHtml(dados, hoje),
        tag: status === "quitada" ? "quitada" : "sem caixa",
        tagClasse: status === "quitada" ? null : "ok",
        tagInativa: status === "quitada",
      };
    }
    if (financiamento) {
      const quit = dataEstimadaQuitacao(dados);
      const prog = progressoDoFinanciamento(dados, null, hoje);
      const prox = dataProximoVencimento(dados);
      const numProx = prog.pagas + 1;
      const venceLogo = prox && prox <= somarDias(hoje, 15);
      return {
        titulo: dados.nome,
        sub: `${dados.credor ? dados.credor + " · " : ""}${prog.pagas} de ${prog.total} parcelas pagas${prox ? ` · próxima: parcela ${numProx}, dia ${formatarData(prox).slice(0, 5)}` : ""}${quit ? ` · quita em ${formatarData(quit)}` : ""}`,
        valorDireita: `${formatarBRL(dados.valorParcelaCentavos)}/mês`,
        tag: prox && prox < hoje ? "atrasada" : "em dia",
        tagClasse: prox && prox < hoje ? "critico" : "ok",
        evolucaoHtml: evolucaoHtml(dados, hoje),
        acoesExtras: [{ id: "vender", rotulo: "E se eu vender?" }],
        acaoPrimaria: venceLogo || (prox && prox < hoje) ? `Paguei a parcela ${numProx}` : null,
      };
    }
    return {
      titulo: dados.nome,
      sub: `${dados.credor ? dados.credor + " · " : ""}${pessoa ? pessoa.rotulo + " · " : ""}${oferta && !oferta.vencida && semAcordo ? `de ${formatarBRL(oferta.cobradoCentavos)} por ${formatarBRL(oferta.valorCentavos)}, economiza ${formatarBRL(oferta.economiaCentavos)}` : semAcordo ? "sem acordo" : `${restantes} de ${dados.quantidadeParcelas} parcelas restantes`}${dados.prioridadePagamento != null ? ` · prioridade ${dados.prioridadePagamento}` : ""}`,
      valorDireita: formatarBRL(calcularSaldoAtual(dados)),
      acoesExtras: status !== "quitada" ? [{ id: "resolver", rotulo: oferta && !oferta.vencida ? "Como resolver" : "Como negociar" }] : [],
      tag: oferta && !oferta.vencida && status !== "quitada" ? `oferta −${oferta.descontoPct}%` : negativadaAtiva ? "negativada" : (status !== "ativa" ? ROTULO_STATUS[status] : (dados.emRisco ? "em risco" : null)),
      tagInativa: status === "quitada",
      tagClasse: oferta && !oferta.vencida && status !== "quitada" ? "ok" : negativadaAtiva || status === "atrasada" ? "critico" : (dados.emRisco && status === "ativa" ? "atencao" : null),
    };
  },

  renderExtra(dados, id, contexto) {
    const saldoAtual = calcularSaldoAtual(dados);
    if (dados.pagaComTrabalho) {
      const zera = dataEstimadaQuitacao(dados);
      return `
        <div class="tela-sub" style="margin:0 0 10px;">Esta dívida é paga com trabalho, não com dinheiro: nada sai da sua conta e nada entra no caixa. O saldo cai a cada abatimento.</div>
        <div class="fatura-linha"><span class="rotulo">Valor da cota</span><b data-valor>${formatarBRL(dados.saldoOriginalCentavos)}</b></div>
        <div class="fatura-linha"><span class="rotulo">Falta abater hoje</span><b data-valor>${formatarBRL(saldoAtual)}</b></div>
        <div class="fatura-linha"><span class="rotulo">Abatimento por mês<small>no dia ${dados.abatimentoDia || 24}${dados.abatimentoAte ? ", até " + mesAno(dados.abatimentoAte + "-01") : ""}</small></span><b data-valor>${formatarBRL(dados.abatimentoMensalCentavos)}</b></div>
        ${(dados.abatimentosUnicos || []).map((u) => `<div class="fatura-linha"><span class="rotulo">Abatimento avulso<small>${escapeHtml(u.nota || "")} · ${escapeHtml(formatarData(u.data))}</small></span><b data-valor>${formatarBRL(u.valorCentavos)}</b></div>`).join("")}
        ${zera ? `<div class="fatura-linha"><span class="rotulo">Zera em</span><b>${escapeHtml(formatarData(zera))}</b></div>` : ""}`;
    }
    const oferta = ofertaDaDivida(dados, hojeISO());
    const bem = (contexto?.ativos || []).find((a) => a.dividaId === id || a.id === dados.bemId);
    const prog = classificarDivida(dados, hojeISO()) === "financiamento" ? progressoDoFinanciamento(dados, bem, hojeISO()) : null;
    const blocoOferta = oferta ? `
      <div class="oferta-bloco" style="margin:0 0 12px;padding:10px 12px;border-radius:12px;background:var(--surface-2,rgba(124,58,237,.10));">
        <div class="fatura-linha"><span class="rotulo">Valor de origem</span><b data-valor>${formatarBRL(oferta.originalCentavos)}</b></div>
        <div class="fatura-linha"><span class="rotulo">Cobrado hoje, com juros</span><b data-valor>${formatarBRL(oferta.cobradoCentavos)}</b></div>
        <div class="fatura-linha"><span class="rotulo">Oferta${oferta.origem ? ` (${escapeHtml(oferta.origem)})` : ""}</span><b class="valor-pos" data-valor>${formatarBRL(oferta.valorCentavos)} · −${oferta.descontoPct}%</b></div>
        <div class="fatura-linha"><span class="rotulo">Você economiza</span><b class="valor-pos" data-valor>${formatarBRL(oferta.economiaCentavos)}</b></div>
        ${!oferta.vencida ? `<button class="btn btn-primary btn-sm" type="button" data-acao="fechar-acordo" style="margin-top:8px;width:100%;">Fechei esse acordo: virar conta a pagar</button>` : ""}
        <div class="tela-sub" style="margin:6px 0 0;">${oferta.vencida ? "Oferta vencida em " + escapeHtml(formatarData(oferta.validade)) : oferta.validade ? "Vale até " + escapeHtml(formatarData(oferta.validade)) : "Sem prazo informado"}.</div>
      </div>` : "";
    const blocoProgresso = prog ? `
      ${prog.proximoMarco ? `<div class="tela-sub" style="margin:0 0 6px;">Faltam ${prog.parcelasAteOProximoMarco} parcelas para chegar a ${prog.proximoMarco}% pago.</div>` : ""}
      ${prog.valorDoBemCentavos ? `<div class="tela-sub" style="margin:6px 0 10px;opacity:.75;">Vale cerca de <span data-valor>${formatarBRL(prog.valorDoBemCentavos)}</span> (avaliado em ${escapeHtml(formatarData(prog.avaliadoEm))}${prog.avaliacaoVelha ? ", já faz tempo: atualize" : ""}).</div>` : ""}` : "";
    const total = Number(dados.quantidadeParcelas) || 0;
    const percentualPago = total > 0 ? Math.min(100, ((Number(dados.parcelasPagas) || 0) / total) * 100) : 0;
    const proximoVenc = dataProximoVencimento(dados);
    const dataQuitacao = dataEstimadaQuitacao(dados);
    const semAcordo = !(Number(dados.valorParcelaCentavos) > 0);
    return `
      ${blocoOferta}
      ${prog ? blocoProgresso : ""}
      ${prog ? "" : semAcordo
        ? `<div class="tela-sub" style="margin:0 0 10px;">Sem acordo: o saldo não diminui sozinho. Quando fechar um acordo, edite a dívida com a parcela e o número de parcelas combinados.</div>`
        : `<div class="tela-sub" style="margin:0 0 4px;">Pago ${dados.parcelasPagas} de ${dados.quantidadeParcelas} parcelas (${Math.round(percentualPago)}%)</div>
      <div class="barra-limite"><span style="width:${percentualPago}%"></span></div>`}
      <div class="fatura-linha"><span class="rotulo">Saldo original</span><b data-valor>${formatarBRL(dados.saldoOriginalCentavos)}</b></div>
      <div class="fatura-linha"><span class="rotulo">${classificarDivida(dados, hojeISO()) === "financiamento" ? "Falta pagar em parcelas" : "Saldo atual"}</span><b${classificarDivida(dados, hojeISO()) === "financiamento" ? ' class="valor-neutro"' : ""} data-valor>${formatarBRL(saldoAtual)}</b></div>
      <div class="fatura-linha"><span class="rotulo">Parcela mensal</span><b data-valor>${formatarBRL(dados.valorParcelaCentavos)}</b></div>
      ${dados.taxaJurosMensalPct != null
        ? `<div class="fatura-linha"><span class="rotulo">Juros ao mês</span><b>${String(dados.taxaJurosMensalPct).replace(".", ",")}%</b></div>`
        : Number(dados.valorParcelaCentavos) > 0 && taxaMensalEfetiva(dados) > 0
          ? `<div class="fatura-linha"><span class="rotulo">Juros ao mês<small>calculado pela parcela e pelo prazo</small></span><b>${(taxaMensalEfetiva(dados) * 100).toFixed(2).replace(".", ",")}%</b></div>` : ""}
      ${proximoVenc ? `<div class="fatura-linha"><span class="rotulo">Próximo vencimento</span><b>${escapeHtml(formatarData(proximoVenc))}</b></div>` : ""}
      ${dataQuitacao ? `<div class="fatura-linha"><span class="rotulo">Quitação estimada</span><b>${escapeHtml(formatarData(dataQuitacao))}</b></div>` : ""}

      <div class="simulador-bloco">
        <div class="simulador-titulo">Simular aporte extra mensal</div>
        <div class="simulador-linha">
          <div class="field"><label for="sim-aporte-${id}">Quanto a mais por mês</label>
            <input type="text" inputmode="decimal" id="sim-aporte-${id}" data-campo="aporte" placeholder="0,00"></div>
          <button class="btn btn-ghost btn-sm" type="button" data-acao="simular-aporte">Simular</button>
        </div>
        <div class="simulador-resultado" data-resultado="aporte"></div>

        <div class="simulador-titulo" style="margin-top:16px;">Simular quitação antecipada</div>
        <div class="simulador-linha">
          <div class="field"><label for="sim-unico-${id}">Pagamento único hoje</label>
            <input type="text" inputmode="decimal" id="sim-unico-${id}" data-campo="unico" placeholder="0,00"></div>
          <button class="btn btn-ghost btn-sm" type="button" data-acao="simular-unico">Simular</button>
        </div>
        <div class="simulador-resultado" data-resultado="unico"></div>
      </div>
    `;
  },

  async aoAcaoPrimaria(item) {
    const d = item.dados;
    const prox = dataProximoVencimento(d);
    if (!prox) return;
    const hoje = hojeISO();
    const numero = (Number(d.parcelasPagas) || 0) + 1;
    await baixarComPergunta({
      tipo: "evento",
      evento: { tipo: "despesa", data: prox < hoje ? hoje : prox, vencimento: prox, atrasado: prox < hoje, valorCentavos: Number(d.valorParcelaCentavos) || 0, descricao: `Parcela ${numero}/${d.quantidadeParcelas} · ${d.nome}`, origem: { tipo: "divida", id: item.id }, virtual: true },
      descricao: `Parcela ${numero}/${d.quantidadeParcelas} · ${d.nome}`, valorCentavos: Number(d.valorParcelaCentavos) || 0, origem: { tipo: "divida", id: item.id },
    }, "despesa");
  },

  async aoAcaoExtra(acao, item, contexto) {
    const dados = { id: item.id, ...item.dados };
    const hoje = hojeISO();
    if (acao === "resolver") {
      const lista = await dividas.listar();
      return abrirResolver(dados, lista.map((i) => ({ id: i.id, ...i.dados })), contexto.pessoas || []);
    }
    if (acao === "vender") {
      const bem = (contexto.ativos || []).find((a) => a.dividaId === item.id || a.id === dados.bemId);
      if (!bem) return;
      const prog = progressoDoFinanciamento(dados, bem, hoje);
      abrirSimuladorDeVenda({ nome: bem.nome, valorMercadoCentavos: Number(bem.valorAtualCentavos) || 0, avaliadoEm: bem.dataAvaliacao, cotacao: cotacaoDeQuitacao(dados, hoje, contexto.transacoes), pagoCentavos: prog.jaPagoCentavos, parcelasPagas: prog.pagas, parcelasTotal: prog.total, credor: dados.credor || "o banco" });
    }
  },

  aoRenderizarExtra(dados, id, contexto, elExtra) {
    const saldoAtualCentavos = calcularSaldoAtual(dados);

    const btnAcordo = elExtra.querySelector('[data-acao="fechar-acordo"]');
    if (btnAcordo) btnAcordo.addEventListener("click", () => abrirFechamentoDeAcordo(id, dados));

    const btnAporte = elExtra.querySelector('[data-acao="simular-aporte"]');
    const inputAporte = elExtra.querySelector('[data-campo="aporte"]');
    const resultadoAporte = elExtra.querySelector('[data-resultado="aporte"]');
    if (btnAporte) {
      btnAporte.addEventListener("click", () => {
        const aporteExtraCentavos = paraCentavos(inputAporte.value);
        if (!aporteExtraCentavos || aporteExtraCentavos <= 0) {
          resultadoAporte.innerHTML = `<div class="erro-form">Informe um valor maior que zero.</div>`;
          return;
        }
        const r = simularAporteExtra({
          saldoAtualCentavos, valorParcelaCentavos: dados.valorParcelaCentavos,
          taxaJurosMensalPct: taxaMensalEfetiva(dados) * 100, aporteExtraCentavos,
        });
        resultadoAporte.innerHTML = resultadoSimulacaoHtml(r);
      });
    }

    const btnUnico = elExtra.querySelector('[data-acao="simular-unico"]');
    const inputUnico = elExtra.querySelector('[data-campo="unico"]');
    const resultadoUnico = elExtra.querySelector('[data-resultado="unico"]');
    if (btnUnico) {
      btnUnico.addEventListener("click", () => {
        const valorPagamentoUnicoCentavos = paraCentavos(inputUnico.value);
        if (!valorPagamentoUnicoCentavos || valorPagamentoUnicoCentavos <= 0) {
          resultadoUnico.innerHTML = `<div class="erro-form">Informe um valor maior que zero.</div>`;
          return;
        }
        const r = simularQuitacaoAntecipada({
          saldoAtualCentavos, valorParcelaCentavos: dados.valorParcelaCentavos,
          taxaJurosMensalPct: taxaMensalEfetiva(dados) * 100, valorPagamentoUnicoCentavos,
        });
        resultadoUnico.innerHTML = resultadoSimulacaoHtml(r);
      });
    }
  },
});

/** Clique em "Resolver" nas ofertas do topo: abre o passo a passo da dívida. */
async function resolverPeloTopo(id) {
  const [lista, listaPessoas] = await Promise.all([dividas.listar(), pessoas.listar()]);
  const todas = lista.map((i) => ({ id: i.id, ...i.dados }));
  const dados = todas.find((d) => d.id === id);
  if (dados) abrirResolver(dados, todas, listaPessoas.map((p) => ({ valor: p.id, rotulo: p.dados.nome })));
}

function abrirResolver(dados, todas, listaPessoas) {
  const hoje = hojeISO();
  const of = ofertaDaDivida(dados, hoje);
  abrirComoResolver({
    divida: { ...dados, ofertaVigente: of && !of.vencida ? of : null, saldoCentavos: calcularSaldoAtual(dados, hoje), placar: placarNomeLimpo(todas) },
    pessoaNome: listaPessoas.find((p) => p.valor === dados.pessoaId)?.rotulo || "",
    aoFecharAcordo: () => abrirFechamentoDeAcordo(dados.id, dados),
  });
}

export default {
  ...tela,
  async montar(alvo) {
    await tela.montar(alvo);
    if (alvo.dataset.dvLigado) return;
    alvo.dataset.dvLigado = "1";
    alvo.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-resolver]");
      if (b) resolverPeloTopo(b.dataset.resolver);
    });
  },
};
