"""Exercise real Tauri IPC through tauri-driver; never requests an OS power action."""
import base64
import json
import os
import subprocess
import tempfile
import time
import urllib.request
import urllib.error
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DRIVER = os.environ.get('TAURI_DRIVER_URL', 'http://127.0.0.1:4446')
SESSION = os.environ.get('OE_NATIVE_SESSION')
ARTIFACTS = Path(os.environ.get('OE_NATIVE_TEST_DIR', tempfile.mkdtemp(prefix='oe-native-')))
ARTIFACTS.mkdir(parents=True, exist_ok=True)
REPORT = {'artifacts': str(ARTIFACTS), 'checks': []}


def request(endpoint, data=None, method='POST'):
    body = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(DRIVER + endpoint, data=body, headers={'Content-Type': 'application/json'}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            value = json.load(response).get('value')
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error
    if isinstance(value, dict) and value.get('error'):
        raise RuntimeError(value)
    return value


def execute(script, args=None):
    value = request('/session/' + SESSION + '/execute/async', {'script': script, 'args': args or []})
    if not value.get('ok'):
        raise RuntimeError(value.get('error'))
    return value.get('value')


def invoke(command, args=None):
    return execute('''const done=arguments[arguments.length-1];
      window.__TAURI_INTERNALS__.invoke(arguments[0],arguments[1]).then(
        value=>done({ok:true,value}),error=>done({ok:false,error:String(error)}));''', [command, args or {}])


def await_job(job_id, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        state = next(item for item in invoke('get_queue_state') if item['id'] == job_id)
        if state['status'] in ('completed', 'cancelled'):
            return state
        time.sleep(0.05)
    raise AssertionError('A fila nativa não terminou dentro do limite.')


try:
    if not SESSION:
        binary = os.environ.get('TAURI_APP_BINARY', str(ROOT / 'src-tauri/target/debug/oliveira-edits'))
        SESSION = request('/session', {'capabilities': {'alwaysMatch': {'tauri:options': {'application': binary}}}})['sessionId']
    REPORT['sessionId'] = SESSION
    health = invoke('get_ffmpeg_info')
    assert health['available'], health
    REPORT['checks'].append('Health check nativo e encoders reais')
    fixture = ARTIFACTS / 'fixture.mp4'
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=180x320:rate=24',
        '-t', '4', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '2', str(fixture)], check=True)
    token = str(uuid.uuid4())
    source = invoke('storage_write_asset', {'relativePath': f'profiles/native-{token}/assets/fixture.mp4', 'bytes': list(fixture.read_bytes())})
    probe = invoke('probe_media', {'path': source})
    assert [probe['width'], probe['height']] == [180, 320]
    thumbnail = invoke('generate_thumbnail', {'path': source})
    assert Path(thumbnail).read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
    REPORT['checks'].append('Asset nativo, FFprobe e miniatura real em cache')
    paths = invoke('storage_get_paths')
    output_dir = paths['dataDir'] + '/native-tests/' + token
    invoke('storage_write_json', {'relativePath': f'native-tests/{token}/keep.json', 'contents': '{}'})
    item = execute('''const done=arguments[arguments.length-1]; const source=arguments[0], output=arguments[1];
      (async()=>{const {createRenderSpec}=await import('/src/render/types.ts');
        const {computeGeometry}=await import('/src/render/geometry.ts');
        const spec=createRenderSpec(240,240,source,'video');spec.media.width=180;spec.media.height=320;
        spec.media.rotation=90;spec.media.mask='circle';spec.background={type:'gradient',from:'#202040',to:'#802030',angle:35};
        return {id:'native',sourcePath:source,outputPath:output+'/edited.mp4',trim:{start:.25,duration:2},
          render:{...spec,geometry:computeGeometry(spec)},overlays:[],preset:'fast',encoder:'h264_qsv',
          cleanMetadata:true,conflict:'suffix',mode:'render',speed:1,fps:24};})().then(
        value=>done({ok:true,value}),error=>done({ok:false,error:String(error)}));''', [source, output_dir])
    job = invoke('start_export', {'job': {'items': [item], 'concurrency': 1, 'finishAction': 'none'}})
    state = await_job(job)
    result = state['items'][0]
    assert result['status'] == 'ok', result
    assert result['progress']['percent'] == 100
    assert result['outputSize'] == Path(result['outputPath']).stat().st_size
    output_probe = invoke('probe_media', {'path': result['outputPath']})
    assert [output_probe['width'], output_probe['height'], output_probe['pixFmt']] == [240, 240, 'yuv420p']
    assert abs(output_probe['duration'] - 2) < 0.15
    REPORT['checks'].append('Job real pela ponte Tauri, transformação, progresso, H.264 e saída verificada')
    REPORT['job'] = state
    preview = invoke('render_preview', {'item': {**item, 'outputPath': './ignored.mp4'}, 'seconds': 0.2, 'frame': True})
    assert Path(preview).read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
    REPORT['checks'].append('Prévia FFmpeg sem exigir pasta de saída')
    try:
        invoke('probe_media', {'path': str(ROOT / '00bb.png')})
    except RuntimeError as error:
        assert 'autoriza' in str(error).lower(), error
    else:
        raise AssertionError('A ponte nativa abriu caminho externo sem concessão.')
    REPORT['checks'].append('Arquivo fora do escopo é recusado')
    png = list(Path(preview).read_bytes())
    image = invoke('storage_write_asset', {'relativePath': f'profiles/native-{token}/assets/original.png', 'bytes': png})
    original = Path(image).read_bytes()
    try:
        invoke('storage_export_image', {'sourcePath': image, 'outputDir': str(Path(image).parent), 'filename': 'original.png', 'bytes': png, 'conflict': 'overwrite'})
    except RuntimeError as error:
        assert 'original' in str(error).lower(), error
    else:
        raise AssertionError('A ponte permitiu sobrescrever a imagem original.')
    assert Path(image).read_bytes() == original
    REPORT['checks'].append('Exportação de imagem protege o original mesmo com sobrescrever')
    cancel_item = {**item, 'id': 'cancel-native', 'encoder': 'libx264', 'preset': 'high', 'outputPath': output_dir + '/cancel.mp4'}
    cancel_item['render'] = {**item['render'], 'canvas': {'width': 1080, 'height': 1920}}
    # Reuse production geometry inside the live webview for the new dimensions.
    cancel_item['render']['geometry'] = execute('''const done=arguments[arguments.length-1];
      import('/src/render/geometry.ts').then(({computeGeometry})=>done({ok:true,value:computeGeometry(arguments[0])}),
      error=>done({ok:false,error:String(error)}));''', [cancel_item['render']])
    cancel_job = invoke('start_export', {'job': {'items': [cancel_item], 'concurrency': 1, 'finishAction': 'none'}})
    time.sleep(0.2)
    invoke('cancel_export', {'jobId': cancel_job})
    cancelled = await_job(cancel_job)
    assert cancelled['items'][0]['status'] == 'cancelled', cancelled
    assert not Path(cancel_item['outputPath']).exists()
    assert not list(Path(output_dir).glob('*.part'))
    REPORT['checks'].append('Cancelamento pela ponte nativa remove saída parcial')
    invoke('resume_export', {'jobId': cancel_job})
    resumed = await_job(cancel_job)
    assert resumed['items'][0]['status'] == 'ok', resumed
    assert Path(resumed['items'][0]['outputPath']).is_file()
    REPORT['checks'].append('Retomar lote cancelado usa a fila e as fontes preservadas')

    REPORT['status'] = 'passed'
    print(json.dumps({'status': 'passed', 'checks': REPORT['checks']}, ensure_ascii=False, indent=2))
except Exception as error:
    REPORT['status'] = 'failed'
    REPORT['error'] = str(error)
    raise
finally:
    (ARTIFACTS / 'report.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=2))
    print('Relatório:', ARTIFACTS / 'report.json')
