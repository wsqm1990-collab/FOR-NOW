#!/usr/bin/env python3
"""8D versions of the app's music and nature sounds, for headphones: the sound circles slowly
around the listener.

Each file is turned into one source (mono) that travels a circle around the head:
  - level between the ears with an equal-power pan, never fully in one ear;
  - a small time difference between the ears (up to 0.45 ms), as a real head hears it;
  - a slightly softer, darker tone while it passes behind;
  - a quiet room around it that stays still while the sound moves.
Loops (the 30 s nature sounds, the 48 s soft noise) stay seamless: the circle closes exactly at
the loop point and the room's tail wraps around. Loudness matches the original file.

Usage: python3 tools/audio-8d.py            (writes native/midia/8d/musicas and native/midia/8d/sons)
"""
import os
import subprocess
import sys

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
MIDIA = os.path.join(RAIZ, 'native', 'midia')
DEST = os.path.join(MIDIA, '8d')


def ler(caminho):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', caminho, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def gravar(x, destino, kbps):
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                        '-c:a', 'libopus', '-b:a', f'{kbps}k', destino],
                       input=x.astype(np.float32).tobytes(), capture_output=True)
    if p.returncode:
        sys.exit(p.stderr.decode())


def filtrar(sos, x, laco):
    """Filter; for a loop, run it twice around so the start already has the loop's history."""
    if not laco:
        return sosfilt(sos, x)
    return sosfilt(sos, np.concatenate([x, x]))[len(x):]


def sala(n_ir, semente):
    """A still, diffuse room: decaying noise (about 1.1 s), a little darker, with a short pre-delay."""
    rng = np.random.default_rng(semente)
    t = np.arange(n_ir) / SR
    ir = rng.standard_normal(n_ir) * np.exp(-6.9 * t / 1.1)
    ir = sosfilt(butter(1, 5000, 'low', fs=SR, output='sos'), ir)
    ir = np.concatenate([np.zeros(int(0.012 * SR)), ir])
    return ir / np.sqrt(np.sum(ir ** 2))


def oito_d(x, periodo, laco):
    n = len(x)
    m = x.mean(axis=1)
    t = np.arange(n) / SR
    ang = 2 * np.pi * t / periodo            # 0 = in front, pi/2 = right, pi = behind, 3pi/2 = left
    lado = np.sin(ang)                       # -1 left .. 1 right
    atras = (1 - np.cos(ang)) / 2            # 0 in front .. 1 behind

    # behind: darker and a little softer
    escuro = filtrar(butter(2, 3200, 'low', fs=SR, output='sos'), m, laco)
    fonte = (m * (1 - 0.55 * atras) + escuro * 0.55 * atras) * (1 - 0.15 * atras)

    # time difference between the ears: the far ear hears it later
    itd = 0.00045 * lado * SR                # samples; > 0 means the sound is on the right
    idx = np.arange(n, dtype=np.float64)
    atraso_e, atraso_d = np.clip(itd, 0, None), np.clip(-itd, 0, None)
    if laco:
        esq = np.interp((idx - atraso_e) % n, idx, fonte, period=n)
        dir_ = np.interp((idx - atraso_d) % n, idx, fonte, period=n)
    else:
        esq = np.interp(idx - atraso_e, idx, fonte, left=0.0)
        dir_ = np.interp(idx - atraso_d, idx, fonte, left=0.0)

    # level between the ears (equal power, never fully one-sided)
    pos = 0.85 * lado
    esq *= np.cos(np.pi / 4 * (1 + pos))
    dir_ *= np.sin(np.pi / 4 * (1 + pos))

    # the room: the same for both ears' source, different tails, so it feels wide and still
    n_ir = int(1.4 * SR)
    molhado = []
    for semente in (8, 13):
        w = fftconvolve(fonte, sala(n_ir, semente))
        if laco:
            cauda = w[n:]
            w = w[:n].copy()
            for k in range(0, len(cauda), n):       # the tail wraps onto the start of the loop
                pedaco = cauda[k:k + n]
                w[:len(pedaco)] += pedaco
        else:
            w = w[:n]
        molhado.append(w)
    y = np.stack([esq + 0.2 * molhado[0], dir_ + 0.2 * molhado[1]], axis=1)

    # same loudness as the original, no clipping
    y *= np.sqrt(np.mean(x ** 2)) / max(1e-9, np.sqrt(np.mean(y ** 2)))
    pico = np.max(np.abs(y))
    if pico > 0.97:
        y *= 0.97 / pico
    return y


def main():
    trabalhos = []
    for f in sorted(os.listdir(os.path.join(MIDIA, 'musicas'))):
        if f.endswith('.ogg'):
            trabalhos.append((os.path.join(MIDIA, 'musicas', f), os.path.join(DEST, 'musicas', f), 15.0, False, 80))
    for f in sorted(os.listdir(os.path.join(MIDIA, 'sons'))):
        if f.endswith('.ogg'):
            trabalhos.append((os.path.join(MIDIA, 'sons', f), os.path.join(DEST, 'sons', f), 15.0, True, 64))
    grave = os.path.join(RAIZ, 'web', 'sons', 'grave.ogg')
    if os.path.exists(grave):
        trabalhos.append((grave, os.path.join(DEST, 'sons', 'grave.ogg'), 16.0, True, 64))

    for origem, destino, periodo, laco, kbps in trabalhos:
        x = ler(origem)
        if laco:
            dur = len(x) / SR
            voltas = max(1, round(dur / periodo))
            periodo = dur / voltas               # the circle closes exactly at the loop point
        y = oito_d(x, periodo, laco)
        gravar(y, destino, kbps)
        print(f'{os.path.relpath(destino, RAIZ)}: {len(x) / SR:.1f} s, one turn every {periodo:.1f} s, '
              f'{os.path.getsize(destino) // 1024} KB')


if __name__ == '__main__':
    main()
