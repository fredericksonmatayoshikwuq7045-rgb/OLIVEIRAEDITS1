# Ambiente de nuvem preparado

Checkout: `/workspace/OLIVEIRAEDITS1`, branch `refactor/v2`, versão 0.6.0. O host é Linux;
o produto de destino continua sendo Windows. Não são necessários segredos nem
serviços externos para editar e validar mídia sintética.

## Ferramentas e bibliotecas

- Node 24.19, npm 11.9 e Chromium do host.
- Rust estável em `/workspace/.toolchains`, com alvo Linux e standard library
  do alvo `x86_64-pc-windows-msvc` para check do núcleo.
- GTK3, WebKitGTK 4.1 e libsoup3 em `/workspace/.sysroot`, extraídos de pacotes
  Debian assinados, sem modificar diretórios globais do sistema.
- GStreamer libav e ferramentas em `/workspace/.sysroot` para decodificação
  H.264 no WebKit Linux, com `GST_PLUGIN_PATH` definido pelo helper.
- FFmpeg/FFprobe Linux do host preparados como sidecars de desenvolvimento.
  Sidecars Windows do release BtbN baixados e verificados por SHA-256.
- Cache npm em `/workspace/.cache/npm`; target desktop em
  `/workspace/.cache/oliveira-desktop-target`.

Antes de usar Cargo/Tauri nesta nuvem:

```sh
. /workspace/.toolchains/oliveira-env.sh
```

O helper configura a toolchain e os caminhos das bibliotecas privadas.
`npm ci` também prepara os assets locais de OCR; não exclua `public/vision`
antes de compilar. Consulte [release 0.6.0](release-0.6.0.md) para a validação.
`bash /workspace/.cloud-onboarding/oliveira-edits/install.sh` reexecuta instalação
das dependências pelo lockfile e os checks principais. A instalação de base e os novos passos de codec/launcher foram verificados
neste workspace.
Os scripts de configuração da nuvem são salvos como rascunho, para revisão e
publicação nas configurações do ambiente; salvar o rascunho não publica o snapshot.

## Inicialização e testes

```sh
cd /workspace/OLIVEIRAEDITS1
npm run dev -- --strictPort
```

O Vite usa a porta 3000. Processos não devem ser considerados ativos após
restaurar um snapshot. Verifique se a instância existente pertence a este projeto
antes de iniciar outra; não encerre processos desconhecidos. Confira o HTTP e
execute `OE_TEST_URL=http://127.0.0.1:3000 npm run test:e2e` para verificar função.
Para desktop normal, com bibliotecas gráficas do sistema, use `npm run tauri dev`.

A automação nativa desta nuvem usou Xvfb, tauri-driver, WebKitWebDriver e um
launcher `proot` para os libexec do WebKit privado. O launcher mapeia `/var/tmp` para `/tmp`
para o cache temporário do WebKit dentro deste sandbox. Vídeos Linux usam
streaming local autorizado. O launcher do teste retira proxies HTTP somente
do processo do app para o GStreamer alcançar o loopback; downloads e comandos
da nuvem mantêm o proxy existente. A inicialização do app configura playbin3 e
quadros de vídeos ocultos usados pelo Canvas. Esses helpers estão fora do
checkout em `.cloud-onboarding/oliveira-edits/native-test`. A configuração
necessária a uma instalação Linux comum está nos pré-requisitos oficiais Tauri;
o launcher privado não deve ser empacotado no aplicativo Windows.

## Persistência e limites

Os arquivos e bibliotecas preparados pertencem ao workspace/snapshot atual;
nenhum processo de teste é requisito persistente. Não foi verificada restauração
em uma tarefa nova. Os commits de implementação foram enviados ao GitHub na
branch `refactor/v2`. Use essa branch ao obter o código atualizado: `main` mantém
a versão anterior às correções de 17/10/2026. Preserve o workspace/snapshot para as ferramentas e bibliotecas
privadas preparadas durante esta tarefa.

O build do instalador exige Windows, MSVC/SDK e WebView2. Os resultados e os
comandos correspondentes estão em [REPORT.md](../REPORT.md).

## Navegação do editor 0.6.0

Biblioteca: Mídias/Templates/Texto e Mais. Inspetor: Básico/Tempo/Áudio conforme
seleção. A timeline fica embaixo e pode ser redimensionada. Importar pasta,
ordenação, seleção e Limpar todas ficam no menu das mídias; o assistente fica
em Lote. Os testes e2e foram adaptados a esses caminhos. Execute
`OE_TEST_URL=http://127.0.0.1:3000 npm run test:studio` para conferir composição
visual, menus, atalhos, divisórias, temas e layouts em diferentes resoluções.

Repetições do teste nativo 0.6.0 registraram encerramentos do processo WebKit,
com perda da sessão e mensagem de erro de memória, inclusive antes de templates.
Uma rodada completa passou; os demais resultados constam no relatório, sem
conclusão de estabilidade. Desativar compositing/DMABUF não resolveu nesta
nuvem e não integra o produto ou o launcher salvo.
