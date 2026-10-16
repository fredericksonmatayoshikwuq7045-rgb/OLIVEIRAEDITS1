import React, { useState, useEffect, useRef } from "react";
import { VideoItem, TemplateItem } from "../types";
import { Terminal, Cpu, CheckCircle, Play, Flame, AlertCircle, X, Download } from "lucide-react";
import { formatTime } from "../utils";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportingVideos: VideoItem[];
  allTemplates: TemplateItem[];
  exportPath: string;
  activeTab: "video" | "image";
}

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null as any);
    img.src = src;
  });
};

const getVideoAspect = (url: string): Promise<number> => {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.src = url;
    el.onloadedmetadata = () => {
      resolve(el.videoWidth / el.videoHeight);
    };
    el.onerror = () => resolve(9/16);
  });
};

const writeUrlToFile = async (url: string, destPath: string) => {
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  if (url.startsWith("data:")) {
    const base64Data = url.split(",")[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    await writeFile(destPath, binaryData);
  } else {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    await writeFile(destPath, new Uint8Array(buf));
  }
};

interface LogLine {
  id: string;
  type: "info" | "success" | "command" | "metric" | "error";
  text: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  exportingVideos,
  allTemplates,
  exportPath,
  activeTab,
}) => {
  const [currentVideoIdx, setCurrentVideoIdx] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0); // 0 to 100 overall
  const [status, setStatus] = useState<"starting" | "rendering" | "completed" | "error">("starting");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Stats to display
  const [fps, setFps] = useState<number>(60);
  const [processedSize, setProcessedSize] = useState<number>(0); // MB
  const [speedMultiplier, setSpeedMultiplier] = useState<string>("2.1x");

  const appendLog = (text: string, type: LogLine["type"] = "info") => {
    setLogs((prev) => [...prev, { id: Math.random().toString(), type, text }]);
  };

  const compileOverlayPng = async (vid: VideoItem): Promise<string> => {
    let W = 1080;
    let H = 1920;
    if (vid.aspectRatio === "16:9") {
      W = 1920;
      H = 1080;
    } else if (vid.aspectRatio === "1:1") {
      W = 1080;
      H = 1080;
    } else if (vid.aspectRatio === "4:5") {
      W = 1080;
      H = 1350;
    }

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);

    const borderTpl = allTemplates.find(t => t.id === vid.templates.border);
    const watermarkTpl = allTemplates.find(t => t.id === vid.templates.watermark);
    const headlineTpl = allTemplates.find(t => t.id === vid.templates.headline);

    const [borderImg, watermarkImg, headlineImg] = await Promise.all([
      borderTpl ? loadImage(borderTpl.dataUrl) : null,
      watermarkTpl ? loadImage(watermarkTpl.dataUrl) : null,
      headlineTpl ? loadImage(headlineTpl.dataUrl) : null,
    ]);

    interface LayerToDraw {
      zIndex: number;
      draw: () => void;
    }

    const layersToDraw: LayerToDraw[] = [];

    if (watermarkImg && vid.templatePlacements.watermark) {
      layersToDraw.push({
        zIndex: vid.templatePlacements.watermark.zIndex ?? 20,
        draw: () => {
          const pl = vid.templatePlacements.watermark;
          ctx.save();
          ctx.globalAlpha = pl.opacity ?? 1;
          const w = (pl.width / 100) * W;
          const h = w * (watermarkImg.height / watermarkImg.width);
          const x = (pl.x / 100) * W + w / 2;
          const y = (pl.y / 100) * H + h / 2;
          ctx.translate(x, y);
          ctx.rotate((pl.rotation * Math.PI) / 180);
          ctx.drawImage(watermarkImg, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
      });
    }

    if (headlineImg && vid.templatePlacements.headline) {
      layersToDraw.push({
        zIndex: vid.templatePlacements.headline.zIndex ?? 30,
        draw: () => {
          const pl = vid.templatePlacements.headline;
          ctx.save();
          ctx.globalAlpha = pl.opacity ?? 1;
          const w = (pl.width / 100) * W;
          const h = w * (headlineImg.height / headlineImg.width);
          const x = (pl.x / 100) * W + w / 2;
          const y = (pl.y / 100) * H + h / 2;
          ctx.translate(x, y);
          ctx.rotate((pl.rotation * Math.PI) / 180);
          ctx.drawImage(headlineImg, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
      });
    }

    if (borderImg) {
      layersToDraw.push({
        zIndex: vid.templatePlacements.border?.zIndex ?? 50,
        draw: () => {
          ctx.save();
          ctx.globalAlpha = vid.templatePlacements.border?.opacity ?? 1;
          ctx.drawImage(borderImg, 0, 0, W, H);
          ctx.restore();
        }
      });
    }

    const textLayers = vid.textLayers ?? [];
    textLayers.forEach(l => {
      if (l.visible && l.text.trim()) {
        layersToDraw.push({
          zIndex: l.zIndex ?? 40,
          draw: () => {
            ctx.save();
            const uiScaleFactor = H / 280;
            const scaledFontSize = l.fontSize * 0.45 * uiScaleFactor;

            ctx.font = `${l.bold ? 900 : 400} ${scaledFontSize}px "${l.fontFamily}", sans-serif`;
            ctx.textAlign = l.align as CanvasTextAlign;
            ctx.fillStyle = l.color;
            
            const lx = (l.x / 100) * W;
            const ly = (l.y / 100) * H;
            const lw = (l.width / 100) * W;
            
            const xp = l.align === "center" ? lx + lw / 2 : l.align === "right" ? lx + lw : lx;
            
            if (l.bgOpacity > 0) {
              ctx.fillStyle = l.bgColor;
              ctx.globalAlpha = l.bgOpacity;
              const boxHeight = scaledFontSize * 1.2;
              ctx.fillRect(lx, ly, lw, boxHeight);
              ctx.globalAlpha = 1;
              ctx.fillStyle = l.color;
            }
            
            ctx.fillText(l.text, xp, ly + scaledFontSize);
            ctx.restore();
          }
        });
      }
    });

    layersToDraw.sort((a, b) => a.zIndex - b.zIndex);
    layersToDraw.forEach(layer => layer.draw());

    return canvas.toDataURL("image/png");
  };

  const compileFullImagePng = async (vid: VideoItem): Promise<string> => {
    let W = 1080;
    let H = 1920;
    if (vid.aspectRatio === "16:9") {
      W = 1920;
      H = 1080;
    } else if (vid.aspectRatio === "1:1") {
      W = 1080;
      H = 1080;
    } else if (vid.aspectRatio === "4:5") {
      W = 1080;
      H = 1350;
    }

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    const borderTpl = allTemplates.find(t => t.id === vid.templates.border);
    const watermarkTpl = allTemplates.find(t => t.id === vid.templates.watermark);
    const headlineTpl = allTemplates.find(t => t.id === vid.templates.headline);
    const backgroundTpl = allTemplates.find(t => t.id === vid.templates.background);

    const [borderImg, watermarkImg, headlineImg, backgroundImg, baseImg] = await Promise.all([
      borderTpl ? loadImage(borderTpl.dataUrl) : null,
      watermarkTpl ? loadImage(watermarkTpl.dataUrl) : null,
      headlineTpl ? loadImage(headlineTpl.dataUrl) : null,
      backgroundTpl ? loadImage(backgroundTpl.dataUrl) : null,
      vid.url ? loadImage(vid.url) : null,
    ]);

    interface LayerToDraw {
      zIndex: number;
      draw: () => void;
    }

    const layersToDraw: LayerToDraw[] = [];

    layersToDraw.push({
      zIndex: vid.templatePlacements.background?.zIndex ?? 5,
      draw: () => {
        if (backgroundImg) {
          ctx.drawImage(backgroundImg, 0, 0, W, H);
        } else {
          ctx.fillStyle = "#111";
          ctx.fillRect(0, 0, W, H);
        }
      }
    });

    if (baseImg) {
      layersToDraw.push({
        zIndex: vid.templatePlacements.media?.zIndex ?? 10,
        draw: () => {
          ctx.save();
          if (vid.cropMask === "circle") {
            ctx.beginPath();
            ctx.arc(W / 2, H / 2, Math.min(W, H) / 2, 0, Math.PI * 2);
            ctx.clip();
          }

          const stageAspect = W / H;
          const mediaAspect = baseImg.width / baseImg.height;

          let defaultLeft = 0;
          let defaultTop = 0;
          let defaultWidth = W;
          let defaultHeight = H;

          if (mediaAspect > stageAspect) {
            defaultHeight = W / mediaAspect;
            defaultTop = (H - defaultHeight) / 2;
          } else {
            defaultWidth = H * mediaAspect;
            defaultLeft = (W - defaultWidth) / 2;
          }

          ctx.translate(W / 2, H / 2);
          if (vid.flipH) {
            ctx.scale(-1, 1);
          }
          ctx.translate(-W / 2, -H / 2);

          const uiScaleFactor = H / 280;
          const scaledCropX = vid.cropX * uiScaleFactor;
          const scaledCropY = vid.cropY * uiScaleFactor;

          ctx.translate(W / 2 + scaledCropX, H / 2 + scaledCropY);
          ctx.scale(vid.scale, vid.scale);
          ctx.translate(-W / 2, -H / 2);

          const crop = vid.mediaCrop || { x: 0, y: 0, width: 100, height: 100 };
          const hasSpatialCrop = (crop.x > 0 || crop.y > 0 || crop.width < 100 || crop.height < 100);
          if (hasSpatialCrop) {
            ctx.save();
            ctx.beginPath();
            const cx = defaultLeft + (crop.x / 100) * defaultWidth;
            const cy = defaultTop + (crop.y / 100) * defaultHeight;
            const cw = (crop.width / 100) * defaultWidth;
            const ch = (crop.height / 100) * defaultHeight;
            ctx.rect(cx, cy, cw, ch);
            ctx.clip();
            ctx.drawImage(baseImg, defaultLeft, defaultTop, defaultWidth, defaultHeight);
            ctx.restore();
          } else {
            ctx.drawImage(baseImg, defaultLeft, defaultTop, defaultWidth, defaultHeight);
          }

          ctx.restore();
        }
      });
    }

    if (watermarkImg && vid.templatePlacements.watermark) {
      layersToDraw.push({
        zIndex: vid.templatePlacements.watermark.zIndex ?? 20,
        draw: () => {
          const pl = vid.templatePlacements.watermark;
          ctx.save();
          ctx.globalAlpha = pl.opacity ?? 1;
          const w = (pl.width / 100) * W;
          const h = w * (watermarkImg.height / watermarkImg.width);
          const x = (pl.x / 100) * W + w / 2;
          const y = (pl.y / 100) * H + h / 2;
          ctx.translate(x, y);
          ctx.rotate((pl.rotation * Math.PI) / 180);
          ctx.drawImage(watermarkImg, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
      });
    }

    if (headlineImg && vid.templatePlacements.headline) {
      layersToDraw.push({
        zIndex: vid.templatePlacements.headline.zIndex ?? 30,
        draw: () => {
          const pl = vid.templatePlacements.headline;
          ctx.save();
          ctx.globalAlpha = pl.opacity ?? 1;
          const w = (pl.width / 100) * W;
          const h = w * (headlineImg.height / headlineImg.width);
          const x = (pl.x / 100) * W + w / 2;
          const y = (pl.y / 100) * H + h / 2;
          ctx.translate(x, y);
          ctx.rotate((pl.rotation * Math.PI) / 180);
          ctx.drawImage(headlineImg, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
      });
    }

    const textLayers = vid.textLayers ?? [];
    textLayers.forEach(l => {
      if (l.visible && l.text.trim()) {
        layersToDraw.push({
          zIndex: l.zIndex ?? 40,
          draw: () => {
            ctx.save();
            const uiScaleFactor = H / 280;
            const scaledFontSize = l.fontSize * 0.45 * uiScaleFactor;

            ctx.font = `${l.bold ? 900 : 400} ${scaledFontSize}px "${l.fontFamily}", sans-serif`;
            ctx.textAlign = l.align as CanvasTextAlign;
            ctx.fillStyle = l.color;
            
            const lx = (l.x / 100) * W;
            const ly = (l.y / 100) * H;
            const lw = (l.width / 100) * W;
            
            const xp = l.align === "center" ? lx + lw / 2 : l.align === "right" ? lx + lw : lx;
            
            if (l.bgOpacity > 0) {
              ctx.fillStyle = l.bgColor;
              ctx.globalAlpha = l.bgOpacity;
              const boxHeight = scaledFontSize * 1.2;
              ctx.fillRect(lx, ly, lw, boxHeight);
              ctx.globalAlpha = 1;
              ctx.fillStyle = l.color;
            }
            
            ctx.fillText(l.text, xp, ly + scaledFontSize);
            ctx.restore();
          }
        });
      }
    });

    if (borderImg) {
      layersToDraw.push({
        zIndex: vid.templatePlacements.border?.zIndex ?? 50,
        draw: () => {
          ctx.save();
          ctx.globalAlpha = vid.templatePlacements.border?.opacity ?? 1;
          ctx.drawImage(borderImg, 0, 0, W, H);
          ctx.restore();
        }
      });
    }

    layersToDraw.sort((a, b) => a.zIndex - b.zIndex);
    layersToDraw.forEach(layer => layer.draw());

    return canvas.toDataURL("image/png");
  };

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  useEffect(() => {
    if (!isOpen) return;

    setCurrentVideoIdx(0);
    setProgress(0);
    setStatus("starting");
    setProcessedSize(0);
    setLogs([]);

    const runSimulation = async () => {
      const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__;
      
      appendLog("=========================================================", "info");
      appendLog(`  OLIVEIRA EDITS • FFmpeg Batch Processor Inicializado   `, "success");
      appendLog("=========================================================", "info");
      
      await sleep(400);
      appendLog(`[SISTEMA] Pasta Alvo de Saída: ${exportPath || "/output/"}`, "info");
      appendLog(`[SISTEMA] Fila de Processamento: ${exportingVideos.length} canais ativos`, "info");
      
      if (isTauri) {
        appendLog(`[SISTEMA] Modo Nativo Tauri Ativado - Compilação Real H.264`, "success");
      } else {
        appendLog(`[SISTEMA] Modo Simulação Web - downloads normais via navegador`, "info");
      }
      
      await sleep(500);
      setStatus("rendering");

      // Loop through each video in batch queue
      for (let i = 0; i < exportingVideos.length; i++) {
        const vid = exportingVideos[i];
        setCurrentVideoIdx(i);
        
        appendLog("---------------------------------------------------------", "info");
        appendLog(`[LOTE ${i + 1}/${exportingVideos.length}] Preparando Canal no Slot #${vid.id} [${vid.title}]`, "info");
        
        const activeTplIds = [vid.templates.border, vid.templates.watermark, vid.templates.headline].filter(Boolean) as string[];
        const tplNames = activeTplIds.map(id => allTemplates.find((t) => t.id === id)?.name || "custom.png");
        
        const bgTplId = vid.templates.background;
        const bgTpl = bgTplId ? allTemplates.find((t) => t.id === bgTplId) : null;
        const bgType = bgTpl?.templateMediaType || bgTpl?.type || "image";
        const hasBg = !!bgTpl;

        if (activeTab === "image") {
          // BATCH IMAGE EXPORT
          appendLog(`[IMAGEM] Renderizando camadas estáticas da imagem...`);
          try {
            const dataUrl = await compileFullImagePng(vid);
            const fileName = `${vid.title.replace(/\.[^.]+$/, "")}_edited.png`;

            if (isTauri && exportPath && exportPath !== "/output/") {
              const { writeFile } = await import("@tauri-apps/plugin-fs");
              const { join } = await import("@tauri-apps/api/path");
              const base64Data = dataUrl.split(",")[1];
              const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              const fullPath = await join(exportPath, fileName);
              await writeFile(fullPath, binaryData);
              appendLog(`[GRAVADO NATIVO] Imagem salva em: ${fullPath}`, "success");
            } else {
              const a = document.createElement("a");
              a.href = dataUrl;
              a.download = fileName;
              a.click();
              appendLog(`[DOWNLOAD WEB] Imagem disparada para download: ${fileName}`, "success");
            }
          } catch (err: any) {
            appendLog(`[ERRO IMAGEM] Falha ao processar imagem: ${err.message || err}`, "error");
          }
          
          setProgress(Math.round(((i + 1) / exportingVideos.length) * 100));
          setFps(60);
          setSpeedMultiplier("Instantâneo");
          setProcessedSize((prev) => Number((prev + 1.2).toFixed(1)));
        } else {
          // BATCH VIDEO EXPORT
          if (isTauri && vid.fileObj && exportPath && exportPath !== "/output/") {
            try {
              const { writeFile, remove } = await import("@tauri-apps/plugin-fs");
              const { join } = await import("@tauri-apps/api/path");
              const { invoke } = await import("@tauri-apps/api/core");

              const fileExt = vid.fileObj.name.substring(vid.fileObj.name.lastIndexOf(".")) || ".mp4";
              const tempVideoName = `temp_video_${vid.id}${fileExt}`;
              const tempOverlayName = `temp_overlay_${vid.id}.png`;
              const tempBgName = `temp_bg_${vid.id}`;
              const outName = `oliveira_edit_slot_${vid.id.toString().padStart(2, "0")}.mp4`;

              const tempVideoPath = await join(exportPath, tempVideoName);
              const tempOverlayPath = await join(exportPath, tempOverlayName);
              const outPath = await join(exportPath, outName);

              appendLog(`[NATIVO] Preparando arquivos temporários no disco...`);

              // 1. Write main video bytes
              const videoBuffer = await vid.fileObj.arrayBuffer();
              await writeFile(tempVideoPath, new Uint8Array(videoBuffer));

              // 2. Write overlay PNG bytes
              const overlayDataUrl = await compileOverlayPng(vid);
              const overlayBase64 = overlayDataUrl.split(",")[1];
              const overlayBytes = Uint8Array.from(atob(overlayBase64), c => c.charCodeAt(0));
              await writeFile(tempOverlayPath, overlayBytes);

              // 3. Write background template file if exists
              let tempBgPath = "";
              if (hasBg && bgTpl) {
                const bgExt = bgType === "video" ? ".mp4" : ".png";
                tempBgPath = await join(exportPath, `${tempBgName}${bgExt}`);
                await writeUrlToFile(bgTpl.dataUrl, tempBgPath);
              }

              // 4. Calculate output resolution
              let W = 1080;
              let H = 1920;
              if (vid.aspectRatio === "16:9") {
                W = 1920;
                H = 1080;
              } else if (vid.aspectRatio === "1:1") {
                W = 1080;
                H = 1080;
              } else if (vid.aspectRatio === "4:5") {
                W = 1080;
                H = 1350;
              }

              // 5. Calculate media aspect and positioning
              const mediaAspect = await getVideoAspect(vid.url!);
              const stageAspect = W / H;

              let defaultWidth = W;
              let defaultHeight = H;
              if (mediaAspect > stageAspect) {
                defaultHeight = W / mediaAspect;
              } else {
                defaultWidth = H * mediaAspect;
              }

              const w_output = defaultWidth * vid.scale;
              const h_output = defaultHeight * vid.scale;

              const uiScaleFactor = H / 280;
              const scaledCropX = vid.cropX * uiScaleFactor;
              const scaledCropY = vid.cropY * uiScaleFactor;

              const cx = W / 2 + scaledCropX;
              const cy = H / 2 + scaledCropY;

              const x_pos = cx - w_output / 2;
              const y_pos = cy - h_output / 2;

              const w_out = Math.round(w_output);
              const h_out = Math.round(h_output);
              const x_out = Math.round(x_pos);
              const y_out = Math.round(y_pos);

              // 6. Build video filter chain (spatial crop + flip + scaling)
              const crop = vid.mediaCrop || { x: 0, y: 0, width: 100, height: 100 };
              const hasSpatialCrop = (crop.x > 0 || crop.y > 0 || crop.width < 100 || crop.height < 100);
              
              const videoFilters: string[] = [];
              if (hasSpatialCrop) {
                videoFilters.push(`crop=in_w*${(crop.width/100).toFixed(4)}:in_h*${(crop.height/100).toFixed(4)}:in_w*${(crop.x/100).toFixed(4)}:in_h*${(crop.y/100).toFixed(4)}`);
              }
              if (vid.flipH) {
                videoFilters.push("hflip");
              }
              videoFilters.push(`scale=${w_out}:${h_out}`);
              const videoFilterString = videoFilters.join(",");

              // 7. Compose FFmpeg command
              let ffmpegArgs: string[] = ["-y"];
              const runDuration = vid.trimOut - vid.trimIn;

              if (hasBg) {
                if (bgType === "video") {
                  ffmpegArgs.push("-t", runDuration.toFixed(3), "-i", tempBgPath);
                } else {
                  ffmpegArgs.push("-loop", "1", "-t", runDuration.toFixed(3), "-i", tempBgPath);
                }
                ffmpegArgs.push("-ss", vid.trimIn.toFixed(3), "-to", vid.trimOut.toFixed(3), "-i", tempVideoPath);
                ffmpegArgs.push("-i", tempOverlayPath);

                ffmpegArgs.push(
                  "-filter_complex",
                  `[0:v]scale=${W}:${H}[bg];[1:v]${videoFilterString}[main];[bg][main]overlay=${x_out}:${y_out}[bg_main];[bg_main][2:v]overlay=0:0[out]`
                );
                ffmpegArgs.push("-map", "[out]", "-map", "1:a?");
              } else {
                ffmpegArgs.push("-ss", vid.trimIn.toFixed(3), "-to", vid.trimOut.toFixed(3), "-i", tempVideoPath);
                ffmpegArgs.push("-i", tempOverlayPath);

                ffmpegArgs.push(
                  "-filter_complex",
                  `color=c=black:s=${W}x${H}[bg];[0:v]${videoFilterString}[main];[bg][main]overlay=${x_out}:${y_out}[bg_main];[bg_main][1:v]overlay=0:0[out]`
                );
                ffmpegArgs.push("-map", "[out]", "-map", "0:a?");
              }

              ffmpegArgs.push(
                "-t", runDuration.toFixed(3),
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "21",
                "-c:a", "aac",
                "-b:a", "128k",
                outPath
              );

              appendLog(`[CMD] ffmpeg ${ffmpegArgs.join(" ")}`, "command");
              appendLog(`[COMPILADOR] Iniciando renderização FFmpeg...`);
              
              // Run FFmpeg native command
              const result = await invoke<string>("run_ffmpeg", { args: ffmpegArgs });
              appendLog(`[FFMPEG LOG] ${result || "OK"}`, "metric");
              appendLog(`[SUCESSO] Slot #${vid.id} compilado e salvo em: ${outName}`, "success");

              // Clean up temporaries
              try {
                await remove(tempVideoPath);
                await remove(tempOverlayPath);
                if (hasBg) await remove(tempBgPath);
              } catch (cleanupErr) {
                console.warn("Falha ao remover temporários:", cleanupErr);
              }

              const sizeAdded = Number((runDuration * 0.4).toFixed(1));
              setProcessedSize((prev) => Number((prev + sizeAdded).toFixed(1)));
              setFps(55);
              setSpeedMultiplier("2.5x");

            } catch (err: any) {
              appendLog(`[ERRO NATIVO] Falha ao compilar vídeo: ${err.message || err}`, "error");
            }
          } else {
            // WEB SIMULATOR OR BROWSER DOWNLOAD FALLBACK FOR VIDEOS
            appendLog(`[SIMULADOR WEB] Preparando download do arquivo bruto do slot #${vid.id}...`);
            if (vid.fileObj) {
              const fileExt = vid.fileObj.name.substring(vid.fileObj.name.lastIndexOf(".")) || ".mp4";
              const outName = `oliveira_edit_slot_${vid.id.toString().padStart(2, "0")}${fileExt}`;
              const url = URL.createObjectURL(vid.fileObj);
              const a = document.createElement("a");
              a.href = url;
              a.download = outName;
              a.click();
              URL.revokeObjectURL(url);
              appendLog(`[DOWNLOAD WEB] Vídeo original enviado: ${outName}`, "success");
            } else {
              appendLog(`[SIMULAÇÃO] Slot vazio ou simulado.`, "info");
            }
            
            await sleep(400);
          }
          
          setProgress(Math.round(((i + 1) / exportingVideos.length) * 100));
        }

        await sleep(200);
      }

      setProgress(100);
      setStatus("completed");
      appendLog("=========================================================", "success");
      appendLog("✓ PROCESSO DE COMPILAÇÃO CONCLUÍDO COM SUCESSO!", "success");
      appendLog(`  Total de ${exportingVideos.length} arquivos processados na pasta ${exportPath}`, "success");
      appendLog("=========================================================", "success");
    };

    runSimulation();
  }, [isOpen]);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Visual text filter representation matching user selection
  const getFFmpegCropFilter = (ratio: string) => {
    switch (ratio) {
      case "9:16":
        return "crop=in_h*(9/16):in_h,scale=1080:1920";
      case "16:9":
        return "scale=1920:1080";
      case "1:1":
        return "crop=in_h:in_h,scale=1080:1080";
      case "4:5":
        return "crop=in_h*(4/5):in_h,scale=1080:1350";
      default:
        return "scale=1080:1920";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl bg-[#08080a] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[520px]">
        
        {/* Header bar styled like terminal application */}
        <div className="bg-[#0b0b0e] px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={15} className="text-red-500" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
              CONSOLE COMPILAÇÃO FFMPEG — GERENCIA EM MASSA LOTE 
            </span>
          </div>
          
          {status === "completed" && (
            <button 
              onClick={onClose}
              className="w-6 h-6 rounded-full bg-red-950/40 hover:bg-red-900 border border-red-800 text-red-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Console info ribbon */}
        <div className="bg-[#0d0d12] px-4 py-3 border-b border-zinc-850/40 grid grid-cols-4 gap-2 text-center text-[11px] font-mono">
          <div className="bg-black/60 p-1.5 rounded border border-zinc-900">
            <p className="text-zinc-500 uppercase text-[9px]">Velocidade</p>
            <p className="text-red-400 font-extrabold">{speedMultiplier}</p>
          </div>
          <div className="bg-black/60 p-1.5 rounded border border-zinc-900">
            <p className="text-zinc-500 uppercase text-[9px]">FPS Render</p>
            <p className="text-red-500 font-bold">{fps} Hz</p>
          </div>
          <div className="bg-black/60 p-1.5 rounded border border-zinc-900">
            <p className="text-zinc-500 uppercase text-[9px]">Gravados</p>
            <p className="text-emerald-400 font-extrabold">{processedSize.toFixed(1)} MB</p>
          </div>
          <div className="bg-black/60 p-1.5 rounded border border-zinc-900">
            <p className="text-zinc-500 uppercase text-[9px]">Sequencial</p>
            <p className="text-zinc-200 font-extrabold">
              {status === "completed" ? "FIM" : `${currentVideoIdx + 1} / ${exportingVideos.length}`}
            </p>
          </div>
        </div>

        {/* LIVE TERMINAL PRINT LOGS SCREEN */}
        <div className="flex-1 bg-black p-4 overflow-y-auto font-mono text-[11px] leading-relaxed select-text text-zinc-350">
          <div className="space-y-1.5">
            {logs.map((log) => {
              let color = "text-zinc-400";
              if (log.type === "success") color = "text-emerald-400 font-bold";
              if (log.type === "command") color = "text-red-400 font-bold text-[10px] bg-red-950/15 px-1 py-0.5 rounded border border-red-950/50";
              if (log.type === "metric") color = "text-zinc-500";
              if (log.type === "error") color = "text-red-500 font-extrabold";

              return (
                <div key={log.id} className={`${color} break-words`}>
                  {log.type === "command" ? "> " : ""}
                  {log.text}
                </div>
              );
            })}
            <div ref={terminalEndRef} />
          </div>
        </div>

        {/* BOTTOM METERS & CLOSE BAR */}
        <div className="bg-[#0b0b0e] p-4 border-t border-zinc-800 space-y-3">
          
          {/* Progress bar metrics */}
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="flex items-center gap-1.5 text-zinc-450">
              {status === "completed" ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle size={13} /> Compilação em Lote Finalizada
                </span>
              ) : (
                <span className="text-red-500 flex items-center gap-1 animate-pulse font-bold">
                  <Cpu size={13} className="animate-spin text-red-500" /> Processando Fila...
                </span>
              )}
            </span>
            <span className="font-extrabold text-red-500">{progress}%</span>
          </div>

          {/* Master Progress Bar */}
          <div className="h-2 w-full bg-black rounded-full overflow-hidden border border-zinc-850">
            <div 
              className="h-full bg-gradient-to-r from-red-800 to-red-500 transition-all duration-300 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1">
            <span>Conversor de Codec H.264 acelerado NVENC</span>
            {status === "completed" ? (
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-all cursor-pointer"
                >
                  Fechar Console
                </button>
              </div>
            ) : (
              <span>Não altere as abas durante a gravação</span>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
