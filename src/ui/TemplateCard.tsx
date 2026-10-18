import { useEffect, useRef, useState } from 'react';
import { createMediaItem } from '../domain/defaults';
import { generateThumbnail } from '../data/thumbnails';
import { Layers, Plus, Settings2, Trash2 } from 'lucide-react';
import type { AccountTemplate } from '../domain/models';
import { mediaUrl } from '../services/native';
import { ActionMenu } from './ActionMenu';
import { Button } from './Primitives';
export function TemplateCard({
  template,
  selected,
  disabled,
  onApply,
  onAppend,
  onEdit,
  onRemove,
}: {
  template: AccountTemplate;
  selected: boolean;
  disabled: boolean;
  onApply: () => void;
  onAppend?: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const video = template.mediaType === 'video' || /\.(mp4|mov|webm|mkv)$/i.test(template.name),
    source = template.runtimeUrl || mediaUrl(template.source);
  const thumbnail = useRef<HTMLDivElement>(null),
    [poster, setPoster] = useState<string | undefined>();
  useEffect(() => {
    let disposed = false,
      started = false;
    setPoster(undefined);
    if (!video || !thumbnail.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (started || !entries.some((entry) => entry.isIntersecting)) return;
      started = true;
      observer.disconnect();
      const item = createMediaItem('video', 1);
      item.runtimeUrl = source;
      void generateThumbnail(item, template.source)
        .then((value) => {
          if (!disposed) setPoster(value);
        })
        .catch(() => {});
    });
    observer.observe(thumbnail.current);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [source, template.source, video]);
  return (
    <div className="template-entry">
      <button className={`template-card ${selected ? 'selected' : ''}`} disabled={disabled} onClick={onApply} title={template.name}>
        <div className="template-thumb" ref={thumbnail}>
          {video ? poster ? <img src={poster} alt="" /> : <Layers size={24} /> : <img src={source} alt="" />}
        </div>
        <span className="template-caption truncate">{template.name}</span>
        {video && (
          <small className="template-video-tag">
            <Layers size={10} /> {template.sourceDuration?.toFixed(1) || '—'}s
          </small>
        )}
      </button>
      <div className="template-options">
        <ActionMenu label={`Opções do template ${template.name}`}>
          {onAppend && (
            <Button disabled={disabled} aria-label={`Adicionar camada de ${template.name}`} onClick={onAppend}>
              <Plus size={14} /> Adicionar como outra camada
            </Button>
          )}
          <Button aria-label={`Editar template ${template.name}`} onClick={onEdit}>
            <Settings2 size={14} /> Editar template
          </Button>
          <Button className="danger-text" aria-label={`Excluir template ${template.name}`} onClick={onRemove}>
            <Trash2 size={14} /> Excluir template
          </Button>
        </ActionMenu>
      </div>
    </div>
  );
}
