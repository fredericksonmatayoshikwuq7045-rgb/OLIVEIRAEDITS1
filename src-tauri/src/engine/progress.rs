use super::model::Progress;
use std::collections::BTreeMap;

#[derive(Default)]
pub struct ProgressParser { fields: BTreeMap<String,String> }

impl ProgressParser {
    pub fn line(&mut self, line:&str, duration:f64) -> Option<Progress> {
        let (key,value)=line.trim().split_once('=')?;
        self.fields.insert(key.into(),value.into());
        if key!="progress" { return None; }
        let parse=|key:&str|self.fields.get(key).and_then(|v|v.trim_end_matches('x').parse::<f64>().ok()).filter(|v|v.is_finite() && *v>=0.0);
        let seconds=parse("out_time_us").or_else(||parse("out_time_ms")).unwrap_or(0.0)/1_000_000.0;
        let speed=parse("speed").filter(|v|*v>0.0);
        Some(Progress { percent:if value=="end" {100.0}else{(seconds/duration*100.0).clamp(0.0,99.9)},fps:parse("fps"),speed,out_size_bytes:parse("total_size").map(|v|v as u64),eta_seconds:speed.map(|v|(duration-seconds).max(0.0)/v),..Progress::default() })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn real_ffmpeg_progress_and_unknown_values() {
        let mut p=ProgressParser::default();
        for line in ["fps=24.2","speed=2.0x","total_size=8192","out_time_us=2500000"] { assert!(p.line(line,10.0).is_none()); }
        let result=p.line("progress=continue",10.0).unwrap();
        assert_eq!(result.percent,25.0);assert_eq!(result.eta_seconds,Some(3.75));assert_eq!(result.out_size_bytes,Some(8192));
        p.line("speed=N/A",10.0);assert_eq!(p.line("progress=end",10.0).unwrap().speed,None);
    }
}
