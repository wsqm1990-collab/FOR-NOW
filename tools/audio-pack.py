#!/usr/bin/env python3
"""Downloads every audio file listed in audio/manifest.json (links from ElevenLabs, valid for some
hours), checks that each one is real audio, and packs them into one ZIP with folders.
Usage: python3 tools/audio-pack.py audio/manifest.json OUTDIR
Writes OUTDIR/ForNow-audios.zip and OUTDIR/relatorio.txt (one line per file)."""
import json, os, subprocess, sys, time, urllib.request, zipfile

man = json.load(open(sys.argv[1], encoding='utf-8'))
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
base = os.path.join(out, 'ForNow-audios')
linhas, ok, faltando = [], 0, []


def duracao(f):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


for it in man['itens']:
    destino = os.path.join(base, it['arquivo'])
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    erro = None
    for tentativa in range(4):
        try:
            req = urllib.request.Request(it['url'], headers={'User-Agent': 'ForNow-audio-pack'})
            with urllib.request.urlopen(req, timeout=60) as r, open(destino, 'wb') as f:
                f.write(r.read())
            erro = None
            break
        except Exception as e:  # expired link, network hiccup
            erro = str(e)
            time.sleep(3 * (tentativa + 1))
    tam = os.path.getsize(destino) if os.path.exists(destino) else 0
    dur = duracao(destino) if tam else 0.0
    if erro or tam < 2000 or dur <= 0.2:
        faltando.append(it['arquivo'])
        linhas.append(f"FALTOU {it['arquivo']} ({erro or 'arquivo vazio ou não é áudio'})")
        if os.path.exists(destino):
            os.remove(destino)
    else:
        ok += 1
        linhas.append(f"ok {it['arquivo']} {tam // 1024} KB {dur:.1f} s")

zpath = os.path.join(out, 'ForNow-audios.zip')
with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_STORED) as z:  # mp3 doesn't compress further
    for raiz, _, arquivos in os.walk(base):
        for a in sorted(arquivos):
            caminho = os.path.join(raiz, a)
            z.write(caminho, os.path.relpath(caminho, base))
resumo = f"{ok} de {len(man['itens'])} arquivos; ZIP com {os.path.getsize(zpath) // 1024} KB"
open(os.path.join(out, 'relatorio.txt'), 'w', encoding='utf-8').write(resumo + '\n' + '\n'.join(linhas) + '\n')
print(resumo)
print('\n'.join(linhas))
sys.exit(0 if ok else 1)
