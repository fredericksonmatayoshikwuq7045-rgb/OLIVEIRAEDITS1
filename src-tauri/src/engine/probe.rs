use super::{model::{FfmpegInfo, MediaInfo, MetadataReport}, process::background_command};
use serde_json::Value;
use std::{collections::BTreeMap, path::{Path, PathBuf}};

pub fn binary(name: &str) -> Option<PathBuf> {
    let executable = if cfg!(windows) { format!("{name}.exe") } else { name.into() };
    let mut candidates = Vec::new();
    if let Ok(current) = std::env::current_exe() {
        if let Some(dir) = current.parent() {
            candidates.push(dir.join(&executable));
            candidates.push(dir.join("binaries").join(&executable));
        }
    }
    if let Some(paths) = std::env::var_os("PATH") {
        candidates.extend(std::env::split_paths(&paths).map(|dir| dir.join(&executable)));
    }
    candidates.into_iter().find(|path| path.is_file())
}

pub fn health() -> FfmpegInfo {
    let ffmpeg = binary("ffmpeg");
    let ffprobe = binary("ffprobe");
    let mut warnings = Vec::new();
    let version = ffmpeg.as_ref().and_then(|p| background_command(p).arg("-version").output().ok())
        .filter(|o| o.status.success()).map(|o| String::from_utf8_lossy(&o.stdout).lines().next().unwrap_or("").to_owned());
    let mut encoders = Vec::new();
    if let Some(path) = &ffmpeg {
        if let Ok(output) = background_command(path).args(["-hide_banner", "-encoders"]).output() {
            let listing = String::from_utf8_lossy(&output.stdout);
            for encoder in ["libx264", "h264_nvenc", "h264_qsv", "h264_amf"] {
                if listing.lines().any(|line| line.split_whitespace().nth(1) == Some(encoder)) { encoders.push(encoder.into()); }
            }
        }
    }
    let probe_ok = ffprobe.as_ref().and_then(|p| background_command(p).arg("-version").output().ok()).map(|o| o.status.success()).unwrap_or(false);
    if version.is_none() { warnings.push("FFmpeg não encontrado ou inválido. Instale os sidecars conforme docs/setup-ffmpeg.md.".into()); }
    if !probe_ok { warnings.push("FFprobe não encontrado ou inválido; exportação bloqueada.".into()); }
    if !encoders.iter().any(|name| name == "libx264") { warnings.push("O FFmpeg precisa do encoder libx264 para o fallback de vídeo.".into()); }
    let exiftool_available = binary("exiftool").is_some();
    if !exiftool_available { warnings.push("ExifTool opcional ausente: a limpeza usa FFmpeg e verifica as tags visíveis pelo FFprobe.".into()); }
    FfmpegInfo { available: version.is_some() && probe_ok && encoders.iter().any(|e| e == "libx264"), ffmpeg_path: ffmpeg.map(|p| p.to_string_lossy().into()), ffprobe_path: ffprobe.map(|p| p.to_string_lossy().into()), version, encoders, exiftool_available, warnings }
}

pub fn input_path(path: &str) -> Result<PathBuf, String> {
    if path.is_empty() || path.contains('\0') { return Err("Caminho de mídia inválido.".into()); }
    let p = Path::new(path);
    if !p.is_absolute() { return Err("Selecione um arquivo por caminho absoluto.".into()); }
    let real = p.canonicalize().map_err(|e| format!("Arquivo ausente ou inacessível: {path}: {e}"))?;
    if !real.is_file() { return Err("A entrada precisa ser um arquivo.".into()); }
    Ok(real)
}

pub fn is_image(path: &Path) -> bool {
    matches!(path.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase().as_str(), "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "tif" | "tiff" | "avif")
}

pub(super) fn image_loop_args(path: &Path) -> [&'static str; 2] {
    // GIF and AVIF use dedicated demuxers, which do not accept image2's -loop.
    match path.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase().as_str() {
        "gif" | "avif" => ["-stream_loop", "-1"],
        _ => ["-loop", "1"],
    }
}

fn numeric(value: &Value) -> f64 { value.as_f64().or_else(|| value.as_str().and_then(|s| s.parse().ok())).unwrap_or(0.0) }

pub fn probe(path: &str) -> Result<MediaInfo, String> {
    let input = input_path(path)?;
    let executable = binary("ffprobe").ok_or("FFprobe ausente. Consulte docs/setup-ffmpeg.md.")?;
    let output = background_command(executable).args(["-v", "error", "-print_format", "json", "-show_format", "-show_streams"]).arg(&input).output().map_err(|e| format!("Não foi possível executar FFprobe: {e}"))?;
    if !output.status.success() { return Err(format!("Não foi possível ler a mídia: {}", String::from_utf8_lossy(&output.stderr).trim())); }
    let json: Value = serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;
    parse_probe(path, &json, std::fs::metadata(&input).map(|m| m.len()).unwrap_or(0))
}

pub fn parse_probe(path: &str, json: &Value, size_bytes: u64) -> Result<MediaInfo, String> {
    let streams = json["streams"].as_array().ok_or("FFprobe não retornou streams.")?;
    let video = streams.iter().find(|v| v["codec_type"] == "video").ok_or("Arquivo sem imagem/vídeo suportado.")?;
    let coded_width = video["width"].as_u64().unwrap_or(0) as u32;
    let coded_height = video["height"].as_u64().unwrap_or(0) as u32;
    if coded_width == 0 || coded_height == 0 { return Err("Resolução da mídia inválida.".into()); }
    let rotation = video["side_data_list"].as_array().and_then(|a| a.iter().find_map(|v| v.get("rotation"))).map(numeric).unwrap_or_else(|| numeric(&video["tags"]["rotate"]));
    let swapped = ((rotation.abs() / 90.0).round() as i64) % 2 != 0;
    let mut tags = BTreeMap::new();
    fn add(tags: &mut BTreeMap<String, String>, prefix: &str, value: &Value) {
        if let Some(object) = value.as_object() { for (key, val) in object { tags.insert(format!("{prefix}.{key}"), val.as_str().map(str::to_owned).unwrap_or_else(|| val.to_string())); } }
    }
    add(&mut tags, "format", &json["format"]["tags"]);
    for (index, stream) in streams.iter().enumerate() { add(&mut tags, &format!("stream{index}"), &stream["tags"]); }
    let rate = video["avg_frame_rate"].as_str().unwrap_or("0/1");
    let mut parts = rate.split('/').filter_map(|s| s.parse::<f64>().ok());
    let numerator = parts.next().unwrap_or(0.0);
    let denominator = parts.next().unwrap_or(1.0);
    let fps = if denominator > 0.0 { numerator / denominator } else { 0.0 };
    Ok(MediaInfo { path: path.into(), width: if swapped { coded_height } else { coded_width }, height: if swapped { coded_width } else { coded_height }, coded_width, coded_height, duration: numeric(&json["format"]["duration"]).max(numeric(&video["duration"])), fps, codec: video["codec_name"].as_str().unwrap_or("").into(), pix_fmt: video["pix_fmt"].as_str().unwrap_or("").into(), rotation, has_audio: streams.iter().any(|v| v["codec_type"] == "audio"), tags, size_bytes, modified_at: std::fs::metadata(path).ok().and_then(|metadata| metadata.modified().ok()).and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok()).map(|time| time.as_millis() as u64), is_image: is_image(Path::new(path)) })
}

pub fn metadata_report(before: &MediaInfo, after: &MediaInfo, exiftool_used: bool) -> MetadataReport {
    let removed = before.tags.iter().filter(|(key,value)| after.tags.get(*key) != Some(*value)).map(|(k,_)| k.clone()).collect();
    let sensitive_remaining = after.tags.keys().filter(|key| ["gps", "location", "device", "make", "model", "creation_time", "quicktime", "xmp", "iptc"].iter().any(|needle| key.to_lowercase().contains(needle))).cloned().collect();
    MetadataReport { before: before.tags.clone(), after: after.tags.clone(), removed, sensitive_remaining, exiftool_used }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_rotation_audio_and_tags() {
        let value = serde_json::json!({"streams":[{"codec_type":"video","width":1920,"height":1080,"avg_frame_rate":"30000/1001","side_data_list":[{"rotation":90}],"tags":{"creation_time":"today"}},{"codec_type":"audio"}],"format":{"duration":"4.5","tags":{"location":"GPS"}}});
        let info = parse_probe("/video.mp4", &value, 10).unwrap();
        assert_eq!((info.width, info.height), (1080,1920));
        assert!(info.has_audio); assert!((info.fps - 29.97).abs() < 0.01); assert_eq!(info.duration,4.5);
        assert!(info.tags.contains_key("format.location"));
    }
}
