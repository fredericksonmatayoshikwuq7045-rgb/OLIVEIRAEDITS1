# Relatório de implementação — Oliveira Edits 2

Versão atual: **0.3.1**, com limpeza da leva em 18/10/2026.
Detalhes do botão **Limpar todas** no [README](README.md). A limpeza passou
em teste real de navegador: cancelar/Escape, uma única ação de desfazer/refazer,
nova leva no slot 1, reload e preservação de originais, biblioteca e outra conta.
Os 105 testes de dados/frontend, os checks de qualidade e o build desktop Linux
pelo CLI Tauri também passaram.
Evidência: [limpeza da leva](docs/validation/clear-media-2026-10-18.json).

A atualização de estúdio 0.3.0 foi entregue em 17/10/2026. Frases, foto,
personalização, layouts, edição pelo mouse, timeline e assistentes de análise
estão implementados. Os resultados desta rodada e as instruções estão em
[release 0.3.0](docs/release-0.3.0.md). As seções abaixo mantêm o relatório
histórico da reconstrução 0.2.0 e das correções intermediárias.

Data da base: 16/10/2026. Branch: `refactor/v2`. Plataforma de execução: Linux x86_64.

Revisão de bugs em 17/10/2026: importação por pasta e janelas de subprocessos
Windows corrigidas, junto de slots, revinculação, cache e relatório de exportação.
Esta rodada passou com 91 testes frontend/dados, 35 testes Rust, importação real
de pasta com 501 imagens, integração Tauri Linux e build pelo CLI.
Evidências e limites: [correções de 17/10/2026](docs/bugfixes-2026-10-17.md).

## Resultado e revisão do plano

As onze fases receberam implementação ou justificativa verificável. O editor
agora tem contas isoladas, render compartilhado, crop e lote, persistência com
migração preservadora e um motor Rust que produz arquivos realmente editados.
O aplicativo Tauri foi compilado e exercitado em uma janela Linux real.
**O instalador Windows não foi gerado nem executado nesta máquina.**

Antes da implementação, a revisão propôs: preservar literalmente o legado,
separar contratos do editor, dividir overlays pela ordem das camadas, testar o
núcleo sem exigir janela, distinguir pausa de cancelamento e medir os resultados
reais. As decisões estão em [DECISIONS.md](DECISIONS.md).

Dois critérios do plano precisavam de ajuste: nenhuma configuração de codec
garante que uma rede social deixe de reprocessar uploads; e H.264/4:2:0 não pode
ser idêntico em pixels ao Canvas. Foram adotados codecs/contêiner verificáveis e
comparação visual com tolerância explícita, sem prometer esses resultados externos.

## Entrega por fase

| Fase | Resultado |
| --- | --- |
| 1 — preparação | Código antigo mapeado, branch e commit de revisão, backups documentados, dependências e TypeScript estrito revisados. |
| 2 — motor | Jobs tipados, probe, sidecars, workers, eventos, progresso real, logs, pausa, cancelamento de processos, retomada, conflitos, espaço e saída atômica. |
| 3 — metadados | Toggle por conta/job, remux ou reencode profundo, limpeza de imagem, antes/depois, originais mantidos ou movidos para `oe-originais`, ExifTool opcional detectado. |
| 4 — render | RenderSpec/geométria compartilhados, Canvas para imagem/texto, planos estáticos ordenados e vídeo dinâmico, rotação/flip/círculo/fundos, frame e trecho de prévia FFmpeg. |
| 5 — enquadramento | Modos cover/contain/stretch/original/blur, handles, crop livre/travado, rotação, flip, guias/safe zone, snap, mouse/pinça/setas, presets e aplicação relativa em lote. |
| 6 — dados | Shards JSON nativos, escrita atômica com backups, debounce, URLs centralizadas, arquivos ausentes e re-vínculo, migração sem apagar legado, `.oeprofile`. |
| 7 — contas | Identidade, busca, edição/duplicação/arquivo/exclusão confirmada/ordenação, projetos e configurações próprios, conta ativa visível. |
| 8 — produtividade | Nomes variáveis, fila persistida, retry de falhas, relatório, notificações, mix com semente, headlines, sort, grid virtual, trims e velocidade em lote. |
| 9 — interface | Tema escuro/vermelho pt-BR, três zonas, etapas, controles contextuais, ajuda/atalhos, estados de salvamento e falha, configurações e error boundaries. |
| 10 — segurança/build | Escopos dinâmicos, CSP, comandos validados, logs rotativos, NSIS configurado, ícones desktop, scripts, README e workflow Windows manual. |
| 11 — validação | Suítes, 20 mídias reais, 9 comparações visuais, migração, 501 imagens, ponte Tauri e fechamento nativo; detalhes abaixo. |

Opcionais não incluídos: intro/outro, biblioteca global de templates e ponto
focal. Validações de hardware estão em
[PENDING.md](PENDING.md). Não há controles que anunciem essas funções como prontas.

## Verificação executada na base 0.2.0

| Verificação | Resultado observado |
| --- | --- |
| Vitest | **54/54**, 7 arquivos: geometria/crop/snap, lote, migração, histórico e recuperação/validação de backup. |
| Rust sem desktop | **33/33**: argumentos/filtergraph, progresso, probe, fila/backup, espaço insuficiente, escopos, armazenamento e imagem original. |
| Build web | `npm run build` passou (TypeScript + Vite). |
| Qualidade | ESLint, Prettier, `check:files` e `git diff --check` passaram. Código novo, inclusive CSS/scripts/testes, até 300 linhas por arquivo. |
| Desktop Linux | `cargo check` e build do binário passaram com GTK/WebKitGTK; a janela real usou IPC Tauri. |
| Build pelo CLI Tauri | Após corrigir os pares de versões, `npm run tauri build -- --debug --no-bundle` passou com o CLI real no Linux. |
| Núcleo Windows | `cargo check --no-default-features --target x86_64-pc-windows-msvc` passou. Não é build do aplicativo Windows. |
| Mídia | **20/20** exports editados, verificações FFprobe, dimensões, H.264/yuv420p/BT709, áudio AAC 48 kHz, duração, faststart, overlays e tags sensíveis. |
| Mídia adicional | Loop de fundo curto animado, metadata-only de vídeo e JPEG com EXIF, origem intacta, corrupto/ausente, diretório inválido/sem permissão, dimensões ímpares e cancelamento. |
| Paridade visual | **9/9**, Canvas Chromium contra frame FFmpeg; rotação, crop/pan, flip, círculo, texto e fundos/camadas. |
| Navegador | **7 checks**, incluindo PNG real 1080×1920, pinça/histórico, reload, isolamento, 501 imagens com menos de 40 slots no DOM e roundtrip `.oeprofile`; zero pageErrors. |
| Migração real | **3 checks**, IndexedDB/JSON antigos semeados antes de abrir; mídia, texto, template e grupo recuperados, bruto e arquivo original intactos, ausentes explícitos. |
| Tauri nativo | **8 checks**: health, probe/thumbnail, job/progresso/saída, prévia sem pasta, arquivo fora de escopo recusado, original protegido, cancelar e retomar Full HD. |
| Fechamento nativo | **4 checks**: pedido real WM_DELETE_WINDOW, continuar preserva fila, sair cancela/persiste/limpa, dados preservados e janela efetivamente encerrada. |
| Dependências JS | `npm audit`: **0 vulnerabilidades** reportadas. `cargo audit` não instalado. |

O script de instalação completo da nuvem foi reexecutado com `npm ci`, setup de
sidecars, testes, qualidade, build e check desktop. O mesmo smoke do navegador
passou também no bundle de produção servido por Vite preview, sem HMR.

As vinte entradas incluem aspectos vertical/horizontal/quadrado, SDR de 10 bits,
áudio/sem áudio, rotação em side data e tags GPS falsas. As fontes são sintéticas;
isso não equivale a testar todo arquivo de celular ou toda GPU disponível.

A paridade exige erro médio por canal abaixo de 7/255 e menos de 8% de pixels
com diferença acima de 35/255. O pior erro médio observado foi **3,191/255** e
a maior fração desses pixels foi **3,39%**. Diferenças de antialiasing, compressão
e navegador continuam possíveis; a garantia não é identidade bit a bit.

Evidências portáveis: [resumo JSON](docs/validation/summary-2026-10-16.json),
[20 mídias](docs/validation/media-2026-10-16.json) e
[paridade](docs/validation/parity-2026-10-16.json). Os caminhos `/tmp` nesses
relatórios identificam os artefatos desta execução. A pendência de fechamento
no relatório do harness de mídia é coberta pelo teste Tauri separado no resumo.
Disco cheio físico continua pendente; a guarda de espaço foi testada com zero
bytes disponíveis e a falha de permissão foi exercitada de verdade.

## Falhas encontradas e corrigidas durante a validação

- O ambiente não tinha Rust e headers Tauri. Foram instalados em diretórios
  privados da nuvem, usando fontes oficiais e pacotes assinados.
- O teste de rotação inicialmente gerava um arquivo sem side data. A fixture
  foi corrigida e agora exige rotação real antes de testar o export.
- O teste de loop olhava uma região estática. Uma faixa animada tornou o teste
  capaz de detectar congelamento do fundo.
- A inicialização Tauri podia consultar estado antes de registrá-lo em falhas
  de setup; a guarda usa `try_state`.
- Gradiente/máscara por `geq` a cada frame eram lentos em Full HD. PNGs constantes
  são preparados uma vez, preservando alfa e a equivalência medida.
- A revisão final encontrou referência de asset ausente perdida no autosave e
  backup incompleto aceito. Ambos foram corrigidos com 12 regressões novas.
- Um slider tinha rótulo acessível ambíguo; agora recebe nome explícito e o teste
  de pinça o localiza pelo papel acessível.
- A primeira tentativa de build Windows do usuário identificou API JavaScript
  2.12.4 versus Rust 2.11.3 e notification 2.7.0 versus 2.4.0. O erro também foi
  reproduzido na nuvem pelo CLI, antes de compilar. As versões compatíveis foram
  fixadas (API 2.11.1/Rust 2.11.3; notification 2.4.0 nos dois lados), com lockfile
  atualizado. O CLI compilou o desktop Linux, e os 54 testes/ESLint/audit passaram
  novamente. Isso resolve a checagem de versões; o instalador NSIS Windows ainda
  requer uma execução concluída na plataforma de destino.
- HMR e reutilização de sessão WebDriver encerrada interromperam tentativas de
  automação. As execuções finais usam código estável e sessão nativa nova; os
  resultados aprovados acima são dessas execuções concluídas.

## Checklist do legado

Cada linha agrupa problemas equivalentes do checklist original. `[x]` indica
implementação e evidência nos testes citados; limites específicos estão explícitos.

### Export/backend

- [x] Erro FFmpeg não vira sucesso; relatório distingue falha/cancelado/pulado.
- [x] Comando genérico bloqueante removido; worker/processos fora do runtime.
- [x] Métricas falsas removidas; valores vêm do progresso, probe e arquivos.
- [x] Cancelamento encerra subprocessos e limpa parciais; fechamento confirmado
  foi exercitado no Linux. Verificação Windows permanece em PENDING.md.
- [x] `-nostdin`, progress e stderr em log por item.
- [x] Vídeo nativo usa caminho original, sem arrayBuffer/cópia para saída.
- [x] Temporários no cache com guards; nenhuma parte na saída após cancelar.
- [x] yuv420p/faststart, trim com duração e áudio verificados em arquivos reais.
- [x] Browser informa exigência do desktop para vídeo; não baixa original como
  se fosse edição. Pasta de saída não decide qual backend está ativo.
- [x] Health/sidecars reais; dimensões vêm do probe, sem blob expirado.

### Filtergraph/render

- [x] Círculo/rotação/flip efetivos, duração finita, fundo em loop e política de áudio.
- [x] Geometria compartilhada, unidades normalizadas e planos na ordem correta.
- [x] Fontes aguardadas, texto com wrapping/fundo variável e compositor único.
- [x] Imagem respeita dimensões/crop/templates, sem fila de vídeo fictício.
- [x] Comparação Canvas/FFmpeg passou nos nove casos; equivalência total de todas
  as combinações e WebView2 Windows não é alegada.

### Dados/persistência

- [x] Estado grande sai de localStorage; assets/JSON persistidos com erros visíveis.
- [x] Mídia recuperada após reload ou marcada ausente; re-vínculo disponível.
- [x] Gestão central de URLs, UUIDs, probe com falha tratada e sem duração chutada.
- [x] Importação filtra extensões, não descarta após 100; 501 itens exercitados.
- [x] Importação de fonte tem tratamento de erro.
- [x] Migração e backup preservam legado e referências recuperáveis; corrupção
  de manifesto é recusada antes de escrever dados.

### Interface/UX

- [x] Crop visual/lote, multisseleção, histórico e layout maior em três zonas.
- [x] Atalhos respeitam campos de texto; ajuda inclui comandos disponíveis.
- [x] Abertura do modal não dispara lote; iniciar é uma ação explícita e protegida.
- [x] Modal pode fechar e reabrir acompanhando fila nativa; cancelar é explícito.

### Segurança/projeto

- [x] Escopo global e write-all removidos, CSP ativa e grants por caminhos escolhidos.
- [x] Nenhum command aceita argumentos FFmpeg arbitrários da interface.
- [x] Dependências duplicadas/sobras removidas; autores/descrição/NSIS/ícones revistos.
- [x] Componentes gigantes substituídos por módulos pequenos; strict/noUnused,
  ESLint e verificação de tamanho aprovados.

## Rodar e gerar o executável

No ambiente preparado da nuvem:

```bash
cd /workspace/OLIVEIRAEDITS1
. /workspace/.toolchains/oliveira-env.sh
npm run dev
# Em outro terminal: npm run tauri dev
```

Em uma máquina Windows x64 com Node 22.12+, Rust, Visual Studio C++/SDK e WebView2:

```powershell
npm ci
npm run setup:ffmpeg -- --download-windows --target x86_64-pc-windows-msvc
npm test
cargo test --manifest-path src-tauri/Cargo.toml --no-default-features
npm run tauri build -- --bundles nsis
```

O script baixa FFmpeg/FFprobe, verifica SHA-256 e os prepara para o triple. O NSIS
é gerado em `src-tauri/target/release/bundle/nsis/`. O workflow Windows manual
faz a mesma preparação. Não foi disparado e nenhum instalador foi publicado.
Leia [README.md](README.md), [setup-ffmpeg](docs/setup-ffmpeg.md) e
[PENDING.md](PENDING.md) para requisitos e validações restantes.
