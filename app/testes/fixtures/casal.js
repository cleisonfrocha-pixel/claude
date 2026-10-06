// Casal de teste: uma casa realista (renda variável dele, salário fixo
// dela, dois cartões — um que fecha no fim do mês —, financiamento,
// empréstimo, duas dívidas no Serasa e três meses de extrato), montada
// pela MESMA ferramenta do chat que o usuário usa (ferramentas/subirPainel.js).
// testes/casal.test.js confere cada número principal contra a conta feita
// à mão. Se uma mudança no motor mexer em qualquer número, o teste diz qual.

import { montarEscritas } from "../../ferramentas/subirPainel.js";
import { categoriasSugeridas } from "../../src/domain/esquema.js";

export const HOJE = "2026-09-28";
export const COMPETENCIA = "2026-09";

export function montarCasal() {
  const estado = { pessoas: [], contas: [], cartoes: [], categorias: [], fontesRenda: [], dividas: [], ativos: [], objetivos: [], recorrencias: [], faturas: [], transacoes: [], lotesImportacao: [] };
  let seq = 0;
  const gerarId = () => `id${String(++seq).padStart(5, "0")}`;
  const pendencias = [];
  const aplicar = (escritas) => {
    for (const e of escritas) {
      const lista = estado[e.collection] || (estado[e.collection] = []);
      const i = lista.findIndex((d) => d.id === e.doc_id);
      if (e.op === "set") { if (i >= 0) lista[i] = { id: e.doc_id, ...e.data }; else lista.push({ id: e.doc_id, ...e.data }); }
      else if (e.op === "update") Object.assign(lista[i], e.data);
      else if (e.op === "delete") lista.splice(i, 1);
    }
  };
  const HOJE_LOCAL = HOJE;
  const subir = (nome, itens) => {
    const r = montarEscritas({ estado, pedido: { mensagemOriginal: nome, hoje: HOJE_LOCAL, itens }, agora: `${HOJE_LOCAL}T12:00:00Z`, gerarId });
    aplicar(r.escritas);
    pendencias.push(...r.pendencias.map((p) => `${nome}: item ${p.item} ${p.motivo}`));
    return r;
  };

  // Categorias sugeridas, como o app semeia no primeiro uso.
  for (const c of categoriasSugeridas()) estado.categorias.push({ id: gerarId(), ...c, ativa: true });

  subir("cadastro", [
    { acao: "criar", colecao: "pessoas", dados: { nome: "Cleison", papel: "titular" } },
    { acao: "criar", colecao: "pessoas", dados: { nome: "Ana", papel: "conjuge" } },
    { acao: "criar", colecao: "contas", dados: { nome: "Nubank Cleison", instituicao: "Nubank", tipo: "corrente", saldoInicial: "1.240,00", dataSaldoInicial: HOJE_LOCAL, pessoa: "Cleison" } },
    { acao: "criar", colecao: "contas", dados: { nome: "Itaú Ana", instituicao: "Itaú", tipo: "corrente", saldoInicial: "380,00", dataSaldoInicial: HOJE_LOCAL, pessoa: "Ana" } },
    { acao: "criar", colecao: "contas", dados: { nome: "Caixinha reserva", instituicao: "Nubank", tipo: "poupanca", saldoInicial: "900", dataSaldoInicial: HOJE_LOCAL, ehReserva: true, pessoa: "Cleison" } },
    { acao: "criar", colecao: "cartoes", dados: { apelido: "Roxinho", conta: "Nubank Cleison", bandeira: "mastercard", limiteTotal: "4.500", diaFechamento: 3, diaVencimento: 10, pessoa: "Cleison" } },
    { acao: "criar", colecao: "cartoes", dados: { apelido: "Itaú Click", conta: "Itaú Ana", bandeira: "visa", limiteTotal: "2.000", diaFechamento: 25, diaVencimento: 5, pessoa: "Ana" } },
    { acao: "criar", colecao: "fontesRenda", dados: { nome: "Salário Ana", tipo: "fixa", valorEsperado: "3.200", pessoa: "Ana" } },
    { acao: "criar", colecao: "fontesRenda", dados: { nome: "Projetos Cleison", tipo: "variavel", valorEsperado: "7.000", pessoa: "Cleison" } },
    { acao: "criar", colecao: "dividas", dados: { nome: "Financiamento carro", credor: "BV", saldoOriginal: "32.000", valorParcela: "1.150", quantidadeParcelas: 48, parcelasPagas: 19, dataInicio: "2025-02-15", taxaJurosMensalPct: 1.8, pessoa: "Cleison" } },
    { acao: "criar", colecao: "dividas", dados: { nome: "Empréstimo pessoal", credor: "Nubank", saldoOriginal: "6.000", valorParcela: "480", quantidadeParcelas: 18, parcelasPagas: 5, dataInicio: "2026-04-20", taxaJurosMensalPct: 4.5, pessoa: "Cleison" } },
    { acao: "criar", colecao: "dividas", dados: { nome: "Cartão antigo Serasa", credor: "Santander", saldoOriginal: "4.200", valorParcela: 0, quantidadeParcelas: 1, parcelasPagas: 0, dataInicio: "2024-11-10", taxaJurosMensalPct: 8, negativada: true, pessoa: "Ana" } },
    { acao: "criar", colecao: "dividas", dados: { nome: "Loja Serasa", credor: "Casas Bahia", saldoOriginal: "850", valorParcela: 0, quantidadeParcelas: 1, parcelasPagas: 0, dataInicio: "2025-06-01", negativada: true, pessoa: "Cleison" } },
    { acao: "criar", colecao: "ativos", dados: { nome: "Carro", classe: "veiculo", valorAtual: "48.000", dataAvaliacao: HOJE_LOCAL, pessoa: "Cleison" } },
    { acao: "criar", colecao: "recorrencias", dados: { descricao: "Aluguel", tipo: "despesa", valorEstimado: "1.800", conta: "Nubank Cleison", categoria: "Moradia", diaBase: 10, inicio: "2026-10", pessoa: "Cleison" } },
    { acao: "criar", colecao: "recorrencias", dados: { descricao: "Internet", tipo: "despesa", valorEstimado: "120", conta: "Itaú Ana", categoria: "Moradia", diaBase: 15, inicio: "2026-10", pessoa: "Ana" } },
  ]);

  // Três meses de extrato, como ele vai mandar.
  const meses = [
    { c: "2026-07", rendaC: "8.200", luz: "240", mercado: ["620", "410", "380"], lazer: "350", gas: "400" },
    { c: "2026-08", rendaC: "5.600", luz: "265", mercado: ["590", "450", "300"], lazer: "180", gas: "420" },
    { c: "2026-09", rendaC: "6.900", luz: "251", mercado: ["640", "390"], lazer: "420", gas: "390" },
  ];
  for (const m of meses) {
    const d = (dia) => `${m.c}-${String(dia).padStart(2, "0")}`;
    subir(`extrato ${m.c}`, [
      { acao: "receita", valor: "3.200", conta: "Itaú Ana", categoria: "Salário", fonteRenda: "Salário Ana", descricao: "Salário", data: d(5), pessoa: "Ana" },
      { acao: "receita", valor: m.rendaC, conta: "Nubank Cleison", categoria: "Renda extra", fonteRenda: "Projetos Cleison", descricao: "Projetos", data: d(12), pessoa: "Cleison" },
      { acao: "despesa", valor: "1.800", conta: "Nubank Cleison", categoria: "Moradia", descricao: "Aluguel", data: d(10), pessoa: "Cleison" },
      { acao: "despesa", valor: m.luz, conta: "Itaú Ana", categoria: "Moradia", descricao: "Luz", data: d(18), pessoa: "Ana" },
      { acao: "despesa", valor: "120", conta: "Itaú Ana", categoria: "Moradia", descricao: "Internet", data: d(15), pessoa: "Ana" },
      { acao: "despesa", valor: "1.150", conta: "Nubank Cleison", divida: "Financiamento carro", descricao: "Parcela carro", data: d(15), pessoa: "Cleison" },
      { acao: "despesa", valor: "480", conta: "Nubank Cleison", divida: "Empréstimo pessoal", descricao: "Parcela empréstimo", data: d(20), pessoa: "Cleison" },
      ...m.mercado.map((v, i) => ({ acao: "despesa", valor: v, cartao: "Roxinho", categoria: "Mercado", descricao: "Mercado", data: d(4 + i * 9), pessoa: "Cleison" })),
      { acao: "despesa", valor: m.gas, cartao: "Roxinho", categoria: "Transporte", descricao: "Gasolina", data: d(8), pessoa: "Cleison" },
      { acao: "despesa", valor: m.lazer, cartao: "Itaú Click", categoria: "Lazer", descricao: "Restaurante", data: d(14), pessoa: "Ana" },
      { acao: "despesa", valor: "55,90", cartao: "Roxinho", categoria: "Assinaturas", descricao: "Streaming", data: d(2), pessoa: "Cleison" },
      { acao: "transferencia", valor: "800", de: "Nubank Cleison", para: "Itaú Ana", data: d(13), descricao: "Pra casa" },
    ]);
  }
  // Faturas pagas (Roxinho vence dia 10, Itaú dia 5).
  subir("pagamentos de fatura", [
    { acao: "pagamento_fatura", valor: "1.400", cartao: "Roxinho", data: "2026-07-10" },
    { acao: "pagamento_fatura", valor: "1.865,90", cartao: "Roxinho", data: "2026-08-10" },
    { acao: "pagamento_fatura", valor: "1.815,90", cartao: "Roxinho", data: "2026-09-10" },
    { acao: "pagamento_fatura", valor: "350", cartao: "Itaú Click", data: "2026-08-05" },
    { acao: "pagamento_fatura", valor: "180", cartao: "Itaú Click", data: "2026-09-05" },
  ]);

  // Recorrências geram os previstos pela ferramenta; o id das transações
  // de recorrência (gerado no app) não importa aqui.
  return { estado, pendencias };
}
