#!/usr/bin/env python3
"""Downloads the real, free recordings in audio/reais.json (nature: BigSoundBank CC0; music:
Musopen CC0, Open Goldberg CC0, Musopen via Wikimedia Commons public domain) and turns them into
the app's media, each from its best available source:

  nature: the most even stretch (no thunder or passing car), a seamless 4 s loop joint,
          one fixed gain to -25 LUFS, Opus 112 kbps; and an 8D copy.
  music:  silence trimmed, loudest passages softened slowly (for sleep), short fades,
          one fixed gain to -23 LUFS, Opus 128 kbps; and an 8D copy.

Writes native/midia/sons/Nxx.ogg, native/midia/musicas/Rxx.ogg, native/midia/8d/..., the credits
(web/src/creditos.json) and a report with what was used and measured (audio/reais-relatorio.txt).
Usage: python3 tools/midia-real.py audio/reais.json
"""
import json
import os
import re
import sys
import tempfile
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import midia_lib as M  # noqa: E402
from som8d import oito_d  # noqa: E402

RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
MIDIA = os.path.join(RAIZ, 'native', 'midia')
UA = {'User-Agent': 'ForNowApp/1.0 (personal app; github.com/wsqm1990-collab/FOR-NOW)'}
rel = []


def baixar(url, destino):
    for tent in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r, open(destino, 'wb') as f:
                tipo = r.headers.get('Content-Type', '')
                f.write(r.read())
            return tipo
        except Exception as e:  # noqa: BLE001
            ultimo = e
            time.sleep(3 * (tent + 1))
    raise ultimo


def json_de(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def eh_audio(caminho):
    try:
        x = M.ler(caminho)
        return len(x) > M.SR * 10, len(x) / M.SR
    except Exception:  # noqa: BLE001
        return False, 0


def fonte_bigsoundbank(it, pasta):
    n = it['numero']
    for ext, url in [('wav', f'https://bigsoundbank.com/UPLOAD/wav/{n:04d}.wav'),
                     ('flac', f'https://bigsoundbank.com/UPLOAD/flac/{n:04d}.flac'),
                     ('mp3', f'https://bigsoundbank.com/UPLOAD/mp3/{n:04d}.mp3')]:
        dest = os.path.join(pasta, f'{it["id"]}.{ext}')
        try:
            baixar(url, dest)
        except Exception as e:  # noqa: BLE001
            rel.append(f'   tentou {url}: {e}')
            continue
        ok, dur = eh_audio(dest)
        rel.append(f'   tentou {url}: {"ok" if ok else "não é áudio"} ({os.path.getsize(dest) // 1024} KB, {dur:.0f} s)')
        if ok:
            return dest, url
    return None, None


def fonte_archive(it, pasta):
    meta = json_de(f'https://archive.org/metadata/{it["item"]}')
    arqs = meta.get('files', [])
    alvo = it.get('arquivo', '').lower()
    procura = it.get('procura', '').lower()

    def combina(f):
        base = os.path.splitext(f['name'])[0].lower()
        return bool((alvo and base == alvo) or (procura and re.search(r'\b' + re.escape(procura) + r'\b', os.path.basename(base))))
    candidatos = [f for f in arqs if combina(f)]
    ordem = ['flac', '24bit flac', 'wave', 'ogg vorbis', 'vbr mp3', '320kbps mp3', '256kbps mp3', 'mp3']
    candidatos.sort(key=lambda f: ordem.index(f.get('format', '').lower()) if f.get('format', '').lower() in ordem else 99)
    if procura:   # the first one in the album order (e.g. the opening Aria, not the da capo)
        candidatos.sort(key=lambda f: (ordem.index(f.get('format', '').lower()) if f.get('format', '').lower() in ordem else 99, f['name']))
    for f in candidatos[:4]:
        url = f'https://archive.org/download/{it["item"]}/{urllib.parse.quote(f["name"])}'
        dest = os.path.join(pasta, it['id'] + os.path.splitext(f['name'])[1])
        try:
            baixar(url, dest)
        except Exception as e:  # noqa: BLE001
            rel.append(f'   tentou {url}: {e}')
            continue
        ok, dur = eh_audio(dest)
        rel.append(f'   tentou {f["name"]} ({f.get("format")}): {"ok" if ok else "não é áudio"} ({dur:.0f} s)')
        if ok:
            return dest, url
    rel.append(f'   nenhum arquivo combinou; havia {len(arqs)} arquivos')
    return None, None


def fonte_commons(it, pasta):
    api = ('https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url&format=json&titles='
           + urllib.parse.quote(it['arquivo']))
    pags = json_de(api).get('query', {}).get('pages', {})
    for p in pags.values():
        for info in p.get('imageinfo', []):
            url = info['url']
            dest = os.path.join(pasta, it['id'] + os.path.splitext(url)[1])
            baixar(url, dest)
            ok, dur = eh_audio(dest)
            rel.append(f'   tentou {url}: {"ok" if ok else "não é áudio"} ({dur:.0f} s)')
            if ok:
                return dest, url
    return None, None


def preparar(it, origem):
    """The finished signal (before encoding), the gain used and the band balance of the source."""
    x = M.ler(origem)
    antes = M.bandas(x)
    if it['tipo'] == 'natureza':
        x = M.trecho_calmo(x, it.get('segundos', 120) + 4)
        x, g = M.nivelar(x, -25.0, limitar=True)
        y = M.laco(x, 4.0)
    else:
        x = M.cortar_silencio(x)
        x = M.suavizar_picos(x)
        x = M.fades(x, 1.5, 4.0)
        y, g = M.nivelar(x, -23.0)
    return y, g, antes


def salvar(it, y, g, antes):
    if it['tipo'] == 'natureza':
        nome = os.path.join(MIDIA, 'sons', it['id'] + '.ogg')
        M.gravar(y, nome, 112)
        dur = len(y) / M.SR
        voltas = max(1, round(dur / 15.0))
        M.gravar(oito_d(y, dur / voltas, True), os.path.join(MIDIA, '8d', 'sons', it['id'] + '.ogg'), 96)
    else:
        nome = os.path.join(MIDIA, 'musicas', it['id'] + '.ogg')
        M.gravar(y, nome, 128)
        M.gravar(oito_d(y, 15.0, False), os.path.join(MIDIA, '8d', 'musicas', it['id'] + '.ogg'), 96)
    i, tp = M.medir(y)
    rel.append(f'   pronto: {len(y) / M.SR:.0f} s, ganho {g:+.1f} dB, {i:.1f} LUFS, pico {tp:.1f} dBFS, '
               f'bandas antes {antes} depois {M.bandas(y)}, {os.path.getsize(nome) // 1024} KB')


def nota(y, antes):
    """How well a candidate recording turned out (lower is better): how far short of the loudness
    target it stayed, how much the limiter changed its sound (band balance), and a penalty for a
    short loop (heard repeating in a long nap)."""
    i, _ = M.medir(y)
    mud = sum(abs(a - b) for a, b in zip(antes, M.bandas(y))) / len(antes)
    curto = 3.0 if len(y) / M.SR < 100 else 0.0
    return max(0.0, -25.0 - i) + mud + curto, i, mud


def escolher(it, pasta):
    """Several recordings of the same thing: each is made ready, and the one that sounds most like
    itself at the app's level is kept (the others are listed in the report)."""
    melhor = None
    for op in it['opcoes']:
        cand = {**it, **op}
        rel.append(f'   opção #{op["numero"]} {op["titulo"]}')
        origem, url = fonte_bigsoundbank(cand, pasta)
        if not origem:
            continue
        y, g, antes = preparar(cand, origem)
        n, i, mud = nota(y, antes)
        rel.append(f'   opção #{op["numero"]}: {len(y) / M.SR:.0f} s, {i:.1f} LUFS, som mudou {mud:.1f} dB, nota {n:.1f}')
        if melhor is None or n < melhor[0]:
            melhor = (n, cand, url, y, g, antes)
    if not melhor:
        return None, None
    _, cand, url, y, g, antes = melhor
    rel.append(f'   escolhida: #{cand["numero"]} {cand["titulo"]}')
    salvar(cand, y, g, antes)
    return cand, url


def main():
    man = json.load(open(sys.argv[1], encoding='utf-8'))
    creditos, falhas = [], 0
    with tempfile.TemporaryDirectory() as pasta:
        for it in man['itens']:
            rel.append(f'{it["id"]} {it.get("titulo", it["id"])} ({it["fonte"]})')
            try:
                if it.get('opcoes'):
                    esc, url = escolher(it, pasta)
                    if not esc:
                        rel.append('   FALHOU: nenhuma opção funcionou')
                        falhas += 1
                        continue
                    it = esc
                else:
                    origem, url = {'bigsoundbank': fonte_bigsoundbank, 'archive': fonte_archive, 'commons': fonte_commons}[it['fonte']](it, pasta)
                    if not origem:
                        rel.append('   FALHOU: nenhuma fonte de áudio funcionou')
                        falhas += 1
                        continue
                    salvar(it, *preparar(it, origem))
                creditos.append({'id': it['id'], 'titulo': it['titulo'], 'autor': it.get('autor', ''),
                                 'fonte': {'bigsoundbank': 'BigSoundBank.com', 'archive': 'Internet Archive', 'commons': 'Wikimedia Commons'}[it['fonte']],
                                 'licenca': it.get('licenca', 'CC0'), 'url': url})
            except Exception as e:  # noqa: BLE001
                rel.append(f'   FALHOU: {e}')
                falhas += 1
    json.dump(creditos, open(os.path.join(RAIZ, 'web', 'src', 'creditos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    resumo = f'{len(creditos)} gravações prontas, {falhas} falha(s)'
    open(os.path.join(RAIZ, 'audio', 'reais-relatorio.txt'), 'w', encoding='utf-8').write(resumo + '\n' + '\n'.join(rel) + '\n')
    print(resumo)
    print('\n'.join(rel))


if __name__ == '__main__':
    main()
