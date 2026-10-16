// ── Aspect ratio / crop ───────────────────────────────────────────────────────
export type AspectRatioType = "9:16" | "16:9" | "1:1" | "4:5";
export type CropMaskType = "default" | "circle";

export interface AspectRatioOption {
  value: AspectRatioType;
  label: string;
  width: number;
  height: number;
  iconName: string;
}

// ── Template categories ──────────────────────────────────────────────────────
// border    = "fixa": moldura/borda do vídeo, cobre o frame inteiro, não editável
// watermark = "movel": marca d'água arrastável/redimensionável
// headline  = PNG + texto editável salvo junto (ex: cartaz de fofoca), também
//             arrastável/redimensionável como camada
export type TemplateCategory = "border" | "watermark" | "headline" | "background";

export interface TemplatePlacement {
  x: number;       // % a partir da esquerda
  y: number;       // % a partir do topo
  width: number;   // % da largura do canvas
  rotation?: number; // rotação em graus (0 a 360)
  opacity?: number;  // opacidade (0 a 1)
  zIndex?: number;   // ordem de camadas
}

export const DEFAULT_PLACEMENT = (category: TemplateCategory): TemplatePlacement => {
  if (category === "watermark") return { x: 65, y: 5, width: 28, rotation: 0, opacity: 1, zIndex: 20 };
  if (category === "headline") return { x: 10, y: 8, width: 80, rotation: 0, opacity: 1, zIndex: 30 };
  if (category === "background") return { x: 0, y: 0, width: 100, rotation: 0, opacity: 1, zIndex: 5 };
  return { x: 0, y: 0, width: 100, rotation: 0, opacity: 1, zIndex: 10 }; // border sempre cobre tudo
};

export interface TemplateItem {
  id: string;
  name: string;
  groupId: string;
  category: TemplateCategory;
  dataUrl: string;              // PNG base64
  type: "video" | "image";
  isSystem?: boolean;
  templateMediaType?: "video" | "image"; // whether the template itself is video or image
  // Apenas para headline: texto + estilo salvos junto do template
  headlineText?: string;
  headlineFontFamily?: string;
  headlineFontSize?: number;
  headlineColor?: string;
  headlineAlign?: "left" | "center" | "right";
}

export interface TemplateGroup {
  id: string;
  name: string;
  type: "video" | "image";
}

// Templates ativos aplicados a um item específico — até 1 de cada categoria,
// cada um com sua própria posição/tamanho (placement)
export interface AppliedTemplates {
  border: string | null;
  watermark: string | null;
  headline: string | null;
  background: string | null;
}

export const EMPTY_APPLIED_TEMPLATES = (): AppliedTemplates => ({
  border: null, watermark: null, headline: null, background: null,
});

export interface TemplatePlacements {
  border: TemplatePlacement;
  watermark: TemplatePlacement;
  headline: TemplatePlacement;
  media?: TemplatePlacement;
  background?: TemplatePlacement;
}

export const DEFAULT_TEMPLATE_PLACEMENTS = (): TemplatePlacements => ({
  border: DEFAULT_PLACEMENT("border"),
  watermark: DEFAULT_PLACEMENT("watermark"),
  headline: DEFAULT_PLACEMENT("headline"),
  media: { x: 0, y: 0, width: 100, rotation: 0, opacity: 1, zIndex: 10 },
  background: { x: 0, y: 0, width: 100, rotation: 0, opacity: 1, zIndex: 5 },
});

export interface MediaCrop {
  x: number;      // % do início esquerdo (0..100)
  y: number;      // % do início topo (0..100)
  width: number;  // % da largura (0..100)
  height: number; // % da altura (0..100)
}

// ── Video ─────────────────────────────────────────────────────────────────────
export interface VideoItem {
  id: number;
  title: string;
  url: string | null;
  fileObj: File | null;
  duration: number;
  trimIn: number;
  trimOut: number;
  scale: number;
  cropX: number;
  cropY: number;
  rotation: number;
  aspectRatio: AspectRatioType;
  cropMask: CropMaskType;
  flipH: boolean;
  templates: AppliedTemplates;
  templatePlacements: TemplatePlacements;
  headlineTextOverride?: string;  // permite mudar só o texto do headline para este item específico
  textLayers: TextLayer[];
  status: "idle" | "ready" | "processing" | "done";
  thumbnailUrl?: string | null;
  mediaCrop?: MediaCrop;
}

// ---- Text layer inside image editor ----
export interface TextLayer {
  id: string;
  label: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bgColor: string;
  bgOpacity: number;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  x: number;
  y: number;
  width: number;
  visible: boolean;
  isGlobal?: boolean;
  zIndex?: number;
}

export const DEFAULT_TEXT_LAYER = (): TextLayer => ({
  id: Math.random().toString(36).slice(2),
  label: "Texto",
  text: "",
  fontFamily: "Plus Jakarta Sans",
  fontSize: 28,
  color: "#ffffff",
  bgColor: "#000000",
  bgOpacity: 0.6,
  bold: true,
  italic: false,
  align: "center",
  x: 5,
  y: 80,
  width: 90,
  visible: true,
  isGlobal: false,
  zIndex: 40,
});

// ---- Uploaded / Google font ----
export interface FontItem {
  id: string;
  name: string;
  family: string;
  source: "google" | "upload";
  url?: string;
}

// ── Image ─────────────────────────────────────────────────────────────────────
export interface ImageItem {
  id: number;
  title: string;
  url: string | null;
  fileObj: File | null;
  scale: number;
  cropX: number;
  cropY: number;
  rotation: number;
  aspectRatio: AspectRatioType;
  cropMask: CropMaskType;
  flipH: boolean;
  templates: AppliedTemplates;
  templatePlacements: TemplatePlacements;
  headlineTextOverride?: string;
  textLayers: TextLayer[];
  status: "idle" | "ready" | "processing" | "done";
  mediaCrop?: MediaCrop;
}
