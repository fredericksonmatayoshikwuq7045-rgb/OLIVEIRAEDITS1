import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pixel, probe } from './process.mjs';

export function mp4Atoms(path) {
  const bytes = readFileSync(path);
  const atoms = [];
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    const size32 = bytes.readUInt32BE(offset);
    const name = bytes.toString('ascii', offset + 4, offset + 8);
    const size = size32 === 1 ? Number(bytes.readBigUInt64BE(offset + 8)) : size32 || bytes.length - offset;
    assert(size >= 8 && offset + size <= bytes.length, `Átomo MP4 inválido: ${name}`);
    atoms.push({ name, offset, size });
    offset += size;
  }
  return atoms;
}

export function sensitiveTags(media) {
  const entries = Object.entries(media.format?.tags || {});
  for (const [index, stream] of (media.streams || []).entries()) {
    entries.push(...Object.entries(stream.tags || {}).map(([key, value]) => [`stream${index}.${key}`, value]));
  }
  return entries.filter(([key, value]) => value && /gps|location|device|make|model|creation_time|com\.apple/i.test(key));
}

export function verifyOutput(item, fixture, state) {
  assert.equal(state.status, 'ok', `${item.id}: ${state.error || state.status}`);
  assert(statSync(state.outputPath).size > 1000, `${item.id}: arquivo vazio`);
  const media = probe(state.outputPath);
  const video = media.streams.find((stream) => stream.codec_type === 'video');
  const audio = media.streams.find((stream) => stream.codec_type === 'audio');
  assert(video, `${item.id}: vídeo ausente`);
  assert.equal(video.width, item.render.canvas.width, `${item.id}: largura`);
  assert.equal(video.height, item.render.canvas.height, `${item.id}: altura`);
  assert.equal(video.pix_fmt, 'yuv420p', `${item.id}: formato de pixel`);
  assert.equal(video.codec_name, 'h264', `${item.id}: codec`);
  for (const key of ['color_space', 'color_primaries', 'color_transfer']) {
    assert.equal(video[key], 'bt709', `${item.id}: ${key}`);
  }
  const expectedDuration = item.trim.duration / item.speed;
  const actualDuration = Number(media.format.duration);
  assert(Math.abs(actualDuration - expectedDuration) < 0.2, `${item.id}: duração ${actualDuration}, esperada ${expectedDuration}`);
  assert.equal(Boolean(audio), fixture.hasAudio || item.silentAudio, `${item.id}: presença de áudio`);
  if (audio) {
    assert.equal(audio.codec_name, 'aac', `${item.id}: codec de áudio`);
    assert.equal(Number(audio.sample_rate), 48000, `${item.id}: frequência de áudio`);
  }
  assert.deepEqual(sensitiveTags(media), [], `${item.id}: metadados sensíveis remanescentes`);
  const atoms = mp4Atoms(state.outputPath);
  const moov = atoms.find((atom) => atom.name === 'moov');
  const mdat = atoms.find((atom) => atom.name === 'mdat');
  assert(moov && mdat && moov.offset < mdat.offset, `${item.id}: faststart ausente`);
  const [red, green, blue] = pixel(state.outputPath, 16, 16);
  assert(red > 175 && green < 85 && blue < 85, `${item.id}: overlay não foi composto: rgb(${red},${green},${blue})`);
  const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
  assert.notEqual(digest(item.sourcePath), digest(state.outputPath), `${item.id}: saída igual ao original`);
  assert.equal(state.progress.percent, 100, `${item.id}: progresso final`);
  assert.equal(Number(state.outputSize), statSync(state.outputPath).size, `${item.id}: tamanho real no relatório`);
  return {
    id: item.id,
    status: state.status,
    width: video.width,
    height: video.height,
    pixFmt: video.pix_fmt,
    duration: actualDuration,
    audio: Boolean(audio),
    faststart: true,
    sensitiveTags: [],
    overlayVerified: true,
    outputSize: Number(state.outputSize),
  };
}

export function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

export function verifyNoParts(directory) {
  assert.deepEqual(
    filesUnder(directory).filter((path) => /\.part(?:\.|$)|temp_(?:video|overlay|bg)/.test(path)),
    [],
    'Arquivos temporários ou .part ficaram na pasta de saída',
  );
}
