# Como publicar o painel (checklist)

O painel é um artefato multi-arquivo. Todo arquivo que o `index.html` ou outro
módulo importa precisa estar publicado: um só que falte deixa a página em
branco (aconteceu em 02/10/2026 com `navegacao.js`).

1. `npm test` passando (o teste `publicacao.test.js` falha se algum import
   aponta para arquivo que não existe).
2. Descubra o que mudou desde a última publicação:
   `node ferramentas/arquivos-para-publicar.js --desde <commit da última publicação>`
   (sem `--desde`, lista tudo).
3. Publique `index.html` com `files` = essa lista. Arquivos que ficam de fora
   são mantidos como estavam; novos ou alterados precisam estar na lista.
4. Confira: liste os arquivos publicados, salve num texto (um caminho por
   linha) e rode
   `node ferramentas/arquivos-para-publicar.js --conferir lista.txt`.
   Se faltar algo, publique o que falta antes de avisar o usuário.
5. Abra o painel com os dados reais, no celular e no desktop, e confira que o
   Início carrega.
