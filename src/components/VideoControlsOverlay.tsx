import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { formatTime } from "../utils";

interface VideoControlsOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  trimIn: number;
  trimOut: number;
}

// Overlay de controles (play central + barra + tempo + mute) por cima do <video>.
// Restringe a reprodução e seek estritamente ao intervalo [trimIn, trimOut].
export const VideoControlsOverlay: React.FC<VideoControlsOverlayProps> = ({ videoRef, trimIn, trimOut }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [current, setCurrent] = useState(trimIn);
  const [showBigPlay, setShowBigPlay] = useState(true);
  const barRef = useRef<HTMLDivElement>(null);
  const seeking = useRef(false);

  const rangeDuration = trimOut - trimIn;

  // Force video position inside trim range when range changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime < trimIn || v.currentTime > trimOut) {
      v.currentTime = trimIn;
      setCurrent(trimIn);
    }
  }, [trimIn, trimOut, videoRef]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    
    const onTime = () => {
      // Loop or restrict playback to [trimIn, trimOut]
      if (v.currentTime < trimIn) {
        v.currentTime = trimIn;
      } else if (v.currentTime > trimOut) {
        v.currentTime = trimIn;
      }
      setCurrent(v.currentTime);
    };

    const onPlay = () => { setIsPlaying(true); setShowBigPlay(false); };
    const onPause = () => { setIsPlaying(false); setShowBigPlay(true); };
    
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.muted = muted;
    
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [videoRef.current, trimIn, trimOut, muted]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const seekToClientX = (clientX: number) => {
    const v = videoRef.current;
    if (!v || !barRef.current || rangeDuration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = trimIn + pct * rangeDuration;
    v.currentTime = targetTime;
    setCurrent(targetTime);
  };

  const onBarPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seeking.current = true;
    seekToClientX(e.clientX);
  };
  const onBarPointerMove = (e: React.PointerEvent) => {
    if (!seeking.current) return;
    seekToClientX(e.clientX);
  };
  const onBarPointerUp = () => { seeking.current = false; };

  const progressPct = rangeDuration > 0 ? (Math.max(0, current - trimIn) / rangeDuration) * 100 : 0;

  return (
    <div className="absolute inset-0 z-50 pointer-events-none">
      {/* Big center play button — toggled visibility, pointer-events only on itself */}
      {showBigPlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-black/60 border border-white/30 flex items-center justify-center backdrop-blur-sm hover:bg-black/75 transition-colors pointer-events-auto cursor-pointer"
          >
            <Play size={22} className="text-white ml-0.5" fill="white" />
          </button>
        </div>
      )}

      {/* Bottom controls bar */}
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 pointer-events-auto" onClick={e => e.stopPropagation()}>
        <div
          ref={barRef}
          onPointerDown={onBarPointerDown}
          onPointerMove={onBarPointerMove}
          onPointerUp={onBarPointerUp}
          className="relative h-3 flex items-center cursor-pointer group mb-1"
          style={{ touchAction: "none" }}
        >
          <div className="absolute w-full h-1 bg-white/25 rounded-full" />
          <div className="absolute h-1 bg-red-500 rounded-full" style={{ width: `${progressPct}%` }} />
          <div
            className="absolute w-2.5 h-2.5 bg-white rounded-full shadow"
            style={{ left: `calc(${progressPct}% - 5px)` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button onClick={togglePlay} className="text-white/90 hover:text-white p-0.5">
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <span className="text-[10px] font-mono text-white/80">
              {formatTime(Math.max(0, current - trimIn))} / {formatTime(rangeDuration)}
            </span>
          </div>
          <button onClick={toggleMute} className="text-white/90 hover:text-white p-0.5">
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
};
