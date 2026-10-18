import { Info, Layers } from 'lucide-react';
import { BACKGROUND_TRACK, MEDIA_TRACK, timelineTracks } from '../domain/timeline';
import { ActionMenu } from './ActionMenu';
import { BackgroundProperties } from './BackgroundProperties';
import { FileProperties } from './FileProperties';
import { FramingProperties } from './FramingProperties';
import { ImageTimeline } from './ImageTimeline';
import { PanelBoundary } from './PanelBoundary';
import { Button, Section } from './Primitives';
import { TextProperties } from './TextProperties';
import { TrackGeometry } from './TrackGeometry';
import { TrackInspector } from './TrackInspector';
import { VideoTimeline } from './VideoTimeline';
import { selectEditorTrack } from './trackCommands';
import type { EditorContext } from './useEditor';
export function EditorProperties({ model }: { model: EditorContext }) {
  const { active, profile, changeItem, layerId } = model;
  const selected = active ? timelineTracks(active, profile).find((track) => track.id === (layerId || MEDIA_TRACK)) : null;
  const main = selected?.id === MEDIA_TRACK,
    bg = selected?.id === BACKGROUND_TRACK;
  const layer = active?.render.layers.find((layer) => layer.id === layerId);
  const tab = model.inspectorTab === 'audio' && selected?.type !== 'video' ? 'basic' : model.inspectorTab;
  return (
    <PanelBoundary name="propriedades">
      <aside className="properties contextual-properties" aria-label="Propriedades da seleção">
        <div className="properties-heading">
          <div className="selection-title">
            <Layers size={14} />
            <strong className="truncate" title={selected?.name}>
              {tab === 'file' ? 'Arquivo original' : selected?.name || 'Detalhes'}
            </strong>
          </div>
          {active && (
            <ActionMenu label="Opções da seleção">
              <Button onClick={() => model.setInspectorTab('file')}>
                <Info size={14} /> Informações do arquivo
              </Button>
              <Button onClick={() => selectEditorTrack(model, BACKGROUND_TRACK)}>Editar fundo</Button>
            </ActionMenu>
          )}
        </div>
        {active && selected ? (
          <>
            <nav role="tablist" className="inspector-tabs" aria-label="Ajustes da seleção">
              {[['basic', 'Básico'], ['timing', 'Tempo'], ...(selected.type === 'video' ? [['audio', 'Áudio']] : [])].map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => model.setInspectorTab(id as 'basic' | 'timing' | 'audio')}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="inspector-content">
              {tab === 'file' ? (
                <FileProperties model={model} />
              ) : tab === 'audio' ? (
                <TrackInspector item={active} selected={selected} mode="audio" onChange={changeItem} />
              ) : tab === 'timing' ? (
                <>
                  <TrackInspector item={active} selected={selected} onChange={changeItem} />
                  {main && active.kind === 'video' && (
                    <VideoTimeline
                      sourceOnly
                      item={active}
                      profile={profile}
                      time={model.time}
                      playing={model.playing}
                      onTime={model.setTime}
                      onPlay={model.togglePlayback}
                      onChange={changeItem}
                      onSplit={model.split}
                      performance={model.settings.performance}
                    />
                  )}
                  {active.kind === 'image' && <ImageTimeline item={active} onTime={model.setTime} onChange={changeItem} />}
                </>
              ) : bg ? (
                <BackgroundProperties item={active} onChange={changeItem} />
              ) : main ? (
                <FramingProperties
                  item={active}
                  profile={profile}
                  onChange={changeItem}
                  onApply={model.applyFraming}
                  onSavePreset={() => {
                    model.setSaving('preset');
                    model.setSaveName('');
                  }}
                  cropMode={model.cropMode}
                  onCropMode={(value) => {
                    model.setCropMode(value);
                    model.setStep(2);
                  }}
                  cropLocked={model.cropLocked}
                  onCropLocked={model.setCropLocked}
                  guides={model.guides}
                  onGuides={model.setGuides}
                  safeZone={model.safeZone}
                  onSafeZone={model.setSafeZone}
                />
              ) : (
                <>
                  {layer?.type === 'text' && (
                    <TextProperties
                      compact
                      item={active}
                      profile={profile}
                      selectedId={layerId}
                      onSelect={model.setLayerId}
                      onChange={changeItem}
                      onApplyText={() =>
                        model.applyUpdated(
                          model.selected.map((item) => ({
                            ...item,
                            render: {
                              ...item.render,
                              layers: [
                                ...item.render.layers.filter((layer) => layer.type !== 'text'),
                                ...active.render.layers.filter((layer) => layer.type === 'text').map((layer) => structuredClone(layer)),
                              ],
                            },
                          })),
                        )
                      }
                      onSaveStyle={(layer) => {
                        model.setPendingStyle(layer);
                        model.setSaving('style');
                        model.setSaveName('');
                      }}
                    />
                  )}
                  <Section title="Transformação" defaultOpen={layer?.type !== 'text'}>
                    <TrackGeometry item={active} id={selected.id} onChange={changeItem} />
                  </Section>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="inspector-empty">
            <Layers size={28} />
            <p>Selecione um clipe para ajustar sua edição.</p>
          </div>
        )}
      </aside>
    </PanelBoundary>
  );
}
