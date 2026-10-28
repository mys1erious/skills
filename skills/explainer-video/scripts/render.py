# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright>=1.45", "pillow"]
# ///
# Renders a page frame by frame in headless Chrome: every frame is seek(t), so the video is exact however slow a frame is.
# usage: render.py <dir> sheet               -> <dir>/frames/sheet.png (one thumbnail per beat) + <dir>/out/sfx.json
#        render.py <dir> frames t1 t2 ...    -> <dir>/frames/t_<t>.png at full size
#        render.py <dir> video               -> <dir>/out/video_master.mp4 (silent, 30 fps, CRF 16)
#        --root DIR   serve DIR instead of <dir>, when the page loads files from a parent folder (shared data, several styles)
# Exits 1 if the page logged an error. Uses the installed Google Chrome, else Playwright's Chromium (`playwright install chromium`).
import argparse, asyncio, base64, functools, http.server, io, json, os, re, shutil, subprocess, sys, threading, time
from playwright.async_api import async_playwright

FPS = 30
ap = argparse.ArgumentParser()
ap.add_argument("dir"); ap.add_argument("mode", choices=["sheet", "frames", "video"]); ap.add_argument("times", nargs="*", type=float)
ap.add_argument("--root")
A = ap.parse_args()
D = os.path.abspath(A.dir); ROOT = os.path.abspath(A.root or D); REL = os.path.relpath(D, ROOT)
if REL.startswith(".."): sys.exit(f"--root {ROOT} must contain {D}")

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve():
    s = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s.server_address[1]

async def launch(pw):
    args = ["--enable-gpu", "--ignore-gpu-blocklist"] + (["--use-angle=metal"] if sys.platform == "darwin" else ["--enable-unsafe-swiftshader"])
    try: return await pw.chromium.launch(channel="chrome", headless=True, args=args)
    except Exception: return await pw.chromium.launch(headless=True, args=args)

async def main():
    if A.mode == "video" and not shutil.which("ffmpeg"): sys.exit("ffmpeg not found")
    port = serve()
    os.makedirs(f"{D}/frames", exist_ok=True); os.makedirs(f"{D}/out", exist_ok=True)
    async with async_playwright() as pw:
        b = await launch(pw)
        # size the page from the canvas up front: Chrome caps a viewport resized later (1833 instead of 1920)
        cw, ch = map(int, re.search(r'<canvas id="out" width="(\d+)" height="(\d+)"', open(f"{D}/index.html").read()).groups())
        page = await b.new_page(viewport={"width": cw, "height": ch}, screen={"width": cw, "height": ch}, device_scale_factor=1)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type == "error" and "favicon" not in m.text + m.location.get("url", "") and errors.append(m.text))
        await page.goto(f"http://127.0.0.1:{port}/{'' if REL == '.' else REL + '/'}index.html")
        try: await page.evaluate("window.ready")
        except Exception as e: sys.exit(f"page failed to start: {e}\n" + "\n".join(errors[:10]))
        info = await page.evaluate("({dur: DURATION, gpu: GPU, sfx: SFX, beats: BEATS, title: TITLE, music: MUSIC, marks: MARKS, w: out.width, h: out.height})")
        print("gpu:", info["gpu"], "| size:", info["w"], "x", info["h"], "| duration:", round(info["dur"], 2))
        json.dump({"duration": info["dur"], "title": info["title"], "music": info["music"], "marks": info["marks"], "sfx": info["sfx"]}, open(f"{D}/out/sfx.json", "w"), indent=1)
        cdp = await page.context.new_cdp_session(page)

        async def grab(t):
            await page.evaluate(f"seek({t})")
            r = await cdp.send("Page.captureScreenshot", {"format": "png", "optimizeForSpeed": True})
            return base64.b64decode(r["data"])

        if A.mode == "sheet":
            from PIL import Image, ImageDraw
            beats, vertical = info["beats"], info["h"] > info["w"]
            if not beats: sys.exit("init returned no beats: add [name, time] pairs for the moments to check")
            tw, th, cols = (270, 480, 7) if vertical else (480, 270, 4)
            rows = (len(beats) + cols - 1) // cols
            sheet = Image.new("RGB", (tw * cols, (th + 26) * rows), (10, 14, 24))
            dr = ImageDraw.Draw(sheet)
            for i, (name, t) in enumerate(beats):
                im = Image.open(io.BytesIO(await grab(t))).convert("RGB").resize((tw, th), Image.LANCZOS)
                x, y = (i % cols) * tw, (i // cols) * (th + 26)
                sheet.paste(im, (x, y + 26)); dr.text((x + 8, y + 6), f"{i:02d} {name}  t={t:.2f}s", fill=(255, 217, 138))
            sheet.save(f"{D}/frames/sheet.png"); print(f"{D}/frames/sheet.png")
        elif A.mode == "frames":
            for t in A.times:
                open(f"{D}/frames/t_{t:.2f}.png", "wb").write(await grab(t)); print(f"{D}/frames/t_{t:.2f}.png")
        else:
            n = int(round(info["dur"] * FPS))
            ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "png", "-i", "-",
                                   "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                                   f"{D}/out/video_master.mp4"], stdin=subprocess.PIPE)
            t0 = time.time()
            for i in range(n):
                ff.stdin.write(await grab(i / FPS))
                if i % 150 == 0: print(f"frame {i}/{n}  {time.time() - t0:.0f}s", flush=True)
            ff.stdin.close(); ff.wait()
            if ff.returncode: sys.exit("ffmpeg failed")
            print(f"video: {n} frames in {time.time() - t0:.0f}s ({(time.time() - t0) / n * 1000:.0f} ms/frame) -> {D}/out/video_master.mp4")
        await b.close()
    if errors: sys.exit("PAGE ERRORS:\n  " + "\n  ".join(errors[:10]))

asyncio.run(main())
