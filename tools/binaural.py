#!/usr/bin/env python3
"""Colored noise for the app, made in code (noise is by nature synthetic), clean and seamless:
brown (deep), pink (balanced), white (bright, softened above 12 kHz); each ear its own.
The noise is shaped in one piece, so the 60 s loop has no joint at all.

The binaural beats and the pure-tone frequencies are not files: the phone makes them sample by
sample (native/android-src/java/Tom.java, recipes in TONS, web/src/05-conteudo.js), because a
recorded tone that repeats wobbles for a moment at each joint.
Usage: python3 tools/binaural.py        (writes native/midia/ruidos)
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import midia_lib as M  # noqa: E402

SR = M.SR
L = 60.0
N = int(L * SR)
T = np.arange(N) / SR
RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
rng = np.random.default_rng(1127)

def ruido(inclinacao_db_oitava, corte_alto=None):
    out = []
    f = np.fft.rfftfreq(N, 1 / SR)
    g = np.ones_like(f)
    g[1:] = (np.maximum(f[1:], 20.0) / 1000.0) ** (inclinacao_db_oitava / 6.02)
    g[0] = 0.0
    g *= 1 / np.sqrt(1 + (18.0 / np.maximum(f, 1e-3)) ** 4)          # nothing below hearing
    if corte_alto:
        g *= 1 / np.sqrt(1 + (f / corte_alto) ** 4)
    for _ in range(2):
        out.append(np.fft.irfft(np.fft.rfft(rng.standard_normal(N)) * g, n=N))
    return np.stack(out, axis=1)


def main():
    for nome, incl, corte in [('marrom', -6.0, None), ('rosa', -3.0, None), ('branco', 0.0, 12000.0)]:
        y, _ = M.nivelar(ruido(incl, corte), -27.0)
        destino = os.path.join(RAIZ, 'native', 'midia', 'ruidos', nome + '.ogg')
        M.gravar(y, destino, 128)
        print(f'noise {nome}: {os.path.getsize(destino) // 1024} KB, bands {M.bandas(y)}')


if __name__ == '__main__':
    main()
