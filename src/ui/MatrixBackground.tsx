import { useEffect, useRef } from 'react';
export function MatrixBackground({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !enabled) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      previous = 0,
      drops: number[] = [];
    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      drops = Array.from({ length: Math.ceil(canvas.width / 22) }, () => Math.random() * -30);
    };
    const draw = (now: number) => {
      if (document.hidden || reduced.matches) return;
      if (now - previous >= 85) {
        previous = now;
        context.fillStyle = 'rgba(10, 15, 14, .10)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#70c9a3';
        context.font = '14px monospace';
        drops.forEach((y, x) => {
          context.fillText('01アイウエオカキクケコ'[Math.floor(Math.random() * 12)], x * 22, y * 22);
          drops[x] = y * 22 > canvas.height && Math.random() > 0.985 ? 0 : y + 0.35;
        });
      }
      frame = requestAnimationFrame(draw);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !reduced.matches) frame = requestAnimationFrame(draw);
      else context.clearRect(0, 0, canvas.width, canvas.height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    restart();
    document.addEventListener('visibilitychange', restart);
    reduced.addEventListener('change', restart);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', restart);
      reduced.removeEventListener('change', restart);
    };
  }, [enabled]);
  return enabled ? <canvas ref={ref} className="matrix-background" aria-hidden="true" /> : null;
}
