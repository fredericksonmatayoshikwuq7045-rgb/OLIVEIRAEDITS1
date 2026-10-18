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

## Estúdio 0.3.0

`domain/preferences` valida preferências globais em `oe_ui_v2`; o tema e as
fontes não alteram o RenderSpec nem as fontes de exportação. O catálogo de
frases é local, com seleção estável por dia local/perfil e textos pessoais.
Foto e regra de cobertura pertencem ao perfil; assets e IDs são preservados
ou remapeados ao duplicar/importar `.oeprofile`. O formato de dados continua v2.

Timeline e análise compartilham `services/filmstrip`. Desktop amostra frames
com um comando tipado que autoriza o caminho, valida tempos/tamanho e usa
FFmpeg/cache. Browser usa seek e Canvas somente na mídia ativa. `vision/content`
separa a cena dominante das molduras; `vision/ocr` carrega modelos locais; o
comparador visual usa um worker. Cinco amostras estimam estabilidade e confiança.
O usuário revisa antes de uma única alteração com histórico. A cobertura gera
camadas comuns com placa opaca e texto/logo, renderizadas pelo motor existente.

A divisão mantém uma referência ao mesmo original com trims independentes e
ajusta a janela das camadas. Alças usam geometria normalizada e um commit por
gesto. O menu contextual copia somente os grupos escolhidos pelo usuário.

## Camadas temporais e alas — 0.4.0

`domain/timeline` expõe todas as camadas e um identificador virtual para o fundo,
sem transformá-lo em overlay: isso preserva sua política de áudio e composição.
Janelas usam segundos da saída após trim/velocidade, com início inclusivo e fim
exclusivo. A divisão remapeia janelas e offsets. Campos opcionais mantêm o formato
v2; a validação do backup inclui os novos tempos, visibilidade e repetição.

`render/playback` dá uma chave por ocorrência de vídeo, inclusive para o fundo.
Cada ocorrência tem seu próprio elemento/seek, mesmo quando compartilha o arquivo.
O compositor e o motor respeitam janela, offset e repetição; o Rust desloca PTS
e atrasa/limita o áudio do fundo. Planos estáticos mantêm suas janelas individuais.
O relógio virtual de imagens usa refs e não reinicia a animação a cada atualização
React. `mediaUrl` preserva endereços `asset://` já convertidos.

`MediaAreas` filtra a visão de um único projeto; `allItems` preserva o conjunto
completo para limpar a leva. Templates podem ser compartilhados entre tipos,
continuando restritos ao perfil. `imageTime`/`imageDuration` guardam o momento e
a duração da composição; a exportação de imagem usa o momento salvo. O filtro
visual da ala não é uma separação de armazenamento nem desativa as ferramentas.

No Linux, `storage_media_url` autoriza o caminho antes de registrar uma URL em
loopback. O servidor usa tokens aleatórios por arquivo, valida Host/Origin,
responde Range/HEAD e copia em blocos limitados. Não expõe paths na URL nem abre
arquivos arbitrários recebidos por HTTP. URLs de sessão não são persistidas;
assets e caminhos originais as recriam na hidratação. Windows/macOS mantêm
`convertFileSrc`. O teste nativo verifica a autorização e ranges reais.
