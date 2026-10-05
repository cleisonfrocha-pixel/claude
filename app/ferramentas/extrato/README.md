# Leitura de extratos (Fase 12)

Fluxo para subir um extrato sem palpite:

1. **Ler** o arquivo com o script da conta (`ler_next.py`, `ler_bb.py`, `ler_nubank_csv.py`).
2. **Classificar** as linhas num `pedido.json` da skill `subir-painel`, com
   `idExterno` em cada item (UUID do Nubank, documento do banco).
3. **Conferir**: no pedido, `conferencias: [{conta, saldoAnterior, movimentos: [..], saldoFinal}]`
   com os movimentos tirados direto das linhas lidas. Se o saldo não fecha, o
   `subir-painel.js montar` recusa o pedido inteiro e diz quanto falta.
4. **Montar e gravar** como na skill. Reimportar o mesmo extrato é seguro: o `idExterno`
   repetido vira pendência ("já importado"), mesmo com `forcar`.

Dados pessoais (nomes, valores) ficam fora do repositório: só os leitores moram aqui.
