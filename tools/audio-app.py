#!/usr/bin/env python3
"""Turns the downloaded audio pack into the files the app ships with:
native/midia/voz/<voz>/<id>.ogg (one clip per sentence, from tools/audio-split.py),
native/midia/musicas/Mxx.ogg and native/midia/sons/Nxx.ogg (Opus, loudness-matched), and
web/src/voz-pt.json (sentence text -> clip, read by the page).
Usage: python3 tools/audio-app.py PACKDIR SPLITDIR"""
import json, os, shutil, subprocess, sys

pack, split = sys.argv[1], sys.argv[2]
dest = 'native/midia'
shutil.rmtree(dest, ignore_errors=True)
os.makedirs(dest)
shutil.copytree(os.path.join(split, 'voz'), os.path.join(dest, 'voz'))


def opus(src, dst, alvo, kbps, canais):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', f'loudnorm=I={alvo}:TP=-3:LRA=11',
                    '-ac', str(canais), '-ar', '48000', '-c:a', 'libopus', '-b:a', f'{kbps}k', dst], check=True)


for pasta, alvo, kbps, canais in (('musicas', -23, 80, 2), ('sons', -25, 64, 2)):
    origem = os.path.join(pack, pasta)
    if not os.path.isdir(origem):
        continue
    for f in sorted(os.listdir(origem)):
        if f.endswith('.mp3'):
            opus(os.path.join(origem, f), os.path.join(dest, pasta, f[:-4] + '.ogg'), alvo, kbps, canais)

mapa = json.load(open(os.path.join(split, 'voz-pt.json'), encoding='utf-8'))
mapa = {voz: {txt: 'midia/voz/' + arq for txt, arq in m.items()} for voz, m in mapa.items()}
json.dump(mapa, open('web/src/voz-pt.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)

tot = 0
for raiz, _, arqs in os.walk(dest):
    for a in arqs:
        tot += os.path.getsize(os.path.join(raiz, a))
print(f'midia do app: {tot // 1024} KB em {sum(len(f) for _, _, f in os.walk(dest))} arquivos')
