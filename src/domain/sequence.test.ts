import { describe, expect, it } from 'vitest';
import { createMediaItem, createProfile } from './defaults';
import { applyTemplate, removeTemplateReferences } from './templates';
import {
  compositionDuration,
  compositionSpec,
  editTrackRange,
  mainRange,
  MEDIA_TRACK,
  outputTime,
  playerTime,
  reorderTrack,
  timelineTracks,
  makeIntro,
} from './timeline';
import { copyAdjustments, splitMedia } from './editing';
import { splitLayer } from './sequence';
import { activeAt } from '../render/playback';
import { hitLayer } from '../render/transform';
import type { AccountTemplate } from './models';
function sequence() {
  const item = createMediaItem('video', 1);
  item.status = 'ready';
  item.trim = { in: 1, out: 6 };
  item.probe = {
    path: 'main.mp4',
    width: 320,
    height: 180,
    duration: 12,
    fps: 30,
    codec: 'h264',
    pixFmt: 'yuv420p',
    rotation: 0,
    hasAudio: true,
    tags: {},
    sizeBytes: 100,
    isImage: false,
  };
  const template: AccountTemplate = {
    id: 'intro',
    name: 'Abertura',
    category: 'headline',
    groupId: 'g',
    type: 'video',
    mediaType: 'video',
    source: 'intro.mp4',
    sourceWidth: 320,
    sourceHeight: 180,
    sourceDuration: 8,
    headlineText: 'Manda para seu amigo',
    placement: { x: 0, y: 0, width: 1, rotation: 0, opacity: 1, zIndex: 30 },
  };
  return applyTemplate(item, template, 'headline');
}
describe('Sequências independentes do vídeo principal', () => {
  it('adicionar outro template mantém as camadas e excluir um template preserva os demais', () => {
    const item = sequence();
    const extra: AccountTemplate = {
      id: 'second',
      name: 'Foto',
      category: 'headline',
      groupId: 'g',
      type: 'video',
      mediaType: 'image',
      source: 'photo.png',
      placement: { x: 0, y: 0, width: 1, rotation: 0, opacity: 1, zIndex: 30 },
    };
    const appended = applyTemplate(item, extra, 'headline', true);
    expect(appended.render.layers).toHaveLength(3);
    const divided = splitLayer(appended, item.render.layers[0].id, 3);
    const removed = removeTemplateReferences(divided, 'intro');
    expect(removed.render.layers).toHaveLength(1);
    expect(removed.templates.headline).toBe('second');
    expect(removed.render.layers[0].type).toBe('image');
  });
  it('uma headline de 8s não é cortada pelo vídeo de 5s e a abertura gera 13s de saída', () => {
    const item = sequence(),
      intro = item.render.layers[0];
    expect(compositionDuration(item)).toBe(8);
    const legacy = structuredClone(item);
    legacy.render.layers.forEach((layer) => {
      layer.enable = undefined;
    });
    expect(compositionDuration(legacy)).toBe(8);
    expect(intro.enable).toEqual({ start: 0, end: 8 });
    const edited = makeIntro(item, intro.id);
    expect(mainRange(edited)).toEqual({ start: 8, end: 13 });
    expect(compositionDuration(edited)).toBe(13);
    expect(edited.render.layers[1].enable).toEqual({ start: 0, end: 8 });
    expect(activeAt(compositionSpec(edited).media, 7.99)).toBe(false);
    expect(activeAt(compositionSpec(edited).media, 8)).toBe(true);
    expect(activeAt(compositionSpec(edited).media, 13)).toBe(false);
    expect(item.mediaStart).toBeUndefined();
  });
  it('seleciona a abertura atrás do principal enquanto ele ainda não entrou', () => {
    const item = makeIntro(sequence(), sequence().render.layers[0].id);
    item.render.layers = item.render.layers.filter((layer) => layer.type !== 'text');
    item.render.layers[0].zIndex = 0;
    expect(hitLayer(item, { x: 100, y: 100 }, 1)).toBe(item.render.layers[0].id);
    item.mediaStart = 0;
    item.render.media.fit = 'stretch';
    expect(hitLayer(item, { x: 100, y: 100 }, 1)).toBeNull();
  });
  it('converte cursor durante abertura, trim e velocidade sem consumir o início do meme', () => {
    const item = makeIntro(sequence(), sequence().render.layers[0].id);
    item.speed = 2;
    expect(mainRange(item)).toEqual({ start: 8, end: 10.5 });
    expect(playerTime(item, 0)).toBe(-15);
    expect(playerTime(item, 8)).toBe(1);
    expect(playerTime(item, 9)).toBe(3);
    expect(outputTime(item, 3)).toBe(9);
  });
  it('foto e texto também podem terminar após a mídia principal, e camadas ocultas não alongam a saída', () => {
    const item = sequence();
    item.kind = 'image';
    item.imageDuration = 2;
    item.imageTime = 7;
    expect(mainRange(item).end).toBe(2);
    expect(compositionDuration(item)).toBe(8);
    item.render.layers.forEach((layer) => (layer.visible = false));
    expect(compositionDuration(item)).toBe(2);
  });
  it('reordena acima e abaixo do principal mesmo quando existem ordens empatadas', () => {
    const item = sequence();
    item.render.layers[0].zIndex = 10;
    item.render.layers[1].zIndex = 10;
    let edited = reorderTrack(item, MEDIA_TRACK, item.render.layers[0].id);
    expect(timelineTracks(edited, createProfile('Conta'))[0].id).toBe(MEDIA_TRACK);
    edited = reorderTrack(edited, MEDIA_TRACK, item.render.layers[1].id);
    const order = timelineTracks(edited, createProfile('Conta')).map((track) => track.id);
    expect(order.indexOf(MEDIA_TRACK)).toBeGreaterThan(order.indexOf(item.render.layers[1].id));
  });
  it('mover o principal mantém seu conteúdo; aparar as pontas altera o trecho e respeita a origem', () => {
    const item = sequence();
    item.mediaStart = 8;
    const moved = editTrackRange(item, MEDIA_TRACK, { start: 10, end: 15 });
    expect(moved.trim).toEqual(item.trim);
    expect(moved.mediaStart).toBe(10);
    const trimmed = editTrackRange(item, MEDIA_TRACK, { start: 9, end: 13 }, 'start');
    expect(trimmed.trim).toEqual({ in: 2, out: 6 });
    expect(mainRange(trimmed)).toEqual({ start: 9, end: 13 });
    const extended = editTrackRange(item, MEDIA_TRACK, { start: 8, end: 100 }, 'end');
    expect(extended.trim.out).toBe(12);
  });
  it('copia a sequência para outra duração sem trocar sua fonte nem cortar o meme', () => {
    const source = makeIntro(sequence(), sequence().render.layers[0].id),
      target = createMediaItem('video', 2);
    target.trim = { in: 0, out: 2 };
    target.render.media.source = 'other.mp4';
    const copied = copyAdjustments(source, target, ['layers', 'background', 'framing']);
    expect(copied.trim).toEqual(target.trim);
    expect(copied.render.media.source).toBe('other.mp4');
    expect(mainRange(copied)).toEqual({ start: 8, end: 10 });
    expect(compositionDuration(copied)).toBe(10);
    copied.render.layers[0].rect.width = 0.25;
    expect(source.render.layers[0].rect.width).toBe(1);
  });
  it('divide apenas uma camada preservando a fase e o restante da composição', () => {
    const item = sequence(),
      layer = item.render.layers[0];
    const edited = splitLayer(item, layer.id, 3);
    expect(edited.render.layers[0].enable).toEqual({ start: 0, end: 3 });
    expect(edited.render.layers[1]).toMatchObject({ enable: { start: 3, end: 8 }, sourceOffset: 3, loop: false });
    expect(edited.trim).toEqual(item.trim);
    expect(compositionDuration(edited)).toBe(8);
  });
  it('dividir um vídeo com abertura mantém a chamada só na primeira parte', () => {
    const item = makeIntro(sequence(), sequence().render.layers[0].id);
    const [left, right] = splitMedia(item, 3);
    expect(mainRange(left)).toEqual({ start: 8, end: 10 });
    expect(mainRange(right)).toEqual({ start: 0, end: 3 });
    expect(right.render.layers).toHaveLength(0);
  });
});
