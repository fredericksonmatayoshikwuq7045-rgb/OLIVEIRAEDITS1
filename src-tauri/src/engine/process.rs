use super::{probe,progress::ProgressParser};
use std::{collections::HashMap, fs::OpenOptions, io::{BufRead,BufReader,Write}, path::Path, process::{Child,Command,Stdio}, sync::{Arc,Mutex,atomic::{AtomicBool,Ordering}}, thread,time::Duration};

pub type Children = Arc<Mutex<HashMap<String,Arc<Mutex<Child>>>> >;

pub fn kill(child:&mut Child) {
    #[cfg(windows)] { let _=Command::new("taskkill").args(["/PID",&child.id().to_string(),"/T","/F"]).stdout(Stdio::null()).stderr(Stdio::null()).status(); }
    #[cfg(unix)] { let _=Command::new("kill").args(["-TERM","--",&format!("-{}",child.id())]).stdout(Stdio::null()).stderr(Stdio::null()).status(); }
    let _=child.kill(); let _=child.wait();
}

pub fn run(args:&[String], key:&str, duration:f64, log:&Path, children:&Children, cancelled:&Arc<AtomicBool>, progress:impl Fn(super::model::Progress)+Send+'static) -> Result<(),String> {
    let binary=probe::binary("ffmpeg").ok_or("FFmpeg não encontrado.")?;
    run_binary(&binary,args,key,duration,log,children,cancelled,progress)
}

pub fn run_binary(binary:&Path,args:&[String],key:&str,duration:f64,log:&Path,children:&Children,cancelled:&Arc<AtomicBool>,progress:impl Fn(super::model::Progress)+Send+'static)->Result<(),String>{
    let mut command=Command::new(binary);
    command.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(unix)] { use std::os::unix::process::CommandExt; command.process_group(0); }
    #[cfg(windows)] { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
    let mut child=command.spawn().map_err(|e|format!("Falha ao iniciar FFmpeg: {e}"))?;
    let stdout=child.stdout.take().ok_or("FFmpeg não abriu progresso.")?;
    let stderr=child.stderr.take().ok_or("FFmpeg não abriu log.")?;
    let child=Arc::new(Mutex::new(child));
    children.lock().unwrap().insert(key.into(),child.clone());
    let log_path=log.to_path_buf();
    let stderr_reader=thread::spawn(move || {
        let mut tail=std::collections::VecDeque::with_capacity(40);
        let mut file=OpenOptions::new().append(true).create(true).open(log_path).ok();
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            if let Some(file)=&mut file { let _=writeln!(file,"{line}"); }
            if tail.len()==40 { tail.pop_front(); } tail.push_back(line);
        }
        tail.into_iter().collect::<Vec<_>>().join("\n")
    });
    let stdout_reader=thread::spawn(move || {
        let mut parser=ProgressParser::default();
        for line in BufReader::new(stdout).lines().map_while(Result::ok) { if let Some(value)=parser.line(&line,duration) { progress(value); } }
    });
    let status=loop {
        if cancelled.load(Ordering::SeqCst) { kill(&mut child.lock().unwrap()); break Err("Exportação cancelada.".to_owned()); }
        match child.lock().unwrap().try_wait() {
            Ok(Some(status))=>break Ok(status),
            Ok(None)=>{},
            Err(e)=>break Err(format!("Não foi possível aguardar FFmpeg: {e}")),
        }
        thread::sleep(Duration::from_millis(25));
    };
    let _=stdout_reader.join();
    let tail=stderr_reader.join().unwrap_or_default();
    children.lock().unwrap().remove(key);
    match status { Ok(status) if status.success()=>Ok(()),Ok(_)=>Err(format!("FFmpeg falhou:\n{tail}")),Err(error)=>Err(error) }
}

pub fn crop_detect(path:&str) -> Result<Option<super::model::Rect>,String> {
    let input=probe::input_path(path)?;
    let ffmpeg=probe::binary("ffmpeg").ok_or("FFmpeg ausente.")?;
    let output=Command::new(ffmpeg).args(["-nostdin","-hide_banner","-i"]).arg(input).args(["-t","10","-vf","cropdetect=24:16:0","-an","-f","null","-"]).output().map_err(|e|e.to_string())?;
    if !output.status.success() { return Err("Não foi possível detectar as barras pretas.".into()); }
    let logs=String::from_utf8_lossy(&output.stderr);
    let result=logs.lines().rev().find_map(|line|line.rsplit_once("crop=").and_then(|(_,crop)| {
        let values:Vec<f64>=crop.split_whitespace().next()?.split(':').filter_map(|part|part.parse().ok()).collect();
        if values.len()==4 { Some(super::model::Rect {width:values[0],height:values[1],x:values[2],y:values[3]}) }else{None}
    }));
    Ok(result)
}
