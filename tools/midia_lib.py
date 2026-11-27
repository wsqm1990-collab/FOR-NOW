"""Shared audio steps for the app's media, done once from the best source available:
decode -> (trim, seamless loop, gentle leveling) -> one fixed gain to a loudness target -> encode.

No dynamic normalizer anywhere: it made quiet parts pump and lifted the noise floor. Encoding is
Opus at a high bitrate in "audio" mode, from the original source (never re-encoding an encoded copy).
"""
import os
import re
import subprocess
import sys
import tempfile

import numpy as np

SR = 48000


def ler(caminho):
    """Any audio file -> float64 stereo at 48 kHz."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', caminho, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def _wav(x):
    f = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
    f.close()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', f.name],
                   input=x.astype(np.float32).tobytes(), check=True)
    return f.name


def medir(x):
    """(integrated loudness LUFS, true peak dBFS) of a signal."""
    w = _wav(x)
    try:
        r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', w, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                           capture_output=True, text=True).stderr
    finally:
        os.remove(w)
    i = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1])
    tp = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)[-1])
    return i, tp


def nivelar(x, alvo, pico=-1.5, limitar=False):
    """One fixed gain: loudness to `alvo` LUFS, true peak never above `pico` dBFS.
    With limitar (nature sounds), the full gain is used and only the brief peaks (a drop, a crackle)
    are held down by a fast limiter, so a peaky recording is not left much quieter than the rest;
    for sleep, softer pops are welcome anyway."""
    i, tp = medir(x)
    g = alvo - i
    if g <= pico - tp or not limitar:
        g = min(g, pico - tp)
        return x * 10 ** (g / 20), g
    return limitar_picos(x * 10 ** (g / 20), 10 ** ((pico - 0.5) / 20)), g


def limitar_picos(x, lim, ms=8.0):
    """Holds brief peaks under `lim`: the gain dips smoothly for a few milliseconds around each
    peak and is 1 everywhere else (no pumping: nothing between the peaks is touched)."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    a = max(1, int(ms / 1000 * SR))
    g = np.minimum(1.0, lim / (np.abs(x).max(axis=1) + 1e-12))
    g = minimum_filter1d(g, size=2 * a + 1, mode='nearest')
    g = uniform_filter1d(g, size=a, mode='nearest')
    return x * g[:, None]


def filtrar_ffmpeg(x, filtro):
    """Runs an ffmpeg audio filter over the signal (used for the gentle leveler on music)."""
    p = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-af', filtro,
                        '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], input=x.astype(np.float32).tobytes(), capture_output=True)
    if p.returncode:
        sys.exit(p.stderr.decode())
    return np.frombuffer(p.stdout, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def suavizar_picos(x):
    """For sleep: the loudest passages come down slowly (2:1 above -24 dB, 0.3 s in, 3 s out),
    so a sudden forte does not wake anyone. Quiet passages are untouched (nothing is lifted)."""
    return filtrar_ffmpeg(x, 'acompressor=threshold=-24dB:ratio=2:attack=300:release=3000:knee=6:makeup=1:detection=rms')


def cortar_silencio(x, limiar_db=-55.0, margem_s=0.3):
    """Removes near-silence at the start and end (keeps a short margin)."""
    m = np.abs(x).max(axis=1)
    lim = 10 ** (limiar_db / 20)
    idx = np.where(m > lim)[0]
    if not len(idx):
        return x
    a = max(0, idx[0] - int(margem_s * SR))
    b = min(len(x), idx[-1] + int(margem_s * SR))
    return x[a:b]


def fades(x, ini_s=1.5, fim_s=4.0):
    y = x.copy()
    a, b = int(ini_s * SR), int(fim_s * SR)
    if a:
        y[:a] *= (np.sin(np.linspace(0, np.pi / 2, a)) ** 2)[:, None]
    if b:
        y[-b:] *= (np.cos(np.linspace(0, np.pi / 2, b)) ** 2)[:, None]
    return y


def trecho_calmo(x, segundos, passo_s=1.0):
    """The most even stretch of a recording (no thunder, car or sudden event): the window of the
    given length whose per-second loudness (and low-frequency rumble) varies the least."""
    n = int(segundos * SR)
    if len(x) <= n:
        return x
    from scipy.signal import butter, sosfilt
    m = x.mean(axis=1)
    grave = sosfilt(butter(2, 150, 'low', fs=SR, output='sos'), m)
    k = int(passo_s * SR)
    q = len(m) // k
    nivel = 10 * np.log10(np.mean(m[:q * k].reshape(q, k) ** 2, axis=1) + 1e-12)
    ronco = 10 * np.log10(np.mean(grave[:q * k].reshape(q, k) ** 2, axis=1) + 1e-12)
    janela = int(segundos / passo_s)
    melhor, inicio = None, 0
    for s in range(0, q - janela + 1):
        a, b = nivel[s:s + janela], ronco[s:s + janela]
        custo = np.std(a) + np.std(b) + 0.5 * (np.max(b) - np.median(b))
        if melhor is None or custo < melhor:
            melhor, inicio = custo, s
    return x[inicio * k:inicio * k + n]


def laco(x, cruz_s=4.0):
    """Seamless loop: the last cruz_s seconds fade (equal power) into the first ones, so the end
    flows straight into the start."""
    c = int(cruz_s * SR)
    y = x[:len(x) - c].copy()
    t = np.linspace(0, np.pi / 2, c)[:, None]
    y[:c] = x[:c] * np.sin(t) + x[len(x) - c:] * np.cos(t)
    return y


def gravar(x, destino, kbps, vbr='on'):
    """Opus at a high bitrate, "audio" mode, from the processed full-quality signal."""
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-',
                        '-c:a', 'libopus', '-b:a', f'{kbps}k', '-vbr', vbr, '-application', 'audio', destino],
                       input=x.astype(np.float32).tobytes(), capture_output=True)
    if p.returncode:
        sys.exit(p.stderr.decode())


def bandas(x):
    """Level per band relative to the strongest (for the report): 'muffled' shows as very low highs."""
    m = x.mean(axis=1)
    n = 8192
    k = len(m) // n
    if not k:
        return []
    fr = m[:k * n].reshape(k, n) * np.hanning(n)
    S = np.mean(np.abs(np.fft.rfft(fr, axis=1)) ** 2, axis=0)
    f = np.fft.rfftfreq(n, 1 / SR)
    bs = [(60, 250), (250, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 12000), (12000, 16000)]
    tot = [10 * np.log10(np.sum(S[(f >= a) & (f < b)]) + 1e-20) for a, b in bs]
    ref = max(tot)
    return [round(v - ref) for v in tot]
