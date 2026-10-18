"""Real outputs: long video headline -> delayed trimmed/speeded main -> still outro, with audio gating."""
import base64
import json
import math
import os
import struct
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.environ.get('OE_SEQUENCE_EXPORT_DIR',ROOT/'.artifacts/sequence-export')).resolve()
OUT.mkdir(parents=True,exist_ok=True)
REPORT={'status':'running','cases':[]}
def run(args):
    result=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180)
    assert result.returncode==0,result.stderr.decode(errors='replace')
    return result.stdout
def uri(file,mime):return 'data:'+mime+';base64,'+base64.b64encode(file.read_bytes()).decode()
def save(file,value):file.write_bytes(base64.b64decode(value.split(',',1)[1]))
def pixels(file,time=None):return run(['ffmpeg','-nostdin','-v','error',*(['-ss',str(time)] if time is not None else []),'-i',str(file),'-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1'])
def audio(file,at):
    raw=run(['ffmpeg','-nostdin','-v','error','-ss',str(at),'-i',str(file),'-t','0.2','-vn','-ac','1','-ar','48000','-f','s16le','pipe:1'])
    samples=struct.unpack('<'+'h'*(len(raw)//2),raw)
    return math.sqrt(sum(value*value for value in samples)/len(samples))
try:
    main,head=OUT/'main.mp4',OUT/'headline.mp4'
    photo,graphic=OUT/'main.png',OUT/'outro.png'
    for file,color in [(photo,'0x303030'),(graphic,'0xf019b4')]:
        run(['ffmpeg','-nostdin','-y','-v','error','-f','lavfi','-i',f'color=c={color}:s=192x128','-frames:v','1','-threads','1',str(file)])
    run(['ffmpeg','-nostdin','-y','-v','error','-loop','1','-i',str(photo),'-f','lavfi','-i','sine=frequency=200:sample_rate=48000','-t','6','-r','20','-c:v','libx264rgb','-crf','0','-threads','1','-c:a','aac',str(main)])
    run(['ffmpeg','-nostdin','-y','-v','error','-f','lavfi','-i','color=c=red:s=160x120:r=20','-f','lavfi','-i','sine=frequency=500:sample_rate=48000','-vf',"drawbox=c=blue:t=fill:enable='gte(t,2)',drawbox=c=lime:t=fill:enable='gte(t,4)'",'-t','8','-c:v','libx264','-preset','ultrafast','-threads','1','-c:a','aac',str(head)])
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        page=browser.new_page();page.goto(os.environ.get('OE_TEST_URL','http://127.0.0.1:3000'))
        cases=page.evaluate("""async ({main,head,graphic})=>{
          const {createRenderSpec}=await import('/src/render/types.ts');
          const {composeCanvas,compileStaticPlanes}=await import('/src/render/compositor.ts');
          const {computeGeometry}=await import('/src/render/geometry.ts');
          const encode=blob=>new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});
          const result=[];
          for(const name of ['intro-main-outro','intro-main-blur','spoken-intro','muted-main']){
            const spec=createRenderSpec(320,240,main);Object.assign(spec.media,{width:192,height:128,zoom:.7,enable:{start:8,end:10}});
            if(name==='intro-main-blur')spec.background={type:'blur',radius:.03};
            spec.layers=[{id:'intro',type:'video',source:head,sourceWidth:160,sourceHeight:120,sourceDuration:8,loop:false,rect:{x:0,y:0,width:1,height:1},fit:'cover',rotation:0,opacity:1,zIndex:30,visible:true,enable:{start:0,end:8}},
              {id:'outro',type:'image',source:graphic,sourceWidth:192,sourceHeight:128,rect:{x:0,y:0,width:1,height:1},fit:'stretch',rotation:0,opacity:1,zIndex:30,visible:true,enable:{start:10,end:12}}];
            if(name==='spoken-intro'||name==='muted-main')spec.layers[0].audio='mix';
            if(name==='muted-main')spec.media.audio='mute';
            const frames=[];for(const time of [.2,2.2,4.2,7.9,8.1,9.8,10,10.5,11.9])frames.push({time,png:(await composeCanvas(spec,{time})).toDataURL()});
            const planes=[];for(const plane of await compileStaticPlanes(spec))planes.push({zIndex:plane.zIndex,enable:plane.enable,png:await encode(plane.png)});
            result.push({name,spec,geometry:computeGeometry(spec),frames,planes});
          }return result;
        }""",{'main':uri(photo,'image/png'),'head':uri(head,'video/mp4'),'graphic':uri(graphic,'image/png')})
        browser.close()
    items=[]
    for case in cases:
        render=case['spec'];render['geometry']=case['geometry'];render['layers']=[dict(layer,source=str(head)) for layer in render['layers'] if layer['type']=='video']
        overlays=[]
        for index,plane in enumerate(case['planes']):
            file=OUT/f"{case['name']}-{index}.png";save(file,plane['png']);overlays.append({'path':str(file),'zIndex':plane['zIndex'],'enable':plane.get('enable')})
        items.append({'id':case['name'],'sourcePath':str(main),'outputPath':str(OUT/(case['name']+'.mp4')),'trim':{'start':1,'duration':4},'outputDuration':12,'speed':2,'render':render,'overlays':overlays,'preset':'high','encoder':'libx264','mode':'render','conflict':'overwrite'})
    request=OUT/'request.json';request.write_text(json.dumps({'job':{'items':items,'concurrency':1}}))
    states=json.loads(run([os.environ.get('OLIVEIRA_ENGINE_HARNESS',str(ROOT/'src-tauri/target/debug/examples/engine_harness')),str(request)]))['items']
    for case in cases:
        state=next(state for state in states if state['id']==case['name']);assert state['status']=='ok',state.get('error')
        output=state['outputPath'];probe=json.loads(run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',output]))
        assert abs(float(probe['format']['duration'])-12)<.15,probe['format']['duration']
        metrics=[]
        for frame in case['frames']:
            file=OUT/f"{case['name']}-{frame['time']}.png";save(file,frame['png'])
            expected,actual=pixels(file),pixels(output,frame['time']);assert len(expected)==len(actual)
            errors=[abs(a-b) for a,b in zip(expected,actual)];mean=sum(errors)/len(errors);fraction=sum(max(errors[i:i+3])>35 for i in range(0,len(errors),3))/(len(errors)/3)
            assert mean<7 and fraction<.08,(case['name'],frame['time'],mean,fraction)
            metrics.append({'time':frame['time'],'mae':mean,'fractionPixelsAbove35':fraction})
        volumes={str(at):audio(output,at) for at in [.2,7.5,8.3,9.5,10.5,11.5]}
        for at in ['8.3','9.5']:
            assert volumes[at]<5 if case['name']=='muted-main' else volumes[at]>1000,volumes
        for at in ['0.2','7.5']:
            assert volumes[at]>1000 if case['name'] in ['spoken-intro','muted-main'] else volumes[at]<5,volumes
        for at in ['10.5','11.5']:assert volumes[at]<5,volumes
        REPORT['cases'].append({'name':case['name'],'status':'passed','duration':12,'frames':metrics,'audioRms':volumes})
        print('Passed',case['name'],'12s MP4, 9 frames and delayed/padded real audio')
    REPORT['status']='passed'
except Exception as error:
    REPORT['status']='failed';REPORT['error']=str(error);raise
finally:
    (OUT/'report.json').write_text(json.dumps(REPORT,indent=2));print('Report:',OUT/'report.json')
