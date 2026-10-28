# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile", "pyloudnorm"]
# ///
# Synthesized music bed + one sound per cue, mixed under the voice, mastered to -14 LUFS / -2.2 dBTP, muxed with the video.
# usage: audio.py <dir>   reads <dir>/out/{voice.wav, sfx.json, video_master.mp4} -> <dir>/out/<name>.mp4 (+ <name>_master.mp4)
# music (from init): "pad" slow chords that resolve on the title, "trailer" low drone and pulse, "beat" 124 BPM electro
#   shaped by marks {start, drop, back, end}: kick, snare, hats and a riff from start; only a heartbeat kick from drop to back.
# shortcut: everything is synthesized (no downloads), so there is nothing to license; swap in recorded SFX if wanted.
import json, os, shutil, subprocess, sys
import numpy as np, soundfile as sf, pyloudnorm as pyln

SR = 48000
if len(sys.argv) < 2 or not shutil.which("ffmpeg"): sys.exit("usage: audio.py <dir>   (needs ffmpeg)")
D = sys.argv[1]; O = f"{D}/out"; NAME = os.path.basename(os.path.abspath(D))
cues = json.load(open(f"{O}/sfx.json"))
DUR = cues["duration"]
N = int(DUR * SR)
rng = np.random.default_rng(3)
t_of = lambda n: np.arange(n) / SR

subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{O}/voice.wav", "-af", "aresample=48000:resampler=soxr", f"{O}/voice48.wav"], check=True)
voice, _ = sf.read(f"{O}/voice48.wav", dtype="float64")
voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]
active = voice[np.abs(voice) > .02]
v_rms = np.sqrt(np.mean(active ** 2)) if active.size else .08  # a silent draft voice: mix against a typical level
rms = lambda a: np.sqrt(np.mean(a[np.abs(a) > np.abs(a).max() * .05] ** 2))

def band(x, lo, hi):  # FFT band-pass
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(x))

def reverb(x, secs=2.2, mix=.35):
    n = int(secs * SR); ir = rng.standard_normal(n) * np.exp(-t_of(n) / (secs / 5))
    ir = band(ir, 200, 9000); ir /= np.sqrt(np.sum(ir ** 2))
    wet = np.fft.irfft(np.fft.rfft(x, len(x) + n) * np.fft.rfft(ir, len(x) + n))[:len(x)]
    return x * (1 - mix) + wet * mix

# ---------- music bed: slow pad chords, final chord lands on the title ----------
def hz(m): return 440 * 2 ** ((m - 69) / 12)
title = cues["title"]
CH = [(0, [50, 57, 62, 66, 69]), (4.6, [47, 54, 62, 66, 71]), (9.2, [43, 55, 59, 62, 66]), (13.8, [45, 52, 57, 61, 64]),
      (16.1, [38, 50, 57, 62, 65]), (20.7, [46, 53, 58, 62, 65]), (25.0, [43, 55, 59, 62, 67]), (27.8, [45, 52, 57, 61, 64]),
      (30.6, [38, 50, 57, 62, 66, 69, 74])]
CH = [(t0 * title / 30.6, n) for t0, n in CH]  # chords were laid out for a 30.6s title; follow the real one
music = np.zeros(N)
for i, (t0, notes) in enumerate(CH):
    t1 = CH[i + 1][0] if i + 1 < len(CH) else DUR
    last = i + 1 == len(CH)
    a0, n = int(t0 * SR), int(((t1 - t0) + (0 if last else 1.6)) * SR)
    n = min(n, N - a0); tt = t_of(n)
    env = np.minimum(1, tt / (.25 if last else 1.4))
    env *= np.exp(-tt / 1.6) * .6 + .4 * np.exp(-tt / 6) if last else np.clip((t1 - t0 + 1.6 - tt) / 1.6, 0, 1)
    seg = np.zeros(n)
    for m in notes:
        f = hz(m)
        for d in (-.0015, 0, .0015):
            seg += np.sin(2 * np.pi * f * (1 + d) * tt + rng.uniform(0, 6)) + .25 * np.sin(4 * np.pi * f * (1 + d) * tt)
    music[a0:a0 + n] += seg * env * (10 ** (5 / 20) if last else 1)  # +5 dB swell under the title
# soft bell arpeggio over the chords
for k in np.arange(.5, title - .3, .55):
    notes = [c for t0, c in CH if t0 <= k][-1]
    f = hz(notes[int(k / .55) % len(notes)] + 12); n = int(1.4 * SR); a0 = int(k * SR)
    if a0 + n > N: break
    music[a0:a0 + n] += .5 * np.sin(2 * np.pi * f * t_of(n)) * np.exp(-t_of(n) / .35)
music = reverb(band(music, 40, 7000), 3.0, .45)
music *= np.clip((DUR - t_of(N)) / .25, 0, 1)  # no click at the very end
if cues.get("music") == "trailer":  # low drone that breathes, plus a driving sub pulse; the braams are cue SFX
    tt = t_of(N); music = np.zeros(N)
    for f, a in ((55, 1), (82.41, .6), (110, .45), (164.8, .2)):
        music += a * (np.sin(2 * np.pi * f * tt + rng.uniform(0, 6)) + .35 * np.sin(2 * np.pi * f * 1.004 * tt))
    music *= .65 + .35 * np.sin(2 * np.pi * .13 * tt)
    beat = (tt % .5); drive = np.clip((tt - 5) / 2, 0, 1) * np.clip((title - tt) / .3, 0, 1)
    music += 1.6 * np.sin(2 * np.pi * (48 * beat + 30 * (1 - np.exp(-beat * 25)) / 25)) * np.exp(-beat * 11) * drive
    music = reverb(band(music, 25, 2500), 2.5, .35) * np.clip((DUR - tt) / .3, 0, 1)
if cues.get("music") == "beat":  # 124 BPM electro beat: in at start, a heartbeat-only stretch from drop to back, out at end
    mk_ = cues.get("marks", {}); go, drop, casc, win = mk_.get("start", 1.6), mk_.get("drop", 1e9), mk_.get("back", 1e9), mk_.get("end", DUR)
    tt = t_of(N); music = np.zeros(N); beat = 60 / 124
    def place(sig, t0, gain=1.0):
        a = int(t0 * SR); lo, hi = max(0, a), min(N, a + len(sig))
        if hi > lo: music[lo:hi] += gain * sig[lo - a:hi - a]
    kt = t_of(int(.3 * SR)); kick = np.sin(2 * np.pi * np.cumsum(45 + 90 * np.exp(-kt * 30)) / SR) * np.exp(-kt * 9)
    st_ = t_of(int(.18 * SR)); snare = (band(rng.standard_normal(len(st_)), 1200, 7000) * .7 + .4 * np.sin(2 * np.pi * 190 * st_)) * np.exp(-st_ * 22)
    ht = t_of(int(.05 * SR)); hat = band(rng.standard_normal(len(ht)), 7000, 14000) * np.exp(-ht * 90) * .5
    riff = [45, 45, 48, 45, 52, 50, 48, 43]
    def pluck(f, dur, square=False):
        x = t_of(int(dur * SR)); w_ = np.sign(np.sin(2 * np.pi * f * x)) if square else 2 * ((f * x) % 1) - 1
        return band(w_, 40, 5000 if square else 2400) * np.exp(-x * (14 if square else 6))
    t, b = go, 0
    while t < win + 1.0:
        quiet = drop <= t < casc
        if not quiet or b % 2 == 0: place(kick, t, .5 if quiet else .9)  # only a heartbeat in the drop
        if not quiet:
            if b % 2: place(snare, t, .55)
            place(hat, t, .2); place(hat, t + beat / 2, .35)
            f = hz(riff[b % 8]); place(pluck(f, beat * .9), t, .45); place(pluck(f, beat * .4), t + beat / 2, .3)
            if t > go + 10:
                for q in range(4): place(pluck(hz(riff[(b + q) % 8] + 24 + (0, 7, 12, 7)[q]), beat / 4 * .9, True), t + q * beat / 4, .12)
        t += beat; b += 1
    n_ = int(max(0, DUR - win) * SR)
    if n_ > 0:
        ct = t_of(n_); place(sum(np.sin(2 * np.pi * hz(m) * ct) + .3 * np.sin(4 * np.pi * hz(m) * ct) for m in (57, 61, 64, 69)) * np.exp(-ct / 1.4), win, .5)
    music = reverb(band(music, 30, 12000), 1.2, .18) * np.clip((DUR - tt) / .25, 0, 1)
pre = t_of(N) < title
music *= v_rms * 10 ** ({"trailer": -10, "beat": -8}.get(cues.get("music"), -7) / 20) / (np.sqrt(np.mean(music[pre] ** 2)) or 1)  # 7-10 dB under the voice

# ---------- sound effects, one per event kind ----------
def env_exp(n, tau): return np.exp(-t_of(n) / tau)
def noise(n): return rng.standard_normal(n)
def sfx(kind):  # returns (signal, peak sample offset)
    if kind == "collapse":
        n = int(.55 * SR); tt = t_of(n); f = 420 * np.exp(-tt * 4)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (tt / tt[-1]) ** 2 + band(noise(n), 100, 2500) * .4 * (tt / tt[-1]) ** 3
        return x, n - 1
    if kind == "impact":
        n = int(1.4 * SR); tt = t_of(n); f = 45 + 120 * np.exp(-tt * 18)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, .45) + band(noise(n), 60, 3000) * env_exp(n, .05) * .6
        return reverb(x, 1.5, .3), int(.01 * SR)
    if kind in ("whoosh", "dive"):
        n = int(1.0 * SR); tt = t_of(n); c = .5 if kind == "whoosh" else .7
        x = band(noise(n), 250 if kind == "whoosh" else 500, 3500) * np.exp(-((tt - c) / .2) ** 2)
        return x, int(c * SR)
    if kind == "tick":
        n = int(.08 * SR); x = np.sin(2 * np.pi * 2200 * t_of(n)) * env_exp(n, .008) + band(noise(n), 2000, 9000) * env_exp(n, .003) * .5
        return x, 0
    if kind == "pin":
        n = int(.5 * SR); tt = t_of(n); x = (np.sin(2 * np.pi * 880 * tt * (1 - .05 * tt)) + .5 * np.sin(2 * np.pi * 1320 * tt)) * env_exp(n, .09)
        return x, 0
    if kind == "photon":
        n = int(1.0 * SR); x = np.zeros(n)
        for i, f in enumerate((2093, 2637, 3136, 4186)):
            a = int(i * .03 * SR); x[a:] += np.sin(2 * np.pi * f * t_of(n - a)) * env_exp(n - a, .18) * .6
        return reverb(x, 1.2, .3), 0
    if kind == "click":
        n = int(.12 * SR); x = np.sin(2 * np.pi * 1200 * t_of(n)) * env_exp(n, .006)
        x[int(.05 * SR):] += np.sin(2 * np.pi * 700 * t_of(n - int(.05 * SR))) * env_exp(n - int(.05 * SR), .01)
        return x, 0
    if kind == "hit":
        pre = int(.45 * SR); n = pre + int(1.6 * SR); tt = t_of(n); x = np.zeros(n)
        x[:pre] = band(noise(pre), 2000, 9000) * (t_of(pre) / t_of(pre)[-1]) ** 3 * .5
        f = 38 + 90 * np.exp(-t_of(n - pre) * 14)
        x[pre:] += np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n - pre, .6) + band(noise(n - pre), 40, 400) * env_exp(n - pre, .12) * .5
        return reverb(x, 2.0, .3), pre
    if kind == "reveal":
        n = int(2.0 * SR); tt = t_of(n); x = np.zeros(n)
        for m in (74, 78, 81, 86): x += np.sin(2 * np.pi * hz(m) * tt) * np.minimum(1, tt / .3) * env_exp(n, .7)
        return reverb(x, 2.0, .4), int(.3 * SR)
    if kind == "frost":
        n = int(1.8 * SR); tt = t_of(n); x = band(noise(n), 4000, 12000) * .25 * np.sin(np.pi * tt / tt[-1])
        for c in rng.uniform(0, 1.7, 60): a = int(c * SR); m = int(.004 * SR); x[a:a + m] += rng.standard_normal(m) * rng.uniform(.3, 1)
        return x, int(.6 * SR)
    if kind in ("thump", "swish", "snip"):  # tiny, for many small events (dots landing, items appearing)
        n = int(.09 * SR); tt = t_of(n)
        if kind == "thump": x = np.sin(2 * np.pi * np.cumsum(90 + 160 * np.exp(-tt * 40)) / SR) * np.exp(-tt * 35) + band(noise(n), 200, 1500) * np.exp(-tt * 80) * .4
        elif kind == "swish": x = band(noise(n), 900, 5000) * np.sin(np.pi * tt / tt[-1]) * .9
        else: x = band(noise(n), 3000, 9000) * (np.exp(-tt * 120) + np.exp(-np.maximum(0, tt - .035) * 120) * (tt > .035))
        return x, int(.004 * SR)
    if kind == "braam":  # detuned brass-like saw cluster through a low-pass, with a sub boom
        n = int(2.8 * SR); tt = t_of(n); x = np.zeros(n)
        for f in (55, 110, 130.8, 164.8, 220):
            for d in (-.004, 0, .004): x += 2 * ((f * (1 + d) * tt + rng.uniform()) % 1) - 1
        x = band(x, 30, 900) * np.minimum(1, tt / .04) * np.exp(-tt / 1.1)
        x += 6 * np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-tt * 10)) / SR) * np.exp(-tt / .7)
        return reverb(x, 2.5, .35), int(.06 * SR)
    if kind == "riser":  # noise and a sweep that build into the hit
        n = int(1.4 * SR); tt = t_of(n); e = (tt / tt[-1]) ** 3
        x = (band(noise(n), 800, 8000) * .6 + .4 * np.sin(2 * np.pi * np.cumsum(200 + 1400 * (tt / tt[-1]) ** 2) / SR)) * e
        return x, n - 1
    if kind == "rewind":
        n = int(.85 * SR); tt = t_of(n); f = 300 + 900 * (1 - tt / tt[-1]) + 200 * np.sin(2 * np.pi * 9 * tt)
        x = (np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * .3 + band(noise(n), 800, 6000) * .5) * np.sin(np.pi * tt / tt[-1])
        return band(x, 150, 8000), int(.42 * SR)
    sys.exit(f'unknown sfx "{kind}": use one of {", ".join(UNDER)}')

UNDER = {"thump": 13, "swish": 13, "snip": 13, "braam": 2, "riser": 8, "collapse": 5, "impact": 4, "whoosh": 8, "dive": 7, "tick": 10, "pin": 7, "photon": 7, "click": 7, "hit": 4, "reveal": 6, "frost": 8, "rewind": 6}
fx = np.zeros(N)
for c in cues["sfx"]:
    x, pk = sfx(c["k"]); x = x * v_rms * 10 ** (-UNDER[c["k"]] / 20) / rms(x)
    a = int(round(c["t"] * SR)) - pk  # peak lands on the event's frame
    lo, hi = max(0, a), min(N, a + len(x))
    if hi > lo: fx[lo:hi] += x[lo - a:hi - a]

mix = np.stack([voice + music + fx] * 2, axis=1)
meter = pyln.Meter(SR)
mix *= 10 ** ((-14 - meter.integrated_loudness(mix)) / 20)
sf.write(f"{O}/mix_prelimit.wav", mix.astype(np.float32), SR, subtype="FLOAT")
# limiter at 4x oversampling so inter-sample peaks are caught (-2.6 dBFS ceiling -> <= -2.2 dBTP)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"{O}/mix_prelimit.wav", "-af",
                "aresample=192000:resampler=soxr,alimiter=limit=0.741:attack=1:release=60:level=false,aresample=48000:resampler=soxr",
                "-c:a", "pcm_s24le", f"{O}/mix.wav"], check=True)
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", f"{O}/mix.wav", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
summary = r[r.rfind("Summary:"):]
print(" ".join(summary.split()))

# mux: CRF 16 master + CRF 20 delivery
if not os.path.exists(f"{O}/video_master.mp4"): sys.exit(f"wrote {O}/mix.wav; no {O}/video_master.mp4 to mux yet (render.py <dir> video)")
ff = ["ffmpeg", "-y", "-loglevel", "error"]
subprocess.run(ff + ["-i", f"{O}/video_master.mp4", "-i", f"{O}/mix.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac",
                     "-b:a", "320k", "-shortest", "-movflags", "+faststart", f"{O}/{NAME}_master.mp4"], check=True)
subprocess.run(ff + ["-i", f"{O}/{NAME}_master.mp4", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
                     "-c:a", "copy", "-movflags", "+faststart", f"{O}/{NAME}.mp4"], check=True)
print("wrote", f"{O}/{NAME}.mp4", "and", f"{O}/{NAME}_master.mp4")
