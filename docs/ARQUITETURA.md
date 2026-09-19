# Arquitetura e decisões

> Decisões que valem para todas as fases. O blueprint não define tecnologia
> (ele diz isso explicitamente na página 1), então tudo aqui é escolha nossa
> e pode ser revista — mas cada revisão custa retrabalho, então estão
> registradas com o motivo.

---

## D1 — O repositório é a fonte da verdade; o artefato é o deploy

O Painel GEDI hoje é um único arquivo HTML de 143 KB / ~2.000 linhas, editado
dentro do próprio artefato. Isso funciona para um painel de uma tela. O produto
do blueprint tem 11 módulos, um motor de projeção e uma central de decisões —
umas 10x o tamanho. Em arquivo único isso vira intratável em poucas semanas.

**Decisão:** o código-fonte vive neste repositório, organizado em arquivos, e é
publicado como **artefato multi-arquivo** (o Artifact aceita `files`: CSS, JS e
dados publicados ao lado da página, referenciados por caminho relativo).

O que isso compra:

- histórico, diff e revisão de cada mudança;
- o motor financeiro roda em Node e é **testável** fora do navegador;
- várias sessões de trabalho continuam de onde a anterior parou sem reler
  2.000 linhas;
- o artefato continua sendo o produto que você abre no celular.

Restrição a respeitar: scripts externos só carregam de `cdnjs` / `jsdelivr`.
Nossos próprios arquivos são servidos pela mesma origem do artefato, então
módulos ES com caminho relativo funcionam. Na prática: **sem framework**,
JavaScript puro em módulos — igual ao GEDI, só que organizado.

## D2 — Os dados saem do HTML e vão para o banco do artefato (`db`)

Hoje o GEDI guarda o estado **dentro do HTML**: cada alteração regenera o
documento inteiro e republica (capability `artifact`). Para um painel mensal de
clientes, ok. Para uma vida financeira — transações de anos, parcelas, faturas —
isso significa reescrever o documento inteiro a cada lançamento, com teto de
16 MB e risco de perder uma edição quando duas acontecem juntas.

**Decisão:** migrar a persistência para a capability **`db`** (armazenamento de
documentos JSON do lado do servidor, fora da página).

O que isso compra:

- os dados não competem com o tamanho da página;
- escrita por documento, não regeneração do arquivo inteiro;
- `onSnapshot`: se você lança no celular, a tela do computador atualiza;
- **a IA (Fase 13) consegue ler os dados** — é isso que torna o assistente do
  §20 viável sem backend;
- caminhos privados por pessoa (`data/users/<id>/`) para o módulo Pessoas.

Custo a aceitar: última escrita vence, sem transações. Todo cálculo que combina
vários documentos é feito na leitura, nunca mantido como total gravado que
pode dessincronizar.

**Aviso de privacidade que precisa estar claro:** dados no `db` de um artefato
são legíveis por quem tem acesso ao artefato e pela Claude quando você pedir
análise. O artefato nasce privado. Compartilhar com edição (para o cônjuge, por
exemplo) dá acesso aos lançamentos. Não é cofre bancário — é um painel pessoal.
Se isso não for aceitável, a Trilha B (D6) é o caminho.

## D3 — O motor financeiro é puro e portátil

Todo cálculo — saldo comprometido, projeção, pressão de dívida, gap de renda —
vive em `src/domain/`, como funções puras: entram dados, sai resultado, sem
tocar em DOM, sem tocar em `window.claude`, sem saber que existe artefato.

Motivo: é a única parte do sistema que **não pode** ser reescrita numa eventual
migração. Se um dia o produto virar app com backend (D6), a interface muda e o
motor viaja junto, intacto. É também a parte que precisa de teste automatizado,
porque um erro de R$ 0,01 em "quanto posso gastar" destrói a confiança no
produto inteiro — e o blueprint (§31) diz que o valor do sistema é justamente
reduzir incerteza.

Regra prática: `src/domain/` não pode conter a palavra `document` nem `window`.

## D4 — Open Finance entra por um adaptador, não por dentro

O §19 pede Open Finance já na V1, mas com duas condições explícitas: "sem custo
recorrente de um plano comercial caro" e "preparado para que o projeto pessoal
não fique preso a um único fornecedor".

Open Finance de verdade (Pluggy, Belvo, Klavi e similares) exige certificado,
redirect OAuth, webhook e servidor — **nada disso cabe num artefato**. É o único
item do blueprint inteiro que obriga infraestrutura externa.

**Decisão:** definir desde a Fase 11 uma interface única de entrada de dados —
`ConectorDeDados` — com os métodos `listarContas`, `listarTransacoes`,
`saldoAtual`, `statusDaConexao`. Implementações:

| Implementação | Fase | Custo | Cobre |
|---|---|---|---|
| Manual | F1 | zero | tudo, com trabalho |
| Planilha / CSV / OFX | F11 | zero | histórico e extrato bancário |
| Google Drive (capability `mcp`) | F11 | zero | planilhas que já estão no Drive |
| Provedor de Open Finance | F12 | pago | sincronização automática |

O provedor pago vira **mais um adaptador**, atrás da mesma interface. Se o preço
não fechar, o produto continua completo — só com mais digitação. É assim que o
§19 é atendido sem que ele vire o gargalo da V1.

## D5 — Cada capability do artefato cobre um item do blueprint

Mapeamento verificado contra o contrato 0.2.52 (não é suposição):

| Capability | Cobre | Seção |
|---|---|---|
| `db` | todo o armazenamento financeiro | §3 e todas |
| `sample` | assistente de IA dentro da própria página | §20 |
| `mcp` | importar planilha do Google Drive | §18 |
| `downloads` | exportação completa dos próprios dados | §27 |
| `assets` | documentos e comprovantes anexados | §27 |
| `user` | identidade das pessoas do núcleo familiar | §3 |
| `room` | duas pessoas editando ao mesmo tempo | §3 |

Consequência prática: **o único item do blueprint que o artefato não alcança é
o §19.** Todo o resto — inclusive a IA, que parecia exigir backend — é
alcançável na Trilha A.

## D6 — Trilha A agora, Trilha B só se um gatilho disparar

**Trilha A (recomendada, é o que este plano executa):** repositório + artefato
multi-arquivo + `db`. Zero infraestrutura, zero custo recorrente, funciona no
celular hoje.

**Trilha B (app com backend próprio):** só vale a pena se um destes acontecer:

1. você contratar Open Finance e quiser sincronização automática de verdade;
2. os dados passarem do que o `db` aguenta com folga;
3. você precisar de app nativo (o §28 diz explicitamente para não fazer isso
   antes de validar a experiência central);
4. a privacidade do D2 deixar de ser aceitável.

Enquanto nenhum disparar, Trilha B é custo sem retorno. E por causa do D3, se um
dia disparar, o motor financeiro atravessa inteiro — a migração é de casca, não
de produto.

## D7 — A regra de escopo do §2 é lei, não conselho

> "Uma funcionalidade de P2 ou P3 não deve atrasar a entrega de nenhuma
> capacidade P0 ou P1 que impacte diretamente clareza, caixa, dívida, projeção
> ou decisão."

Operacionalmente: nenhuma fase P2 começa antes da Fase 7 fechar (que é o marco
da V1-P0). Ideia boa de P2 que aparecer no meio do caminho vai para o fim do
`PLANO-DE-IMPLANTACAO.md`, não para a fase atual.
