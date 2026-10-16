use std::{fs::File, io::BufWriter, path::Path};
use super::model::ExportItem;

fn write_png(path:&Path,width:u32,height:u32,color:png::ColorType,bytes:&[u8])->Result<(),String>{
    let file=File::create(path).map_err(|error|error.to_string())?;
    let mut encoder=png::Encoder::new(BufWriter::new(file),width,height);
    encoder.set_color(color);encoder.set_depth(png::BitDepth::Eight);encoder.set_compression(png::Compression::Fast);
    encoder.write_header().map_err(|error|error.to_string())?.write_image_data(bytes).map_err(|error|error.to_string())
}
fn rgb(value:&str)->Result<[f64;3],String>{
    let hex=super::graph::color(value)?;
    let value=u32::from_str_radix(&hex[2..],16).map_err(|error|error.to_string())?;
    Ok([((value>>16)&255) as f64,((value>>8)&255) as f64,(value&255) as f64])
}
/// Rasterize constant effects once per job. Per-frame geq at full HD is too costly.
pub fn prepare(item:&mut ExportItem,directory:&Path)->Result<(),String>{
    let Some(spec)=&mut item.render else{return Ok(())};
    if spec.background.kind=="gradient" {
        let (width,height)=(spec.canvas.width,spec.canvas.height);
        let from=rgb(spec.background.from.as_deref().unwrap_or("#111111"))?;
        let to=rgb(spec.background.to.as_deref().unwrap_or("#333333"))?;
        let angle=spec.background.angle.unwrap_or(90.0).to_radians();
        if !angle.is_finite(){return Err("Ângulo do gradiente inválido.".into());}
        let (sin,cos)=angle.sin_cos();let length=cos.abs()*width as f64+sin.abs()*height as f64;
        let mut pixels=vec![0u8;width as usize*height as usize*4];
        for y in 0..height {for x in 0..width {
            let position=(0.5+((x as f64+0.5-width as f64/2.0)*cos+(y as f64+0.5-height as f64/2.0)*sin)/length).clamp(0.0,1.0);
            let offset=((y*width+x)*4) as usize;
            for channel in 0..3 {pixels[offset+channel]=(from[channel]+(to[channel]-from[channel])*position).round() as u8;}
            pixels[offset+3]=255;
        }}
        let path=directory.join("gradient.png");write_png(&path,width,height,png::ColorType::Rgba,&pixels)?;
        spec.background.kind="image".into();spec.background.source=Some(path.to_string_lossy().into_owned());spec.background.opacity=Some(1.0);
    }
    if spec.media.mask=="circle" {
        let rect=spec.geometry.draw_rect;let (width,height)=(rect.width.round() as u32,rect.height.round() as u32);
        if width==0||height==0||width as u64*height as u64>64*1024*1024{return Err("A máscara excede o limite de memória. Reduza o zoom ou a resolução.".into());}
        let mut pixels=vec![0u8;width as usize*height as usize];let radius=width.min(height) as f64/2.0;
        for y in 0..height {for x in 0..width {
            let dx=x as f64+0.5-width as f64/2.0;let dy=y as f64+0.5-height as f64/2.0;
            if dx*dx+dy*dy<=radius*radius {pixels[(y*width+x) as usize]=255;}
        }}
        let path=directory.join("circle.png");write_png(&path,width,height,png::ColorType::Grayscale,&pixels)?;
        spec.mask_path=Some(path.to_string_lossy().into_owned());
    }
    Ok(())
}
