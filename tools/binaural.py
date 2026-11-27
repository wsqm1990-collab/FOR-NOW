#!/usr/bin/env python3
"""Binaural tones and colored noise for the app, made in code (they are by nature pure tones and
noise), clean and seamless:

  binaural: a slightly different tone in each ear; the difference is heard as a slow beat.
            delta 2 Hz, theta 6 Hz, alpha 10 Hz, beta 16 Hz, gamma 40 Hz. Headphones needed.
  noise:    brown (deep), pink (balanced), white (bright, softened above 12 kHz); each ear its own.

Every tone completes a whole number of cycles in the 60 s loop and the noise is shaped in one
piece, so the loop has no joint at all. Opus at a high bitrate keeps each ear exactly as made.
Usage: python3 tools/binaural.py        (writes native/midia/binaural and native/midia/ruidos)
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

BINAURAL = {           # name: (carrier Hz, beat Hz)
    'delta': (150.0, 2.0),
    'teta': (160.0, 6.0),
    'alfa': (200.0, 10.0),
    'beta': (220.0, 16.0),
    'gama': (300.0, 40.0),
}


def q(f):
    return round(f * L) / L


def tom(f):
    return np.sin(2 * np.pi * f * T) + 0.1 * np.sin(2 * np.pi * 2 * f * T + 0.4)


def binaural(portadora, batida):
    esq, dir_ = q(portadora - batida / 2), q(portadora + batida / 2)
    x = np.stack([tom(esq), tom(dir_)], axis=1)
    return x, esq, dir_


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
    for nome, (port, bat) in BINAURAL.items():
        x, e, d = binaural(port, bat)
        y, _ = M.nivelar(x, -28.0)
        destino = os.path.join(RAIZ, 'native', 'midia', 'binaural', nome + '.ogg')
        M.gravar(y, destino, 96, vbr='constrained')     # each ear stays exact (other ear leaks below -55 dB)
        z = M.ler(destino)
        pico = [np.fft.rfftfreq(N, 1 / SR)[np.argmax(np.abs(np.fft.rfft(z[:N, c])))] for c in range(2)]
        print(f'binaural {nome}: left {e:.3f} Hz, right {d:.3f} Hz; decoded peaks {pico[0]:.2f} / {pico[1]:.2f} Hz '
              f'(beat {pico[1] - pico[0]:.2f} Hz), {os.path.getsize(destino) // 1024} KB')
    for nome, incl, corte in [('marrom', -6.0, None), ('rosa', -3.0, None), ('branco', 0.0, 12000.0)]:
        y, _ = M.nivelar(ruido(incl, corte), -27.0)
        destino = os.path.join(RAIZ, 'native', 'midia', 'ruidos', nome + '.ogg')
        M.gravar(y, destino, 128)
        print(f'noise {nome}: {os.path.getsize(destino) // 1024} KB, bands {M.bandas(y)}')


if __name__ == '__main__':
    main()
