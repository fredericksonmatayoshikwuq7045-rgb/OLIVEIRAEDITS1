import {
  TemplateItem, TemplateGroup, VideoItem, ImageItem,
  EMPTY_APPLIED_TEMPLATES, DEFAULT_TEMPLATE_PLACEMENTS,
} from "./types";

export const DEFAULT_GROUPS: TemplateGroup[] = [
  { id: "group-general", name: "Geral (Vídeo)", type: "video" },
  { id: "group-img-general", name: "Geral (Imagem)", type: "image" },
];

// Templates de exemplo (SVG simulando PNG transparente)
export const DEFAULT_TEMPLATES: TemplateItem[] = [
  {
    id: "tpl-border-red",
    name: "Borda Vermelha Clássica",
    groupId: "group-general",
    type: "video",
    category: "border",
    isSystem: true,
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640" viewBox="0 0 360 640"><rect x="10" y="10" width="340" height="620" fill="none" stroke="%23dc2626" stroke-width="6" rx="12"/></svg>`,
  },
  {
    id: "tpl-watermark-handle",
    name: "@oliveira_edits",
    groupId: "group-general",
    type: "video",
    category: "watermark",
    isSystem: true,
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" viewBox="0 0 300 80"><rect x="0" y="0" width="300" height="80" rx="10" fill="%23000000" fill-opacity="0.6"/><text x="150" y="48" fill="%23ffffff" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">@oliveira_edits</text></svg>`,
  },
  {
    id: "tpl-headline-fofoca",
    name: "Manchete Fofoca Vermelha",
    groupId: "group-img-general",
    type: "image",
    category: "headline",
    isSystem: true,
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160" viewBox="0 0 600 160"><polygon points="0,60 80,60 100,80 80,100 0,100" fill="%23b91c1c"/><polygon points="600,60 520,60 500,80 520,100 600,100" fill="%23b91c1c"/><rect x="80" y="50" width="440" height="60" fill="%23dc2626"/></svg>`,
  },
];

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function generateInitialVideos(): VideoItem[] {
  const list: VideoItem[] = [];
  for (let i = 1; i <= 100; i++) {
    list.push({
      id: i,
      title: `Slot ${i.toString().padStart(2, "0")} (Vazio)`,
      url: null,
      fileObj: null,
      duration: 30,
      trimIn: 0,
      trimOut: 30,
      scale: 1.0,
      cropX: 0,
      cropY: 0,
      rotation: 0,
      aspectRatio: "9:16",
      cropMask: "default",
      flipH: false,
      templates: EMPTY_APPLIED_TEMPLATES(),
      templatePlacements: DEFAULT_TEMPLATE_PLACEMENTS(),
      textLayers: [],
      status: "idle",
    });
  }
  return list;
}

export function generateInitialImages(): ImageItem[] {
  const list: ImageItem[] = [];
  for (let i = 1; i <= 100; i++) {
    list.push({
      id: i,
      title: `Slot ${i.toString().padStart(2, "0")} (Vazio)`,
      url: null,
      fileObj: null,
      scale: 1.0,
      cropX: 0,
      cropY: 0,
      rotation: 0,
      aspectRatio: "9:16",
      cropMask: "default",
      flipH: false,
      templates: EMPTY_APPLIED_TEMPLATES(),
      templatePlacements: DEFAULT_TEMPLATE_PLACEMENTS(),
      textLayers: [],
      status: "idle",
    });
  }
  return list;
}

export const ASPECT_RATIOS: { value: "9:16" | "16:9" | "1:1" | "4:5"; label: string }[] = [
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "4:5", label: "4:5" },
];

// Retorna {w, h} relativos para um aspect ratio, usado para calcular o frame do preview
export function aspectToWH(ratio: string | undefined | null): { w: number; h: number } {
  if (!ratio || typeof ratio !== "string" || !ratio.includes(":")) return { w: 9, h: 16 };
  const [w, h] = ratio.split(":").map(Number);
  return { w: w || 9, h: h || 16 };
}
