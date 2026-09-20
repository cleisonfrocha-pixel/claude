// Casca da aplicação: cabeçalho, navegação pelos 11 módulos do §26 e troca
// de tela. Uma única fileira de chips (funciona igual em celular e
// computador) em vez de barra lateral + barra inferior separadas — mais
// simples de fazer certo agora, e o §26 só pede módulos claros, não uma
// forma específica de navegação.

import { escapeHtml } from "./utilitarios.js";
import { criarTelaComAbas } from "./telas/comAbas.js";
import { criarTelaPlaceholder } from "./telas/placeholder.js";
import telaInicio from "./telas/inicio.js";
import telaContas from "./telas/contas.js";
import telaCartoes from "./telas/cartoes.js";
import telaTransacoes from "./telas/transacoes.js";
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
  { id: "inicio", rotulo: "Início", tela: telaInicio },
  { id: "dinheiro", rotulo: "Dinheiro", tela: telaDinheiro },
  { id: "planejamento", rotulo: "Planejamento", tela: telaPlanejamento },
  { id: "dividas", rotulo: "Dívidas", tela: telaDividas },
  { id: "renda", rotulo: "Renda", tela: telaRenda },
  { id: "patrimonio", rotulo: "Patrimônio", tela: telaPatrimonio },
  { id: "objetivos", rotulo: "Objetivos", tela: telaObjetivos },
  { id: "plano", rotulo: "Plano", tela: telaPlano },
  { id: "openfinance", rotulo: "Open Finance", tela: criarTelaPlaceholder({
      titulo: "Open Finance", descricao: "Conexão automática com instituições financeiras.",
      itens: "É a única fase que depende de um provedor pago e infraestrutura fora deste painel — ver docs/ARQUITETURA.md, D4.",
      faseRef: "Fase 12",
    }), emBreve: true },
  { id: "ia", rotulo: "IA", tela: criarTelaPlaceholder({
      titulo: "IA", descricao: "Assistente financeiro conversacional.",
      itens: "Responde sobre a sua vida financeira mostrando sempre os dados de origem — sem backend, dentro da própria página.",
      faseRef: "Fase 13",
    }), emBreve: true },
  { id: "configuracoes", rotulo: "Configurações", tela: telaConfiguracoes },
];

let moduloAtivo = MODULOS[0].id;
let containerConteudo = null;

export function inicializar(container) {
  containerConteudo = container;
  renderizarNav();
  montarModulo(moduloAtivo);
}

function renderizarNav() {
  const nav = document.getElementById("nav-modulos-inner");
  nav.innerHTML = MODULOS.map((m) => `
    <button class="modulo-chip${m.id === moduloAtivo ? " ativo" : ""}" data-modulo="${escapeHtml(m.id)}">
      ${escapeHtml(m.rotulo)}${m.emBreve ? '<span class="badge-em-breve">em breve</span>' : ""}
    </button>
  `).join("");
  nav.querySelectorAll("[data-modulo]").forEach((btn) => {
    btn.addEventListener("click", () => selecionarModulo(btn.dataset.modulo));
  });
}

function selecionarModulo(id) {
  if (id === moduloAtivo) return;
  const anterior = MODULOS.find((m) => m.id === moduloAtivo);
  if (anterior && anterior.tela.desmontar) anterior.tela.desmontar();
  moduloAtivo = id;
  renderizarNav();
  montarModulo(id);
}

function montarModulo(id) {
  const modulo = MODULOS.find((m) => m.id === id);
  containerConteudo.innerHTML = "";
  modulo.tela.montar(containerConteudo);
}
