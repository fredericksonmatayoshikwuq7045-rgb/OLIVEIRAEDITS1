import React, { useState, useRef } from "react";
import { TemplateItem, TemplateGroup, TemplateCategory, AppliedTemplates } from "../types";
import { Folder, Plus, Trash2, Check, Upload, ChevronDown, Settings, X } from "lucide-react";

interface Props {
  activeTab: "video" | "image";
  templates: TemplateItem[];
  groups: TemplateGroup[];
  appliedTemplates: AppliedTemplates;
  onApplyTemplate: (category: TemplateCategory, id: string | null) => void;
  onApplyTemplateToAll: (category: TemplateCategory, id: string | null) => void;
  onMixTemplates: (category: TemplateCategory, ids: string[]) => void;
  onAddGroup: (name: string, type: "video" | "image") => void;
  onAddTemplate: (tpl: Omit<TemplateItem, "id">) => void;
  onRemoveTemplate: (id: string) => void;
  onMoveTemplate: (id: string, groupId: string) => void;
  exportPath: string;
  onChangeExportPath: (p: string) => void;
  onImportFolder: (files: FileList, type: "video" | "image") => void;
  onTriggerExportBatch: () => void;
  onClearAll: () => void;
  totalLoadedVideos: number;
  totalLoadedImages: number;
}

const CATEGORY_LABELS: Record<TemplateCategory, { label: string; sub: string }> = {
  border: { label: "Borda", sub: "Fixa — moldura do vídeo" },
  watermark: { label: "Marca d'água", sub: "Móvel — arrastável" },
  headline: { label: "Headline", sub: "Móvel — PNG de Headline" },
  background: { label: "Template Estática", sub: "Fundo — imagem ou vídeo estático ao fundo" },
};

const GOOGLE_FONTS_QUICK = ["Inter", "Anton", "Bebas Neue", "Oswald", "Poppins", "Montserrat", "Impact"];

export const Sidebar: React.FC<Props> = ({
  activeTab, templates, groups, appliedTemplates,
  onApplyTemplate, onApplyTemplateToAll, onMixTemplates, onAddGroup, onAddTemplate, onRemoveTemplate, onMoveTemplate,
  exportPath, onChangeExportPath, onImportFolder, onTriggerExportBatch, onClearAll,
  totalLoadedVideos, totalLoadedImages,
}) => {
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const tplFileRef = useRef<HTMLInputElement>(null);

  const [selectedGroup, setSelectedGroup] = useState("");
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>("border");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewTpl, setShowNewTpl] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newTplDataUrl, setNewTplDataUrl] = useState("");
  const [newTplMediaType, setNewTplMediaType] = useState<"video" | "image">("image");
  const [newHeadlineText, setNewHeadlineText] = useState("");
  const [newHeadlineFont, setNewHeadlineFont] = useState("Anton");
  const [newHeadlineColor, setNewHeadlineColor] = useState("#ffffff");
  const [openTplId, setOpenTplId] = useState<string | null>(null);
  const [mixMode, setMixMode] = useState(false);
  const [mixSelected, setMixSelected] = useState<string[]>([]);

  const handleSelectDestFolder = async () => {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          directory: true,
          multiple: false,
          defaultPath: exportPath || undefined,
        });
        if (selected && typeof selected === "string") {
          console.log(`[SISTEMA] Pasta de destino nativa selecionada: ${selected}`);
          onChangeExportPath(selected);
        }
      } catch (err) {
        console.error("Erro ao abrir diálogo de diretório do Tauri:", err);
      }
    } else {
      console.warn("Seletor nativo de diretório só está disponível rodando no Tauri.");
      alert("O seletor nativo de diretório só está disponível rodando no aplicativo executável Tauri.");
    }
  };

  const activeGroups = groups.filter(g => g.type === activeTab);
  const curGroup = selectedGroup || activeGroups[0]?.id || "";
  const filteredTpls = templates.filter(t => t.groupId === curGroup && t.type === activeTab && t.category === activeCategory);
  const loaded = activeTab === "video" ? totalLoadedVideos : totalLoadedImages;

  const handleTplFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVid = file.type.startsWith("video/");
    setNewTplMediaType(isVid ? "video" : "image");

    if (isVid) {
      const url = URL.createObjectURL(file);
      setNewTplDataUrl(url);
      if (!newTplName) setNewTplName(file.name.replace(/\.[^.]+$/, ""));
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setNewTplDataUrl(reader.result as string);
        if (!newTplName) setNewTplName(file.name.replace(/\.[^.]+$/, ""));
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const resetNewTplForm = () => {
    setShowNewTpl(false);
    setNewTplDataUrl("");
    setNewTplName("");
    setNewHeadlineText("");
    setNewTplMediaType("image");
  };

  const saveNewTemplate = () => {
    onAddTemplate({
      name: newTplName.trim(),
      dataUrl: newTplDataUrl,
      groupId: curGroup,
      type: activeTab,
      category: activeCategory,
      templateMediaType: newTplMediaType,
    });
    resetNewTplForm();
  };

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-2">
      <p className="text-[10px] font-medium text-[#444] uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );

  return (
    <div className="w-60 flex-shrink-0 bg-[#0d0d0d] border-r border-[#1c1c1c] flex flex-col h-full">

      <div className="px-4 pt-4 pb-3 border-b border-[#1c1c1c]">
        <div className="flex items-center gap-2 mb-3">
          <img src="/00bb.ico" alt="" className="w-5 h-5 object-contain" onError={e => (e.currentTarget.style.display="none")} />
          <span className="text-xs font-semibold text-white">Oliveira Edits</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#444]">{activeTab === "video" ? "vídeos" : "imagens"}</span>
          <span className="text-[10px] font-mono text-[#666]">{loaded} / 100</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Import */}
        <Section label="Importar">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                console.log("[SISTEMA] Botão 'Arquivos' clicado");
                filesRef.current?.click();
              }}
              className="py-2 px-3 rounded-lg border border-dashed border-[#2a2a2a] hover:border-[#444] text-[#666] hover:text-[#aaa] text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Upload size={13} />
              Arquivos
            </button>
            <button
              onClick={() => {
                console.log("[SISTEMA] Botão 'Pasta' clicado");
                folderRef.current?.click();
              }}
              className="py-2 px-3 rounded-lg border border-dashed border-[#2a2a2a] hover:border-[#444] text-[#666] hover:text-[#aaa] text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Folder size={13} />
              Pasta
            </button>
          </div>
          <p className="text-[9px] text-[#383838]">Continua a partir do próximo slot livre — adicionar de novo soma ao que já tem.</p>
          <input ref={filesRef} type="file" className="hidden" multiple accept={activeTab === "video" ? "video/*" : "image/*"}
            onChange={e => {
              console.log("[SISTEMA] Mudança detectada no input de arquivos individuais");
              if (e.target.files && e.target.files.length > 0) {
                console.log(`[SISTEMA] ${e.target.files.length} arquivo(s) selecionado(s)`);
                onImportFolder(e.target.files, activeTab);
              }
              e.target.value = "";
              console.log("[SISTEMA] Input de arquivos individuais limpo");
            }}
          />
          <input ref={folderRef} type="file" className="hidden" multiple
            {...({ webkitdirectory: "", directory: "" } as any)}
            onChange={e => {
              console.log("[SISTEMA] Mudança detectada no input de pasta");
              if (e.target.files && e.target.files.length > 0) {
                console.log(`[SISTEMA] Pasta selecionada contendo ${e.target.files.length} arquivo(s) bruto(s)`);
                onImportFolder(e.target.files, activeTab);
              }
              e.target.value = "";
              console.log("[SISTEMA] Input de pasta limpo");
            }}
          />
        </Section>

        {/* Templates — Grupo primeiro */}
        <Section label="1. Grupo de templates">
          <div className="flex gap-1">
            <div className="relative flex-1">
              <select
                value={curGroup}
                onChange={e => setSelectedGroup(e.target.value)}
                className="w-full appearance-none bg-[#161616] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-[#ccc] focus:outline-none focus:border-[#444] cursor-pointer pr-6"
              >
                {activeGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                {activeGroups.length === 0 && <option value="">Sem grupos</option>}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none" />
            </div>
            <button onClick={() => setShowNewGroup(true)} className="w-7 h-7 rounded-lg border border-[#2a2a2a] hover:border-[#444] flex items-center justify-center text-[#555] hover:text-[#aaa] transition-colors cursor-pointer">
              <Plus size={13} />
            </button>
          </div>
        </Section>

        {/* Tipo de template dentro do grupo */}
        <Section label="2. Tipo de template">
          <div className="grid grid-cols-4 gap-1">
            {(["border", "watermark", "headline", "background"] as TemplateCategory[]).map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`py-2 px-0.5 rounded-lg border text-center transition-colors cursor-pointer ${activeCategory === cat ? "border-red-600 bg-red-950/20" : "border-[#2a2a2a] hover:border-[#444]"}`}>
                <p className={`text-[9px] font-semibold truncate ${activeCategory === cat ? "text-[#ddd]" : "text-[#777]"}`}>{CATEGORY_LABELS[cat].label}</p>
              </button>
            ))}
          </div>
          <p className="text-[9px] text-[#444] px-0.5">{CATEGORY_LABELS[activeCategory].sub}</p>
        </Section>

        {/* Lista de templates do tipo selecionado */}
        <Section label="3. Selecionar template">
          {/* Mix mode toggle */}
          <div className={`flex items-center justify-between px-2.5 py-2 rounded-lg border transition-colors ${mixMode ? "border-red-800 bg-red-950/20" : "border-[#1c1c1c]"}`}>
            <div>
              <p className="text-[11px] text-[#ccc] font-medium">Mesclar</p>
              <p className="text-[9px] text-[#444] mt-0.5">Distribui aleatoriamente entre slots</p>
            </div>
            <button onClick={() => { setMixMode(m => !m); setMixSelected([]); }}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${mixMode ? "bg-red-600" : "bg-[#2a2a2a]"}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${mixMode ? "left-4" : "left-0.5"}`} />
            </button>
          </div>

          {mixMode ? (
            <div className="space-y-1.5 px-1">
              <div className="space-y-1">
                {filteredTpls.map(tpl => {
                  const isSel = mixSelected.includes(tpl.id);
                  return (
                    <button key={tpl.id}
                      onClick={() => setMixSelected(p => isSel ? p.filter(x => x !== tpl.id) : [...p, tpl.id])}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer ${isSel ? "border-red-700 bg-red-950/30 text-[#ccc]" : "border-[#1c1c1c] text-[#555] hover:text-[#888] hover:border-[#2a2a2a]"}`}>
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${isSel ? "border-red-600 bg-red-600" : "border-[#333]"}`}>
                        {isSel && <Check size={9} className="text-white" />}
                      </span>
                      <span className="flex-1 truncate text-left">{tpl.name}</span>
                      {isSel && <span className="text-[9px] font-mono text-[#555]">~{Math.round(100 / mixSelected.length)}%</span>}
                    </button>
                  );
                })}
                {filteredTpls.length === 0 && <p className="text-[10px] text-[#333] italic px-2">Nenhum template neste tipo</p>}
              </div>
              <button
                disabled={mixSelected.length < 2}
                onClick={() => { onMixTemplates(activeCategory, mixSelected); setMixMode(false); setMixSelected([]); }}
                className="w-full py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-[#1c1c1c] disabled:text-[#444] text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer">
                {mixSelected.length < 2 ? `Selecione 2+ (${mixSelected.length})` : `Aplicar mescla (${mixSelected.length})`}
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="relative group/none">
                <button onClick={() => onApplyTemplate(activeCategory, null)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${!appliedTemplates[activeCategory] ? "bg-[#1a1a1a] text-[#ccc]" : "text-[#555] hover:text-[#888] hover:bg-[#141414]"}`}>
                  <span className="w-3.5 h-3.5 rounded border border-[#333] flex items-center justify-center flex-shrink-0">
                    {!appliedTemplates[activeCategory] && <Check size={9} className="text-red-500" />}
                  </span>
                  <span className="flex-1 text-left">Nenhum</span>
                  <button onClick={e => { e.stopPropagation(); onApplyTemplateToAll(activeCategory, null); }}
                    className="opacity-0 group-hover/none:opacity-100 px-1 py-0.5 hover:bg-[#2a2a2a] hover:text-white rounded transition-all cursor-pointer text-[9px] text-[#666]"
                    title="Remover de todos os slots">
                    Limpar todos
                  </button>
                </button>
              </div>

              {filteredTpls.map(tpl => (
                <div key={tpl.id} className="relative">
                  <button onClick={() => { onApplyTemplate(activeCategory, tpl.id); setOpenTplId(null); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer group ${tpl.id === appliedTemplates[activeCategory] ? "bg-[#1a1010] text-[#ccc]" : "text-[#555] hover:text-[#888] hover:bg-[#141414]"}`}>
                    <span className="w-3.5 h-3.5 rounded border border-[#333] flex items-center justify-center flex-shrink-0">
                      {tpl.id === appliedTemplates[activeCategory] && <Check size={9} className="text-red-500" />}
                    </span>
                    <span className="flex-1 truncate text-left">{tpl.name}</span>
                    <button onClick={e => { e.stopPropagation(); setOpenTplId(openTplId === tpl.id ? null : tpl.id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[#ccc] transition-all cursor-pointer">
                      <Settings size={11} />
                    </button>
                  </button>
                  {openTplId === tpl.id && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-[#161616] border border-[#2a2a2a] rounded-lg p-2 z-50 shadow-xl space-y-1.5">
                      <p className="text-[10px] text-[#555] px-1">Mover para grupo:</p>
                      <select onChange={e => { onMoveTemplate(tpl.id, e.target.value); setOpenTplId(null); }}
                        defaultValue={tpl.groupId}
                        className="w-full bg-[#111] border border-[#2a2a2a] rounded px-2 py-1 text-[10px] text-[#aaa] focus:outline-none cursor-pointer">
                        {activeGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      <button onClick={() => { onApplyTemplateToAll(activeCategory, tpl.id); setOpenTplId(null); }}
                        className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-blue-400 hover:bg-blue-950/30 transition-colors cursor-pointer">
                        <Check size={11} /> Aplicar a todos
                      </button>
                      <button onClick={() => { onRemoveTemplate(tpl.id); setOpenTplId(null); }}
                        className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer">
                        <Trash2 size={11} /> Remover
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {filteredTpls.length === 0 && (
                <p className="text-[10px] text-[#333] px-2 py-2 italic">Nenhum template neste tipo</p>
              )}
            </div>
          )}

          <button onClick={() => setShowNewTpl(true)}
            className="w-full py-1.5 px-3 rounded-lg border border-[#2a2a2a] hover:border-[#444] text-[#666] hover:text-[#aaa] text-xs transition-colors cursor-pointer flex items-center gap-1.5">
            <Upload size={12} /> Adicionar {CATEGORY_LABELS[activeCategory].label.toLowerCase()}
          </button>
        </Section>

        {/* Destination */}
        <Section label="Destino">
          <div className="flex gap-1.5">
            <input type="text" value={exportPath} onChange={e => onChangeExportPath(e.target.value)}
              className="flex-1 min-w-0 bg-[#161616] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-[11px] text-[#aaa] font-mono focus:outline-none focus:border-[#444] truncate"
              placeholder="/output/" />
            <button
              onClick={handleSelectDestFolder}
              className="px-2 py-1 bg-[#222] hover:bg-[#333] border border-[#2a2a2a] hover:border-[#444] rounded-lg text-[10px] font-medium text-white transition-colors cursor-pointer flex-shrink-0"
            >
              Selecionar
            </button>
          </div>
        </Section>
      </div>

      {/* Export + Clear */}
      <div className="px-4 py-3 border-t border-[#1c1c1c] flex gap-2">
        <button
          onClick={onClearAll}
          className="w-8 h-9 flex-shrink-0 flex items-center justify-center border border-[#2a2a2a] hover:border-red-800 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer text-[#555] hover:text-red-400"
          title="Limpar tudo"
        >
          <Trash2 size={13} />
        </button>
        <button onClick={onTriggerExportBatch}
          className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer">
          Exportar tudo ({loaded})
        </button>
      </div>

      {/* Modal: new group */}
      {showNewGroup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 w-72 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium">Novo grupo</p>
              <button onClick={() => setShowNewGroup(false)} className="text-[#555] hover:text-[#aaa] cursor-pointer"><X size={15} /></button>
            </div>
            <input autoFocus type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newGroupName.trim()) { onAddGroup(newGroupName.trim(), activeTab); setNewGroupName(""); setShowNewGroup(false); }}}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#ccc] focus:outline-none focus:border-[#444] mb-3"
              placeholder="Nome do grupo" />
            <button onClick={() => { if (newGroupName.trim()) { onAddGroup(newGroupName.trim(), activeTab); setNewGroupName(""); setShowNewGroup(false); }}}
              className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer">
              Criar
            </button>
          </div>
        </div>
      )}

      {/* Modal: new template */}
      {showNewTpl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 w-80 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Novo template — {CATEGORY_LABELS[activeCategory].label}</p>
              <button onClick={resetNewTplForm} className="text-[#555] hover:text-[#aaa] cursor-pointer"><X size={15} /></button>
            </div>
            <div>
              <label className="text-[10px] text-[#555] block mb-1">Nome</label>
              <input type="text" value={newTplName} onChange={e => setNewTplName(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-[#ccc] focus:outline-none focus:border-[#444]"
                placeholder="Ex: Moldura escura" />
            </div>
            <div>
              <label className="text-[10px] text-[#555] block mb-1">
                {activeCategory === "background" ? "Arquivo de Fundo (PNG ou Vídeo)" : "Arquivo PNG (com transparência)"}
              </label>
              <button onClick={() => tplFileRef.current?.click()}
                className={`w-full py-3 rounded-lg border border-dashed text-xs transition-colors cursor-pointer ${newTplDataUrl ? "border-[#444] text-[#aaa]" : "border-[#2a2a2a] text-[#555] hover:border-[#444] hover:text-[#888]"}`}>
                {newTplDataUrl ? `✓ ${newTplMediaType === "video" ? "Vídeo" : "PNG"} carregado` : "Clique para selecionar"}
              </button>
              <input ref={tplFileRef} type="file" accept={activeCategory === "background" ? "image/png,image/jpeg,image/webp,video/*" : "image/png"} className="hidden" onChange={handleTplFile} />
            </div>
            {newTplDataUrl && (
              <div className="bg-[#0a0a0a] rounded-lg p-2 flex items-center justify-center h-24 overflow-hidden">
                {newTplMediaType === "video" ? (
                  <video src={newTplDataUrl} className="max-h-full max-w-full object-contain" autoPlay loop muted playsInline />
                ) : (
                  <img src={newTplDataUrl} className="max-h-full max-w-full object-contain" alt="preview" />
                )}
              </div>
            )}

            <button
              disabled={!newTplName.trim() || !newTplDataUrl}
              onClick={saveNewTemplate}
              className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:bg-[#2a2a2a] disabled:text-[#555] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer">
              Salvar template
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
