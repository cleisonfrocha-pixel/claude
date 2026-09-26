# Sistema de Gestão Financeira Pessoal/Familiar

Produto construído sobre a base do **Painel GEDI**, seguindo o
`Blueprint de Produto V1` (31 seções).

## Antes de escrever qualquer código, leia

1. `docs/PLANO-DE-IMPLANTACAO.md` — as 16 fases, a fase atual e o portão dela
2. `docs/ARQUITETURA.md` — as 7 decisões que valem para todas as fases
3. `docs/RASTREABILIDADE.md` — o que já foi entregue do blueprint
4. `docs/MODELO-DE-DADOS.md` — as coleções e o que cada campo significa

## Regras do domínio — não negociáveis

- **Centavos em inteiro.** Dinheiro é `int`. Formatação só na borda da tela.
- **Transferência entre contas próprias não é receita nem despesa.** Nunca.
- **Compra no cartão ≠ pagamento da fatura.** Contar as duas coisas é contar
  o dinheiro duas vezes.
- **Simulação não escreve no dado real.** Cenário fica em coleção separada.
- **Incerto não é dinheiro garantido.** Projeção separa confirmado, provável e
  incerto, e nunca soma incerto no saldo seguro.
- **Nada de total gravado.** Saldo e indicadores são calculados na leitura.
- **Todo alerta e toda ação apontam os dados que os originaram.** Exigência do
  §9 e do §17 — sem isso o produto vira palpite.

## Regras de código

- `src/domain/` é puro: sem `document`, sem `window`, sem `claude`. É o que
  torna o motor testável e portátil (decisão D3).
- Sem framework. JavaScript em módulos ES, publicados como artefato
  multi-arquivo.
- Scripts externos só de `cdnjs` ou `jsdelivr`. Nossos arquivos são da mesma
  origem e carregam por caminho relativo.
- Toda mudança no motor financeiro vem com teste.

## Regra de escopo (§2 do blueprint)

Nenhuma funcionalidade P2 ou P3 entra antes de a Fase 9 fechar. Ideia boa que
aparecer no meio do caminho vai para o fim do plano, não para a fase atual.

## Dados do usuário chegam pelo chat

Quando o Cleison mandar gastos, recebimentos, dívidas, prints ou saldos, use a
skill `subir-painel` (`.claude/skills/subir-painel/SKILL.md`): ele autorizou
subir direto no painel sem confirmar item por item. A ferramenta
`app/ferramentas/subir-painel.js` monta os registros com o motor do app; nunca
grave documentos no banco montados à mão.

## Ao fim de cada sessão

1. Portão da fase verificado com o produto na mão
2. Testes do motor passando
3. Commit na branch com a fase no nome
4. Artefato republicado a partir do repositório
5. `docs/RASTREABILIDADE.md` atualizado
