# Changelog

## 0.2.0 — 2026-10-16

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
