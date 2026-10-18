use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub coded_width: u32,
    pub coded_height: u32,
    pub duration: f64,
    pub fps: f64,
    pub codec: String,
    pub pix_fmt: String,
    pub rotation: f64,
    pub has_audio: bool,
    pub tags: BTreeMap<String, String>,
    pub size_bytes: u64,
    #[serde(skip_serializing_if = "Option::is_none")] pub modified_at: Option<u64>,
    pub is_image: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegInfo {
    pub available: bool,
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
    pub version: Option<String>,
    pub encoders: Vec<String>,
    pub exiftool_available: bool,
    pub warnings: Vec<String>,
}

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize)]
pub struct Rect { pub x: f64, pub y: f64, pub width: f64, pub height: f64 }

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize)]
pub struct Canvas { pub width: u32, pub height: u32 }

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Geometry {
    pub source_crop: Rect,
    pub draw_rect: Rect,
    pub bounds: Rect,
    pub matrix: [f64; 6],
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Background {
    pub enable: Option<Enable>,
    #[serde(default = "yes")] pub visible: bool,
    #[serde(default = "yes", rename = "loop")] pub loop_video: bool,
    pub source_offset: Option<f64>,
    pub source_duration: Option<f64>,
    #[serde(rename = "type", default)] pub kind: String,
    pub color: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub angle: Option<f64>,
    pub source: Option<String>,
    pub audio: Option<String>,
    pub radius: Option<f64>,
    pub opacity: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderMedia {
    pub audio: Option<String>,
    pub enable: Option<Enable>,
    #[serde(default = "yes")] pub visible: bool,
    pub width: f64,
    pub height: f64,
    #[serde(default)] pub rotation: f64,
    #[serde(default)] pub flip_h: bool,
    #[serde(default)] pub flip_v: bool,
    #[serde(default = "one")] pub opacity: f64,
    #[serde(default)] pub mask: String,
    #[serde(default)] pub z_index: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderSpec {
    #[serde(skip)] pub mask_path: Option<String>,
    pub canvas: Canvas,
    pub background: Background,
    pub media: RenderMedia,
    pub geometry: Geometry,
    #[serde(default)] pub layers: Vec<DynamicLayer>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DynamicLayer {
    pub audio: Option<String>,
    #[serde(default = "yes", rename = "loop")] pub loop_video: bool,
    pub source_offset: Option<f64>,
    pub source_duration: Option<f64>,
    #[serde(rename = "type")] pub kind: String,
    pub source: Option<String>,
    pub rect: Rect,
    #[serde(default)] pub rotation: f64,
    #[serde(default = "one")] pub opacity: f64,
    #[serde(default)] pub z_index: i32,
    #[serde(default = "yes")] pub visible: bool,
    pub enable: Option<Enable>,
    pub fit: Option<String>,
    pub source_width: Option<f64>,
    pub source_height: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Overlay { pub path: String, pub z_index: i32, pub enable: Option<Enable> }

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Enable { pub start: f64, pub end: f64 }

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Trim { pub start: f64, pub duration: f64 }

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportItem {
    pub id: String,
    pub source_path: String,
    pub output_path: String,
    pub trim: Option<Trim>,
    pub output_duration: Option<f64>,
    pub render: Option<RenderSpec>,
    #[serde(default)] pub overlays: Vec<Overlay>,
    #[serde(default = "standard")] pub preset: String,
    #[serde(default)] pub encoder: Option<String>,
    #[serde(default = "yes")] pub clean_metadata: bool,
    #[serde(default = "suffix")] pub conflict: String,
    #[serde(default = "render")] pub mode: String,
    #[serde(default)] pub deep_clean: bool,
    #[serde(default)] pub move_original: bool,
    #[serde(default = "one")] pub speed: f64,
    pub fps: Option<f64>,
    #[serde(default)] pub silent_audio: bool,
}

fn one() -> f64 { 1.0 }
fn yes() -> bool { true }
fn standard() -> String { "standard".into() }
fn suffix() -> String { "suffix".into() }
fn render() -> String { "render".into() }

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportJob {
    pub items: Vec<ExportItem>,
    #[serde(default = "no_action")] pub finish_action: String,
    #[serde(default = "default_concurrency")] pub concurrency: usize,
}
fn default_concurrency() -> usize { 1 }
fn no_action() -> String { "none".into() }

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub job_id: String,
    pub item_id: String,
    pub percent: f64,
    pub fps: Option<f64>,
    pub speed: Option<f64>,
    pub out_size_bytes: Option<u64>,
    pub eta_seconds: Option<f64>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataReport {
    pub before: BTreeMap<String, String>,
    pub after: BTreeMap<String, String>,
    pub removed: Vec<String>,
    pub sensitive_remaining: Vec<String>,
    pub exiftool_used: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemState {
    pub id: String,
    pub source_path: String,
    pub output_path: String,
    pub status: String,
    pub progress: Progress,
    pub error: Option<String>,
    pub log_path: Option<String>,
    pub duration_ms: Option<u64>,
    pub output_size: Option<u64>,
    pub metadata: Option<MetadataReport>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobState {
    pub id: String,
    pub status: String,
    pub concurrency: usize,
    pub items: Vec<ItemState>,
    pub warnings: Vec<String>,
    pub request: ExportJob,
}
