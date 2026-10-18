"""Real production WebKit: import video templates as File, edit timing, export MP4 and a chosen still frame."""
import base64
import http.client
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

DRIVER = os.environ.get('TAURI_DRIVER_URL', 'http://127.0.0.1:4468')
OUTPUT = Path(os.environ.get('OE_NATIVE_TEST_DIR', '.artifacts/native-layer-timeline')).resolve()
OUTPUT.mkdir(parents=True, exist_ok=True)
SESSION = None
REPORT = {'status': 'running', 'checks': []}


def request(endpoint, data=None, method='POST'):
    raw = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(DRIVER+endpoint, raw, {'Content-Type': 'application/json'}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            value = json.load(response)['value']
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error
    if isinstance(value, dict) and value.get('error'):
        raise RuntimeError(value)
    return value


def execute(code, value=None, asynchronous=False):
    if asynchronous:
        endpoint = 'async'
        script = 'const input=arguments[0],done=arguments[arguments.length-1];(async()=>{'+code+'})().then(value=>done({ok:true,value}),error=>done({ok:false,error:String(error)}));'
    else:
        endpoint = 'sync'
        script = 'const input=arguments[0];try{return {ok:true,value:(()=>{'+code+'})()};}catch(error){return {ok:false,error:String(error)};}'
    result = request('/session/'+SESSION+'/execute/'+endpoint, {'script': script, 'args': [value]})
    if not result.get('ok'):
        raise RuntimeError(result.get('error'))
    return result.get('value')

def invoke(command, args=None):
    # WebKitWebDriver may close a connection during startup; only retry reads.
    for attempt in range(3):
        try:
            return execute('return window.__TAURI_INTERNALS__.invoke(input.command,input.args);', {'command': command, 'args': args or {}}, asynchronous=True)
        except http.client.RemoteDisconnected:
            if command not in ['storage_read_json', 'storage_get_paths', 'get_queue_state'] or attempt == 2:
                raise
            time.sleep(.1 * (attempt + 1))


def until(condition, timeout=40):
    deadline = time.monotonic()+timeout
    while time.monotonic() < deadline:
        value = condition()
        if value:
            return value
        time.sleep(.1)
    raise AssertionError('Timed out: '+str(execute('return document.body.innerText;')))


def click(text):
    until(lambda: execute("const node=[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===input&&!node.disabled);if(!node)return false;node.click();return true;", text))


def field(label, value, commit=False):
    execute("const label=[...document.querySelectorAll('label')].find(label=>label.querySelector('input,select')&&label.textContent.includes(input.label));if(!label)throw new Error('Missing '+input.label);const node=label.querySelector('input,select');node.focus();Object.getOwnPropertyDescriptor(node.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(node,String(input.value));node.dispatchEvent(new Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));return true;", {'label': label, 'value': value})
    if commit:
        execute("document.activeElement.blur();return true;")


def tab(name):
    execute("const node=[...document.querySelectorAll('[role=tab]')].find(node=>node.textContent.trim().startsWith(input));if(!node)throw new Error('Missing tab');node.click();return true;", name)


def select_layer():
    until(lambda: execute("const node=[...document.querySelectorAll('.timeline-track-row')].find(node=>node.textContent.includes('stamp.mp4'));if(!node)return false;node.querySelector('.timeline-track-name').click();return true;"))


def color(path, at, channel):
    args = ['ffmpeg', '-nostdin', '-v', 'error'] + (['-ss', str(at)] if at is not None else [])
    pixels = subprocess.check_output(args+['-i', str(path), '-vf', 'crop=8:8:849:243', '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
    means = [sum(pixels[index::3])/len(pixels[index::3]) for index in range(3)]
    if channel < 0:
        assert max(means) < 80, means
    else:
        assert means[channel] > 170 and means[(channel+1) % 3] < 100 and means[(channel+2) % 3] < 100, means


def run(args):
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error']+args, check=True)


try:
    application = os.environ.get('TAURI_APP_BINARY', '/workspace/.cloud-onboarding/oliveira-edits/native-test/launch.sh')
    SESSION = request('/session', {'capabilities': {'alwaysMatch': {'tauri:options': {'application': application}}}})['sessionId']
    request('/session/'+SESSION+'/timeouts', {'script': 100000})
    url = request('/session/'+SESSION+'/url', method='GET')
    assert '3000' not in url
    REPORT['url'] = url
    (OUTPUT/'session.txt').write_text(SESSION)
    until(lambda: execute("return !!document.querySelector('button[aria-label^=\"Abrir editor de\"]');"))
    index = json.loads(until(lambda: invoke('storage_read_json', {'relativePath': 'settings.json'})))
    account = index['activeProfileId']
    project_id = index['activeProjectByProfile'][account]
    profile = json.loads(invoke('storage_read_json', {'relativePath': f'profiles/{account}/profile.json'}))
    project = json.loads(invoke('storage_read_json', {'relativePath': f'projects/{project_id}.json'}))
    photo = OUTPUT/'photo.png'
    frame = execute("const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');x.fillStyle='#303030';x.fillRect(0,0,320,180);return c.toDataURL().split(',')[1];")
    photo.write_bytes(base64.b64decode(frame))
    clip, stamp = OUTPUT/'clip.mp4', OUTPUT/'stamp.mp4'
    run(['-loop', '1', '-i', str(photo), '-t', '6', '-r', '20', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-pix_fmt', 'yuv420p', str(clip)])
    run(['-f', 'lavfi', '-i', 'color=c=red:s=64x64:r=20', '-vf', "drawbox=c=blue:t=fill:enable='gte(t,0.5)',drawbox=c=lime:t=fill:enable='gte(t,1.5)'", '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', str(stamp)])
    items = []
    for file, kind in [(clip, 'video'), (photo, 'image')]:
        source = invoke('storage_write_asset', {'relativePath': f'profiles/{account}/assets/{file.name}', 'bytes': list(file.read_bytes())})
        probe = invoke('probe_media', {'path': source})
        items.append({'id': str(uuid.uuid4()), 'slot': len(items)+1, 'kind': kind, 'title': file.name, 'sourcePath': source, 'status': 'ready', 'probe': probe, 'trim': {'in': 0, 'out': probe['duration'] if kind == 'video' else 0}, 'speed': 1, 'templates': dict.fromkeys(['border', 'watermark', 'headline', 'background']), 'render': {'version': 1, 'canvas': {'width': 1080, 'height': 1920}, 'background': {'type': 'solid', 'color': '#111111'}, 'media': {'type': kind, 'source': source, 'width': 320, 'height': 180, 'fit': 'contain', 'crop': {'x': 0, 'y': 0, 'width': 1, 'height': 1}, 'zoom': 1, 'pan': {'x': 0, 'y': 0}, 'rotation': 0, 'flipH': False, 'flipV': False, 'mask': 'none', 'opacity': 1, 'zIndex': 10}, 'layers': []}})
    # A loopback URL is issued only after native path authorization.
    try:
        invoke('storage_media_url', {'path': str(Path(__file__).resolve())})
        raise AssertionError('ungranted path accepted')
    except RuntimeError as error:
        assert 'autorizado' in str(error), error
    local_url = invoke('storage_media_url', {'path': items[0]['sourcePath']})
    if local_url:  # Linux transport; other platforms keep the Tauri asset URL.
        req = urllib.request.Request(local_url, headers={'Range': 'bytes=0-15'})
        with urllib.request.urlopen(req) as response:
            assert response.status == 206 and response.read() == clip.read_bytes()[:16]
        try:
            urllib.request.urlopen(urllib.request.Request(local_url, headers={'Origin': 'https://untrusted.test'}))
            raise AssertionError('foreign origin accepted')
        except urllib.error.HTTPError as error:
            assert error.code == 403
        REPORT['checks'].append('Authorized loopback stream serves exact byte ranges, rejects foreign origins and refuses ungranted paths')
    project['items'] = items
    invoke('storage_write_json', {'relativePath': f'projects/{project_id}.json', 'contents': json.dumps(project)})
    request('/session/'+SESSION+'/refresh', {})
    execute("window.__oeViolations=[];window.addEventListener('securitypolicyviolation',e=>window.__oeViolations.push(e.effectiveDirective));window.__nativeVideos=[];const create=document.createElement.bind(document);document.createElement=function(tag,...rest){const node=create(tag,...rest);if(String(tag).toLowerCase()==='video')window.__nativeVideos.push(node);return node;};return true;")
    until(lambda: execute("const node=document.querySelector('button[aria-label=\"Abrir editor de '+input+'\"]');if(!node)return false;node.click();return true;", profile['name']))
    until(lambda: execute("const c=document.querySelector('.stage-preview canvas');return c&&c.getAttribute('aria-busy')==='false';"), 60)
    tab('Vídeos')
    click('Marca')
    field('Tipo de template', 'video')
    execute("const bytes=Uint8Array.from(atob(input),char=>char.charCodeAt(0)),file=new File([bytes],'stamp.mp4',{type:'video/mp4'}),transfer=new DataTransfer();transfer.items.add(file);const node=document.querySelector('input[aria-label=\"Arquivo do template\"]');node.files=transfer.files;node.dispatchEvent(new Event('change',{bubbles:true}));return true;", base64.b64encode(stamp.read_bytes()).decode())
    until(lambda: execute("return [...document.querySelectorAll('.library .template-card')].some(node=>node.textContent.includes('stamp.mp4'));"))
    execute("[...document.querySelectorAll('.library .template-card')].find(node=>node.textContent.includes('stamp.mp4')).click();return true;")
    select_layer()
    field('Aparecer em (s)', 1, True)
    field('Desaparecer em (s)', 3, True)
    field('Começar no segundo do template', .5, True)
    execute("const node=document.querySelector('input[aria-label=\"Posição de reprodução\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'1.2');node.dispatchEvent(new Event('input',{bubbles:true}));return true;")
    until(lambda: execute("const c=document.querySelector('.stage-preview canvas');if(!c||c.getAttribute('aria-busy')==='true')return false;const p=c.getContext('2d').getImageData(853,247,1,1).data;return p[2]>170&&p[0]<100&&p[1]<100;"))
    until(lambda: execute("return document.querySelector('.save-status')?.textContent==='Salvo';"))
    persisted = json.loads(invoke('storage_read_json', {'relativePath': f'profiles/{account}/profile.json'}))
    assert persisted['templates'][0]['mediaType'] == 'video' and persisted['templates'][0]['sourceDuration'] == 3
    REPORT['checks'].append('Production WebKit imports a File video template through managed assets and native probe, and previews the timed/offset layer')
    invoke('storage_write_json', {'relativePath': 'native-layers/output/keep.json', 'contents': '{}'})
    destination = invoke('storage_get_paths')['dataDir']+'/native-layers/output'
    click('Exportar')
    field('Pasta de saída', destination)
    click('Exportar 1 mídias')
    def completed():
        return next((job for job in invoke('get_queue_state') if any(item['id'] == items[0]['id'] for item in job['items']) and job['status'] in ['completed', 'cancelled']), None)
    job = until(completed, 90)
    result = next(item for item in job['items'] if item['id'] == items[0]['id'])
    assert result['status'] == 'ok', result
    color(result['outputPath'], .2, -1)
    color(result['outputPath'], 1.2, 2)
    color(result['outputPath'], 3.8, -1)
    REPORT['checks'].append('UI export produces a real MP4: template absent before/after its interval and correct blue source frame inside')
    execute("document.querySelector('.modal button[aria-label=Fechar]').click();return true;")
    execute("document.querySelector('button[aria-label=\"Editar template stamp.mp4\"]').click();return true;")
    execute("[...document.querySelectorAll('label')].find(node=>node.textContent.includes('Disponível nas alas')).querySelector('input').click();return true;")
    click('Salvar template')
    tab('Imagens')
    execute("[...document.querySelectorAll('.library .template-card')].find(node=>node.textContent.includes('stamp.mp4')).click();return true;")
    select_layer()
    field('Aparecer em (s)', 1, True)
    field('Desaparecer em (s)', 3, True)
    field('Começar no segundo do template', .5, True)
    field('Momento da imagem exportada (s)', 2, True)
    click('Exportar')
    click('Exportar 1 mídias')
    output = until(lambda: next((file for file in Path(destination).glob('*.png') if file.stat().st_size > 0), None))
    color(output, None, 1)
    until(lambda: execute("return document.querySelector('.save-status')?.textContent==='Salvo';"))
    persisted = json.loads(invoke('storage_read_json', {'relativePath': f'projects/{project_id}.json'}))
    assert next(item for item in persisted['items'] if item['kind'] == 'image')['imageTime'] == 2
    assert len(persisted['items']) == 2
    REPORT['checks'].append('Separate image area exports a real PNG at the chosen animated-template frame and preserves both media kinds')
    REPORT['status'] = 'passed'
    REPORT['videoOutput'] = result['outputPath']
    REPORT['imageOutput'] = str(output)
    (OUTPUT/'desktop.png').write_bytes(base64.b64decode(request('/session/'+SESSION+'/screenshot', method='GET')))
    print(json.dumps(REPORT, indent=2))
except Exception as error:
    REPORT['status'] = 'failed'
    REPORT['error'] = str(error)
    if SESSION:
        REPORT['body'] = execute('return document.body.innerText;')
        REPORT['policyViolations'] = execute("return window.__oeViolations||[];")
        REPORT['videoDiagnostics'] = execute("return (window.__nativeVideos||[]).map(node=>({http:node.src.startsWith('http://127.0.0.1:'),ready:node.readyState,error:node.error?.message,code:node.error?.code,duration:node.duration}));")
        REPORT['canvas'] = execute("const c=document.querySelector('.stage-preview canvas');return c?{width:c.width,height:c.height,busy:c.getAttribute('aria-busy'),pixel:[...c.getContext('2d').getImageData(853,247,1,1).data]}:null;")
        try:
            (OUTPUT/'failure.png').write_bytes(base64.b64decode(request('/session/'+SESSION+'/screenshot',method='GET')))
        except Exception:
            pass
    raise
finally:
    (OUTPUT/'report.json').write_text(json.dumps(REPORT, indent=2))
    if SESSION and not os.environ.get('OE_NATIVE_KEEP_SESSION'):
        request('/session/'+SESSION, method='DELETE')
