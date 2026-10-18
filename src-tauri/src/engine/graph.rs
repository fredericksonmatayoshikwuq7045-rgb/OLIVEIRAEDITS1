use super::model::{Enable, ExportItem, MediaInfo, RenderSpec};
use super::probe::input_path;

pub struct Graph { pub filter: String, pub inputs: Vec<String>, pub background_audio: Option<usize> }

pub fn color(value: &str) -> Result<String, String> {
    let hex = value.strip_prefix('#').unwrap_or(value);
    if hex.len() != 6 || !hex.bytes().all(|b| b.is_ascii_hexdigit()) { return Err("Cor inválida; use #RRGGBB.".into()); }
    Ok(format!("0x{hex}"))
}

pub fn validate_render(spec: &RenderSpec) -> Result<(), String> {
    let c = spec.canvas;
    if c.width < 2 || c.height < 2 || c.width > 8192 || c.height > 8192 || c.width % 2 != 0 || c.height % 2 != 0 { return Err("Canvas precisa ter dimensões pares entre 2 e 8192 pixels.".into()); }
    for rect in [&spec.geometry.source_crop, &spec.geometry.draw_rect, &spec.geometry.bounds] {
        if ![rect.x, rect.y, rect.width, rect.height].iter().all(|v| v.is_finite() && v.abs() <= 65536.0) || rect.width <= 0.0 || rect.height <= 0.0 { return Err("Geometria inválida ou maior que o limite seguro.".into()); }
    }
    if !spec.geometry.matrix.iter().all(|v| v.is_finite()) || !spec.media.rotation.is_finite() || spec.media.rotation.abs() > 3600.0 || !(0.0..=1.0).contains(&spec.media.opacity) { return Err("Transformação inválida.".into()); }
    for layer in &spec.layers {
        if ![layer.rect.x,layer.rect.y,layer.rect.width,layer.rect.height,layer.rotation,layer.opacity].iter().all(|v| v.is_finite()) || layer.rect.width <= 0.0 || layer.rect.height <= 0.0 || layer.rect.width > 8.0 || layer.rect.height > 8.0 || !(0.0..=1.0).contains(&layer.opacity) { return Err("Camada fora dos limites seguros.".into()); }
    }
    Ok(())
}

fn enable_filter(enable: &Option<Enable>) -> Result<String,String> {
    if let Some(value)=enable {
        if !value.start.is_finite() || !value.end.is_finite() || value.start<0.0 || value.end<value.start { return Err("Intervalo de camada inválido.".into()); }
        Ok(format!(":enable='gte(t,{})*lt(t,{})'",value.start,value.end))
    } else { Ok(String::new()) }
}
fn media_time(enable:&Option<Enable>,offset:Option<f64>)->Result<String,String>{
    enable_filter(enable)?;
    let offset=offset.unwrap_or(0.0);
    if !offset.is_finite() || !(0.0..=86400.0).contains(&offset){return Err("Início do template inválido.".into());}
    let start=enable.as_ref().map_or(0.0,|value|value.start);
    Ok(format!("trim=start={offset},setpts=PTS-STARTPTS+{start}/TB"))
}

fn rotation_filter(angle: f64) -> String {
    format!("rotate={angle:.9}*PI/180:c=none:ow=ceil(rotw({angle:.9}*PI/180)):oh=ceil(roth({angle:.9}*PI/180))")
}

pub fn build(item: &ExportItem, info: &MediaInfo, duration: f64) -> Result<Graph,String> {
    let spec = item.render.as_ref().ok_or("Falta o modelo de renderização.")?;
    validate_render(spec)?;
    let (w,h) = (spec.canvas.width,spec.canvas.height);
    let fps = item.fps.unwrap_or(if info.fps > 0.0 { info.fps.min(60.0) } else { 30.0 });
    let mut graph = Vec::new();
    let mut inputs = Vec::new();
    let mut next_input = 1;
    let mut background_audio = None;
    let mut add_input = |path: &str, video: bool, repeat: bool| -> Result<usize,String> {
        let real = input_path(path)?;
        let index = next_input; next_input += 1;
        if video && repeat { inputs.extend(["-stream_loop".into(),"-1".into()]); }
        else if !video { inputs.extend(super::probe::image_loop_args(&real).map(str::to_owned)); }
        inputs.extend(["-i".into(),real.to_string_lossy().into_owned()]);
        Ok(index)
    };
    let blur = spec.background.visible && spec.background.kind == "blur";
    if blur { graph.push("[0:v]split=2[maininput][blurinput]".into()); }
    match if spec.background.visible {spec.background.kind.as_str()} else {"solid"} {
        "image" | "video" => {
            let is_video = spec.background.kind == "video";
            let index = add_input(spec.background.source.as_deref().ok_or("Fundo sem arquivo.")?, is_video, spec.background.loop_video)?;
            if is_video && spec.background.audio.as_deref() == Some("mix") { background_audio = Some(index); }
            let opacity=spec.background.opacity.unwrap_or(1.0);
            let timing=media_time(&spec.background.enable,spec.background.source_offset)?;
            if !opacity.is_finite() || !(0.0..=1.0).contains(&opacity){return Err("Opacidade do fundo inválida.".into());}
            graph.push(format!("color=c=0x111111:s={w}x{h}:r={fps}:d={duration},format=rgba[basebg]"));
            graph.push(format!("[{index}:v]{timing},scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1,format=rgba,colorchannelmixer=aa={opacity}[backgroundfile]"));
            graph.push("[basebg][backgroundfile]overlay=eof_action=repeat:format=auto[bg]".into());
        }
        "blur" => {
            let radius = spec.background.radius.unwrap_or(0.025);
            if !radius.is_finite() || !(0.0..=1.0).contains(&radius) { return Err("Raio de desfoque inválido.".into()); }
            let sigma=(radius*w.min(h) as f64).max(0.01);
            let margin=(sigma*2.0).round() as u32;
            let (bw,bh)=(w+margin*2,h+margin*2);
            graph.push(format!("[blurinput]setpts=(PTS-STARTPTS)/{},scale={bw}:{bh}:force_original_aspect_ratio=increase,crop={bw}:{bh},gblur=sigma={sigma},crop={w}:{h}:{margin}:{margin},setsar=1,format=rgba[bg]",item.speed));
        }
        "gradient" => {
            let start = color(spec.background.from.as_deref().unwrap_or("#111111"))?;
            let end = color(spec.background.to.as_deref().unwrap_or("#333333"))?;
            let first = u32::from_str_radix(&start[2..],16).unwrap();
            let last = u32::from_str_radix(&end[2..],16).unwrap();
            let angle = spec.background.angle.unwrap_or(90.0).to_radians();
            if !angle.is_finite() { return Err("Ângulo do gradiente inválido.".into()); }
            let denominator=angle.cos().abs()*w as f64+angle.sin().abs()*h as f64;
            let blend = format!("clip(0.5+((X+0.5-{:.9})*{:.9}+(Y+0.5-{:.9})*{:.9})/{denominator:.9},0,1)",w as f64/2.0,angle.cos(),h as f64/2.0,angle.sin());
            let channel = |shift:u32| format!("{}+({}-{})*({blend})",(first>>shift)&255u32,(last>>shift)&255u32,(first>>shift)&255u32);
            graph.push(format!("nullsrc=s={w}x{h}:r={fps}:d={duration},format=rgba,geq=r='{}':g='{}':b='{}':a=255[bg]",channel(16),channel(8),channel(0)));
        }
        "solid" | "" => { let c = color(if spec.background.visible {spec.background.color.as_deref().unwrap_or("#111111")}else{"#111111"})?; graph.push(format!("color=c={c}:s={w}x{h}:r={fps}:d={duration},format=rgba[bg]")); }
        _ => return Err("Tipo de fundo não reconhecido.".into()),
    }
    if spec.background.visible && spec.background.enable.is_some() {
        let enable=enable_filter(&spec.background.enable)?;
        for node in &mut graph { *node=node.replace("[bg]","[timedbg]"); }
        graph.push(format!("color=c=0x111111:s={w}x{h}:r={fps}:d={duration},format=rgba[fallbackbg]"));
        graph.push(format!("[fallbackbg][timedbg]overlay=shortest=0:eof_action=repeat:format=auto{enable}[bg]"));
    }
    let crop = spec.geometry.source_crop;
    if crop.x < 0.0 || crop.y < 0.0 || crop.x+crop.width > info.width as f64 || crop.y+crop.height > info.height as f64 { return Err("Crop excede os limites da mídia original.".into()); }
    let draw = spec.geometry.draw_rect;
    let mut chain = vec![format!("setpts=(PTS-STARTPTS)/{}",item.speed),"format=rgba".into(),format!("crop={:.0}:{:.0}:{:.0}:{:.0}",crop.width.floor(),crop.height.floor(),crop.x.floor(),crop.y.floor()),format!("scale={:.0}:{:.0}:flags=lanczos",draw.width.round(),draw.height.round()),"setsar=1".into()];
    if spec.media.flip_h { chain.push("hflip".into()); }
    if spec.media.flip_v { chain.push("vflip".into()); }
    let mut main_source=if blur { "[maininput]".to_owned() } else { "[0:v]".to_owned() };
    if spec.media.mask == "circle" {
        if let Some(path)=&spec.mask_path {
            let index=add_input(path,false,true)?;
            graph.push(format!("{main_source}{},split=2[unmasked][withalpha]",chain.join(",")));
            graph.push("[withalpha]alphaextract[originalalpha]".into());
            graph.push(format!("[{index}:v]format=gray[circlemask]"));
            graph.push("[originalalpha][circlemask]blend=all_mode=multiply[mask]".into());
            main_source="[unmasked][mask]".into();chain=vec!["alphamerge".into()];
        }else{chain.push("geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(pow(X-W/2,2)+pow(Y-H/2,2),pow(min(W,H)/2,2)),alpha(X,Y),0)'".into());}
    }
    if spec.media.opacity < 1.0 { chain.push(format!("colorchannelmixer=aa={}",spec.media.opacity)); }
    if spec.media.rotation.rem_euclid(360.0) != 0.0 { chain.push(rotation_filter(spec.media.rotation)); }
    graph.push(format!("{main_source}{}[main]",chain.join(",")));
    let bounds = spec.geometry.bounds;
    let mut planes = vec![(spec.media.z_index,"main".to_owned(),bounds.x,bounds.y,None)];
    for (n,overlay) in item.overlays.iter().enumerate() {
        let index = add_input(&overlay.path,false,true)?;
        let label = format!("overlay{n}");
        graph.push(format!("[{index}:v]setpts=PTS-STARTPTS,scale={w}:{h},format=rgba[{label}]"));
        planes.push((overlay.z_index,label,0.0,0.0,overlay.enable.clone()));
    }
    for (n,layer) in spec.layers.iter().enumerate() {
        if layer.kind == "text" || !layer.visible { continue; }
        if layer.kind != "image" && layer.kind != "video" { return Err("Tipo de camada não suportado.".into()); }
        let index = add_input(layer.source.as_deref().ok_or("Camada sem arquivo.")?,layer.kind == "video",layer.loop_video)?;
        let label = format!("dynamic{n}");
        let lw = (layer.rect.width*w as f64).round().max(1.0);
        let lh = (layer.rect.height*h as f64).round().max(1.0);
        let angle = layer.rotation.to_radians();
        let bw = (lw*angle.cos().abs()+lh*angle.sin().abs()).ceil();
        let bh = (lw*angle.sin().abs()+lh*angle.cos().abs()).ceil();
        let fit=match layer.fit.as_deref(){Some("cover")=>format!("scale={lw}:{lh}:force_original_aspect_ratio=increase,crop={lw}:{lh}"),Some("contain")=>format!("scale={lw}:{lh}:force_original_aspect_ratio=decrease,pad={lw}:{lh}:(ow-iw)/2:(oh-ih)/2:color=black@0"),_=>format!("scale={lw}:{lh}")};
        let timing=media_time(&layer.enable,layer.source_offset)?;
        graph.push(format!("[{index}:v]{timing},format=rgba,{fit},colorchannelmixer=aa={},{}[{label}]",layer.opacity,rotation_filter(layer.rotation)));
        planes.push((layer.z_index,label,layer.rect.x*w as f64+(lw-bw)/2.0,layer.rect.y*h as f64+(lh-bh)/2.0,layer.enable.clone()));
    }
    planes.sort_by_key(|p|p.0);
    let mut previous = "bg".to_owned();
    for (index,(_,label,x,y,enable)) in planes.iter().enumerate() {
        let output = format!("composite{index}");
        let enable=enable_filter(enable)?;
        graph.push(format!("[{previous}][{label}]overlay=x={x:.6}:y={y:.6}:eof_action=repeat:shortest=0:format=auto{enable}[{output}]"));
        previous = output;
    }
    graph.push(format!("[{previous}]format=yuv420p[outv]"));
    Ok(Graph { filter:graph.join(";"), inputs, background_audio })
}
