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

// Transações — ver docs/MODELO-DE-DADOS.md, "Movimentação — Fase 1".
// tipo governa a regra que mais importa no produto inteiro (CLAUDE.md):
// transferência e pagamento de fatura NUNCA contam como receita ou despesa
// — ver domain/transacoes.js, que é onde essa regra é aplicada de fato.
export const TIPOS_TRANSACAO = ["receita", "despesa", "transferencia", "pagamento_fatura"];
export const STATUS_TRANSACAO = ["previsto", "agendado", "pago", "atrasado", "cancelado"];
export const CERTEZAS_TRANSACAO = ["confirmado", "provavel", "incerto"];
// Só mensal por enquanto: é o que cobre a esmagadora maioria das contas
// reais (aluguel, assinatura, financiamento). Semanal/anual entram se um
// caso real pedir — não antecipado sem necessidade.
export const PERIODICIDADES_RECORRENCIA = ["mensal"];
export const STATUS_FATURA = ["aberta", "fechada", "paga"];

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

export function padraoTransacao(dados = {}) {
  return {
    data: new Date().toISOString().slice(0, 10),
    competencia: "",
    valorCentavos: 0,
    tipo: "despesa",
    contaId: null,
    cartaoId: null,
    categoriaId: "",
    pessoaId: "",
    descricao: "",
    status: "pago",
    certeza: "confirmado",
    transferenciaId: null,
    direcao: null, // "entrada" | "saida" — só usado quando tipo é transferencia
    faturaId: null,
    parcelaDe: null,
    parcelaNum: null,
    parcelaTotal: null,
    recorrenciaId: null,
    origem: "manual",
    origemId: null,
    revisado: true,
    ...dados,
  };
}

export function padraoRecorrencia(dados = {}) {
  return {
    descricao: "",
    tipo: "despesa",
    valorEstimadoCentavos: 0,
    categoriaId: "",
    pessoaId: "",
    contaId: null,
    cartaoId: null,
    periodicidade: "mensal",
    diaBase: 1,
    inicio: new Date().toISOString().slice(0, 7),
    fim: null,
    ativa: true,
    ...dados,
  };
}

export function padraoFatura(dados = {}) {
  return {
    cartaoId: "",
    competencia: "",
    status: "aberta",
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
  if (!STATUS_CONTA.includes(c.status)) erros.push("Status da conta inválido.");
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

export function validarTransacao(t) {
  const erros = [];
  if (!TIPOS_TRANSACAO.includes(t.tipo)) erros.push("Tipo de transação inválido.");
  if (!t.data) erros.push("Data é obrigatória.");
  if (!Number.isFinite(t.valorCentavos) || t.valorCentavos <= 0) erros.push("Valor precisa ser maior que zero.");
  if (!t.contaId && !t.cartaoId && t.tipo !== "transferencia") erros.push("Escolha uma conta ou um cartão.");
  if (t.tipo === "despesa" && !t.categoriaId) erros.push("Despesa precisa de categoria.");
  if (t.tipo === "receita" && !t.categoriaId) erros.push("Receita precisa de categoria.");
  if (!STATUS_TRANSACAO.includes(t.status)) erros.push("Status inválido.");
  if (!CERTEZAS_TRANSACAO.includes(t.certeza)) erros.push("Certeza inválida.");
  return erros;
}

export function validarRecorrencia(r) {
  const erros = [];
  if (!r.descricao || !r.descricao.trim()) erros.push("Descrição é obrigatória.");
  if (r.tipo !== "receita" && r.tipo !== "despesa") erros.push("Tipo precisa ser receita ou despesa.");
  if (!Number.isFinite(r.valorEstimadoCentavos) || r.valorEstimadoCentavos <= 0) erros.push("Valor estimado precisa ser maior que zero.");
  if (!r.contaId && !r.cartaoId) erros.push("Escolha uma conta ou um cartão.");
  if (!r.categoriaId) erros.push("Escolha uma categoria.");
  if (!PERIODICIDADES_RECORRENCIA.includes(r.periodicidade)) erros.push("Periodicidade inválida.");
  if (r.diaBase < 1 || r.diaBase > 31) erros.push("Dia do mês inválido.");
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
