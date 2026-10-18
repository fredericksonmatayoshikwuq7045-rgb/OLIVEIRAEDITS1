import { Modal } from './Primitives';
export function Help({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    ['Ctrl + Z', 'Desfazer edição'],
    ['Ctrl + Shift + Z', 'Refazer edição'],
    ['Ctrl + A', 'Selecionar todas as mídias'],
    ['Ctrl + ← / →', 'Navegar entre mídias'],
    ['Ctrl + E', 'Abrir exportação'],
    ['S', 'Dividir vídeo no cursor da timeline'],
    ['Ctrl + D', 'Duplicar mídia'],
    ['Delete', 'Remover mídia do projeto (preserva o original)'],
    ['Botão direito', 'Ações rápidas do slot ou player'],
    ['Alças no player', 'Redimensionar e girar a seleção'],
    ['Setas', 'Mover enquadramento em 1 pixel'],
    ['Shift + Setas', 'Mover enquadramento em 10 pixels'],
    ['Ctrl + clique', 'Adicionar ou remover da seleção'],
    ['Shift + clique', 'Selecionar um intervalo'],
    ['?', 'Abrir esta ajuda'],
  ];
  return (
    <Modal title="Atalhos e ajuda" onClose={onClose}>
      <p className="muted">Os atalhos de edição respeitam campos de texto. Arraste a mídia para mover; use a roda do mouse para ampliar.</p>
      <dl className="shortcuts">
        {shortcuts.map(([key, label]) => (
          <div key={key}>
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
      <div className="notice">
        Vídeos editados são exportados pelo aplicativo para Windows com FFmpeg. A versão no navegador serve para desenvolvimento, edição e
        exportação de imagens.
      </div>
    </Modal>
  );
}
