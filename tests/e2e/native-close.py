"""Linux native window close request with a live queue, through WM_DELETE_WINDOW."""
import ctypes
import json
import os
import re
import subprocess
import time
import urllib.request
import uuid
from pathlib import Path

report_path = Path(os.environ.get('OE_NATIVE_REPORT', '.artifacts/native-final/report.json'))
report = json.loads(report_path.read_text())
base = os.environ.get('TAURI_DRIVER_URL', 'http://127.0.0.1:4450') + '/session/' + report['sessionId']


def request(endpoint, data=None):
    req = urllib.request.Request(base + endpoint, data=json.dumps(data or {}).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)['value']


def js(script):
    return request('/execute/sync', {'script': script, 'args': []})


def invoke(command, args=None):
    result = request('/execute/async', {'script': '''const done=arguments[arguments.length-1];
      window.__TAURI_INTERNALS__.invoke(arguments[0],arguments[1]).then(value=>done({value}),error=>done({error:String(error)}));''', 'args': [command, args or {}]})
    if 'error' in result:
        raise RuntimeError(result['error'])
    return result.get('value')


def wait(predicate):
    end = time.monotonic() + 15
    while time.monotonic() < end:
        if predicate():
            return
        time.sleep(0.05)
    raise AssertionError('A janela não respondeu ao pedido de fechamento.')


def close_window():
    windows = subprocess.check_output(['xwininfo', '-root', '-tree'], text=True)
    match = re.search(r'(0x[0-9a-f]+) "Oliveira Edits"', windows)
    assert match, 'Janela de teste nativa não encontrada'
    window = int(match[1], 16)
    class Data(ctypes.Union):
        _fields_ = [('l', ctypes.c_long * 5), ('b', ctypes.c_char * 20)]
    class Message(ctypes.Structure):
        _fields_ = [('type', ctypes.c_int), ('serial', ctypes.c_ulong), ('send_event', ctypes.c_int),
            ('display', ctypes.c_void_p), ('window', ctypes.c_ulong), ('message_type', ctypes.c_ulong), ('format', ctypes.c_int), ('data', Data)]
    class Event(ctypes.Union):
        _fields_ = [('message', Message), ('padding', ctypes.c_long * 24)]
    x11 = ctypes.CDLL('libX11.so.6')
    x11.XOpenDisplay.restype = ctypes.c_void_p
    x11.XInternAtom.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
    x11.XInternAtom.restype = ctypes.c_ulong
    x11.XSendEvent.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_long, ctypes.POINTER(Event)]
    x11.XFlush.argtypes = [ctypes.c_void_p]
    x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
    display = x11.XOpenDisplay(None)
    assert display, 'DISPLAY indisponível'
    event = Event()
    event.message.type = 33
    event.message.display = display
    event.message.window = window
    event.message.message_type = x11.XInternAtom(display, b'WM_PROTOCOLS', 0)
    event.message.format = 32
    event.message.data.l[0] = x11.XInternAtom(display, b'WM_DELETE_WINDOW', 0)
    x11.XSendEvent(display, window, 0, 0, ctypes.byref(event))
    x11.XFlush(display)
    x11.XCloseDisplay(display)


paths = invoke('storage_get_paths')
item = report['job']['request']['items'][0]
token = str(uuid.uuid4())
item.update({'id': 'close-a', 'encoder': 'libx264', 'outputPath': str(Path(item['outputPath']).parent / (token + '-a.mp4'))})
second = {**item, 'id': 'close-b', 'outputPath': str(Path(item['outputPath']).parent / (token + '-b.mp4'))}
job_id = invoke('start_export', {'job': {'items': [item, second], 'concurrency': 1, 'finishAction': 'none'}})
invoke('pause_export', {'jobId': job_id, 'paused': True})
close_window()
wait(lambda: js("return document.body.innerText.includes('Fechar o aplicativo?');"))
js("Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Continuar trabalhando').click();return true;")
wait(lambda: not js("return document.body.innerText.includes('Fechar o aplicativo?');"))
assert next(job for job in invoke('get_queue_state') if job['id'] == job_id)['status'] == 'paused'
close_window()
wait(lambda: js("return document.body.innerText.includes('Fechar o aplicativo?');"))
js("Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Salvar, cancelar fila e sair').click();return true;")
queue_file = Path(paths['cacheDir']) / 'export-engine/queue.json'
def cancelled_on_disk():
    state = next(job for job in json.loads(queue_file.read_text()) if job['id'] == job_id)
    return state['status'] == 'cancelled'
wait(cancelled_on_disk)
wait(lambda: not re.search(r'(0x[0-9a-f]+) "Oliveira Edits"', subprocess.check_output(['xwininfo', '-root', '-tree'], text=True)))
assert not list(Path(item['outputPath']).parent.glob('*.part'))
assert Path(item['sourcePath']).is_file()
json.loads((Path(paths['dataDir']) / 'settings.json').read_text())
print(json.dumps({'status': 'passed', 'checks': ['Fechar com fila pede confirmação', 'Continuar mantém fila pausada',
    'Sair cancela, persiste fila e limpa parciais antes de fechar', 'Origem e JSON do projeto preservados']}, ensure_ascii=False, indent=2))
