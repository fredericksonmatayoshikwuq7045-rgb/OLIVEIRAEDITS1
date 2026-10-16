import { join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { encode, probe } from './process.mjs';

const shapes = [
  [180, 320],
  [320, 180],
  [240, 240],
  [240, 300],
];

function png(path, width, height, draw) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const color = draw(x, y);
      for (let channel = 0; channel < 4; channel++) {
        rgba[(y * width + x) * 4 + channel] = color[channel];
      }
    }
  encode(
    [
      '-f',
      'rawvideo',
      '-pixel_format',
      'rgba',
      '-video_size',
      `${width}x${height}`,
      '-i',
      'pipe:0',
      '-frames:v',
      '1',
      '-threads',
      '1',
      path,
    ],
    rgba,
  );
}

function overlay(path, width, height) {
  // An actual transparent graphic and bitmap text, independent of browser fonts.
  const letters = ['01110100011000110001100011000101110', '11111100001000011110100001000011111'];
  png(path, width, height, (x, y) => {
    if (x >= 8 && x < 40 && y >= 8 && y < 28) return [255, 0, 0, 255];
    const tx = Math.floor((x - 48) / 3),
      ty = Math.floor((y - 8) / 3);
    if (tx >= 0 && tx < 12 && ty >= 0 && ty < 7 && tx % 6 < 5 && letters[Math.floor(tx / 6)][ty * 5 + (tx % 6)] === '1')
      return [255, 255, 255, 255];
    return [0, 0, 0, 0];
  });
}

function addExif(jpeg) {
  const make = Buffer.from('FixtureCamera\0');
  const date = Buffer.from('2020:01:01 00:00:00\0');
  const tiff = Buffer.alloc(38 + make.length + date.length);
  tiff.write('II');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(2, 8);
  for (const [index, tag, data, offset] of [
    [0, 0x010f, make, 38],
    [1, 0x0132, date, 38 + make.length],
  ]) {
    const entry = 10 + index * 12;
    tiff.writeUInt16LE(tag, entry);
    tiff.writeUInt16LE(2, entry + 2);
    tiff.writeUInt32LE(data.length, entry + 4);
    tiff.writeUInt32LE(offset, entry + 8);
    data.copy(tiff, offset);
  }
  const exif = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
  const header = Buffer.from([0xff, 0xe1, 0, 0]);
  header.writeUInt16BE(exif.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), header, exif, jpeg.subarray(2)]);
}

export function createFixtures(directory) {
  mkdirSync(directory, { recursive: true });
  const fixtures = [];
  for (let index = 0; index < 20; index++) {
    const [width, height] = shapes[index % shapes.length];
    const sourcePath = join(directory, `source-${String(index).padStart(2, '0')}.mp4`);
    const hasAudio = index % 3 !== 0;
    const tenBit = index % 5 === 4;
    const tagged = index % 4 === 0;
    const rotation = index === 6 || index === 13 ? 90 : 0;
    const duration = index === 19 ? 20 : 3.5;
    const args = ['-f', 'lavfi', '-i', `testsrc2=size=${width}x${height}:rate=12`];
    if (hasAudio) args.push('-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100');
    args.push(
      '-t',
      String(duration),
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      tenBit ? 'yuv420p10le' : 'yuv420p',
      '-threads',
      '2',
    );
    if (hasAudio) args.push('-c:a', 'aac');
    if (tagged)
      args.push(
        '-movflags',
        'use_metadata_tags',
        '-metadata',
        'creation_time=2020-01-01T00:00:00Z',
        '-metadata',
        'location=+37.7749-122.4194/',
        '-metadata',
        'com.apple.quicktime.make=FixtureCamera',
        '-metadata',
        'com.apple.quicktime.location.ISO6709=+37.7749-122.4194/',
      );
    args.push(sourcePath);
    encode(args);
    if (rotation) {
      const rotated = join(directory, `rotated-${index}.mp4`);
      encode(['-display_rotation', String(rotation), '-i', sourcePath, '-c', 'copy', rotated]);
      fixtures.push({ index, sourcePath: rotated, width: height, height: width, hasAudio, tenBit, tagged, rotation, duration });
    } else fixtures.push({ index, sourcePath, width, height, hasAudio, tenBit, tagged, rotation, duration });
    const source = probe(fixtures.at(-1).sourcePath);
    if (rotation && !source.streams.some((stream) => stream.side_data_list?.some((data) => Math.abs(data.rotation) === rotation))) {
      throw new Error(`Fixture ${index} não contém rotação real nos dados de exibição.`);
    }
    if (tenBit && !source.streams.some((stream) => stream.pix_fmt?.includes('10'))) {
      throw new Error(`Fixture ${index} não contém vídeo de 10 bits.`);
    }
    if (tagged && !Object.keys(source.format.tags || {}).some((key) => /location/i.test(key))) {
      throw new Error(`Fixture ${index} não contém o GPS de teste.`);
    }
  }
  const assets = { backgrounds: {}, overlays: {} };
  for (const [width, height] of shapes) {
    const key = `${width}x${height}`;
    const graphic = join(directory, `overlay-${key}.png`);
    overlay(graphic, width, height);
    assets.overlays[key] = graphic;
  }
  const background = join(directory, 'background.png');
  png(background, 320, 320, (x, y) => ((Math.floor(x / 40) + Math.floor(y / 40)) % 2 ? [30, 80, 210, 255] : [20, 180, 80, 255]));
  assets.backgrounds.image = background;
  const taggedImage = join(directory, 'camera-exif.jpg');
  encode(['-i', background, '-frames:v', '1', '-q:v', '2', taggedImage]);
  writeFileSync(taggedImage, addExif(readFileSync(taggedImage)));
  const videoBackground = join(directory, 'background.mp4');
  encode([
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=320x320:rate=12',
    '-t',
    '0.5',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-threads',
    '2',
    videoBackground,
  ]);
  assets.backgrounds.video = videoBackground;
  const corrupted = join(directory, 'corrupt.mp4');
  writeFileSync(corrupted, 'Este arquivo não é um vídeo.');
  const manifest = { fixtures, assets, corrupted, taggedImage };
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

export { shapes };
