import { Film, Image, LayoutGrid } from 'lucide-react';
import type { EditorContext } from './useEditor';
export function MediaAreas({ model }: { model: EditorContext }) {
  return (
    <nav className="media-areas" aria-label="Áreas de edição">
      <div role="tablist" aria-label="Escolher área">
        {(
          [
            ['all', 'Todas', LayoutGrid],
            ['video', 'Vídeos', Film],
            ['image', 'Imagens', Image],
          ] as const
        ).map(([kind, label, Icon]) => (
          <button
            role="tab"
            aria-selected={model.workspaceKind === kind}
            key={kind}
            onClick={() => {
              model.setWorkspaceKind(kind);
              model.setSelectedIds([]);
              model.setActiveId(null);
              model.setPlaying(false);
            }}
          >
            <Icon size={14} />
            {label} <span className="badge">{model.allItems.filter((item) => kind === 'all' || item.kind === kind).length}</span>
          </button>
        ))}
      </div>
      <span className="tiny muted">
        {model.workspaceKind === 'image'
          ? 'Editor de imagens · ferramentas completas'
          : model.workspaceKind === 'video'
            ? 'Editor de vídeos · timeline de camadas'
            : 'Projeto completo · vídeos e imagens'}
      </span>
    </nav>
  );
}
