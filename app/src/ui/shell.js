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
import { criarTelaComAbas } from "./telas/comAbas.js";
import { criarTelaPlaceholder } from "./telas/placeholder.js";
import telaInicio from "./telas/inicio.js";
import telaContas from "./telas/contas.js";
import telaCartoes from "./telas/cartoes.js";
import telaTransacoes from "./telas/transacoes.js";
import telaRecorrencias from "./telas/recorrencias.js";
import telaPessoas from "./telas/pessoas.js";
import telaCategorias from "./telas/categorias.js";
import telaPreferencias from "./telas/preferencias.js";
import telaPlanejamento from "./telas/planejamento.js";
import telaDividas from "./telas/dividas.js";
import telaPlano from "./telas/plano.js";
import telaRenda from "./telas/renda.js";
import telaPatrimonio from "./telas/patrimonio.js";
import telaObjetivos from "./telas/objetivos.js";
import telaImportar from "./telas/importar.js";

const telaDinheiro = criarTelaComAbas({
  titulo: "Dinheiro",
  subtitulo: "Contas, cartões, toda a movimentação, e a importação de extratos.",
  abas: [
    { id: "transacoes", rotulo: "Transações", tela: telaTransacoes },
    { id: "recorrencias", rotulo: "Recorrências", tela: telaRecorrencias },
    { id: "contas", rotulo: "Contas", tela: telaContas },
    { id: "cartoes", rotulo: "Cartões", tela: telaCartoes },
    { id: "importar", rotulo: "Importar", tela: telaImportar },
  ],
});

const telaConfiguracoes = criarTelaComAbas({
  titulo: "Configurações",
  abas: [
    { id: "pessoas", rotulo: "Pessoas", tela: telaPessoas },
    { id: "categorias", rotulo: "Categorias", tela: telaCategorias },
    { id: "preferencias", rotulo: "Preferências", tela: telaPreferencias },
  ],
});

const MODULOS = [
  { id: "inicio", rotulo: "Início", icone: "inicio", tela: telaInicio },
  { id: "dinheiro", rotulo: "Dinheiro", icone: "dinheiro", tela: telaDinheiro },
  { id: "planejamento", rotulo: "Planejamento", icone: "planejamento", tela: telaPlanejamento },
  { id: "dividas", rotulo: "Dívidas", icone: "dividas", tela: telaDividas },
  { id: "renda", rotulo: "Renda", icone: "renda", tela: telaRenda },
  { id: "patrimonio", rotulo: "Patrimônio", icone: "patrimonio", tela: telaPatrimonio },
  { id: "objetivos", rotulo: "Objetivos", icone: "objetivos", tela: telaObjetivos },
  { id: "plano", rotulo: "Plano", icone: "plano", tela: telaPlano },
  { id: "openfinance", rotulo: "Open Finance", icone: "openfinance", tela: criarTelaPlaceholder({
      titulo: "Open Finance", descricao: "Conexão automática com instituições financeiras.",
      itens: "É a única fase que depende de um provedor pago e infraestrutura fora deste painel. Ver docs/ARQUITETURA.md, D4.",
      faseRef: "Fase 12",
    }), emBreve: true },
  { id: "ia", rotulo: "IA", icone: "ia", tela: criarTelaPlaceholder({
      titulo: "IA", descricao: "Assistente financeiro conversacional.",
      itens: "Responde sobre a sua vida financeira mostrando sempre os dados de origem, sem backend, dentro da própria página.",
      faseRef: "Fase 13",
    }), emBreve: true },
  { id: "configuracoes", rotulo: "Configurações", icone: "configuracoes", tela: telaConfiguracoes },
];

// Os 4 destinos mais usados vão pra barra fixa; o resto mora atrás do "Mais".
const IDS_BARRA_INFERIOR = ["inicio", "dinheiro", "planejamento", "plano"];

let moduloAtivo = MODULOS[0].id;
let containerConteudo = null;

export function inicializar(container) {
  containerConteudo = container;
  renderizarNavegacao();
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
  nav.innerHTML = MODULOS.map((m) => `
    <button class="modulo-chip${m.id === moduloAtivo ? " ativo" : ""}" data-modulo="${escapeHtml(m.id)}">
      ${icone(m.icone, 16)}<span>${escapeHtml(m.rotulo)}</span>${m.emBreve ? '<span class="badge-em-breve">em breve</span>' : ""}
    </button>
  `).join("");
  nav.querySelectorAll("[data-modulo]").forEach((btn) => {
    btn.addEventListener("click", () => selecionarModulo(btn.dataset.modulo));
  });
  atualizarSombraDeRolagem();
}

function renderizarNavInferior() {
  const nav = document.getElementById("bottom-nav");
  if (!nav) return;
  const principais = IDS_BARRA_INFERIOR.map((id) => MODULOS.find((m) => m.id === id));
  const numaAbaSecundaria = MODULOS.filter((m) => !IDS_BARRA_INFERIOR.includes(m.id));
  const maisAtivo = numaAbaSecundaria.some((m) => m.id === moduloAtivo);
  nav.innerHTML = principais.map((m) => `
    <button class="bottom-nav-item${m.id === moduloAtivo ? " ativo" : ""}" data-modulo="${escapeHtml(m.id)}">
      ${icone(m.icone, 22)}<span>${escapeHtml(m.rotulo)}</span>
    </button>
  `).join("") + `
    <button class="bottom-nav-item${maisAtivo ? " ativo" : ""}" data-mais>
      ${icone("mais", 22)}<span>Mais</span>
    </button>`;
  nav.querySelectorAll("[data-modulo]").forEach((btn) => {
    btn.addEventListener("click", () => selecionarModulo(btn.dataset.modulo));
  });
  const btnMais = nav.querySelector("[data-mais]");
  if (btnMais) btnMais.addEventListener("click", () => abrirMenuMais(numaAbaSecundaria));
}

/** Os módulos que não cabem na barra fixa moram aqui, numa folha simples
 * que abre por cima (reaproveita o modal existente, sem componente novo). */
function abrirMenuMais(modulos) {
  const html = `
    <div class="modal">
      <h2>Mais</h2>
      <div class="lista-cartoes">
        ${modulos.map((m) => `
          <button class="item-cartao" data-modulo="${escapeHtml(m.id)}" style="width:100%;text-align:left;cursor:pointer;font:inherit;">
            <div class="item-avatar">${icone(m.icone, 20)}</div>
            <div class="item-corpo"><div class="item-titulo">${escapeHtml(m.rotulo)}</div></div>
            ${m.emBreve ? '<span class="item-tag">em breve</span>' : ""}
          </button>`).join("")}
      </div>
    </div>`;
  abrirModal(html);
  document.querySelectorAll("#overlay-modal [data-modulo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      fecharModal();
      selecionarModulo(btn.dataset.modulo);
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

function selecionarModulo(id) {
  if (id === moduloAtivo) return;
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
