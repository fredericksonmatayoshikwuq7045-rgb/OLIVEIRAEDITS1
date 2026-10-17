# Changelog

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
