import { criarTelaCadastro } from "./telaCadastro.js";
import { contas, pessoas } from "../../dados/repositorios.js";
import { TIPOS_CONTA } from "../../domain/esquema.js";
import { formatarBRL, paraCentavos, valorDigitadoValido } from "../../domain/dinheiro.js";
import { calcularSaldoConta } from "../../domain/caixa.js";
import { transacoes } from "../../dados/transacoesRepo.js";
import { conferirSaldo } from "../../dados/pagamentoRepo.js";
import { formatarData } from "../../domain/tempo.js";
import { escapeHtml, mostrarToast } from "../utilitarios.js";
import * as modal from "../modal.js";

/** "05/10 às 14:16" (hora em que o saldo foi informado); sem hora, só o dia. */
function quandoAtualizado(dados) {
  const d = dados.saldoConferidoEm ? new Date(dados.saldoConferidoEm) : null;
  if (d && !Number.isNaN(d.getTime())) {
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} às ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  return dados.dataSaldoInicial ? formatarData(dados.dataSaldoInicial).slice(0, 5) : "data não informada";
}

const ROTULO_TIPO = {
  corrente: "Conta corrente", poupanca: "Poupança", investimento: "Investimento",
  dinheiro: "Dinheiro em espécie", outra: "Outra",
};

export default criarTelaCadastro({
  repo: contas,
  titulo: "Contas",
  subtitulo: "Onde o dinheiro está, por instituição. A base da clareza de caixa.",
  rotuloNovo: "Nova conta",
  singular: "Conta",
  generoFeminino: true,
  async carregarContexto() {
    const [lista, trans] = await Promise.all([pessoas.listar(), transacoes.listar()]);
    return { pessoas: lista.map((p) => ({ valor: p.id, rotulo: p.dados.nome })), transacoes: trans.map((t) => t.dados) };
  },
  campos: [
    { id: "nome", rotulo: "Nome da conta", tipo: "texto", obrigatorio: true, placeholder: "Ex.: Conta principal" },
    { id: "instituicao", rotulo: "Instituição", tipo: "texto", placeholder: "Ex.: Nubank" },
    { id: "pessoaId", rotulo: "Responsável", tipo: "select-contexto", origemContexto: "pessoas", obrigatorio: true, permiteVazio: true, rotuloVazio: "Selecione uma pessoa" },
    { id: "tipo", rotulo: "Tipo", tipo: "select", opcoes: TIPOS_CONTA.map((t) => ({ valor: t, rotulo: ROTULO_TIPO[t] })) },
    { id: "saldoInicialCentavos", rotulo: "Saldo inicial", tipo: "moeda" },
    { id: "dataSaldoInicial", rotulo: "Data do saldo inicial", tipo: "data" },
    { id: "ehReserva", rotulo: "É dinheiro de reserva/segurança", tipo: "check" },
    { id: "status", rotulo: "Encerrada", tipo: "check", valorMarcado: "encerrada", valorDesmarcado: "ativa", padrao: "ativa" },
  ],
  exibir(dados, contexto, id) {
    const pessoa = (contexto.pessoas || []).find((p) => p.valor === dados.pessoaId);
    const saldo = calcularSaldoConta({ id, ...dados }, contexto.transacoes || []);
    return {
      titulo: dados.nome,
      sub: `${pessoa ? pessoa.rotulo + " · " : ""}atualizado em ${quandoAtualizado(dados)}`,
      valorDireita: formatarBRL(saldo),
      tag: dados.status === "ativa" ? null : "encerrada",
      tagInativa: dados.status !== "ativa",
    };
  },

  rotuloDetalhes: "Atualizar saldo",
  renderExtra(dados, id, contexto) {
    const saldo = calcularSaldoConta({ id, ...dados }, contexto.transacoes || []);
    const hist = (dados.conferencias || []).slice(-5).reverse();
    const mudou = saldo - (Number(dados.saldoInicialCentavos) || 0);
    return `
      <div class="fatura-linha"><span class="rotulo">Saldo que você informou<small>em ${escapeHtml(quandoAtualizado(dados))}</small></span><b data-valor>${formatarBRL(Number(dados.saldoInicialCentavos) || 0)}</b></div>
      <div class="fatura-linha"><span class="rotulo">Mudou desde então<small>o que foi pago ou recebido por esta conta depois</small></span><b class="${mudou < 0 ? "valor-neg" : mudou > 0 ? "valor-pos" : ""}" data-valor>${mudou > 0 ? "+" : ""}${formatarBRL(mudou)}</b></div>
      <div class="fatura-linha"><span class="rotulo"><b>Saldo agora no painel</b></span><b data-valor>${formatarBRL(saldo)}</b></div>
      <button class="btn btn-primary" data-conferir style="margin:10px 0;">Atualizar com o saldo do banco</button>
      ${hist.length ? `<div class="tela-sub" style="margin:8px 0 4px;">Últimas conferências</div>${hist.map((h) => `
        <div class="fatura-linha"><span class="rotulo">${escapeHtml(formatarData(h.data))}<small>painel calculava ${formatarBRL(h.calculadoCentavos)}</small></span><b data-valor>${formatarBRL(h.informadoCentavos)}${h.diferencaCentavos ? ` <span style="font-weight:400;font-size:13px;">(${h.diferencaCentavos > 0 ? "+" : ""}${formatarBRL(h.diferencaCentavos)})</span>` : ""}</b></div>`).join("")}` : ""}`;
  },
  aoRenderizarExtra(dados, id, contexto, elExtra) {
    elExtra.querySelector("[data-conferir]")?.addEventListener("click", () => {
      const calculado = calcularSaldoConta({ id, ...dados }, contexto.transacoes || []);
      modal.abrir(`
        <div class="modal">
          <h2>Conferir saldo: ${escapeHtml(dados.nome)}</h2>
          <p class="tela-sub" style="margin-bottom:12px;">Abra o app do banco e digite quanto aparece de saldo agora. O painel calcula <b data-valor>${formatarBRL(calculado)}</b>.</p>
          <div class="field"><label for="cf-valor">Saldo no app do banco</label><input type="text" inputmode="decimal" id="cf-valor" placeholder="0,00"></div>
          <div class="fp-depois" id="cf-dif"></div>
          <div class="erro-form" id="cf-erro" hidden></div>
          <div class="modal-actions"><button class="btn btn-ghost" data-cf="cancelar">Cancelar</button><button class="btn btn-primary" data-cf="ok">Conferir</button></div>
        </div>`);
      const raiz = document.getElementById("overlay-modal");
      const dif = () => paraCentavos(raiz.querySelector("#cf-valor").value) - calculado;
      raiz.querySelector("#cf-valor").addEventListener("input", () => {
        const v = raiz.querySelector("#cf-valor").value.trim();
        raiz.querySelector("#cf-dif").innerHTML = v ? (dif() === 0 ? "Bate certinho." : `Diferença de <b data-valor>${formatarBRL(dif())}</b> (fica registrada).`) : "";
      });
      raiz.querySelector('[data-cf="cancelar"]').addEventListener("click", () => modal.fechar());
      raiz.querySelector('[data-cf="ok"]').addEventListener("click", async () => {
        const txt = raiz.querySelector("#cf-valor").value.trim();
        if (!txt) { const e = raiz.querySelector("#cf-erro"); e.textContent = "Digite o saldo que aparece no app do banco."; e.hidden = false; return; }
        if (!valorDigitadoValido(txt)) { const e = raiz.querySelector("#cf-erro"); e.textContent = "Valor não reconhecido. Use o formato 1.234,56."; e.hidden = false; return; }
        try {
          const r = await conferirSaldo(id, paraCentavos(txt));
          modal.fechar();
          mostrarToast(r.diferencaCentavos === 0 ? "Saldo conferido: bate certinho." : `Saldo conferido. Diferença de ${formatarBRL(r.diferencaCentavos)} registrada.`);
        } catch (e) { const el = raiz.querySelector("#cf-erro"); el.textContent = e.message; el.hidden = false; }
      });
    });
  },
});
