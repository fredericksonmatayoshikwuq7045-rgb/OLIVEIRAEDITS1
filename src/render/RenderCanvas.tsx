import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { assetRequests, disposeAssets, loadAssets, type RenderAssets, type SourceResolver } from './assets';
import { drawFrame } from './compositor';
import { prepareFonts } from './text';
import type { RenderSpec } from './types';

export interface RenderCanvasProps {
  spec: RenderSpec;
  playing?: boolean;
  time?: number;
  muted?: boolean;
  playbackRate?: number;
  timeOrigin?: number;
  className?: string;
  style?: CSSProperties;
  resolveSource?: SourceResolver;
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
  onError?: (message: string) => void;
  onReady?: (info: { duration: number; width: number; height: number }) => void;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Canvas always keeps output resolution; CSS only changes its displayed size. */
export function RenderCanvas(props: RenderCanvasProps) {
  const { spec, playing = false, time = 0, muted = false, playbackRate = 1, timeOrigin = 0, className, style } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [assets, setAssets] = useState<RenderAssets | null>(null);
  const sourceKey = JSON.stringify(
    assetRequests(spec).map((request) => ({ ...request, resolved: props.resolveSource?.(request.source) ?? request.source })),
  );

  useEffect(() => {
    let cancelled = false;
    let owned: RenderAssets | null = null;
    setAssets(null);
    void loadAssets(propsRef.current.spec, propsRef.current.resolveSource)
      .then((loaded) => {
        owned = loaded;
        if (cancelled) {
          disposeAssets(loaded);
          return;
        }
        setAssets(loaded);
        const main = loaded.get(propsRef.current.spec.media.source);
        const info =
          main instanceof HTMLVideoElement
            ? { duration: Number.isFinite(main.duration) ? main.duration : 0, width: main.videoWidth, height: main.videoHeight }
            : main instanceof HTMLImageElement
              ? { duration: 0, width: main.naturalWidth, height: main.naturalHeight }
              : null;
        if (info) propsRef.current.onReady?.(info);
      })
      .catch((error: unknown) => {
        if (!cancelled) propsRef.current.onError?.(messageOf(error));
      });
    return () => {
      cancelled = true;
      if (owned) disposeAssets(owned);
    };
  }, [sourceKey]);

  useEffect(() => {
    if (!assets) return;
    const main = assets.get(spec.media.source);
    const ended = () => propsRef.current.onEnded?.();
    if (main instanceof HTMLVideoElement) main.addEventListener('ended', ended);
    for (const [source, asset] of assets) {
      if (!(asset instanceof HTMLVideoElement)) continue;
      asset.loop = source !== spec.media.source;
      asset.playbackRate = source === spec.media.source ? Math.max(0.25, Math.min(4, playbackRate)) : 1;
      const backgroundMix = spec.background.type === 'video' && spec.background.source === source && spec.background.audio === 'mix';
      asset.muted = muted || (source !== spec.media.source && !backgroundMix);
      if (playing) {
        void asset.play().catch((error: unknown) => propsRef.current.onError?.(messageOf(error)));
      } else asset.pause();
    }
    return () => {
      if (main instanceof HTMLVideoElement) main.removeEventListener('ended', ended);
    };
  }, [assets, playing, muted, playbackRate, spec.media.source, spec.background]);

  useEffect(() => {
    if (!assets) return;
    for (const [source, asset] of assets) {
      if (!(asset instanceof HTMLVideoElement)) continue;
      const outputTime = Math.max(0, time - timeOrigin) / playbackRate;
      const target =
        source === spec.media.source
          ? Math.min(time, Math.max(0, asset.duration - 0.001))
          : Number.isFinite(asset.duration) && asset.duration > 0
            ? outputTime % asset.duration
            : outputTime;
      if (Math.abs(asset.currentTime - target) > (playing ? 0.35 : 0.001)) asset.currentTime = Math.max(0, target);
    }
  }, [assets, time, playing, playbackRate, timeOrigin, spec.media.source]);

  useEffect(() => {
    if (!assets) return;
    let cancelled = false;
    let frame = 0;
    let lastUpdate = 0;
    const render = (now = 0) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      const current = propsRef.current;
      const main = assets.get(current.spec.media.source);
      const currentTime = main instanceof HTMLVideoElement ? main.currentTime : (current.time ?? 0);
      const outputTime = Math.max(0, currentTime - (current.timeOrigin ?? 0)) / (current.playbackRate ?? 1);
      if (context) {
        try {
          drawFrame(context, current.spec, assets, outputTime);
        } catch (error: unknown) {
          current.onError?.(messageOf(error));
          return;
        }
      }
      if (playing && now - lastUpdate >= 100 && main instanceof HTMLVideoElement) {
        current.onTimeUpdate?.(currentTime);
        lastUpdate = now;
      }
      if (playing) frame = requestAnimationFrame(render);
    };
    const redraw = () => {
      if (!playing) render();
    };
    for (const asset of assets.values()) if (asset instanceof HTMLVideoElement) asset.addEventListener('seeked', redraw);
    void prepareFonts(spec)
      .then(() => render())
      .catch((error: unknown) => propsRef.current.onError?.(messageOf(error)));
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      for (const asset of assets.values()) if (asset instanceof HTMLVideoElement) asset.removeEventListener('seeked', redraw);
    };
  }, [assets, spec, playing]);

  return (
    <canvas
      ref={canvasRef}
      width={spec.canvas.width}
      height={spec.canvas.height}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'contain', ...style }}
      role="img"
      aria-label="Prévia da edição com a mesma composição da exportação"
      aria-busy={!assets}
    />
  );
}
