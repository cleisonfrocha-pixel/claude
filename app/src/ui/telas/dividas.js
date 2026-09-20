// Dívidas e plano de saída (§11): a central mostra saldo original e atual,
// parcelas pagas/restantes, vencimentos e o comprometimento mensal — mais
// o simulador (aporte extra, quitação antecipada), que nunca escreve na
// dívida real (CLAUDE.md). Reaproveita a fábrica de cadastro (Fase 0) com
// os hooks de item expansível (Fase 3) e de visão consolidada / interação
// no painel expandido (Fase 6).

import { criarTelaCadastro } from "./telaCadastro.js";
import { dividas, pessoas } from "../../dados/repositorios.js";
import { paraCentavos, formatarBRL } from "../../domain/dinheiro.js";
import { formatarData, hojeISO } from "../../domain/tempo.js";
import {
  calcularSaldoAtual, parcelasRestantes, dataProximoVencimento, dataEstimadaQuitacao,
  statusDivida, calcularVisaoConsolidada,
} from "../../domain/dividas.js";
import { simularAporteExtra, simularQuitacaoAntecipada } from "../../domain/simuladorDividas.js";
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
      Isto é uma simulação — nada foi alterado na dívida.
    </div>`;
}

export default criarTelaCadastro({
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
    { id: "taxaJurosMensalPct", rotulo: "Juros ao mês (%) — se conhecido", tipo: "numero", min: 0, step: 0.01 },
    { id: "emRisco", rotulo: "Em risco (renegociação incerta, credor pressionando, etc.)", tipo: "check" },
  ],
  async carregarContexto() {
    const listaPessoas = await pessoas.listar();
    return { pessoas: listaPessoas.map((p) => ({ valor: p.id, rotulo: p.dados.nome })) };
  },

  resumo(itens) {
    const hoje = hojeISO();
    const dividasComId = itens.map((i) => ({ id: i.id, ...i.dados }));
    const v = calcularVisaoConsolidada(dividasComId, hoje);
    return `
      <div class="divida-resumo">
        <div class="titulo">Visão consolidada</div>
        <div class="resumo-mes" style="margin:0;">
          <div class="resumo-item"><span>Saldo devido total</span><b class="mono valor-neg" data-valor>${formatarBRL(v.saldoTotalAtualCentavos)}</b></div>
          <div class="resumo-item"><span>Comprometimento mensal</span><b class="mono" data-valor>${formatarBRL(v.comprometimentoMensalCentavos)}</b></div>
          <div class="resumo-item"><span>Quitação estimada</span><b class="mono" data-valor>${v.dataQuitacaoTotal ? escapeHtml(formatarData(v.dataQuitacaoTotal)) : "—"}</b></div>
        </div>
        ${v.quantidadeAtrasadas > 0 ? `<div class="tela-sub" style="margin-top:10px;color:var(--danger);">${v.quantidadeAtrasadas} ${v.quantidadeAtrasadas === 1 ? "dívida atrasada" : "dívidas atrasadas"}.</div>` : ""}
        ${v.quantidadeEmRisco > 0 ? `<div class="tela-sub" style="margin-top:4px;">${v.quantidadeEmRisco} ${v.quantidadeEmRisco === 1 ? "dívida marcada" : "dívidas marcadas"} como em risco.</div>` : ""}
      </div>`;
  },

  exibir(dados, contexto) {
    const pessoa = (contexto.pessoas || []).find((p) => p.valor === dados.pessoaId);
    const hoje = hojeISO();
    const status = statusDivida(dados, hoje);
    const restantes = parcelasRestantes(dados);
    return {
      titulo: dados.nome,
      sub: `${dados.credor ? dados.credor + " · " : ""}${pessoa ? pessoa.rotulo + " · " : ""}${restantes} de ${dados.quantidadeParcelas} parcelas restantes`,
      valorDireita: formatarBRL(calcularSaldoAtual(dados)),
      tag: status !== "ativa" ? ROTULO_STATUS[status] : (dados.emRisco ? "em risco" : null),
      tagInativa: status === "quitada",
      tagClasse: status === "atrasada" ? "critico" : (dados.emRisco && status === "ativa" ? "atencao" : null),
    };
  },

  renderExtra(dados, id) {
    const saldoAtual = calcularSaldoAtual(dados);
    const total = Number(dados.quantidadeParcelas) || 0;
    const percentualPago = total > 0 ? Math.min(100, ((Number(dados.parcelasPagas) || 0) / total) * 100) : 0;
    const proximoVenc = dataProximoVencimento(dados);
    const dataQuitacao = dataEstimadaQuitacao(dados);
    return `
      <div class="tela-sub" style="margin:0 0 4px;">Pago ${dados.parcelasPagas} de ${dados.quantidadeParcelas} parcelas (${Math.round(percentualPago)}%)</div>
      <div class="barra-limite"><span style="width:${percentualPago}%"></span></div>
      <div class="fatura-linha"><span class="rotulo">Saldo original</span><b data-valor>${formatarBRL(dados.saldoOriginalCentavos)}</b></div>
      <div class="fatura-linha"><span class="rotulo">Saldo atual</span><b data-valor>${formatarBRL(saldoAtual)}</b></div>
      <div class="fatura-linha"><span class="rotulo">Parcela mensal</span><b data-valor>${formatarBRL(dados.valorParcelaCentavos)}</b></div>
      ${dados.taxaJurosMensalPct != null ? `<div class="fatura-linha"><span class="rotulo">Juros ao mês</span><b>${dados.taxaJurosMensalPct}%</b></div>` : ""}
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

  aoRenderizarExtra(dados, id, contexto, elExtra) {
    const saldoAtualCentavos = calcularSaldoAtual(dados);

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
          taxaJurosMensalPct: dados.taxaJurosMensalPct, aporteExtraCentavos,
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
          taxaJurosMensalPct: dados.taxaJurosMensalPct, valorPagamentoUnicoCentavos,
        });
        resultadoUnico.innerHTML = resultadoSimulacaoHtml(r);
      });
    }
  },
});
