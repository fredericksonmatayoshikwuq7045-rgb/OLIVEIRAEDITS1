# Validação real de mídia

Execute `npm run test:media` (ou `node scripts/test-media.mjs`) com Node 22.6+, Rust,
FFmpeg e FFprobe disponíveis no PATH. O teste compila e executa o **mesmo motor Rust**
usado pelo aplicativo; não substitui os comandos de exportação por mocks.

`FFMPEG_PATH`, `FFPROBE_PATH` e `CARGO` permitem indicar binários instalados.
`OLIVEIRA_ENGINE_HARNESS` permite reutilizar um harness já compilado.
`OE_MEDIA_TEST_DIR` define onde manter fixtures, requests, logs e `report.json`.
Por padrão os artefatos ficam em uma pasta nova no diretório temporário do sistema.

O script gera 20 vídeos lavfi com proporções 9:16, 16:9, 1:1 e 4:5, incluindo
H.264 de 10 bits, áudio de 44,1 kHz, arquivos sem áudio, rotação no contêiner,
GPS e identificação de câmera falsos, e um clipe mais longo. Confirma que os
casos especiais existem antes de testar o motor. Também gera PNGs transparentes
com gráfico e texto, fundo de imagem e fundo de vídeo mais curto que o clipe.

A verificação usa FFprobe e decodificação de pixels da saída para conferir:

- arquivo final realmente editado e overlay vermelho presente;
- resolução de destino, H.264 `yuv420p`, BT.709 e `moov` antes de `mdat`;
- duração do trim/velocidade, áudio AAC a 48 kHz e silêncio solicitado;
- remoção de tags de GPS, câmera e data de criação;
- progresso final e tamanho do arquivo reais no relatório;
- remux no modo somente limpar, com relatório de tags antes/depois;
- erros de arquivo corrompido, arquivo ausente, destino inválido e dimensões ímpares;
- pasta com permissão real de escrita negada (POSIX, conta sem privilégios);
- remoção de EXIF real de um JPEG, preservando o arquivo original;
- cancelamento de encode ativo, sem arquivo final nem `.part` abandonado.

O relatório lista separadamente cenários que dependem do desktop ou de um
volume com espaço/ACL controlados. Não os considera aprovados por inferência.
Esses testes não afirmam equivalência visual completa do preview: ela também
precisa dos casos de geometria e da validação de canvas/navegador.
