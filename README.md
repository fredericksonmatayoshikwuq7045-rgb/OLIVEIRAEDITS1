# Oliveira Edits — 0.5.0

Editor local em pt-BR para vídeos e imagens em lote. Cada conta mantém templates,
fontes, presets, projetos e configurações de exportação próprios.

## Nova leva de mídias

Na faixa **Mídias do projeto**, clique em **Limpar todas** e confirme a quantidade.
Isso esvazia os slots do projeto atual, preservando originais, foto, templates,
fontes e configurações. **Ctrl+Z** restaura a leva inteira e suas edições enquanto
o app estiver aberto. A próxima importação começa no slot 1. O botão fica
indisponível durante a importação e quando não há mídias.

## Novidades desta versão

Headlines em vídeo, foto e texto podem ultrapassar a duração da mídia principal.
**Usar como abertura** posiciona o meme depois da chamada; a saída inclui a
sequência inteira. **Aplicar sequência em massa** copia a montagem para a leva,
preservando os arquivos e durações dos destinos.

A timeline mostra clipes com miniaturas, régua comum, zoom e rolagem. Arraste
clipes e pontas no tempo; arraste os nomes para mudar a ordem visual. Cada camada
tem tamanho/posição próprios e vídeos têm áudio opcional. O botão **+** do template
adiciona outra camada; duplicar e dividir mantêm os clipes na mesma composição.

As alas **Todas / Vídeos / Imagens** mantêm as ferramentas. Fotos exportam o quadro
escolhido em PNG/JPG/WebP. Veja o passo a passo e os limites na
[release 0.5.0](docs/release-0.5.0.md). As funções da
[0.4.0](docs/release-0.4.0.md) e [0.3.0](docs/release-0.3.0.md) continuam disponíveis.
As novidades estão em `refactor/v2`; baixe essa branch para obter esta versão.

## Requisitos e início

- Node.js 22.12+ e npm; neste ambiente foram usados Node 24.19 e npm 11.9.
- Para desktop: Rust estável atual, ferramentas C/C++ do sistema e FFmpeg/FFprobe.
- No Windows: Visual Studio Build Tools com C++, SDK Windows e WebView2.
- No Linux: GTK3, WebKitGTK 4.1, GStreamer com decoder H.264 (`gstreamer1.0-libav`)
  e demais [pré-requisitos Tauri](https://v2.tauri.app/start/prerequisites/).

```bash
npm ci
npm run dev
```

`npm ci` também prepara os arquivos locais de OCR e três idiomas (cerca de
36 MB). O aplicativo não baixa modelos durante o uso. Se esses arquivos faltarem
em uma cópia de desenvolvimento, execute `npm run setup:vision`. Não exclua
`public/vision` entre a instalação e o build.

O navegador serve para desenvolver o editor e exportar PNG/JPG/WebP. Renderização
de vídeo e limpeza de metadados usam exclusivamente o aplicativo desktop, sem
simulação de sucesso. Configure os [sidecars](docs/setup-ffmpeg.md) e execute:

```bash
npm run tauri dev
```

Selecione uma conta, importe arquivos ou pasta, ajuste o enquadramento, aplique
templates/textos e confira conta, pasta e nomes antes de exportar. Ctrl+clique e
Shift+clique selecionam mídias; Ctrl+Z / Ctrl+Shift+Z desfazem e refazem. `?` abre
os atalhos. A pausa age entre arquivos; cancelar interrompe FFmpeg e limpa partes.

Para importar em massa, clique em **Importar pasta**, escolha a pasta uma vez e
aguarde o contador. Os arquivos compatíveis entram em ordem natural, preenchendo
os slots livres. Um arquivo inválido gera aviso e o restante do lote continua.
O aplicativo Windows mantém FFmpeg/FFprobe em segundo plano durante a leitura.
As [correções de 17/10/2026](docs/bugfixes-2026-10-17.md) estão em `refactor/v2`.

Se você usa um ZIP antigo, baixe o código atualizado dessa branch e extraia em
uma pasta nova. Execute `npm ci` e os comandos de preparação/build Windows abaixo,
depois instale o novo executável. O aplicativo já instalado não se atualiza ao
alterar os arquivos do código-fonte; preserve os dados e backups dos seus perfis.

## Verificação

```bash
npm test
npm run build
npm run lint
npm run check:files
cargo test --manifest-path src-tauri/Cargo.toml --no-default-features
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build -- --debug --no-bundle
npm run test:media
```

`test:media` precisa de FFmpeg/FFprobe e Cargo no PATH; gera 20 mídias sintéticas e
verifica saídas reais. Artefatos e um relatório JSON ficam em pasta temporária.
O recurso Cargo `desktop` é padrão. `--no-default-features` testa o núcleo sem
janela, mas não substitui a compilação da integração Tauri.
O build pelo CLI Tauri também verifica a compatibilidade entre os pacotes
JavaScript instalados e os crates Rust; `cargo check` sozinho não faz essa checagem.

Para testes de navegador, instale Chromium pelo Playwright ou informe
`CHROMIUM_PATH` e siga [tests/e2e/README.md](tests/e2e/README.md).
Os caminhos específicos desta nuvem estão em [docs/cloud-environment.md](docs/cloud-environment.md).

## Instalador Windows

Em uma máquina Windows x64 com os requisitos acima:

```powershell
npm ci
npm run setup:ffmpeg -- --download-windows --target x86_64-pc-windows-msvc
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build -- --bundles nsis
```

O instalador fica em `src-tauri/target/release/bundle/nsis/`. Há também um workflow
manual Windows em `.github/workflows/windows.yml`. Ele não é executado por esta
tarefa. Consulte [REPORT.md](REPORT.md) para saber quais plataformas foram de
fato verificadas.

## Dados e recuperação

Desktop grava JSON e assets no diretório de dados do aplicativo, com escrita
atômica e duas gerações de backup. Vídeos nativos continuam no caminho original;
se forem movidos, use Re-vincular. O navegador usa IndexedDB separado para o
formato v2. Exporte regularmente um perfil `.oeprofile` para backup adicional.

A migração preserva literalmente as quatro chaves antigas e não apaga o banco
original. Arquivos ausentes ficam sinalizados. Veja [backup-notes](docs/backup-notes.md)
e [arquitetura](ARCHITECTURE.md). Nunca limpe os dados do WebView para resolver um
erro antes de fazer backup.

## Estrutura

`src/domain` contém modelos e operações puras; `src/data`, persistência e migração;
`src/render`, geometria e compositor; `src/services`, a ponte nativa; `src/ui`, a
interface. O Rust separa `engine` e `storage`. Builds, caches e binários gerados
ficam fora do controle de versão.

## Problemas comuns

- **FFmpeg indisponível:** confira Configurações e prepare os dois sidecars.
- **Found version mismatched Tauri packages:** mantenha os lockfiles e use
  `npm ci` ao instalar uma cópia atualizada. Em cópias anteriores com API 2.12.4
  e notification 2.7.0, corrija antes de compilar:

  ```powershell
  npm install --save-exact @tauri-apps/api@2.11.1 @tauri-apps/plugin-notification@2.4.0
  ```

- **Caminho não autorizado:** selecione novamente pelo diálogo do aplicativo.
- **Arquivo ausente:** re-vincule a origem; não é necessário apagar o item.
- **Erro no export:** abra o log do item e o relatório da fila. Falhas não contam
  como sucesso; reexecute somente os itens com erro.
- **Fonte não carregada:** importe novamente uma TTF/OTF válida para a conta.
- **Falha ao salvar:** mantenha o app aberto e exporte um backup antes de fechar.

Limpar metadados não impede reconhecimento visual/sonoro do conteúdo. A análise
depois da limpeza informa tags removidas e remanescentes, sem promessas de
anonimato nem de que plataformas sociais deixarão de reprocessar o arquivo.
