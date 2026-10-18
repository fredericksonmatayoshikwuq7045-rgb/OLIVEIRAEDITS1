# Testes de interface e integração

## Navegador e migração

Com Vite ativo (`npm run dev`), Node.js e Chromium:

```sh
OE_TEST_URL=http://127.0.0.1:3000 npm run test:e2e
OE_TEST_URL=http://127.0.0.1:3000 npm run test:migration
OE_TEST_URL=http://127.0.0.1:3000 node tests/e2e/export-regressions.mjs
```

`CHROMIUM_PATH` escolhe o executável. Os testes usam contextos descartáveis e
dados sintéticos. O primeiro cria contas, importa/exporta PNG, testa pinça com
dois dedos e histórico, recarrega dados e importa uma pasta real com 501 PNGs,
um PNG corrompido e um texto incompatível. Verifica cancelamento, cliques
repetidos com apenas um seletor, slots contínuos em ordem natural, isolamento
das falhas, virtualização ao percorrer todo o lote e recolher/expandir o grid.
Também testa seleção completa, desfazer/refazer e roundtrip `.oeprofile`.
O segundo semeia o formato antigo real antes de
inicializar o app e comprova recuperação e preservação das chaves/banco originais.
Não execute enquanto edita o código: HMR pode reiniciar o estado da interface.

`export-regressions.mjs` exercita os componentes e o Canvas em Chromium, com
somente a fronteira IPC simulada. Verifica retry, destinos históricos, contagem
de imagens e bloqueio da ação de energia após falha; não desliga o computador.
Os smokes que semeiam a página interceptam também a query de timestamp do Vite,
para impedir que a aplicação inicialize antes das fixtures.

## Equivalência visual

Pré-requisitos extras: Python, `playwright` para Python e Chromium instalado.
Não é necessário baixar um navegador pelo Playwright se `CHROMIUM_PATH` apontar
para a instalação existente. O padrão no Linux é `/usr/bin/chromium`.

Com `npm run dev` ativo e o harness Rust compilado, execute:

```sh
python3 tests/e2e/render-parity.py
```

`OE_TEST_URL` permite escolher a URL do Vite; `OLIVEIRA_ENGINE_HARNESS` indica
outro caminho para o executável do motor. `OE_PARITY_TEST_DIR` mantém artefatos
em um diretório escolhido; o padrão é uma pasta temporária nova.

O teste chama `composeCanvas` e `compileStaticPlanes` reais em Chromium, exporta
as camadas PNG pelo motor Rust e compara o frame decodificado com o canvas de
preview. A entrada é um vídeo RGB lossless criado de uma imagem assimétrica,
para isolar erros de enquadramento de diferenças entre frames de vídeo.

Os casos cobrem contain, cover com crop/pan, rotações 90° e livre, flip, máscara
circular, gradiente, texto com quebra de linha/contorno/fundo e planos abaixo e
acima da mídia. A tolerância considera compressão H.264 e subamostragem 4:2:0:
erro médio por canal abaixo de 7/255 e menos de 8% dos pixels com diferença
superior a 35/255. Cada métrica é calculada dos arquivos reais; o teste falha
se ultrapassar qualquer limite. Isso verifica esses casos, sem prometer
equivalência bit a bit entre renderizadores ou cobrir toda combinação possível.

## Aplicativo Tauri real

Compile o binário desktop de desenvolvimento e mantenha Vite na porta definida
em `tauri.conf.json`. Instale `tauri-driver` e o driver da plataforma (WebKitGTK
no Linux ou Edge WebDriver no Windows), inicie o driver e execute:

```sh
TAURI_DRIVER_URL=http://127.0.0.1:4444 TAURI_APP_BINARY=/caminho/do/binario \
  OE_NATIVE_TEST_DIR=.artifacts/native-final npm run test:native
```

O smoke chama a ponte Tauri real: health, probe, thumbnail, export, prévia,
escopos, proteção de original, cancelamento e retomada. Não executa ações de
energia. A fixture é descartável e os diretórios pertencem ao app de teste.
Reinicie o driver para uma sessão nova após encerrar a janela; alguns drivers
mantêm o identificador antigo mesmo quando o processo terminou.

No Linux, com X11/Xvfb, a mesma sessão permite verificar o fechamento real:

```sh
DISPLAY=:97 TAURI_DRIVER_URL=http://127.0.0.1:4444 \
  OE_NATIVE_REPORT=.artifacts/native-final/report.json npm run test:close
```

Esse teste envia `WM_DELETE_WINDOW`, testa continuar trabalhando e depois
confirma sair com uma fila pausada. Verifica cancelamento persistido, ausência
de parciais, preservação de dados e encerramento da janela. É exclusivo de
Linux/X11; repetir manualmente o fluxo no Windows permanece necessário.

## Estúdio 0.3.0

Com Vite ativo, Chromium e FFmpeg no PATH:

```sh
OE_TEST_URL=http://127.0.0.1:3000 npm run test:upgrade
OE_TEST_URL=http://127.0.0.1:3000 npm run test:appearance
OE_TEST_URL=http://127.0.0.1:3000 npm run test:reference
```

O primeiro percorre foto/conta, temas/frases, mouse/histórico, menu/layouts,
filmstrip real, divisão e trim, recorte com título nas barras, OCR local com
marcas em posições distintas e exportação PNG real. O segundo verifica contraste,
cores extremas, fontes, divisórias e layout em 1100px, tema do sistema e movimento
reduzido. O terceiro usa o comparador visual real em worker e faz backup/restore
com foto, referência antiga, logo nova e IDs independentes.

`test:upgrade` e `test:appearance` também funcionam contra `vite preview`, usando
`OE_TEST_URL=http://127.0.0.1:4173`. `OE_UPGRADE_DIR` troca o destino dos artefatos
do primeiro teste. Não execute duas instâncias de um mesmo teste escrevendo no
mesmo diretório. Todos usam dados sintéticos em contextos de browser novos.

Para o teste nativo novo, compile o **bundle de produção**, abra uma sessão nova
do driver com diretório de dados isolado e execute:

```sh
npm run tauri build -- --debug --no-bundle
TAURI_DRIVER_URL=http://127.0.0.1:4458 TAURI_APP_BINARY=/caminho/do/binario \
  OE_NATIVE_TEST_DIR=.artifacts/native-upgrade npm run test:native-upgrade
```

Ele exige o protocolo de produção (recusa Vite), semeia um vídeo de teste pelo
IPC e verifica amostragem/cache/autorização, OCR com os assets locais dentro do
WebKit e exportação H.264 real pela interface com a placa e a marca no frame
codificado. FFmpeg/FFprobe precisam estar no PATH do teste. A sessão é encerrada
no final. O teste altera o perfil padrão da instalação de teste: use um diretório
de dados descartável, nunca o seu perfil de trabalho. Não executa ações de energia.

## Limpar a leva — 0.3.1

Com Vite, Chromium e FFmpeg disponíveis, execute `npm run test:clear`.
`OE_TEST_URL` troca a URL, `OE_CLEAR_DIR` o diretório dos artefatos e
`OE_TEST_FONT` deve apontar para uma fonte TTF/OTF/WOFF válida (o padrão desta
nuvem é OpenSans-Regular.ttf em `/usr/share/fonts/truetype/open-sans`).

O fluxo cria duas contas isoladas, importa imagens e vídeo reais, foto, template,
fonte e edição de texto. Verifica cancelar/Escape, limpar tudo, cliques repetidos,
um único desfazer/refazer, a próxima leva no slot 1, botão bloqueado na importação,
layout em 1100px e persistência após reload. Compara os perfis completos e o
projeto da outra conta e verifica que os arquivos originais continuam intactos.
Os dados são descartáveis; não há IPC simulado nem exclusão física de originais.

## Camadas temporais e imagens — 0.4.0

Com Vite e Chromium ativos, FFmpeg/FFprobe no PATH:

```sh
npm run test:layers
npm run test:timing
```

`test:layers` usa arquivos reais e nenhum IPC simulado: importa vídeo e foto,
cria duas camadas do mesmo template com offsets distintos, verifica pixels do
Canvas, arrasta uma ponta/desfaz, aplica borda/headline/texto/fundo e testa a ala
de imagens com reprodução e dois PNGs reais. Reload e backup/restore devem
preservar janelas, repetição, offsets e quadro de imagem. Artefatos ficam em
`.artifacts/layer-timeline`; `OE_LAYERS_DIR` troca esse diretório.

`test:timing` exige Python Playwright e o harness Rust. Compara 28 quadros de seis
composições Canvas/FFmpeg: janelas, duas instâncias do mesmo vídeo, corte com
velocidade, último quadro sem loop, gradiente, fundo em imagem e blur oculto.
Analisa frequências do áudio exportado para provar a janela do fundo. Usa a
mesma tolerância da paridade visual acima. `OE_TIMING_DIR` troca os artefatos.

Para testar a janela de produção, use um driver recém-iniciado com diretórios
de dados/cache descartáveis e o binário produzido pelo CLI Tauri:

```sh
npm run tauri build -- --debug --no-bundle
TAURI_DRIVER_URL=http://127.0.0.1:4468 TAURI_APP_BINARY=/caminho/do/binario \
  python3 tests/e2e/native-layer-timeline.py
```

Esse teste altera o perfil padrão **da instalação de teste**: cria os arquivos,
importa um template `File` pela interface, valida a prévia e exporta MP4/PNG reais.
O PNG deve conter o quadro escolhido da animação; o MP4 deve respeitar a janela.
`OE_NATIVE_TEST_DIR` escolhe os artefatos e `OE_NATIVE_KEEP_SESSION=1` mantém a
sessão para diagnóstico. No Linux, o WebKit precisa do decoder H.264 do GStreamer
(`gstreamer1.0-libav`); os requisitos da nuvem estão em
[docs/cloud-environment.md](../../docs/cloud-environment.md).

Na nuvem, o driver headless usa as bibliotecas privadas e o launcher descrito no
setup. O processo de teste fica sem proxies HTTP e com
`GIO_USE_PROXY_RESOLVER=dummy`, `WEBKIT_GST_USE_PLAYBIN3=1`,
`WEBKIT_GST_ALLOW_PLAYBACK_OF_INVISIBLE_VIDEOS=1`,
`WEBKIT_GST_DISABLE_GL_SINK=1`, `LIBGL_ALWAYS_SOFTWARE=1` e
`ALSOFT_DRIVERS=null`. Essas opções isolam a renderização em software e o áudio
virtual do teste; não validam hardware/GPU nem áudio em dispositivo real.

## Sequências e abertura — 0.5.0

Com o mesmo Vite/Chromium/FFmpeg e harness das suítes acima:

```sh
npm run test:sequence
npm run test:sequence-export
```

O primeiro percorre headlines em vídeo e foto maiores que o principal, entrada
adiada, reprodução atravessando o corte, reordenação por botão e drag-and-drop,
largura/altura, divisão com fase, aplicação em massa, PNG real e backup/restore.
`OE_SEQUENCE_DIR` seleciona os artefatos. O segundo compara 36 frames Canvas/MP4
em quatro sequências de 12s, com abertura 8s, principal com trim/velocidade,
encerramento, blur, áudio da abertura e principal mudo. Mede PCM antes/durante/
depois de cada intervalo; `OE_SEQUENCE_EXPORT_DIR` altera o diretório.

O teste `native-layer-timeline.py` também monta a abertura pela UI do binário de
produção e valida o MP4 de 4s com chamada de 3s e meme de 1s. Requer diretórios de
dados/cache descartáveis e driver novo, como descrito acima.

## Workspace contextual 0.6.0

`npm run test:studio`, com `OE_TEST_URL` apontando ao Vite, confere o editor com
vídeo/imagem/texto reais: um player e um inspetor, tempos, undo/redo, Delete na
camada selecionada, split bloqueado na borda sem dividir o principal, contexto,
menu/Escape/foco, categoria preservada, timeline inferior ajustável e layouts
central/direita/foco de 1100×700 a 1920×1080. Também verifica a divisória das
propriedades no layout à direita, menus dentro da janela, tema claro e áudio.
Relatório e screenshots ficam em `.artifacts/studio-layout`.

Os helpers em `layer-helpers.mjs` abrem recursos, abas e menus conforme o fluxo
real. Campos de tempos ficam em Tempo; offset/fim/loop em Ajuste preciso.
Aparar o original fica em Tempo quando o principal está selecionado. O assistente
fica em Ações em lote e as ferramentas da leva em Opções das mídias. Essas
mudanças de navegação também foram aplicadas aos testes de produção WebKit.
