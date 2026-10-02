// Ponto de entrada. Resolve a persistência, garante o esquema, semeia
// categorias sugeridas na primeira execução, e monta a casca da aplicação.

import * as db from "./dados/db.js";
import { garantirEsquema } from "./dados/migrador.js";
import { categorias } from "./dados/repositorios.js";
import { categoriasSugeridas } from "./domain/esquema.js";
import * as privacidade from "./ui/privacidade.js";
import * as tema from "./ui/tema.js";
import * as modal from "./ui/modal.js";
import * as shell from "./ui/shell.js";
import { ligarDicaDeData } from "./ui/utilitarios.js";

async function semearCategoriasSeVazio() {
  const existentes = await categorias.listar();
  if (existentes.length) return;
  for (const c of categoriasSugeridas()) {
    await categorias.criar(c);
  }
}

async function iniciar() {
  tema.inicializar();
  privacidade.inicializar();
  modal.religar();
  ligarDicaDeData();

  const { primeiraExecucao } = await garantirEsquema();
  if (primeiraExecucao) await semearCategoriasSeVazio();

  const badge = document.getElementById("badge-modo-local");
  if (badge) badge.hidden = db.modoAtual() !== "local";

  shell.inicializar(document.getElementById("conteudo-principal"));
}

async function iniciarComRedeDeSeguranca() {
  try {
    await iniciar();
  } catch (erro) {
    // Sem isso, um erro aqui (ex.: a capability `db` falhando ao resolver,
    // um documento com formato inesperado) deixa a tela em branco sem
    // nenhuma pista — nem para o usuário reportar, nem para depurar depois.
    // window.mostrarErroFatal vem do script inline em index.html.
    if (typeof window.mostrarErroFatal === "function") {
      window.mostrarErroFatal("Erro ao iniciar o painel.", erro && erro.stack ? erro.stack : erro);
    }
    throw erro;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarComRedeDeSeguranca);
} else {
  iniciarComRedeDeSeguranca();
}
