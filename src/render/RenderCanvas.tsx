import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { assetRequests, disposeAssets, loadAssets, type RenderAssets, type SourceResolver } from './assets';
import { drawFrame } from './compositor';
import { activeAt, bindingTime, videoBindings } from './playback';
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
/** Each video occurrence owns a decoder, so reusing a template does not share its playhead. */
export function RenderCanvas(props: RenderCanvasProps) {
  const { spec, playing = false, time = 0, muted = false, playbackRate = 1, timeOrigin = 0, className, style } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null),
    propsRef = useRef(props),
    blocked = useRef(new Set<HTMLVideoElement>());
  propsRef.current = props;
  const [assets, setAssets] = useState<RenderAssets | null>(null);
  const clock = useRef({ now: 0, time: 0, reported: 0 });
  const pausedSpec = playing ? null : spec,
    pausedTime = playing ? null : time;
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
    blocked.current.clear();
  }, [playing, assets]);
  useEffect(() => {
    if (!assets) return;
    const outputTime = Math.max(0, time - timeOrigin) / playbackRate;
    if (playing && spec.media.type === 'image' && Math.abs(time - clock.current.reported) > 0.00001)
      clock.current = { now: performance.now(), time, reported: time };
    for (const binding of videoBindings(spec)) {
      const asset = assets.get(binding.key);
      if (!(asset instanceof HTMLVideoElement)) continue;
      const target = binding.main ? Math.min(time, Math.max(0, asset.duration - 0.001)) : bindingTime(binding, outputTime, asset.duration);
      if (asset.loop !== binding.loop) asset.loop = binding.loop;
      const rate = binding.main ? Math.max(0.25, Math.min(4, playbackRate)) : 1;
      if (asset.playbackRate !== rate) asset.playbackRate = rate;
      const shouldMute = muted || (!binding.main && !binding.audio) || !activeAt(binding, outputTime);
      if (asset.muted !== shouldMute) asset.muted = shouldMute;
      if (!playing && !asset.paused) asset.pause();
      if (Math.abs(asset.currentTime - target) > (playing ? 0.35 : 0.001)) asset.currentTime = Math.max(0, target);
    }
  }, [assets, spec, time, playing, muted, playbackRate, timeOrigin]);
  useEffect(() => {
    if (!assets) return;
    let cancelled = false,
      frame = 0,
      lastUpdate = performance.now();
    const snapshot = propsRef.current;
    clock.current = { now: performance.now(), time: snapshot.time ?? 0, reported: snapshot.time ?? 0 };
    const main = assets.get(snapshot.spec.media.source);
    const ended = () => propsRef.current.onEnded?.();
    if (main instanceof HTMLVideoElement) main.addEventListener('ended', ended);
    const render = (now = performance.now()) => {
      if (cancelled) return;
      const current = propsRef.current;
      const rate = current.playbackRate ?? 1;
      const currentTime =
        main instanceof HTMLVideoElement
          ? main.currentTime
          : playing
            ? clock.current.time + (now - clock.current.now) / 1000
            : (current.time ?? 0);
      const outputTime = Math.max(0, currentTime - (current.timeOrigin ?? 0)) / rate;
      for (const binding of videoBindings(current.spec)) {
        const asset = assets.get(binding.key);
        if (!(asset instanceof HTMLVideoElement)) continue;
        const active = activeAt(binding, outputTime);
        const shouldMute = !!current.muted || (!binding.main && !binding.audio) || !active;
        if (asset.muted !== shouldMute) asset.muted = shouldMute;
        if (!playing || !active) {
          if (!asset.paused) asset.pause();
          continue;
        }
        const target = binding.main ? currentTime : bindingTime(binding, outputTime, asset.duration);
        if (!binding.main && Math.abs(asset.currentTime - target) > 0.15) asset.currentTime = target;
        const atEnd = !binding.loop && asset.currentTime >= asset.duration - 0.02;
        if (asset.paused && !atEnd && !blocked.current.has(asset)) {
          void asset.play().catch((error: unknown) => {
            blocked.current.add(asset);
            current.onError?.(messageOf(error));
          });
        }
      }
      const context = canvasRef.current?.getContext('2d');
      if (context) {
        try {
          drawFrame(context, current.spec, assets, outputTime);
        } catch (error: unknown) {
          current.onError?.(messageOf(error));
          return;
        }
      }
      if (playing && now - lastUpdate >= 100) {
        clock.current.reported = currentTime;
        current.onTimeUpdate?.(currentTime);
        lastUpdate = now;
      }
      if (playing) frame = requestAnimationFrame(render);
    };
    const redraw = () => {
      if (!playing) render();
    };
    for (const asset of assets.values()) if (asset instanceof HTMLVideoElement) asset.addEventListener('seeked', redraw);
    void prepareFonts(snapshot.spec)
      .then(() => render())
      .catch((error: unknown) => propsRef.current.onError?.(messageOf(error)));
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (main instanceof HTMLVideoElement) main.removeEventListener('ended', ended);
      for (const asset of assets.values())
        if (asset instanceof HTMLVideoElement) {
          asset.removeEventListener('seeked', redraw);
        }
    };
  }, [assets, playing, pausedSpec, pausedTime]);
  useEffect(() => {
    if (playing) void prepareFonts(spec).catch((error: unknown) => propsRef.current.onError?.(messageOf(error)));
  }, [spec, playing]);
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
