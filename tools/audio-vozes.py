#!/usr/bin/env python3
"""Puts the voice clips of one language into the app, without touching the rest of its media:
native/midia/voz/ (Portuguese) or native/midia/voz-<lang>/ (other languages), and the map the page
reads, web/src/voz-<lang>.json (sentence text -> clip). The clips come from tools/audio-split.py.
Usage: python3 tools/audio-vozes.py SPLITDIR en"""
import json, os, shutil, sys

split, lang = sys.argv[1], sys.argv[2]
pasta = 'voz' if lang == 'pt' else f'voz-{lang}'
dest = os.path.join('native', 'midia', pasta)
shutil.rmtree(dest, ignore_errors=True)
shutil.copytree(os.path.join(split, 'voz'), dest)
mapa = json.load(open(os.path.join(split, f'voz-{lang}.json'), encoding='utf-8'))
mapa = {voz: {txt: f'midia/{pasta}/' + arq for txt, arq in m.items()} for voz, m in mapa.items()}
json.dump(mapa, open(os.path.join('web', 'src', f'voz-{lang}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
n = sum(len(m) for m in mapa.values())
tam = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(dest) for f in fs)
print(f'{n} clips in {dest} ({tam // 1024} KB), map in web/src/voz-{lang}.json')
