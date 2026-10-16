import { Layers, Link, Settings2, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import { chooseMediaFiles, isNative } from '../services/native';
import { BackgroundProperties } from './BackgroundProperties';
import { FramingProperties } from './FramingProperties';
import { PanelBoundary } from './PanelBoundary';
import { Button, Field, Section, timecode } from './Primitives';
import { TextProperties } from './TextProperties';
import type { EditorContext } from './useEditor';

export function EditorProperties({ model }: { model: EditorContext }) {
  const {
    step,
    active,
    selected,
    profile,
    changeItem,
    applyFraming,
    setSaving,
    setSaveName,
    cropMode,
    setCropMode,
    cropLocked,
    setCropLocked,
    guides,
    setGuides,
    safeZone,
    setSafeZone,
    layerId,
    setLayerId,
    applyUpdated,
    setPendingStyle,
    store,
    relinkInput,
    notify,
    setStep,
    setBatch,
    openExport,
  } = model;
  return (
    <PanelBoundary name="propriedades">
      <aside className="properties">
        <div className="properties-heading">
          <h3>{step === 3 ? 'Camadas e texto' : step === 2 ? 'Enquadramento' : 'Propriedades da mídia'}</h3>
          <small>
            {active
              ? `Mídia ${active.slot.toString().padStart(2, '0')} · ${selected.length} selecionada(s)`
              : 'Importe uma mídia para editar'}
          </small>
        </div>
        {active &&
          (step === 2 ? (
            <FramingProperties
              item={active}
              profile={profile}
              onChange={changeItem}
              onApply={applyFraming}
              onSavePreset={() => {
                setSaving('preset');
                setSaveName('');
              }}
              cropMode={cropMode}
              onCropMode={setCropMode}
              cropLocked={cropLocked}
              onCropLocked={setCropLocked}
              guides={guides}
              onGuides={setGuides}
              safeZone={safeZone}
              onSafeZone={setSafeZone}
            />
          ) : step === 3 ? (
            <TextProperties
              item={active}
              profile={profile}
              selectedId={layerId}
              onSelect={setLayerId}
              onChange={changeItem}
              onApplyText={() =>
                applyUpdated(
                  selected.map((item) => ({
                    ...item,
                    render: {
                      ...item.render,
                      layers: [
                        ...item.render.layers.filter((l) => l.type !== 'text'),
                        ...active.render.layers.filter((l) => l.type === 'text').map((l) => structuredClone(l)),
                      ],
                    },
                  })),
                )
              }
              onSaveStyle={(layer) => {
                setPendingStyle(layer);
                setSaving('style');
                setSaveName('');
              }}
            />
          ) : (
            <>
              <Section title="Arquivo">
                <Field label="Nome da mídia">
                  <input value={active.title} onChange={(e) => changeItem({ ...active, title: e.target.value })} />
                </Field>
                <small className="mono" style={{ overflowWrap: 'anywhere' }}>
                  {active.sourcePath || 'Arquivo local do navegador'}
                </small>
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
                  <Link /> Re-vincular arquivo
                </Button>
                <input
                  ref={relinkInput}
                  hidden
                  type="file"
                  aria-label="Re-vincular arquivo"
                  accept="image/*,video/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        await store.relinkItem(active.id, file);
                      } catch (error) {
                        notify(String(error));
                      }
                    }
                    e.target.value = '';
                  }}
                />
              </Section>
              <Section title="Próximos passos">
                <Button onClick={() => setStep(2)}>
                  <SlidersHorizontal /> Enquadrar mídia
                </Button>
                <Button onClick={() => setStep(3)}>
                  <Layers /> Templates e texto
                </Button>
                <Button onClick={() => setBatch(true)} disabled={!selected.length}>
                  <Settings2 /> Editar seleção em lote
                </Button>
                <Button onClick={() => openExport(true)}>
                  <ShieldCheck /> Só limpar metadados
                </Button>
              </Section>
              <BackgroundProperties item={active} onChange={changeItem} />
              <Section title="Remover mídia" defaultOpen={false}>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm(`Remover “${active.title}” do projeto? O arquivo original será preservado.`))
                      store.updateProject((p) => ({ ...p, items: p.items.filter((item) => item.id !== active.id) }));
                  }}
                >
                  <Trash2 /> Remover do projeto
                </Button>
              </Section>
            </>
          ))}
      </aside>
    </PanelBoundary>
  );
}
