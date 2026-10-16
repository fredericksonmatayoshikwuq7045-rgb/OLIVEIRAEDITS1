import {
  boolean,
  choices,
  fields,
  identifier,
  invalid,
  kind,
  list,
  number,
  opacity,
  optional,
  positive,
  record,
  rect,
  text,
  type Check,
} from './archiveSchema';

export const media: Check = fields({
  type: kind,
  source: text,
  width: positive,
  height: positive,
  fit: choices('cover', 'contain', 'stretch', 'original', 'blur'),
  crop: rect,
  zoom: positive,
  pan: fields({ x: number, y: number }),
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  mask: choices('none', 'circle'),
  opacity,
  zIndex: number,
});
const background: Check = (value, path) => {
  const source = record(value, path);
  switch (source.type) {
    case 'solid':
      return fields({ color: text })(value, path);
    case 'gradient':
      return fields({ from: text, to: text, angle: number })(value, path);
    case 'blur':
      return fields({ radius: opacity })(value, path);
    case 'image':
    case 'video':
      return fields({ source: text, width: positive, height: positive, opacity, loop: boolean, audio: choices('mute', 'mix') })(
        value,
        path,
      );
    default:
      invalid(`${path}.type`);
  }
};
const layer: Check = (value, path) => {
  fields({
    id: identifier,
    rect,
    rotation: number,
    opacity,
    zIndex: number,
    visible: boolean,
    enable: optional(fields({ start: number, end: number })),
  })(value, path);
  const source = record(value, path);
  if (source.type === 'text') {
    fields({
      text,
      fontFamily: text,
      fontSize: positive,
      bold: boolean,
      italic: boolean,
      align: choices('left', 'center', 'right'),
      color: text,
      lineHeight: positive,
      background: fields({ color: text, opacity, padding: number, radius: number }),
      stroke: fields({ color: text, width: number }),
      shadow: fields({ color: text, blur: number, offsetX: number, offsetY: number }),
    })(value, path);
  } else {
    fields({ type: kind, source: text, fit: choices('cover', 'contain', 'stretch'), sourceWidth: positive, sourceHeight: positive })(
      value,
      path,
    );
  }
};
export const render: Check = fields({
  version: choices(1),
  canvas: fields({ width: positive, height: positive }),
  background,
  media,
  layers: list(layer),
});
