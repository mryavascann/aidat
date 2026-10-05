"""Procedural, royalty-free soundtrack for the PRU Blockchain × Team1 Türkiye partner video.

Every cue is placed on the same timeline as scene/index.html, so the hits land on the
cuts. Usage: python3 soundtrack.py out.wav
"""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 25.0
N = int(SR * DUR)
T = np.arange(N) / SR
rng = np.random.default_rng(17)

dry = np.zeros((2, N))
send = np.zeros((2, N))  # goes to the reverb


def sos(kind, f, order=2):
    return signal.butter(order, f, kind, fs=SR, output='sos')


def lp(x, f): return signal.sosfilt(sos('lowpass', f), x)
def hp(x, f): return signal.sosfilt(sos('highpass', f), x)
def bp(x, lo, hi): return signal.sosfilt(sos('bandpass', [lo, hi]), x)


def env(points, t=T):
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


def place(sig, start, gain=1.0, pan=0.0, rev=0.0):
    """Mix a mono (n,) or stereo (2, n) signal into the bus at `start` seconds."""
    i = int(round(start * SR))
    if i >= N:
        return
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    j0 = max(0, -i)
    n = min(sig.shape[1] - j0, N - max(i, 0))
    seg = sig[:, j0:j0 + n] * gain
    dry[:, max(i, 0):max(i, 0) + n] += seg
    if rev:
        send[:, max(i, 0):max(i, 0) + n] += seg * rev


def saw(freq, n, harm=24):
    tt = np.arange(n) / SR
    out = np.zeros(n)
    ph = rng.uniform(0, 2 * np.pi)
    for k in range(1, harm + 1):
        if k * freq > SR * 0.42:
            break
        out += np.sin(2 * np.pi * k * freq * tt + ph * k) / k
    return out * (2 / np.pi)


# JS-compatible hash used by the page for the neon flicker
def rnd(i):
    x = np.sin(i * 127.1 + 311.7) * 43758.5453
    return x - np.floor(x)


def lin(t, a, b): return min(1.0, max(0.0, (t - a) / (b - a)))


# ------------------------------------------------------------------ instruments
def boom(dur=3.0, f0=78, f1=31, k=1.0):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt * 4.5)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.9)
    click = bp(rng.standard_normal(n), 400, 6000) * np.exp(-tt * 90)
    body = lp(rng.standard_normal(n), 380) * np.exp(-tt * 3.0)
    return np.tanh((sub * 1.25 + click * .55 + body * .9) * 1.6) * k


def braam(dur=3.2, notes=(73.42, 110.0, 146.83, 174.61), bright=2600):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = np.zeros(n)
    for f in notes:
        for d in (-.0045, .0045):
            s += saw(f * (1 + d), n)
    lo, hi = lp(s, 260), lp(s, bright)
    b = np.exp(-tt * 2.2)
    s = lo * (1 - b) + hi * b
    e = np.minimum(tt / .025, 1) * np.exp(-tt * 1.0)
    return np.tanh(s * e * .9)


def riser(dur, f0=220, f1=2600):
    n = int(dur * SR); tt = np.arange(n) / SR; x = tt / dur
    noise = hp(rng.standard_normal(n), 1800) * .32
    f = f0 * (f1 / f0) ** x
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * .22 + np.sin(2 * np.pi * np.cumsum(f * 1.498) / SR) * .1
    return (noise + tone) * x ** 2.6


def reverse_swell(dur):
    n = int(dur * SR); tt = np.arange(n) / SR; x = tt / dur
    s = hp(rng.standard_normal(n), 3000) * .4 + lp(rng.standard_normal(n), 900) * .3
    return s * x ** 4


def click(freq=2600):
    n = int(.035 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 260) * .7 + hp(rng.standard_normal(n), 3000) * np.exp(-tt * 700) * .5


def whoosh(dur=.7, lo=500, hi=4000, pan0=-.6, pan1=.6):
    n = int(dur * SR); tt = np.arange(n) / SR; x = tt / dur
    s = bp(rng.standard_normal(n), lo, hi) * np.sin(np.pi * x) ** 2
    a = (np.interp(x, [0, 1], [pan0, pan1]) + 1) * np.pi / 4
    return np.vstack([s * np.cos(a), s * np.sin(a)]) * np.sqrt(2)


def slam(dur=1.2):
    n = int(dur * SR); tt = np.arange(n) / SR
    return bp(rng.standard_normal(n), 700, 6000) * np.exp(-tt * 9) + \
        sum(np.sin(2 * np.pi * f * tt) for f in (587.33, 880.0, 1174.66)) * np.exp(-tt * 5) * .08


def arp(t0, t1, notes, g0, g1, step=.125, cutoff=2600):
    """Plucked 16th-note arpeggio, restarted on each cut; ping-pong panned."""
    n = int((t1 - t0 + .4) * SR)
    out = np.zeros((2, n))
    k = 0
    while t0 + k * step < t1:
        st = int(k * step * SR); m = int(.3 * SR); tt = np.arange(m) / SR
        f = notes[k % len(notes)]
        v = (saw(f, m, 16) * .7 + saw(f / 2, m, 10) * .35) * np.exp(-tt * 16) * np.minimum(tt / .003, 1)
        g = g0 + (g1 - g0) * (k * step) / max(t1 - t0, 1e-6)
        pan = .35 if k % 2 else -.35
        a = (pan + 1) * np.pi / 4
        e = min(m, n - st)
        out[0, st:st + e] += v[:e] * g * np.cos(a) * 1.414
        out[1, st:st + e] += v[:e] * g * np.sin(a) * 1.414
        k += 1
    out = np.vstack([lp(hp(out[c], 160), cutoff) for c in range(2)])
    place(out * .14, t0, rev=.35)


def kick(dur=.5):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = 52 + 95 * np.exp(-tt * 32)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 6.5) * 1.8)


def woodblock(freq):
    n = int(.06 * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * freq * tt) * .8 + np.sin(2 * np.pi * freq * 2.71 * tt) * .25) * np.exp(-tt * 95) + \
        hp(rng.standard_normal(n), 5000) * np.exp(-tt * 900) * .3


def neon(t0, t1, gain):
    """Electrical buzz gated exactly like the page's flick(t, t0, t1)."""
    a, b = int(t0 * SR), int(min(DUR, t1 + .25) * SR)
    tt = T[a:b]
    gate = np.zeros(len(tt))
    for i, t in enumerate(tt[::SR // 600]):
        f = np.floor(t * 30)
        if t >= t1:
            v = 1.0
        else:
            p = lin(t, t0, t1)
            v = .55 + .45 * rnd(f * 1.7) if rnd(f * 3.3 + 11) < p * 1.25 else rnd(f) * .12
        gate[i * (SR // 600):(i + 1) * (SR // 600)] = v
    gate = lp(gate, 300)
    tail = np.clip((t1 + .25 - tt) / .25, 0, 1)  # buzz settles once the sign is lit
    hum = hp(saw(100, len(tt), 30) * .5 + np.sin(2 * np.pi * 50 * tt) * .3, 70)
    crackle = hp(rng.standard_normal(len(tt)), 2500) * (np.abs(np.diff(gate, prepend=0)) * 40).clip(0, 1)
    place((hum * gate * tail + crackle * .6) * gain, t0, pan=.1, rev=.3)


def glitch(t0, dur):
    n = int(dur * SR)
    out = np.zeros(n)
    i = 0
    while i < n:
        seg = int(rng.uniform(.018, .06) * SR)
        f = rng.choice([180, 360, 720, 1440, 2880])
        tt = np.arange(seg) / SR
        s = np.sign(np.sin(2 * np.pi * f * tt)) * .4 + rng.standard_normal(seg) * .3
        s = np.round(s * 6) / 6  # bit crush
        out[i:i + seg] = s[:max(0, min(seg, n - i))] * (rng.random() > .25)
        i += seg
    place(hp(out, 150) * np.linspace(.6, 1, n), t0, gain=.32, rev=.15)


# ------------------------------------------------------------------ bed
HITS_BIG = [3.6, 11.2, 17.8, 20.6]
HITS_MED = [7.6, 14.6]

duck = np.ones(N)
for h in HITS_BIG + HITS_MED:
    m = T >= h
    duck[m] *= 1 - .65 * np.exp(-(T[m] - h) * 3.5)

# dark D-minor pad that brightens toward the end
pad = np.zeros(N)
for f in (73.42, 110.0, 146.83, 174.61, 220.0):
    for d in (-.003, 0, .003):
        pad += saw(f * (1 + d), N, 18)
pad_dark, pad_bright = lp(pad, 500), lp(pad, 3200)
bright = env([(0, 0), (3.5, .35), (3.6, .1), (7.6, .35), (11.1, .9), (11.2, .25), (14.6, .35), (17.8, .55), (20.6, .9), (25, .6)])
pad = (pad_dark * (1 - bright) + pad_bright * bright) * env([(0, 0), (1.6, .5), (3.5, .75), (3.6, .35), (7.6, .55), (11.2, .65), (14.6, .5), (17.8, .6), (20.6, .75), (24.2, .65), (25, 0)])
pad *= duck * .07
lfo = .5 + .5 * np.sin(2 * np.pi * .13 * T)
place(np.vstack([pad * (.85 + .15 * lfo), pad * (1 - .15 * lfo)]), 0, rev=.5)

# sub drone
sub = (np.sin(2 * np.pi * 36.71 * T) * .6 + np.sin(2 * np.pi * 73.42 * T) * .25) * env([(0, 0), (2, .5), (3.6, .7), (25, .7)])
place(sub * duck * .07, 0)

# air / wind texture
air = bp(rng.standard_normal(N), 300, 2500) * (.6 + .4 * lp(rng.standard_normal(N), 1.5) * 40).clip(0, 1.6)
place(np.vstack([air, np.roll(air, 3100)]) * env([(0, 0), (1, 1), (25, 1)]) * .018, 0, rev=.3)

# ------------------------------------------------------------------ cues
# S1: door of light — shimmer, decode clicks, riser into the first hit
n = int(3.2 * SR); tt = np.arange(n) / SR
glass = sum(np.sin(2 * np.pi * f * tt) for f in (1174.66, 1760.0, 2349.3)) * np.minimum(tt / 1.2, 1) * .05
place(glass * np.exp(-np.maximum(tt - 2.6, 0) * 6), .25, pan=-.2, rev=.8)
for start, cps, count in [(.7, 30, 24), (1.75, 22, 10)]:
    for i in range(count):
        place(click(rng.uniform(2200, 3400)), start + i / cps, gain=.12, pan=rng.uniform(-.5, .5), rev=.2)
place(riser(1.5), 3.6 - 1.5, gain=.55, rev=.4)
place(reverse_swell(1.1), 3.6 - 1.1, gain=.35, rev=.4)

# hits
for h in HITS_BIG:
    place(boom(k=1.0), h, gain=.9, rev=.25)
    place(braam(), h, gain=.5, rev=.45)
for h in HITS_BIG:
    place(slam(), h, gain=.3, rev=.4)
for h in HITS_MED:
    place(boom(dur=2.0, f0=70, f1=36, k=.7), h, gain=.75, rev=.25)

# rhythmic bed: D-minor arpeggio between the cuts, D-major to close
DM = [293.66, 349.23, 440.0, 587.33, 440.0, 349.23]
DMAJ = [293.66, 369.99, 440.0, 587.33, 440.0, 369.99]
arp(3.85, 7.45, DM, .45, .8, cutoff=2200)
arp(7.6, 10.95, [146.83, 220.0, 293.66, 349.23, 293.66, 220.0], .75, 1.0, cutoff=3000)
arp(11.5, 14.1, DM, .5, .65, cutoff=2400)
arp(17.95, 20.45, DM, .7, .95, cutoff=3200)
arp(20.7, 24.4, DMAJ, .7, .4, step=.25, cutoff=3600)

# S2: title letters
place(whoosh(.9, 300, 2500, -.7, .2), 3.95, gain=.25, rev=.3)
place(whoosh(.9, 400, 3500, .7, -.2), 4.25, gain=.2, rev=.3)
place(whoosh(.5, 2000, 9000, -.3, .3), 7.15, gain=.18, rev=.2)
place(riser(.7, 400, 3000), 7.6 - .7, gain=.4, rev=.3)

# S3: heartbeat build as the beams converge
for i, k in enumerate(np.arange(7.6, 10.95, .5)):
    place(kick(), k, gain=.5 + .04 * i, rev=.1)
for i in range(4):
    place(click(3000), 7.75 + i / 20, gain=.1, rev=.2)
place(whoosh(1.0, 300, 3000, -.8, .8), 7.9, gain=.22, rev=.35)
place(riser(1.4, 160, 3200), 11.2 - 1.4, gain=.55, rev=.45)
place(reverse_swell(1.0), 11.2 - 1.0, gain=.35, rev=.4)

# S4: neon sign powers on, caption decode, glitch out
neon(11.3, 12.0, .2)
for start, cps, count in [(12.4, 22, 14), (12.75, 30, 20)]:
    for i in range(count):
        place(click(rng.uniform(2400, 3600)), start + i / cps, gain=.09, pan=rng.uniform(-.4, .4), rev=.2)
glitch(14.15, .45)

# S5: 24 ticks — one day
for i in range(24):
    ti = 14.85 + (i + .5) / 24 * 2.5
    place(woodblock(1900 if i % 2 == 0 else 1500), ti, gain=.16 + .14 * i / 23, pan=-.25 if i % 2 else .25, rev=.25)
place(whoosh(.8, 300, 2500, .5, -.5), 15.65, gain=.18, rev=.3)
place(riser(.6, 300, 2800), 17.8 - .6, gain=.4, rev=.3)

# S6: date — red delta flicker, decode
neon(17.85, 18.35, .12)
for start, cps, count in [(17.95, 24, 13), (18.7, 36, 27), (19.15, 30, 17)]:
    for i in range(count):
        place(click(rng.uniform(2200, 3400)), start + i / cps, gain=.08, pan=rng.uniform(-.5, .5), rev=.2)
place(riser(1.2, 200, 3000), 20.6 - 1.2, gain=.5, rev=.45)
place(reverse_swell(1.2), 20.6 - 1.2, gain=.4, rev=.4)

# S7: lockup — hopeful D-major shimmer to close
n = int(4.4 * SR); tt = np.arange(n) / SR
sh = np.zeros(n)
for f, a in ((587.33, .5), (739.99, .4), (880.0, .4), (1318.51, .25), (1174.66, .3)):
    sh += np.sin(2 * np.pi * f * tt + rng.uniform(0, 6)) * a * (1 + .25 * np.sin(2 * np.pi * rng.uniform(3, 5) * tt))
sh *= np.minimum(tt / .9, 1) * .03
place(np.vstack([sh, np.roll(sh, 900)]), 20.6, rev=.9)
neon(20.75, 21.3, .08)
place(whoosh(.7, 600, 6000, -.6, .6), 21.1, gain=.2, rev=.3)
place(whoosh(.5, 1500, 8000, .3, -.3), 21.85, gain=.14, rev=.3)
for start, cps, count in [(21.55, 34, 38), (21.9, 30, 17)]:
    for i in range(count):
        place(click(rng.uniform(2400, 3600)), start + i / cps, gain=.06, pan=rng.uniform(-.5, .5), rev=.2)

# ------------------------------------------------------------------ reverb + master
ir_n = int(3.0 * SR); ir_t = np.arange(ir_n) / SR
ir = np.vstack([lp(rng.standard_normal(ir_n), 5500) * np.exp(-ir_t * 2.1) for _ in range(2)])
ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
wet = np.vstack([signal.fftconvolve(hp(send[c], 180), ir[c])[:N] for c in range(2)])
mix = dry + wet * .55
mix = np.vstack([signal.sosfilt(sos('highpass', 32, 4), mix[c]) for c in range(2)])
mix *= env([(0, 1), (24.3, 1), (25, 0)])
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix /= np.abs(mix).max() / .89
out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
wavfile.write(out, SR, (mix.T * 32767).astype(np.int16))
print('wrote', out, f'{DUR}s')
