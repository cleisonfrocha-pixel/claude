// Domínio puro: forma dos dados e versão de esquema.
// Ver docs/MODELO-DE-DADOS.md — este arquivo é a implementação viva daquele
// documento para as coleções que nascem na Fase 0.

export const VERSAO_ESQUEMA = 1;

export const PAPEIS_PESSOA = ["titular", "conjuge", "dependente", "outro"];
export const TIPOS_CONTA = ["corrente", "poupanca", "investimento", "dinheiro", "outra"];
export const STATUS_CONTA = ["ativa", "encerrada"];
export const BANDEIRAS_CARTAO = ["visa", "mastercard", "elo", "amex", "outra"];
export const STATUS_CARTAO = ["ativo", "cancelado", "bloqueado"];
export const GRUPOS_CATEGORIA = ["moradia", "transporte", "alimentacao", "saude", "educacao", "lazer", "dividas", "renda", "outros"];
export const NATUREZAS_CATEGORIA = ["receita", "despesa", "transferencia"];

/** Preenche os campos que faltam de uma pessoa com valores padrão seguros. */
export function padraoPessoa(dados = {}) {
  return {
    nome: "",
    papel: "titular",
    ativo: true,
    ...dados,
  };
}

export function padraoConta(dados = {}) {
  return {
    pessoaId: "",
    instituicao: "",
    nome: "",
    tipo: "corrente",
    saldoInicialCentavos: 0,
    dataSaldoInicial: new Date().toISOString().slice(0, 10),
    status: "ativa",
    ehReserva: false,
    ...dados,
  };
}

export function padraoCartao(dados = {}) {
  return {
    pessoaId: "",
    contaPagamentoId: "",
    apelido: "",
    bandeira: "outra",
    limiteTotalCentavos: 0,
    diaFechamento: 1,
    diaVencimento: 10,
    status: "ativo",
    ...dados,
  };
}

export function padraoCategoria(dados = {}) {
  return {
    nome: "",
    grupo: "outros",
    natureza: "despesa",
    essencial: false,
    ativa: true,
    ...dados,
  };
}

/** Valida uma pessoa; retorna lista de erros (vazia = válido). */
export function validarPessoa(p) {
  const erros = [];
  if (!p.nome || !p.nome.trim()) erros.push("Nome é obrigatório.");
  if (!PAPEIS_PESSOA.includes(p.papel)) erros.push("Papel inválido.");
  return erros;
}

export function validarConta(c) {
  const erros = [];
  if (!c.nome || !c.nome.trim()) erros.push("Nome da conta é obrigatório.");
  if (!c.pessoaId) erros.push("A conta precisa de um responsável.");
  if (!TIPOS_CONTA.includes(c.tipo)) erros.push("Tipo de conta inválido.");
  return erros;
}

export function validarCartao(c) {
  const erros = [];
  if (!c.apelido || !c.apelido.trim()) erros.push("Apelido do cartão é obrigatório.");
  if (!c.pessoaId) erros.push("O cartão precisa de um responsável.");
  if (!c.contaPagamentoId) erros.push("O cartão precisa de uma conta de pagamento da fatura.");
  if (c.diaFechamento < 1 || c.diaFechamento > 31) erros.push("Dia de fechamento inválido.");
  if (c.diaVencimento < 1 || c.diaVencimento > 31) erros.push("Dia de vencimento inválido.");
  return erros;
}

export function validarCategoria(c) {
  const erros = [];
  if (!c.nome || !c.nome.trim()) erros.push("Nome da categoria é obrigatório.");
  if (!GRUPOS_CATEGORIA.includes(c.grupo)) erros.push("Grupo inválido.");
  if (!NATUREZAS_CATEGORIA.includes(c.natureza)) erros.push("Natureza inválida.");
  return erros;
}

/** Categorias sugeridas para começar — o usuário pode editar ou apagar todas. */
export function categoriasSugeridas() {
  return [
    { nome: "Moradia", grupo: "moradia", natureza: "despesa", essencial: true },
    { nome: "Mercado", grupo: "alimentacao", natureza: "despesa", essencial: true },
    { nome: "Transporte", grupo: "transporte", natureza: "despesa", essencial: true },
    { nome: "Saúde", grupo: "saude", natureza: "despesa", essencial: true },
    { nome: "Educação", grupo: "educacao", natureza: "despesa", essencial: true },
    { nome: "Lazer", grupo: "lazer", natureza: "despesa", essencial: false },
    { nome: "Assinaturas", grupo: "outros", natureza: "despesa", essencial: false },
    { nome: "Dívidas e parcelas", grupo: "dividas", natureza: "despesa", essencial: true },
    { nome: "Salário", grupo: "renda", natureza: "receita", essencial: false },
    { nome: "Renda extra", grupo: "renda", natureza: "receita", essencial: false },
  ];
}
