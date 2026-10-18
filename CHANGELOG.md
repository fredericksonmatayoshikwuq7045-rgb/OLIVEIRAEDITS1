# Changelog

## 0.6.0 — 2026-10-18

- Biblioteca lateral com Mídias/Templates/Texto e menu para fontes/presets.
- Player maior e uma única barra de reprodução, sem controles duplicados.
- Timeline inferior em toda a largura, altura ajustável e zoom inicial que cabe na janela.
- Inspetor contextual Básico/Tempo/Áudio; ajustes avançados recolhidos por padrão.
- Menus de lote, mídias, templates e camadas preservam as ações existentes.
- Categoria da biblioteca e rolagem das mídias preservadas ao alternar recursos.
- Seleção volta ao principal ao clicar no slot; desfazer não deixa camada inexistente selecionada.
- Atalhos no editor respeitam a camada selecionada; divisão indisponível não divide a mídia por engano.
- Painéis ajustáveis nos layouts central/direita; menus cabem na janela e pulam ações desativadas pelo teclado.
- Tamanho de fonte personalizado aplicado aos novos controles; temas e três layouts preservados.
- Miniaturas estáticas de templates em vídeo geradas quando visíveis, evitando players extras na biblioteca.
- Assistente carregado ao abrir, reduzindo o JavaScript inicial sem dependências novas.
- Regressões de sequência, camadas, 501 arquivos, limpeza, backup, migração, OCR e MP4/PNG no desktop Linux.
  Guia e evidências: [release 0.6.0](docs/release-0.6.0.md).

## 0.5.0 — 2026-10-18

- Duração independente das camadas, incluindo headlines maiores que vídeo/foto.
- Principal na timeline e ação de abertura antes do meme, sem consumir sua origem.
- Clipes com miniaturas, régua, zoom, rolagem e arraste de ordem visual.
- Largura/altura por camada, duplicação, divisão e adição sem substituição.
- Sequência em massa com tempos e posições, mantendo o conteúdo dos destinos.
- Áudio de templates em vídeo e principal com controle individual e janelas reais.
- Exportação inclui abertura/encerramento; blur, áudio atrasado e AAC sincronizados.
- Preview com relógio da composição, mesmo antes/depois do vídeo principal.
- 129 testes frontend, 42 Rust, testes reais de interface/backup, MP4/PNG e áudio.
  Guia: [release 0.5.0](docs/release-0.5.0.md).

## 0.4.0 — 2026-10-18

- Faixas de início/fim para todas as camadas: borda, marca, headline visual/texto,
  fundo e camadas adicionais; arraste, campos precisos, ocultar, remover e desfazer.
- Templates em vídeo em todas as categorias, com ponto de entrada, repetição ou
  último quadro parado; decodificadores independentes para o mesmo arquivo.
- Fundo com janela temporal e mix de áudio sincronizado; divisão preserva fase.
- Alas Todas/Vídeos/Imagens com as ferramentas existentes e opção de template
  compartilhado entre os tipos; Limpar todas continua abrangendo o projeto inteiro.
- Composição de imagem com duração, reprodução e quadro salvo para PNG/JPG/WebP.
- Timeline expansível e compacta por padrão; ajuste de espaço mantém o player.
- Correção de URL nativa convertida duas vezes e de reprodução temporal de imagem.
- Streaming local com caminhos autorizados e ranges para vídeo no WebKit Linux.
- Referência de template recém-importado resolvida no export sem reabrir o perfil.
- Testes de interface, backup, PNG/MP4 reais, janelas/áudio e equivalência temporal.
  Guia e validação: [release 0.4.0](docs/release-0.4.0.md).

## 0.3.1 — 2026-10-18

- Botão **Limpar todas** na faixa de mídias, disponível nos três layouts.
- Confirmação com quantidade e projeto; cancelar/Escape preservam a leva.
- Limpeza de todos os slots em uma única ação de desfazer/refazer; cliques
  repetidos não criam uma segunda limpeza vazia no histórico.
- Foto, templates, fontes, configurações, originais e outros perfis preservados;
  reprodução e seleção reiniciadas para a próxima leva, a partir do slot 1.
- Botão indisponível durante importação e em projeto vazio; controles da faixa
  se reorganizam para caber em janelas menores.
- Teste real de interface para limpar, desfazer/refazer, persistir, importar nova
  leva e preservar a biblioteca e outra conta. Execute `npm run test:clear`.

## 0.3.0 — 2026-10-17

- Foto de perfil com recorte, posição, zoom, confirmação e backup.
- Frases diárias em três idiomas, filtro de autor, textos pessoais e fontes;
  traduções livres identificadas e nenhuma frase inventada para preencher autor.
- Matrix local na seleção de contas, temas claro/escuro/sistema, cor, fontes,
  tamanho de texto, modo de desempenho e respeito a movimento reduzido.
- Layout central, player à direita ou foco; divisórias ajustáveis e restauração.
- Redimensionar e girar mídia/texto/logo pelo player, selecionar camadas,
  comparar original e edição e desfazer cada gesto como uma ação.
- Botão direito: remover do projeto, exportar um item, duplicar, re-vincular e
  copiar grupos de ajustes para selecionados ou todos.
- Timeline com quadros reais, cortes pelas pontas, campos precisos e divisão
  no cursor em dois slots independentes sem copiar o vídeo original.
- Assistente de recorte que distingue a cena de títulos isolados nas molduras.
- OCR local e referência visual em worker para localizar marcas por arquivo;
  revisão antes de sobrepor texto/logo com placa opaca, regras salvas na conta.
- Amostragem nativa de frames com escopos, cache e subprocessos sem console.
- Pré-verificação de exportação e novas regressões de dados, geometria e visão.
- Fluxos reais de navegador, backup, WebKit empacotado, OCR offline e vídeo
  H.264 exportado pela interface. Detalhes em [release 0.3.0](docs/release-0.3.0.md).

## Correções — 2026-10-17

- FFmpeg/FFprobe, miniaturas e ferramentas auxiliares deixam de criar consoles
  visíveis no Windows; captura de progresso, logs e cancelamento são preservados.
- Importação por pasta em um único seletor, bloqueio de cliques duplicados,
  progresso e resumo real de arquivos importados, ignorados e com falha.
- Slots vazios reutilizados sem lacunas por arquivos inválidos; lotes concorrentes
  recebem números distintos e mantêm o projeto de destino após navegação.
- URLs de assets em importação ficam protegidas até a confirmação; revincular
  renova a miniatura, preserva edições e recusa trocar o tipo da mídia.
- Miniaturas nativas são revalidadas ao carregar após a limpeza do cache;
  recolher/expandir a faixa virtualizada volta a revelar a mídia ativa.
- Relatório conta imagens, abre os destinos reais dos lotes e mostra o novo lote
  ao repetir falhas. Falhas de imagens impedem a ação final de energia.
- Seletores e importação aceitam a mesma lista de formatos; GIF/AVIF têm
  classificação e repetição compatíveis com o FFmpeg.
- Evidências e limites em [docs/bugfixes-2026-10-17.md](docs/bugfixes-2026-10-17.md).

## 0.2.0 — 2026-10-16

- Corrigida incompatibilidade que bloqueava `tauri build`: API JavaScript
  fixada em 2.11.1 para Rust Tauri 2.11.3, notification JavaScript/Rust em 2.4.0.
  O build desktop pelo CLI real passa a integrar a verificação documentada.
- Reconstrução em módulos de domínio, dados, render, serviços e interface,
  TypeScript estrito, arquivos de código com até 300 linhas.
- Contas isoladas com templates, grupos, fontes, presets, projetos, identidade,
  padrões de exportação, duplicação, arquivo e backup `.oeprofile`.
- Migração preserva dados legados, campos desconhecidos e arquivos recuperáveis;
  persistência nativa atômica, backups rotativos e indicação de arquivo ausente.
- RenderSpec com geometria compartilhada, crop visual, rotação, flip, círculo,
  texto com wrapping, camadas ordenadas, fundos e prévia FFmpeg.
- Histórico, seleção múltipla, grid virtualizado para 500+ arquivos, enquadramento
  relativo, trim/velocidade em lote, headlines e mix com semente.
- Motor Rust com jobs tipados, progresso real, cancelamento de subprocessos,
  pausa entre arquivos, retomada, retry de falhas, relatórios e logs.
- Exportação H.264/AAC, yuv420p, BT709, faststart; fallback de encoder, conflitos
  de nomes, escrita parcial e proteção dos arquivos originais.
- Limpeza de metadados isolada ou integrada, relatório antes/depois e detecção
  opcional do ExifTool. Browser exporta imagens e informa a exigência do desktop
  para vídeo.
- Capabilities e CSP restritas, concessões dinâmicas de caminhos, error boundaries,
  logs rotativos, sidecars verificados e workflow manual de build Windows.
- Testes unitários, mídia sintética, equivalência visual, migração real, navegador
  com 501 arquivos e integração da janela Tauri. Evidências em REPORT.md.

## Estado anterior

Editor com estado centralizado, coordenadas dependentes da interface, exportação
sem fila nativa e persistência em localStorage/IndexedDB. A arquitetura anterior
e os cuidados de recuperação estão em ARCHITECTURE.md e docs/backup-notes.md.
