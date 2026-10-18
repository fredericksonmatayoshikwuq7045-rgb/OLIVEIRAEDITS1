"""Production Tauri test: local OCR, sampled video frames and a real branded export."""
import base64
import json
import os
import subprocess
import time
import urllib.request
import urllib.error
import uuid
from pathlib import Path

DRIVER = os.environ.get('TAURI_DRIVER_URL', 'http://127.0.0.1:4458')
OUTPUT = Path(os.environ.get('OE_NATIVE_TEST_DIR', '.artifacts/native-upgrade')).resolve()
OUTPUT.mkdir(parents=True, exist_ok=True)
SESSION = None
REPORT = {'status': 'running', 'checks': []}


def request(endpoint, data=None, method='POST'):
    raw = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(DRIVER + endpoint, raw, {'Content-Type': 'application/json'}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=150) as response:
            value = json.load(response)['value']
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error
    if isinstance(value, dict) and value.get('error'):
        raise RuntimeError(value)
    return value


def execute(code, value=None):
    script = 'const input=arguments[0],done=arguments[arguments.length-1];(async()=>{' + code + '})().then(value=>done({ok:true,value}),error=>done({ok:false,error:String(error)}));'
    result = request('/session/' + SESSION + '/execute/async', {'script': script, 'args': [value]})
    if not result.get('ok'):
        raise RuntimeError(result.get('error'))
    return result.get('value')


def invoke(command, args=None):
    return execute('return window.__TAURI_INTERNALS__.invoke(input.command,input.args);', {'command': command, 'args': args or {}})


def until(condition, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = condition()
        if value:
            return value
        time.sleep(.1)
    raise AssertionError('Timed out: ' + str(execute('return document.body.innerText;')))


def click(text):
    until(lambda: execute("const button=[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===input&&!button.disabled);if(!button)return false;button.click();return true;", text))


def field(label, value):
    result = execute("const label=[...document.querySelectorAll('label')].find(label=>label.textContent.includes(input.label)&&label.querySelector('input,select'));if(!label)throw new Error('Missing field '+input.label);const node=label.querySelector('input,select');Object.getOwnPropertyDescriptor(node.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(node,input.value);node.dispatchEvent(new Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));return true;", {'label': label, 'value': value})
    assert result


try:
    application = os.environ.get('TAURI_APP_BINARY', '/workspace/.cloud-onboarding/oliveira-edits/native-test/launch.sh')
    SESSION = request('/session', {'capabilities': {'alwaysMatch': {'tauri:options': {'application': application}}}})['sessionId']
    request('/session/' + SESSION + '/timeouts', {'script': 140000})
    url = request('/session/' + SESSION + '/url', method='GET')
    assert '3000' not in url, 'This check requires the production custom protocol, not Vite.'
    REPORT['url'] = url
    until(lambda: execute("return !!document.querySelector('button[aria-label^=\"Abrir editor de\"]');"))
    execute("window.__oeErrors=[];window.addEventListener('error',event=>window.__oeErrors.push(event.message));return true;")
    index = json.loads(invoke('storage_read_json', {'relativePath': 'settings.json'}))
    profile_id = index['activeProfileId']
    project_id = index['activeProjectByProfile'][profile_id]
    profile = json.loads(invoke('storage_read_json', {'relativePath': f'profiles/{profile_id}/profile.json'}))
    project = json.loads(invoke('storage_read_json', {'relativePath': f'projects/{project_id}.json'}))
    encoded = execute("const c=document.createElement('canvas');c.width=1000;c.height=200;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,1000,200);x.font='bold 80px Arial';x.fillStyle='black';x.fillText('MARCA ANTIGA',30,120);return c.toDataURL().split(',')[1];")
    frame_file = OUTPUT / 'frame.png'
    frame_file.write_bytes(base64.b64decode(encoded))
    fixture = OUTPUT / 'marked.mp4'
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-loop', '1', '-i', str(frame_file), '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-pix_fmt', 'yuv420p', str(fixture)], check=True)
    source = invoke('storage_write_asset', {'relativePath': f'profiles/{profile_id}/assets/native-marked.mp4', 'bytes': list(fixture.read_bytes())})
    probe = invoke('probe_media', {'path': source})
    samples = invoke('sample_media_frames', {'path': source, 'times': [.2, 1.2], 'width': 1280})
    assert len(samples) == 2
    assert all(Path(sample['path']).read_bytes().startswith(b'\x89PNG\r\n\x1a\n') for sample in samples)
    try:
        invoke('sample_media_frames', {'path': str(Path('00bb.png').resolve()), 'times': [0], 'width': 480})
    except RuntimeError as error:
        assert 'autoriza' in str(error).lower(), error
    else:
        raise AssertionError('Sampling accepted a file outside the native grants.')
    REPORT['checks'].append('Production native sampling returns real cached frames and preserves path authorization')
    token = str(uuid.uuid4())
    project['items'] = [{'id': token, 'slot': 1, 'kind': 'video', 'title': 'native-marked.mp4', 'sourcePath': source, 'status': 'ready', 'probe': probe,
        'render': {'version': 1, 'canvas': {'width': 1080, 'height': 1920}, 'background': {'type': 'solid', 'color': '#111111'},
        'media': {'type': 'video', 'source': source, 'width': probe['width'], 'height': probe['height'], 'fit': 'contain', 'crop': {'x': 0, 'y': 0, 'width': 1, 'height': 1}, 'zoom': 1, 'pan': {'x': 0, 'y': 0}, 'rotation': 0, 'flipH': False, 'flipV': False, 'mask': 'none', 'opacity': 1, 'zIndex': 10}, 'layers': []},
        'trim': {'in': 0, 'out': probe['duration']}, 'speed': 1, 'templates': {'border': None, 'watermark': None, 'headline': None, 'background': None}}]
    invoke('storage_write_json', {'relativePath': f'projects/{project_id}.json', 'contents': json.dumps(project)})
    request('/session/' + SESSION + '/refresh', {})
    until(lambda: execute("const node=document.querySelector('button[aria-label=\"Abrir editor de '+input+'\"]');if(!node)return false;node.click();return true;", profile['name']))
    execute("document.querySelector('button[aria-label=\"Ações em lote\"]').click();return true;")
    click('Assistente em lote')
    field('O que analisar', 'mark')
    field('Texto da marca antiga', 'MARCA ANTIGA')
    field('Minha marca em texto', 'MEU ESTUDIO')
    click('Analisar seleção')
    until(lambda: execute("return [...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Aplicar 1 resultado(s)'&&!button.disabled);"), timeout=120)
    click('Aplicar 1 resultado(s)')
    until(lambda: execute("return document.querySelector('.save-status')?.textContent==='Salvo';"))
    persisted = json.loads(invoke('storage_read_json', {'relativePath': f'projects/{project_id}.json'}))
    layers = persisted['items'][0]['render']['layers']
    plate = next(layer for layer in layers if layer['id'] == 'auto-cover-plate')
    assert next(layer for layer in layers if layer['id'] == 'auto-cover-text')['text'] == 'MEU ESTUDIO'
    REPORT['checks'].append('Bundled WebKit runs local OCR from the production protocol and persists the detected coverage')
    paths = invoke('storage_get_paths')
    invoke('storage_write_json', {'relativePath': 'native-upgrade/output/keep.json', 'contents': '{}'})
    destination = paths['dataDir'] + '/native-upgrade/output'
    click('Exportar')
    field('Pasta de saída', destination)
    click('Exportar 1 mídias')
    def finished():
        for job in invoke('get_queue_state'):
            if any(item['id'] == token for item in job['items']) and job['status'] in ['completed', 'cancelled']:
                return job
        return None
    job = until(finished, timeout=60)
    result = next(item for item in job['items'] if item['id'] == token)
    assert result['status'] == 'ok', result
    output = Path(result['outputPath'])
    metadata = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(output)]))
    video = next(stream for stream in metadata['streams'] if stream['codec_type'] == 'video')
    assert [video['width'], video['height'], video['codec_name'], video['pix_fmt']] == [1080, 1920, 'h264', 'yuv420p']
    rect = plate['rect']
    crop = f"crop={max(2, int(rect['width']*1080))}:{max(2, int(rect['height']*1920))}:{int(rect['x']*1080)}:{int(rect['y']*1920)},format=gray"
    pixels = subprocess.check_output(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(output), '-vf', crop, '-frames:v', '1', '-f', 'rawvideo', 'pipe:1'])
    assert sum(pixels) / len(pixels) < 180, 'The opaque coverage is missing from the encoded output.'
    REPORT['checks'].append('Real H.264 export through the UI contains the opaque coverage and new branding')
    REPORT['status'] = 'passed'
    REPORT['job'] = job
    screenshot = request('/session/' + SESSION + '/screenshot', method='GET')
    (OUTPUT / 'native-export.png').write_bytes(base64.b64decode(screenshot))
    print(json.dumps({'status': REPORT['status'], 'checks': REPORT['checks']}, indent=2))
except Exception as error:
    REPORT['status'] = 'failed'
    REPORT['error'] = str(error)
    raise
finally:
    (OUTPUT / 'report.json').write_text(json.dumps(REPORT, indent=2))
    if SESSION:
        request('/session/' + SESSION, method='DELETE')
