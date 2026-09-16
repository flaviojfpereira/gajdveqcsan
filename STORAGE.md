# Storage

Os votos **não** vivem no browser e **não** vivem no `data/database.json`.

Fonte de verdade: Firestore (project `boreal-agency-wpthm`, database named
`ai-studio-gajdveqcsan5v5cs-64e39e14-55f4-4473-aafa-2ceb3b9eb0da`).

O frontend subscreve `users`, `votes`, `comments`, `teams` em tempo real.
Qualquer browser que abra a app vê o mesmo estado.

O `database.json` no git é só seed local. Está limpo: só o Flávio, zero votos.
O `/api` em serverless já não relê esse ficheiro — o `/tmp` da Vercel não é
storage partilhado.

Se a barra no topo ficar vermelha (`permission-denied`), as rules deste
database named ainda não estão publicadas. Publica `firestore.rules` nesse
database exacto (não no `(default)`, que neste projecto nem existe).
