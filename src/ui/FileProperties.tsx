import { Link } from 'lucide-react';
import { chooseMediaFiles, isNative } from '../services/native';
import { Button, Field, Section, timecode } from './Primitives';
import type { EditorContext } from './useEditor';
export function FileProperties({ model }: { model: EditorContext }) {
  const { active, changeItem, store, relinkInput, notify } = model;
  if (!active) return null;
  return (
    <Section title="Arquivo original">
      <Field label="Nome da mídia">
        <input value={active.title} onChange={(event) => changeItem({ ...active, title: event.target.value })} />
      </Field>
      <p className="file-path tiny muted">{active.sourcePath || 'Arquivo local do navegador'}</p>
      {active.probe && (
        <div className="stack tiny muted">
          <span>
            {active.probe.width} × {active.probe.height} · {active.probe.codec}
          </span>
          {active.kind === 'video' && (
            <span>
              {timecode(active.probe.duration)} · {active.probe.hasAudio ? 'Com áudio' : 'Sem áudio'}
            </span>
          )}
        </div>
      )}
      {active.error && <div className="error-message">{active.error}</div>}
      <Button
        onClick={async () => {
          try {
            if (isNative()) {
              const files = await chooseMediaFiles();
              if (files[0]) await store.relinkItem(active.id, files[0]);
            } else relinkInput.current?.click();
          } catch (error) {
            notify(String(error));
          }
        }}
      >
        <Link size={14} /> Re-vincular arquivo
      </Button>
      <input
        ref={relinkInput}
        hidden
        type="file"
        aria-label="Re-vincular arquivo"
        accept="image/*,video/*"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) {
            try {
              await store.relinkItem(active.id, file);
            } catch (error) {
              notify(String(error));
            }
          }
          event.target.value = '';
        }}
      />
    </Section>
  );
}
