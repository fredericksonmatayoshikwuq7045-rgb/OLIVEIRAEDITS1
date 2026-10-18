import { Modal } from './Primitives';
export function Help({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    ['Ctrl + Z', 'Desfazer edição'],
    ['Ctrl + Shift + Z', 'Refazer edição'],
    ['Ctrl + A', 'Selecionar todas as mídias'],
    ['Ctrl + ← / →', 'Navegar entre mídias'],
    ['Ctrl + E', 'Abrir exportação'],
    ['S', 'Dividir o clipe selecionado no cursor'],
    ['Ctrl + D', 'Duplicar a camada ou mídia selecionada'],
    ['Delete', 'Remover a camada ou mídia selecionada (Ctrl + Z desfaz)'],
    ['Botão direito', 'Ações rápidas do slot, player ou faixa da timeline'],
    ['Alças no player', 'Redimensionar e girar a seleção'],
    ['Setas', 'Mover enquadramento em 1 pixel'],
    ['Shift + Setas', 'Mover enquadramento em 10 pixels'],
    ['Ctrl + clique', 'Adicionar ou remover da seleção'],
    ['Shift + clique', 'Selecionar um intervalo'],
    ['?', 'Abrir esta ajuda'],
  ];
  return (
    <Modal title="Atalhos e ajuda" onClose={onClose}>
      <p>
        Mídias, Templates e Texto ficam na biblioteca. Selecione um clipe no player ou na timeline e use Básico, Tempo ou Áudio no painel
        lateral. Importar pasta e Limpar todas ficam no menu das mídias; o assistente fica em Lote.
      </p>
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
