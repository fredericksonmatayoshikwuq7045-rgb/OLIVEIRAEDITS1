use super::{graph, model::{ExportItem, MediaInfo}, probe};
use std::{fs::{self, OpenOptions}, path::{Path,PathBuf}};

pub fn validate(item: &ExportItem) -> Result<(),String> {
    probe::input_path(&item.source_path)?;
    if item.id.is_empty() || item.id.len() > 128 || item.id.contains('\0') { return Err("Identificador de item inválido.".into()); }
    if !["render","metadata"].contains(&item.mode.as_str()) || !["fast","standard","high","nvenc"].contains(&item.preset.as_str()) || !["overwrite","skip","suffix"].contains(&item.conflict.as_str()) { return Err("Opção de exportação não reconhecida.".into()); }
    if item.encoder.as_ref().is_some_and(|value| !["libx264", "h264_nvenc", "h264_qsv", "h264_amf"].contains(&value.as_str())) { return Err("Encoder não permitido.".into()); }
    if !item.speed.is_finite() || !(0.5..=2.0).contains(&item.speed) || item.fps.is_some_and(|fps|!fps.is_finite() || !(1.0..=120.0).contains(&fps)) { return Err("Velocidade precisa estar entre 0,5× e 2×; FPS entre 1 e 120.".into()); }
    if let Some(trim) = &item.trim { if !trim.start.is_finite() || !trim.duration.is_finite() || trim.start < 0.0 || trim.duration <= 0.0 { return Err("Trim precisa de início não negativo e duração positiva.".into()); } }
    if item.mode == "render" { graph::validate_render(item.render.as_ref().ok_or("Modelo de renderização ausente.")?)?; }
    let path = Path::new(&item.output_path);
    if !path.is_absolute() || item.output_path.contains('\0') { return Err("Escolha uma pasta de saída por caminho absoluto.".into()); }
    let extension = path.extension().and_then(|s|s.to_str()).unwrap_or("").to_lowercase();
    if !["mp4","mov","mkv","webm","png","jpg","jpeg","webp"].contains(&extension.as_str()) { return Err("Formato de saída não suportado.".into()); }
    if item.mode == "render" && !["mp4","png","jpg","jpeg","webp"].contains(&extension.as_str()) { return Err("Renderização usa MP4, PNG, JPG ou WebP.".into()); }
    let parent = path.parent().ok_or("Pasta de saída inválida.")?;
    if !parent.is_dir() { return Err("Pasta de saída não existe. Selecione outra pasta.".into()); }
    if path.exists() && path.canonicalize().ok() == Path::new(&item.source_path).canonicalize().ok() { return Err("A saída não pode substituir a mídia original.".into()); }
    Ok(())
}

pub fn reserve_output(item: &ExportItem, job_id: &str) -> Result<Option<(PathBuf,PathBuf)>,String> {
    let original = PathBuf::from(&item.output_path);
    let mut output = original.clone();
    if output.exists() {
        if item.conflict == "skip" { return Ok(None); }
        if item.conflict == "suffix" {
            let parent=original.parent().unwrap(); let stem=original.file_stem().unwrap().to_string_lossy(); let ext=original.extension().unwrap().to_string_lossy();
            let mut number=2;
            while output.exists() { output=parent.join(format!("{stem}_{number}.{ext}")); number+=1; if number>100000 { return Err("Muitos arquivos com o mesmo nome.".into()); } }
        }
    }
    let partial = output.with_file_name(format!("{}.{}.part",output.file_name().unwrap().to_string_lossy(),job_id));
    OpenOptions::new().write(true).create_new(true).open(&partial).map_err(|e|format!("Não foi possível gravar na pasta de saída: {e}"))?;
    Ok(Some((output,partial)))
}

pub fn duration(item: &ExportItem, info: &MediaInfo) -> Result<f64,String> {
    if info.is_image { return Ok(item.trim.as_ref().map(|t|t.duration).unwrap_or(1.0)); }
    let (start,duration)=item.trim.as_ref().map(|t|(t.start,t.duration)).unwrap_or((0.0,info.duration));
    if duration<=0.0 || start>=info.duration || start+duration>info.duration+0.15 { return Err("O trim está fora da duração real do arquivo.".into()); }
    Ok(duration/item.speed)
}

pub fn build(item:&ExportItem, info:&MediaInfo, partial:&Path, fallback:bool) -> Result<Vec<String>,String> {
    let duration=duration(item,info)?;
    let output_image=probe::is_image(Path::new(&item.output_path));
    let metadata_only=item.mode=="metadata";
    let mut args=vec!["-nostdin".into(),"-hide_banner".into(),"-y".into(),"-progress".into(),"pipe:1".into(),"-nostats".into(),"-threads".into(),"2".into(),"-filter_complex_threads".into(),"1".into()];
    if let Some(trim)=&item.trim { if !metadata_only { args.extend(["-ss".into(),trim.start.to_string()]); } }
    if info.is_image && !metadata_only { args.extend(["-loop".into(),"1".into()]); }
    args.extend(["-i".into(),item.source_path.clone()]);
    if metadata_only && !item.deep_clean && !info.is_image {
        args.extend(["-map".into(),"0:v:0".into(),"-map".into(),"0:a?".into(),"-c".into(),"copy".into()]);
    } else if metadata_only {
        args.extend(["-map".into(),"0:v:0".into(),"-map".into(),"0:a?".into()]);
    } else {
        let graph=graph::build(item,info,duration)?;
        args.extend(graph.inputs);
        let mut filter=graph.filter;
        if !output_image {
            if let Some(background)=graph.background_audio {
                let bg_has_audio=item.render.as_ref().and_then(|r|r.background.source.as_ref()).and_then(|p|probe::probe(p).ok()).is_some_and(|p|p.has_audio);
                if bg_has_audio {
                    if info.has_audio { filter.push_str(&format!(";[0:a]asetpts=PTS-STARTPTS,atempo={}[mainaudio];[{background}:a]asetpts=PTS-STARTPTS[bgaudio];[mainaudio][bgaudio]amix=inputs=2:duration=longest:normalize=1[aout]",item.speed)); }
                    else { filter.push_str(&format!(";[{background}:a]asetpts=PTS-STARTPTS[aout]")); }
                    args.extend(["-map".into(),"[aout]".into()]);
                } else if info.has_audio { args.extend(["-map".into(),"0:a:0".into(),"-af".into(),format!("asetpts=PTS-STARTPTS,atempo={}",item.speed)]); }
            } else if info.has_audio { args.extend(["-map".into(),"0:a:0".into(),"-af".into(),format!("asetpts=PTS-STARTPTS,atempo={}",item.speed)]); }
            else if item.silent_audio { filter.push_str(";anullsrc=r=48000:cl=stereo[aout]"); args.extend(["-map".into(),"[aout]".into()]); }
        }
        args.extend(["-filter_complex".into(),filter,"-map".into(),"[outv]".into()]);
    }
    if item.clean_metadata || metadata_only { metadata_args(&mut args); }
    if output_image {
        let ext=Path::new(&item.output_path).extension().unwrap().to_str().unwrap().to_lowercase();
        args.extend(["-frames:v".into(),"1".into(),"-an".into(),"-c:v".into(),match ext.as_str(){"png"=>"png","webp"=>"libwebp",_=>"mjpeg"}.into()]);
        args.extend(["-f".into(),"image2".into()]);
    } else {
        if !metadata_only || item.deep_clean {
            let encoder=if fallback {"libx264"} else if item.preset=="nvenc" {"h264_nvenc"} else {item.encoder.as_deref().unwrap_or("libx264")};
            args.extend(["-c:v".into(),encoder.into()]);
            if encoder=="h264_nvenc" { args.extend(["-preset".into(),"p5".into(),"-cq".into(),"21".into()]); }
            else if encoder=="h264_qsv" { args.extend(["-preset".into(),"medium".into(),"-global_quality".into(),"21".into()]); }
            else if encoder=="h264_amf" { args.extend(["-quality".into(),"balanced".into(),"-rc".into(),"cqp".into(),"-qp_i".into(),"21".into(),"-qp_p".into(),"21".into()]); }
            else { let (crf,preset)=match item.preset.as_str(){"fast"=>("23","veryfast"),"high"=>("18","medium"),_=>("21","fast")}; args.extend(["-crf".into(),crf.into(),"-preset".into(),preset.into(),"-x264-params".into(),"colorprim=bt709:transfer=bt709:colormatrix=bt709".into()]); }
            args.extend(["-pix_fmt".into(),"yuv420p".into(),"-c:a".into(),"aac".into(),"-b:a".into(),"128k".into(),"-ar".into(),"48000".into(),"-colorspace".into(),"bt709".into(),"-color_primaries".into(),"bt709".into(),"-color_trc".into(),"bt709".into()]);
            if let Some(fps)=item.fps { args.extend(["-r".into(),fps.to_string(),"-fps_mode".into(),"cfr".into()]); }
        }
        if !metadata_only { args.extend(["-t".into(),duration.to_string()]); }
        let ext=Path::new(&item.output_path).extension().unwrap().to_str().unwrap().to_lowercase();
        let format=match ext.as_str(){"mkv"=>"matroska","webm"=>"webm","mov"=>"mov",_=>"mp4"};
        if format=="mp4" || format=="mov" { args.extend(["-movflags".into(),"+faststart".into()]); }
        args.extend(["-f".into(),format.into()]);
    }
    args.push(partial.to_string_lossy().into_owned());
    Ok(args)
}

fn metadata_args(args:&mut Vec<String>) {
    args.extend(["-map_metadata","-1","-map_chapters","-1","-fflags","+bitexact","-flags:v","+bitexact","-flags:a","+bitexact"].map(str::to_owned));
    for scope in ["-metadata","-metadata:s:v:0","-metadata:s:a:0"] { for tag in ["encoder","creation_time","handler_name","comment","title","location","location-eng","make","model","com.apple.quicktime.location.ISO6709"] { args.extend([scope.into(),format!("{tag}=")]); } }
}

pub struct PartialGuard(pub PathBuf);
impl Drop for PartialGuard { fn drop(&mut self){ let _=fs::remove_file(&self.0); } }
