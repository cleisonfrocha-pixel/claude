// Dívidas, parte visual e de decisão: o retrato no topo da tela, a lista de ofertas na mesa, o passo a passo
// "como resolver" de cada dívida e a conta "e se eu vender o carro?". Os números vêm de domain/esteira.js e
// domain/bens.js; aqui só vira tela. Nada aqui grava: gravar é no fluxo de acordo e no Paguei.

import { formatarBRL, paraCentavos } from "../domain/dinheiro.js";
import { formatarData, hojeISO } from "../domain/tempo.js";
import { simularVenda } from "../domain/bens.js";
import { barraEvolucao } from "./barraEvolucao.js";
import { avatarMarcaHtml } from "./avatarMarca.js";
import { escapeHtml } from "./utilitarios.js";
import { simularPeloPainel } from "../dados/inicioRepo.js";
import * as modal from "./modal.js";

const COR_GRUPO = { negativadas: "var(--danger)", atrasadas: "var(--warn)", financiamento: "var(--text-muted)", trabalho: "var(--good)" };
const LINK_SERASA = "https://www.serasa.com.br/limpa-nome-online/";

/** O topo da tela: quanto se deve de verdade, de que é feito, o nome limpo e as ofertas na mesa. */
export function resumoVisualHtml(pan, pessoaNome = () => "") {
  const p = pan.placar;
  const pctLimpo = p.total > 0 ? Math.round((p.limpas / p.total) * 100) : 0;
  const ofertas = pan.ofertas;
  return `
    <div class="dv-topo">
      <section class="dv-card dv-total">
        <div class="dv-rotulo">Você deve de verdade</div>
        <div class="dv-numero" data-valor>${formatarBRL(pan.totalRealCentavos)}</div>
        <div class="dv-sub">${pan.economiaCentavos > 0 ? `Já contando os descontos das ofertas. Sem elas seriam <span data-valor>${formatarBRL(pan.cobradoCentavos)}</span>: <b class="valor-pos">você deixa de pagar <span data-valor>${formatarBRL(pan.economiaCentavos)}</span></b>.` : "Soma do que falta pagar em todas as dívidas."}</div>
        ${barraEvolucao({ compacta: true, totalRotulo: "De que é feito", totalCentavos: pan.totalRealCentavos, segmentos: pan.grupos.map((g) => ({ tipo: "livre", cor: COR_GRUPO[g.chave], rotulo: g.rotulo, centavos: g.centavos, detalhe: `${g.qtd} ${g.qtd === 1 ? "dívida" : "dívidas"}` })) })}
      </section>
      ${p.total > 0 ? `
      <section class="dv-card">
        <div class="dv-rotulo">Nome limpo</div>
        <div class="dv-numero"><span>${p.limpas}</span> <small>de ${p.total}</small></div>
        <div class="evo-barra" role="img" aria-label="${p.limpas} de ${p.total} dívidas que sujam o nome já resolvidas"><span class="evo-seg pago" style="flex:${Math.max(p.limpas, 0)} 1 0;"></span><span class="evo-seg falta" style="flex:${Math.max(p.faltam, 0)} 1 0;"></span></div>
        <div class="dv-sub">${p.faltam ? `Faltam ${p.faltam}. Para limpar o nome inteiro: <b data-valor>${formatarBRL(p.valorQueFaltaCentavos)}</b>${pan.totalOfertasCentavos && pan.totalOfertasCentavos < p.valorQueFaltaCentavos ? "" : ""}.` : "Nome limpo."}</div>
      </section>` : ""}
    </div>
    ${ofertas.length ? `
    <section class="dv-card dv-ofertas">
      <div class="dv-rotulo">Ofertas na mesa, da que mais compensa para a que menos</div>
      <p class="dv-sub" style="margin:2px 0 8px;">Fechar todas custa <b data-valor>${formatarBRL(pan.totalOfertasCentavos)}</b> e economiza <b class="valor-pos" data-valor>${formatarBRL(pan.economiaCentavos)}</b>. Toque em Resolver para ver o passo a passo.</p>
      ${ofertas.map((o) => `
        <div class="dv-oferta">
          ${avatarMarcaHtml([o.nome, o.credor], { classe: "conta-logo" })}
          <div class="dv-oferta-corpo">
            <b>${escapeHtml(o.credor || o.nome)}</b>${pessoaNome(o.pessoaId) ? ` <small>· ${escapeHtml(pessoaNome(o.pessoaId))}</small>` : ""}
            <small class="dv-oferta-sub">de <span data-valor>${formatarBRL(o.cobradoCentavos)}</span> por <b data-valor>${formatarBRL(o.valorCentavos)}</b> · <span class="valor-pos">−${o.descontoPct}%, economiza <span data-valor>${formatarBRL(o.economiaCentavos)}</span></span>${o.validade ? ` · vale até ${escapeHtml(formatarData(o.validade).slice(0, 5))}` : ""}</small>
          </div>
          <button class="btn btn-primary btn-sm" data-resolver="${escapeHtml(o.id)}">Resolver</button>
        </div>`).join("")}
    </section>` : ""}`;
}

function textoDoCaixa(v) {
  const dm = (d) => formatarData(d).slice(0, 5);
  if (!v) return "Não consegui conferir o caixa agora.";
  if (v.veredito === "cabe") return `<b class="valor-pos">Cabe no caixa hoje.</b> O ponto mais baixo do caixa ficaria em <span data-valor>${formatarBRL(v.menorPontoDepoisCentavos)}</span>.`;
  if (v.veredito === "adiar") return `<b>Hoje apertaria${v.quebraEm ? ` (faltaria dinheiro em ${dm(v.quebraEm)})` : ""}.</b> Cabe se esperar até ${dm(v.adiarAte)}.`;
  if (v.veredito === "cabe_no_cartao") return `<b>Na conta não cabe.</b> Dívida não se paga no cartão: você só trocaria de dívida.`;
  return `<b class="valor-neg">Hoje não cabe.</b> ${v.quebraEm ? `Faltaria dinheiro em ${dm(v.quebraEm)}. ` : ""}Junte o valor antes, ou veja o parcelamento.`;
}

/** "Como resolver": a oferta, se cabe no caixa, o que acontece se pagar e o caminho para fechar. */
export async function abrirComoResolver({ divida, pessoaNome = "", aoFecharAcordo }) {
  const of = divida.ofertaVigente;
  const serasa = /serasa/i.test(of?.origem || "");
  modal.abrir(`
    <div class="modal">
      <div class="dv-modal-topo">${avatarMarcaHtml([divida.nome, divida.credor], { classe: "conta-logo" })}<div><h2 style="margin:0;">${escapeHtml(divida.credor || divida.nome)}</h2><small class="tela-sub">${pessoaNome ? escapeHtml(pessoaNome) + " · " : ""}${divida.negativada ? "nome negativado" : "dívida em aberto"}</small></div></div>
      ${of ? `<div class="dv-card" style="margin:12px 0;">
        <div class="dv-sub">Cobrado hoje <span data-valor>${formatarBRL(of.cobradoCentavos)}</span></div>
        <div class="dv-numero" data-valor>${formatarBRL(of.valorCentavos)}</div>
        <div class="dv-sub"><b class="valor-pos">−${of.descontoPct}%: economiza <span data-valor>${formatarBRL(of.economiaCentavos)}</span></b>${of.origem ? ` · oferta ${escapeHtml(of.origem)}` : ""}${of.validade ? ` · vale até ${escapeHtml(formatarData(of.validade))}` : " · sem prazo informado, confira na tela do credor"}</div>
      </div>` : `<p class="tela-sub">Sem oferta cadastrada: peça ao credor o valor de quitação e cadastre aqui em Editar.</p>`}
      <h3 class="dv-passo-titulo">Dá para pagar agora?</h3>
      <div id="dv-caixa" class="tela-sub">Conferindo o caixa…</div>
      <h3 class="dv-passo-titulo">O que muda se você pagar</h3>
      <ul class="dv-lista">
        <li>O que você deve cai de <span data-valor>${formatarBRL(divida.saldoCentavos)}</span> para <b data-valor>${formatarBRL(Math.max(0, divida.saldoCentavos - (of ? of.valorCentavos : 0)))}</b> nessa dívida.</li>
        ${divida.negativada ? `<li>Sai da lista de negativados: o nome limpo vai de ${divida.placar.limpas} para ${divida.placar.limpas + 1} de ${divida.placar.total}.</li>` : ""}
        ${of && of.economiaCentavos > 0 ? `<li>Você deixa de pagar <span data-valor>${formatarBRL(of.economiaCentavos)}</span> em juros e multa.</li>` : ""}
      </ul>
      <h3 class="dv-passo-titulo">Como fazer</h3>
      <ol class="dv-lista">
        ${serasa ? `<li>Abra o <a href="${LINK_SERASA}" target="_blank" rel="noopener noreferrer">Serasa Limpa Nome</a> com o CPF de quem deve${pessoaNome ? ` (${escapeHtml(pessoaNome)})` : ""}, escolha essa dívida e confira se o valor é o mesmo daqui.</li>
        <li>Pague no Pix (à vista) ou escolha parcelar. O acordo só vale depois do pagamento.</li>` : `<li>Peça ao credor, por escrito, o valor de quitação de hoje e até quando vale. Confira se bate com <span data-valor>${of ? formatarBRL(of.valorCentavos) : "o cadastrado"}</span>.</li>
        <li>Se não cabe à vista, pergunte o parcelamento da mesma oferta. Quanto mais parcelas, menos desconto costuma ter.</li>`}
        <li>Volte aqui e toque em <b>Fechei o acordo</b>: ele vira uma conta a pagar na data que você escolher e entra no seu caixa.</li>
        <li>Quando pagar, toque em <b>Paguei</b> em A pagar: a dívida baixa e o nome limpa no painel.</li>
      </ol>
      <h3 class="dv-passo-titulo">Quer renegociar?</h3>
      <ul class="dv-lista">
        <li>Peça o histórico da dívida e confira se juros e multa estão certos.</li>
        <li>Pergunte se há campanha de desconto maior perto do fim do mês ou do ano.</li>
        <li>Se o valor não cabe, ofereça uma entrada menor e o resto em parcelas. Anote a proposta e volte aqui: dá para cadastrar a nova oferta em Editar.</li>
      </ul>
      <div class="modal-actions" style="flex-wrap:wrap;">
        <button class="btn btn-ghost" data-dv="fechar">Fechar</button>
        ${serasa ? `<a class="btn btn-ghost" href="${LINK_SERASA}" target="_blank" rel="noopener noreferrer">Abrir o Serasa</a>` : ""}
        ${of ? `<button class="btn btn-primary" data-dv="acordo">Fechei o acordo</button>` : ""}
      </div>
    </div>`);
  const raiz = document.getElementById("overlay-modal");
  raiz.querySelector('[data-dv="fechar"]').addEventListener("click", () => modal.fechar());
  raiz.querySelector('[data-dv="acordo"]')?.addEventListener("click", () => { modal.fechar(); aoFecharAcordo?.(); });
  if (of) {
    let v = null;
    try { v = await simularPeloPainel({ valorCentavos: of.valorCentavos }); } catch { v = null; }
    const el = raiz.querySelector("#dv-caixa");
    if (el) el.innerHTML = textoDoCaixa(v);
  } else raiz.querySelector("#dv-caixa").textContent = "Sem valor de oferta para conferir.";
}

/** "E se eu vender o carro?": já abre com tudo preenchido (valor de tabela do cadastro, cotação de quitação do banco,
 * o que já foi pago) e mostra dois cenários: venda particular e venda para loja (a loja costuma pagar abaixo da tabela;
 * o desconto de 10% é uma suposição e pode ser mudado em "ajustar os números"). Nada é gravado. */
export function abrirSimuladorDeVenda({ nome, valorMercadoCentavos, avaliadoEm, cotacao, pagoCentavos = 0, parcelasPagas = 0, parcelasTotal = 0, credor = "o banco" }) {
  const campo = (c) => (c / 100).toFixed(2).replace(".", ",");
  const quitacao = cotacao?.valorCentavos || 0;
  const origemTxt = cotacao?.origem === "banco"
    ? `cotação de ${escapeHtml(credor)} de ${escapeHtml(formatarData(cotacao.em))}${cotacao.ajustadaPorParcelas ? `, menos ${cotacao.ajustadaPorParcelas} ${cotacao.ajustadaPorParcelas === 1 ? "parcela paga" : "parcelas pagas"} depois` : ""}${cotacao.velha ? ". Já tem mais de 30 dias: peça outra ao banco" : ""}`
    : "estimativa pelos juros do contrato: peça a cotação de quitação ao banco";
  modal.abrir(`
    <div class="modal">
      <h2>E se eu vender: ${escapeHtml(nome)}?</h2>
      <p class="tela-sub" style="margin-bottom:12px;">Nada é gravado. Tudo já vem preenchido com o que o painel sabe.</p>
      <div class="dv-card">
        <div class="fatura-linha"><span class="rotulo">Valor de tabela<small>do cadastro do bem, avaliado em ${avaliadoEm ? escapeHtml(formatarData(avaliadoEm)) : "data não informada"}</small></span><b data-valor>${formatarBRL(valorMercadoCentavos)}</b></div>
        <div class="fatura-linha"><span class="rotulo">Para quitar hoje<small>${origemTxt}</small></span><b data-valor>${formatarBRL(quitacao)}</b></div>
        ${cotacao?.somaDasParcelasCentavos ? `<div class="fatura-linha"><span class="rotulo">Se pagasse todas as parcelas<small>o que o contrato soma até o fim</small></span><span data-valor>${formatarBRL(cotacao.somaDasParcelasCentavos)}</span></div>` : ""}
        ${pagoCentavos > 0 ? `<div class="fatura-linha"><span class="rotulo">Você já pagou<small>${parcelasPagas} de ${parcelasTotal} parcelas: esse dinheiro não volta se vender</small></span><span data-valor>${formatarBRL(pagoCentavos)}</span></div>` : ""}
      </div>
      <div id="sv-cenarios" aria-live="polite"></div>
      <details class="inicio-detalhe" style="margin-top:12px;"><summary>Ajustar os números</summary>
        <div class="field"><label for="sv-preco">Valor de tabela</label><input type="text" inputmode="decimal" id="sv-preco" value="${campo(valorMercadoCentavos)}"></div>
        <div class="field"><label for="sv-quita">Quanto o banco pede para quitar hoje</label><input type="text" inputmode="decimal" id="sv-quita" value="${campo(quitacao)}"></div>
        <div class="field"><label for="sv-loja">Quanto abaixo da tabela a loja paga (%)</label><input type="text" inputmode="decimal" id="sv-loja" value="10"></div>
        <div class="field"><label for="sv-custos">Custos da venda (transferência, comissão)</label><input type="text" inputmode="decimal" id="sv-custos" value="0,00"></div>
      </details>
      <div class="modal-actions"><button class="btn btn-ghost" data-sv="fechar">Fechar</button></div>
    </div>`);
  const raiz = document.getElementById("overlay-modal");
  const cartao = (rotulo, preco, r) => `<div class="dv-card" style="margin-top:10px;"><div class="dv-rotulo">${rotulo}: vende por <span data-valor>${formatarBRL(preco)}</span></div>
    ${r.resultado === "sobra"
      ? `<div class="dv-numero valor-pos" data-valor>${formatarBRL(r.sobraCentavos)}</div><div class="dv-sub">Sobra no seu bolso depois de quitar o financiamento.</div>`
      : `<div class="dv-numero valor-neg" data-valor>−${formatarBRL(-r.sobraCentavos)}</div><div class="dv-sub">Você teria que pôr isso do bolso para quitar e entregar o carro. Vender agora vira prejuízo.</div>`}</div>`;
  const atualizar = () => {
    const preco = paraCentavos(raiz.querySelector("#sv-preco").value), quita = paraCentavos(raiz.querySelector("#sv-quita").value), custos = paraCentavos(raiz.querySelector("#sv-custos").value);
    const lojaPct = Math.min(60, Math.max(0, Number(String(raiz.querySelector("#sv-loja").value).replace(",", ".")) || 0));
    const precoLoja = Math.round(preco * (1 - lojaPct / 100));
    raiz.querySelector("#sv-cenarios").innerHTML = cartao("Venda particular", preco, simularVenda({ precoVendaCentavos: preco, quitacaoCentavos: quita, custosCentavos: custos })) + cartao(`Venda para loja (${lojaPct}% abaixo)`, precoLoja, simularVenda({ precoVendaCentavos: precoLoja, quitacaoCentavos: quita, custosCentavos: custos }));
  };
  ["#sv-preco", "#sv-quita", "#sv-loja", "#sv-custos"].forEach((sel) => raiz.querySelector(sel).addEventListener("input", atualizar));
  raiz.querySelector('[data-sv="fechar"]').addEventListener("click", () => modal.fechar());
  atualizar();
}
