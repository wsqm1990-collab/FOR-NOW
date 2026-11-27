"""8D for headphones: one source (mono) travels a slow circle around the head: equal-power level
between the ears (never fully one-sided), a small time difference between the ears (up to 0.45 ms),
a slightly darker, softer tone behind, and a quiet still room. For loops, the circle closes at the
loop point and the room's tail wraps around, so the loop stays seamless. Same loudness as the input.
"""
import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000


def filtrar(sos, x, laco):
    """Filter; for a loop, run it twice around so the start already has the loop's history."""
    if not laco:
        return sosfilt(sos, x)
    return sosfilt(sos, np.concatenate([x, x]))[len(x):]


def sala(n_ir, semente):
    """A still, diffuse room, like a real one: the low part of the echo lasts about 1.1 s, the
    high part dies sooner (0.45 s), so the tail is soft and never hisses. Short pre-delay."""
    rng = np.random.default_rng(semente)
    t = np.arange(n_ir) / SR
    ruido = rng.standard_normal(n_ir)
    grave = sosfilt(butter(2, 1800, 'low', fs=SR, output='sos'), ruido) * np.exp(-6.9 * t / 1.1)
    agudo = sosfilt(butter(2, 1800, 'high', fs=SR, output='sos'), ruido) * np.exp(-6.9 * t / 0.45)
    ir = sosfilt(butter(1, 7000, 'low', fs=SR, output='sos'), grave + 0.6 * agudo)
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
    escuro = filtrar(butter(2, 4500, 'low', fs=SR, output='sos'), m, laco)
    fonte = (m * (1 - 0.35 * atras) + escuro * 0.35 * atras) * (1 - 0.12 * atras)

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
    y = np.stack([esq + 0.13 * molhado[0], dir_ + 0.13 * molhado[1]], axis=1)

    # same loudness as the original, no clipping
    y *= np.sqrt(np.mean(x ** 2)) / max(1e-9, np.sqrt(np.mean(y ** 2)))
    pico = np.max(np.abs(y))
    if pico > 0.97:
        y *= 0.97 / pico
    return y
