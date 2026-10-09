// Casca da aplicação: cabeçalho, navegação pelos 11 módulos do §26 e troca
// de tela.
//
// Sprint 7 (pós-auditoria de UX/UI, referência Nubank pedida pelo
// usuário): duas navegações, não uma só. Em celular, a fileira de chips
// rolável ocupava espaço demais e não parecia app nenhum — vira uma barra
// fixa embaixo, como qualquer app de banco, com só os 4 destinos mais
// usados mais um "Mais" que abre os módulos secundários numa folha. Em
// tela larga, uma barra rolável embaixo não faz sentido de uso (mouse e
// espaço sobram), então o topo continua com todos os módulos, só que no
// visual novo, com ícone. As duas árvores de navegação existem sempre no
// DOM; o CSS decide qual aparece, conforme a largura da tela.

import { escapeHtml } from "./utilitarios.js";
import { icone } from "./icones.js";
import { abrir as abrirModal, fechar as fecharModal } from "./modal.js";
import { registrar as registrarNavegacao, navegar } from "./navegacao.js";
import { abrirAtualizarSaldo } from "./atualizarSaldo.js";
import { criarTelaComAbas } from "./telas/comAbas.js";
import { criarTelaPlaceholder } from "./telas/placeholder.js";
import telaInicio from "./telas/inicio.js";
import telaContas from "./telas/contas.js";
import telaCartoes from "./telas/cartoes.js";
import telaAPagar from "./telas/contasAPagar.js";
import telaTransacoes from "./telas/transacoes.js";
import telaRecorrencias from "./telas/recorrencias.js";
import telaPessoas from "./telas/pessoas.js";
import telaCategorias from "./telas/categorias.js";
import telaPreferencias from "./telas/preferencias.js";
import telaCalendario from "./telas/calendario.js";
import telaFluxoCaixa from "./telas/fluxoCaixa.js";
import { criarTelaEmPilha } from "./telas/pilha.js";
import telaDividas from "./telas/dividas.js";
import telaPlano from "./telas/planoModulo.js";
import telaRenda from "./telas/renda.js";
import telaPatrimonio from "./telas/patrimonio.js";
import telaObjetivos from "./telas/objetivos.js";
import telaImportar from "./telas/importar.js";
import telaRevisar from "./telas/revisar.js";
import telaPerfil from "./telas/perfil.js";
import telaDados from "./telas/dadosEAtividade.js";
import { ligarBuscaGlobal } from "./buscaGlobal.js";

// Seis abas, sem título repetido em cima (itens 60 e 86 da lista de 05/10): a Agenda junta calendário e
// fluxo numa tela só; Contas e Cartões viram uma aba; Importar e Revisar foram para Configurações.
const telaDinheiro = criarTelaComAbas({
  abas: [
    { id: "apagar", rotulo: "A pagar", tela: telaAPagar },
    { id: "transacoes", rotulo: "Transações", tela: telaTransacoes },
    { id: "agenda", rotulo: "Agenda", tela: criarTelaEmPilha([telaCalendario, telaFluxoCaixa]) },
    { id: "renda", rotulo: "Renda", tela: telaRenda },
    { id: "recorrencias", rotulo: "Contas fixas", tela: telaRecorrencias },
    { id: "contas", rotulo: "Contas e cartões", tela: criarTelaEmPilha([telaContas, telaCartoes]) },
  ],
});

const telaConfiguracoes = criarTelaComAbas({
  titulo: "Configurações",
  abas: [
    { id: "perfil", rotulo: "Sobre nós", tela: telaPerfil },
    { id: "importar", rotulo: "Importar extrato", tela: telaImportar },
    { id: "revisar", rotulo: "Revisar lançamentos", tela: telaRevisar },
    { id: "pessoas", rotulo: "Pessoas", tela: telaPessoas },
    { id: "categorias", rotulo: "Categorias", tela: telaCategorias },
    { id: "preferencias", rotulo: "Preferências", tela: telaPreferencias },
    { id: "dados", rotulo: "Dados", tela: telaDados },
  ],
});

const MODULOS = [
  { id: "inicio", rotulo: "Início", icone: "inicio", tela: telaInicio },
  { id: "dinheiro", rotulo: "Dinheiro", icone: "dinheiro", tela: telaDinheiro },
  { id: "dividas", rotulo: "Dívidas", icone: "dividas", tela: telaDividas },
  { id: "plano", rotulo: "Plano", icone: "plano", tela: telaPlano },
  { id: "configuracoes", rotulo: "Configurações", icone: "configuracoes", tela: telaConfiguracoes, oculto: true },
];

// Telas que viraram aba de outro módulo: quem ainda pede o destino antigo
// (um atalho, um alerta) cai na aba certa em vez de num módulo que não existe.
const REDIRECIONAMENTOS_DE_ABA = {
  "dinheiro/importar": { modulo: "configuracoes", aba: "importar" },
  "dinheiro/revisar": { modulo: "configuracoes", aba: "revisar" },
  "dinheiro/cartoes": { modulo: "dinheiro", aba: "contas" },
  "plano/pessoas": { modulo: "plano", aba: "meuano" },
  "plano/relatorios": { modulo: "plano", aba: "meuano" },
  "plano/evolucao": { modulo: "plano", aba: "meuano" },
  "plano/caminhos": { modulo: "plano", aba: "geral" },
};

const REDIRECIONAMENTOS = {
  planejamento: { modulo: "dinheiro", aba: "agenda" },
  renda: { modulo: "dinheiro", aba: "renda" },
  patrimonio: { modulo: "plano", aba: "patrimonio" },
  objetivos: { modulo: "plano", aba: "patrimonio" },
};

// Barra de baixo: Início · Dinheiro · ＋ · Dívidas · Plano. O ＋ no meio é a
// ação mais frequente (lançar), não um destino.
const IDS_ESQUERDA = ["inicio", "dinheiro"];
const IDS_DIREITA = ["dividas", "plano"];

let moduloAtivo = MODULOS[0].id;
let containerConteudo = null;

export function inicializar(container) {
  containerConteudo = container;
  registrarNavegacao((destino) => {
    let { modulo, aba } = { ...destino, ...(REDIRECIONAMENTOS[destino.modulo] || {}) };
    const deAba = REDIRECIONAMENTOS_DE_ABA[`${modulo}/${aba}`];
    if (deAba) ({ modulo, aba } = deAba);
    const m = MODULOS.find((x) => x.id === modulo);
    if (!m) return;
    if (aba && m.tela.definirAba) m.tela.definirAba(aba);
    selecionarModulo(modulo, true);
  });
  renderizarNavegacao();
  ligarBuscaGlobal();
  montarModulo(moduloAtivo);
  const scroller = document.querySelector(".modulos-nav");
  if (scroller) {
    scroller.addEventListener("scroll", atualizarSombraDeRolagem, { passive: true });
    window.addEventListener("resize", atualizarSombraDeRolagem);
  }
}

function renderizarNavegacao() {
  renderizarNavTopo();
  renderizarNavInferior();
}

function renderizarNavTopo() {
  const nav = document.getElementById("nav-modulos-inner");
  if (!nav) return;
  nav.innerHTML = MODULOS.filter((m) => !m.oculto).map((m) => `
    <button class="modulo-chip${m.id === moduloAtivo ? " ativo" : ""}" data-modulo="${escapeHtml(m.id)}">
      ${icone(m.icone, 16)}<span>${escapeHtml(m.rotulo)}</span>${m.emBreve ? '<span class="badge-em-breve">em breve</span>' : ""}
    </button>
  `).join("");
  nav.querySelectorAll("[data-modulo]").forEach((btn) => {
    btn.addEventListener("click", () => selecionarModulo(btn.dataset.modulo));
  });
  atualizarSombraDeRolagem();
}

function itemBarra(m) {
  return `
    <button class="bottom-nav-item${m.id === moduloAtivo ? " ativo" : ""}" data-modulo="${escapeHtml(m.id)}">
      ${icone(m.icone, 22)}<span>${escapeHtml(m.rotuloCurto || m.rotulo)}</span>
    </button>`;
}

function renderizarNavInferior() {
  const nav = document.getElementById("bottom-nav");
  if (!nav) return;
  const achar = (id) => MODULOS.find((m) => m.id === id);
  nav.innerHTML = IDS_ESQUERDA.map(achar).map(itemBarra).join("")
    + `<button class="bottom-nav-mais" data-lancar-rapido aria-label="Lançar">${icone("adicionar", 26)}</button>`
    + IDS_DIREITA.map(achar).map(itemBarra).join("");
  nav.querySelectorAll("[data-modulo]").forEach((btn) => {
    btn.addEventListener("click", () => selecionarModulo(btn.dataset.modulo));
  });
  nav.querySelector("[data-lancar-rapido]").addEventListener("click", abrirFolhaDeLancar);
  const engrenagem = document.getElementById("btn-config");
  if (engrenagem) {
    engrenagem.classList.toggle("ativo", moduloAtivo === "configuracoes");
    engrenagem.onclick = () => selecionarModulo("configuracoes");
  }
}

/** O ＋ do meio: uma folha com as quatro coisas que a pessoa faz todo dia. */
function abrirFolhaDeLancar() {
  const opcoes = [
    { id: "nova-transacao", rotulo: "Lançar um gasto ou recebimento", ic: "adicionar", destino: { modulo: "dinheiro", aba: "transacoes", acao: "nova-transacao" } },
    { id: "saldo", rotulo: "Atualizar o saldo das contas", ic: "dinheiro", acao: abrirAtualizarSaldo },
    { id: "importar", rotulo: "Importar um extrato", ic: "dinheiro", destino: { modulo: "configuracoes", aba: "importar" } },
    { id: "agenda", rotulo: "Ver o que vence", ic: "planejamento", destino: { modulo: "dinheiro", aba: "agenda" } },
    { id: "divida", rotulo: "Ver minhas dívidas", ic: "dividas", destino: { modulo: "dividas" } },
  ];
  abrirModal(`
    <div class="modal">
      <h2>O que você quer fazer?</h2>
      <div class="lista-cartoes">
        ${opcoes.map((o) => `
          <button class="item-cartao folha-opcao" data-opcao="${o.id}">
            <div class="item-avatar">${icone(o.ic, 20)}</div>
            <div class="item-corpo"><div class="item-titulo">${escapeHtml(o.rotulo)}</div></div>
          </button>`).join("")}
      </div>
    </div>`);
  document.querySelectorAll("#overlay-modal [data-opcao]").forEach((btn) => {
    btn.addEventListener("click", () => {
      fecharModal();
      const op = opcoes.find((o) => o.id === btn.dataset.opcao);
      if (op.acao) op.acao(); else navegar(op.destino);
    });
  });
}

// Liga/desliga as sombras de "tem mais módulo pra esse lado" conforme a
// posição do scroll — nunca fica ligada nos dois lados ao mesmo tempo no
// início ou no fim da lista.
function atualizarSombraDeRolagem() {
  const scroller = document.querySelector(".modulos-nav");
  if (!scroller) return;
  const podeEsq = scroller.scrollLeft > 2;
  const podeDir = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2;
  scroller.classList.toggle("pode-rolar-esq", podeEsq);
  scroller.classList.toggle("pode-rolar-dir", podeDir);
}

function selecionarModulo(id, forcar = false) {
  if (REDIRECIONAMENTOS[id]) return navegar(REDIRECIONAMENTOS[id]);
  if (id === moduloAtivo && !forcar) return;
  const anterior = MODULOS.find((m) => m.id === moduloAtivo);
  if (anterior && anterior.tela.desmontar) anterior.tela.desmontar();
  moduloAtivo = id;
  renderizarNavegacao();
  montarModulo(id);
  containerConteudo.scrollIntoView({ block: "start" });
}

function montarModulo(id) {
  const modulo = MODULOS.find((m) => m.id === id);
  containerConteudo.innerHTML = "";
  modulo.tela.montar(containerConteudo);
}
