# /// script
# requires-python = ">=3.10"
# ///
# Image-first style targets: a realistic still of each key scene in each style, made with Gemini before any drawing code,
# so every style is built to match a picture instead of drifting toward a generic look.
# usage: targets.py <spec.json> [style_scene ...]   -> <style>_<scene>.png next to the spec (every pair when none are named)
# spec.json: {"frame": "said for every image", "scenes": {"<scene>": "what is on screen"}, "styles": {"<style>": "how it looks"},
#             "aspect": "9:16", "model": "gemini-3-pro-image"}
# The key comes from GEMINI_API_KEY (or GOOGLE_API_KEY) in the environment or in a .env in the spec's folder or a parent folder.
import base64, json, os, re, sys, urllib.request, concurrent.futures as cf

if len(sys.argv) < 2: sys.exit("usage: targets.py <spec.json> [style_scene ...]")
SPEC = os.path.abspath(sys.argv[1]); HERE = os.path.dirname(SPEC); S = json.load(open(SPEC))

def key(*names):
    for n in names:
        if os.environ.get(n): return os.environ[n]
    d = HERE
    while True:
        p = os.path.join(d, ".env")
        if os.path.isfile(p):
            m = re.search(rf'^\s*(?:export\s+)?(?:{"|".join(names)})\s*=\s*["\']?([^"\'\s]+)', open(p).read(), re.M)
            if m: return m.group(1)
        if d == os.path.dirname(d): sys.exit(f"no Gemini key: set {names[0]} in the environment or in a .env file in {HERE} or a parent folder")
        d = os.path.dirname(d)
KEY = key("GEMINI_API_KEY", "GOOGLE_API_KEY")

def gen(job):
    style, scene = job
    body = {"contents": [{"parts": [{"text": " ".join([S.get("frame", ""), S["scenes"][scene], S["styles"][style]])}]}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": S.get("aspect", "9:16")}}}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{S.get('model', 'gemini-3-pro-image')}:generateContent",
                                 json.dumps(body).encode(), {"x-goog-api-key": KEY, "Content-Type": "application/json"})
    try: r = json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e: return job, f"HTTP {e.code}: {e.read().decode()[:300]}"
    for p in r.get("candidates", [{}])[0].get("content", {}).get("parts", []):
        if "inlineData" in p:
            path = os.path.join(HERE, f"{style}_{scene}.png"); open(path, "wb").write(base64.b64decode(p["inlineData"]["data"])); return job, path
    return job, f"no image in response: {json.dumps(r)[:300]}"

jobs = [tuple(a.split("_", 1)) for a in sys.argv[2:]] or [(s, c) for s in S["styles"] for c in S["scenes"]]
with cf.ThreadPoolExecutor(8) as ex:
    for job, res in ex.map(gen, jobs): print("_".join(job), "->", res)
