// Repositórios: um por coleção de cadastro da Fase 0. Cada um aplica os
// padrões e validações do domínio (esquema.js) antes de escrever no `db`.
// Caminhos das coleções — ver docs/MODELO-DE-DADOS.md.

import * as db from "./db.js";
import {
  padraoPessoa, padraoConta, padraoCartao, padraoCategoria, padraoDivida,
  validarPessoa, validarConta, validarCartao, validarCategoria, validarDivida,
} from "../domain/esquema.js";

function fabricarRepositorio(caminho, padrao, validar) {
  return {
    caminho,
    listar: () => db.listar(caminho),
    assinar: (cb) => db.assinar(caminho, cb),
    async criar(dadosParciais) {
      const dados = padrao(dadosParciais);
      const erros = validar(dados);
      if (erros.length) throw new ErroDeValidacao(erros);
      const agora = new Date().toISOString();
      return db.criar(caminho, { ...dados, criadoEm: agora, atualizadoEm: agora });
    },
    async atualizar(id, campos) {
      const atual = (await db.listar(caminho)).find((d) => d.id === id);
      const dados = padrao({ ...(atual ? atual.dados : {}), ...campos });
      const erros = validar(dados);
      if (erros.length) throw new ErroDeValidacao(erros);
      return db.atualizar(caminho, id, { ...campos, atualizadoEm: new Date().toISOString() });
    },
    apagar: (id) => db.apagar(caminho, id),
  };
}

export class ErroDeValidacao extends Error {
  constructor(erros) {
    super(erros.join(" "));
    this.erros = erros;
  }
}

export const pessoas = fabricarRepositorio("pessoas", padraoPessoa, validarPessoa);
export const contas = fabricarRepositorio("contas", padraoConta, validarConta);
export const cartoes = fabricarRepositorio("cartoes", padraoCartao, validarCartao);
export const categorias = fabricarRepositorio("categorias", padraoCategoria, validarCategoria);
export const dividas = fabricarRepositorio("dividas", padraoDivida, validarDivida);
