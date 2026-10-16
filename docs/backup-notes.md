# Preservação e migração de dados

O formato original usa as chaves `oe_videos`, `oe_images`, `oe_templates` e
`oe_groups` no localStorage, e o banco IndexedDB `OliveiraEditsDB`, versão 1,
object store `files`, com chaves `video-<slot>` e `image-<slot>`.

Slots contêm URLs blob transitórias, objetos File serializados como objetos
vazios, posições em porcentagem, templates por referência e camadas de texto.
Templates podem conter data URLs de imagens/vídeos e atributos adicionais.
O importador direto dos painéis antigos não gravava mídia no IndexedDB.

Antes de migrar, guardar cópias literais das quatro chaves e todos os arquivos
recuperáveis do IndexedDB. Preservar também campos desconhecidos e registros
cuja mídia não possa ser recuperada; sinalizar esses como ausentes para
re-vinculação. IDs de slot antigos são ordem, não identidade global.

A migração v2 é versionada, repetível e nunca remove nem altera os dados
originais. Somente publicar o novo workspace depois de salvar e verificar
seus assets e backup. Em erro, apresentar diagnóstico e manter os originais.
Não existe limpeza automática dos dados legados nesta atualização.

No desktop, JSON/assets ficam no diretório de dados do aplicativo, com escrita
atômica e backups. No navegador, um novo banco mantém o workspace e os assets,
separado do legado. Perfis exportados são backups adicionais; não substituem
os dados originais até o usuário conferir a migração.
