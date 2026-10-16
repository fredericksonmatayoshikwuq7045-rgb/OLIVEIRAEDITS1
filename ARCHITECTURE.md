# Arquitetura

## Linha de base e divergências encontradas

O App original concentrava 100 slots por tipo, templates, grupos e mutações.
Quatro efeitos gravavam localStorage enquanto outro restaurava IndexedDB,
permitindo corridas de inicialização. IDs numéricos eram ordem e identidade.
Os painéis importavam mídia sem passar pelo armazenamento central.

MediaStage calculava contain/pan em pixels da interface; exportação duplicava
desenho em ImageEditorPanel e ExportModal, com escala H/280. Rotação, máscara,
crop, fundos, wrapping e fontes divergiam. O PNG único sempre ficava acima
do vídeo. O export copiava vídeo inteiro para RAM e pasta de saída, tinha
fundos sem duração/loop, tempo de trim ambíguo e mostrava sucesso após falhas.
Rust aceitava argumentos crus e bloqueava o runtime esperando FFmpeg.

## Fronteiras da versão 2

- `src/domain`: identidade, perfis/projetos, histórico e operações puras.
- `src/data`: persistência versionada, assets, migração e backups.
- `src/render`: RenderSpec, geometria normalizada e compositor compartilhado.
- `src/services`: contratos tipados com o núcleo nativo e eventos reais.
- `src/ui`: contas, biblioteca, palco, propriedades, seleção e fila.
- `src-tauri/src/engine`: jobs, probe, filtergraph, subprocessos e progresso.
- `src-tauri/src/storage`: arquivos atômicos, backups, assets e concessões.

A interface modifica o projeto ativo com histórico. O compositor usa o mesmo
RenderSpec no preview e na exportação de imagem. Vídeo envia geometria e planos
de camadas para o Rust, que valida os campos e constrói os argumentos FFmpeg.
Eventos e snapshots da fila alimentam os estados visíveis; nenhum FPS/ETA é
inventado. Caminhos originais permanecem referências; só assets e overlays são
copiados para diretórios próprios do app.

O recurso Cargo `desktop` integra Tauri; o núcleo tem testes sem janela. Isso
permite validar mídia em Linux sem afirmar que o instalador Windows foi testado.
