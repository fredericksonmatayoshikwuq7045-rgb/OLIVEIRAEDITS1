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

## Sequência e relógio de composição — 0.5.0

`mediaStart` é a entrada do principal; seu conteúdo continua definido por trim e
velocidade. `domain/timeline` calcula a duração pela maior saída visível e gera
um RenderSpec com janela do principal. O player mantém compatibilidade com seus
tempos de origem, convertendo cursor/relógio por `outputTime`/`playerTime`. O clock
virtual continua durante a abertura e após o fim do arquivo principal; ele não
depende mais do evento ended desse decoder. Camadas têm fase e clock próprios.

A faixa virtual `@media` participa da ordenação com as demais; `@background`
permanece como base. Reordenação atribui ordens distintas, incluindo empates.
Arraste de clipes tem preview local e um commit de histórico. Miniaturas são
amostradas somente quando a fonte muda, não a cada frame do player.
`sequence.splitLayer` preserva a fase e IDs derivados mantêm vínculo com templates.

O contrato de export inclui `outputDuration`, separado do trim da fonte. Rust
limita o principal à sua janela, desloca seus PTS e produz uma base com a duração
completa. `engine/audio` apara, atrasa, preenche e renumera timestamps em amostras,
para AAC sem lacunas durante longos silêncios. Reúne os inputs autorizados com
áudio escolhido, respeitando suas janelas; templates silenciosos são ignorados.
Plano estático de texto/imagem e layers dinâmicas mantêm tamanho e ordem.

Copiar camadas também copia a entrada do principal e sua ordem/áudio, sem trocar
a fonte ou o corte dos destinos. O esquema permanece 2; campos novos opcionais
são validados na importação do backup. Imagem continua uma saída estática.

## Organização contextual 0.6.0

`Editor` organiza o grid em recursos, player, propriedades e timeline inferior.
`useEditorPanels` guarda a navegação local sem alterar o projeto. `ResourcePanel`
conserva biblioteca e mídias montadas ao alternar abas, mantendo categoria e
rolagem; `MediaStrip` continua virtualizado. A navegação não altera o esquema 2.

`EditorProperties` mostra apenas as ferramentas da seleção. `TrackInspector`
cuida de tempos/áudio; `TrackGeometry` e o enquadramento ajustam a geometria.
`PlayerTransport` concentra reprodução, seek e comparação. `TimelineDock`
controla altura, comandos e contexto; `LayerTimeline` mantém as faixas, zoom,
miniaturas e régua comuns. O fundo sólido padrão pode ser exibido pelo menu.

`trackCommands` une os comandos de menu e teclado, incluindo principal e fundo.
Atalhos de camada consomem ações indisponíveis para impedir que recaiam sobre o
vídeo principal. Seleções inválidas após undo voltam ao principal. `ActionMenu`
usa portal, fecha por Escape/clique externo e respeita selects/teclado nativos.
`AutomationPanel` é carregado sob demanda com Suspense e limite de erro.
Os contratos de render/export e o motor FFmpeg permanecem os da 0.5.0.
