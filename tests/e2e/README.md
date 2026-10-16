# Testes de interface e integração

## Navegador e migração

Com Vite ativo (`npm run dev`), Node.js e Chromium:

```sh
OE_TEST_URL=http://127.0.0.1:3000 npm run test:e2e
OE_TEST_URL=http://127.0.0.1:3000 npm run test:migration
```

`CHROMIUM_PATH` escolhe o executável. Os testes usam contextos descartáveis e
dados sintéticos. O primeiro cria contas, importa/exporta PNG, testa pinça com
dois dedos e histórico, recarrega dados, exercita 501 mídias com grid virtualizado
e faz roundtrip `.oeprofile`. O segundo semeia o formato antigo real antes de
inicializar o app e comprova recuperação e preservação das chaves/banco originais.
Não execute enquanto edita o código: HMR pode reiniciar o estado da interface.

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
