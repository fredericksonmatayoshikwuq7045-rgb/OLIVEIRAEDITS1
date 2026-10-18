import { describe, expect, it } from 'vitest';
import { createMediaItem } from './defaults';
import { copyAdjustments, duplicateMedia, splitMedia } from './editing';
import { appearance } from './preferences';
import { dailyThought } from './quotes';
describe('edição de clipes sem destruir a origem', () => {
  const video = () => ({
    ...createMediaItem('video', 1),
    sourcePath: '/original.mp4',
    status: 'ready' as const,
    trim: { in: 2, out: 10 },
    speed: 2,
  });
  it('divide no cursor mantendo origem, edições e tempos de camadas relativos aos novos clipes', () => {
    const item = video();
    item.render.layers = [
      {
        id: 'logo',
        type: 'image',
        source: '/logo.png',
        sourceWidth: 20,
        sourceHeight: 20,
        fit: 'contain',
        rect: { x: 0, y: 0, width: 0.2, height: 0.2 },
        rotation: 0,
        opacity: 1,
        zIndex: 20,
        visible: true,
        enable: { start: 1, end: 3 },
      },
    ];
    const [left, right] = splitMedia(item, 6);
    expect(left.id).toBe(item.id);
    expect(right.id).not.toBe(item.id);
    expect([left.trim, right.trim]).toEqual([
      { in: 2, out: 6 },
      { in: 6, out: 10 },
    ]);
    expect(right.sourcePath).toBe(item.sourcePath);
    expect(right.render.layers[0].enable).toEqual({ start: 0, end: 1 });
    expect(item.trim.out).toBe(10);
    expect(item.render.layers[0].enable).toEqual({ start: 1, end: 3 });
  });
  it('recusa divisão sem um quadro em cada lado e duplica sem compartilhar objetos de edição', () => {
    const item = video();
    expect(() => splitMedia(item, 2)).toThrow();
    expect(() => splitMedia(item, NaN)).toThrow();
    const copy = duplicateMedia(item);
    copy.render.media.pan.x = 0.3;
    expect(item.render.media.pan.x).toBe(0);
    expect(copy.sourcePath).toBe(item.sourcePath);
  });
  it('copia apenas grupos escolhidos e limita cortes ao vídeo de destino', () => {
    const source = video(),
      target = video();
    source.speed = 1.5;
    source.render.media.rotation = 90;
    target.trim = { in: 0, out: 3 };
    const result = copyAdjustments(source, target, ['speed']);
    expect(result.speed).toBe(1.5);
    expect(result.render.media.rotation).toBe(0);
    expect(result.trim).toEqual(target.trim);
  });
});
describe('preferências e frases do dia', () => {
  it('recupera preferências inválidas sem aceitar CSS arbitrário', () => {
    expect(appearance({ accent: 'url(evil)', fontSize: NaN, libraryWidth: 999 })).toMatchObject({
      accent: '#ed4355',
      fontSize: 13,
      libraryWidth: 340,
    });
  });
  it('mantém a frase estável no dia e não atribui uma frase inexistente a um autor escolhido', () => {
    const options = appearance({ quoteAuthor: 'Bíblia' });
    expect(dailyThought(options, '2026-10-17', 'profile')).toEqual(dailyThought(options, '2026-10-17', 'profile'));
    expect(dailyThought(appearance({ quoteAuthor: 'Autor sem citação' }), '2026-10-17')).toBeNull();
    expect(dailyThought(appearance({ quoteAuthor: 'Bíblia', quoteLanguage: 'es' }), '2026-10-17')?.text).toBeTruthy();
  });
});
