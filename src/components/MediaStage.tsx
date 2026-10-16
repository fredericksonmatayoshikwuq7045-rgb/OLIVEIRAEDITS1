import React, { useRef, useState, useEffect } from "react";
import { AspectRatioType, CropMaskType, TemplateItem, TemplatePlacement, TemplatePlacements, AppliedTemplates, TextLayer, MediaCrop } from "../types";
import { aspectToWH } from "../utils";

// ── Grade de alinhamento (estilo guia de edição), só aparece durante drag ────
const AlignGrid: React.FC = () => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none z-40" preserveAspectRatio="none">
    <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
    <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="white" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
    <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="white" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
    <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="white" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
    <line x1="50%" y1="0" x2="50%" y2="100%" stroke="white" strokeWidth="1.5" opacity="0.7" />
    <line x1="0" y1="50%" x2="100%" y2="50%" stroke="white" strokeWidth="1.5" opacity="0.7" />
  </svg>
);

// ── Handle de drag/resize para template (watermark ou headline) ─────────────
interface OverlayHandleProps {
  placement: { x: number; y: number; width: number };
  onChange: (p: { x?: number; y?: number; width?: number }) => void;
  onDragStateChange: (dragging: boolean) => void;
  stageRef: React.RefObject<HTMLDivElement>;
  label: string;
}

const OverlayHandle: React.FC<OverlayHandleProps> = ({ placement, onChange, onDragStateChange, stageRef, label }) => {
  const dragRef = useRef<{ mode: "move" | "resize"; startX: number; startY: number; orig: { x: number; y: number; width: number } } | null>(null);

  const onDown = (e: React.PointerEvent, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, orig: { x: placement.x, y: placement.y, width: placement.width } };
    onDragStateChange(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const dxPct = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
    const dyPct = ((e.clientY - dragRef.current.startY) / rect.height) * 100;
    const { mode, orig } = dragRef.current;
    if (mode === "move") {
      onChange({ x: Math.max(0, Math.min(95, orig.x + dxPct)), y: Math.max(0, Math.min(95, orig.y + dyPct)) });
    } else {
      onChange({ width: Math.max(8, Math.min(100, orig.width + dxPct)) });
    }
  };
  const onUp = () => { dragRef.current = null; onDragStateChange(false); };

  return (
    <div
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerDown={e => onDown(e, "move")}
      className="absolute border-2 border-white bg-white/10 cursor-move z-30 group shadow-[0_0_8px_rgba(0,0,0,0.5)] animate-none"
      style={{ inset: 0, minHeight: 24, touchAction: "none" }}
    >
      <span className="absolute -top-5 left-0 text-[9px] font-mono bg-white text-black px-1 rounded border border-[#ccc] shadow whitespace-nowrap">{label}</span>
      <div onPointerDown={e => onDown(e, "resize")}
        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-black rounded-full cursor-nwse-resize opacity-80 group-hover:opacity-100 shadow"
        style={{ touchAction: "none" }} />
    </div>
  );
};

// ── Box de Corte da Mídia (Outline com handles nos cantos) ───────────────────
interface MediaCropBoxProps {
  scale: number;
  cropX: number;
  cropY: number;
  onCropChange: (scale: number, cropX: number, cropY: number) => void;
  stageRef: React.RefObject<HTMLDivElement>;
  aspectRatio: AspectRatioType;
  heightPx: number;
  mediaAspect: number | null;
}

const MediaCropBox: React.FC<MediaCropBoxProps> = ({
  scale,
  cropX,
  cropY,
  onCropChange,
  stageRef,
  aspectRatio,
  heightPx,
  mediaAspect,
}) => {
  const dragRef = useRef<{
    dirX: number;
    dirY: number;
    startX: number;
    startY: number;
    origScale: number;
    origCropX: number;
    origCropY: number;
    rect: DOMRect;
  } | null>(null);

  const { w: aspectW, h: aspectH } = aspectToWH(aspectRatio);

  const onDown = (e: React.PointerEvent, dirX: number, dirY: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!stageRef.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      dirX,
      dirY,
      startX: e.clientX,
      startY: e.clientY,
      origScale: scale,
      origCropX: cropX,
      origCropY: cropY,
      rect: stageRef.current.getBoundingClientRect(),
    };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { dirX, dirY, origScale, origCropX, origCropY, rect } = dragRef.current;
    
    const viewportWidth = rect.width;
    const viewportHeight = rect.height;

    const stageAspect = aspectW / aspectH;
    const currentMediaAspect = mediaAspect || stageAspect;

    let defaultWidthPct = 100;
    let defaultHeightPct = 100;

    if (currentMediaAspect > stageAspect) {
      defaultHeightPct = (stageAspect / currentMediaAspect) * 100;
    } else {
      defaultWidthPct = (currentMediaAspect / stageAspect) * 100;
    }

    const mediaDefaultW = viewportWidth * (defaultWidthPct / 100);
    const mediaDefaultH = viewportHeight * (defaultHeightPct / 100);

    // Center coordinates
    const cx = viewportWidth / 2 + origCropX;
    const cy = viewportHeight / 2 + origCropY;
    const w = mediaDefaultW * origScale;
    const h = mediaDefaultH * origScale;
    
    // Anchor coordinates (opposite corner)
    const anchorX = cx - dirX * (w / 2);
    const anchorY = cy - dirY * (h / 2);

    // Pointer coordinates relative to stage top-left
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Calculate new scale based on diagonal distance
    const diag0 = Math.sqrt(mediaDefaultW * mediaDefaultW + mediaDefaultH * mediaDefaultH);
    const diag = Math.sqrt((px - anchorX) * (px - anchorX) + (py - anchorY) * (py - anchorY));
    
    const newScale = Math.max(0.3, Math.min(4.0, diag / diag0));

    // Calculate new center and crop values
    const newCx = anchorX + dirX * (mediaDefaultW * newScale / 2);
    const newCy = anchorY + dirY * (mediaDefaultH * newScale / 2);
    const newCropX = newCx - viewportWidth / 2;
    const newCropY = newCy - viewportHeight / 2;

    onCropChange(newScale, newCropX, newCropY);
  };

  const onUp = () => {
    dragRef.current = null;
  };

  const rectWidth = stageRef.current ? stageRef.current.getBoundingClientRect().width : (heightPx * (aspectW / aspectH));
  const rectHeight = stageRef.current ? stageRef.current.getBoundingClientRect().height : heightPx;

  const stageAspect = aspectW / aspectH;
  const currentMediaAspect = mediaAspect || stageAspect;

  let defaultLeft = 0;
  let defaultTop = 0;
  let defaultWidth = 100;
  let defaultHeight = 100;

  if (currentMediaAspect > stageAspect) {
    defaultHeight = (stageAspect / currentMediaAspect) * 100;
    defaultTop = (100 - defaultHeight) / 2;
  } else {
    defaultWidth = (currentMediaAspect / stageAspect) * 100;
    defaultLeft = (100 - defaultWidth) / 2;
  }

  const left = defaultLeft + (defaultWidth * (1 - scale) / 2) + (cropX / rectWidth) * 100;
  const top = defaultTop + (defaultHeight * (1 - scale) / 2) + (cropY / rectHeight) * 100;
  const width = defaultWidth * scale;
  const height = defaultHeight * scale;

  return (
    <div
      className="absolute border border-white pointer-events-none z-30 shadow-[0_0_8px_rgba(0,0,0,0.5)]"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
    >
      {/* 3x3 grid lines */}
      <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
        <div className="border-r border-b border-white/20" />
        <div className="border-r border-b border-white/20" />
        <div className="border-b border-white/20" />
        <div className="border-r border-b border-white/20" />
        <div className="border-r border-b border-white/20" />
        <div className="border-b border-white/20" />
        <div className="border-r border-white/20" />
        <div className="border-r border-white/20" />
        <div />
      </div>

      {/* Corner handles (clickable) */}
      {[
        { x: -1, y: -1, cursor: "nwse-resize", style: { left: -6, top: -6 } },
        { x: 1, y: -1, cursor: "nesw-resize", style: { right: -6, top: -6 } },
        { x: -1, y: 1, cursor: "nesw-resize", style: { left: -6, bottom: -6 } },
        { x: 1, y: 1, cursor: "nwse-resize", style: { right: -6, bottom: -6 } },
      ].map((h, i) => (
        <div
          key={i}
          onPointerDown={e => onDown(e, h.x, h.y)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          className="absolute w-3.5 h-3.5 bg-white border border-black rounded-full pointer-events-auto shadow-[0_1px_3px_rgba(0,0,0,0.4)] flex items-center justify-center cursor-pointer"
          style={{
            ...h.style,
            cursor: h.cursor,
            touchAction: "none",
          }}
        >
          <div className="w-1.5 h-1.5 bg-black rounded-full" />
        </div>
      ))}
      <span className="absolute top-1 left-1 text-[8px] font-mono bg-white text-black px-1 rounded shadow border border-[#ccc]">mídia</span>
    </div>
  );
};


interface MediaCropMaskBoxProps {
  mediaCrop: MediaCrop;
  onChange: (crop: MediaCrop) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  cropAspectRatio: "free" | "16:9" | "9:16" | "1:1" | "4:5";
}

const MediaCropMaskBox: React.FC<MediaCropMaskBoxProps> = ({
  mediaCrop,
  onChange,
  containerRef,
  cropAspectRatio,
}) => {
  const dragRef = useRef<{
    handle: "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | "move";
    startX: number;
    startY: number;
    origCrop: MediaCrop;
    rect: DOMRect;
  } | null>(null);

  const onDown = (
    e: React.PointerEvent,
    handle: "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | "move"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = containerRef.current.getBoundingClientRect();
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origCrop: { ...mediaCrop },
      rect,
    };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { handle, startX, startY, origCrop, rect } = dragRef.current;
    
    // Calculate difference in percentages of the container's physical width/height
    const dx = ((e.clientX - startX) / rect.width) * 100;
    const dy = ((e.clientY - startY) / rect.height) * 100;

    let newCrop = { ...origCrop };

    const stageRatio = rect.width / rect.height;
    
    let cropRatio: number | null = null;
    if (cropAspectRatio === "16:9") cropRatio = 16 / 9;
    else if (cropAspectRatio === "9:16") cropRatio = 9 / 16;
    else if (cropAspectRatio === "1:1") cropRatio = 1;
    else if (cropAspectRatio === "4:5") cropRatio = 4 / 5;

    const ratioMultiplier = cropRatio ? cropRatio / stageRatio : 1;

    if (handle === "move") {
      newCrop.x = Math.max(0, Math.min(100 - origCrop.width, origCrop.x + dx));
      newCrop.y = Math.max(0, Math.min(100 - origCrop.height, origCrop.y + dy));
    } else {
      let nextX = origCrop.x;
      let nextY = origCrop.y;
      let nextWidth = origCrop.width;
      let nextHeight = origCrop.height;

      if (handle.includes("w")) {
        const limit = origCrop.x + origCrop.width - 5;
        nextX = Math.max(0, Math.min(limit, origCrop.x + dx));
        nextWidth = origCrop.x + origCrop.width - nextX;
      }
      if (handle.includes("e")) {
        const limit = 100 - origCrop.x;
        nextWidth = Math.max(5, Math.min(limit, origCrop.width + dx));
      }
      if (handle.includes("n")) {
        const limit = origCrop.y + origCrop.height - 5;
        nextY = Math.max(0, Math.min(limit, origCrop.y + dy));
        nextHeight = origCrop.y + origCrop.height - nextY;
      }
      if (handle.includes("s")) {
        const limit = 100 - origCrop.y;
        nextHeight = Math.max(5, Math.min(limit, origCrop.height + dy));
      }

      // Constrain aspect ratio if active
      if (cropRatio) {
        if (handle === "se" || handle === "e") {
          nextHeight = nextWidth / ratioMultiplier;
          if (nextHeight + nextY > 100) {
            nextHeight = 100 - nextY;
            nextWidth = nextHeight * ratioMultiplier;
          }
        } else if (handle === "s") {
          nextWidth = nextHeight * ratioMultiplier;
          if (nextWidth + nextX > 100) {
            nextWidth = 100 - nextX;
            nextHeight = nextWidth / ratioMultiplier;
          }
        } else if (handle === "nw") {
          const aspectDx = dy * ratioMultiplier;
          nextX = Math.max(0, Math.min(origCrop.x + origCrop.width - 5, origCrop.x + aspectDx));
          nextWidth = origCrop.x + origCrop.width - nextX;
          nextHeight = nextWidth / ratioMultiplier;
          nextY = origCrop.y + origCrop.height - nextHeight;
          if (nextY < 0) {
            nextY = 0;
            nextHeight = origCrop.y + origCrop.height;
            nextWidth = nextHeight * ratioMultiplier;
            nextX = origCrop.x + origCrop.width - nextWidth;
          }
        } else if (handle === "ne") {
          const aspectDx = -dy * ratioMultiplier;
          nextWidth = Math.max(5, Math.min(100 - origCrop.x, origCrop.width + aspectDx));
          nextHeight = nextWidth / ratioMultiplier;
          nextY = origCrop.y + origCrop.height - nextHeight;
          if (nextY < 0) {
            nextY = 0;
            nextHeight = origCrop.y + origCrop.height;
            nextWidth = nextHeight * ratioMultiplier;
          }
        } else if (handle === "sw") {
          const aspectDx = -dy * ratioMultiplier;
          nextX = Math.max(0, Math.min(origCrop.x + origCrop.width - 5, origCrop.x - aspectDx));
          nextWidth = origCrop.x + origCrop.width - nextX;
          nextHeight = nextWidth / ratioMultiplier;
          if (nextHeight + nextY > 100) {
            nextHeight = 100 - nextY;
            nextWidth = nextHeight * ratioMultiplier;
            nextX = origCrop.x + origCrop.width - nextWidth;
          }
        }
      }

      newCrop.x = nextX;
      newCrop.y = nextY;
      newCrop.width = nextWidth;
      newCrop.height = nextHeight;
    }

    newCrop.x = Math.max(0, Math.min(95, newCrop.x));
    newCrop.y = Math.max(0, Math.min(95, newCrop.y));
    newCrop.width = Math.max(5, Math.min(100 - newCrop.x, newCrop.width));
    newCrop.height = Math.max(5, Math.min(100 - newCrop.y, newCrop.height));

    onChange(newCrop);
  };

  const onUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerDown={e => onDown(e, "move")}
      className="absolute border-2 border-dashed border-white cursor-move z-35"
      style={{
        left: `${mediaCrop.x}%`,
        top: `${mediaCrop.y}%`,
        width: `${mediaCrop.width}%`,
        height: `${mediaCrop.height}%`,
        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
        touchAction: "none",
      }}
    >
      {/* Corner crop indicators style L ┌ ┐ └ ┘ */}
      {/* nw */}
      <div
        onPointerDown={e => onDown(e, "nw")}
        className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-[3px] border-l-[3px] border-white cursor-nwse-resize z-50 pointer-events-auto"
        style={{ touchAction: "none" }}
      />
      {/* ne */}
      <div
        onPointerDown={e => onDown(e, "ne")}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-[3px] border-r-[3px] border-white cursor-nesw-resize z-50 pointer-events-auto"
        style={{ touchAction: "none" }}
      />
      {/* sw */}
      <div
        onPointerDown={e => onDown(e, "sw")}
        className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-[3px] border-l-[3px] border-white cursor-nesw-resize z-50 pointer-events-auto"
        style={{ touchAction: "none" }}
      />
      {/* se */}
      <div
        onPointerDown={e => onDown(e, "se")}
        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-[3px] border-r-[3px] border-white cursor-nwse-resize z-50 pointer-events-auto"
        style={{ touchAction: "none" }}
      />

      {/* Side middle crop handles */}
      {cropAspectRatio === "free" && (
        <>
          {/* n */}
          <div
            onPointerDown={e => onDown(e, "n")}
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-2 border-t-[3px] border-white cursor-ns-resize z-50 pointer-events-auto"
            style={{ touchAction: "none" }}
          />
          {/* s */}
          <div
            onPointerDown={e => onDown(e, "s")}
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 border-b-[3px] border-white cursor-ns-resize z-50 pointer-events-auto"
            style={{ touchAction: "none" }}
          />
          {/* w */}
          <div
            onPointerDown={e => onDown(e, "w")}
            className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-8 border-l-[3px] border-white cursor-ew-resize z-50 pointer-events-auto"
            style={{ touchAction: "none" }}
          />
          {/* e */}
          <div
            onPointerDown={e => onDown(e, "e")}
            className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-8 border-r-[3px] border-white cursor-ew-resize z-50 pointer-events-auto"
            style={{ touchAction: "none" }}
          />
        </>
      )}

      <span className="absolute top-1 left-1 text-[8px] font-mono bg-white text-black px-1 rounded shadow border border-[#ccc]">cortar</span>
    </div>
  );
};

// ── Main stage component ──────────────────────────────────────────────────────
interface MediaStageProps {
  url: string | null;
  mediaType: "video" | "image";
  scale: number;
  cropX: number;
  cropY: number;
  flipH: boolean;
  aspectRatio: AspectRatioType;
  cropMask: CropMaskType;
  appliedTemplates: AppliedTemplates;
  templatePlacements: TemplatePlacements;
  templates: TemplateItem[];
  headlineTextOverride?: string;
  textLayers?: TextLayer[];
  onPan: (cropX: number, cropY: number) => void;
  onZoom: (scale: number) => void;
  onPlacementChange: (category: "border" | "watermark" | "headline", patch: Partial<TemplatePlacement>) => void;
  onTextLayerPlacementChange?: (id: string, patch: Partial<TextLayer>) => void;
  videoElementProps?: React.VideoHTMLAttributes<HTMLVideoElement> & { ref?: React.Ref<HTMLVideoElement> };
  children?: React.ReactNode; // for custom video element with ref
  heightPx?: number;
  editable?: boolean; // false = export preview / readonly
  activeLayerId?: string | null;
  onSelectLayer?: (layerId: string | null) => void;
  mediaCrop?: MediaCrop;
  cropMode?: boolean;
  cropAspectRatio?: "free" | "16:9" | "9:16" | "1:1" | "4:5";
  onMediaCropChange?: (crop: MediaCrop) => void;
}

export const MediaStage: React.FC<MediaStageProps> = ({
  url, mediaType, scale, cropX, cropY, flipH, aspectRatio, cropMask,
  appliedTemplates, templatePlacements, templates, headlineTextOverride,
  textLayers, onPan, onZoom, onPlacementChange, onTextLayerPlacementChange, children, heightPx = 320, editable = true,
  activeLayerId = null, onSelectLayer,
  mediaCrop, cropMode = false, cropAspectRatio = "free", onMediaCropChange,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const [mediaAspect, setMediaAspect] = useState<number | null>(null);

  useEffect(() => {
    if (!url) {
      setMediaAspect(null);
      return;
    }
    
    const container = mediaContainerRef.current;
    if (!container) return;
    
    let mediaEl = container.querySelector("video, img");
    
    const updateAspect = () => {
      if (!mediaEl) {
        mediaEl = container.querySelector("video, img");
      }
      if (!mediaEl) return;
      
      if (mediaEl instanceof HTMLVideoElement) {
        if (mediaEl.videoWidth && mediaEl.videoHeight) {
          const aspect = mediaEl.videoWidth / mediaEl.videoHeight;
          setMediaAspect(aspect);
          console.log(`[SISTEMA] Aspect ratio do vídeo detectado: ${aspect} (${mediaEl.videoWidth}x${mediaEl.videoHeight})`);
        }
      } else if (mediaEl instanceof HTMLImageElement) {
        if (mediaEl.naturalWidth && mediaEl.naturalHeight) {
          const aspect = mediaEl.naturalWidth / mediaEl.naturalHeight;
          setMediaAspect(aspect);
          console.log(`[SISTEMA] Aspect ratio da imagem detectado: ${aspect} (${mediaEl.naturalWidth}x${mediaEl.naturalHeight})`);
        }
      }
    };
    
    updateAspect();
    
    if (mediaEl) {
      mediaEl.addEventListener("loadedmetadata", updateAspect);
      mediaEl.addEventListener("load", updateAspect);
    }
    
    const observer = new MutationObserver(() => {
      const el = container.querySelector("video, img");
      if (el && el !== mediaEl) {
        if (mediaEl) {
          mediaEl.removeEventListener("loadedmetadata", updateAspect);
          mediaEl.removeEventListener("load", updateAspect);
        }
        mediaEl = el;
        mediaEl.addEventListener("loadedmetadata", updateAspect);
        mediaEl.addEventListener("load", updateAspect);
        updateAspect();
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    
    return () => {
      observer.disconnect();
      if (mediaEl) {
        mediaEl.removeEventListener("loadedmetadata", updateAspect);
        mediaEl.removeEventListener("load", updateAspect);
      }
    };
  }, [url]);

  const { w, h } = aspectToWH(aspectRatio);
  const frameStyle: React.CSSProperties = {
    aspectRatio: `${w} / ${h}`,
    width: "100%",
    maxWidth: `${heightPx * (w / h)}px`,
    maxHeight: `${heightPx}px`,
  };

  const borderTpl = templates.find(t => t.id === appliedTemplates.border) ?? null;
  const watermarkTpl = templates.find(t => t.id === appliedTemplates.watermark) ?? null;
  const headlineTpl = templates.find(t => t.id === appliedTemplates.headline) ?? null;
  const backgroundTpl = templates.find(t => t.id === appliedTemplates.background) ?? null;

  const onStagePointerDown = (e: React.PointerEvent) => {
    if (!editable || !url) return;
    if ((e.target as HTMLElement).closest("[data-overlay-handle]")) return;
    
    // Select media when clicking the background
    onSelectLayer?.("media");
    
    if (activeLayerId !== "media") return; // Only drag media if it is active
    
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    panRef.current = { startX: e.clientX, startY: e.clientY, origX: cropX, origY: cropY };
    setIsDragging(true);
  };

  const activeFrameRef = useRef<number | null>(null);
  const onStagePointerMove = (e: React.PointerEvent) => {
    if (!panRef.current || activeLayerId !== "media") return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    const targetX = panRef.current.origX + dx;
    const targetY = panRef.current.origY + dy;
    
    if (activeFrameRef.current !== null) {
      cancelAnimationFrame(activeFrameRef.current);
    }
    activeFrameRef.current = requestAnimationFrame(() => {
      onPan(targetX, targetY);
      activeFrameRef.current = null;
    });
  };

  const onStagePointerUp = () => {
    if (activeFrameRef.current !== null) {
      cancelAnimationFrame(activeFrameRef.current);
      activeFrameRef.current = null;
    }
    panRef.current = null;
    setIsDragging(false);
  };

  const onStageWheel = (e: React.WheelEvent) => {
    if (!editable || !url || activeLayerId !== "media") return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    onZoom(Math.max(0.5, Math.min(3, scale + delta)));
  };

  const maskStyle: React.CSSProperties = cropMask === "circle"
    ? { clipPath: "circle(closest-side at 50% 50%)" }
    : {};

  return (
    <div
      ref={stageRef}
      className="relative bg-black rounded-lg border-2 border-[#2a2a2a] flex-shrink-0"
      style={frameStyle}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={onStagePointerUp}
      onWheel={onStageWheel}
    >
      {/* Mask wrapper — clips media + headline/watermark inside the masked shape, border stays full-frame */}
      <div className="absolute inset-0 overflow-hidden">
        
        {/* Background template layer — stays underneath other layers */}
        {backgroundTpl && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: templatePlacements.background?.zIndex ?? 5,
              opacity: templatePlacements.background?.opacity ?? 1,
            }}
          >
            {backgroundTpl.templateMediaType === "video" ? (
              <video
                src={backgroundTpl.dataUrl}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={backgroundTpl.dataUrl}
                className="w-full h-full object-cover"
                alt=""
              />
            )}
          </div>
        )}

        {(() => {
          const stageAspect = w / h;
          const currentMediaAspect = mediaAspect || stageAspect;

          let defaultLeft = 0;
          let defaultTop = 0;
          let defaultWidth = 100;
          let defaultHeight = 100;

          if (currentMediaAspect > stageAspect) {
            defaultHeight = (stageAspect / currentMediaAspect) * 100;
            defaultTop = (100 - defaultHeight) / 2;
          } else {
            defaultWidth = (currentMediaAspect / stageAspect) * 100;
            defaultLeft = (100 - defaultWidth) / 2;
          }

          return url ? (
            <div
              ref={mediaContainerRef}
              className="absolute cursor-grab active:cursor-grabbing"
              style={{
                left: `${defaultLeft}%`,
                top: `${defaultTop}%`,
                width: `${defaultWidth}%`,
                height: `${defaultHeight}%`,
                transform: `translate(${cropX}px, ${cropY}px) scale(${scale}) ${flipH ? "scaleX(-1)" : ""}`,
                transformOrigin: "center",
                zIndex: templatePlacements.media?.zIndex ?? 10,
              }}
            >
            {(() => {
              const crop = mediaCrop || { x: 0, y: 0, width: 100, height: 100 };
              const hasSpatialCrop = !cropMode && (crop.x > 0 || crop.y > 0 || crop.width < 100 || crop.height < 100);
              const spatialCropStyle: React.CSSProperties = hasSpatialCrop
                ? {
                    width: "100%",
                    height: "100%",
                    clipPath: `inset(${crop.y}% ${100 - crop.x - crop.width}% ${100 - crop.y - crop.height}% ${crop.x}%)`,
                  }
                : {
                    width: "100%",
                    height: "100%",
                  };
              const circleCropStyle: React.CSSProperties = cropMask === "circle"
                ? { clipPath: "circle(closest-side at 50% 50%)", width: "100%", height: "100%", overflow: "hidden" }
                : { width: "100%", height: "100%" };
              return (
                <div style={spatialCropStyle}>
                  <div style={circleCropStyle}>
                    {children}
                  </div>
                </div>
              );
            })()}
            {cropMode && editable && activeLayerId === "media" && (
              <MediaCropMaskBox
                mediaCrop={mediaCrop || { x: 0, y: 0, width: 100, height: 100 }}
                onChange={onMediaCropChange || (() => {})}
                containerRef={mediaContainerRef}
                cropAspectRatio={cropAspectRatio || "free"}
              />
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#333] text-xs">
            sem mídia
          </div>
        );
      })()}

        {/* Watermark layer (dentro da máscara) */}
        {watermarkTpl && (
          <div
            data-overlay-handle={editable && activeLayerId === "watermark" ? "true" : undefined}
            className={`absolute ${editable ? (activeLayerId === "watermark" ? "cursor-move" : "cursor-pointer") : ""}`}
            style={{
              left: `${templatePlacements.watermark.x}%`,
              top: `${templatePlacements.watermark.y}%`,
              width: `${templatePlacements.watermark.width}%`,
              transform: `rotate(${templatePlacements.watermark.rotation ?? 0}deg)`,
              opacity: templatePlacements.watermark.opacity ?? 1,
              zIndex: templatePlacements.watermark.zIndex ?? 20,
            }}
            onPointerDown={e => {
              if (editable && activeLayerId !== "watermark") {
                e.stopPropagation();
                onSelectLayer?.("watermark");
              }
            }}
          >
            <img src={watermarkTpl.dataUrl} className="w-full h-auto block animate-none" alt="" />
            {editable && activeLayerId === "watermark" && (
              <OverlayHandle
                placement={templatePlacements.watermark}
                onChange={p => onPlacementChange("watermark", p)}
                onDragStateChange={setIsDragging}
                stageRef={stageRef}
                label="marca d'água"
              />
            )}
          </div>
        )}

        {/* Headline layer (PNG, dentro da máscara) */}
        {headlineTpl && (
          <div
            data-overlay-handle={editable && activeLayerId === "headline" ? "true" : undefined}
            className={`absolute ${editable ? (activeLayerId === "headline" ? "cursor-move" : "cursor-pointer") : ""}`}
            style={{
              left: `${templatePlacements.headline.x}%`,
              top: `${templatePlacements.headline.y}%`,
              width: `${templatePlacements.headline.width}%`,
              transform: `rotate(${templatePlacements.headline.rotation ?? 0}deg)`,
              opacity: templatePlacements.headline.opacity ?? 1,
              zIndex: templatePlacements.headline.zIndex ?? 30,
            }}
            onPointerDown={e => {
              if (editable && activeLayerId !== "headline") {
                e.stopPropagation();
                onSelectLayer?.("headline");
              }
            }}
          >
            <img src={headlineTpl.dataUrl} className="w-full h-auto block" alt="" />
            {editable && activeLayerId === "headline" && (
              <OverlayHandle
                placement={templatePlacements.headline}
                onChange={p => onPlacementChange("headline", p)}
                onDragStateChange={setIsDragging}
                stageRef={stageRef}
                label="headline"
              />
            )}
          </div>
        )}

        {/* Text layers (dentro da máscara, acima da headline) */}
        {textLayers && textLayers.filter(l => l.visible).map(l => {
          const isActive = editable && activeLayerId === `text-${l.id}`;
          if (!l.text && !isActive) return null;
          return (
            <div
              key={l.id}
              data-overlay-handle={editable && isActive ? "true" : undefined}
              className={`absolute ${editable ? (isActive ? "cursor-move" : "cursor-pointer") : ""} select-none`}
              style={{
                left: `${l.x}%`,
                top: `${l.y}%`,
                width: `${l.width}%`,
                textAlign: l.align,
                color: l.color,
                backgroundColor: l.bgOpacity > 0 ? l.bgColor : "transparent",
                opacity: 1,
                fontFamily: l.fontFamily,
                fontSize: l.fontSize * 0.45,
                fontWeight: l.bold ? 900 : 400,
                fontStyle: l.italic ? "italic" : "normal",
                padding: "4px 8px",
                borderRadius: 4,
                zIndex: l.zIndex ?? 40,
                backgroundImage: l.bgOpacity > 0 ? `linear-gradient(${l.bgColor}${Math.round(l.bgOpacity*255).toString(16).padStart(2,"0")}, ${l.bgColor}${Math.round(l.bgOpacity*255).toString(16).padStart(2,"0")})` : undefined,
                pointerEvents: editable ? "auto" : "none",
              }}
              onPointerDown={e => {
                if (editable && activeLayerId !== `text-${l.id}`) {
                  e.stopPropagation();
                  onSelectLayer?.(`text-${l.id}`);
                }
              }}
            >
              {l.text || "Texto..."}
              {isActive && (
                <OverlayHandle
                  placement={l}
                  onChange={p => onTextLayerPlacementChange?.(l.id, p)}
                  onDragStateChange={setIsDragging}
                  stageRef={stageRef}
                  label="texto"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Border layer — sempre cobre o frame inteiro, FORA da máscara (não é cortada) */}
      {borderTpl && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: templatePlacements.border?.zIndex ?? 50,
            opacity: templatePlacements.border?.opacity ?? 1,
          }}
        >
          <img src={borderTpl.dataUrl} className="w-full h-full object-fill" alt="" />
        </div>
      )}

      {/* Align grid — só durante drag */}
      {isDragging && <AlignGrid />}

      {/* Media Crop Box — outline with handles for resizing media */}
      {editable && url && activeLayerId === "media" && !cropMode && (
        <MediaCropBox
          scale={scale}
          cropX={cropX}
          cropY={cropY}
          onCropChange={(s, cx, cy) => {
            onZoom(s);
            onPan(cx, cy);
          }}
          stageRef={stageRef}
          aspectRatio={aspectRatio}
          heightPx={heightPx}
          mediaAspect={mediaAspect}
        />
      )}
    </div>
  );
};
