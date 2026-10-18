import { describe, expect, it } from 'vitest';
import { createMediaItem, createProfile } from './defaults';
import { applyTemplate } from './templates';
import { splitMedia } from './editing';
import { BACKGROUND_TRACK, compositionDuration, imageFrameTime, movedRange, patchTrack, removeTrack, timelineTracks } from './timeline';
import { activeAt, bindingTime, layerVideoKey, videoBindings } from '../render/playback';
import { assetRequests } from '../render/assets';
import { createTextLayer } from '../render/types';
import type { AccountTemplate } from './models';
const template = (category: AccountTemplate['category'], video = false): AccountTemplate => ({
  id: `template-${category}`,
  name: category,
  groupId: 'group',
  category,
  type: 'video',
  mediaType: video ? 'video' : 'image',
  source: 'asset:logo',
  sourceWidth: 100,
  sourceHeight: 50,
  sourceDuration: video ? 3 : undefined,
  headlineText: category === 'headline' ? 'Título' : undefined,
  placement: { x: 0, y: 0, width: 1, rotation: 0, opacity: 1, zIndex: category === 'background' ? 5 : 30 },
});
describe('Timeline de todas as camadas', () => {
  it('expõe fundo, borda, marca, headline e texto sem remover campos do fundo', () => {
    const profile = createProfile('Conta');
    profile.templates = ['border', 'watermark', 'headline', 'background'].map((category) =>
      template(category as AccountTemplate['category'], category === 'background'),
    );
    let item = createMediaItem('video', 1);
    item.trim = { in: 2, out: 8 };
    item.speed = 2;
    for (const value of profile.templates) item = applyTemplate(item, value, value.category);
    expect(timelineTracks(item, profile)).toHaveLength(6);
    const timed = patchTrack(item, BACKGROUND_TRACK, { enable: { start: 0.5, end: 2 }, visible: false, sourceOffset: 0.25 });
    expect(timed.render.background).toMatchObject({
      type: 'video',
      audio: 'mute',
      loop: true,
      sourceDuration: 3,
      sourceOffset: 0.25,
      enable: { start: 0.5, end: 2 },
      visible: false,
    });
    expect(item.render.background.visible).toBeUndefined();
    expect(compositionDuration(item)).toBe(3);
  });
  it('arrasta limites e faixa sem inverter, ultrapassar a duração ou perder o tamanho', () => {
    expect(movedRange({ start: 1, end: 3 }, 10, 6, 'move', 0.1)).toEqual({ start: 4, end: 6 });
    expect(movedRange({ start: 1, end: 3 }, -10, 6, 'move', 0.1)).toEqual({ start: 0, end: 2 });
    expect(movedRange({ start: 1, end: 3 }, 10, 6, 'start', 0.1)).toEqual({ start: 2.9, end: 3 });
    expect(movedRange({ start: 1, end: 3 }, -10, 6, 'end', 0.1)).toEqual({ start: 1, end: 1.1 });
    expect(movedRange({ start: 0, end: 6 }, 10, 3, 'start', 0.1)).toEqual({ start: 2.9, end: 3 });
  });
  it('oculta em fim exclusivo e calcula o frame com início, offset, loop e congelamento', () => {
    const binding = { key: 'x', source: 'video', enable: { start: 2, end: 5 }, sourceOffset: 0.5, loop: true };
    expect(activeAt(binding, 1.99)).toBe(false);
    expect(activeAt(binding, 2)).toBe(true);
    expect(activeAt(binding, 5)).toBe(false);
    expect(bindingTime(binding, 3, 2)).toBe(1.5);
    expect(bindingTime(binding, 4, 2)).toBe(0.5);
    expect(bindingTime({ ...binding, loop: false }, 4, 2)).toBe(1.999);
  });
  it('mantém decoders distintos quando o mesmo vídeo aparece em camadas com tempos diferentes', () => {
    const item = applyTemplate(createMediaItem('video', 1), template('watermark', true), 'watermark');
    const layer = item.render.layers[0];
    if (layer.type === 'text') throw new Error();
    item.render.layers.push({ ...layer, id: 'duplicate', sourceOffset: 1 });
    expect(assetRequests(item.render).filter((value) => value.type === 'video')).toHaveLength(2);
    expect(videoBindings(item.render).map((value) => value.key)).toContain(layerVideoKey('duplicate'));
  });
  it('persiste momento da imagem, limita ao último instante e infere duração dos templates', () => {
    const item = applyTemplate(createMediaItem('image', 1), template('background', true), 'background');
    item.render.background.enable = { start: 1, end: 8 };
    expect(compositionDuration(item)).toBe(8);
    item.imageDuration = 4;
    item.imageTime = 5;
    expect(imageFrameTime(item)).toBe(5);
    item.imageTime = 9;
    expect(imageFrameTime(item)).toBe(7.999);
    item.imageTime = Number.NaN;
    expect(imageFrameTime(item)).toBe(0);
  });
  it('remover headline só desvincula o template após remover todas as suas camadas', () => {
    let item = applyTemplate(createMediaItem('video', 1), template('headline'), 'headline');
    item.render.layers.push(createTextLayer('free-text'));
    item = removeTrack(item, item.render.layers[0].id);
    expect(item.templates.headline).toBe('template-headline');
    item = removeTrack(item, item.render.layers[0].id);
    expect(item.templates.headline).toBeNull();
    expect(item.render.layers[0].id).toBe('free-text');
  });
  it('split preserva a fase dos vídeos e recorta o fundo com a mesma regra das camadas', () => {
    let item = createMediaItem('video', 1);
    item.status = 'ready';
    item.trim = { in: 1, out: 7 };
    item = applyTemplate(applyTemplate(item, template('watermark', true), 'watermark'), template('background', true), 'background');
    item.render.layers[0].enable = { start: 1, end: 5 };
    item.render.background.enable = { start: 1, end: 5 };
    const [left, right] = splitMedia(item, 3);
    expect(left.render.background.enable).toEqual({ start: 1, end: 2 });
    expect(right.render.background).toMatchObject({ enable: { start: 0, end: 3 }, sourceOffset: 1 });
    expect(right.render.layers[0]).toMatchObject({ enable: { start: 0, end: 3 }, sourceOffset: 1 });
  });
});
