import { describe, expect, it } from 'vitest';
import { copyFraming, mixTemplateIds, outputFilename, parseHeadlines, rangeSelection, safeFilename, sortMedia, trimItems } from './batch';
import { createMediaItem } from './defaults';
import { commitHistory, createHistory, redoHistory, undoHistory } from './history';

describe('nomes de saída seguros', () => {
  it('substitui todas as variáveis com horário local e elimina caracteres Windows inválidos', () => {
    expect(
      outputFilename(
        '{conta}_{slot}_{n}_{data}_{hora}_{original}_{aspect}',
        { conta: 'Página: A', slot: 4, n: 2, original: 'filmagem.mov', aspect: '9:16', date: new Date(2026, 9, 16, 4, 5, 6) },
        '.mp4',
      ),
    ).toBe('Página_ A_04_02_2026-10-16_04-05-06_filmagem_9x16.mp4');
    expect(safeFilename('CON')).toBe('_CON');
    expect(safeFilename('../a\\b?. ')).toBe('.._a_b_');
  });
});
describe('mix determinístico', () => {
  it('mantém seed estável, não repete consecutivo e lida com biblioteca vazia/unitária', () => {
    expect(mixTemplateIds(['a', 'b', 'c'], 40, 'random', 31)).toEqual(mixTemplateIds(['a', 'b', 'c'], 40, 'random', 31));
    const ids = mixTemplateIds(['a', 'b', 'c'], 100, 'no-repeat', 9);
    expect(ids.every((id, index) => !index || id !== ids[index - 1])).toBe(true);
    expect(mixTemplateIds(['a'], 4, 'no-repeat')).toEqual(['a', 'a', 'a', 'a']);
    expect(mixTemplateIds([], 10, 'random')).toEqual([]);
    expect(mixTemplateIds(['a', 'b'], 3, 'sequential')).toEqual(['a', 'b', 'a']);
    expect(mixTemplateIds(['a', 'b'], 3, 'fixed')).toEqual(['a', 'a', 'a']);
  });
});
describe('operações de lote', () => {
  it('copia enquadramento sem trocar fonte, dimensões ou tipo da mídia de destino', () => {
    const source = createMediaItem('video', 1),
      target = createMediaItem('image', 2);
    source.render.media.zoom = 2;
    source.render.media.pan.x = 0.2;
    target.render.media.source = 'destino';
    target.render.media.width = 800;
    const copied = copyFraming(source, target);
    expect(copied.render.media).toMatchObject({ type: 'image', source: 'destino', width: 800, zoom: 2, pan: { x: 0.2, y: 0 } });
    expect(target.render.media.zoom).toBe(1);
  });
  it('seleciona intervalos reversos e interpreta textos com vírgulas e quebras CSV', () => {
    expect(rangeSelection(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['b', 'c', 'd']);
    expect(parseHeadlines('"Texto, com vírgula"\r\n"Duas\nlinhas"\n"Aspas ""duplas"""')).toEqual([
      'Texto, com vírgula',
      'Duas\nlinhas',
      'Aspas "duplas"',
    ]);
  });
  it('limita cortes ao tempo real, sem criar duração negativa', () => {
    const item = createMediaItem('video', 1);
    item.probe = {
      path: '',
      width: 1920,
      height: 1080,
      duration: 10,
      fps: 30,
      codec: 'h264',
      pixFmt: 'yuv420p',
      rotation: 0,
      hasAudio: true,
      tags: {},
      sizeBytes: 100,
      isImage: false,
    };
    expect(trimItems([item], 2, 1, 4)[0].trim).toEqual({ in: 2, out: 6 });
    const trim = trimItems([item], 100, 100)[0].trim;
    expect(trim.out).toBeGreaterThan(trim.in);
    expect(trim.out).toBeLessThanOrEqual(10);
  });
});
describe('histórico global limitado', () => {
  it('desfaz/refaz e limpa o futuro após uma nova edição', () => {
    let history = createHistory(0);
    for (let value = 1; value <= 120; value++) history = commitHistory(history, value);
    expect(history.past.length).toBe(100);
    history = undoHistory(history);
    expect(history.present).toBe(119);
    history = redoHistory(history);
    expect(history.present).toBe(120);
    history = commitHistory(undoHistory(history), 999);
    expect(redoHistory(history).present).toBe(999);
  });
});

it('ordena mídias sem perder identidades nem mutar a ordem original', () => {
  const a = createMediaItem('image', 1),
    b = createMediaItem('image', 2);
  a.title = 'post10';
  b.title = 'post2';
  const original = [a, b];
  const ordered = sortMedia(original, 'name');
  expect(ordered.map((item) => item.id)).toEqual([b.id, a.id]);
  expect(ordered.map((item) => item.slot)).toEqual([1, 2]);
  expect(original[0].id).toBe(a.id);
});
