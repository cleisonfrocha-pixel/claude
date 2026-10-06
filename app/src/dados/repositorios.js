// Repositórios: um por coleção de cadastro da Fase 0. Cada um aplica os
// padrões e validações do domínio (esquema.js) antes de escrever no `db`.
// Caminhos das coleções — ver docs/MODELO-DE-DADOS.md.

import * as db from "./db.js";
import {
  padraoPessoa, padraoConta, padraoCartao, padraoCategoria, padraoDivida, padraoFonteRenda, padraoAtivo, padraoObjetivo, padraoRegraClassificacao,
  validarPessoa, validarConta, validarCartao, validarCategoria, validarDivida, validarFonteRenda, validarAtivo, validarObjetivo, validarRegraClassificacao,
} from "../domain/esquema.js";

function fabricarRepositorio(caminho, padrao, validar, ajustar = (campos) => campos) {
  return {
    caminho,
    listar: () => db.listar(caminho),
    assinar: (cb) => db.assinar(caminho, cb),
    async criar(dadosParciais) {
      const dados = padrao(dadosParciais);
      const erros = validar(dados);
      if (erros.length) throw new ErroDeValidacao(erros);
      const agora = new Date().toISOString();
      return db.criar(caminho, { ...ajustar(dados, null, agora), criadoEm: agora, atualizadoEm: agora });
    },
    async atualizar(id, campos) {
      const atual = (await db.listar(caminho)).find((d) => d.id === id);
      const dados = padrao({ ...(atual ? atual.dados : {}), ...campos });
      const erros = validar(dados);
      if (erros.length) throw new ErroDeValidacao(erros);
      const agora = new Date().toISOString();
      return db.atualizar(caminho, id, { ...ajustar(campos, atual ? atual.dados : null, agora), atualizadoEm: agora });
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
// Saldo novo digitado no cadastro vale a partir de agora: grava a hora, senão o
// que for pago ou recebido no mesmo dia, depois disso, não entraria no saldo.
function marcarConferencia(campos, atual, agora) {
  if ("saldoConferidoEm" in campos) return campos;
  const mudou = (k) => k in campos && (!atual || campos[k] !== atual[k]);
  return mudou("saldoInicialCentavos") || mudou("dataSaldoInicial") ? { ...campos, saldoConferidoEm: agora } : campos;
}
export const contas = fabricarRepositorio("contas", padraoConta, validarConta, marcarConferencia);
export const cartoes = fabricarRepositorio("cartoes", padraoCartao, validarCartao);
export const categorias = fabricarRepositorio("categorias", padraoCategoria, validarCategoria);
export const dividas = fabricarRepositorio("dividas", padraoDivida, validarDivida);
export const fontesRenda = fabricarRepositorio("fontesRenda", padraoFonteRenda, validarFonteRenda);
export const ativos = fabricarRepositorio("ativos", padraoAtivo, validarAtivo);
export const objetivos = fabricarRepositorio("objetivos", padraoObjetivo, validarObjetivo);
export const regras = fabricarRepositorio("regrasClassificacao", padraoRegraClassificacao, validarRegraClassificacao);
