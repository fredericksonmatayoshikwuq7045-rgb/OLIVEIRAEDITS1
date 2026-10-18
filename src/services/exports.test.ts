import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMediaItem, createProfile } from '../domain/defaults';
import { canvasBlob, compileStaticPlanes, composeCanvas } from '../render/compositor';
import { nativeCall } from './backend';
import { exportItems, prepareExportItem } from './exports';
import { applyTemplate } from '../domain/templates';
import type { AccountTemplate } from '../domain/models';
import { getImageExportReport, recordImageExport, resetImageExportReport } from './imageReport';
import { getFfmpegInfo, startExport } from './queue';

vi.mock('./backend', () => ({ isNative: () => true, mediaUrl: (path: string) => path, nativeCall: vi.fn() }));
vi.mock('./queue', () => ({ getFfmpegInfo: vi.fn(), startExport: vi.fn() }));
vi.mock('../render/compositor', () => ({ canvasBlob: vi.fn(), compileStaticPlanes: vi.fn(), composeCanvas: vi.fn() }));

function fixture() {
  const profile = createProfile('Conta');
  profile.exportSettings.outputDir = 'C:\\Exports';
  const image = createMediaItem('image', 1);
  const video = createMediaItem('video', 2);
  for (const item of [image, video]) {
    item.status = 'ready';
    item.sourcePath = `C:\\Inputs\\${item.id}`;
  }
  video.trim.out = 1;
  return { profile, image, video };
}

beforeEach(() => {
  vi.resetAllMocks();
  resetImageExportReport();
  vi.mocked(getFfmpegInfo).mockResolvedValue({
    available: true,
    ffmpegPath: 'ffmpeg',
    ffprobePath: 'ffprobe',
    version: 'test',
    encoders: ['libx264'],
    exiftoolAvailable: false,
    warnings: [],
  });
  vi.mocked(startExport).mockResolvedValue('new-job');
  vi.mocked(compileStaticPlanes).mockResolvedValue([]);
  vi.mocked(composeCanvas).mockResolvedValue({} as HTMLCanvasElement);
  vi.mocked(canvasBlob).mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
  vi.mocked(nativeCall).mockResolvedValue({ path: 'C:\\Exports\\image.png', status: 'ok' });
});

describe('ação após exportar lote misto', () => {
  it.each(['shutdown', 'hibernate'] as const)('bloqueia %s quando uma imagem falha, mantendo o vídeo na fila', async (finishAction) => {
    const { profile, image, video } = fixture();
    vi.mocked(composeCanvas).mockRejectedValueOnce(new Error('Imagem corrompida'));
    expect(await exportItems(profile, [image, video], { finishAction })).toBe('new-job');
    expect(startExport).toHaveBeenCalledWith(
      expect.objectContaining({ finishAction: 'none', items: [expect.objectContaining({ id: video.id })] }),
    );
    expect(getImageExportReport()).toEqual([expect.objectContaining({ id: image.id, status: 'error', error: 'Error: Imagem corrompida' })]);
  });

  it('mantém a ação confirmada quando a imagem é gravada com sucesso', async () => {
    const { profile, image, video } = fixture();
    await exportItems(profile, [image, video], { finishAction: 'shutdown' });
    expect(startExport).toHaveBeenCalledWith(expect.objectContaining({ finishAction: 'shutdown' }));
    expect(getImageExportReport()[0]).toMatchObject({ id: image.id, status: 'ok' });
  });

  it('também bloqueia a ação se a gravação da imagem falha após a renderização', async () => {
    const { profile, image, video } = fixture();
    vi.mocked(nativeCall).mockRejectedValueOnce(new Error('Sem espaço'));
    await exportItems(profile, [image, video], { finishAction: 'hibernate' });
    expect(startExport).toHaveBeenCalledWith(expect.objectContaining({ finishAction: 'none' }));
    expect(getImageExportReport()[0]).toMatchObject({ status: 'error', error: 'Error: Sem espaço' });
  });

  it('descarta o relatório anterior mesmo se o próximo lote falha antes de exportar imagens', async () => {
    const { profile, video } = fixture();
    recordImageExport({ id: 'old', title: 'Antiga', filename: 'old.png', status: 'ok' });
    vi.mocked(getFfmpegInfo).mockRejectedValueOnce(new Error('FFmpeg indisponível'));
    await expect(exportItems(profile, [video])).rejects.toThrow('FFmpeg indisponível');
    expect(getImageExportReport()).toEqual([]);
    expect(startExport).not.toHaveBeenCalled();
  });
});

describe('exportar template recém-importado', () => {
  it('resolve a URL temporária pelo template mesmo antes de hidratar os assets novamente', async () => {
    const { profile, video } = fixture();
    const source = 'C:\\Owned\\stamp.mp4',
      runtimeUrl = 'http://127.0.0.1:1234/session-token';
    profile.assets.push({ id: 'stamp', source, name: 'stamp.mp4', relativePath: 'assets/stamp.mp4', kind: 'video', mimeType: 'video/mp4' });
    const template: AccountTemplate = {
      id: 'template-stamp',
      groupId: 'video',
      name: 'stamp',
      type: 'video',
      category: 'watermark',
      mediaType: 'video',
      source: 'asset:stamp',
      runtimeUrl,
      assetId: 'stamp',
      sourceWidth: 64,
      sourceHeight: 64,
      sourceDuration: 3,
      placement: { x: 0.65, y: 0.05, width: 0.28, rotation: 0, opacity: 1, zIndex: 20 },
    };
    profile.templates.push(template);
    const item = applyTemplate(applyTemplate(video, template, 'watermark'), template, 'background');
    item.render.layers[0].enable = { start: 0.2, end: 0.8 };
    const prepared = await prepareExportItem(item, profile);
    expect(prepared.render?.layers[0]).toMatchObject({ source, enable: { start: 0.2, end: 0.8 } });
    expect(prepared.render?.background).toMatchObject({ source, type: 'video' });
    expect(profile.assets[0].runtimeUrl).toBeUndefined();
  });
});
