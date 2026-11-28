# Small screen, largest text, all three languages: every button must stay on screen and keep
# its words inside. Catches what a big "Display size" or font setting would cut off on a phone.
# Usage: python3 test/narrow.py ROOT OUT
import os, sys, json, asyncio
from playwright.async_api import async_playwright

ROOT = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
html = open(ROOT + '/web/www/index.html', encoding='utf-8').read()
mock = open(ROOT + '/test/mock-capacitor.js').read()
html = html.replace('<body>\n', '<body>\n<script>' + mock + '</script>\n', 1)

FORA = """(() => {
  const W = innerWidth, out = [];
  if (document.documentElement.scrollWidth > W + 1) out.push('page scrolls sideways: ' + document.documentElement.scrollWidth);
  for (const el of document.querySelectorAll('button, .btn, .chip, a')) {
    const r = el.getBoundingClientRect();
    if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
    const nome = (el.dataset.a || el.tagName) + ' "' + el.textContent.trim().slice(0, 30) + '"';
    if (r.left < -1 || r.right > W + 1) out.push(nome + ' off screen ' + Math.round(r.left) + '..' + Math.round(r.right));
    else if (el.scrollWidth > el.clientWidth + 2) out.push(nome + ' text wider than the button');
  }
  return out;
})()"""


async def main():
    falhas = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for lang in ('en', 'pt', 'es'):
            ctx = await b.new_context(viewport={'width': 320, 'height': 568}, device_scale_factor=2)
            page = await ctx.new_page()
            errs = []
            page.on('pageerror', lambda e: errs.append(str(e)))

            async def site(route):
                u = route.request.url
                if u.endswith('/index.html'):
                    await route.fulfill(status=200, content_type='text/html', body=html)
                elif '/fonts/' in u:
                    f = os.path.join(ROOT, 'web', 'www', 'fonts', u.split('/fonts/', 1)[1])
                    await route.fulfill(status=200, content_type='font/ttf', body=open(f, 'rb').read()) if os.path.exists(f) else await route.fulfill(status=404, body='')
                else:
                    await route.fulfill(status=200, content_type='application/javascript', body='')
            await page.route('https://fornow.test/**', site)
            await page.add_init_script("localStorage.setItem('fn:prefs', JSON.stringify({ lang: '%s', texto: 1.3, primeira: false }))" % lang)
            await page.goto('https://fornow.test/index.html')
            await page.wait_for_selector('[data-a="pico"]')

            async def ver(nome, js=None, espera=250):
                if js:
                    await page.evaluate(js)
                    await page.wait_for_timeout(espera)
                ruins = await page.evaluate(FORA)
                print(('FAIL ' if ruins else 'PASS ') + f'{lang} {nome}' + (' — ' + '; '.join(ruins) if ruins else ''))
                if ruins:
                    falhas.append((lang, nome))
                    await page.screenshot(path=f'{OUT}/{lang}-{nome}.png', full_page=True)

            tela = lambda t: f"(() => {{ S.tela = '{t}'; render(); }})()"
            await ver('home')
            await ver('spike', 'Sessao.pico()')
            await ver('spike-paused', "document.querySelector('[data-a=\"sPausar\"]').click()")
            await ver('spike-end-choices', "(() => { Sessao.irParaFim && Sessao.irParaFim(); })()")
            await page.evaluate('Sessao.sair && Sessao.ativa && Sessao.sair()')
            await ver('peace-menu', tela('paz'))
            await ver('peace', "document.querySelector('[data-a=\"paz\"][data-v=\"somLongo\"]').click()")
            await page.evaluate('Sessao.ativa && Sessao.sair()')
            await ver('nap-not-guaranteed', "(() => { window.__mock.exato = false; document.querySelector('[data-a=\"cochilo\"]') ? document.querySelector('[data-a=\"cochilo\"]').click() : Coch.abrir(); })()", 500)
            await ver('nap-ready', "(() => { window.__mock.exato = true; window.__mock.proximo = 0; Coch.checar(); })()", 500)
            await ver('nap-session', "document.querySelector('[data-a=\"cochiloComecar\"]') && document.querySelector('[data-a=\"cochiloComecar\"]').click()", 600)
            await ver('alarm', "(() => { window.__mock.tocando = true; __emit('ForNow', 'alarme', { type: 'tocando', tipo: 'cochilo' }); })()", 300)
            await ver('nap-question', "document.querySelector('[data-a=\"alarmeDesligar\"]') && document.querySelector('[data-a=\"alarmeDesligar\"]').click()", 400)
            await ver('night', "document.querySelector('[data-a=\"madrugada\"]').click()", 400)
            await ver('night-awake', "document.querySelector('[data-a=\"madDesperto\"]') && document.querySelector('[data-a=\"madDesperto\"]').click()", 300)
            await page.evaluate("(() => { Sessao.ativa && Sessao.encerrar && Sessao.encerrar('saiu'); S.tela = 'inicio'; render(); })()")
            await ver('breathe-menu', tela('respirar'))
            await ver('breathe-session', "Resp.comecar('r478')", 400)
            await ver('breathe-paused', "document.querySelector('[data-a=\"sPausar\"]').click()")
            await ver('breathe-end', "(() => { const g = Guia.g; g.pausadoEm = 0; g.ini -= g.total + 2000; Guia.tick(); })()", 300)
            await page.evaluate('Sessao.ativa && Sessao.sair()')
            await ver('music-menu', tela('musica'))
            await ver('music-sleep', "(() => { S.musUso = 'dormir'; render(); })()", 300)
            await ver('music-focus', "(() => { S.musUso = 'focar'; render(); })()", 300)
            await page.evaluate("S.musUso = null")
            await ver('music-session', "Mus.tocar('M07', false)", 400)
            await page.evaluate('Sessao.ativa && Sessao.sair()')
            await ver('music-rain-under', "(() => { Mus.tocar('R08', false); Guia.setExtras([{ v: 'midia/sons/N06.ogg', vol: 0.3 }]); render(); })()", 400)
            await ver('music-under-sheet', 'folhaExtra()', 300)
            await page.evaluate("(() => { fecharFolha(); Guia.setExtras([{ v: 'midia/sons/N02.ogg', vol: 0.45 }, { v: 'midia/binaural/delta.ogg', vol: 0.3 }, { v: 'midia/frequencias/f528.ogg', vol: 0.3 }, { v: 'midia/ruidos/rosa.ogg', vol: 0.45 }]); render(); })()")
            await ver('music-528-under', None)
            await page.evaluate("(() => { fecharFolha(); Sessao.ativa && Sessao.sair(); setPref('musica.fundos', []); })()")
            await ver('sound-sheet', "folhaSons('paz', 'midia/sons/N01.ogg')", 300)
            await page.evaluate('fecharFolha(); Sessao.ativa && Sessao.sair()')
            await ver('sleep-session', "Mus.dormir()", 400)
            await page.evaluate("(() => { Sessao.ativa && Sessao.sair(); })()")
            await ver('music-8d-on', "(() => { setPref('oitoD', true); S.tela = 'musica'; render(); })()", 300)
            await ver('music-session-8d', "Mus.tocar('M04', false)", 400)
            await ver('sound-sheet-8d', "folhaSons('cochilo', 'midia/sons/N03.ogg')", 300)
            await page.evaluate("(() => { fecharFolha(); Sessao.ativa && Sessao.sair(); setPref('oitoD', false); })()")
            await ver('mixer-empty', "(() => { Mix.novo(); S.tela = 'mix'; render(); })()", 300)
            await ver('mixer-full', "(() => { ['midia/sons/N03.ogg', 'midia/sons/N05.ogg', 'midia/ruidos/rosa.ogg', 'midia/binaural/delta.ogg'].forEach(v => Mix.alternar(v)); render(); })()", 400)
            await ver('mixer-song', "(() => { Mix.alternar('midia/musicas/R03.ogg'); render(); })()", 400)
            await page.evaluate("(() => { Mix.salvar('Um nome de mix bem comprido para testar'); S.tela = 'musica'; render(); })()")
            await ver('music-with-mix', None)
            await ver('sheet-with-mix', "folhaSons('cochilo', 'silencio')", 300)
            await page.evaluate("(() => { fecharFolha(); LS.set('mixes', []); S.tela = 'inicio'; render(); })()")
            await ver('nap-2h', "(() => { window.__mock.exato = true; window.__mock.proximo = 0; Coch.min = 135; S.tela = 'cochilo'; render(); Coch.checar(); })()", 500)
            await page.evaluate("(() => { Sessao.ativa && Sessao.sair(); S.tela = 'inicio'; render(); })()")
            for t in ('apoio', 'contato', 'historico', 'revisao', 'ajustes', 'tecnicas', 'preparar', 'diagnostico', 'privacidade', 'acesso', 'creditos'):
                await ver(t, tela(t), 300)
            if errs:
                print(f'FAIL {lang} page errors — {errs[:3]}')
                falhas.append((lang, 'errors'))
            await ctx.close()
        await b.close()
    print(f'\nnarrow screen: {len(falhas)} problem(s)')
    sys.exit(1 if falhas else 0)

asyncio.run(main())
