#!/usr/bin/env python3
"""Instrument layers for "Create my mix": warm pad, deep drone, soft bells, felt piano notes and
a soft choir. Made in code, so any combination stays in tune: everything uses the notes of
D major pentatonic (D E F# A B), with no beat and no tempo, so the layers never clash.

Each layer is a 96 s loop with no joint: steady tones complete a whole number of cycles in the
loop, and notes or echoes that pass the end continue from the start. Same loudness for all.

Usage: python3 tools/camadas.py        (writes native/midia/camadas/*.ogg; then run tools/audio-8d.py)
"""
import os
import subprocess
import sys

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
L = 96.0                       # loop length in seconds
N = int(L * SR)
T = np.arange(N) / SR
RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
DEST = os.path.join(RAIZ, 'native', 'midia', 'camadas')
rng = np.random.default_rng(20261126)

NOTA = {'D2': 73.42, 'A2': 110.00, 'D3': 146.83, 'E3': 164.81, 'F#3': 185.00, 'A3': 220.00, 'B3': 246.94,
        'D4': 293.66, 'E4': 329.63, 'F#4': 369.99, 'A4': 440.00, 'B4': 493.88,
        'D5': 587.33, 'E5': 659.26, 'F#5': 739.99, 'A5': 880.00}


def q(f):
    """A frequency that completes a whole number of cycles in the loop (so the loop has no joint)."""
    return round(f * L) / L


def cents(f, c):
    return f * 2 ** (c / 1200)


def lento(periodo_s, fase=0.0):
    """0..1, one slow cycle every periodo_s seconds (periodo_s divides the loop)."""
    return 0.5 - 0.5 * np.cos(2 * np.pi * T / periodo_s + fase)


def grosso(f, passo=480):
    """Computes a slow curve every `passo` samples and stretches it (much faster, same result)."""
    t = np.arange(0, N, passo) / SR
    v = f(t)
    return np.interp(np.arange(N), np.arange(0, N, passo), v)


def sala(seg, semente, escuro=4500):
    """Stereo room: decaying noise, a little darker, with a short pre-delay."""
    r = np.random.default_rng(semente)
    n = int(seg * 1.4 * SR)
    t = np.arange(n) / SR
    out = []
    for _ in range(2):
        ir = r.standard_normal(n) * np.exp(-6.9 * t / seg)
        ir = sosfilt(butter(1, escuro, 'low', fs=SR, output='sos'), ir)
        ir = np.concatenate([np.zeros(int(0.02 * SR)), ir])
        out.append(ir / np.sqrt(np.sum(ir ** 2)))
    return out


def reverbera(x, seg, molhado, semente):
    """Circular convolution: the tail of the end continues at the start of the loop."""
    irs = sala(seg, semente)
    y = np.zeros_like(x)
    for c in range(2):
        X = np.fft.rfft(x[:, c], n=N)
        H = np.fft.rfft(irs[c], n=N)
        y[:, c] = np.fft.irfft(X * H, n=N)
    return x * (1 - molhado) + y * molhado


def em_laco(buf):
    """Folds whatever passed the end of the loop back onto the start."""
    out = buf[:N].copy()
    resto = buf[N:]
    for k in range(0, len(resto), N):
        p = resto[k:k + N]
        out[:len(p)] += p
    return out


def nivelar(x, rms_db=-25.0):
    x = x * (10 ** (rms_db / 20) / (np.sqrt(np.mean(x ** 2)) + 1e-12))
    pico = np.max(np.abs(x))
    return x * (0.9 / pico) if pico > 0.9 else x


def panorama(mono, pos):
    """pos -1 (left) .. 1 (right), equal power."""
    a = np.pi / 4 * (1 + pos)
    return np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1)


# ------------------------------------------------------------------ the layers

def pad():
    """Warm pad on a D6/9 chord (all five notes of the scale), slowly opening and closing."""
    x = np.zeros((N, 2))
    corte = grosso(lambda t: 650 + 650 * (0.5 - 0.5 * np.cos(2 * np.pi * t / 48)))
    for i, nome in enumerate(['D3', 'A3', 'E4', 'F#4', 'B4']):
        onda = 0.75 + 0.25 * lento(96 / (2 + i % 3), fase=i * 1.3)
        for v, (c, pos) in enumerate([(-7, -0.55), (0, 0.0), (7, 0.55)]):
            f = q(cents(NOTA[nome], c))
            fase0 = rng.uniform(0, 2 * np.pi)
            mono = np.zeros(N)
            h = 1
            while h * f < 7000:
                g = (1 / h) / np.sqrt(1 + (h * f / corte) ** 4)
                mono += g * np.sin(2 * np.pi * h * f * T + fase0 * h)
                h += 1
            x += panorama(mono * onda, pos)
    return nivelar(reverbera(x, 2.6, 0.35, 1))


def drone():
    """Deep drone on D and A, two close tones beating slowly, breathing in volume."""
    x = np.zeros((N, 2))
    resp = 0.82 + 0.18 * lento(24)
    def tom(f, fase):
        return (np.sin(2 * np.pi * f * T + fase) + 0.3 * np.sin(2 * np.pi * 2 * f * T + 0.5 + fase)
                + 0.12 * np.sin(2 * np.pi * 3 * f * T + 1.1 + fase))

    for nome, amp in [('D2', 1.0), ('A2', 0.55), ('D3', 0.35)]:
        f = q(NOTA[nome])
        # a quieter tone 0.125 Hz away gives a gentle movement (never cancels, even on one speaker)
        x[:, 0] += amp * (tom(f, 0.0) + 0.22 * tom(q(NOTA[nome] + 0.125), 0.3)) * resp
        x[:, 1] += amp * (tom(f, 0.4) + 0.22 * tom(q(NOTA[nome] - 0.125), 1.1)) * resp
    return nivelar(reverbera(x, 2.2, 0.25, 2))


def sinos():
    """Soft bells (FM), one every few seconds, on the notes of the scale."""
    notas = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5']
    dur = int(8 * SR)
    buf = np.zeros((N + dur, 2))
    t = np.arange(dur) / SR
    pos_s = 0.5
    while pos_s < L:
        f = NOTA[notas[rng.integers(len(notas))]]
        vel = rng.uniform(0.45, 1.0)
        indice = 2.2 * np.exp(-t / 1.1)
        env = (1 - np.exp(-t / 0.004)) * np.exp(-t / 2.6)
        mono = vel * env * np.sin(2 * np.pi * f * t + indice * np.sin(2 * np.pi * 1.4 * f * t))
        a = int(pos_s * SR)
        buf[a:a + dur] += panorama(mono, rng.uniform(-0.6, 0.6))
        pos_s += rng.uniform(2.8, 6.5)
    return nivelar(reverbera(em_laco(buf), 2.8, 0.45, 3))


def piano():
    """Felt piano: soft single notes (sometimes two together), slow, with space between them."""
    notas = ['D3', 'E3', 'F#3', 'A3', 'B3', 'D4', 'E4', 'F#4', 'A4', 'B4', 'D5']
    dur = int(9 * SR)
    buf = np.zeros((N + dur, 2))
    t = np.arange(dur) / SR
    sopro = sosfilt(butter(2, 900, 'low', fs=SR, output='sos'), rng.standard_normal(dur)) * np.exp(-t / 0.012)

    def nota(nome, vel):
        f0 = NOTA[nome]
        tau0 = 5.0 * (146.83 / f0) ** 0.35
        mono = np.zeros(dur)
        for n in range(1, 16):
            fn = n * f0 * np.sqrt(1 + 0.0004 * n * n)
            if fn > 9000:
                break
            amp = (1 / n ** 1.15) * np.exp(-n / 5.5)
            tau = tau0 / (1 + 0.3 * (n - 1))
            mono += amp * np.exp(-t / tau) * np.sin(2 * np.pi * fn * t + rng.uniform(0, 6.28))
        mono *= (1 - np.exp(-t / 0.006))
        mono *= np.clip((8.5 - t) / 1.5, 0, 1)           # the key is let go
        return vel * (mono + 0.05 * sopro)

    pos_s = 0.8
    while pos_s < L:
        i = rng.integers(len(notas))
        vel = rng.uniform(0.5, 0.9)
        mono = nota(notas[i], vel)
        if rng.random() < 0.3 and i + 3 < len(notas):       # sometimes a second note, three steps up
            mono += 0.7 * nota(notas[i + 3], vel)
        a = int(pos_s * SR)
        buf[a:a + dur] += panorama(mono, -0.5 + i / (len(notas) - 1))
        pos_s += rng.uniform(3.0, 7.0)
    return nivelar(reverbera(em_laco(buf), 2.4, 0.4, 4))


def coro():
    """Soft wordless choir on a D chord, slowly moving between "ah" and "oo"."""
    x = np.zeros((N, 2))
    ah, uu = [(700, 1.0, 110), (1150, 0.55, 120), (2700, 0.18, 170)], [(380, 1.0, 90), (800, 0.45, 100), (2500, 0.1, 160)]
    mistura = grosso(lambda t: 0.5 - 0.5 * np.cos(2 * np.pi * t / 48))

    def ganho(f):
        g = 0.0
        for (fa, aa, ba), (fu, au, bu) in zip(ah, uu):
            fc = fa + (fu - fa) * mistura
            a = aa + (au - aa) * mistura
            b = ba + (bu - ba) * mistura
            g = g + a / (1 + ((f - fc) / b) ** 2)
        return g

    vib = q(4.9)
    for i, nome in enumerate(['D3', 'A3', 'D4', 'F#4']):
        onda = 0.7 + 0.3 * lento(96 / (3 + i), fase=i)
        for c, pos in [(-6, -0.6), (0, 0.0), (5, 0.6)]:
            f = q(cents(NOTA[nome], c))
            fase_v = rng.uniform(0, 6.28)
            mono = np.zeros(N)
            h = 1
            while h * f < 4500:
                beta = h * f * 0.004 / vib
                mono += (ganho(h * f) / h ** 0.8) * np.sin(2 * np.pi * h * f * T + beta * np.sin(2 * np.pi * vib * T + fase_v))
                h += 1
            x += panorama(mono * onda, pos)
    return nivelar(reverbera(x, 3.2, 0.5, 5))


def gravar(x, nome):
    os.makedirs(DEST, exist_ok=True)
    destino = os.path.join(DEST, nome + '.ogg')
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                        '-c:a', 'libopus', '-b:a', '80k', destino], input=x.astype(np.float32).tobytes(), capture_output=True)
    if p.returncode:
        sys.exit(p.stderr.decode())
    print(f'{os.path.relpath(destino, RAIZ)}: {L:.0f} s, {os.path.getsize(destino) // 1024} KB')


if __name__ == '__main__':
    quais = sys.argv[1:] or ['pad', 'drone', 'sinos', 'piano', 'coro']
    for nome in quais:
        gravar(globals()[nome](), nome)
