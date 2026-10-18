pub mod sampling;
pub mod model;
pub mod probe;
pub mod graph;
pub mod arguments;
pub mod progress;
pub mod media_tools;
pub mod power;
pub mod capacity;
pub mod raster;
pub mod process;
mod worker;
#[cfg(test)] mod tests;
#[cfg(feature="desktop")] pub mod commands;

use model::*;
use serde_json::Value;
use std::{collections::{HashMap,VecDeque},fs,path::PathBuf,sync::{Arc,Mutex,atomic::{AtomicBool,AtomicU64,Ordering}},thread};

pub type Emitter=Arc<dyn Fn(&str,Value)+Send+Sync>;
#[derive(Default)]
pub struct Control { pub cancelled:Arc<AtomicBool>,pub paused:AtomicBool }
pub struct Inner {
    pub cache:PathBuf,
    _instance_lock:std::fs::File,
    pub states:Mutex<Vec<JobState>>,
    pub controls:Mutex<HashMap<String,Arc<Control>>>,
    pub children:process::Children,
    pub emitter:Emitter,
    save_lock:Mutex<()>,
    start_lock:Mutex<()>,
}
#[derive(Clone)]
pub struct Engine(pub Arc<Inner>);
static SERIAL:AtomicU64=AtomicU64::new(0);
pub fn unique_id()->String { format!("{}-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis(),SERIAL.fetch_add(1,Ordering::Relaxed)) }

impl Engine {
    pub fn new(cache:PathBuf,emitter:Emitter)->Result<Self,String> {
        fs::create_dir_all(&cache).map_err(|e|e.to_string())?;
        let instance_lock=std::fs::OpenOptions::new().create(true).truncate(false).read(true).write(true).open(cache.join("engine.lock")).map_err(|error|error.to_string())?;
        fs2::FileExt::try_lock_exclusive(&instance_lock).map_err(|_|"Outra instância do motor está aberta. Feche-a antes de abrir o aplicativo novamente.".to_owned())?;
        let _=fs::remove_dir_all(cache.join("export-assets"));
        let _=fs::remove_dir_all(cache.join("tmp")); fs::create_dir_all(cache.join("tmp")).map_err(|e|e.to_string())?;
        let mut states:Vec<JobState>=match fs::read(cache.join("queue.json")){
            Ok(bytes)=>serde_json::from_slice(&bytes).or_else(|_|fs::read(cache.join("queue.json.bak")).map_err(serde_json::Error::io).and_then(|b|serde_json::from_slice(&b))).map_err(|e|format!("Fila salva inválida. Os arquivos foram preservados para recuperação: {e}"))?,
            Err(e) if e.kind()==std::io::ErrorKind::NotFound=>Vec::new(),
            Err(e)=>return Err(format!("Não foi possível ler a fila salva: {e}")),
        };
        for state in &mut states { state.request.finish_action="none".into(); if ["running","paused"].contains(&state.status.as_str()) { state.status="pending".into(); for item in &mut state.items { if item.status=="processing" { item.status="pending".into(); } } } }
        Ok(Self(Arc::new(Inner {cache,_instance_lock:instance_lock,states:Mutex::new(states),controls:Mutex::new(HashMap::new()),children:Arc::new(Mutex::new(HashMap::new())),emitter,save_lock:Mutex::new(()),start_lock:Mutex::new(())})))
    }
    pub fn states(&self)->Vec<JobState>{self.0.states.lock().unwrap().clone()}
    pub fn active(&self)->bool{!self.0.controls.lock().unwrap().is_empty()}
    pub fn save(&self) {
        let _guard=self.0.save_lock.lock().unwrap();
        let states=self.states();
        if let Ok(bytes)=serde_json::to_vec_pretty(&states) {if let Err(error)=crate::storage::atomic_write(&self.0.cache.join("queue.json"),&bytes,true){log::error!("Falha ao persistir fila: {error}");self.emit("export://warning",serde_json::json!({"message":format!("A fila não pôde ser salva para retomada: {error}")}));}}
    }
    pub fn emit(&self,event:&str,value:impl serde::Serialize){ if let Ok(value)=serde_json::to_value(value){(self.0.emitter)(event,value);} }
    pub fn update(&self,job_id:&str,item_id:&str,update:impl FnOnce(&mut ItemState)) {
        let mut states=self.0.states.lock().unwrap();
        if let Some(item)=states.iter_mut().find(|j|j.id==job_id).and_then(|j|j.items.iter_mut().find(|i|i.id==item_id)){update(item);}
    }
    pub fn start(&self,mut request:ExportJob)->Result<String,String> {
        let _start=self.0.start_lock.lock().unwrap();
        power::validate(&request.finish_action)?;
        if self.active(){return Err("Já existe um lote em execução. Aguarde ou cancele antes de iniciar outro.".into());}
        if request.items.is_empty() || request.items.len()>10000{return Err("O lote precisa conter de 1 a 10.000 arquivos.".into());}
        if !(1..=3).contains(&request.concurrency){return Err("Concorrência precisa ser 1, 2 ou 3.".into());}
        capacity::preflight(&request)?;
        if !probe::health().available{return Err("FFmpeg/FFprobe indisponíveis. Consulte a verificação nas configurações.".into());}
        let id=unique_id();
        let mut seen=std::collections::HashSet::new();
        for item in &request.items {if !seen.insert(item.id.clone()){return Err("IDs de mídia duplicados no lote.".into());}}
        let asset_dir=self.0.cache.join("queue-assets").join(&id);
        for (index,item) in request.items.iter_mut().enumerate(){for (n,overlay) in item.overlays.iter_mut().enumerate(){
            let source=probe::input_path(&overlay.path)?;
            fs::create_dir_all(&asset_dir).map_err(|e|e.to_string())?;
            let dest=asset_dir.join(format!("{index}-{n}.png"));fs::copy(&source,&dest).map_err(|e|format!("Não foi possível preparar overlay: {e}"))?;
            if source.starts_with(self.0.cache.join("export-assets")){let _=fs::remove_file(source);}
            overlay.path=dest.to_string_lossy().into_owned();
        }}
        let warnings=probe::health().warnings;
        let state=JobState{id:id.clone(),status:"pending".into(),concurrency:request.concurrency,items:request.items.iter().map(|item|ItemState{id:item.id.clone(),source_path:item.source_path.clone(),output_path:item.output_path.clone(),status:"pending".into(),progress:Progress{job_id:id.clone(),item_id:item.id.clone(),..Progress::default()},error:None,log_path:None,duration_ms:None,output_size:None,metadata:None}).collect(),warnings,request};
        self.0.states.lock().unwrap().push(state);self.save();self.launch(&id)?;Ok(id)
    }
    fn launch(&self,id:&str)->Result<(),String>{
        let control=Arc::new(Control::default());
        let request={let mut states=self.0.states.lock().unwrap();let state=states.iter_mut().find(|j|j.id==id).ok_or("Lote não encontrado.")?;state.status="running".into();
            let pending:Vec<String>=state.items.iter().filter(|i|i.status!="ok"&&i.status!="skipped").map(|i|i.id.clone()).collect();
            for item in &mut state.items{if pending.contains(&item.id){item.status="pending".into();item.error=None;}}
            let mut request=state.request.clone();request.items.retain(|i|pending.contains(&i.id));request};
        self.0.controls.lock().unwrap().insert(id.into(),control.clone());self.save();
        let engine=self.clone();let job=id.to_owned();
        thread::spawn(move||{
            let queue=Arc::new(Mutex::new(VecDeque::from(request.items)));
            let mut workers=Vec::new();
            for _ in 0..request.concurrency{let engine=engine.clone();let queue=queue.clone();let control=control.clone();let job=job.clone();workers.push(thread::spawn(move||worker::consume(engine,&job,queue,control)));}
            for worker in workers{let _=worker.join();}
            let summary={let mut states=engine.0.states.lock().unwrap();let state=states.iter_mut().find(|j|j.id==job).unwrap();state.status=if control.cancelled.load(Ordering::SeqCst){"cancelled"}else{"completed"}.into();
                serde_json::json!({"jobId":job,"total":state.items.len(),"ok":state.items.iter().filter(|i|i.status=="ok").count(),"failed":state.items.iter().filter(|i|i.status=="error").count(),"cancelled":state.items.iter().filter(|i|i.status=="cancelled").count(),"skipped":state.items.iter().filter(|i|i.status=="skipped").count()})};
            let all_done=engine.states().into_iter().find(|state|state.id==job).is_some_and(|state|state.items.iter().all(|item|item.status=="ok"||item.status=="skipped"));
            if all_done { let _=fs::remove_dir_all(engine.0.cache.join("queue-assets").join(&job)); }
            engine.0.controls.lock().unwrap().remove(&job);engine.save();
            let complete_ok=summary["ok"].as_u64().unwrap_or(0)>0 && summary["failed"]==0 && summary["cancelled"]==0;
            engine.emit("export://queue-finished",summary);
            if complete_ok { if let Some(state)=engine.states().into_iter().find(|state|state.id==job) {
                if let Err(error)=power::schedule(&state.request.finish_action) { engine.emit("export://warning",serde_json::json!({"jobId":job,"message":error})); }
            }}
        });Ok(())
    }
    pub fn cancel(&self,id:&str)->Result<(),String>{
        let controls=self.0.controls.lock().unwrap();let control=controls.get(id).ok_or("Lote não está em execução.")?;control.cancelled.store(true,Ordering::SeqCst);
        for (key,child) in self.0.children.lock().unwrap().iter(){if key.starts_with(&format!("{id}/")){process::kill(&mut child.lock().unwrap());}}
        Ok(())
    }
    pub fn cancel_all(&self){let ids:Vec<String>=self.0.controls.lock().unwrap().keys().cloned().collect();for id in ids{let _=self.cancel(&id);}}
    pub fn pause(&self,id:&str,paused:bool)->Result<(),String>{
        let controls=self.0.controls.lock().unwrap();let c=controls.get(id).ok_or("Lote não está em execução.")?;c.paused.store(paused,Ordering::SeqCst);
        if let Some(state)=self.0.states.lock().unwrap().iter_mut().find(|s|s.id==id){state.status=if paused{"paused"}else{"running"}.into();} self.save();Ok(())
    }
    pub fn resume(&self,id:&str)->Result<(),String>{let _start=self.0.start_lock.lock().unwrap();if self.active(){return Err("Já existe um lote ativo.".into());}self.launch(id)}
}
