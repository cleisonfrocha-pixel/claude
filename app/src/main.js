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

  const { primeiraExecucao } = await garantirEsquema();
  if (primeiraExecucao) await semearCategoriasSeVazio();

  const badge = document.getElementById("badge-modo-local");
  if (badge) badge.hidden = db.modoAtual() !== "local";

  shell.inicializar(document.getElementById("conteudo-principal"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar);
} else {
  iniciar();
}
