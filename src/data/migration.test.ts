import { describe, expect, it } from 'vitest';
import type { LegacySnapshot } from './migration';
import { captureLegacySnapshot, convertLegacySnapshot, parseLegacySnapshot } from './migration';

const snapshot = (values: Partial<Record<keyof LegacySnapshot['keys'], unknown>>): LegacySnapshot => ({
  capturedAt: '2026-10-16T10:00:00.000Z',
  keys: {
    oe_videos: null,
    oe_images: null,
    oe_templates: null,
    oe_groups: null,
    ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)])),
  },
});
describe('migração não destrutiva v1 → v2', () => {
  it('preserva todos os slots, dados desconhecidos e referências com UUIDs novos', () => {
    const old = snapshot({
      oe_groups: [{ id: 'g1', name: 'Fofoca', type: 'video', extra: 21 }],
      oe_templates: [
        {
          id: 't1',
          groupId: 'g1',
          name: 'Marca',
          type: 'video',
          category: 'watermark',
          dataUrl: 'data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E',
          custom: 'preservar',
        },
      ],
      oe_videos: Array.from({ length: 512 }, (_, index) => ({
        id: index + 1,
        title: `Vídeo ${index}`,
        status: 'ready',
        url: 'blob:morto',
        duration: 7.25,
        trimIn: 1.125,
        trimOut: 6.75,
        aspectRatio: '16:9',
        templates: { watermark: 't1' },
        campoDesconhecido: { importante: true },
      })),
      oe_images: [{ id: 1, title: 'Imagem', url: 'blob:imagem', scale: 1.5, cropMask: 'circle' }],
    });
    const before = JSON.stringify(old),
      result = convertLegacySnapshot(old);
    const profile = result.profiles[0],
      items = result.projects[0].items;
    expect(items.length).toBe(513);
    expect(profile.templates[0].groupId).toBe(profile.groups[0].id);
    expect(items[0].templates.watermark).toBe(profile.templates[0].id);
    expect(items[0].trim).toEqual({ in: 1.125, out: 6.75 });
    expect(items[0].status).toBe('missing');
    expect(items[0].legacyPayload).toMatchObject({ campoDesconhecido: { importante: true } });
    expect(profile.templates[0].legacyPayload).toMatchObject({ custom: 'preservar' });
    expect(new Set(items.map((item) => item.id)).size).toBe(513);
    expect(JSON.stringify(old)).toBe(before);
    expect(result.migration?.complete).toBe(false);
  });
  it('preserva IDs antigos duplicados em registros separados e registra ambiguidade', () => {
    const result = convertLegacySnapshot(
      snapshot({
        oe_templates: [
          { id: 'igual', dataUrl: 'data:image/png;base64,AA==' },
          { id: 'igual', dataUrl: 'data:image/png;base64,AA==' },
        ],
        oe_images: [{ id: 1 }, { id: 1 }],
      }),
    );
    expect(result.profiles[0].templates).toHaveLength(2);
    expect(result.projects[0].items).toHaveLength(2);
    expect(result.migration?.warnings.join(' ')).toContain('duplicado');
  });
  it('interrompe JSON inválido em vez de inicializar defaults por cima dos dados', () => {
    const source = snapshot({});
    source.keys.oe_images = '{quebrado';
    expect(() => parseLegacySnapshot(source)).toThrow('oe_images');
    expect(source.keys.oe_images).toBe('{quebrado');
    const nonArray = snapshot({ oe_videos: { id: 1 } });
    expect(() => convertLegacySnapshot(nonArray)).toThrow('lista');
  });
  it('captura strings exatas sem remover nem gravar chaves do storage antigo', () => {
    const source = ' [ { "id" : 7 } ] ';
    const calls: string[] = [];
    const captured = captureLegacySnapshot({
      getItem: (key) => {
        calls.push(key);
        return key === 'oe_images' ? source : null;
      },
    });
    expect(captured.keys.oe_images).toBe(source);
    expect(calls).toEqual(['oe_videos', 'oe_images', 'oe_templates', 'oe_groups']);
  });
});
