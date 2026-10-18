# Oliveira Edits 0.5.0 — abertura e sequência por mídia

A duração final passa a incluir todas as camadas visíveis com tempo definido,
mesmo quando ultrapassam o vídeo ou a foto principal. Por exemplo, uma chamada
em vídeo de 8 segundos seguida de um meme de 5 segundos gera uma saída de 13
segundos; o meme começa pelo primeiro quadro do trecho escolhido no segundo 8.
Imagem e áudio do meme entram juntos. Camadas posteriores também podem ampliar
esse encerramento.

## Montar uma abertura

1. Importe a leva e aplique um template em **Headline**, ou adicione texto.
2. Selecione sua faixa na timeline. Ajuste **Aparecer**, **Desaparecer** ou
   **Duração da camada**; os valores podem ultrapassar a duração da mídia.
3. Clique em **Usar como abertura**. A camada começa em zero e o clipe principal
   passa a entrar depois dela. O texto associado a uma headline acompanha o visual.
4. Use **Preencher tela** quando a chamada deve ocupar a saída inteira. Largura,
   altura e posição continuam próprias de cada camada.
5. Confira o corte no player e clique em **Aplicar sequência em massa**.
   A confirmação já seleciona enquadramento, camadas/sequência e fundo. Cada destino
   conserva seu arquivo, corte e velocidade, salvo se você marcar esses grupos.

Headlines em vídeo novas usam sua duração natural e áudio ativo. O controle
**Áudio do vídeo nesta camada** permite silenciá-las; marcas/bordas continuam mudas
por padrão. O principal também tem controle de áudio. As janelas, cortes, ponto de
entrada, repetição e visibilidade são respeitados pela prévia e pelo FFmpeg.
Áudio ausente na origem é tratado sem falhar a exportação.

## Timeline e transformação

- O principal aparece como clipe, junto de templates, textos e fundo.
- Clipes têm miniaturas, nomes, tempos, pontas de corte e posição independente.
  Zoom e rolagem horizontal compartilham a mesma régua. **+5s de espaço** amplia
  o espaço de edição; só camadas/mídia ampliam a saída, sem adicionar silêncio extra.
- Arraste os nomes na vertical ou use **Subir/Descer camada** para mudar a ordem
  visual, incluindo em relação ao principal. O fundo permanece na base.
- Arraste o corpo no tempo. Para o principal, mover preserva seu trecho; as
  pontas aparam o original sem esticá-lo além dos quadros disponíveis.
- Imagens e vídeos de camada têm largura/altura separadas, posição, rotação e
  opacidade. Texto tem largura e fonte; a mídia principal mantém zoom e posição.
  As alças na prévia continuam funcionando.
- O **+** junto do template adiciona outra camada sem substituir as anteriores.
  **Duplicar camada** e **Dividir camada no cursor** mantêm a edição no mesmo
  resultado. A divisão conserva a fase do vídeo e o restante da composição.
- **Dividir no cursor (S)** na seção do principal mantém a função anterior:
  divide a mídia em dois slots/arquivos de saída independentes.
- Edições e aplicação do lote têm desfazer/refazer. Backup e restauração incluem
  tempos, ordem, tamanho, entrada do principal e áudio por camada.

As alas Todas/Vídeos/Imagens permanecem. Uma foto pode ter uma headline ou camada
mais longa, com composição e quadro escolhidos. A exportação da ala de imagens
continua sendo PNG/JPG/WebP estático, não MP4 animado.

## Validação e compatibilidade

Formato de perfil/projeto permanece no esquema 2, com novos campos opcionais.
Projetos antigos usam entrada zero para o principal. Headline em vídeo antiga
sem janela usa a duração de origem conhecida para evitar truncamento; os tempos
já editados continuam valendo. Limite de composição: 24 horas.

Passaram 129 testes frontend/dados, 42 Rust, lint, formatação, limite de tamanho
por arquivo, TypeScript/Vite, núcleo/testes compilados para Windows e build
CLI Tauri Linux com assets de produção. Testes reais de navegador cobrem
abertura, foto/vídeo, arraste de ordem, transformação, divisão, lote, PNG,
reload e backup; a suíte anterior de camadas também passou.

Quatro MP4s de 12 segundos foram comparados com 36 quadros Canvas, incluindo
abertura de 8s, trecho principal com trim/velocidade, encerramento, fundo em blur,
áudio de chamada e principal silenciado. O áudio PCM medido confirma som e
silêncio nos intervalos corretos, com timestamps contínuos no AAC. A regressão
anterior compara mais 28 quadros e áudio do fundo. A suíte de 20 exports, erros,
metadados e cancelamento também passou.

O teste de produção WebKit Linux exporta MP4 e PNG pela interface e verifica
uma abertura de 3s antes de um meme de 1s, preservando a saída completa de 4s.
Evidências em [docs/validation](validation/). O instalador NSIS e a execução
WebView2 ainda precisam de Windows; estes resultados usam Linux em software.
