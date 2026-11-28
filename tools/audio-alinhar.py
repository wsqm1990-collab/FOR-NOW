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


NUMEROS = {'0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven',
           '8': 'eight', '9': 'nine', '10': 'ten', '11': 'eleven', '12': 'twelve'}


def norm(w):
    """Words to compare: lower case, no punctuation, digits as words ("4" and "four" are the same)."""
    w = w.lower().replace('\u2019', "'").replace('-', ' ')
    out = [p for p in (re.sub(r"[^0-9a-zà-ÿ']+", '', x) for x in w.split()) if p]
    return [NUMEROS.get(p, p) if lang == 'en' else p for p in out]


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
        segs, _ = modelo.transcribe(x, language=lang, word_timestamps=True, beam_size=5,    # 16 kHz mono, decoded by ffmpeg
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
        # stretches of voice, joined across pauses shorter than 0.25 s (those are inside words)
        ilhas, t = [], None
        for q, v in enumerate(env > voz_lim):
            if v and t is None:
                t = q
            elif not v and t is not None:
                if ilhas and (t - ilhas[-1][1]) * k / SR < 0.25:
                    ilhas[-1][1] = q
                else:
                    ilhas.append([t, q])
                t = None
        if t is not None:
            ilhas.append([t, len(env)])
        ilhas = [(a * k / SR, z * k / SR) for a, z in ilhas]
        n = len(b['frases'])
        # chars per second of this voice in this block, from the sentences heard whole
        ouvidas = [(fr, fa) for fr, fa in zip(b['frases'], faixas) if fa[0] is not None]
        ritmo = sum(len(fr) for fr, _ in ouvidas) / max(0.1, sum(fa[1] - fa[0] for _, fa in ouvidas))
        plausivel = lambda fr, d: 0.4 * len(fr) / ritmo - 0.3 <= d <= 1.8 * len(fr) / ritmo + 1.0
        trechos, como = [None] * n, [''] * n
        for i, (fr, (a, z, _)) in enumerate(zip(b['frases'], faixas)):
            if a is None:
                continue
            # the stretches of voice its words fall on: the whole sentence, none of its neighbours
            mine = [il for il in ilhas if il[1] > a + 0.05 and il[0] < z - 0.05]
            if mine and plausivel(fr, mine[-1][1] - mine[0][0]):
                trechos[i] = (mine[0][0], mine[-1][1])
        # sentences the recognizer missed (or merged): between their good neighbours, cut at the
        # longest pauses, if each piece is about as long as its words need
        i = 0
        while i < n:
            if trechos[i]:
                i += 1
                continue
            j = i
            while j + 1 < n and not trechos[j + 1]:
                j += 1
            esq = trechos[i - 1][1] if i > 0 and trechos[i - 1] else 0.0
            dir_ = trechos[j + 1][0] if j + 1 < n and trechos[j + 1] else dur
            dentro = [il for il in ilhas if il[0] >= esq - 0.01 and il[1] <= dir_ + 0.01]
            m = j - i + 1
            if len(dentro) >= m:
                cortes = sorted(sorted(range(len(dentro) - 1), key=lambda q: dentro[q + 1][0] - dentro[q][1], reverse=True)[:m - 1])
                partes, ini_q = [], 0
                for c in cortes + [len(dentro) - 1]:
                    partes.append((dentro[ini_q][0], dentro[c][1]))
                    ini_q = c + 1
                if all(plausivel(b['frases'][i + q], z - a) for q, (a, z) in enumerate(partes)):
                    for q, parte in enumerate(partes):
                        trechos[i + q] = parte
                        como[i + q] = ' (pela pausa)'
            i = j + 1
        # each clip: its voice with a little air, never past halfway to the next voice
        linha, ruins = [], []
        for i, frase in enumerate(b['frases']):
            if not trechos[i]:
                a, z, cob = faixas[i]
                ruins.append(f'frase {i + 1} ({cob:.0%} das palavras' + (f', {z - a:.1f} s' if a is not None else '') + f'): {frase}')
                continue
            a, z = trechos[i]
            antes = max([x[1] for x in ilhas if x[1] <= a + 0.001] + [0.0])
            depois = min([x[0] for x in ilhas if x[0] >= z - 0.001] + [dur])
            ini = max(a - 0.12, (antes + a) / 2, 0.0)
            fim = min(z + 0.25, (z + depois) / 2, dur)
            nome = chave(frase) + '.ogg'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{ini:.3f}', '-to', f'{fim:.3f}', '-i', f,
                            '-af', f'afade=t=in:d=0.03,areverse,afade=t=in:d=0.12,areverse,volume={g:.2f}dB',
                            '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '64k', '-application', 'audio',
                            os.path.join(out, 'voz', voz, nome)], check=True)
            mapa[voz][frase] = f'{voz}/{nome}'
            linha.append(f'{fim - ini:.1f}s{como[i]}')
        if ruins or any(como):   # what was heard there, to see why
            rel.append(f'   ouvido em {voz}/{b["id"]}: ' + ' '.join(f'{w[0]}@{w[1]:.1f}' for w in ws))
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
