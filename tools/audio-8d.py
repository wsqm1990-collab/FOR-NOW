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

Usage: python3 tools/audio-8d.py [name ...]  (writes native/midia/8d/{musicas,sons,camadas}; names limit it)
"""
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from som8d import SR, oito_d  # noqa: E402

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
                        '-c:a', 'libopus', '-b:a', f'{kbps}k', '-vbr', 'on', '-application', 'audio', destino],
                       input=x.astype(np.float32).tobytes(), capture_output=True)
    if p.returncode:
        sys.exit(p.stderr.decode())


def main():
    trabalhos = []
    for f in sorted(os.listdir(os.path.join(MIDIA, 'musicas'))):
        if f.endswith('.ogg'):
            trabalhos.append((os.path.join(MIDIA, 'musicas', f), os.path.join(DEST, 'musicas', f), 15.0, False, 80))
    for f in sorted(os.listdir(os.path.join(MIDIA, 'sons'))):
        if f.endswith('.ogg'):
            trabalhos.append((os.path.join(MIDIA, 'sons', f), os.path.join(DEST, 'sons', f), 15.0, True, 64))
    camadas = os.path.join(MIDIA, 'camadas')
    if os.path.isdir(camadas):
        for f in sorted(os.listdir(camadas)):
            if f.endswith('.ogg'):
                trabalhos.append((os.path.join(camadas, f), os.path.join(DEST, 'camadas', f), 16.0, True, 80))
    grave = os.path.join(RAIZ, 'web', 'sons', 'grave.ogg')
    if os.path.exists(grave):
        trabalhos.append((grave, os.path.join(DEST, 'sons', 'grave.ogg'), 16.0, True, 64))

    if sys.argv[1:]:
        trabalhos = [x for x in trabalhos if any(n in x[0] for n in sys.argv[1:])]
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
