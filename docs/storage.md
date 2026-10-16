# Armazenamento, backups e recuperação

O aplicativo desktop guarda estado no `app_data_dir` resolvido pelo Tauri para
`com.oliveira.masseditor`. A localização depende do sistema operacional; o command
`storage_get_paths` informa `dataDir`, `cacheDir`, `logDir`, `engineLogDir` e
`appLogDir`, sem expor conteúdo de credenciais.

## Arquivos de trabalho

- `settings.json`: índice de perfis/projetos e configurações da aplicação.
- `profiles/<UUID>/profile.json`: identidade, templates, grupos, presets e opções.
- `profiles/<UUID>/assets/`: cópias deliberadas de templates, fontes e mídia
  recuperada do formato antigo. Importar um asset nunca remove sua origem.
- `projects/<UUID>.json`: slots e seus caminhos de mídia, probes e edições.
- `.internal/path-grants.json`: permissões locais concedidas pelo seletor nativo.
- `logs/frontend.log`: erros do frontend; rotação em 2 MiB com duas gerações.

Vídeos importados por caminho no desktop continuam no local original: o projeto
guarda `sourcePath`, e o FFmpeg lê esse caminho diretamente. Mover ou remover a
mídia exige re-vincular o item; nenhum arquivo ausente é substituído por um slot
novo silenciosamente.

No navegador, o modo de desenvolvimento usa IndexedDB e assets próprios. Esse
armazenamento pertence à origem do navegador e não substitui o diretório de dados
do aplicativo instalado. Exportação de vídeos exige o backend desktop.

## Gravação e recuperação

Cada JSON é validado antes da gravação. O aplicativo escreve um arquivo temporário
na mesma pasta, sincroniza seu conteúdo e publica por substituição atômica.
Windows usa `MoveFileExW` com substituição e gravação sincronizada, evitando apagar
o destino antes de renomear. Os dois estados anteriores ficam em `.bak` e `.bak.1`.
Se a preparação do backup ou a substituição falhar, o estado anterior permanece.

Ao ler um JSON inválido, a leitura tenta `.bak` e `.bak.1` e registra a recuperação
no log. O arquivo corrompido não é regravado durante essa leitura. Se nenhum arquivo
for válido, a operação falha com mensagem de recuperação; não inicia estado vazio
por conta própria.

Para recuperar manualmente:

1. Feche o aplicativo e copie **todo** o diretório de dados para outra pasta.
2. Preserve o arquivo com problema com um nome novo, fora do diretório original.
3. Valide o JSON do backup e restaure uma cópia para o nome original.
4. Abra o aplicativo e confira perfis, templates, projetos e vínculos de mídia.

As gravações de perfil/projeto são atômicas por arquivo. O índice é publicado por
último; isso evita referenciar um novo perfil cuja gravação ainda não terminou.
Uma interrupção entre arquivos existentes ainda pode exigir restaurar versões
compatíveis dos backups. Um `.oeprofile` exportado é a cópia portátil indicada
antes de alterações grandes e para mover uma conta entre computadores.

## Migração do formato antigo

A migração lê `oe_videos`, `oe_images`, `oe_templates` e `oe_groups` e recupera os
arquivos disponíveis em IndexedDB `OliveiraEditsDB/files`. Os dados originais são
preservados: não limpe o armazenamento do navegador/WebView antes de conferir o
perfil migrado e exportar um backup. Templates data URL viram assets de perfil;
um arquivo sem caminho recuperável precisa ser re-vinculado. Falhas são informadas
sem apagar a origem. Veja também [backup-notes.md](backup-notes.md).

## Caminhos permitidos

Os commands de estado aceitam apenas caminhos relativos dentro dos dados do app.
Eles rejeitam `..`, caminhos absolutos, segmentos ocultos, nomes reservados do
Windows e links simbólicos que possam escapar da raiz. JSON tem limite de 32 MiB;
assets têm limite de 256 MiB. Esses limites evitam carregamentos sem controle.

Um caminho externo precisa ter sido escolhido no seletor nativo do Tauri.
`storage_authorize_paths` confere o escopo dinâmico do plugin antes de persistir a
autorização: um arquivo concede acesso àquele arquivo; uma pasta escolhida concede
acesso aos seus descendentes. A aplicação restaura apenas essas permissões no
escopo de arquivos e no protocolo de mídia ao iniciar. Um `.oeprofile` importado
não concede acesso automático a caminhos externos de outro computador.

Para revogar permissões persistidas, feche o aplicativo, faça um backup e remova
`.internal/path-grants.json` e seus backups. Os projetos continuam presentes, mas
os caminhos externos precisam ser selecionados novamente. Não edite esse arquivo
para conceder acesso indiscriminado a todo o disco.

## Imagens e arquivos de saída

`storage_export_image` valida pasta autorizada, nome, formato PNG/JPG/WebP,
assinatura de bytes e tamanho até 64 MiB. Ele recusa saída igual à mídia original
e publica a imagem completa por substituição atômica. Pular e acrescentar sufixo
são políticas explícitas de conflito. Sem identificar a origem, o command recusa
sobrescrever um arquivo existente. Falhas preservam o original e a saída anterior.

Temporários e overlays de exportação pertencem ao cache do aplicativo, separado
das pastas de saída. Os logs de FFmpeg ficam em `engineLogDir`, e os logs do plugin
nativo ficam em `appLogDir`. Esses locais podem conter nomes/caminhos de arquivos;
revise o conteúdo antes de compartilhar um diagnóstico.
