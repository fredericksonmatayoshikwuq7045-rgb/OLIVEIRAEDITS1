# FFmpeg e FFprobe

Use Node 22.12+ e Rust estável atual. Os sidecars são obrigatórios para empacotar
o aplicativo; o modo de desenvolvimento também procura executáveis no PATH.

## Windows x64

Na raiz do repositório:

```powershell
npm ci
npm run setup:ffmpeg -- --download-windows --target x86_64-pc-windows-msvc
npm run tauri dev
```

O helper baixa o build GPL do projeto BtbN/FFmpeg-Builds no GitHub, confere o
SHA-256 publicado pelo mesmo release e extrai somente os dois executáveis.
Qualquer divergência interrompe a instalação. Ele registra também os hashes dos
binários em `src-tauri/binaries/manifest-x86_64-pc-windows-msvc.json`.

Os nomes esperados pelo Tauri são:

```
src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe
src-tauri/binaries/ffprobe-x86_64-pc-windows-msvc.exe
```

Para usar binários já obtidos de uma fonte confiável:

```powershell
npm run setup:ffmpeg -- --from C:\Ferramentas\ffmpeg\bin --target x86_64-pc-windows-msvc
```

Nesse modo o helper verifica a cópia e registra os hashes; a confiança da origem
dos executáveis fornecidos fica com quem os instalou. Não coloque arquivos de
fontes desconhecidas nessa pasta. Binários e manifestos locais não entram no Git.

## Linux para desenvolvimento

Instale FFmpeg/FFprobe e os pré-requisitos oficiais do Tauri (GTK3, WebKitGTK 4.1,
libsoup3, librsvg e ferramentas C). Prepare os sidecars locais:

```bash
npm run setup:ffmpeg -- --from /usr/bin --target x86_64-unknown-linux-gnu
```

Os executáveis do sistema podem depender das bibliotecas locais. Essa cópia é
para desenvolvimento Linux, não é um pacote estático para distribuir.

## Verificação e diagnóstico

Configurações mostra versão, caminhos e encoders realmente enumerados. A presença
de NVENC/QSV/AMF na lista não comprova que exista hardware utilizável. O motor
tenta o encoder escolhido e usa libx264 se a tentativa falhar, registrando o erro.

Sem FFmpeg, FFprobe ou libx264, a exportação de vídeo fica bloqueada. Imagens
continuam usando o compositor Canvas. ExifTool é opcional no PATH; a ausência é
informada e o relatório mostra as tags que FFprobe conseguiu verificar.
