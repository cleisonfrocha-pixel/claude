// Perguntar à IA (§20): conversa sobre a própria vida financeira, sempre
// mostrando os dados de onde veio a resposta. A IA só lê: não existe
// nenhuma ferramenta de gravação ligada a ela.

import { carregarRetratoIA } from "../../dados/iaRepo.js";
import { montarTurnos, PERGUNTAS_SUGERIDAS } from "../../domain/ia.js";
import { escapeHtml } from "../utilitarios.js";

const COPY_ERRO = {
  not_granted: "Você não liberou a IA para este painel. Abra de novo e aceite quando for perguntado.",
  sampling_disabled: "A IA não está disponível nesta conta.",
  not_declared: "A IA não está ligada neste painel.",
  capability_disabled: "A IA não funciona nesta tela.",
  rate_limited: "Muitas perguntas seguidas ou o limite de uso foi atingido. Tente de novo daqui a pouco.",
  session_expired: "Sua sessão expirou. Entre de novo e pergunte outra vez.",
  refused: "A IA não quis responder essa pergunta. Tente perguntar de outro jeito.",
  upstream_error: "A resposta foi interrompida. Toque em perguntar de novo.",
  prompt_too_large: "Há dados demais para enviar de uma vez.",
};

let container = null;
let historico = [];
let retrato = null;
let controlador = null;
let ocupado = false;

export default {
  async montar(alvo) {
    container = alvo;
    historico = [];
    retrato = null;
    renderizar();
    const sample = await window.claude?.use?.("sample").catch(() => null);
    if (!container) return;
    if (!sample) {
      alvo.querySelector("#ia-aviso").hidden = false;
      alvo.querySelector("#ia-form").hidden = true;
      return;
    }
    ligar(sample);
  },
  desmontar() {
    if (controlador) controlador.abort();
    container = null;
  },
};

function renderizar() {
  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Perguntar</h2>
      <p class="tela-sub">Pergunte sobre o seu dinheiro. A IA só lê os seus dados, não altera nada, e mostra de onde tirou cada resposta.</p></div></div>
    <div id="ia-aviso" class="nota-incerto" hidden>A IA só funciona quando o painel é aberto pelo claude.ai, depois de liberada. Aqui ela está indisponível.</div>
    <div id="ia-conversa" class="ia-conversa"></div>
    <div id="ia-sugestoes" class="ia-sugestoes">${PERGUNTAS_SUGERIDAS.map((p) => `<button class="btn btn-ghost btn-sm" data-sugestao>${escapeHtml(p)}</button>`).join("")}</div>
    <form id="ia-form" class="filtros-barra" style="margin-top:12px;">
      <input type="text" id="ia-pergunta" placeholder="Escreva sua pergunta" aria-label="Pergunta" autocomplete="off">
      <button class="btn btn-primary" type="submit" id="ia-enviar">Perguntar</button>
      <button class="btn btn-ghost" type="button" id="ia-parar" hidden>Parar</button>
    </form>
    <details class="bloco-recolhivel" id="ia-dados" style="margin-top:14px;">
      <summary><span class="titulo">Dados que a IA lê</span><span class="resumo">O retrato do painel que vai junto com cada pergunta</span></summary>
      <div class="conteudo" id="ia-dados-corpo"><p class="tela-sub">Carregando…</p></div>
    </details>`;
}

function desenharConversa() {
  const el = container.querySelector("#ia-conversa");
  el.innerHTML = historico.map((t) => `<div class="ia-bolha ${t.role === "user" ? "voce" : "ia"}">${escapeHtml(t.content).replace(/\n/g, "<br>")}</div>`).join("");
  el.scrollTop = el.scrollHeight;
}

function desenharDados() {
  const corpo = container?.querySelector("#ia-dados-corpo");
  if (!corpo || !retrato) return;
  corpo.innerHTML = `<div class="inicio-lista">${retrato.map((l) => `<div class="inicio-linha" style="grid-template-columns:130px 1fr;"><span class="inicio-data">${escapeHtml(l.fonte)}</span><span class="inicio-desc">${escapeHtml(l.texto)}</span></div>`).join("")}</div>`;
}

function ligar(sample) {
  const q = (s) => container.querySelector(s);
  q("#ia-dados").addEventListener("toggle", async () => {
    if (q("#ia-dados").open && !retrato) { retrato = await carregarRetratoIA(); desenharDados(); }
  });

  async function perguntar(texto) {
    const pergunta = texto.trim();
    if (!pergunta || ocupado) return;
    ocupado = true;
    q("#ia-enviar").disabled = true;
    q("#ia-parar").hidden = false;
    q("#ia-sugestoes").hidden = true;
    historico.push({ role: "user", content: pergunta });
    historico.push({ role: "assistant", content: "Pensando…" });
    desenharConversa();
    q("#ia-pergunta").value = "";
    controlador = new AbortController();
    try {
      retrato = await carregarRetratoIA();
      desenharDados();
      const turnos = montarTurnos({ retrato, historico: historico.slice(0, -2), pergunta });
      const { text, truncated } = await sample(turnos, {
        cache: false, signal: controlador.signal,
        onText: ({ text: parcial }) => { historico[historico.length - 1].content = parcial; desenharConversa(); },
      });
      historico[historico.length - 1].content = text + (truncated ? "\n\n(A resposta foi cortada. Peça para resumir.)" : "");
    } catch (e) {
      const parcial = e?.text || "";
      if (e?.code === "cancelled") historico[historico.length - 1].content = parcial || "(Pergunta cancelada.)";
      else historico[historico.length - 1].content = `${parcial ? parcial + "\n\n" : ""}${COPY_ERRO[e?.code] || COPY_ERRO.upstream_error}`;
    } finally {
      ocupado = false;
      controlador = null;
      if (container) {
        q("#ia-enviar").disabled = false;
        q("#ia-parar").hidden = true;
        desenharConversa();
      }
    }
  }

  q("#ia-form").addEventListener("submit", (ev) => { ev.preventDefault(); perguntar(q("#ia-pergunta").value); });
  q("#ia-parar").addEventListener("click", () => controlador?.abort());
  container.querySelectorAll("[data-sugestao]").forEach((b) => b.addEventListener("click", () => perguntar(b.textContent)));
}
