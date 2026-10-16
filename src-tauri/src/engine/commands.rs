use super::{model::*,Engine,probe,process};
use crate::storage::commands::authorize_path;
use std::{fs,path::Path,time::Duration};
use tauri::{AppHandle,State};

fn authorize_item(app:&AppHandle,item:&mut ExportItem,output_required:bool)->Result<(),String>{
    item.source_path=authorize_path(app,Path::new(&item.source_path))?.to_string_lossy().into_owned();
    let output=Path::new(&item.output_path);
    if output_required{
        let parent=authorize_path(app,output.parent().ok_or("Pasta de saída inválida.")?)?;
        item.output_path=parent.join(output.file_name().ok_or("Nome de saída inválido.")?).to_string_lossy().into_owned();
    }
    if let Some(render)=&mut item.render{
        if let Some(source)=&mut render.background.source{*source=authorize_path(app,Path::new(source))?.to_string_lossy().into_owned();}
        for layer in &mut render.layers{if let Some(source)=&mut layer.source{*source=authorize_path(app,Path::new(source))?.to_string_lossy().into_owned();}}
    }
    for overlay in &mut item.overlays{overlay.path=authorize_path(app,Path::new(&overlay.path))?.to_string_lossy().into_owned();}
    Ok(())
}

#[tauri::command]
pub async fn get_ffmpeg_info()->Result<FfmpegInfo,String>{tauri::async_runtime::spawn_blocking(probe::health).await.map_err(|e|e.to_string())}
#[tauri::command]
pub async fn probe_media(app:AppHandle,path:String)->Result<MediaInfo,String>{
    authorize_path(&app,Path::new(&path))?;
    tauri::async_runtime::spawn_blocking(move||probe::probe(&path)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn start_export(app:AppHandle,engine:State<'_,Engine>,mut job:ExportJob)->Result<String,String>{
    for item in &mut job.items{authorize_item(&app,item,true)?;}
    let engine=engine.inner().clone();tauri::async_runtime::spawn_blocking(move||engine.start(job)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub fn get_queue_state(engine:State<'_,Engine>)->Vec<JobState>{engine.states()}
#[tauri::command]
pub fn cancel_export(engine:State<'_,Engine>,job_id:String)->Result<(),String>{engine.cancel(&job_id)}
#[tauri::command]
pub fn cancel_all(engine:State<'_,Engine>){engine.cancel_all();}
#[tauri::command]
pub fn pause_export(engine:State<'_,Engine>,job_id:String,paused:bool)->Result<(),String>{engine.pause(&job_id,paused)}
#[tauri::command]
pub fn resume_export(app:AppHandle,engine:State<'_,Engine>,job_id:String)->Result<(),String>{
    let mut state=engine.states().into_iter().find(|s|s.id==job_id).ok_or("Lote não encontrado.")?;
    for item in &mut state.request.items{authorize_item(&app,item,true)?;}
    engine.resume(&job_id)
}
#[tauri::command]
pub async fn clean_metadata_only(app:AppHandle,engine:State<'_,Engine>,mut job:ExportJob)->Result<String,String>{
    for item in &mut job.items{item.mode="metadata".into();item.clean_metadata=true;authorize_item(&app,item,true)?;}
    let engine=engine.inner().clone();tauri::async_runtime::spawn_blocking(move||engine.start(job)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn crop_detect(app:AppHandle,path:String)->Result<Option<Rect>,String>{
    authorize_path(&app,Path::new(&path))?;
    tauri::async_runtime::spawn_blocking(move||process::crop_detect(&path)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub fn cache_asset(engine:State<'_,Engine>,name:String,bytes:Vec<u8>)->Result<String,String>{
    if bytes.len()>64*1024*1024||!bytes.starts_with(b"\x89PNG\r\n\x1a\n"){return Err("Overlay precisa ser PNG e ter no máximo 64 MB.".into());}
    if name.len()>255{return Err("Nome de asset muito longo.".into());}
    let directory=engine.0.cache.join("export-assets");fs::create_dir_all(&directory).map_err(|e|e.to_string())?;
    let path=directory.join(format!("{}.png",super::unique_id()));fs::write(&path,bytes).map_err(|e|e.to_string())?;Ok(path.to_string_lossy().into_owned())
}
#[tauri::command]
pub async fn render_preview(app:AppHandle,engine:State<'_,Engine>,mut item:ExportItem,seconds:Option<f64>,frame:Option<bool>)->Result<String,String>{
    authorize_item(&app,&mut item,false)?;
    let engine=engine.inner().clone();
    tauri::async_runtime::spawn_blocking(move||{
        let info=probe::probe(&item.source_path)?;
        let requested=seconds.unwrap_or(3.0);
        if !requested.is_finite()||!(0.01..=5.0).contains(&requested){return Err("A prévia deve ter entre 0,01 e 5 segundos.".into());}
        let start=item.trim.as_ref().map(|t|t.start).unwrap_or(0.0);
        let available=item.trim.as_ref().map(|t|t.duration).unwrap_or((info.duration-start).max(0.1));
        item.trim=Some(Trim{start,duration:(requested*item.speed).min(available)});item.preset="fast".into();item.move_original=false;item.conflict="overwrite".into();
        let directory=engine.0.cache.join("previews");fs::create_dir_all(&directory).map_err(|e|e.to_string())?;
        let path=directory.join(format!("{}.{}",super::unique_id(),if frame.unwrap_or(false){"png"}else{"mp4"}));item.output_path=path.to_string_lossy().into_owned();
        let job_id=engine.start(ExportJob{items:vec![item],concurrency:1,finish_action:"none".into()})?;
        loop{let state=engine.states().into_iter().find(|s|s.id==job_id).ok_or("Prévia não encontrada.")?;if state.status=="completed"||state.status=="cancelled"{let item=&state.items[0];return if item.status=="ok"{Ok(item.output_path.clone())}else{Err(item.error.clone().unwrap_or("Falha ao criar prévia.".into()))};}std::thread::sleep(Duration::from_millis(50));}
    }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub fn open_authorized_path(app:AppHandle,path:String)->Result<(),String>{
    use tauri_plugin_opener::OpenerExt;
    let path=authorize_path(&app,Path::new(&path))?;
    if !path.is_dir(){
        let extension=path.extension().and_then(|e|e.to_str()).unwrap_or("").to_ascii_lowercase();
        if !["log","txt"].contains(&extension.as_str()){return Err("Abra a pasta de saída para visualizar este arquivo.".into());}
    }
    app.opener().open_path(path.to_string_lossy().into_owned(),None::<&str>).map_err(|e|e.to_string())
}
#[tauri::command]
pub async fn confirm_close(app:AppHandle,engine:State<'_,Engine>)->Result<(),String>{
    let engine=engine.inner().clone();
    tauri::async_runtime::spawn_blocking(move||{
        engine.cancel_all(); let deadline=std::time::Instant::now()+Duration::from_secs(10);
        while engine.active(){if std::time::Instant::now()>deadline{return Err("A fila ainda está encerrando. Aguarde e tente sair novamente.".to_owned());}std::thread::sleep(Duration::from_millis(25));}
        engine.save();
        Ok(())
    }).await.map_err(|error|error.to_string())??;
    app.exit(0); Ok(())
}
