use super::{graph::AudioInput, model::{ExportItem,MediaInfo}, probe};
/// All sound uses the composition clock, including silence before/after each clip.
pub fn append(filter:&mut String,item:&ExportItem,info:&MediaInfo,inputs:&[AudioInput],duration:f64)->bool {
    let mut labels=Vec::new();
    let media=item.render.as_ref().map(|spec|&spec.media);
    if info.has_audio && media.is_none_or(|media|media.visible && media.audio.as_deref()!=Some("mute")) {
        let start=media.and_then(|media|media.enable.as_ref()).map_or(0.0,|window|window.start);
        let source_duration=item.trim.as_ref().map_or(info.duration,|trim|trim.duration);
        let span=media.and_then(|media|media.enable.as_ref()).map_or(source_duration/item.speed,|window|window.end-window.start);
        filter.push_str(&format!(";[0:a]atrim=duration={source_duration},asetpts=PTS-STARTPTS,atempo={},atrim=duration={span},adelay={}:all=1,apad,asetpts=N/SR/TB[mainaudio]",item.speed,(start*1000.0).round() as u64));
        labels.push("[mainaudio]".to_owned());
    }
    for (number,input) in inputs.iter().enumerate() {
        if !probe::probe(&input.path).is_ok_and(|info|info.has_audio) { continue; }
        let start=input.enable.as_ref().map_or(0.0,|window|window.start);
        let span=(input.enable.as_ref().map_or(duration,|window|window.end)-start).max(0.0);
        let label=format!("clipaudio{number}");
        filter.push_str(&format!(";[{}:a]atrim=start={},asetpts=PTS-STARTPTS,atrim=duration={span},adelay={}:all=1,apad,asetpts=N/SR/TB[{label}]",input.index,input.offset,(start*1000.0).round() as u64));
        labels.push(format!("[{label}]"));
    }
    if labels.is_empty() {
        if item.silent_audio { filter.push_str(";anullsrc=r=48000:cl=stereo[aout]");return true; }
        return false;
    }
    if labels.len()==1 { filter.push_str(&format!(";{}anull[aout]",labels[0])); }
    else { filter.push_str(&format!(";{}amix=inputs={}:duration=longest:normalize=0,alimiter=limit=0.95:level=0:latency=1[aout]",labels.join(""),labels.len())); }
    true
}
