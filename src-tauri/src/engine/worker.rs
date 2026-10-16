use super::{arguments,model::*,probe,process,Control,Engine};
use std::{collections::VecDeque,fs,path::PathBuf,sync::{Arc,Mutex,atomic::Ordering},thread,time::{Duration,Instant}};

pub fn consume(engine:Engine,job:&str,queue:Arc<Mutex<VecDeque<ExportItem>>>,control:Arc<Control>){
    loop {
        while control.paused.load(Ordering::SeqCst) && !control.cancelled.load(Ordering::SeqCst){thread::sleep(Duration::from_millis(50));}
        let Some(item)=queue.lock().unwrap().pop_front() else{break};
        if control.cancelled.load(Ordering::SeqCst){engine.update(job,&item.id,|s|s.status="cancelled".into());engine.save();continue;}
        engine.update(job,&item.id,|s|s.status="processing".into());engine.emit("export://item-started",serde_json::json!({"jobId":job,"itemId":item.id}));engine.save();
        let started=Instant::now();
        let result=execute(&engine,job,&item,&control);
        engine.update(job,&item.id,|state|{
            state.duration_ms=Some(started.elapsed().as_millis() as u64);
            match result {
                Ok(Some((path,size,metadata)))=>{state.status="ok".into();state.output_path=path;state.output_size=Some(size);state.metadata=Some(metadata);state.progress.percent=100.0;},
                Ok(None)=>state.status="skipped".into(),
                Err(error)=>{state.status=if control.cancelled.load(Ordering::SeqCst){"cancelled"}else{"error"}.into();state.error=Some(error);},
            }
        });
        let state=engine.states().into_iter().find(|s|s.id==job).unwrap().items.into_iter().find(|s|s.id==item.id).unwrap();
        let mut value=serde_json::to_value(&state).unwrap();value["jobId"]=job.into();value["itemId"]=state.id.clone().into();value["ok"]=(state.status=="ok").into();
        engine.emit("export://item-finished",value);engine.save();
    }
}

struct TempGuard(PathBuf);
impl Drop for TempGuard{fn drop(&mut self){let _=fs::remove_dir_all(&self.0);}}

fn execute(engine:&Engine,job:&str,original:&ExportItem,control:&Arc<Control>)->Result<Option<(String,u64,MetadataReport)>,String>{
    arguments::validate(original)?;
    let info=probe::probe(&original.source_path)?;
    let duration=arguments::duration(original,&info)?;
    let output_parent=std::path::Path::new(&original.output_path).parent().unwrap();
    let free=fs2::available_space(output_parent).map_err(|e|format!("Não foi possível verificar espaço em disco: {e}"))?;
    super::capacity::require_space(free, super::capacity::estimated_bytes(&info, duration))?;
    let Some((output,partial))=arguments::reserve_output(original,job)? else{return Ok(None)};
    let _partial=arguments::PartialGuard(partial.clone());
    let temp=engine.0.cache.join("tmp").join(super::unique_id());fs::create_dir_all(&temp).map_err(|e|e.to_string())?;let _temp=TempGuard(temp.clone());
    let mut item=original.clone();
    super::raster::prepare(&mut item,&temp)?;
    for (n,overlay) in item.overlays.iter_mut().enumerate(){let dest=temp.join(format!("overlay-{n}.png"));fs::copy(&overlay.path,&dest).map_err(|e|e.to_string())?;overlay.path=dest.to_string_lossy().into_owned();}
    let log_dir=engine.0.cache.join("logs").join(job);fs::create_dir_all(&log_dir).map_err(|e|e.to_string())?;
    let log=log_dir.join(format!("{}.log",super::unique_id()));
    engine.update(job,&item.id,|s|s.log_path=Some(log.to_string_lossy().into_owned()));
    let key=format!("{job}/{}",item.id);
    let run=|fallback|->Result<(),String>{
        let args=arguments::build(&item,&info,&partial,fallback)?;
        let emitter=engine.clone();let job=job.to_owned();let id=item.id.clone();
        process::run(&args,&key,duration,&log,&engine.0.children,&control.cancelled,move |mut progress|{
            progress.job_id=job.clone();progress.item_id=id.clone();emitter.update(&job,&id,|s|s.progress=progress.clone());emitter.emit("export://progress",progress);
        })
    };
    if let Err(error)=run(false){
        if (item.preset=="nvenc" || item.encoder.as_deref().is_some_and(|encoder|encoder!="libx264"))&&!control.cancelled.load(Ordering::SeqCst){
            let _=std::fs::OpenOptions::new().append(true).open(&log).and_then(|mut file|{use std::io::Write;writeln!(file,"\nEncoder de hardware indisponível: {error}\nTentando libx264.")});
            engine.emit("export://warning",serde_json::json!({"jobId":job,"itemId":item.id,"message":"Encoder de hardware falhou. Usando libx264."}));run(true)?;
        }else{return Err(error);}
    }
    if control.cancelled.load(Ordering::SeqCst){return Err("Exportação cancelada.".into());}
    let mut exiftool_used=false;
    if item.clean_metadata||item.mode=="metadata" {
        if let Some(binary)=probe::binary("exiftool"){
            let args=vec!["-all=".into(),"-overwrite_original".into(),partial.to_string_lossy().into_owned()];
            if process::run_binary(&binary,&args,&key,1.0,&log,&engine.0.children,&control.cancelled,|_|{}).is_ok(){exiftool_used=true;}
            else if control.cancelled.load(Ordering::SeqCst){return Err("Exportação cancelada.".into());}
            else{engine.emit("export://warning",serde_json::json!({"jobId":job,"itemId":item.id,"message":"ExifTool falhou; o relatório mostra a verificação do FFprobe."}));}
        }
    }
    let after=probe::probe(partial.to_str().ok_or("Caminho inválido.")?)?;
    let metadata=probe::metadata_report(&info,&after,exiftool_used);
    let size=fs::metadata(&partial).map_err(|e|e.to_string())?.len();
    if size==0{return Err("FFmpeg produziu um arquivo vazio.".into());}
    if control.cancelled.load(Ordering::SeqCst){return Err("Exportação cancelada antes de publicar a saída.".into());}
    crate::storage::atomic_replace(&partial,&output).map_err(|e|format!("Não foi possível finalizar a saída: {e}"))?;
    if item.move_original{
        let source=std::path::Path::new(&item.source_path);let backup=source.parent().unwrap().join("oe-originais");
        fs::create_dir_all(&backup).map_err(|e|format!("Saída concluída, mas não foi possível preservar o original em oe-originais: {e}"))?;
        let target=backup.join(format!("{}-{}",super::unique_id(),source.file_name().unwrap().to_string_lossy()));
        fs::rename(source,target).map_err(|e|format!("Saída concluída, mas o original não foi movido: {e}"))?;
    }
    Ok(Some((output.to_string_lossy().into_owned(),size,metadata)))
}
