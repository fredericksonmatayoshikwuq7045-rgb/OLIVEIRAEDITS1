import type { AspectRatio } from '../domain/models';
import { AutomationPanel } from './AutomationPanel';
import { CopyAdjustments } from './CopyAdjustments';
import { ClearMediaDialog } from './ClearMediaDialog';
import { MediaContextMenu } from './MediaContextMenu';
import { BatchDialog } from './BatchDialog';
import { ExportDialog } from './ExportDialog';
import { PanelBoundary } from './PanelBoundary';
import { Button, Field, Modal } from './Primitives';
import type { EditorContext } from './useEditor';

export function EditorDialogs({ model }: { model: EditorContext }) {
  const {
    batch,
    profile,
    selected,
    active,
    applyUpdated,
    setBatch,
    exporting,
    items,
    engine,
    settings,
    store,
    metadata,
    setExporting,
    notify,
    saving,
    setSaving,
    saveName,
    pendingStyle,
    setSaveName,
    preview,
    setPreview,
  } = model;
  return (
    <>
      {model.clearProjectId === model.project.id && <ClearMediaDialog model={model} />}
      {model.automation && <AutomationPanel model={model} onClose={() => model.setAutomation(false)} />}
      {model.menu && <MediaContextMenu menu={model.menu} onClose={() => model.setMenu(null)} onAction={model.clipAction} />}
      {model.copy && (
        <CopyAdjustments
          source={model.copy.source}
          sequence={model.copy.sequence}
          targets={items.filter((item) => model.copy!.ids.includes(item.id))}
          onApply={applyUpdated}
          onClose={() => model.setCopy(null)}
        />
      )}
      {batch && (
        <BatchDialog
          onMixChange={(category, rule) => store.updateProfile({ mixRules: { ...profile.mixRules, [category]: rule } })}
          profile={profile}
          items={selected}
          active={active}
          onApply={applyUpdated}
          onClose={() => setBatch(false)}
        />
      )}
      {exporting && (
        <PanelBoundary name="exportação">
          <ExportDialog
            profile={profile}
            items={model.exportIds ? items.filter((item) => model.exportIds!.includes(item.id)) : selected.length ? selected : items}
            engine={engine}
            settings={settings}
            onProfile={(value) => store.updateProfile(value)}
            initialMetadata={metadata}
            onClose={() => setExporting(false)}
            notify={notify}
          />
        </PanelBoundary>
      )}
      {saving && (
        <Modal title={saving === 'preset' ? 'Salvar enquadramento' : 'Salvar estilo de texto'} onClose={() => setSaving(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!saveName.trim() || !active) return;
              if (saving === 'preset')
                store.updateProfile({
                  framingPresets: [
                    ...profile.framingPresets,
                    {
                      id: crypto.randomUUID(),
                      name: saveName.trim(),
                      aspectRatio:
                        (Object.keys({ '9:16': 1, '16:9': 1, '1:1': 1, '4:5': 1 }) as AspectRatio[]).find((r) => {
                          const [w, h] = r.split(':').map(Number);
                          return Math.abs(w / h - active.render.canvas.width / active.render.canvas.height) < 0.01;
                        }) || profile.aspectRatio,
                      media: structuredClone(active.render.media),
                    },
                  ],
                });
              else if (pendingStyle)
                store.updateProfile({
                  textStyles: [
                    ...profile.textStyles,
                    {
                      id: crypto.randomUUID(),
                      name: saveName.trim(),
                      fontFamily: pendingStyle.fontFamily,
                      fontSize: pendingStyle.fontSize,
                      color: pendingStyle.color,
                      backgroundColor: pendingStyle.background.color,
                      strokeColor: pendingStyle.stroke.color,
                      strokeWidth: pendingStyle.stroke.width,
                    },
                  ],
                });
              setSaving(null);
              notify('Salvo na biblioteca da conta.');
            }}
          >
            <Field label="Nome">
              <input
                autoFocus
                required
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder={saving === 'preset' ? 'Ex.: Rosto centralizado' : 'Ex.: Headline vermelha'}
              />
            </Field>
            <div className="form-actions">
              <Button variant="primary" type="submit">
                Salvar
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {preview && (
        <Modal title="Prévia real da exportação" wide onClose={() => setPreview(null)}>
          {preview.match(/\.(png|jpe?g)(?:[?#]|$)/i) ? (
            <img
              src={preview}
              alt="Frame renderizado pelo FFmpeg"
              style={{ maxWidth: '100%', maxHeight: '65vh', margin: 'auto', display: 'block' }}
            />
          ) : (
            <video src={preview} controls autoPlay style={{ width: '100%', maxHeight: '65vh' }} />
          )}
          <small>Gerado com o mesmo pipeline da saída final.</small>
        </Modal>
      )}
    </>
  );
}
