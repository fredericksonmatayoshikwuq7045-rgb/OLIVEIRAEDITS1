import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeGeometry } from '../src/render/geometry.ts';
import { createFixtures, shapes } from './media/fixtures.mjs';
import { encode, ffmpeg, ffprobe, probe, readJson, run } from './media/process.mjs';
import { filesUnder, sensitiveTags, verifyNoParts, verifyOutput } from './media/verify.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = process.env.OE_MEDIA_TEST_DIR || mkdtempSync(join(tmpdir(), 'oliveira-media-'));
const inputDir = join(directory, 'input');
const outputDir = join(directory, 'output');
mkdirSync(outputDir, { recursive: true });
const results = { directory, startedAt: new Date().toISOString(), checks: [], pending: [] };
const record = (name, detail) => {
  results.checks.push({ name, detail });
  console.log(`✓ ${name}`);
};

function harness(request, name, allowError = false) {
  request.cacheDir = join(directory, 'engine');
  const path = join(directory, `${name}.json`);
  writeFileSync(path, JSON.stringify(request, null, 2));
  const executable =
    process.env.OLIVEIRA_ENGINE_HARNESS ||
    join(root, 'src-tauri', 'target', 'debug', 'examples', `engine_harness${process.platform === 'win32' ? '.exe' : ''}`);
  const result = spawnSync(executable, [path], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, OE_TEST_DATA_DIR: join(directory, 'engine') },
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  writeFileSync(join(directory, `${name}.log`), result.stderr || '');
  assert(allowError || result.status === 0, `Harness ${name}: ${result.stderr}`);
  const text = result.stdout.trim();
  const value = text ? JSON.parse(text) : { error: result.stderr };
  if (value.cacheDir) {
    const temporary = join(value.cacheDir, 'tmp');
    assert(!existsSync(temporary) || filesUnder(temporary).length === 0, `Temporários de cache não foram limpos depois de ${name}`);
  }
  writeFileSync(join(directory, `${name}-result.json`), JSON.stringify(value, null, 2));
  return { value, exitCode: result.status };
}

function makeItem(fixture, assets) {
  const [width, height] = shapes[(fixture.index + 1) % shapes.length];
  const spec = {
    version: 1,
    canvas: { width, height },
    background: { type: 'solid', color: '#111111' },
    media: {
      source: fixture.sourcePath,
      width: fixture.width,
      height: fixture.height,
      fit: ['contain', 'cover', 'stretch', 'original', 'blur'][fixture.index % 5],
      crop: { x: 0, y: 0, width: 1, height: 1 },
      zoom: 1,
      pan: { x: 0, y: 0 },
      rotation: fixture.index === 7 ? 90 : fixture.index === 17 ? 37 : 0,
      flipH: fixture.index % 4 === 1,
      flipV: fixture.index === 11,
      mask: fixture.index === 8 ? 'circle' : 'none',
      opacity: 1,
      zIndex: 10,
    },
    layers: [],
  };
  if (fixture.index === 3) spec.media.crop = { x: 0.1, y: 0.15, width: 0.7, height: 0.7 };
  if (fixture.index === 12) {
    spec.media.zoom = 1.3;
    spec.media.pan = { x: 0.1, y: -0.1 };
  }
  if (fixture.index % 5 === 4) spec.background = { type: 'blur', radius: 0.025 };
  if (fixture.index === 5 || fixture.index === 16) {
    const type = fixture.index === 5 ? 'image' : 'video';
    spec.background = { type, source: assets.backgrounds[type], width: 320, height: 320, opacity: 1, loop: true, audio: 'mute' };
    spec.media.fit = 'contain';
  }
  if (fixture.index === 10) spec.background = { type: 'gradient', from: '#102040', to: '#d01020', angle: 35 };
  spec.geometry = computeGeometry(spec);
  return {
    id: `fixture-${fixture.index}`,
    sourcePath: fixture.sourcePath,
    outputPath: join(outputDir, `edited-${fixture.index}.mp4`),
    trim: { start: 0.5, duration: fixture.index === 19 ? 8 : 1.5 },
    speed: fixture.index === 1 ? 0.5 : fixture.index === 2 ? 2 : 1,
    render: spec,
    overlays: [{ path: assets.overlays[`${width}x${height}`], zIndex: 90 }],
    preset: fixture.index === 18 ? 'nvenc' : 'fast',
    cleanMetadata: true,
    conflict: 'overwrite',
    mode: 'render',
    silentAudio: fixture.index === 0,
    fps: 24,
  };
}

function expectFailure(item, name, pattern) {
  const { value, exitCode } = harness({ job: { items: [item], concurrency: 1 } }, name, true);
  const state = value.items?.[0];
  const error = value.error || state?.error || '';
  assert(exitCode !== 0 || state?.status === 'error', `${name}: erro foi anunciado como sucesso`);
  assert(pattern.test(error), `${name}: erro sem causa acionável: ${error}`);
  assert(!existsSync(item.outputPath), `${name}: arquivo final de falha foi criado`);
  verifyNoParts(outputDir);
  record(name, error);
}

try {
  console.log(`Artefatos dos testes: ${directory}`);
  record('FFmpeg disponível', run(ffmpeg, ['-version']).toString().split('\n')[0]);
  record('FFprobe disponível', run(ffprobe, ['-version']).toString().split('\n')[0]);
  const manifestPath = join(inputDir, 'manifest.json');
  const cached = existsSync(manifestPath) ? readJson(manifestPath) : null;
  const manifest = cached?.taggedImage ? cached : createFixtures(inputDir);
  assert.equal(manifest.fixtures.length, 20);
  if (!process.env.OLIVEIRA_ENGINE_HARNESS) {
    run(process.env.CARGO || 'cargo', ['build', '--quiet', '--no-default-features', '--example', 'engine_harness'], {
      cwd: join(root, 'src-tauri'),
      timeout: 600_000,
    });
  }
  const items = manifest.fixtures.map((fixture) => makeItem(fixture, manifest.assets));
  const batch = harness({ job: { items, concurrency: 2 } }, 'batch-20').value;
  assert.equal(batch.items.length, 20, 'Fila perdeu itens');
  const outputs = items.map((item, index) =>
    verifyOutput(
      item,
      manifest.fixtures[index],
      batch.items.find((state) => state.id === item.id),
    ),
  );
  record('20 exports editados com overlay, codec, áudio, trim, faststart e metadados verificados', outputs);
  const looped = batch.items.find((state) => state.id === 'fixture-16').outputPath;
  const backgroundFrame = (seconds) =>
    encode(['-ss', String(seconds), '-i', looped, '-vf', 'crop=100:180:0:0,format=rgb24', '-frames:v', '1', '-f', 'rawvideo', 'pipe:1']);
  assert(!backgroundFrame(0.7).equals(backgroundFrame(1.0)), 'Fundo curto congelou em vez de repetir');
  record('Fundo de vídeo curto continua animado após o fim do arquivo de origem', { sourceDuration: 0.5, sampledAt: [0.7, 1.0] });
  verifyNoParts(outputDir);
  record(
    'Pasta de saída sem temporários',
    filesUnder(outputDir).map((path) => path.split(/[\\/]/).at(-1)),
  );

  const tagged = manifest.fixtures.find((fixture) => fixture.tagged);
  const clean = {
    ...items[0],
    id: 'metadata-only',
    sourcePath: tagged.sourcePath,
    outputPath: join(outputDir, 'metadata-only.mp4'),
    render: null,
    overlays: [],
    trim: null,
    silentAudio: false,
    mode: 'metadata',
  };
  const cleaned = harness({ job: { items: [clean], concurrency: 1 } }, 'metadata-only').value.items[0];
  assert.equal(cleaned.status, 'ok', cleaned.error);
  assert(sensitiveTags(probe(tagged.sourcePath)).length > 0, 'Fixture não contém tags sensíveis');
  assert.deepEqual(sensitiveTags(probe(cleaned.outputPath)), []);
  assert(cleaned.metadata?.removed.length > 0, 'Relatório antes/depois não registra remoção');
  record('Modo só limpar com tags reais antes/depois', cleaned.metadata);
  const imageBytes = readFileSync(manifest.taggedImage);
  assert(
    imageBytes.includes(Buffer.from('Exif\0\0')) && imageBytes.includes(Buffer.from('FixtureCamera')),
    'Fixture JPEG não contém EXIF real',
  );
  const imageClean = { ...clean, id: 'image-metadata', sourcePath: manifest.taggedImage, outputPath: join(outputDir, 'image-clean.jpg') };
  const cleanImageState = harness({ job: { items: [imageClean], concurrency: 1 } }, 'image-metadata').value.items[0];
  assert.equal(cleanImageState.status, 'ok', cleanImageState.error);
  const cleanBytes = readFileSync(cleanImageState.outputPath);
  assert(
    !cleanBytes.includes(Buffer.from('Exif\0\0')) && !cleanBytes.includes(Buffer.from('FixtureCamera')),
    'EXIF da câmera permaneceu no JPEG',
  );
  assert.deepEqual(readFileSync(manifest.taggedImage), imageBytes, 'Modo limpar alterou o original sem mover');
  record('Limpeza de EXIF JPEG real preserva original', { originalExif: true, outputExif: false });

  expectFailure(
    { ...items[0], id: 'corrupt', sourcePath: manifest.corrupted, outputPath: join(outputDir, 'corrupt.mp4') },
    'Arquivo corrompido',
    /ffprobe|inválid|invalid|moov|formato|mídia/i,
  );
  expectFailure(
    { ...items[0], id: 'missing', sourcePath: join(inputDir, 'missing.mp4'), outputPath: join(outputDir, 'missing.mp4') },
    'Arquivo ausente',
    /ausente|existe|encontrad|exist|found/i,
  );
  const invalidParent = join(directory, 'not-a-folder');
  writeFileSync(invalidParent, 'arquivo comum');
  expectFailure(
    { ...items[0], id: 'invalid-output', outputPath: join(invalidParent, 'fail.mp4') },
    'Saída sem diretório gravável',
    /pasta|diretório|directory|os error|grav|permiss/i,
  );
  if (process.platform !== 'win32' && process.getuid?.() !== 0) {
    const deniedDir = join(directory, 'denied');
    mkdirSync(deniedDir, { recursive: true });
    chmodSync(deniedDir, 0o500);
    try {
      expectFailure(
        { ...items[0], id: 'permission', outputPath: join(deniedDir, 'fail.mp4') },
        'Pasta realmente sem permissão de escrita',
        /grav|permiss|denied|os error/i,
      );
    } finally {
      chmodSync(deniedDir, 0o700);
    }
  } else results.pending.push('Pasta com escrita negada: exige conta sem privilégios e ACL controlada no Windows.');
  expectFailure(
    {
      ...items[0],
      id: 'odd-size',
      outputPath: join(outputDir, 'odd-size.mp4'),
      render: { ...items[0].render, canvas: { width: 319, height: 181 } },
    },
    'Dimensões ímpares rejeitadas',
    /par|even|dimens|resolu/i,
  );

  const longFixture = manifest.fixtures[19];
  const cancellable = makeItem(longFixture, manifest.assets);
  cancellable.id = 'cancel';
  cancellable.outputPath = join(outputDir, 'cancelled.mp4');
  cancellable.preset = 'high';
  cancellable.trim = { start: 0, duration: 20 };
  cancellable.render.canvas = { width: 1080, height: 1920 };
  cancellable.render.media.fit = 'cover';
  cancellable.render.geometry = computeGeometry(cancellable.render);
  cancellable.overlays = [];
  const cancelled = harness({ job: { items: [cancellable], concurrency: 1 }, cancelAfterMs: 350 }, 'cancel').value;
  assert.equal(cancelled.items[0].status, 'cancelled', 'Cancelamento não interrompeu o item');
  assert(!existsSync(cancellable.outputPath), 'Cancelamento deixou arquivo final');
  verifyNoParts(outputDir);
  record('Cancelamento real remove saída parcial', cancelled.items[0]);

  results.pending.push(
    'Fechamento da janela não é coberto por este harness; execute test:close em Tauri/Linux e valide também no Windows.',
  );
  results.pending.push('Disco cheio: falta um volume de teste limitado montável sem privilégios.');
  results.finishedAt = new Date().toISOString();
  console.log(`Relatório: ${join(directory, 'report.json')}`);
} catch (error) {
  results.failure = error.stack || String(error);
  process.exitCode = 1;
  console.error(results.failure);
} finally {
  writeFileSync(join(directory, 'report.json'), JSON.stringify(results, null, 2));
}
