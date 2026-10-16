import React from "react";
import { VideoItem, ImageItem } from "../types";
import { Trash2 } from "lucide-react";

interface Props {
  items: (VideoItem | ImageItem)[];
  selectedId: number;
  onSelect: (id: number) => void;
  onClearSlot: (id: number) => void;
  activeTab: "video" | "image";
}

const MediaGridCard = React.memo<{
  item: VideoItem | ImageItem;
  sel: boolean;
  activeTab: "video" | "image";
  onSelect: (id: number) => void;
  onClearSlot: (id: number) => void;
}>(
  ({ item, sel, activeTab, onSelect, onClearSlot }) => {
    const hasMedia = !!item.url;
    const vid = item as VideoItem;
    const isTrimmed = activeTab === "video" && (vid.trimIn > 0 || vid.trimOut < vid.duration);
    const hasTemplate = !!(item.templates.border || item.templates.watermark || item.templates.headline || item.templates.background);
    const hasLayers = activeTab === "image" && !!(item as ImageItem).textLayers?.some(l => l.text);

    return (
      <button
        id={`slot-${item.id}`}
        onClick={() => onSelect(item.id)}
        className={`relative rounded-lg border text-left transition-all cursor-pointer group overflow-hidden ${
          sel
            ? "border-red-600 bg-[#1a1010]"
            : "border-[#1c1c1c] bg-[#0f0f0f] hover:border-[#2a2a2a]"
        }`}
        style={{ aspectRatio: "9/12" }}
      >
        {/* Thumbnail or placeholder */}
        {hasMedia ? (
          <div className="absolute inset-0 overflow-hidden">
            {activeTab === "image" ? (
              <img src={item.url!} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" referrerPolicy="no-referrer" />
            ) : (vid.thumbnailUrl ? (
              <img src={vid.thumbnailUrl} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" />
            ) : (
              <div className="w-full h-full bg-[#161616] flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border border-[#2a2a2a] flex items-center justify-center">
                  <div className="w-0 h-0 border-y-4 border-y-transparent border-l-6 border-l-[#555] ml-0.5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#2a2a2a] text-[10px] font-mono">vazio</div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

        {/* Number badge */}
        <div className={`absolute top-1.5 left-1.5 text-[10px] font-mono font-bold px-1 py-0.5 rounded ${sel ? "bg-red-600 text-white" : "bg-black/70 text-[#666]"}`}>
          {item.id.toString().padStart(2, "0")}
        </div>

        {/* Status badges */}
        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
          {hasTemplate && <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="Template ativo" />}
          {isTrimmed && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" title="Cortado" />}
          {hasLayers && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Texto editado" />}
        </div>

        {/* Lixeirinha — aparece no hover, só se tiver mídia */}
        {hasMedia && (
          <button
            onClick={e => { e.stopPropagation(); onClearSlot(item.id); }}
            className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded bg-black/70 hover:bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10"
            title="Limpar slot"
          >
            <Trash2 size={11} className="text-[#aaa] group-hover:text-white" />
          </button>
        )}

        {/* Bottom info */}
        {hasMedia && (
          <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1.5">
            <p className="text-[9px] text-[#aaa] truncate font-mono leading-none">{item.title}</p>
          </div>
        )}
      </button>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.sel !== nextProps.sel) return false;
    if (prevProps.activeTab !== nextProps.activeTab) return false;
    
    const p = prevProps.item;
    const n = nextProps.item;
    if (p.id !== n.id) return false;
    if (p.title !== n.title) return false;
    if (p.url !== n.url) return false;
    if (p.status !== n.status) return false;
    if (p.templates.border !== n.templates.border) return false;
    if (p.templates.watermark !== n.templates.watermark) return false;
    if (p.templates.headline !== n.templates.headline) return false;
    if (p.templates.background !== n.templates.background) return false;
    
    if (prevProps.activeTab === "video") {
      const pv = p as VideoItem;
      const nv = n as VideoItem;
      if (pv.trimIn !== nv.trimIn || pv.trimOut !== nv.trimOut || pv.thumbnailUrl !== nv.thumbnailUrl) return false;
    } else {
      const pi = p as ImageItem;
      const ni = n as ImageItem;
      if (pi.textLayers?.length !== ni.textLayers?.length) return false;
      const pText = pi.textLayers?.map(l => l.text).join("") ?? "";
      const nText = ni.textLayers?.map(l => l.text).join("") ?? "";
      if (pText !== nText) return false;
    }
    
    return true;
  }
);

export const MediaGrid: React.FC<Props> = ({ items, selectedId, onSelect, onClearSlot, activeTab }) => {
  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
          {items.map(item => {
            const sel = item.id === selectedId;
            return (
              <MediaGridCard
                key={item.id}
                item={item}
                sel={sel}
                activeTab={activeTab}
                onSelect={onSelect}
                onClearSlot={onClearSlot}
              />
            );
          })}
        </div>
      </div>

      <div className="border-t border-[#1c1c1c] px-3 py-2 flex items-center justify-between bg-[#0d0d0d]">
        <span className="text-[10px] text-[#444] font-mono">ctrl + ← →  navegar slots</span>
        <span className="text-[10px] text-[#444]">{activeTab === "video" ? "vídeos" : "imagens"}</span>
      </div>
    </div>
  );
};
