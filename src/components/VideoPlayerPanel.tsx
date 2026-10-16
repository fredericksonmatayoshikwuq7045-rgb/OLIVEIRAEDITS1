import React, { useEffect, useRef, useState, useCallback } from "react";
import { VideoItem, TextLayer, FontItem, TemplateItem, DEFAULT_TEXT_LAYER, AspectRatioType, CropMaskType, TemplatePlacement, TemplateCategory } from "../types";
import { ASPECT_RATIOS, formatTime, aspectToWH } from "../utils";
import { MediaStage } from "./MediaStage";
import { VideoControlsOverlay } from "./VideoControlsOverlay";
import {
  Plus, Trash2, Eye, EyeOff, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight, ChevronDown,
  Search, Upload, Copy, FlipHorizontal2, Circle, Square,
  ArrowUp, ArrowDown,
} from "lucide-react";

const GFONTS = [
  "Inter","Roboto","Open Sans","Lato","Montserrat","Poppins","Raleway","Nunito",
  "DM Sans","Rubik","Oswald","Barlow Condensed","Bebas Neue","Anton","Impact",
  "Playfair Display","Abril Fatface","Lobster","Pacifico","Righteous","Boogaloo",
  "Plus Jakarta Sans","JetBrains Mono","Fira Code","Black Han Sans",
];

function loadGFont(family: string) {
  const id = `gf-${family.replace(/\s+/g,"-")}`;
  if (document.getElementById(id)) return;
  const l = document.createElement("link");
  l.id = id; l.rel = "stylesheet";
  l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700;900&display=swap`;
  document.head.appendChild(l);
}

const FontPicker: React.FC<{ value: string; customFonts: FontItem[]; onChange: (f: string) => void }> = ({ value, customFonts, onChange }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const all = [...GFONTS.map(f => ({ name: f, custom: false })), ...customFonts.map(f => ({ name: f.name, custom: true }))];
  const filtered = all.filter(f => f.name.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => { GFONTS.forEach(loadGFont); }, []);

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full h-8 px-2.5 bg-[#141414] border border-[#2a2a2a] rounded-lg text-xs text-[#ccc] flex items-center justify-between hover:border-[#444] transition-colors cursor-pointer"
        style={{ fontFamily: value }}>
        <span className="truncate">{value}</span>
        <ChevronDown size={11} className="text-[#555] ml-1 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-9 left-0 right-0 z-50 bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-[#1c1c1c]">
            <div className="flex items-center gap-1.5 bg-[#0f0f0f] rounded-lg px-2">
              <Search size={11} className="text-[#555]" />
              <input autoFocus type="text" value={q} onChange={e => setQ(e.target.value)}
                placeholder="Buscar..." className="flex-1 bg-transparent text-xs text-[#ccc] py-1.5 focus:outline-none" />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(f => (
              <button key={f.name} onClick={() => { onChange(f.name); setOpen(false); setQ(""); }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-[#1c1c1c] transition-colors flex items-center justify-between cursor-pointer ${value === f.name ? "text-red-400" : "text-[#ccc]"}`}
                style={{ fontFamily: f.name }}>
                {f.name}
                {f.custom && <span className="text-[9px] bg-[#1c1c1c] text-[#666] px-1.5 py-0.5 rounded font-mono">custom</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface Props {
  video: VideoItem;
  allVideos: VideoItem[];
  templates: TemplateItem[];
  onChangeVideo: (v: VideoItem) => void;
  onChangeAllVideos: (fn: (v: VideoItem) => VideoItem) => void;
  onApplyTemplateToAll: (category: TemplateCategory, id: string | null) => void;
  onApplyMediaAdjustToAll: () => void;
}

export const VideoPlayerPanel: React.FC<Props> = ({
  video, allVideos, templates, onChangeVideo, onChangeAllVideos,
  onApplyTemplateToAll, onApplyMediaAdjustToAll
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const [customFonts, setCustomFonts] = useState<FontItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"text" | "adjust" | "fonts">("text");
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [cropAspectRatio, setCropAspectRatio] = useState<"free" | "16:9" | "9:16" | "1:1" | "4:5">("free");

  const [trimDraft, setTrimDraft] = useState({ in: video.trimIn, out: video.trimOut });
  useEffect(() => { setTrimDraft({ in: video.trimIn, out: video.trimOut }); }, [video.id, video.trimIn, video.trimOut]);

  const layers = video.textLayers ?? [];
  const selected = layers.find(l => l.id === selectedId);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
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
          console.error("Failed to generate thumbnail", e);
        }
      }
      const dur = Math.round(el.duration || 30);
      onChangeVideo({
        ...video,
        title: file.name,
        url,
        fileObj: file,
        duration: dur,
        trimIn: 0,
        trimOut: dur,
        status: "ready",
        thumbnailUrl: thumbUrl,
      });
      el.onseeked = null;
      el.onloadedmetadata = null;
    };
    e.target.value = "";
  };

  const update = useCallback((id: string, patch: Partial<TextLayer>) => {
    const currentLayer = layers.find(l => l.id === id);
    const willBeGlobal = patch.isGlobal !== undefined ? patch.isGlobal : currentLayer?.isGlobal;
    
    if (willBeGlobal) {
      onChangeAllVideos(vid => {
        const hasLayer = vid.textLayers.some(l => l.id === id);
        const updatedLayers = hasLayer
          ? vid.textLayers.map(l => l.id === id ? { ...l, ...patch, isGlobal: true } : l)
          : [...vid.textLayers, { ...(currentLayer || DEFAULT_TEXT_LAYER()), ...patch, id, isGlobal: true }];
        return { ...vid, textLayers: updatedLayers };
      });
    } else {
      onChangeVideo({
        ...video,
        textLayers: layers.map(l => l.id === id ? { ...l, ...patch, isGlobal: false } : l)
      });
    }
  }, [video, layers, onChangeVideo, onChangeAllVideos]);

  const addLayer = () => {
    const l = DEFAULT_TEXT_LAYER();
    l.label = `Texto ${layers.length + 1}`;
    l.y = Math.min(88, 10 + layers.length * 22);
    onChangeVideo({ ...video, textLayers: [...layers, l] });
    setSelectedId(l.id);
    setTab("text");
  };

  const removeLayer = (id: string) => {
    const layer = layers.find(l => l.id === id);
    if (layer?.isGlobal) {
      onChangeAllVideos(vid => ({
        ...vid,
        textLayers: vid.textLayers.filter(l => l.id !== id)
      }));
    } else {
      onChangeVideo({ ...video, textLayers: layers.filter(l => l.id !== id) });
    }
    if (selectedId === id) setSelectedId(null);
  };

  const onChangePlacement = useCallback((category: TemplateCategory, patch: Partial<TemplatePlacement>) => {
    onChangeVideo({
      ...video,
      templatePlacements: {
        ...video.templatePlacements,
        [category]: {
          ...video.templatePlacements[category],
          ...patch
        }
      }
    });
  }, [video, onChangeVideo]);

  const moveLayer = (layerId: string, direction: "up" | "down") => {
    const layersList = [
      { id: "border", zIndex: video.templatePlacements.border?.zIndex ?? 50 },
      { id: "headline", zIndex: video.templatePlacements.headline.zIndex ?? 30 },
      { id: "watermark", zIndex: video.templatePlacements.watermark.zIndex ?? 20 },
      { id: "media", zIndex: video.templatePlacements.media?.zIndex ?? 10 },
      ...video.textLayers.map(l => ({ id: `text-${l.id}`, zIndex: l.zIndex ?? 40 })),
    ];
    layersList.sort((a, b) => b.zIndex - a.zIndex);
    const idx = layersList.findIndex(l => l.id === layerId);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= layersList.length) return;
    
    const temp = layersList[idx].zIndex;
    layersList[idx].zIndex = layersList[targetIdx].zIndex;
    layersList[targetIdx].zIndex = temp;
    
    const borderZ = layersList.find(l => l.id === "border")?.zIndex ?? 50;
    const headlineZ = layersList.find(l => l.id === "headline")?.zIndex ?? 30;
    const watermarkZ = layersList.find(l => l.id === "watermark")?.zIndex ?? 20;
    const mediaZ = layersList.find(l => l.id === "media")?.zIndex ?? 10;
    
    const updatedTextLayers = video.textLayers.map(l => {
      const match = layersList.find(x => x.id === `text-${l.id}`);
      return { ...l, zIndex: match ? match.zIndex : (l.zIndex ?? 40) };
    });
    
    onChangeVideo({
      ...video,
      templatePlacements: {
        ...video.templatePlacements,
        border: { ...video.templatePlacements.border, zIndex: borderZ },
        headline: { ...video.templatePlacements.headline, zIndex: headlineZ },
        watermark: { ...video.templatePlacements.watermark, zIndex: watermarkZ },
        media: { ...(video.templatePlacements.media || { x: 0, y: 0, width: 100, rotation: 0, opacity: 1 }), zIndex: mediaZ },
      },
      textLayers: updatedTextLayers,
    });
  };

  const applyLayersOrderToAll = () => {
    const borderZ = video.templatePlacements.border?.zIndex ?? 50;
    const headlineZ = video.templatePlacements.headline.zIndex ?? 30;
    const watermarkZ = video.templatePlacements.watermark.zIndex ?? 20;
    const mediaZ = video.templatePlacements.media?.zIndex ?? 10;
    
    onChangeAllVideos(vid => {
      const updatedTextLayers = vid.textLayers.map(l => {
        const match = video.textLayers.find(x => x.id === l.id);
        return match ? { ...l, zIndex: match.zIndex } : l;
      });
      return {
        ...vid,
        templatePlacements: {
          ...vid.templatePlacements,
          border: { ...vid.templatePlacements.border, zIndex: borderZ },
          headline: { ...vid.templatePlacements.headline, zIndex: headlineZ },
          watermark: { ...vid.templatePlacements.watermark, zIndex: watermarkZ },
          media: { ...(vid.templatePlacements.media || { x: 0, y: 0, width: 100, rotation: 0, opacity: 1 }), zIndex: mediaZ }
        },
        textLayers: updatedTextLayers,
      };
    });
  };

  const duplicateLayer = (l: TextLayer) => {
    const copy = { ...l, id: Math.random().toString(36).slice(2), label: `${l.label} (2)`, y: Math.min(95, l.y + 12) };
    onChangeVideo({ ...video, textLayers: [...layers, copy] });
    setSelectedId(copy.id);
  };

  const applyStyleToAll = () => {
    if (!selected) return;
    onChangeAllVideos(vid => ({
      ...vid,
      textLayers: vid.textLayers.map(l => ({
        ...l,
        fontFamily: selected.fontFamily, fontSize: selected.fontSize, color: selected.color,
        bgColor: selected.bgColor, bgOpacity: selected.bgOpacity, bold: selected.bold,
        italic: selected.italic, align: selected.align,
      })),
    }));
  };

  const uploadFont = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/, "");
    new FontFace(name, `url(${url})`).load().then(f => {
      document.fonts.add(f);
      setCustomFonts(p => [...p, { id: `up-${Date.now()}`, name, family: name, source: "upload", url }]);
    });
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] overflow-hidden">

      {/* Stage */}
      <div className="relative bg-black flex-shrink-0 flex items-center justify-center border-b border-[#1c1c1c] p-3" style={{ height: 320 }}>
        {video.url ? (
          <MediaStage
            url={video.url}
            mediaType="video"
            scale={video.scale}
            cropX={video.cropX}
            cropY={video.cropY}
            flipH={video.flipH}
            aspectRatio={video.aspectRatio}
            cropMask={video.cropMask}
            appliedTemplates={video.templates}
            templatePlacements={video.templatePlacements}
            templates={templates}
            headlineTextOverride={video.headlineTextOverride}
            textLayers={video.textLayers}
            onPan={(x, y) => onChangeVideo({ ...video, cropX: x, cropY: y })}
            onZoom={s => onChangeVideo({ ...video, scale: s })}
            onPlacementChange={(cat, patch) => onChangeVideo({
              ...video,
              templatePlacements: { ...video.templatePlacements, [cat]: { ...video.templatePlacements[cat], ...patch } },
            })}
            onTextLayerPlacementChange={(id, patch) => {
              update(id, patch);
            }}
            heightPx={280}
            activeLayerId={expandedLayer}
            onSelectLayer={setExpandedLayer}
            mediaCrop={video.mediaCrop}
            cropMode={cropMode}
            cropAspectRatio={cropAspectRatio}
            onMediaCropChange={crop => onChangeVideo({ ...video, mediaCrop: crop })}
          >
            <video ref={videoRef} src={video.url} className="w-full h-full object-fill pointer-events-none" loop playsInline />
          </MediaStage>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            className="w-40 h-64 rounded-lg border border-dashed border-[#2a2a2a] hover:border-[#444] flex flex-col items-center justify-center gap-2 text-[#555] hover:text-[#888] transition-colors cursor-pointer">
            <span className="text-xs">Importar vídeo</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />

        {video.url && (
          <div className="absolute pointer-events-none" style={{
            aspectRatio: `${aspectToWH(video.aspectRatio).w} / ${aspectToWH(video.aspectRatio).h}`,
            width: "100%",
            maxWidth: `${280 * (aspectToWH(video.aspectRatio).w / aspectToWH(video.aspectRatio).h)}px`,
            maxHeight: `280px`,
          }}>
            <VideoControlsOverlay videoRef={videoRef} trimIn={video.trimIn} trimOut={video.trimOut} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1c1c1c] flex-shrink-0">
        {(["text","adjust","fonts"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[11px] font-medium transition-colors cursor-pointer ${tab === t ? "text-white border-b border-red-600" : "text-[#444] hover:text-[#777]"}`}>
            {t === "text" ? "Textos" : t === "adjust" ? "Ajustes" : "Fontes"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── TEXT TAB ── */}
        {tab === "text" && (
          <div className="p-3 space-y-2">
            {layers.length === 0 && (
              <div className="py-8 text-center text-[#333] text-xs border border-dashed border-[#1c1c1c] rounded-lg">
                Nenhuma caixa de texto.<br />Clique em + para adicionar.
              </div>
            )}

            {layers.map(layer => (
              <div key={layer.id}>
                <div onClick={() => setSelectedId(layer.id === selectedId ? null : layer.id)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-all group ${layer.id === selectedId ? "border-[#333] bg-[#141414]" : "border-transparent hover:border-[#1c1c1c] hover:bg-[#111]"}`}>
                  <span className="flex-1 text-xs truncate" style={{ fontFamily: layer.fontFamily }}>
                    {layer.text || <span className="text-[#444] italic">{layer.label}</span>}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); duplicateLayer(layer); }} className="p-0.5 text-[#555] hover:text-[#aaa] cursor-pointer"><Copy size={11}/></button>
                    <button onClick={e => { e.stopPropagation(); update(layer.id, { visible: !layer.visible }); }} className="p-0.5 text-[#555] hover:text-[#aaa] cursor-pointer">
                      {layer.visible ? <Eye size={11}/> : <EyeOff size={11}/>}
                    </button>
                    <button onClick={e => { e.stopPropagation(); removeLayer(layer.id); }} className="p-0.5 text-[#555] hover:text-red-400 cursor-pointer"><Trash2 size={11}/></button>
                  </div>
                </div>

                {layer.id === selectedId && (
                  <div className="ml-2 mt-1 mb-2 space-y-3 px-2.5 py-3 bg-[#111] rounded-lg border border-[#1c1c1c]">
                    <input type="text" value={layer.label} onChange={e => update(layer.id, { label: e.target.value })}
                      className="w-full bg-transparent border-b border-[#222] text-[10px] text-[#555] focus:outline-none focus:border-[#444] font-mono pb-0.5" />

                    <textarea rows={3} value={layer.text} onChange={e => update(layer.id, { text: e.target.value })}
                      placeholder="Texto..."
                      className="w-full bg-[#0d0d0d] border border-[#222] rounded-lg px-2.5 py-2 text-xs text-[#e8e8e8] focus:outline-none focus:border-[#444] resize-none" />

                    <div className="flex items-center gap-1.5 py-1">
                      <label className="flex items-center gap-1.5 text-[10px] text-[#888] cursor-pointer select-none">
                        <input type="checkbox" checked={!!layer.isGlobal}
                          onChange={e => update(layer.id, { isGlobal: e.target.checked })}
                          className="rounded border-[#222] bg-[#0d0d0d] text-red-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer" />
                        Aplicar a todos os slots (Global)
                      </label>
                    </div>

                    <div>
                      <label className="text-[10px] text-[#555] block mb-1">Fonte</label>
                      <FontPicker value={layer.fontFamily} customFonts={customFonts} onChange={f => update(layer.id, { fontFamily: f })} />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-[#555] block mb-1">Tamanho: <span className="text-[#888] font-mono">{layer.fontSize}px</span></label>
                        <input type="range" min={10} max={120} value={layer.fontSize} onChange={e => update(layer.id, { fontSize: +e.target.value })}
                          className="w-full accent-red-600" />
                      </div>
                      <div className="flex gap-1 pt-3">
                        <button onClick={() => update(layer.id, { bold: !layer.bold })}
                          className={`w-7 h-7 rounded flex items-center justify-center text-xs cursor-pointer transition-colors ${layer.bold ? "bg-[#2a2a2a] text-white" : "text-[#555] hover:text-[#aaa]"}`}><Bold size={12}/></button>
                        <button onClick={() => update(layer.id, { italic: !layer.italic })}
                          className={`w-7 h-7 rounded flex items-center justify-center text-xs cursor-pointer transition-colors ${layer.italic ? "bg-[#2a2a2a] text-white" : "text-[#555] hover:text-[#aaa]"}`}><Italic size={12}/></button>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      {([["left", <AlignLeft size={12}/>], ["center", <AlignCenter size={12}/>], ["right", <AlignRight size={12}/>]] as const).map(([a, icon]) => (
                        <button key={a} onClick={() => update(layer.id, { align: a as any })}
                          className={`flex-1 py-1.5 rounded flex items-center justify-center cursor-pointer transition-colors ${layer.align === a ? "bg-[#2a2a2a] text-white" : "text-[#555] hover:text-[#aaa] hover:bg-[#161616]"}`}>
                          {icon}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1">Cor do texto</label>
                        <div className="flex items-center gap-1.5 bg-[#0d0d0d] border border-[#222] rounded-lg px-2 h-8">
                          <input type="color" value={layer.color} onChange={e => update(layer.id, { color: e.target.value })} className="w-5 h-5 rounded cursor-pointer bg-transparent border-0" />
                          <span className="text-[10px] font-mono text-[#555]">{layer.color}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-[#555] block mb-1">Fundo <span className="text-[#444]">({Math.round(layer.bgOpacity*100)}%)</span></label>
                        <div className="flex items-center gap-1.5 bg-[#0d0d0d] border border-[#222] rounded-lg px-2 h-8">
                          <input type="color" value={layer.bgColor} onChange={e => update(layer.id, { bgColor: e.target.value })} className="w-5 h-5 rounded cursor-pointer bg-transparent border-0" />
                          <input type="range" min={0} max={1} step={0.05} value={layer.bgOpacity} onChange={e => update(layer.id, { bgOpacity: +e.target.value })} className="flex-1 accent-red-600" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-[#555] block mb-2">Posição</label>
                      <div className="space-y-2">
                        {[
                          { key: "x", label: "X", min: 0, max: 90 },
                          { key: "y", label: "Y", min: 2, max: 95 },
                          { key: "width", label: "Largura", min: 10, max: 100 },
                        ].map(({ key, label, min, max }) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-[10px] text-[#555] w-12">{label} <span className="font-mono text-[#444]">{(layer as any)[key]}%</span></span>
                            <input type="range" min={min} max={max} value={(layer as any)[key]}
                              onChange={e => update(layer.id, { [key]: +e.target.value } as any)}
                              className="flex-1 accent-red-600" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <button onClick={applyStyleToAll}
                      className="w-full py-1.5 border border-[#2a2a2a] hover:border-[#444] text-[#555] hover:text-[#aaa] text-[10px] rounded-lg transition-colors cursor-pointer">
                      Aplicar estilo a todas os vídeos
                    </button>
                  </div>
                )}
              </div>
            ))}

            <button onClick={addLayer}
              className="w-full py-2 rounded-lg border border-dashed border-[#2a2a2a] hover:border-[#444] text-[#555] hover:text-[#888] text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5">
              <Plus size={12}/> Adicionar texto
            </button>
          </div>
        )}

        {/* ── ADJUST TAB ── */}
        {tab === "adjust" && (
          <div className="p-3 space-y-4">
            {video.url && (
              <div className="space-y-2">
                <p className="text-[10px] text-[#555] font-medium uppercase tracking-wide">Cortar (trim)</p>
                <div className="flex items-center gap-2 text-[10px] text-[#666] font-mono">
                  <span>{formatTime(trimDraft.in)}</span>
                  <span className="text-[#333]">→</span>
                  <span>{formatTime(trimDraft.out)}</span>
                  <span className="text-[#333] ml-auto">total: {formatTime(video.duration)}</span>
                </div>
                <input type="range" min={0} max={video.duration} step={0.1} value={trimDraft.in}
                  onChange={e => { const v = Math.min(+e.target.value, trimDraft.out - 0.5); setTrimDraft(p => ({ ...p, in: v })); onChangeVideo({ ...video, trimIn: v }); }}
                  className="w-full accent-red-600" />
                <input type="range" min={0} max={video.duration} step={0.1} value={trimDraft.out}
                  onChange={e => { const v = Math.max(+e.target.value, trimDraft.in + 0.5); setTrimDraft(p => ({ ...p, out: v })); onChangeVideo({ ...video, trimOut: v }); }}
                  className="w-full accent-red-600" />
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[10px] text-[#555] font-medium uppercase tracking-wide">Proporção</p>
              <div className="grid grid-cols-2 gap-1.5">
                {ASPECT_RATIOS.map(r => (
                  <button key={r.value} onClick={() => onChangeVideo({ ...video, aspectRatio: r.value as AspectRatioType, scale: 1, cropX: 0, cropY: 0 })}
                    className={`py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${video.aspectRatio === r.value ? "border-red-600 text-red-400 bg-red-950/20" : "border-[#2a2a2a] text-[#555] hover:border-[#444] hover:text-[#888]"}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] text-[#555] font-medium uppercase tracking-wide">Máscara de corte</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => onChangeVideo({ ...video, cropMask: "default" as CropMaskType })}
                  className={`py-2 rounded-lg border flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer ${video.cropMask === "default" ? "border-red-600 text-red-400 bg-red-950/20" : "border-[#2a2a2a] text-[#555] hover:border-[#444]"}`}>
                  <Square size={12} /> Padrão
                </button>
                <button onClick={() => onChangeVideo({ ...video, cropMask: "circle" as CropMaskType })}
                  className={`py-2 rounded-lg border flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer ${video.cropMask === "circle" ? "border-red-600 text-red-400 bg-red-950/20" : "border-[#2a2a2a] text-[#555] hover:border-[#444]"}`}>
                  <Circle size={12} /> Círculo
                </button>
              </div>
            </div>

            <button onClick={() => onChangeVideo({ ...video, flipH: !video.flipH })}
              className={`w-full py-2 rounded-lg border flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer ${video.flipH ? "border-red-600 text-red-400 bg-red-950/20" : "border-[#2a2a2a] text-[#555] hover:border-[#444] hover:text-[#888]"}`}>
              <FlipHorizontal2 size={13} /> Espelhar horizontalmente
            </button>

            {/* ── SPATIAL CROP SECTION ── */}
            <div className="space-y-2 pt-2 border-t border-[#1c1c1c]">
              <p className="text-[10px] text-[#555] font-medium uppercase tracking-wide">Recortar Mídia (Bordas)</p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCropMode(!cropMode);
                    if (!cropMode) {
                      setExpandedLayer("media");
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg border flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer ${
                    cropMode
                      ? "border-red-600 text-red-450 bg-red-950/20 font-bold"
                      : "border-[#2a2a2a] text-[#555] hover:border-[#444] hover:text-white"
                  }`}
                >
                  {cropMode ? "Concluir Recorte" : "Recortar / Cropar"}
                </button>
                
                <button
                  onClick={() => {
                    onChangeVideo({
                      ...video,
                      mediaCrop: { x: 0, y: 0, width: 100, height: 100 },
                    });
                    setCropAspectRatio("free");
                  }}
                  className="px-3 py-2 rounded-lg border border-[#2a2a2a] text-[#555] hover:border-[#444] hover:text-white text-xs transition-colors cursor-pointer"
                  title="Resetar Recorte"
                >
                  Resetar
                </button>
              </div>

              {cropMode && (
                <div className="space-y-2 p-2 bg-[#111] rounded-lg border border-[#1c1c1c] animate-fade-in">
                  <p className="text-[9px] text-[#555] uppercase font-semibold">Proporção do Recorte</p>
                  <div className="grid grid-cols-3 gap-1">
                    {(["free", "16:9", "9:16", "1:1", "4:5"] as const).map(ratio => {
                      const isActive = cropAspectRatio === ratio;
                      return (
                        <button
                          key={ratio}
                          onClick={() => {
                            setCropAspectRatio(ratio);
                            if (ratio !== "free") {
                              const [rw, rh] = ratio.split(":").map(Number);
                              const targetRatio = rw / rh;
                              const stageRatio = aspectToWH(video.aspectRatio).w / aspectToWH(video.aspectRatio).h;
                              const scaleFactor = targetRatio / stageRatio;
                              let w = 100;
                              let h = 100;
                              if (scaleFactor > 1) {
                                h = 100 / scaleFactor;
                              } else {
                                w = 100 * scaleFactor;
                              }
                              onChangeVideo({
                                ...video,
                                mediaCrop: { x: (100 - w) / 2, y: (100 - h) / 2, width: w, height: h }
                              });
                            }
                          }}
                          className={`py-1 rounded text-[10px] transition-colors cursor-pointer border ${
                            isActive
                              ? "border-red-600 text-red-400 bg-red-950/20"
                              : "border-[#1c1c1c] text-[#555] hover:border-[#333] hover:text-[#aaa]"
                          }`}
                        >
                          {ratio === "free" ? "Livre" : ratio}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── LAYERS MANAGER ── */}
            <div className="space-y-2 pt-2 border-t border-[#1c1c1c]">
              <p className="text-[10px] text-[#555] font-medium uppercase tracking-wide">Gerenciar Camadas</p>
              
              <div className="space-y-1.5">
                {(() => {
                  const allLayers = [
                    {
                      id: "border",
                      name: "Moldura / Borda",
                      active: !!video.templates.border,
                      zIndex: video.templatePlacements.border?.zIndex ?? 50,
                      templateId: video.templates.border,
                      textLayer: undefined,
                    },
                    {
                      id: "headline",
                      name: "Headline",
                      active: !!video.templates.headline,
                      zIndex: video.templatePlacements.headline.zIndex ?? 30,
                      templateId: video.templates.headline,
                      textLayer: undefined,
                    },
                    {
                      id: "watermark",
                      name: "Marca D'água",
                      active: !!video.templates.watermark,
                      zIndex: video.templatePlacements.watermark.zIndex ?? 20,
                      templateId: video.templates.watermark,
                      textLayer: undefined,
                    },
                    {
                      id: "media",
                      name: "Mídia (Vídeo)",
                      active: !!video.url,
                      zIndex: video.templatePlacements.media?.zIndex ?? 10,
                      templateId: null,
                      textLayer: undefined,
                    },
                    {
                      id: "background",
                      name: "Template Estática (Fundo)",
                      active: !!video.templates.background,
                      zIndex: video.templatePlacements.background?.zIndex ?? 5,
                      templateId: video.templates.background,
                      textLayer: undefined,
                    },
                    ...video.textLayers.map(l => ({
                      id: `text-${l.id}`,
                      name: `Texto: ${l.text || l.label}`,
                      active: l.visible,
                      zIndex: l.zIndex ?? 40,
                      templateId: null,
                      textLayer: l,
                    }))
                  ];

                  return allLayers
                    .sort((a, b) => b.zIndex - a.zIndex)
                    .map((layer, idx) => {
                      const isExpanded = expandedLayer === layer.id;
                      const tpl = layer.templateId ? templates.find(t => t.id === layer.templateId) : null;
                      
                      return (
                        <div key={layer.id} className={`rounded-lg border transition-all ${
                          layer.active
                            ? "border-[#2a2a2a] bg-[#111]"
                            : "border-[#1c1c1c] bg-[#0a0a0a] opacity-60"
                        }`}>
                          {/* Layer Header */}
                          <div
                            onClick={() => layer.active && setExpandedLayer(isExpanded ? null : layer.id)}
                            className={`flex items-center justify-between px-3 py-2 ${layer.active ? "cursor-pointer hover:bg-[#161616]" : "cursor-default"}`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${layer.active ? "bg-red-500" : "bg-[#333]"}`} />
                              
                              {/* Mini visual preview */}
                              <div className="w-6 h-6 rounded bg-[#1f1f1f] border border-[#2e2e2e] overflow-hidden flex items-center justify-center flex-shrink-0">
                                {layer.id === "media" ? (
                                  video.thumbnailUrl ? (
                                    <img src={video.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                                  ) : (
                                    <span className="text-[8px] text-[#555] font-mono font-bold">M</span>
                                  )
                                ) : layer.id === "background" ? (
                                  tpl ? (
                                    tpl.templateMediaType === "video" ? (
                                      <div className="w-full h-full bg-[#161616] flex items-center justify-center">
                                        <div className="w-0 h-0 border-y-2 border-y-transparent border-l-4 border-l-[#555] ml-0.5" />
                                      </div>
                                    ) : (
                                      <img src={tpl.dataUrl} className="w-full h-full object-contain" alt="" />
                                    )
                                  ) : (
                                    <span className="text-[8px] text-[#555] font-mono font-bold">BG</span>
                                  )
                                ) : layer.id.startsWith("text-") ? (
                                  <span className="text-[8px] text-white font-mono font-bold uppercase bg-red-900/50 w-full h-full flex items-center justify-center font-extrabold">T</span>
                                ) : tpl ? (
                                  <img src={tpl.dataUrl} className="w-full h-full object-contain" alt="" />
                                ) : (
                                  <span className="text-[8px] text-[#555] font-mono font-bold uppercase">{layer.id.slice(0, 2)}</span>
                                )}
                              </div>

                              <div className="flex flex-col min-w-0">
                                <span className="text-[11px] font-semibold text-[#ccc] leading-none truncate max-w-[120px]">{layer.name}</span>
                                {tpl && <span className="text-[8px] text-[#555] font-mono truncate max-w-[100px] mt-0.5">{tpl.name}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Up/Down buttons for ordering */}
                              {layer.id !== "background" && (
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <button
                                    disabled={idx === 0}
                                    onClick={() => moveLayer(layer.id, "up")}
                                    className="p-1 hover:text-white disabled:opacity-20 text-[#555] hover:bg-[#222] rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                                    title="Mover para Cima"
                                  >
                                    <ArrowUp size={11} />
                                  </button>
                                  <button
                                    disabled={idx === allLayers.length - 1 || allLayers[idx + 1]?.id === "background"}
                                    onClick={() => moveLayer(layer.id, "down")}
                                    className="p-1 hover:text-white disabled:opacity-20 text-[#555] hover:bg-[#222] rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                                    title="Mover para Baixo"
                                  >
                                    <ArrowDown size={11} />
                                  </button>
                                </div>
                              )}
                              <span className="text-[9px] text-[#555] font-mono">z-index: {layer.zIndex}</span>
                              {layer.active && (
                                <ChevronDown size={11} className={`text-[#555] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              )}
                            </div>
                          </div>

                          {/* Layer Body */}
                          {isExpanded && layer.active && (
                            <div className="px-3 pb-3 pt-1 border-t border-[#1c1c1c] space-y-3">
                              {/* 1. Border Layer Controls */}
                              {layer.id === "border" && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Opacidade: <span className="font-mono text-[#888]">{Math.round((video.templatePlacements.border?.opacity ?? 1) * 100)}%</span></span>
                                    <input type="range" min={0} max={1} step={0.05} value={video.templatePlacements.border?.opacity ?? 1}
                                      onChange={e => onChangePlacement("border", { opacity: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Z-Index: <span className="font-mono text-[#888]">{video.templatePlacements.border?.zIndex ?? 50}</span></span>
                                    <input type="range" min={10} max={60} step={1} value={video.templatePlacements.border?.zIndex ?? 50}
                                      onChange={e => onChangePlacement("border", { zIndex: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <button
                                    onClick={() => onApplyTemplateToAll("border", video.templates.border)}
                                    className="w-full py-1.5 bg-[#161616] hover:bg-[#222] border border-[#2a2a2a] text-[#ccc] text-[10px] font-medium rounded-lg transition-colors cursor-pointer"
                                  >
                                    Aplicar Moldura a todos os slots
                                  </button>
                                </div>
                              )}

                              {/* 2. Headline Layer Controls */}
                              {layer.id === "headline" && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Opacidade: <span className="font-mono text-[#888]">{Math.round((video.templatePlacements.headline.opacity ?? 1) * 100)}%</span></span>
                                    <input type="range" min={0} max={1} step={0.05} value={video.templatePlacements.headline.opacity ?? 1}
                                      onChange={e => onChangePlacement("headline", { opacity: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Rotação: <span className="font-mono text-[#888]">{video.templatePlacements.headline.rotation ?? 0}°</span></span>
                                    <input type="range" min={-180} max={180} step={1} value={video.templatePlacements.headline.rotation ?? 0}
                                      onChange={e => onChangePlacement("headline", { rotation: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Largura: <span className="font-mono text-[#888]">{video.templatePlacements.headline.width}%</span></span>
                                    <input type="range" min={5} max={100} step={1} value={video.templatePlacements.headline.width}
                                      onChange={e => onChangePlacement("headline", { width: +e.target.value })}
                                      className="w-32 accent-red-605" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Posição X: <span className="font-mono text-[#888]">{video.templatePlacements.headline.x}%</span></span>
                                    <input type="range" min={0} max={100} step={1} value={video.templatePlacements.headline.x}
                                      onChange={e => onChangePlacement("headline", { x: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Posição Y: <span className="font-mono text-[#888]">{video.templatePlacements.headline.y}%</span></span>
                                    <input type="range" min={0} max={100} step={1} value={video.templatePlacements.headline.y}
                                      onChange={e => onChangePlacement("headline", { y: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Z-Index: <span className="font-mono text-[#888]">{video.templatePlacements.headline.zIndex ?? 30}</span></span>
                                    <input type="range" min={10} max={60} step={1} value={video.templatePlacements.headline.zIndex ?? 30}
                                      onChange={e => onChangePlacement("headline", { zIndex: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <button
                                    onClick={() => onApplyTemplateToAll("headline", video.templates.headline)}
                                    className="w-full py-1.5 bg-[#161616] hover:bg-[#222] border border-[#2a2a2a] text-[#ccc] text-[10px] font-medium rounded-lg transition-colors cursor-pointer"
                                  >
                                    Aplicar Headline a todos os slots
                                  </button>
                                </div>
                              )}

                              {/* 3. Watermark Layer Controls */}
                              {layer.id === "watermark" && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Opacidade: <span className="font-mono text-[#888]">{Math.round((video.templatePlacements.watermark.opacity ?? 1) * 100)}%</span></span>
                                    <input type="range" min={0} max={1} step={0.05} value={video.templatePlacements.watermark.opacity ?? 1}
                                      onChange={e => onChangePlacement("watermark", { opacity: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Rotação: <span className="font-mono text-[#888]">{video.templatePlacements.watermark.rotation ?? 0}°</span></span>
                                    <input type="range" min={-180} max={180} step={1} value={video.templatePlacements.watermark.rotation ?? 0}
                                      onChange={e => onChangePlacement("watermark", { rotation: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Largura: <span className="font-mono text-[#888]">{video.templatePlacements.watermark.width}%</span></span>
                                    <input type="range" min={5} max={100} step={1} value={video.templatePlacements.watermark.width}
                                      onChange={e => onChangePlacement("watermark", { width: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Posição X: <span className="font-mono text-[#888]">{video.templatePlacements.watermark.x}%</span></span>
                                    <input type="range" min={0} max={100} step={1} value={video.templatePlacements.watermark.x}
                                      onChange={e => onChangePlacement("watermark", { x: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Posição Y: <span className="font-mono text-[#888]">{video.templatePlacements.watermark.y}%</span></span>
                                    <input type="range" min={0} max={100} step={1} value={video.templatePlacements.watermark.y}
                                      onChange={e => onChangePlacement("watermark", { y: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Z-Index: <span className="font-mono text-[#888]">{video.templatePlacements.watermark.zIndex ?? 20}</span></span>
                                    <input type="range" min={10} max={60} step={1} value={video.templatePlacements.watermark.zIndex ?? 20}
                                      onChange={e => onChangePlacement("watermark", { zIndex: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <button
                                    onClick={() => onApplyTemplateToAll("watermark", video.templates.watermark)}
                                    className="w-full py-1.5 bg-[#161616] hover:bg-[#222] border border-[#2a2a2a] text-[#ccc] text-[10px] font-medium rounded-lg transition-colors cursor-pointer"
                                  >
                                    Aplicar Marca d'água a todos os slots
                                  </button>
                                </div>
                              )}

                              {/* 4. Media Layer Controls */}
                              {layer.id === "media" && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Zoom: <span className="font-mono text-[#888]">{Math.round(video.scale * 100)}%</span></span>
                                    <input type="range" min={0.3} max={4.0} step={0.05} value={video.scale}
                                      onChange={e => onChangeVideo({ ...video, scale: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Rotação: <span className="font-mono text-[#888]">{video.rotation ?? 0}°</span></span>
                                    <input type="range" min={-180} max={180} step={1} value={video.rotation ?? 0}
                                      onChange={e => onChangeVideo({ ...video, rotation: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Posição X: <span className="font-mono text-[#888]">{Math.round(video.cropX)}px</span></span>
                                    <input type="range" min={-300} max={300} step={1} value={video.cropX}
                                      onChange={e => onChangeVideo({ ...video, cropX: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Posição Y: <span className="font-mono text-[#888]">{Math.round(video.cropY)}px</span></span>
                                    <input type="range" min={-300} max={300} step={1} value={video.cropY}
                                      onChange={e => onChangeVideo({ ...video, cropY: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <button
                                    onClick={onApplyMediaAdjustToAll}
                                    className="w-full py-1.5 bg-[#161616] hover:bg-[#222] border border-[#2a2a2a] text-[#ccc] text-[10px] font-medium rounded-lg transition-colors cursor-pointer"
                                  >
                                    Aplicar Ajustes de Mídia a todos os slots
                                  </button>
                                </div>
                              )}

                              {/* Background Layer Controls */}
                              {layer.id === "background" && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Opacidade: <span className="font-mono text-[#888]">{Math.round((video.templatePlacements.background?.opacity ?? 1) * 100)}%</span></span>
                                    <input type="range" min={0} max={1} step={0.05} value={video.templatePlacements.background?.opacity ?? 1}
                                      onChange={e => onChangePlacement("background", { opacity: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <button
                                    onClick={() => onApplyTemplateToAll("background", video.templates.background)}
                                    className="w-full py-1.5 bg-[#161616] hover:bg-[#222] border border-[#2a2a2a] text-[#ccc] text-[10px] font-medium rounded-lg transition-colors cursor-pointer"
                                  >
                                    Aplicar Fundo Estático a todos os slots
                                  </button>
                                </div>
                              )}

                              {/* 5. Text Layer Controls */}
                              {layer.id.startsWith("text-") && layer.textLayer && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-[#555]">Z-Index: <span className="font-mono text-[#888]">{layer.zIndex}</span></span>
                                    <input type="range" min={10} max={60} step={1} value={layer.zIndex}
                                      onChange={e => update(layer.textLayer!.id, { zIndex: +e.target.value })}
                                      className="w-32 accent-red-600" />
                                  </div>
                                  <div className="flex justify-between items-center bg-[#181818] p-1.5 rounded border border-[#222]">
                                    <span className="text-[10px] text-[#888]">Editar conteúdo na aba de Textos</span>
                                    <button
                                      onClick={() => {
                                        setTab("text");
                                        setSelectedId(layer.textLayer!.id);
                                      }}
                                      className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-[9px] rounded font-semibold cursor-pointer"
                                    >
                                      Editar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                })()}
              </div>
              <button
                onClick={applyLayersOrderToAll}
                className="w-full py-1.5 mt-2 bg-[#161616] hover:bg-[#222] border border-[#2a2a2a] text-[#ccc] text-[10px] font-medium rounded-lg transition-colors cursor-pointer"
              >
                Aplicar Ordem de Camadas a todos os slots
              </button>
            </div>

            <div className="px-2.5 py-2 rounded-lg border border-[#1c1c1c] bg-[#111] text-[10px] text-[#666]">
              Arraste o vídeo na prévia para mover. Use o scroll do mouse para zoom.
            </div>

            <button onClick={() => onChangeVideo({ ...video, scale: 1, cropX: 0, cropY: 0 })}
              className="w-full py-1.5 border border-[#2a2a2a] hover:border-[#444] text-[#555] hover:text-[#888] text-xs rounded-lg transition-colors cursor-pointer">
              Resetar ajustes
            </button>
          </div>
        )}

        {/* ── FONTS TAB ── */}
        {tab === "fonts" && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-[#555]">Fontes custom carregadas</p>
              <button onClick={() => fontInputRef.current?.click()}
                className="flex items-center gap-1 text-[10px] text-[#666] hover:text-[#aaa] border border-[#2a2a2a] hover:border-[#444] px-2 py-1 rounded-lg transition-colors cursor-pointer">
                <Upload size={10}/> Upload
              </button>
              <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={uploadFont} />
            </div>

            {customFonts.length === 0 ? (
              <div className="py-6 text-center text-[#333] text-xs border border-dashed border-[#1c1c1c] rounded-lg">
                Nenhuma fonte. Faça upload de TTF/OTF.
              </div>
            ) : (
              <div className="space-y-1">
                {customFonts.map(f => (
                  <div key={f.id} className="flex items-center gap-2 py-2 px-2.5 rounded-lg border border-[#1c1c1c]">
                    <span className="flex-1 text-sm text-[#ccc]" style={{ fontFamily: f.family }}>{f.name}</span>
                    <button onClick={() => setCustomFonts(p => p.filter(x => x.id !== f.id))} className="text-[#444] hover:text-red-400 cursor-pointer"><Trash2 size={11}/></button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-[#1c1c1c]">
              <p className="text-[10px] text-[#555] mb-2">Google Fonts disponíveis</p>
              <div className="space-y-0.5 max-h-60 overflow-y-auto">
                {GFONTS.map(f => (
                  <div key={f} className="py-1.5 px-2 text-sm text-[#666]" style={{ fontFamily: f }}>{f}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
