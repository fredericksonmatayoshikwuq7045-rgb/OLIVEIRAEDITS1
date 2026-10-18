"""Compare real Canvas frames with encoded FFmpeg frames, including video phase and background audio windows."""
import base64
import copy
import json
import math
import os
import struct
import subprocess
import zlib
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = Path(os.environ.get('OE_TIMING_DIR', ROOT / '.artifacts/template-timing')).resolve()
DIRECTORY.mkdir(parents=True, exist_ok=True)
HARNESS = os.environ.get('OLIVEIRA_ENGINE_HARNESS', str(ROOT / 'src-tauri/target/debug/examples/engine_harness'))
REPORT = {'status': 'running', 'cases': [], 'checks': []}


def run(args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
    assert result.returncode == 0, result.stderr.decode(errors='replace')
    return result.stdout


def png(width, height, painter):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    pixels = b''.join(b'\0' + b''.join(bytes(painter(x, y)) for x in range(width)) for y in range(height))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(pixels)) + chunk(b'IEND', b'')


def uri(file, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(file.read_bytes()).decode()


def save_uri(file, value):
    file.write_bytes(base64.b64decode(value.split(',', 1)[1]))


def rgb(file, time=None):
    return run(['ffmpeg', '-nostdin', '-v', 'error', *(['-ss', str(time)] if time is not None else []), '-i', str(file), '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])


def compare(expected, actual):
    assert len(expected) == len(actual)
    errors = [abs(a-b) for a, b in zip(expected, actual)]
    mean = sum(errors)/len(errors)
    fraction = sum(max(errors[i:i+3]) > 35 for i in range(0, len(errors), 3))/(len(errors)/3)
    assert mean < 7 and fraction < .08, (mean, fraction)
    return {'meanAbsoluteChannelError': mean, 'fractionPixelsAbove35': fraction}


def frequency(file, at, hz):
    raw = run(['ffmpeg', '-nostdin', '-v', 'error', '-ss', str(at), '-i', str(file), '-t', '0.2', '-vn', '-ac', '1', '-ar', '48000', '-f', 's16le', 'pipe:1'])
    values = struct.unpack('<'+'h'*(len(raw)//2), raw)
    real = sum(value*math.cos(2*math.pi*hz*index/48000) for index, value in enumerate(values))
    imaginary = sum(value*math.sin(2*math.pi*hz*index/48000) for index, value in enumerate(values))
    return math.hypot(real, imaginary)/len(values)


try:
    source = DIRECTORY/'source.png'
    source.write_bytes(png(192, 128, lambda x, y: [48, 48, 48, 255]))
    graphic = DIRECTORY/'graphic.png'
    graphic.write_bytes(png(40, 24, lambda x, y: [240, 25, 180, 255]))
    main, stamp = DIRECTORY/'main.mp4', DIRECTORY/'stamp.mp4'
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-loop', '1', '-i', str(source), '-f', 'lavfi', '-i', 'sine=frequency=200:sample_rate=48000', '-t', '8', '-r', '20', '-c:v', 'libx264rgb', '-crf', '0', '-threads', '1', '-c:a', 'aac', str(main)])
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=64x64:r=20', '-f', 'lavfi', '-i', 'sine=frequency=500:sample_rate=48000', '-vf', "drawbox=c=blue:t=fill:enable='gte(t,0.5)',drawbox=c=lime:t=fill:enable='gte(t,1.5)'", '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-c:a', 'aac', str(stamp)])
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
        page = browser.new_page()
        page.goto(os.environ.get('OE_TEST_URL', 'http://127.0.0.1:3000'))
        cases = page.evaluate("""async ({source,graphic,stamp})=>{
          const {createRenderSpec,createTextLayer}=await import('/src/render/types.ts');
          const {composeCanvas,compileStaticPlanes}=await import('/src/render/compositor.ts');
          const {computeGeometry}=await import('/src/render/geometry.ts');
          const encode=blob=>new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});
          const base=createRenderSpec(320,240,source);Object.assign(base.media,{width:192,height:128,zoom:.55});
          base.background={type:'video',source:stamp,width:64,height:64,opacity:1,loop:true,audio:'mix',sourceOffset:.25,enable:{start:.5,end:5.5}};
          const layer={id:'stamp-one',type:'video',source:stamp,sourceWidth:64,sourceHeight:64,rect:{x:.05,y:.05,width:.2,height:.2},fit:'stretch',rotation:0,opacity:1,zIndex:20,visible:true,enable:{start:1,end:3},sourceOffset:.5,loop:false};
          const text=createTextLayer('text');Object.assign(text,{text:'TEMPO REAL',fontSize:.07,enable:{start:1.5,end:2.5},rect:{x:.2,y:.78,width:.6,height:.15}});
          base.layers=[layer,{...layer,id:'stamp-two',rect:{...layer.rect,x:.75},sourceOffset:1.5,enable:{start:1,end:4},loop:true},
            {id:'graphic',type:'image',source:graphic,sourceWidth:40,sourceHeight:24,fit:'stretch',rect:{x:.1,y:.68,width:.3,height:.15},rotation:0,opacity:1,zIndex:5,visible:true,enable:{start:2,end:4}},text];
          const result=[];
          for(const name of ['video-windows','trim-speed','freeze-background','gradient-window','image-background-window','hidden-blur']){
            const spec=structuredClone(base),speed=name==='trim-speed'?2:1,duration=name==='trim-speed'?3:name==='video-windows'||name==='freeze-background'?6:3;
            if(name==='freeze-background')spec.background.loop=false;
            if(name==='gradient-window')spec.background={type:'gradient',from:'#14433a',to:'#6d3484',angle:35,enable:{start:1,end:2}};
            if(name==='image-background-window')spec.background={type:'image',source:graphic,width:40,height:24,opacity:.7,loop:true,audio:'mute',enable:{start:1,end:2}};
            if(name==='hidden-blur')spec.background={type:'blur',radius:.03,visible:false};
            const times=duration===6?[.25,.5,1.2,2,3,3.8,5.5,5.8]:[.25,1.2,2.8],frames=[];
            for(const time of times)frames.push({time,png:(await composeCanvas(spec,{time})).toDataURL()});
            const planes=[];for(const plane of await compileStaticPlanes(spec))planes.push({zIndex:plane.zIndex,enable:plane.enable,png:await encode(plane.png)});
            result.push({name,spec,geometry:computeGeometry(spec),speed,duration,frames,planes});
          }return result;
        }""", {'source': uri(source, 'image/png'), 'graphic': uri(graphic, 'image/png'), 'stamp': uri(stamp, 'video/mp4')})
        browser.close()
    items = []
    for case in cases:
        spec = copy.deepcopy(case['spec'])
        spec['geometry'] = case['geometry']
        spec['layers'] = [dict(layer, source=str(stamp)) for layer in spec['layers'] if layer['type'] == 'video']
        if spec['background']['type'] in ['video', 'image']:
            spec['background']['source'] = str(stamp if spec['background']['type'] == 'video' else graphic)
        overlays = []
        for index, plane in enumerate(case['planes']):
            file = DIRECTORY/f"{case['name']}-plane-{index}.png"
            save_uri(file, plane['png'])
            overlays.append({'path': str(file), 'zIndex': plane['zIndex'], 'enable': plane.get('enable')})
        items.append({'id': case['name'], 'sourcePath': str(main), 'outputPath': str(DIRECTORY/(case['name']+'.mp4')), 'trim': {'start': 1 if case['speed'] == 2 else 0, 'duration': case['duration']*case['speed']}, 'render': spec, 'overlays': overlays, 'preset': 'high', 'encoder': 'libx264', 'speed': case['speed'], 'cleanMetadata': True, 'conflict': 'overwrite', 'mode': 'render'})
    request = DIRECTORY/'request.json'
    request.write_text(json.dumps({'job': {'items': items, 'concurrency': 1}}))
    states = json.loads(run([HARNESS, str(request)]))['items']
    for case in cases:
        state = next(state for state in states if state['id'] == case['name'])
        assert state['status'] == 'ok', state.get('error')
        metadata = json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', state['outputPath']]))
        assert abs(float(metadata['format']['duration'])-case['duration']) < .15
        metrics = []
        for frame in case['frames']:
            file = DIRECTORY/f"{case['name']}-{frame['time']}-canvas.png"
            save_uri(file, frame['png'])
            stats = compare(rgb(file), rgb(state['outputPath'], frame['time']))
            metrics.append({'time': frame['time'], **stats})
        REPORT['cases'].append({'name': case['name'], 'status': 'passed', 'frames': metrics})
        print('Passed', case['name'], len(metrics), 'real frames')
    normal = DIRECTORY/'video-windows.mp4'
    for at, active in [(.1, False), (1.3, True), (5.7, False)]:
        ratio = frequency(normal, at, 500)/max(1, frequency(normal, at, 200))
        assert ratio > .3 if active else ratio < .05, (at, ratio)
    REPORT['checks'] = ['Timed video layers and backgrounds match real Canvas frames, including duplicate source decoders, offsets, loops and exclusive ends', 'Trim/speed preserve output-time windows and duration', 'Static PNG/text planes preserve their intervals and z order', 'Background audio exists only during its visible interval; main audio remains present']
    REPORT['status'] = 'passed'
except Exception as error:
    REPORT['status'] = 'failed'
    REPORT['error'] = str(error)
    raise
finally:
    (DIRECTORY/'report.json').write_text(json.dumps(REPORT, indent=2))
    print('Report:', DIRECTORY/'report.json')
