#!/usr/bin/env python3
"""Cuts each voice block (one ElevenLabs file per block, sentences separated by long pauses) into
one clip per sentence, checks the count against the script (audio/roteiro-pt.json, or the one given)
and encodes the clips for the app (Opus 64 kbps in .ogg, mono, one fixed gain per block: no pumping,
no raised noise). Writes OUT/voz/<voz>/<id>.ogg, OUT/voz-<lang>.json (sentence text -> file) and
OUT/divisao.txt (what was found for every block).
Usage: python3 tools/audio-split.py PACKDIR OUT [audio/roteiro-en.json]"""
import hashlib, json, os, re, subprocess, sys

pack, out = sys.argv[1], sys.argv[2]
rot = json.load(open(sys.argv[3] if len(sys.argv) > 3 else 'audio/roteiro-pt.json', encoding='utf-8'))
lang = rot.get('idioma', 'pt-BR')[:2]
os.makedirs(out, exist_ok=True)
rel, mapa, problemas = [], {}, 0


def duracao(f):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def silencios(f, ruido, minimo):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', f'silencedetect=noise={ruido}dB:d={minimo}', '-f', 'null', '-'],
                       capture_output=True, text=True)
    ini = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r.stderr)]
    fim = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
    return list(zip(ini, fim + [None] * (len(ini) - len(fim))))


def trechos(f, ruido, minimo):
    total = duracao(f)
    s = [(a, b if b is not None else total) for a, b in silencios(f, ruido, minimo)]
    partes, t = [], 0.0
    for a, b in s:
        if a - t > 0.25:
            partes.append((t, a))
        t = b
    if total - t > 0.25:
        partes.append((t, total))
    return partes


def ganho_fixo(f, alvo=-23.0, pico=-2.0):
    """One fixed gain for the whole file (every clip of a block keeps its natural level):
    measured integrated loudness to the target, never pushing the peak above `pico` dBFS.
    (A dynamic normalizer per clip made the voice pump and raised the breaths and the noise.)"""
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    i = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1])
    tp = float(re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)[-1])
    return min(alvo - i, pico - tp)


def chave(texto):
    return hashlib.sha1(texto.strip().encode('utf-8')).hexdigest()[:12]


for voz in ('feminina', 'masculina'):
    mapa[voz] = {}
    os.makedirs(os.path.join(out, 'voz', voz), exist_ok=True)
    for b in rot['blocos']:
        f = os.path.join(pack, 'vozes', voz, b['id'] + '.mp3')
        n = len(b['frases'])
        if not os.path.exists(f):
            rel.append(f'FALTOU {voz}/{b["id"]}: arquivo não está no pacote')
            problemas += 1
            continue
        achou, escolha = None, None
        for minimo in (1.0, 0.9, 0.8, 0.7, 0.6, 1.2, 0.5):
            for ruido in (-40, -35, -45, -30):
                p = trechos(f, ruido, minimo)
                if len(p) == n:
                    achou, escolha = p, (ruido, minimo)
                    break
            if achou:
                break
        if not achou:
            p = trechos(f, -40, 0.8)
            rel.append(f'ERRO {voz}/{b["id"]}: esperava {n} frases, achei {len(p)} ({", ".join(f"{x[1]-x[0]:.1f}s" for x in p)})')
            problemas += 1
            continue
        g = ganho_fixo(f)
        rel.append(f'ok {voz}/{b["id"]}: {n} frases (ruído {escolha[0]} dB, pausa {escolha[1]} s, ganho {g:+.1f} dB): ' + ', '.join(f'{x[1]-x[0]:.1f}s' for x in achou))
        for (a, z), texto in zip(achou, b['frases']):
            nome = chave(texto) + '.ogg'
            destino = os.path.join(out, 'voz', voz, nome)
            ini, fim = max(0.0, a - 0.12), z + 0.25
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{ini:.3f}', '-to', f'{fim:.3f}', '-i', f,
                            '-af', f'afade=t=in:d=0.03,areverse,afade=t=in:d=0.12,areverse,volume={g:.2f}dB',
                            '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '64k', '-application', 'audio', destino], check=True)
            mapa[voz][texto] = f'{voz}/{nome}'

json.dump(mapa, open(os.path.join(out, f'voz-{lang}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
resumo = f'{sum(len(v) for v in mapa.values())} frases cortadas; {problemas} problema(s)'
open(os.path.join(out, 'divisao.txt'), 'w', encoding='utf-8').write(resumo + '\n' + '\n'.join(rel) + '\n')
print(resumo)
print('\n'.join(rel))
