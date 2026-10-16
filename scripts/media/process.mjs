import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
export const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.error || result.status !== 0) {
    const detail = result.stderr?.toString().slice(-8000) || '';
    throw new Error(`${command} falhou (${result.status}): ${result.error || detail}`);
  }
  return result.stdout;
}

export function encode(args, input) {
  return run(ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-filter_threads', '1', ...args], { input });
}

export function probe(path) {
  return JSON.parse(run(ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-print_format', 'json', path]).toString());
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function pixel(path, x, y, seconds = 0.3) {
  return encode([
    '-ss',
    String(seconds),
    '-i',
    path,
    '-vf',
    `crop=2:2:${Math.floor(x / 2) * 2}:${Math.floor(y / 2) * 2},format=rgb24`,
    '-frames:v',
    '1',
    '-f',
    'rawvideo',
    'pipe:1',
  ]);
}
