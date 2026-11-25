# Gera os sons do app (sem gravações de terceiros): chuva, ruído grave, ondas e o alarme suave.
# Uso: python3 tools/sons.py   (precisa de numpy e ffmpeg com libvorbis)
# Os sons ambientes são laços sem emenda audível (o fim se mistura no começo).
import os
import subprocess
import numpy as np

SR = 44100
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(20261125)


def filtro_fft(x, lo=None, hi=None, inclinacao=0.0):
    """Filtro suave no domínio da frequência: passa-alta, passa-baixa e inclinação (dB/oitava)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** 4)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if inclinacao:
        g *= (np.maximum(f, 20) / 1000.0) ** (inclinacao / 6.02)
    return np.fft.irfft(X * g, n=len(x))


def rosa(n):
    return filtro_fft(rng.standard_normal(n), inclinacao=-3.0)


def laco(x, segundos_mistura=2.0):
    n = int(segundos_mistura * SR)
    corpo = x[:-n].copy()
    cauda = x[-n:]
    f = np.linspace(0, 1, n)
    corpo[:n] = corpo[:n] * np.sqrt(f) + cauda * np.sqrt(1 - f)
    return corpo


def normalizar(x, rms_db=-24.0, pico_db=-3.0):
    rms = np.sqrt(np.mean(x ** 2)) + 1e-12
    x = x * (10 ** (rms_db / 20) / rms)
    pico = np.max(np.abs(x))
    lim = 10 ** (pico_db / 20)
    if pico > lim:
        x = np.tanh(x / lim) * lim
    return x


def salvar(x, caminho, q=2):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    raw = caminho + '.raw'
    x.astype('<f4').tofile(raw)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', raw,
                    '-c:a', 'libvorbis', '-q:a', str(q), caminho], check=True)
    os.remove(raw)
    print(f'{os.path.relpath(caminho, RAIZ)}: {len(x) / SR:.1f} s, {os.path.getsize(caminho) // 1024} KB')


def chuva(seg=48):
    n = int((seg + 2) * SR)
    base = filtro_fft(rosa(n), lo=300, hi=8000) * 0.35
    gotas = np.zeros(n)
    # muitas gotas finas
    for taxa, dur_ms, amp, lo, hi in [(420, 3, 0.25, 2500, 9000), (60, 8, 0.5, 900, 4000), (6, 25, 0.8, 400, 1800)]:
        k = rng.poisson(taxa * n / SR)
        pos = rng.integers(0, n - 4000, k)
        tam = int(dur_ms / 1000 * SR)
        env = np.exp(-np.linspace(0, 6, tam))
        for p in pos:
            gotas[p:p + tam] += rng.standard_normal(tam) * env * amp * rng.lognormal(0, 0.6)
    gotas = filtro_fft(gotas, lo=600, hi=7500)
    x = base + gotas * 0.6
    return normalizar(laco(x), rms_db=-24)


def grave(seg=48):
    n = int((seg + 2) * SR)
    x = filtro_fft(rng.standard_normal(n), lo=30, hi=500, inclinacao=-6.0)
    return normalizar(laco(x), rms_db=-24)


def ondas(seg=48, periodo=8.0):
    n = int((seg + 2) * SR)
    t = np.arange(n) / SR
    env = 0.22 + 0.78 * (0.5 - 0.5 * np.cos(2 * np.pi * t / periodo)) ** 1.6
    corpo = filtro_fft(rosa(n), lo=60, hi=1400) * env
    espuma = filtro_fft(rosa(n), lo=900, hi=4500) * env ** 3 * 0.45
    x = corpo + espuma
    return normalizar(laco(x), rms_db=-24)


def alarme(periodo=3.2):
    n = int(periodo * SR)
    x = np.zeros(n)
    notas = [(659.25, 0.0), (830.61, 0.32), (987.77, 0.64)]
    for f0, ini in notas:
        tam = int(2.2 * SR)
        tt = np.arange(tam) / SR
        sino = (np.sin(2 * np.pi * f0 * tt) + 0.35 * np.sin(2 * np.pi * f0 * 2.0 * tt) * np.exp(-tt * 1.5)
                + 0.15 * np.sin(2 * np.pi * f0 * 2.76 * tt) * np.exp(-tt * 3.0))
        sino *= np.exp(-tt / 0.75) * (1 - np.exp(-tt * 400))
        a = int(ini * SR)
        fim = min(n, a + tam)
        x[a:fim] += sino[:fim - a]
    x = x / np.max(np.abs(x)) * 10 ** (-2 / 20)
    return x


if __name__ == '__main__':
    salvar(chuva(), os.path.join(RAIZ, 'web', 'sons', 'chuva.ogg'))
    salvar(grave(), os.path.join(RAIZ, 'web', 'sons', 'grave.ogg'))
    salvar(ondas(), os.path.join(RAIZ, 'web', 'sons', 'ondas.ogg'))
    salvar(alarme(), os.path.join(RAIZ, 'native', 'android-src', 'res', 'raw', 'fn_alarme.ogg'), q=4)
