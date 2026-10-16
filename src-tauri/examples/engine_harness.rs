use app_lib::engine::{model::ExportJob,Engine};
use serde::Deserialize;
use std::{path::PathBuf,sync::Arc,time::{Duration,Instant}};

#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
struct Request{job:ExportJob,cancel_after_ms:Option<u64>,cache_dir:Option<String>}
fn execute()->Result<serde_json::Value,String>{
    let file=std::env::args().nth(1).ok_or("Informe request.json.")?;
    let request:Request=serde_json::from_slice(&std::fs::read(file).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    let cache=request.cache_dir.map(PathBuf::from).unwrap_or_else(||std::env::temp_dir().join(format!("oe-engine-harness-{}",app_lib::engine::unique_id())));
    let engine=Engine::new(cache.clone(),Arc::new(|_,_|{}))?;
    let job=engine.start(request.job)?;let started=Instant::now();let mut cancelled=false;
    loop {
        if !cancelled&&request.cancel_after_ms.is_some_and(|ms|started.elapsed().as_millis()>=ms as u128){let _=engine.cancel(&job);cancelled=true;}
        let state=engine.states().into_iter().find(|s|s.id==job).ok_or("Lote desapareceu.")?;
        if ["completed","cancelled"].contains(&state.status.as_str()) {let mut json=serde_json::to_value(state).map_err(|e|e.to_string())?;json["cacheDir"]=cache.to_string_lossy().into_owned().into();return Ok(json);}
        std::thread::sleep(Duration::from_millis(20));
    }
}
fn main(){match execute(){Ok(result)=>println!("{}",serde_json::to_string_pretty(&result).unwrap()),Err(error)=>{println!("{}",serde_json::json!({"error":error}));std::process::exit(1);}}}
