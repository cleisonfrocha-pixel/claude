---
name: subir-painel
description: Sobe no painel financeiro (Vida Financeira) o que o Cleison mandar do jeito dele, como texto solto, lista, print de extrato, fatura, planilha ou comprovante, ou áudio ditado pelo teclado. Use SEMPRE que ele disser "subir no meu painel", "sobe isso", "lança isso", ou mandar gastos, recebimentos, dívidas, parcelas, contas, saldos, faturas ou transferências, mesmo sem pedir explicitamente. Também para "desfaz o último envio".
---

# Subir no painel financeiro

Painel: https://claude.ai/artifact/LgXc37oyU6rwCZTguZf5j6. Os dados moram no banco
do artefato (capability `db`) e são lidos e gravados com o `ArtifactData`.

**Autorização permanente (dada pelo Cleison em 26/09/2026):** ele não quer
digitar nem confirmar item por item. Interprete, suba e depois conte o que subiu.
Pare para perguntar só quando a resposta muda dinheiro e não dá para deduzir:
qual conta, se é transferência ou gasto, valor ilegível. Nunca apague nem
sobrescreva nada fora do "desfazer" pedido por ele.

## Como fazer (sempre nesta ordem)

1. **Baixar o estado atual.** Numa única mensagem, faça `ArtifactData list` com
   `out_dir` numa pasta NOVA do scratchpad (ex.: `<scratchpad>/painel-<hora>/estado`)
   para cada coleção: `pessoas contas cartoes categorias fontesRenda dividas ativos
   objetivos recorrencias faturas transacoes lotesImportacao` (`query.limit` 1000).
   Pasta nova sempre: o `out_dir` não apaga arquivos antigos.
2. **Interpretar a mensagem** num pedido JSON (formato abaixo) e salvar como
   `<pasta>/pedido.json`. Leia o estado baixado para usar os nomes que já existem.
3. **Montar:** `node app/ferramentas/subir-painel.js montar --estado <pasta>/estado --pedido <pasta>/pedido.json --saida <pasta>/saida`
   (a partir da raiz do repositório). A ferramenta usa o próprio motor do app:
   mesmos padrões, validações, fatura por dia de fechamento, parcelas sem perder
   centavo, transferência em duas pernas e checagem de duplicata.
4. Se algo caiu em **FICOU DE FORA** por erro seu de interpretação (nome errado,
   categoria de natureza trocada), corrija o pedido e rode de novo. Se é dúvida
   real, deixe de fora e pergunte no fim.
5. **Gravar:** para cada lote em `<pasta>/saida/escritas.json`, um
   `ArtifactData batch` com `url` do painel e `writes` = as entradas exatamente
   como estão (op, collection, doc_id, file_path).
6. **Responder curto:** o que subiu (as linhas de "VAI SUBIR"), o que ficou de
   fora com a pergunta direta, e "se algo saiu errado, diga *desfaz o último envio*".

## Formato do pedido

```json
{ "mensagemOriginal": "texto que ele mandou (print: descreva e transcreva)",
  "hoje": "AAAA-MM-DD",
  "itens": [ ... ] }
```

Valores sempre em reais, como vieram ("1.290,50", "350", 4500). Nunca centavos.
Datas `AAAA-MM-DD`; sem data = hoje ("ontem", "dia 5" você converte).
Referências por nome (sem acento/caixa, primeiro nome serve). `pessoa` omitida =
o titular. Itens do mesmo pedido podem usar o que outro item acabou de criar.

| acao | campos |
|---|---|
| `despesa` / `receita` | `valor`, `conta` ou `cartao` (receita só conta), `categoria`, `descricao`, `data`, `pessoa`, `fonteRenda` (receita), `status` (pago/previsto/agendado/atrasado), `certeza` (confirmado/provavel/incerto), `forcar` |
| `transferencia` | `valor`, `de`, `para`, `data`, `descricao` |
| `parcelamento` | `valorTotal`, `parcelas`, `cartao` ou `conta`, `categoria`, `descricao`, `data` (1ª parcela) |
| `pagamento_fatura` | `valor`, `cartao`, `conta` (padrão: a de pagamento do cartão), `competencia` (AAAA-MM, opcional), `data` |
| `criar` | `colecao` + `dados` (abaixo) |
| `atualizar` | `colecao`, `ref` (nome), `campos` |
| `pagar_parcela_divida` | `divida`, `quantidade` (padrão 1) |

`criar`/`atualizar` aceitam `pessoa`, `conta`, `categoria`, `cartao` por nome e
valores em reais sem o sufixo `Centavos` (ex.: `saldoOriginal`, `valorParcela`,
`saldoInicial`, `valorEsperado`, `valorAtual`, `valorAlvo`, `valorEstimado`,
`limiteTotal`). Inteiros (`quantidadeParcelas`, `parcelasPagas`, `diaBase`,
`diaFechamento`) como número. Campos por coleção:

- `contas`: nome, instituicao, tipo (corrente/poupanca/investimento/dinheiro/outra), saldoInicial, dataSaldoInicial, ehReserva
- `cartoes`: apelido, conta (paga a fatura), bandeira, limiteTotal, diaFechamento, diaVencimento
- `categorias`: nome, grupo (moradia/transporte/alimentacao/saude/educacao/lazer/dividas/renda/outros), natureza (receita/despesa), essencial
- `fontesRenda`: nome, tipo (fixa/recorrente/variavel/eventual), valorEsperado
- `dividas`: nome, credor, saldoOriginal, valorParcela, quantidadeParcelas, parcelasPagas, dataInicio, taxaJurosMensalPct, emRisco
- `ativos`: nome, classe (liquido/investimento/veiculo/imovel/participacao/outro), valorAtual, dataAvaliacao
- `objetivos`: nome, valorAlvo, valorAtual, prazo, conta (vinculada)
- `recorrencias`: descricao, tipo (receita/despesa), valorEstimado, conta ou cartao, categoria, diaBase, inicio (AAAA-MM). Já gera os previstos dos próximos 3 meses.
- `pessoas`: nome, papel (titular/conjuge/dependente/outro)

## Regras de interpretação (as do produto, não negociáveis)

- **Dinheiro entre contas dele é `transferencia`**, nunca receita nem despesa.
- **Pagar a fatura é `pagamento_fatura`**, nunca despesa: as compras já contaram.
  Compra no cartão é `despesa` com `cartao`.
- **"Paguei a parcela da dívida X"** = `despesa` (categoria "Dívidas e parcelas",
  da conta de onde saiu) **e** `pagar_parcela_divida`. Só a despesa se ele não
  tiver a dívida cadastrada e não der os dados dela; aí pergunte se quer cadastrar.
- **Incerto não é garantido:** "acho que", "talvez", "se o cliente pagar" =
  `status: previsto` + `certeza: incerto`; "vai cair dia 10" = previsto + provavel.
- **"Tenho X na conta Y agora"** = `atualizar` a conta com `saldoInicial: X` e
  `dataSaldoInicial: hoje`. Lançamentos até hoje já estão dentro desse saldo.
  Não use isso para "recebi X": isso é receita.
- Categoria: use uma existente; crie (`criar categorias`) só se nenhuma servir.
  Conta, cartão ou fonte de renda que ele citar e não existir: crie antes de usar,
  se a mensagem deixar claro o que é; senão pergunte.
- Não invente valor, data de dívida ou número de parcelas. Faltou? Pergunte.
- Print: leia cada linha. Etiquetas tipo "PAGO"/"RECEBIDO" = status pago;
  sem etiqueta ou "A PAGAR" = previsto. Linha "TOTAL" não é lançamento.
- Áudio: você não recebe arquivo de áudio. Peça para ele usar o microfone do
  teclado do celular, que vira texto.

## Desfazer

"Desfaz o último envio": baixe o estado (passo 1), pegue em `lotesImportacao` o
de `formato: "chat"` com `criadoEm` mais recente, rode
`node app/ferramentas/subir-painel.js desfazer --estado <pasta>/estado --lote <id> --saida <pasta>/saida`
e grave com `batch` como no passo 5. Apaga o que o envio criou e devolve o que ele
alterou (ex.: parcelas pagas da dívida).

## O que fica marcado no painel

Todo lançamento do chat nasce com `origem: "chat"` e `revisado: false`: aparece
com a etiqueta "não revisado" em Transações. O texto original fica em Dinheiro ›
Importar › histórico, como "Enviado pelo chat".
