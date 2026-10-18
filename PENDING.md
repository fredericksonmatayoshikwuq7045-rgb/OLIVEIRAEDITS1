# Pendências e limites conhecidos

## P1 — validar a plataforma de destino

- **Executar o app e o instalador NSIS em Windows x64.** A nuvem é Linux, sem
  MSVC, Windows SDK e WebView2 executável. Os sidecars Windows foram baixados e
  tiveram SHA-256 verificado, mas isso não valida o instalador. Use o workflow
  manual `.github/workflows/windows.yml` ou os comandos do README em Windows.
- **Confirmar ausência de consoles auxiliares no Windows.** Todos os subprocessos
  usam `CREATE_NO_WINDOW`; o código e o teste específico foram compilados para
  Windows. A execução do teste `GetConsoleWindow` e a importação em massa no
  WebView2 ainda dependem de uma máquina Windows.
- **GPU real e ações de energia Windows.** O teste nativo exercita falha do QSV
  e fallback para libx264. NVENC/QSV/AMF bem-sucedidos exigem drivers/hardware.
  Desligar/hibernar está implementado, desativado por padrão, com confirmação;
  não foi executado no host da tarefa.
- **Volume realmente cheio.** A guarda de espaço insuficiente tem teste com
  zero bytes livres, e pasta sem permissão foi testada de verdade. Não há volume
  com quota montável aqui para validar ENOSPC no meio da escrita.

## P2 — ampliar a matriz de compatibilidade

- Testar ExifTool instalado, arquivos de celulares reais, HDR e codecs adicionais.
  A suíte cobre SDR de 10 bits, rotação, GPS falso, áudio e ausência de áudio.
  O relatório atual verifica tags visíveis ao FFprobe; não promete cobrir todos
  os átomos privados de todos os contêineres nem anonimato.
- Validar fontes e WebView2 Windows contra a comparação visual. Os nove casos
  medidos usam Canvas Chromium e FFmpeg Linux; não cobrem todas as combinações.
- Medir consumo com 500 vídeos longos e arquivos de vários GB no Windows. O grid
  foi exercitado com 501 imagens pequenas; vídeos nativos usam caminhos, sem
  copiar o conteúdo inteiro para a RAM.
- Testar recuperação após queda abrupta de energia do sistema operacional.
  Escrita atômica, backups e retomada são cobertos por testes, sem simular essa
  falha física nesta máquina.

## P3 — opções de produto não incluídas nesta versão

- Intro/outro por perfil, biblioteca global compartilhada e ponto focal manual
  são opcionais no plano; exigem novos contratos/UX e matriz de render própria.
- Tradução completa da interface: continua em pt-BR. As frases já têm pt-BR,
  inglês e espanhol; temas claro/escuro/sistema e cores estão implementados.
- Rastreamento contínuo de marca em movimento, remoção por reconstrução e OCR de
  todos os frames não fazem parte da 0.3.0. A análise usa até cinco amostras e
  exige revisão; resultados ambíguos não ficam selecionados automaticamente.
- O catálogo de frases é local e pequeno; um autor com uma única frase repete
  esse texto. Frases pessoais ampliam o catálogo. Ilia Topuria está disponível
  como filtro para frases adicionadas pelo usuário, sem atribuição inventada.
- ExifTool não é distribuído como sidecar; há detecção opcional se instalado.
- `cargo audit` não estava instalado; o relatório de segurança de dependências
  desta execução cobre `npm audit`, compilação e revisão dos escopos.

## Limites operacionais deliberados

- `.oeprofile`: até 512 MiB compactados e 256 MiB por entrada, com proteção de
  caminhos e expansão excessiva; JSON nativo até 32 MiB, assets até 256 MiB.
- Exportação de imagem nativa aceita até 64 MiB por resultado. Vídeos originais
  permanecem referenciados por caminho e não têm esse limite de asset.
- Transferir perfil entre computadores pode exigir re-vincular vídeos externos.
  Backups incluem assets do perfil, não uma cópia de todos os vídeos originais.
- Os commits de implementação foram enviados ao GitHub na branch `refactor/v2`.
  Para obter o código atualizado, selecione essa branch; `main` mantém a versão
  anterior. Builds e instaladores não foram publicados. A restauração do ambiente
  completo em uma nova tarefa da nuvem continua sem validação.
