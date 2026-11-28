#!/usr/bin/env python3
"""Cuts each voice block into one clip per sentence by what is actually said, not only by the pauses.

Each block (one ElevenLabs file, the sentences separated by long pauses) is transcribed with word
times (faster-whisper). The script's sentences are matched to the heard words in order, each clip
spans the words of its own sentence (with a little air before and after), and each cut falls in
the quietest moment between one sentence and the next. A pause count alone can be fooled: a voice
may rest inside a sentence ("I'll be quiet now. ... Stay with the sound.") and hurry a long pause,
and then every later clip would carry the wrong sentence.

A sentence whose words were not heard well enough is reported and left out, so the app reads it
with the phone's voice instead of playing the wrong clip.

Clips: Opus 64 kbps in .ogg, mono, one fixed gain per block (no pumping, no raised noise).
Writes OUT/voz/<voz>/<id>.ogg, OUT/voz-<lang>.json (sentence text -> file) and OUT/divisao.txt.
Usage: python3 tools/audio-alinhar.py PACKDIR OUT audio/roteiro-en.json
"""
import difflib
import hashlib
import json
import os
import re
import subprocess
import sys

import numpy as np

pack, out, rot_path = sys.argv[1], sys.argv[2], sys.argv[3]
rot = json.load(open(rot_path, encoding='utf-8'))
lang = rot.get('idioma', 'en-US')[:2]
SR = 16000                     # analysis rate
ANTES, DEPOIS = 0.20, 0.35     # air kept when there is no pause to cut in
MIN_COBERTURA = 0.7            # share of a sentence's words that must be heard
os.makedirs(out, exist_ok=True)
rel, mapa, problemas = [], {}, 0


def ler(f):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def norm(w):
    w = w.lower().replace('\u2019', "'").replace('-', ' ')
    return [p for p in (re.sub(r"[^0-9a-zà-ÿ']+", '', x) for x in w.split()) if p]


def palavras(texto):
    return [p for x in texto.split() for p in norm(x)]


def energia(x, janela=0.02):
    k = int(janela * SR)
    n = len(x) // k
    return np.sqrt(np.mean(x[:n * k].reshape(n, k) ** 2, axis=1) + 1e-12), k


def mais_quieto(env, k, a, z):
    """The quietest moment between times a and z (seconds), by 20 ms windows."""
    i, j = int(a * SR / k), int(z * SR / k)
    if j <= i:
        return (a + z) / 2
    return (i + int(np.argmin(env[i:j]))) * k / SR + k / SR / 2


def ganho_fixo(f, alvo=-23.0, pico=-2.0):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    i = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1])
    tp = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)[-1])
    return min(alvo - i, pico - tp)


def chave(texto):
    return hashlib.sha1(texto.strip().encode('utf-8')).hexdigest()[:12]


from faster_whisper import WhisperModel  # noqa: E402

modelo = WhisperModel('small.en' if lang == 'en' else 'small', device='cpu', compute_type='int8')

for voz in ('feminina', 'masculina'):
    mapa[voz] = {}
    os.makedirs(os.path.join(out, 'voz', voz), exist_ok=True)
    for b in rot['blocos']:
        f = os.path.join(pack, 'vozes', voz, b['id'] + '.mp3')
        if not os.path.exists(f):
            rel.append(f'FALTOU {voz}/{b["id"]}: arquivo não está no pacote')
            problemas += 1
            continue
        x = ler(f)
        dur = len(x) / SR
        env, k = energia(x)
        segs, _ = modelo.transcribe(f, language=lang, word_timestamps=True, beam_size=5,
                                    condition_on_previous_text=False, vad_filter=False)
        ws = []
        for s in segs:
            for w in s.words:
                for p in norm(w.word):
                    ws.append((p, w.start, w.end))
        ouvido = [w[0] for w in ws]
        esperado, dono = [], []
        for i, frase in enumerate(b['frases']):
            for p in palavras(frase):
                esperado.append(p)
                dono.append(i)
        casa = {}
        for m in difflib.SequenceMatcher(a=esperado, b=ouvido, autojunk=False).get_matching_blocks():
            for d in range(m.size):
                casa[m.a + d] = m.b + d
        # each sentence: where its heard words start and end, and how many were heard
        faixas = []
        for i, frase in enumerate(b['frases']):
            idx = [casa[j] for j in range(len(esperado)) if dono[j] == i and j in casa]
            total = sum(1 for d in dono if d == i)
            cob = len(idx) / max(1, total)
            faixas.append((ws[min(idx)][1], ws[max(idx)][2], cob) if idx and cob >= MIN_COBERTURA else (None, None, cob))
        sobras = len(ouvido) - len(casa)
        g = ganho_fixo(f)
        voz_lim = float(np.max(env)) * 10 ** (-40 / 20)       # quieter than this is silence
        linha, ruins = [], []
        for i, (frase, (a, z, cob)) in enumerate(zip(b['frases'], faixas)):
            if a is None:
                ruins.append(f'frase {i + 1} ({cob:.0%} das palavras): {frase}')
                continue
            # the edges: the quietest moment in the pause before and after (never into a neighbour)
            ant = next((faixas[j][1] for j in range(i - 1, -1, -1) if faixas[j][0] is not None), 0.0)
            prox = next((faixas[j][0] for j in range(i + 1, len(faixas)) if faixas[j][0] is not None), dur)
            esq = mais_quieto(env, k, max(ant, a - 1.5), a) if ant < a else max(0.0, a - ANTES)
            dir_ = mais_quieto(env, k, z, min(prox, z + 1.5)) if z < prox else min(dur, z + DEPOIS)
            # then tight on the voice itself, with a little air
            i0, i1 = int(esq * SR / k), max(int(esq * SR / k) + 1, int(dir_ * SR / k))
            alto = np.nonzero(env[i0:i1] > voz_lim)[0]
            if len(alto):
                ini = max(esq, (i0 + alto[0]) * k / SR - 0.12)
                fim = min(dir_, (i0 + alto[-1] + 1) * k / SR + 0.25)
            else:
                ini, fim = esq, dir_
            nome = chave(frase) + '.ogg'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{ini:.3f}', '-to', f'{fim:.3f}', '-i', f,
                            '-af', f'afade=t=in:d=0.03,areverse,afade=t=in:d=0.12,areverse,volume={g:.2f}dB',
                            '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '64k', '-application', 'audio',
                            os.path.join(out, 'voz', voz, nome)], check=True)
            mapa[voz][frase] = f'{voz}/{nome}'
            linha.append(f'{fim - ini:.1f}s')
        ok = len(b['frases']) - len(ruins)
        rel.append(f'{"ok" if not ruins else "FALTA"} {voz}/{b["id"]}: {ok} de {len(b["frases"])} frases '
                   f'(ganho {g:+.1f} dB, palavras a mais ouvidas: {sobras}): ' + ', '.join(linha))
        for r in ruins:
            rel.append(f'   não ouvida: {r}')
        problemas += len(ruins)

json.dump(mapa, open(os.path.join(out, f'voz-{lang}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
resumo = f'{sum(len(v) for v in mapa.values())} frases cortadas pelo que foi dito; {problemas} problema(s)'
open(os.path.join(out, 'divisao.txt'), 'w', encoding='utf-8').write(resumo + '\n' + '\n'.join(rel) + '\n')
print(resumo)
print('\n'.join(rel))
