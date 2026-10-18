use super::{probe,process::background_command};
use serde::Serialize;
use std::{collections::hash_map::DefaultHasher,fs,hash::{Hash,Hasher},path::Path};
#[derive(Serialize)]
pub struct Frame { time:f64, path:String }
pub fn sample(source:&str,times:Vec<f64>,cache:&Path,width:u32)->Result<Vec<Frame>,String>{
    if !(160..=1920).contains(&width){return Err("Largura de amostra inválida.".into());}
    if times.is_empty()||times.len()>12||times.iter().any(|time|!time.is_finite()||*time<0.0||*time>86400.0){return Err("Solicite entre 1 e 12 quadros com tempos válidos.".into());}
    let input=probe::input_path(source)?;let info=probe::probe(source)?;
    let metadata=fs::metadata(&input).map_err(|e|e.to_string())?;
    let mut key=DefaultHasher::new();input.hash(&mut key);metadata.len().hash(&mut key);metadata.modified().ok().hash(&mut key);
    let directory=cache.join("thumbnails").join(format!("frames-{:x}",key.finish()));fs::create_dir_all(&directory).map_err(|e|e.to_string())?;
    let binary=probe::binary("ffmpeg").ok_or("FFmpeg indisponível.")?;
    let mut frames=Vec::new();
    for time in times {
        let time=if info.is_image{0.0}else{time.min((info.duration-0.001).max(0.0))};
        let output=directory.join(format!("{}-{}.png",width,(time*1000.0).round() as u64));
        if !output.is_file(){
            let partial=directory.join(format!("{}-{}.part.png",width,super::unique_id()));
            let result=background_command(&binary).args(["-nostdin","-hide_banner","-loglevel","error","-y","-ss",&time.to_string(),"-i"]).arg(&input).args(["-vf",&format!("scale={width}:1920:force_original_aspect_ratio=decrease"),"-frames:v","1","-threads","1"]).arg(&partial).output().map_err(|e|e.to_string())?;
            if !result.status.success(){let _=fs::remove_file(&partial);return Err(format!("Não foi possível ler o quadro: {}",String::from_utf8_lossy(&result.stderr)));}
            if let Err(error)=fs::rename(&partial,&output){let _=fs::remove_file(&partial);if !output.is_file(){return Err(error.to_string());}}
        }
        frames.push(Frame{time,path:output.to_string_lossy().into_owned()});
    }
    Ok(frames)
}
#[cfg(feature="desktop")]
#[tauri::command]
pub async fn sample_media_frames(app:tauri::AppHandle,engine:tauri::State<'_,super::Engine>,path:String,times:Vec<f64>,width:Option<u32>)->Result<Vec<Frame>,String>{
    let source=crate::storage::commands::authorize_path(&app,Path::new(&path))?;let cache=engine.0.cache.clone();
    tauri::async_runtime::spawn_blocking(move||sample(&source.to_string_lossy(),times,&cache,width.unwrap_or(480))).await.map_err(|e|e.to_string())?
}
#[cfg(test)]
mod tests{
    use super::*;
    #[test]fn rejects_unbounded_or_invalid_samples_before_opening_any_file(){for times in [vec![],vec![0.0;13],vec![-1.0],vec![f64::NAN],vec![90000.0]]{assert!(sample("missing",times,Path::new("unused"),480).is_err());}}
}
