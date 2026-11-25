# Gera o ícone do For Now: um sol (ou lua) pela metade sobre a linha do horizonte.
# Uso: python3 tools/icones.py   (precisa de Pillow)
import os
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(RAIZ, 'native', 'android-src', 'res')
CREME = (241, 227, 198, 255)
TEAL = (47, 93, 90, 255)
TOPO, BASE = (47, 93, 90), (31, 63, 65)
SS = 4  # supersampling


def simbolo(d, escala, dx, dy, cor):
    """Desenha no espaço de 108 unidades (o mesmo do ícone adaptativo)."""
    cx, cy, r = 54, 59, 19
    caixa = [(cx - r) * escala + dx, (cy - r) * escala + dy, (cx + r) * escala + dx, (cy + r) * escala + dy]
    d.pieslice(caixa, 180, 360, fill=cor)
    d.rectangle([31 * escala + dx, 64 * escala + dy, 77 * escala + dx, 69 * escala + dy], fill=cor)


def fundo_degrade(tam):
    img = Image.new('RGBA', (tam, tam))
    px = img.load()
    for y in range(tam):
        k = y / (tam - 1)
        cor = tuple(round(TOPO[i] * (1 - k) + BASE[i] * k) for i in range(3)) + (255,)
        for x in range(tam):
            px[x, y] = cor
    return img


def legado(tam, redondo):
    T = tam * SS
    img = fundo_degrade(T)
    mascara = Image.new('L', (T, T), 0)
    md = ImageDraw.Draw(mascara)
    if redondo:
        md.ellipse([0, 0, T - 1, T - 1], fill=255)
    else:
        md.rounded_rectangle([0, 0, T - 1, T - 1], radius=int(T * 0.22), fill=255)
    out = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    out.paste(img, (0, 0), mascara)
    d = ImageDraw.Draw(out)
    escala = T / 72.0
    simbolo(d, escala, -18 * escala, -18 * escala, CREME)
    return out.resize((tam, tam), Image.LANCZOS)


def frente(tam):
    T = tam * SS
    out = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    simbolo(ImageDraw.Draw(out), T / 108.0, 0, 0, CREME)
    return out.resize((tam, tam), Image.LANCZOS)


def splash(tam=288):
    T = tam * SS
    out = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    escala = T / 72.0
    simbolo(ImageDraw.Draw(out), escala, -18 * escala, -18 * escala, TEAL)
    return out.resize((tam, tam), Image.LANCZOS)


if __name__ == '__main__':
    for pasta, leg, fg in [('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]:
        d = os.path.join(RES, 'mipmap-' + pasta)
        os.makedirs(d, exist_ok=True)
        legado(leg, False).save(os.path.join(d, 'ic_launcher.png'))
        legado(leg, True).save(os.path.join(d, 'ic_launcher_round.png'))
        frente(fg).save(os.path.join(d, 'ic_launcher_foreground.png'))
    os.makedirs(os.path.join(RES, 'drawable-nodpi'), exist_ok=True)
    splash().save(os.path.join(RES, 'drawable-nodpi', 'splash_logo.png'))
    os.makedirs(os.path.join(RAIZ, 'store'), exist_ok=True)
    legado(512, False).save(os.path.join(RAIZ, 'store', 'icone-512.png'))
    print('ícones gerados')
