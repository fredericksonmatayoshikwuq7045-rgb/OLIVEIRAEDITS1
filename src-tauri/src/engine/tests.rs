use super::{arguments,graph,model::*,Engine};
use std::{fs,path::PathBuf,sync::Arc};

fn scratch()->PathBuf{let path=std::env::temp_dir().join(format!("oe-engine-unit-{}",super::unique_id()));fs::create_dir_all(&path).unwrap();path}
fn fixture(dir:&std::path::Path)->ExportItem{
    let source=dir.join("source with spaces.mp4");fs::write(&source,b"fixture").unwrap();
    serde_json::from_value(serde_json::json!({"id":"one","sourcePath":source,"outputPath":dir.join("out.mp4"),"trim":{"start":1,"duration":3},"render":{"canvas":{"width":108,"height":192},"background":{"type":"solid","color":"#111111"},"media":{"width":320,"height":180,"rotation":90,"mask":"circle","flipH":true,"zIndex":10},"geometry":{"sourceCrop":{"x":0,"y":0,"width":320,"height":180},"drawRect":{"x":-42,"y":42,"width":192,"height":108},"bounds":{"x":0,"y":0,"width":108,"height":192},"matrix":[0,0.6,-0.6,0,108,0]}}})).unwrap()
}
fn info(item:&ExportItem)->MediaInfo{MediaInfo{path:item.source_path.clone(),width:320,height:180,coded_width:320,coded_height:180,duration:10.,fps:30.,codec:"h264".into(),pix_fmt:"yuv420p".into(),rotation:0.,has_audio:true,tags:Default::default(),size_bytes:100,modified_at:None,is_image:false}}

#[test]
fn builds_finite_graph_with_rotation_mask_and_ordered_n_overlays(){
    let dir=scratch();let mut item=fixture(&dir);let png=dir.join("plane.png");fs::write(&png,b"png").unwrap();
    item.overlays=vec![Overlay{path:png.to_string_lossy().into(),z_index:5,enable:None},Overlay{path:png.to_string_lossy().into(),z_index:50,enable:Some(Enable{start:1.,end:2.})}];
    let graph=graph::build(&item,&info(&item),3.).unwrap();
    assert!(graph.filter.contains("d=3"));assert!(graph.filter.contains("rotate=90"));assert!(graph.filter.contains("pow(min(W,H)/2,2)"));assert!(graph.filter.contains("hflip"));
    assert!(graph.filter.contains("[bg][overlay0]"));assert!(graph.filter.contains("[composite0][main]"));assert!(graph.filter.contains("[composite1][overlay1]"));assert!(graph.filter.contains("gte(t,1)*lt(t,2)"));
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn rejects_invalid_numbers_crops_and_option_values(){
    let dir=scratch();let mut item=fixture(&dir);assert!(arguments::validate(&item).is_ok());
    item.preset="-help".into();assert!(arguments::validate(&item).is_err());item.preset="standard".into();
    item.speed=f64::NAN;assert!(arguments::validate(&item).is_err());item.speed=1.;
    item.render.as_mut().unwrap().canvas.width=109;assert!(arguments::validate(&item).is_err());item.render.as_mut().unwrap().canvas.width=108;
    item.render.as_mut().unwrap().geometry.source_crop.width=321.;assert!(graph::build(&item,&info(&item),3.).is_err());
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn args_use_input_seek_output_duration_verified_encodes_and_metadata(){
    let dir=scratch();let item=fixture(&dir);let args=arguments::build(&item,&info(&item),&dir.join("out.mp4.part"),false).unwrap();
    let ss=args.iter().position(|s|s=="-ss").unwrap();let input=args.iter().position(|s|s=="-i").unwrap();let duration=args.iter().position(|s|s=="-t").unwrap();
    assert!(ss<input&&input<duration);assert!(!args.iter().any(|s|s=="-to"));
    for flag in ["-nostdin","-progress","yuv420p","+faststart","-map_metadata","-map_chapters","48000","colorprim=bt709:transfer=bt709:colormatrix=bt709"]{assert!(args.iter().any(|s|s==flag),"missing {flag}");}
    assert_eq!(args.last().unwrap(),dir.join("out.mp4.part").to_str().unwrap());fs::remove_dir_all(dir).unwrap();
}

#[test]
fn conflict_policy_preserves_sources_and_existing_outputs(){
    let dir=scratch();let mut item=fixture(&dir);fs::write(&item.output_path,b"old").unwrap();
    item.conflict="skip".into();assert!(arguments::reserve_output(&item,"job").unwrap().is_none());
    item.conflict="suffix".into();let (path,part)=arguments::reserve_output(&item,"job").unwrap().unwrap();assert!(path.ends_with("out_2.mp4"));drop(arguments::PartialGuard(part.clone()));assert!(!part.exists());assert_eq!(fs::read(&item.output_path).unwrap(),b"old");
    item.output_path=item.source_path.clone();assert!(arguments::validate(&item).is_err());fs::remove_dir_all(dir).unwrap();
}

#[test]
fn queue_recovers_backup_and_never_erases_corrupt_state(){
    let dir=scratch();fs::write(dir.join("queue.json"),b"invalid").unwrap();fs::write(dir.join("queue.json.bak"),b"[]").unwrap();
    let engine=Engine::new(dir.clone(),Arc::new(|_,_|{})).unwrap();assert!(engine.states().is_empty());assert_eq!(fs::read(dir.join("queue.json")).unwrap(),b"invalid");
    drop(engine);
    fs::remove_file(dir.join("queue.json.bak")).unwrap();assert!(Engine::new(dir.clone(),Arc::new(|_,_|{})).is_err());fs::remove_dir_all(dir).unwrap();
}

#[test]
fn gif_and_avif_with_no_duration_render_as_images_and_use_supported_loops() {
    let dir = scratch();
    for extension in ["GIF", "avif"] {
        let mut item = fixture(&dir);
        let source = dir.join(format!("still.{extension}"));
        fs::write(&source, b"fixture").unwrap();
        item.source_path = source.to_string_lossy().into_owned();
        item.trim = None;
        let info = super::probe::parse_probe(&item.source_path, &serde_json::json!({
            "streams": [{"codec_type": "video", "width": 320, "height": 180}]
        }), 0).unwrap();
        assert!(info.is_image);
        assert_eq!(arguments::duration(&item, &info).unwrap(), 1.0);
        let background = &mut item.render.as_mut().unwrap().background;
        background.kind = "image".into();
        background.source = Some(item.source_path.clone());
        let args = arguments::build(&item, &info, &dir.join("out.mp4.part"), false).unwrap();
        assert!(!args.iter().any(|arg| arg == "-loop"));
        assert_eq!(args.windows(2).filter(|args| args[0] == "-stream_loop" && args[1] == "-1").count(), 2);
    }
    fs::remove_dir_all(dir).unwrap();
}
