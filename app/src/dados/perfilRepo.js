// Perfil da casa (domain/perfil.js): um documento só, `perfil/casa`. É a base de conhecimento que o gerador de
// plano e a IA leem. Texto escrito pelo Cleison (ou por mim a pedido dele); nada aqui é calculado.

import * as db from "./db.js";
import { padraoPerfil, validarPerfil } from "../domain/perfil.js";

const CAMINHO = "perfil";
const ID = "casa";

export async function lerPerfil() {
  const d = await db.lerDocumento(`${CAMINHO}/${ID}`);
  return d ? padraoPerfil(d) : padraoPerfil();
}

export async function salvarPerfil(perfil) {
  const dados = padraoPerfil({ ...perfil, atualizadoEm: new Date().toISOString() });
  const erros = validarPerfil(dados);
  if (erros.length) throw new Error(erros.join(" "));
  await db.definir(CAMINHO, ID, dados);
  return dados;
}

export function assinarPerfil(cb) {
  return db.assinar(CAMINHO, (lista) => {
    const doc = lista.find((x) => x.id === ID);
    cb(doc ? padraoPerfil(doc.dados) : padraoPerfil());
  });
}
