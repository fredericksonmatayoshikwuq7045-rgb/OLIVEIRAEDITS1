# OLIVEIRA EDITS

Editor em massa de vídeos e imagens. 100% local, sem API, sem internet obrigatória.

## Requisitos

- Node.js 18+
- npm

## Como rodar

```bash
npm install
npm run dev
```

Abre em: http://localhost:3000

## Build para produção

```bash
npm run build
npm run preview
```

## Estrutura

```
src/
├── App.tsx                    # App principal + estado global
├── types.ts                   # Tipos TypeScript
├── utils.ts                   # Helpers + dados iniciais
├── index.css                  # Tema dark vermelho
└── components/
    ├── MediaGrid.tsx           # Grid 100 slots numerados
    ├── VideoPlayerPanel.tsx    # Player + trim + crop (vídeo)
    ├── ImageEditorPanel.tsx    # Editor canvas (imagem) + fontes + layers de texto
    ├── Sidebar.tsx             # Importar + templates + exportar
    └── ExportModal.tsx         # Fila de exportação em lote
```

## Fontes custom

Coloque o arquivo `00bb.ico` na pasta `public/` para usar como ícone do app.

Para fontes custom: use o botão "Upload TTF/OTF" na aba Fontes do editor de imagem.
