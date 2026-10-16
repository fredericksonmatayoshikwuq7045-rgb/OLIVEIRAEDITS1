"""Real Canvas→static planes→Rust→FFmpeg pixel regression (no desktop IPC mock)."""
import base64
import json
import os
import struct
import subprocess
import tempfile
import zlib
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = Path(os.environ.get("OE_PARITY_TEST_DIR", tempfile.mkdtemp(prefix="oe-parity-")))
ARTIFACTS.mkdir(parents=True, exist_ok=True)
FFMPEG = os.environ.get("FFMPEG_PATH", "ffmpeg")
HARNESS = os.environ.get("OLIVEIRA_ENGINE_HARNESS", str(ROOT / "src-tauri/target/debug/examples/engine_harness"))


def run(args, **kwargs):
    result = subprocess.run(args, capture_output=True, timeout=180, **kwargs)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors="replace")[-8000:])
    return result.stdout


def png(width, height, painter):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    pixels = b"".join(b"\x00" + b"".join(bytes(painter(x, y)) for x in range(width)) for y in range(height))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(pixels)) + chunk(b"IEND", b"")


def data_uri(data):
    return "data:image/png;base64," + base64.b64encode(data).decode()


def save_data(path, uri):
    path.write_bytes(base64.b64decode(uri.split(",", 1)[1]))


def rgb(path):
    return run([FFMPEG, "-nostdin", "-v", "error", "-i", str(path), "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"])


def compare(expected, actual):
    left, right = rgb(expected), rgb(actual)
    assert len(left) == len(right), "Resolução preview/export divergente"
    errors = [abs(a - b) for a, b in zip(left, right)]
    mean_error = sum(errors) / len(errors)
    bad_pixels = sum(max(errors[i:i + 3]) > 35 for i in range(0, len(errors), 3)) / (len(errors) / 3)
    return {"meanAbsoluteChannelError": mean_error, "fractionPixelsAbove35": bad_pixels,
            "passed": mean_error < 7 and bad_pixels < 0.08}


report = {"artifacts": str(ARTIFACTS), "cases": []}
try:
    source = png(192, 128, lambda x, y: ([230, 30, 30, 255] if x < 96 and y < 64 else
        [20, 210, 40, 255] if y < 64 else [20, 60, 220, 255] if x < 96 else [230, 210, 20, 255]))
    source_png = ARTIFACTS / "source.png"
    source_png.write_bytes(source)
    source_video = ARTIFACTS / "source.mp4"
    run([FFMPEG, "-nostdin", "-v", "error", "-y", "-loop", "1", "-i", str(source_png),
         "-t", "2", "-r", "12", "-c:v", "libx264rgb", "-crf", "0", "-threads", "2", str(source_video)])
    graphic = png(40, 24, lambda x, y: [255, 255, 255, 200] if x < 18 else [240, 30, 140, 220])
    dynamic_video = ARTIFACTS / "dynamic.mp4"
    run([FFMPEG, "-nostdin", "-v", "error", "-y", "-loop", "1", "-i", str(source_png),
         "-t", "2", "-r", "12", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-threads", "2", str(dynamic_video)])
    video_uri = "data:video/mp4;base64," + base64.b64encode(dynamic_video.read_bytes()).decode()
    browser_input = {"source": data_uri(source), "graphic": data_uri(graphic), "video": video_uri}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
            headless=True, args=["--no-sandbox"])
        page = browser.new_page()
        page.goto(os.environ.get("OE_TEST_URL", "http://127.0.0.1:3000"), wait_until="domcontentloaded")
        cases = page.evaluate("""async ({source, graphic, video}) => {
          const {composeCanvas, compileStaticPlanes} = await import('/src/render/compositor.ts');
          const {createRenderSpec, createTextLayer} = await import('/src/render/types.ts');
          const {computeGeometry} = await import('/src/render/geometry.ts');
          const blobUri = blob => new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.onload = () => resolve(reader.result);
            reader.onerror = reject; reader.readAsDataURL(blob);
          });
          const cases = [];
          for (const name of ['contain', 'crop-cover', 'rotate90', 'rotate37', 'circle-flip', 'gradient', 'background-opacity', 'blur', 'dynamic-video']) {
            const spec = createRenderSpec(320, 240, source);
            Object.assign(spec.media, {type:'image', width:192, height:128, fit:'contain'});
            if (name === 'crop-cover') Object.assign(spec.media, {fit:'cover', crop:{x:.1,y:.1,width:.7,height:.7}, pan:{x:.06,y:-.04}});
            if (name === 'rotate90') spec.media.rotation = 90;
            if (name === 'rotate37') Object.assign(spec.media, {rotation:37, zoom:.8, flipV:true});
            if (name === 'circle-flip') Object.assign(spec.media, {mask:'circle', flipH:true, zoom:.8});
            if (name === 'gradient') {
              spec.background = {type:'gradient',from:'#203040',to:'#901020',angle:37};
              spec.media.zoom = .65;
            }
            if (name === 'background-opacity') {
              spec.background = {type:'image',source:graphic,width:40,height:24,opacity:.4,loop:true,audio:'mute'};
              spec.media.zoom = .65;
            }
            if (name === 'blur') { spec.background = {type:'blur',radius:.025}; spec.media.zoom=.65; }
            const text = createTextLayer('headline');
            Object.assign(text, {text:'OLIVEIRA EDITS texto em duas linhas',fontSize:.07,
              rect:{x:.05,y:.72,width:.7,height:.2},zIndex:40});
            text.stroke = {color:'#000000',width:.003};
            spec.layers = [text, {id:'graphic',type:'image',source:graphic,sourceWidth:40,sourceHeight:24,
              rect:{x:.72,y:.08,width:.2,height:.2},fit:'contain',rotation:20,opacity:.8,zIndex:5,visible:true}];
            if (name === 'dynamic-video') spec.layers.push({id:'dynamic',type:'video',source:video,
              sourceWidth:192,sourceHeight:128,rect:{x:.65,y:.2,width:.25,height:.5},fit:'contain',
              rotation:35,opacity:.7,zIndex:25,visible:true});
            const expected = (await composeCanvas(spec)).toDataURL();
            const planes = [];
            for (const plane of await compileStaticPlanes(spec)) planes.push({zIndex:plane.zIndex,png:await blobUri(plane.png)});
            cases.push({name,spec,geometry:computeGeometry(spec),expected,planes});
          }
          return cases;
        }""", browser_input)
        browser.close()
    items = []
    for case in cases:
        expected = ARTIFACTS / (case["name"] + "-preview.png")
        save_data(expected, case["expected"])
        overlays = []
        for index, plane in enumerate(case["planes"]):
            path = ARTIFACTS / f'{case["name"]}-plane-{index}.png'
            save_data(path, plane["png"])
            overlays.append({"path": str(path), "zIndex": plane["zIndex"]})
        spec = case["spec"]
        spec["geometry"] = case["geometry"]
        spec["layers"] = [dict(layer, source=str(dynamic_video)) for layer in spec["layers"] if layer["type"] == "video"]
        if spec["background"]["type"] == "image":
            background = ARTIFACTS / "graphic.png"
            background.write_bytes(graphic)
            spec["background"]["source"] = str(background)
        items.append({"id": case["name"], "sourcePath": str(source_video),
            "outputPath": str(ARTIFACTS / (case["name"] + ".mp4")), "render": spec,
            "trim": {"start": 0, "duration": 1}, "overlays": overlays, "preset": "high",
            "cleanMetadata": True, "conflict": "overwrite", "mode": "render", "speed": 1})
    request = ARTIFACTS / "request.json"
    request.write_text(json.dumps({"job": {"items": items, "concurrency": 1}}))
    states = json.loads(run([HARNESS, str(request)]))["items"]
    for case in cases:
        state = next(state for state in states if state["id"] == case["name"])
        assert state["status"] == "ok", state.get("error")
        stats = compare(ARTIFACTS / (case["name"] + "-preview.png"), state["outputPath"])
        report["cases"].append({"name": case["name"], **stats})
        print(f'{"✓" if stats["passed"] else "✗"} {case["name"]}: erro médio {stats["meanAbsoluteChannelError"]:.3f}/255, pixels >35: {stats["fractionPixelsAbove35"]:.2%}')
    assert all(case["passed"] for case in report["cases"]), "Preview/export excedeu tolerâncias; consulte report.json."
except Exception as error:
    report["failure"] = str(error)
    raise
finally:
    (ARTIFACTS / "report.json").write_text(json.dumps(report, indent=2))
    print(f"Relatório: {ARTIFACTS / 'report.json'}")
