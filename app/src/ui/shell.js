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

const telaDinheiro = criarTelaComAbas({
  titulo: "Dinheiro",
  subtitulo: "Contas, cartões e toda a movimentação. Revisão de importação chega na Fase 11.",
  abas: [
    { id: "transacoes", rotulo: "Transações", tela: telaTransacoes },
    { id: "contas", rotulo: "Contas", tela: telaContas },
    { id: "cartoes", rotulo: "Cartões", tela: telaCartoes },
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
  { id: "planejamento", rotulo: "Planejamento", tela: criarTelaPlaceholder({
      titulo: "Planejamento", descricao: "Contas futuras, calendário, fluxo e orçamento.",
      itens: "Calendário financeiro, projeção de 7/30/90 dias e 12 meses, e orçamento por categoria.",
      faseRef: "Fase 4 e Fase 5",
    }), emBreve: true },
  { id: "dividas", rotulo: "Dívidas", tela: criarTelaPlaceholder({
      titulo: "Dívidas", descricao: "Central de dívidas e plano de saída.",
      itens: "Cadastro de dívidas, parcelas, juros, data estimada de quitação e simulador de aporte extra.",
      faseRef: "Fase 6",
    }), emBreve: true },
  { id: "renda", rotulo: "Renda", tela: criarTelaPlaceholder({
      titulo: "Renda", descricao: "Fontes de renda e gap de renda.",
      itens: "Fontes por previsibilidade, e os três gaps: custo essencial, custo desejado e meta de recuperação.",
      faseRef: "Fase 8",
    }), emBreve: true },
  { id: "patrimonio", rotulo: "Patrimônio", tela: criarTelaPlaceholder({
      titulo: "Patrimônio", descricao: "Ativos, passivos e evolução patrimonial.",
      itens: "Ativos líquidos, investimentos, imóveis, veículos, passivos e patrimônio líquido consolidado.",
      faseRef: "Fase 9",
    }), emBreve: true },
  { id: "objetivos", rotulo: "Objetivos", tela: criarTelaPlaceholder({
      titulo: "Objetivos", descricao: "Metas financeiras e compatibilidade com a margem atual.",
      itens: "Metas de curto, médio e longo prazo, com verificação de compatibilidade com a margem disponível.",
      faseRef: "Fase 9",
    }), emBreve: true },
  { id: "plano", rotulo: "Plano", tela: criarTelaPlaceholder({
      titulo: "Plano", descricao: "Diagnóstico, central de decisões e plano vivo.",
      itens: "O que está causando a pressão financeira, o que precisa de atenção agora, e o plano que se atualiza sozinho.",
      faseRef: "Fase 7",
    }), emBreve: true },
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
