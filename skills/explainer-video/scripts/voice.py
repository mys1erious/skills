# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile"]
# ///
# Narration -> <dir>/out/voice.wav + <dir>/out/timeline.json (sentence and word start times, cue times), with ElevenLabs
# text-to-speech with timestamps: the word times come from the voice itself, so no speech recognition pass is needed.
# usage: voice.py <dir>                             reads <dir>/narration.json
#        voice.py <dir> --silent                    no API call: silent track, words timed at ~150 wpm (layout drafts, no key)
#        voice.py <dir> --design "<description>"    3 designed voices read the script -> <dir>/out/voices/preview_N.mp3
#        voice.py <dir> --save N                    keep preview N in your ElevenLabs voices; prints the id for narration.json
# Each line's audio is cached in <dir>/out/lines/ by voice, model and text, so editing one line only re-bills that line.
# Delete a line's cache file (or the folder) to get a new take.
# The key comes from ELEVENLABS_API_KEY (or ELEVEN_LABS_KEY, ...) in the environment or in a .env in <dir> or a parent folder.
import base64, hashlib, json, os, re, subprocess, sys, urllib.request
import numpy as np, soundfile as sf

SR = 44100
if len(sys.argv) < 2: sys.exit("usage: voice.py <dir> [--silent | --design DESCRIPTION | --save N]")
DIR = sys.argv[1]
OUT = os.path.join(DIR, "out"); os.makedirs(OUT, exist_ok=True)
N = json.load(open(os.path.join(DIR, "narration.json")))
LINES = N["lines"]
VOICE = N.get("voice", "JBFqnCBsd6RMkjVDRZzb")  # ElevenLabs premade "George": warm British storyteller
MODEL = N.get("model", "eleven_v4")
LEAD, GAP = N.get("lead", .3), N.get("gap", .24)

def key(*names):
    for n in names:
        if os.environ.get(n): return os.environ[n]
    d = os.path.abspath(DIR)
    while True:
        p = os.path.join(d, ".env")
        if os.path.isfile(p):
            m = re.search(rf'^\s*(?:export\s+)?(?:{"|".join(names)})\s*=\s*["\']?([^"\'\s]+)', open(p).read(), re.M)
            if m: return m.group(1)
        if d == os.path.dirname(d): sys.exit(f"no ElevenLabs key: set {names[0]} in the environment or in a .env file in {DIR} or a parent folder")
        d = os.path.dirname(d)

def api(path, body):
    k = key("ELEVENLABS_API_KEY", "ELEVEN_LABS_API_KEY", "ELEVEN_LABS_KEY", "ELEVENLABS_KEY", "ELEVEN_API_KEY")
    req = urllib.request.Request("https://api.elevenlabs.io" + path, json.dumps(body).encode(), {"xi-api-key": k, "Content-Type": "application/json"})
    try: return json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e: sys.exit(f"ElevenLabs HTTP {e.code}: {e.read().decode()[:500]}")

def norm(w): return re.sub(r"[^a-z0-9']", "", w.lower())

def cut_bleed(a, last_word):
    """the model sometimes speaks the first sound of next_text at the end of a clip ("...the cracks. n"):
    keep the clip only up to the first 160 ms of silence after the last word starts."""
    k, i0 = int(.16 * SR), int(last_word * SR)
    loud = np.concatenate([[0], np.cumsum(np.abs(a[i0:]) > .004)])
    quiet = np.flatnonzero(loud[k:] == loud[:-k])  # starts of k-sample windows with no loud sample
    return a[:i0 + quiet[0] + int(.01 * SR)] if quiet.size else a

_t = np.concatenate([np.full(int(.3 * SR), .1), np.zeros(int(.3 * SR)), np.full(int(.1 * SR), .1)]).astype(np.float32)
assert abs(len(cut_bleed(_t, 0)) / SR - .31) < .001 and len(cut_bleed(_t[:int(.3 * SR)], 0)) == int(.3 * SR)

def tts(text, prev, nxt):
    body = {"text": text, "model_id": MODEL, "previous_text": prev, "next_text": nxt, "voice_settings": {"stability": .5, "similarity_boost": .75}}
    cache = f"{OUT}/lines/{hashlib.sha1(f'{VOICE}|{MODEL}|{text}'.encode()).hexdigest()[:12]}.json"
    if os.path.exists(cache): r = json.load(open(cache))
    else:
        r = api(f"/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128", body)
        os.makedirs(f"{OUT}/lines", exist_ok=True); json.dump(r, open(cache, "w")); BILLED[0] += len(text)
    pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", "-", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         input=base64.b64decode(r["audio_base64"]), capture_output=True, check=True).stdout
    al = r["alignment"]; assert al, "no alignment returned"
    words, cur, start = [], "", 0.0
    for ch, st in zip(al["characters"], al["character_start_times_seconds"]):
        if ch.isspace():
            if cur: words.append((norm(cur), start)); cur = ""
        else:
            if not cur: start = st
            cur += ch
    if cur: words.append((norm(cur), start))
    a = np.frombuffer(pcm, np.float32)
    idx = np.where(np.abs(a) > .004)[0]  # trim the silence around the clip, keep word times aligned
    head, tail = max(idx[0] - int(.005 * SR), 0), min(idx[-1] + int(.01 * SR), len(a))
    words = [(w, max(0.0, s - head / SR)) for w, s in words]
    return cut_bleed(a[head:tail], words[-1][1]), words

BILLED = [0]  # characters sent to ElevenLabs this run (cached lines are free)

def silent(text):  # ~150 wpm, longer words take longer
    ws = text.split(); dur = [.16 + .045 * len(w) for w in ws]; t = np.concatenate([[0], np.cumsum(dur)])
    return np.zeros(int(t[-1] * SR), np.float32), [(norm(w), float(s)) for w, s in zip(ws, t)]

if "--design" in sys.argv:  # voice design: 3 previews read the script (the API wants 100-1000 characters of text)
    desc = sys.argv[sys.argv.index("--design") + 1]; text = " ".join(l["text"] for l in LINES)[:1000]
    body = {"voice_description": desc, "model_id": "eleven_ttv_v3", **({"text": text} if len(text) >= 100 else {"auto_generate_text": True})}
    r = api("/v1/text-to-voice/design", body); os.makedirs(f"{OUT}/voices", exist_ok=True)
    for i, p in enumerate(r["previews"], 1):
        open(f"{OUT}/voices/preview_{i}.mp3", "wb").write(base64.b64decode(p["audio_base_64"])); print(f"{OUT}/voices/preview_{i}.mp3  {p['duration_secs']:.1f}s")
    json.dump({"description": desc, "ids": [p["generated_voice_id"] for p in r["previews"]]}, open(f"{OUT}/voices/previews.json", "w"))
    sys.exit()
if "--save" in sys.argv:
    p = json.load(open(f"{OUT}/voices/previews.json")); n = int(sys.argv[sys.argv.index("--save") + 1])
    r = api("/v1/text-to-voice", {"voice_name": os.path.basename(os.path.abspath(DIR)) + " narrator", "voice_description": p["description"], "generated_voice_id": p["ids"][n - 1]})
    print(f'saved: put "voice": "{r["voice_id"]}" in narration.json'); sys.exit()

out, t, sentences, triggers = [np.zeros(int(LEAD * SR), np.float32)], LEAD, [], {}
for i, L in enumerate(LINES):
    if i:  # "pause": extra silence before this line; "start": start it at this absolute time (or later)
        pad = max(GAP + L.get("pause", 0), L["start"] - t if "start" in L else 0)
        out.append(np.zeros(int(pad * SR), np.float32)); t += pad
    a, words = silent(L["text"]) if "--silent" in sys.argv else tts(L["text"], " ".join(l["text"] for l in LINES[:i]), LINES[i + 1]["text"] if i + 1 < len(LINES) else "")
    cursor = 0
    for cw in L.get("cues", []):  # cue words in order within the line; the key is "<line>:<cue>"
        j = next((j for j in range(cursor, len(words)) if words[j][0].startswith(norm(cw))), None)
        if j is None: sys.exit(f'cue "{cw}" not found in line {i} as spoken: {[w for w, _ in words]}')
        triggers[f"{i}:{cw}"] = round(t + words[j][1], 3); cursor = j + 1
    dur = len(a) / SR
    sentences.append({"i": i, "text": L["text"], "start": round(t, 3), "end": round(t + dur, 3), "words": [(w, round(t + s, 3)) for w, s in words]})
    out.append(a); t += dur
    print(f"{t:6.2f}s  {L['text']}")
out.append(np.zeros(int(.2 * SR), np.float32))
voice = np.concatenate(out)
sf.write(f"{OUT}/voice.wav", voice, SR)
json.dump({"duration": round(len(voice) / SR, 3), "sentences": sentences, "triggers": triggers}, open(f"{OUT}/timeline.json", "w"), indent=1)
nw = sum(len(l["text"].split()) for l in LINES); speech = sum(s["end"] - s["start"] for s in sentences)
print(f"voice {len(voice) / SR:.2f}s, speech {speech:.2f}s, {nw / speech * 60:.0f} wpm, {BILLED[0]} characters billed")
for k, v in triggers.items(): print(f"{v:6.2f}  {k}")
