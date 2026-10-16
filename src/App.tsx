import { useState, useEffect } from "react";
import {
  VideoItem, ImageItem, TemplateItem, TemplateGroup,
  TemplateCategory, EMPTY_APPLIED_TEMPLATES, DEFAULT_TEMPLATE_PLACEMENTS,
  TemplatePlacement,
} from "./types";
import { MediaGrid } from "./components/MediaGrid";
import { VideoPlayerPanel } from "./components/VideoPlayerPanel";
import { Sidebar } from "./components/Sidebar";
import { ExportModal } from "./components/ExportModal";
import ImageEditorPanel from "./components/ImageEditorPanel";
import { saveFile, getFile, deleteFile } from "./db";
import {
  generateInitialVideos, generateInitialImages,
  DEFAULT_GROUPS, DEFAULT_TEMPLATES,
} from "./utils";

function updateTitleSlotNumber(title: string, oldId: number, newId: number): string {
  const oldPadded = oldId.toString().padStart(2, "0");
  const newPadded = newId.toString().padStart(2, "0");
  
  const lastDotIdx = title.lastIndexOf(".");
  const baseName = lastDotIdx === -1 ? title : title.substring(0, lastDotIdx);
  const ext = lastDotIdx === -1 ? "" : title.substring(lastDotIdx);
  
  if (baseName === oldPadded) {
    return newPadded + ext;
  }
  
  const separators = [" ", "_", "-", "."];
  for (const sep of separators) {
    if (baseName.endsWith(sep + oldPadded)) {
      return baseName.slice(0, -oldPadded.length) + newPadded + ext;
    }
  }
  
  if (baseName.endsWith(oldPadded)) {
    const charBefore = baseName.charAt(baseName.length - oldPadded.length - 1);
    if (!charBefore || charBefore < "0" || charBefore > "9") {
      return baseName.slice(0, -oldPadded.length) + newPadded + ext;
    }
  }
  
  return title;
}

const EMPTY_VIDEO = (id: number): VideoItem => ({
  id, title: `Slot ${id.toString().padStart(2,"0")} (Vazio)`,
  url: null, fileObj: null, duration: 30, trimIn: 0, trimOut: 30,
  scale: 1, cropX: 0, cropY: 0, rotation: 0,
  aspectRatio: "9:16", cropMask: "default", flipH: false,
  templates: EMPTY_APPLIED_TEMPLATES(),
  templatePlacements: DEFAULT_TEMPLATE_PLACEMENTS(),
  textLayers: [],
  status: "idle",
  thumbnailUrl: null,
  mediaCrop: { x: 0, y: 0, width: 100, height: 100 },
});

const EMPTY_IMAGE = (id: number): ImageItem => ({
  id, title: `Slot ${id.toString().padStart(2,"0")} (Vazio)`,
  url: null, fileObj: null, scale: 1, cropX: 0, cropY: 0, rotation: 0,
  aspectRatio: "9:16", cropMask: "default", flipH: false,
  templates: EMPTY_APPLIED_TEMPLATES(),
  templatePlacements: DEFAULT_TEMPLATE_PLACEMENTS(),
  textLayers: [], status: "idle",
  mediaCrop: { x: 0, y: 0, width: 100, height: 100 },
});

// Migra/normaliza itens vindos do localStorage de versões antigas, garantindo
// que todos os campos novos existam mesmo que o dado salvo seja de uma
// estrutura anterior (ex: tinha "templateId" em vez de "templates").
function sanitizeVideo(raw: any, id: number): VideoItem {
  const base = EMPTY_VIDEO(id);
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    aspectRatio: raw.aspectRatio || base.aspectRatio,
    cropMask: raw.cropMask || base.cropMask,
    flipH: !!raw.flipH,
    textLayers: Array.isArray(raw.textLayers) ? raw.textLayers : [],
    templates: raw.templates && typeof raw.templates === "object"
      ? { border: raw.templates.border ?? null, watermark: raw.templates.watermark ?? null, headline: raw.templates.headline ?? null, background: raw.templates.background ?? null }
      : EMPTY_APPLIED_TEMPLATES(),
    templatePlacements: raw.templatePlacements && raw.templatePlacements.watermark && raw.templatePlacements.headline
      ? {
          border: raw.templatePlacements.border || { x: 0, y: 0, width: 100, rotation: 0, opacity: 1, zIndex: 50 },
          watermark: raw.templatePlacements.watermark,
          headline: raw.templatePlacements.headline,
          media: raw.templatePlacements.media || { x: 0, y: 0, width: 100, rotation: 0, opacity: 1, zIndex: 10 },
          background: raw.templatePlacements.background || { x: 0, y: 0, width: 100, rotation: 0, opacity: 1, zIndex: 5 },
        }
      : DEFAULT_TEMPLATE_PLACEMENTS(),
    thumbnailUrl: raw.thumbnailUrl || null,
    mediaCrop: raw.mediaCrop || base.mediaCrop,
  };
}

function sanitizeImage(raw: any, id: number): ImageItem {
  const base = EMPTY_IMAGE(id);
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    aspectRatio: raw.aspectRatio || base.aspectRatio,
    cropMask: raw.cropMask || base.cropMask,
    flipH: !!raw.flipH,
    textLayers: Array.isArray(raw.textLayers) ? raw.textLayers : [],
    templates: raw.templates && typeof raw.templates === "object"
      ? { border: raw.templates.border ?? null, watermark: raw.templates.watermark ?? null, headline: raw.templates.headline ?? null, background: raw.templates.background ?? null }
      : EMPTY_APPLIED_TEMPLATES(),
    templatePlacements: raw.templatePlacements && raw.templatePlacements.watermark && raw.templatePlacements.headline
      ? {
          border: raw.templatePlacements.border || { x: 0, y: 0, width: 100, rotation: 0, opacity: 1, zIndex: 50 },
          watermark: raw.templatePlacements.watermark,
          headline: raw.templatePlacements.headline,
          media: raw.templatePlacements.media || { x: 0, y: 0, width: 100, rotation: 0, opacity: 1, zIndex: 10 },
          background: raw.templatePlacements.background || { x: 0, y: 0, width: 100, rotation: 0, opacity: 1, zIndex: 5 },
        }
      : DEFAULT_TEMPLATE_PLACEMENTS(),
    mediaCrop: raw.mediaCrop || base.mediaCrop,
  };
}

function sanitizeTemplate(raw: any): TemplateItem | null {
  if (!raw || typeof raw !== "object" || !raw.id || !raw.dataUrl) return null;
  return {
    id: raw.id,
    name: raw.name || "Template",
    groupId: raw.groupId || "group-general",
    type: raw.type === "image" ? "image" : "video",
    category: ["border", "watermark", "headline", "background"].includes(raw.category) ? raw.category : "border",
    dataUrl: raw.dataUrl,
    isSystem: !!raw.isSystem,
    templateMediaType: raw.templateMediaType,
    headlineText: raw.headlineText,
    headlineFontFamily: raw.headlineFontFamily,
    headlineFontSize: raw.headlineFontSize,
    headlineColor: raw.headlineColor,
    headlineAlign: raw.headlineAlign,
  };
}

function loadVideosFromStorage(): VideoItem[] {
  try {
    const s = localStorage.getItem("oe_videos");
    if (!s) return generateInitialVideos();
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed) || parsed.length === 0) return generateInitialVideos();
    return parsed.map((v: any, idx: number) => sanitizeVideo(v, v?.id ?? idx + 1));
  } catch { return generateInitialVideos(); }
}

function loadImagesFromStorage(): ImageItem[] {
  try {
    const s = localStorage.getItem("oe_images");
    if (!s) return generateInitialImages();
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed) || parsed.length === 0) return generateInitialImages();
    return parsed.map((i: any, idx: number) => sanitizeImage(i, i?.id ?? idx + 1));
  } catch { return generateInitialImages(); }
}

function loadTemplatesFromStorage(): TemplateItem[] {
  try {
    const s = localStorage.getItem("oe_templates");
    if (!s) return DEFAULT_TEMPLATES;
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return DEFAULT_TEMPLATES;
    const cleaned = parsed.map(sanitizeTemplate).filter((t): t is TemplateItem => t !== null);
    return cleaned.length > 0 ? cleaned : DEFAULT_TEMPLATES;
  } catch { return DEFAULT_TEMPLATES; }
}

function loadGroupsFromStorage(): TemplateGroup[] {
  try {
    const s = localStorage.getItem("oe_groups");
    if (!s) return DEFAULT_GROUPS;
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_GROUPS;
    return parsed.filter((g: any) => g && g.id && g.name && g.type);
  } catch { return DEFAULT_GROUPS; }
}

// Custom Confirm Modal
interface CustomConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const CustomConfirmModal: React.FC<CustomConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[100] animate-fade-in backdrop-blur-xs">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 w-80 shadow-2xl animate-scale-in text-center">
        <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
        <p className="text-xs text-[#888] mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 bg-[#222] hover:bg-[#333] border border-[#333] text-xs font-semibold rounded-lg transition-colors cursor-pointer text-white">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-white">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

// Custom Prompt Modal
interface CustomPromptModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

const CustomPromptModal: React.FC<CustomPromptModalProps> = ({ isOpen, title, message, onSubmit, onCancel }) => {
  const [val, setVal] = useState("");
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[100] animate-fade-in backdrop-blur-xs">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 w-96 shadow-2xl animate-scale-in">
        <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
        <p className="text-xs text-[#888] mb-3 leading-relaxed">{message}</p>
        <input
          autoFocus
          type="text"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") onSubmit(val);
            if (e.key === "Escape") onCancel();
          }}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#ccc] focus:outline-none focus:border-[#444] mb-4"
          placeholder="Ex: posts para conta do insta @hahahah"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 bg-[#222] hover:bg-[#333] border border-[#333] text-xs font-semibold rounded-lg transition-colors cursor-pointer text-white">
            Cancelar
          </button>
          <button onClick={() => onSubmit(val)} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-white">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"video" | "image">("video");

  const [videos, setVideos] = useState<VideoItem[]>(loadVideosFromStorage);
  const [images, setImages] = useState<ImageItem[]>(loadImagesFromStorage);
  const [groups, setGroups] = useState<TemplateGroup[]>(loadGroupsFromStorage);
  const [templates, setTemplates] = useState<TemplateItem[]>(loadTemplatesFromStorage);

  const [selectedId, setSelectedId] = useState<number>(1);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportQueue, setExportQueue] = useState<VideoItem[]>([]);
  const [exportPath, setExportPath] = useState("/output/");

  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onSubmit: (value: string) => void;
    onCancel: () => void;
  } | null>(null);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // Load and restore files on mount
  useEffect(() => {
    const restoreFiles = async () => {
      console.log("[SISTEMA] Iniciando restauração de arquivos salvos do IndexedDB...");
      // Restore videos
      const initialVideos = loadVideosFromStorage();
      const restoredVideos = await Promise.all(initialVideos.map(async (v) => {
        try {
          const file = await getFile("video", v.id);
          if (file) {
            const url = URL.createObjectURL(file);
            console.log(`[SISTEMA] Vídeo restaurado com sucesso no slot ${v.id}: ${v.title}`);
            return { ...v, url, fileObj: file, status: "ready" as const };
          }
        } catch (e) {
          console.error(`[SISTEMA] Falha ao restaurar arquivo de vídeo no slot ${v.id}`, e);
        }
        return { ...v, url: null, fileObj: null, status: "idle" as const };
      }));
      setVideos(restoredVideos);

      // Restore images
      const initialImages = loadImagesFromStorage();
      const restoredImages = await Promise.all(initialImages.map(async (img) => {
        try {
          const file = await getFile("image", img.id);
          if (file) {
            const url = URL.createObjectURL(file);
            console.log(`[SISTEMA] Imagem restaurada com sucesso no slot ${img.id}: ${img.title}`);
            return { ...img, url, fileObj: file, status: "ready" as const };
          }
        } catch (e) {
          console.error(`[SISTEMA] Falha ao restaurar arquivo de imagem no slot ${img.id}`, e);
        }
        return { ...img, url: null, fileObj: null, status: "idle" as const };
      }));
      setImages(restoredImages);
      console.log("[SISTEMA] Processo de restauração concluído.");
    };

    restoreFiles();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("oe_videos", JSON.stringify(videos));
    } catch (e) {
      console.warn("Failed to save videos to localStorage (quota exceeded)", e);
    }
  }, [videos]);

  useEffect(() => {
    try {
      localStorage.setItem("oe_images", JSON.stringify(images));
    } catch (e) {
      console.warn("Failed to save images to localStorage (quota exceeded)", e);
    }
  }, [images]);

  useEffect(() => {
    try {
      localStorage.setItem("oe_groups", JSON.stringify(groups));
    } catch (e) {
      console.warn("Failed to save groups to localStorage (quota exceeded)", e);
    }
  }, [groups]);

  useEffect(() => {
    try {
      localStorage.setItem("oe_templates", JSON.stringify(templates));
    } catch (e) {
      console.warn("Failed to save templates to localStorage (quota exceeded)", e);
    }
  }, [templates]);

  // Keyboard navigation
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "ArrowRight") { e.preventDefault(); setSelectedId(p => Math.min(100, p + 1)); }
      if (e.ctrlKey && e.key === "ArrowLeft")  { e.preventDefault(); setSelectedId(p => Math.max(1, p - 1)); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    document.getElementById(`slot-${selectedId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const activeVideo = videos.find(v => v.id === selectedId) ?? videos[0];
  const activeImage = images.find(i => i.id === selectedId) ?? images[0];

  const updateVideo = (u: VideoItem) => setVideos(p => p.map(v => v.id === u.id ? u : v));
  const updateImage = (u: ImageItem) => setImages(p => p.map(i => i.id === u.id ? u : i));
  const updateAllImages = (fn: (i: ImageItem) => ImageItem) => setImages(p => p.map(fn));
  const updateAllVideos = (fn: (v: VideoItem) => VideoItem) => setVideos(p => p.map(fn));

  // Import individual file into a slot with optional prefix renaming
  const importFile = async (id: number, file: File, type: "video" | "image", renamePrefix?: string | null) => {
    console.log(`[SISTEMA] importFile chamado para slot ${id}, tipo ${type}, arquivo: ${file.name}`);
    try {
      await saveFile(type, id, file);
      console.log(`[SISTEMA] Arquivo salvo com sucesso no IndexedDB para o slot ${id}`);
    } catch (err) {
      console.error(`[SISTEMA] Erro ao gravar arquivo no IndexedDB para o slot ${id}`, err);
    }
    const url = URL.createObjectURL(file);
    let fileName = file.name;
    if (renamePrefix) {
      const ext = file.name.substring(file.name.lastIndexOf("."));
      fileName = `${renamePrefix} ${id.toString().padStart(2, "0")}${ext}`;
    }

    if (type === "video") {
      const el = document.createElement("video");
      el.src = url;
      el.muted = true;
      el.playsInline = true;
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        const dur = Math.round(el.duration || 30);
        el.currentTime = Math.min(1, dur / 2);
      };
      el.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = el.videoWidth || 320;
        canvas.height = el.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        let thumbUrl = null;
        if (ctx) {
          ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
          try {
            thumbUrl = canvas.toDataURL("image/jpeg", 0.7);
          } catch (e) {
            console.error(`[SISTEMA] Erro ao gerar thumbnail para slot ${id}`, e);
          }
        }
        const dur = Math.round(el.duration || 30);
        setVideos(p => p.map(v => v.id === id
          ? { ...v, title: fileName, url, fileObj: file, duration: dur, trimIn: 0, trimOut: dur, status: "ready", thumbnailUrl: thumbUrl }
          : v));
        el.onseeked = null;
        el.onloadedmetadata = null;
      };
    } else {
      setImages(p => p.map(i => i.id === id
        ? { ...i, title: fileName, url, fileObj: file, status: "ready" }
        : i));
    }
  };

  // Import folder — incremental: começa do próximo slot livre após o último ocupado
  const importFolder = (files: FileList, type: "video" | "image") => {
    console.log(`[SISTEMA] importFolder acionado para tipo: ${type}. Total bruto de arquivos: ${files.length}`);
    let arr = Array.from(files);
    if (arr.length === 0) {
      console.log("[SISTEMA] A lista de arquivos está vazia.");
      return;
    }

    // Filter files to only keep media files of the correct type
    if (type === "video") {
      arr = arr.filter(f => f.type.startsWith("video/") || /\.(mp4|m4v|mov|avi|mkv|webm)$/i.test(f.name));
    } else {
      arr = arr.filter(f => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|tiff)$/i.test(f.name));
    }
    console.log(`[SISTEMA] Arquivos filtrados correspondentes ao tipo ${type}: ${arr.length}`);

    if (arr.length === 0) {
      console.log("[SISTEMA] Nenhum arquivo compatível encontrado na pasta.");
      return;
    }

    // Sort files alphabetically (natural sort) so they are imported in correct sequence
    arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    console.log("[SISTEMA] Arquivos ordenados alfabeticamente.");

    setPromptState({
      isOpen: true,
      title: "Nome dos arquivos em massa",
      message: "Nome dos arquivos em massa (deixe vazio para usar os nomes originais):",
      onSubmit: (renamePrefix) => {
        const prefix = renamePrefix.trim() ? renamePrefix.trim() : null;
        console.log(`[SISTEMA] Nome em massa definido: ${prefix || "Nenhum (original)"}`);
        if (type === "video") {
          const lastOccupied = Math.max(0, ...videos.filter(v => !!v.url).map(v => v.id));
          const startSlot = Math.min(100, lastOccupied + 1);
          console.log(`[SISTEMA] Iniciando importação de vídeos. Começando no slot ${startSlot}`);
          
          (async () => {
            for (let idx = 0; idx < arr.length; idx++) {
              const slot = startSlot + idx;
              if (slot > 100) {
                console.log("[SISTEMA] Limite de 100 slots excedido. Cancelando restantes.");
                break;
              }
              const file = arr[idx];
              console.log(`[SISTEMA] Processando vídeo ${idx + 1}/${arr.length}: ${file.name} no slot ${slot}`);
              
              // Define temporary title and status
              setVideos(p => p.map(v => v.id === slot ? { ...v, status: "processing", title: "Carregando..." } : v));
              
              await new Promise<void>((resolve) => {
                const url = URL.createObjectURL(file);
                let fileName = file.name;
                if (prefix) {
                  const ext = file.name.substring(file.name.lastIndexOf("."));
                  fileName = `${prefix} ${slot.toString().padStart(2, "0")}${ext}`;
                }
                
                const el = document.createElement("video");
                el.src = url;
                el.muted = true;
                el.playsInline = true;
                el.preload = "metadata";
                
                // Save to IndexedDB
                saveFile("video", slot, file)
                  .then(() => {
                    console.log(`[SISTEMA] Vídeo salvo com sucesso no IndexedDB para o slot ${slot}`);
                  })
                  .catch(err => {
                    console.error(`[SISTEMA] Erro ao salvar vídeo no IndexedDB para o slot ${slot}:`, err);
                  });

                let timeoutId = setTimeout(() => {
                  console.warn(`[SISTEMA] Timeout de carregamento de vídeo (8s) no slot ${slot}`);
                  el.onloadedmetadata = null;
                  el.onseeked = null;
                  el.src = "";
                  el.load();
                  setVideos(p => p.map(v => v.id === slot
                    ? (v.url ? { ...v, status: "ready" } : { ...v, status: "idle", title: `Slot ${slot.toString().padStart(2, "0")} (Vazio)` })
                    : v));
                  resolve();
                }, 8000);
                
                el.onloadedmetadata = () => {
                  const dur = Math.round(el.duration || 30);
                  console.log(`[SISTEMA] Metadados carregados para slot ${slot}. Duração: ${dur}s.`);
                  setVideos(p => p.map(v => v.id === slot
                    ? { ...v, title: fileName, url, fileObj: file, duration: dur, trimIn: 0, trimOut: dur, status: "ready" }
                    : v));
                  el.currentTime = Math.max(0.1, Math.min(1, dur / 2));
                };
                
                el.onseeked = () => {
                  clearTimeout(timeoutId);
                  console.log(`[SISTEMA] Seek concluído para slot ${slot}. Renderizando miniatura.`);
                  const canvas = document.createElement("canvas");
                  canvas.width = el.videoWidth || 320;
                  canvas.height = el.videoHeight || 180;
                  const ctx = canvas.getContext("2d");
                  let thumbUrl = null;
                  if (ctx) {
                    try {
                      ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
                      thumbUrl = canvas.toDataURL("image/jpeg", 0.7);
                    } catch (e) {
                      console.error(`[SISTEMA] Falha ao renderizar miniatura para slot ${slot}:`, e);
                    }
                  }
                  setVideos(p => p.map(v => v.id === slot
                    ? { ...v, thumbnailUrl: thumbUrl }
                    : v));
                  
                  el.onseeked = null;
                  el.onloadedmetadata = null;
                  el.src = "";
                  el.load();
                  console.log(`[SISTEMA] Processamento do slot ${slot} concluído.`);
                  resolve();
                };
                
                el.onerror = () => {
                  clearTimeout(timeoutId);
                  console.error(`[SISTEMA] Erro no player temporário do slot ${slot}`);
                  setVideos(p => p.map(v => v.id === slot
                    ? (v.url ? { ...v, status: "ready" } : { ...v, status: "idle", title: `Slot ${slot.toString().padStart(2, "0")} (Vazio)` })
                    : v));
                  el.onloadedmetadata = null;
                  el.onseeked = null;
                  el.src = "";
                  el.load();
                  resolve();
                };
              });
            }
            console.log("[SISTEMA] Importação de pasta de vídeos finalizada.");
          })();
        } else {
          const lastOccupied = Math.max(0, ...images.filter(i => !!i.url).map(i => i.id));
          const startSlot = Math.min(100, lastOccupied + 1);
          console.log(`[SISTEMA] Iniciando importação de imagens. Começando no slot ${startSlot}`);
          arr.forEach((file, idx) => {
            const slot = startSlot + idx;
            if (slot > 100) return;
            console.log(`[SISTEMA] Processando imagem ${idx + 1}/${arr.length}: ${file.name} no slot ${slot}`);
            importFile(slot, file, "image", prefix);
          });
          console.log("[SISTEMA] Importação de pasta de imagens concluída.");
        }
        setPromptState(null);
      },
      onCancel: () => {
        console.log("[SISTEMA] Importação de pasta cancelada pelo usuário.");
        setPromptState(null);
      }
    });
  };

  // Clear individual slot — shifts subsequent slots left to fill the gap
  const clearSlot = (id: number) => {
    if (activeTab === "video") {
      setVideos(p => {
        const list = [...p];
        const idx = list.findIndex(v => v.id === id);
        if (idx === -1) return p;
        list.splice(idx, 1);
        list.push(EMPTY_VIDEO(100));
        const updated = list.map((v, i) => {
          const newId = i + 1;
          let finalTitle = v.title;
          if (v.url) {
            finalTitle = updateTitleSlotNumber(v.title, v.id, newId);
          } else {
            finalTitle = `Slot ${newId.toString().padStart(2, "0")} (Vazio)`;
          }
          return { ...v, id: newId, title: finalTitle };
        });

        // Sync IndexedDB for videos
        (async () => {
          for (let i = id; i <= 100; i++) {
            const item = updated[i - 1];
            if (item && item.fileObj) {
              await saveFile("video", i, item.fileObj);
            } else {
              await deleteFile("video", i);
            }
          }
        })();

        return updated;
      });
    } else {
      setImages(p => {
        const list = [...p];
        const idx = list.findIndex(i => i.id === id);
        if (idx === -1) return p;
        list.splice(idx, 1);
        list.push(EMPTY_IMAGE(100));
        const updated = list.map((img, i) => {
          const newId = i + 1;
          let finalTitle = img.title;
          if (img.url) {
            finalTitle = updateTitleSlotNumber(img.title, img.id, newId);
          } else {
            finalTitle = `Slot ${newId.toString().padStart(2, "0")} (Vazio)`;
          }
          return { ...img, id: newId, title: finalTitle };
        });

        // Sync IndexedDB for images
        (async () => {
          for (let i = id; i <= 100; i++) {
            const item = updated[i - 1];
            if (item && item.fileObj) {
              await saveFile("image", i, item.fileObj);
            } else {
              await deleteFile("image", i);
            }
          }
        })();

        return updated;
      });
    }
  };

  // Clear all slots
  const clearAll = () => {
    setConfirmState({
      isOpen: true,
      title: "Limpar todos os slots",
      message: "Tem certeza de que deseja limpar todos os slots? Esta ação não pode ser desfeita e removerá toda a mídia.",
      onConfirm: () => {
        if (activeTab === "video") {
          setVideos(generateInitialVideos());
          for (let i = 1; i <= 100; i++) deleteFile("video", i).catch(e => console.error(e));
        } else {
          setImages(generateInitialImages());
          for (let i = 1; i <= 100; i++) deleteFile("image", i).catch(e => console.error(e));
        }
        setConfirmState(null);
      },
      onCancel: () => setConfirmState(null)
    });
  };

  // Apply/remove a single template category on the active item
  const applyTemplate = (category: TemplateCategory, id: string | null) => {
    if (activeTab === "video") {
      updateVideo({ ...activeVideo, templates: { ...activeVideo.templates, [category]: id } });
    } else {
      updateImage({ ...activeImage, templates: { ...activeImage.templates, [category]: id } });
    }
  };

  const applyTemplateToAll = (category: TemplateCategory, id: string | null) => {
    if (activeTab === "video") {
      const activePlacement = activeVideo.templatePlacements[category];
      setVideos(p => p.map(v => v.url ? {
        ...v,
        templates: { ...v.templates, [category]: id },
        templatePlacements: {
          ...v.templatePlacements,
          [category]: activePlacement ? { ...v.templatePlacements[category], ...activePlacement } : v.templatePlacements[category]
        }
      } : v));
    } else {
      const activePlacement = activeImage.templatePlacements[category];
      setImages(p => p.map(i => i.url ? {
        ...i,
        templates: { ...i.templates, [category]: id },
        templatePlacements: {
          ...i.templatePlacements,
          [category]: activePlacement ? { ...i.templatePlacements[category], ...activePlacement } : i.templatePlacements[category]
        }
      } : i));
    }
  };

  const applyMediaAdjustToAll = () => {
    if (activeTab === "video") {
      const { scale, cropX, cropY, rotation, aspectRatio, cropMask, flipH } = activeVideo;
      setVideos(p => p.map(v => v.url ? {
        ...v,
        scale, cropX, cropY, rotation, aspectRatio, cropMask, flipH
      } : v));
    } else {
      const { scale, cropX, cropY, rotation, aspectRatio, cropMask, flipH } = activeImage;
      setImages(p => p.map(i => i.url ? {
        ...i,
        scale, cropX, cropY, rotation, aspectRatio, cropMask, flipH
      } : i));
    }
  };

  // Mix templates of a category across all loaded items (sequential distribution)
  const mixTemplates = (category: TemplateCategory, ids: string[]) => {
    if (ids.length === 0) return;
    if (activeTab === "video") {
      const loaded = videos.filter(v => !!v.url);
      setVideos(p => p.map(v => {
        if (!v.url) return v;
        const idx = loaded.findIndex(l => l.id === v.id);
        return { ...v, templates: { ...v.templates, [category]: ids[idx % ids.length] } };
      }));
    } else {
      const loaded = images.filter(i => !!i.url);
      setImages(p => p.map(i => {
        if (!i.url) return i;
        const idx = loaded.findIndex(l => l.id === i.id);
        return { ...i, templates: { ...i.templates, [category]: ids[idx % ids.length] } };
      }));
    }
  };

  const addGroup = (name: string, type: "video" | "image") =>
    setGroups(p => [...p, { id: `g-${Date.now()}`, name, type }]);

  const addTemplate = (tpl: Omit<TemplateItem, "id">) =>
    setTemplates(p => [...p, { ...tpl, id: `t-${Date.now()}` }]);

  const removeTemplate = (id: string) => {
    setTemplates(p => p.filter(t => t.id !== id));
    // remove from all applied
    setVideos(p => p.map(v => ({
      ...v,
      templates: {
        border: v.templates.border === id ? null : v.templates.border,
        watermark: v.templates.watermark === id ? null : v.templates.watermark,
        headline: v.templates.headline === id ? null : v.templates.headline,
        background: v.templates.background === id ? null : v.templates.background,
      },
    })));
    setImages(p => p.map(i => ({
      ...i,
      templates: {
        border: i.templates.border === id ? null : i.templates.border,
        watermark: i.templates.watermark === id ? null : i.templates.watermark,
        headline: i.templates.headline === id ? null : i.templates.headline,
        background: i.templates.background === id ? null : i.templates.background,
      },
    })));
  };

  const moveTemplate = (id: string, groupId: string) =>
    setTemplates(p => p.map(t => t.id === id ? { ...t, groupId } : t));

  const triggerExport = () => {
    const queue = activeTab === "video"
      ? videos.filter(v => !!v.url)
      : images.filter(i => !!i.url).map(i => ({
          ...i,
          duration: 5,
          trimIn: 0,
          trimOut: 5,
          thumbnailUrl: null,
        } as VideoItem));
    setExportQueue(queue);
    setIsExportOpen(true);
  };

  const loadedCount = activeTab === "video"
    ? videos.filter(v => !!v.url).length
    : images.filter(i => !!i.url).length;

  const activeApplied = activeTab === "video" ? activeVideo.templates : activeImage.templates;

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-[#e8e8e8] overflow-hidden select-none">

      {/* Header */}
      <header className="h-11 flex items-center justify-between px-4 border-b border-[#1c1c1c] bg-[#0d0d0d] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/00bb.ico" alt="" className="w-5 h-5 object-contain"
            onError={e => (e.currentTarget.style.display = "none")} />
          <span className="text-sm font-semibold tracking-tight text-white">Oliveira Edits</span>
        </div>

        <div className="flex items-center bg-[#161616] rounded-lg p-0.5 gap-0.5">
          {(["video", "image"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${activeTab === tab ? "bg-[#222] text-white" : "text-[#666] hover:text-[#999]"}`}>
              {tab === "video" ? "Vídeo" : "Imagem"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#555]">
          <span className="font-mono">{loadedCount} carregados</span>
          <span className="text-[#222]">|</span>
          <span className="font-mono text-[#e8e8e8]">
            #{selectedId.toString().padStart(2, "0")} <span className="text-[#444]">/ 100</span>
          </span>
        </div>
      </header>

      {/* Body */}
      <main className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar
          activeTab={activeTab}
          templates={templates}
          groups={groups}
          appliedTemplates={activeApplied}
          onApplyTemplate={applyTemplate}
          onApplyTemplateToAll={applyTemplateToAll}
          onMixTemplates={mixTemplates}
          onAddGroup={addGroup}
          onAddTemplate={addTemplate}
          onRemoveTemplate={removeTemplate}
          onMoveTemplate={moveTemplate}
          exportPath={exportPath}
          onChangeExportPath={setExportPath}
          onImportFolder={importFolder}
          onTriggerExportBatch={triggerExport}
          onClearAll={clearAll}
          totalLoadedVideos={videos.filter(v => !!v.url).length}
          totalLoadedImages={images.filter(i => !!i.url).length}
        />

        <div className="flex-1 min-w-0 overflow-hidden">
          <MediaGrid
            items={activeTab === "video" ? videos : images}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onClearSlot={clearSlot}
            activeTab={activeTab}
          />
        </div>

        <div className="w-[360px] flex-shrink-0 border-l border-[#1c1c1c] overflow-hidden">
          {activeTab === "video"
            ? <VideoPlayerPanel
                video={activeVideo} allVideos={videos} templates={templates}
                onChangeVideo={updateVideo} onChangeAllVideos={updateAllVideos}
                onApplyTemplateToAll={applyTemplateToAll}
                onApplyMediaAdjustToAll={applyMediaAdjustToAll}
              />
            : <ImageEditorPanel
                image={activeImage} allImages={images} templates={templates}
                onChangeImage={updateImage} onChangeAllImages={updateAllImages}
                onApplyTemplateToAll={applyTemplateToAll}
                onApplyMediaAdjustToAll={applyMediaAdjustToAll}
                exportPath={exportPath}
              />
          }
        </div>
      </main>

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        exportingVideos={exportQueue}
        allTemplates={templates}
        exportPath={exportPath}
        activeTab={activeTab}
      />

      {confirmState && (
        <CustomConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={confirmState.onCancel}
        />
      )}

      {promptState && (
        <CustomPromptModal
          isOpen={promptState.isOpen}
          title={promptState.title}
          message={promptState.message}
          onSubmit={promptState.onSubmit}
          onCancel={promptState.onCancel}
        />
      )}
    </div>
  );
}
