# Drives the built page in Chrome with a fake Android side and checks the main paths.
# Usage: python3 test/run-local.py ROOT OUT
import os, sys, json, asyncio
from playwright.async_api import async_playwright

ROOT = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
page_html = open(ROOT + '/web/www/index.html', encoding='utf-8').read()
mock = open(ROOT + '/test/mock-capacitor.js').read()
html = page_html.replace('<body>\n', '<body>\n<script>' + mock + '</script>\n', 1)
resultados = []


def check(nome, ok, info=None):
    resultados.append((nome, bool(ok)))
    print(('PASS ' if ok else 'FAIL ') + nome + ('' if info is None else ' — ' + json.dumps(info, ensure_ascii=False)[:300]))


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='en-US')
        page = await ctx.new_page()
        errs = []
        page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        page.on('console', lambda m: errs.append('CONSOLE ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        page.on('response', lambda r: errs.append('HTTP 404 ' + r.url) if r.status == 404 and not r.url.endswith('favicon.ico') else None)
        await page.route('**/capacitor.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))

        async def site(route):
            url = route.request.url
            if url.endswith('/index.html'):
                await route.fulfill(status=200, content_type='text/html', body=html)
            elif url.endswith('/capacitor.js'):
                await route.fulfill(status=200, content_type='application/javascript', body='')
            elif '/fonts/' in url:
                f = os.path.join(ROOT, 'web', 'www', 'fonts', url.split('/fonts/', 1)[1])
                await route.fulfill(status=200, content_type='font/ttf', body=open(f, 'rb').read()) if os.path.exists(f) else await route.fulfill(status=404, body='')
            elif '/sons/' in url:
                f = os.path.join(ROOT, 'web', 'www', 'sons', url.split('/sons/', 1)[1])
                await route.fulfill(status=200, content_type='audio/ogg', body=open(f, 'rb').read()) if os.path.exists(f) else await route.fulfill(status=404, body='')
            else:
                await route.fulfill(status=404, body='')
        await page.route('https://fornow.test/**', site)
        await page.goto('https://fornow.test/index.html')
        A = lambda a, extra='': f'[data-a="{a}"]{extra}'

        async def tap(sel, espera=150):
            await page.locator(sel).first.click(timeout=5000)
            await page.wait_for_timeout(espera)

        calls = lambda: page.evaluate('window.__calls')

        def achar(cs, m, pred=lambda o: True):
            return [c for c in cs if c[0] == 'ForNow' and c[1] == m and pred(c[2])]

        async def fim_do_guia():
            await page.evaluate('(() => { const g = Guia.g; if (g) { g.ini -= g.total + 2000; Guia.tick(); } })()')
            await page.wait_for_timeout(200)

        await page.wait_for_selector(A('pico'))
        check('home in English by default', (await page.locator(A('pico')).inner_text()).strip() == "It's hard right now", await page.locator(A('pico')).inner_text())
        await page.screenshot(path=OUT + '/01-home.png')
        check('no sideways scroll', await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))

        # ---- pico: first sentence right away, Switch without a menu
        await tap(A('pico'), 400)
        txt = await page.locator('#instr').inner_text()
        check('pico shows the first sentence at once', txt.strip() == 'Feel where your feet meet the floor.', txt)
        cs = await calls()
        g = achar(cs, 'guiaStart')
        check('pico hands the timeline to Android (English voice)', g and g[-1][2]['lang'] == 'en-US' and g[-1][2]['passos'][0]['t'].startswith('Feel'), g[-1][2]['lang'] if g else None)
        check('no permission or question before help', not achar(cs, 'askNotif') and not achar(cs, 'alarmeStatus', lambda o: False))
        await page.screenshot(path=OUT + '/02-pico.png')
        await tap(A('sTrocar'), 300)
        check('Switch from the surroundings goes to breathing', await page.evaluate('Sessao.tec') == 'respiracao', await page.evaluate('Sessao.tec'))
        await tap(A('sTrocar'), 300)
        txt = await page.locator('#instr').inner_text()
        check('Switch from breathing goes straight back to the surroundings', await page.evaluate('Sessao.tec') == 'ambiente' and txt.startswith("That's okay"), txt)
        cs = await calls()
        check('Android was told to stop the old timeline on each switch', len(achar(cs, 'guiaStop')) >= 2)
        await tap(A('sPausar'))
        cs = await calls()
        check('pause reaches Android', bool(achar(cs, 'guiaUpdate', lambda o: o.get('pausadoEm', 0) > 0)))
        check('screen shows Paused', 'Paused' in await page.locator('#estado').inner_text())
        await tap(A('sContinuar'))
        await fim_do_guia()
        check('after more than one technique, the end choices appear', await page.evaluate('Sessao.fase') == 'fim')
        await page.screenshot(path=OUT + '/03-pico-fim.png')
        await tap(A('continuarDia'))
        await page.screenshot(path=OUT + '/04-pico-resposta.png')
        await tap(A('responder', '[data-v="sim"]'))
        h = await page.evaluate("Hist.todos()")
        check('history records the session with the answer and the switches', len(h) == 1 and h[0]['resp'] == 'sim' and sum(1 for x in h[0]['passos'] if x.get('trocou')) == 2, [(x['tec'], x.get('trocou')) for x in h[0]['passos']])

        # ---- pico again: opener ends → choice screen, then sound technique
        await tap(A('pico'), 300)
        await fim_do_guia()
        check('after the opener, the choice screen appears', await page.evaluate('Sessao.fase') == 'escolha')
        await page.screenshot(path=OUT + '/05-pico-escolha.png')
        await tap(A('escolher', '[data-v="som"]'), 300)
        cs = await calls()
        check('the sound technique plays the recorded rain', achar(cs, 'guiaStart')[-1][2]['som'] == 'midia/sons/N01.ogg', achar(cs, 'guiaStart')[-1][2]['som'])
        await tap(A('sSom'), 300)
        check('the sound chip opens the list by category', await page.locator('#folha ' + A('escolherSom')).count() >= 10)
        await page.screenshot(path=OUT + '/05b-lista-sons.png')
        await tap('#folha ' + A('escolherSom', '[data-v="midia/sons/N02.ogg"]'), 300)
        cs = await calls()
        check('choosing the sea changes the sound live', bool(achar(cs, 'guiaUpdate', lambda o: o.get('som') == 'midia/sons/N02.ogg')) and await page.evaluate("$('#folha').hidden"))
        await tap(A('sSair'), 200)
        h = await page.evaluate("Hist.todos()")
        check('leaving records "left before the end" and no answer', h[-1]['saida'] == 'saiu' and h[-1]['resp'] is None)

        # ---- peace
        await tap(A('pazAbrir'))
        await page.screenshot(path=OUT + '/06-paz.png')
        await tap(A('paz', '[data-v="musculos"]'), 300)
        g = achar(await calls(), 'guiaStart')[-1][2]
        total = sum(x['s'] for x in g['passos'])
        check('5-minute peace lasts 5 minutes, voice leaves early', abs(total - 300) < 1 and g['passos'][-1]['s'] > 100, total)
        await page.screenshot(path=OUT + '/07-paz-sessao.png')
        await fim_do_guia()
        check('peace ends with one optional question', await page.evaluate('Sessao.fase') == 'resposta')
        await tap(A('responder', '[data-v="pular"]'))
        h = await page.evaluate("Hist.todos()")
        check('skipping is recorded as skipped, not as "no"', h[-1].get('pulou') is True and h[-1]['resp'] is None)

        # ---- nap: not guaranteed → never claims the alarm
        await page.evaluate('window.__mock.exato = false')
        await tap(A('cochilo'), 400)
        check('nap without exact-alarm permission says it is not guaranteed', await page.locator(A('cochiloAutorizar')).count() == 1 and await page.locator(A('cochiloComecar')).count() == 0)
        await page.screenshot(path=OUT + '/08-cochilo-nao-garantido.png', full_page=True)
        # plan B: the phone's Clock
        await tap(A('cochiloRelogio'), 300)
        cs = await calls()
        rel = achar(cs, 'abrirRelogio')
        check('Clock opens with the time filled in', bool(rel) and 'hora' in rel[-1][2] and 'minuto' in rel[-1][2], rel[-1][2] if rel else None)
        await page.evaluate("(() => { const r = LS.get('relogio'); window.__mock.proximo = Math.floor(r.alvo / 60000) * 60000; })()")
        await tap(A('cochiloRelogioConferir'), 400)
        check('Clock alarm confirmed through Android', await page.evaluate("S.tela") == 'cochiloSessao' and await page.evaluate("Sessao.r.extra.alarme") == 'relogio')
        await page.screenshot(path=OUT + '/09-cochilo-relogio.png')
        await tap(A('cochiloCancelar'))
        await tap('#folha ' + A('cochiloCancelarSim'), 300)
        # own alarm
        await page.evaluate('window.__mock.exato = true; window.__mock.proximo = 0')
        await tap(A('cochilo'), 400)
        check('with permission, Start appears', await page.locator(A('cochiloComecar')).count() == 1)
        await page.screenshot(path=OUT + '/10-cochilo-pronto.png', full_page=True)
        await tap(A('cochiloComecar'), 500)
        cs = await calls()
        ag = achar(cs, 'alarmeAgendar', lambda o: o.get('tipo') == 'cochilo')
        primeira = achar(cs, 'guiaStart')[-1][2]['passos'][0]['t']
        check('the voice only says the time after Android confirmed it', bool(ag) and primeira.startswith('Your alarm is set for'), primeira)
        await page.screenshot(path=OUT + '/11-cochilo-sessao.png')
        await page.evaluate('window.__mock.tocando = true; __emit("ForNow", "alarme", { type: "tocando", tipo: "cochilo" })')
        await page.wait_for_timeout(200)
        check('ringing shows the Turn off screen', await page.evaluate('S.tela') == 'alarme')
        await page.screenshot(path=OUT + '/12-alarme.png')
        await tap(A('alarmeDesligar'), 300)
        check('after the nap, the question waits on the home screen', await page.locator(A('pendResp')).count() >= 3)
        await page.screenshot(path=OUT + '/13-pergunta-cochilo.png')
        await tap(A('pendResp', '[data-v="disposto"]'))
        h = [x for x in await page.evaluate("Hist.todos()") if x['modo'] == 'cochilo']
        check('nap answer saved', h[-1]['resp'] == 'disposto')

        # ---- night
        await tap(A('madrugada'), 300)
        check('night screen is dark and dim', await page.evaluate("document.documentElement.dataset.noite") == '1' and bool(achar(await calls(), 'brilho', lambda o: o.get('nivel') == 0.05)))
        await page.screenshot(path=OUT + '/14-madrugada.png')
        await tap(A('madSoltar'), 300)
        await page.screenshot(path=OUT + '/15-madrugada-soltar.png')
        await fim_do_guia()
        check('night session ends with no question', await page.evaluate('Sessao.fase') == 'quieto' and await page.locator(A('responder')).count() == 0)
        await tap(A('madEncerrar'), 300)

        # ---- support
        await tap(A('apoio'))
        await page.screenshot(path=OUT + '/16-apoio.png', full_page=True)
        await tap(A('ligar', '[data-v="188"]'))
        check('CVV only opens the dialer with 188', bool(achar(await calls(), 'discar', lambda o: o.get('numero') == '188')))
        await tap(A('voltar'))

        # ---- languages
        await tap(A('ajustes'), 300)
        await page.screenshot(path=OUT + '/17-ajustes.png', full_page=True)
        await tap(A('ajLang', '[data-v="pt"]'), 300)
        await tap(A('voltar'), 200)
        check('Portuguese home', (await page.locator(A('pico')).inner_text()).strip() == 'Está difícil agora')
        await page.screenshot(path=OUT + '/18-inicio-pt.png')
        await tap(A('pico'), 300)
        g = achar(await calls(), 'guiaStart')[-1][2]
        check('Portuguese voice and text', g['lang'] == 'pt-BR' and g['passos'][0]['t'] == 'Sinta onde os pés encontram o chão.')
        await tap(A('sSair'))
        await tap(A('ajustes'), 300)
        await tap(A('ajLang', '[data-v="es"]'), 300)
        await tap(A('voltar'), 200)
        check('Spanish home', (await page.locator(A('pico')).inner_text()).strip() == 'Está difícil ahora')
        await page.screenshot(path=OUT + '/19-inicio-es.png')
        labels = achar(await calls(), 'setLabels')
        check('widget and shortcut labels follow the language', bool(labels) and labels[-1][2]['widget'] == 'Está difícil ahora')
        await tap(A('ajustes'), 300)
        await tap(A('ajLang', '[data-v="en"]'), 300)
        await tap(A('voltar'), 200)

        # ---- techniques: hide breathing → Switch never offers it
        await tap(A('ajustes'), 300)
        await tap(A('tecnicas'), 200)
        await page.screenshot(path=OUT + '/20-tecnicas.png', full_page=True)
        await tap(A('tecOcultar', '[data-v="respiracao"]'), 200)
        await tap(A('voltar'))
        await tap(A('voltar'))
        await tap(A('pico'), 300)
        await tap(A('sTrocar'), 300)
        check('hidden breathing is skipped by Switch', await page.evaluate('Sessao.tec') == 'som', await page.evaluate('Sessao.tec'))
        await tap(A('sSair'))

        # ---- learning card: three good answers for the sound technique, in the afternoon
        await page.evaluate("""(() => {
          const h = Hist.todos(); const base = Date.now() - 6 * 3600000;
          for (let i = 0; i < 3; i++) h.push({ id: 'x' + i, modo: 'pico', ini: base - i * 86400000, fim: base - i * 86400000 + 60000,
            passos: [{ tec: 'ambiente', ini: 0, fim: 1 }, { tec: 'som', ini: 1, fim: 2 }], saida: 'continuar', resp: 'sim', extra: {} });
          h.forEach(r => { if (r.modo === 'pico') { r.ini = Math.min(r.ini, Date.now() - 5 * 3600000); r.fim = r.ini + 60000; } });
          LS.set('hist', h); Date.prototype.getHours = function () { return 14; }; render(); })()""")
        await page.wait_for_timeout(200)
        card = await page.locator('.cartao').all_inner_texts()
        check('a suggestion shows the real count and the mixed results', any('helped' in c and 'of' in c for c in card), card)
        await page.screenshot(path=OUT + '/21-sugestao.png')

        await tap(A('historico'))
        await page.screenshot(path=OUT + '/22-historico.png', full_page=True)
        await tap(A('voltar'))
        await tap(A('revisao'))
        await page.screenshot(path=OUT + '/23-revisao.png', full_page=True)
        await tap(A('voltar'))

        # ---- launch from the widget / tile: straight into the session
        await page.evaluate("executarAcao('pico')")
        await page.wait_for_timeout(200)
        check('opening from the widget starts the session', await page.evaluate("S.tela") == 'sessao' and await page.evaluate("Sessao.modo") == 'pico')
        await tap(A('sSair'))

        # ---- Android's events can be lost; the page notices and asks for the state itself
        await page.evaluate("__resetListeners()")
        todos = await page.evaluate("Nat.garantirOuvintes()")
        n = await page.evaluate("__nListeners()")
        check('listeners dropped by Android are added back, once each', todos is False and n.get('ForNow:guia') == 1 and n.get('ForNow:alarme') == 1 and n.get('ForNow:launch') == 1 and n.get('App:backButton') == 1, n)
        check('nothing is added twice when the listeners are there', await page.evaluate("Nat.garantirOuvintes()") is True and (await page.evaluate("__nListeners()")) == n)
        await page.evaluate("(() => { window.__mock.acao = 'pico'; __emit('ForNow', 'launch', { pendente: true }); })()")
        await page.wait_for_timeout(300)
        check('the widget poke starts the session (the page takes the action itself)', await page.evaluate("S.tela") == 'sessao' and await page.evaluate("Sessao.modo") == 'pico')
        await tap(A('sSair'))
        await page.evaluate("(() => { window.__mock.acao = 'madrugada'; document.dispatchEvent(new Event('visibilitychange')); })()")
        await page.wait_for_timeout(400)
        check('an action whose event was lost is taken when the app comes back', await page.evaluate("S.tela") == 'madrugada', await page.evaluate("S.tela"))
        await tap(A('madVoltar'))
        await page.evaluate("Sessao.pico()")
        await page.wait_for_timeout(200)
        await page.evaluate("(() => { const g = __guia(); g.running = false; g.ended = true; g.complete = false; document.dispatchEvent(new Event('visibilitychange')); })()")
        await page.wait_for_timeout(400)
        check('a session ended from the notification while the page missed it ends on the page too', not await page.evaluate("Sessao.ativa") and await page.evaluate("Guia.g") is None, await page.evaluate("S.tela"))
        await page.evaluate("(() => { S.tela = 'inicio'; render(); })()")
        await page.evaluate("(() => { window.__mock.tocando = false; S.alarmeTocando = true; S.tela = 'alarme'; render(); document.dispatchEvent(new Event('visibilitychange')); })()")
        await page.wait_for_timeout(400)
        check('an alarm turned off while the page missed it leaves the alarm screen', await page.evaluate("S.tela") != 'alarme' and await page.evaluate("S.alarmeTocando") is False, await page.evaluate("S.tela"))
        await page.evaluate("(() => { S.tela = 'inicio'; render(); })()")

        # ---- breathing: list, custom times, a session with exact times, the circle and the end
        await page.evaluate("(() => { S.tela = 'inicio'; render(); })()")
        await tap(A('respirar'), 300)
        check('breathing lists six exercises', await page.locator(A('respComecar')).count() == 6)
        await page.screenshot(path=OUT + '/24-respirar.png', full_page=True)
        await tap(A('respLivre', '[data-v="out"][data-d="1"]'), 200)
        check('custom times can be changed', await page.evaluate("prefs().respirar.livre.out") == 7)
        await tap(A('respMin', '[data-v="1"]'), 200)
        await tap(A('respComecar', '[data-v="quadrada"]'), 400)
        g = achar(await calls(), 'guiaStart')[-1][2]
        ps = g['passos']
        ciclo = [x for x in ps if x.get('v') == 35]
        check('box breathing: 4-second phases that vibrate, exact', len(ciclo) >= 8 and all(abs(x['s'] - 4) < 0.001 for x in ciclo), [(x['s'], x.get('v')) for x in ps[:8]])
        check('breathing plays its own background quietly', g['som'] == 'midia/musicas/M06.ogg' and g.get('volSom') == 0.4, (g['som'], g.get('volSom')))
        check('the voice guides only the first rounds', sum(1 for x in ciclo if x['t']) == 8, [x['t'] for x in ciclo[:10]])
        check('the circle is on screen', await page.locator('#circulo').count() == 1)
        await page.evaluate("(() => { const g = Guia.g; const e = g.dur.slice(0, 2).reduce((a, b) => a + b, 0) + 1000; g.ini = Date.now() - e; atualizarCirculo(true); })()")
        check('the circle shows the phase and the seconds left', (await page.locator('#resp-rotulo').inner_text()).strip() == 'Breathe in' and (await page.locator('#resp-seg').inner_text()).strip() == '3',
              [await page.locator('#resp-rotulo').inner_text(), await page.locator('#resp-seg').inner_text()])
        check('the circle grows while breathing in', 'scale(1)' in await page.evaluate("$('#circulo').style.transform"), await page.evaluate("$('#circulo').style.transform"))
        await page.screenshot(path=OUT + '/25-respirar-sessao.png')
        await fim_do_guia()
        check('breathing ends with Again / Finish', await page.locator(A('respDeNovo')).count() == 1)
        await tap(A('respDeNovo'), 400)
        check('Again starts the same exercise', await page.evaluate("Sessao.r.extra.ex") == 'quadrada' and await page.evaluate("Sessao.fase") == 'guia')
        await tap(A('sSair'), 300)
        h = [x for x in await page.evaluate("Hist.todos()") if x['modo'] == 'respirar']
        check('breathing sessions go to the history', len(h) >= 2)

        # ---- music: a playlist starting from the chosen song, next track, timer
        await page.evaluate("(() => { S.tela = 'inicio'; render(); })()")
        await tap(A('musica'), 300)
        check('music lists the songs and the nature sounds', await page.locator(A('musTocar')).count() == 17, await page.locator(A('musTocar')).count())
        await page.screenshot(path=OUT + '/26-musicas.png', full_page=True)
        await tap(A('musTocar', '[data-v="M03"]'), 400)
        g = achar(await calls(), 'guiaStart')[-1][2]
        check('the chosen song plays first, then the others', g['sons'][0] == 'midia/musicas/M03.ogg' and len(g['sons']) == 11 and abs(sum(x['s'] for x in g['passos']) - 1800) < 1, (g['sons'][:2], sum(x['s'] for x in g['passos'])))
        check('the music screen shows the song and the time left', (await page.locator('#mus-nome').inner_text()).strip() == 'Strings, adagio' and await page.locator('#mus-resta').count() == 1)
        await page.screenshot(path=OUT + '/27-musica-tocando.png')
        await tap(A('musProxima'), 300)
        check('Next track asks Android for the next song', bool(achar(await calls(), 'guiaUpdate', lambda o: o.get('proxima'))))
        await tap(A('sSair'), 300)
        # ---- sleep now: voice that relaxes the body, dark screen, then quiet
        await tap(A('musDormir'), 400)
        g = achar(await calls(), 'guiaStart')[-1][2]
        check('sleep now: dark screen, dim light, the sleep voice', await page.evaluate("document.documentElement.dataset.noite") == '1' and bool(achar(await calls(), 'brilho', lambda o: o.get('nivel') == 0.05)) and len([x for x in g['passos'] if x['t']]) == 20)
        await page.screenshot(path=OUT + '/28-dormir.png')
        await fim_do_guia()
        check('after the music ends, sleep stays quiet', await page.evaluate("Sessao.fase") == 'quieto' and await page.locator(A('responder')).count() == 0)
        await tap(A('sSair'), 300)

        # ---- every sentence the app can say in Portuguese has a recording, in both voices
        faltam = await page.evaluate("""(() => {
          const antes = LANG, tipo = prefs().vozTipo; setIdioma('pt');
          const frases = new Set();
          for (const id of Object.keys(TEC)) for (const v of [false, true]) passosDe(id, v).forEach(([t]) => t && frases.add(t));
          for (const tipoC of ['proprio', 'relogio', 'nenhum']) roteiroCochilo(tipoC, 0).forEach(([t]) => t && frases.add(t));
          for (const ex of Object.keys(RESP)) { frases.add(tr(RESP[ex].intro)); }
          frases.add(tr(RESP_AVISO)); RESP_FIM.forEach(f => frases.add(tr(f)));
          for (const f of Object.keys(RESP_FALA)) RESP_FALA[f].forEach(x => frases.add(tr(x)));
          DORMIR.forEach(f => frases.add(tr(f)));
          frases.add('Esta é a voz que vai te acompanhar aqui.');
          const falta = [];
          for (const v of ['feminina', 'masculina']) { setPref('vozTipo', v); for (const f of frases) if (!clipe(f)) falta.push(v + ': ' + f); }
          setPref('vozTipo', tipo); setIdioma(antes);
          return { n: frases.size, falta };
        })()""")
        check('every Portuguese sentence has a recording in both voices', not faltam['falta'], faltam['falta'][:8] or faltam['n'])

        # ---- recorded voices (Portuguese): female, male, or the phone's own voice
        await page.evaluate("(() => { setPref('lang', 'pt'); setIdioma('pt'); S.tela = 'inicio'; render(); })()")
        await page.wait_for_timeout(200)
        await page.evaluate("Sessao.pico()")
        g = achar(await calls(), 'guiaStart')[-1][2]
        check('Portuguese uses the recorded female voice', g['passos'][0].get('a', '').startswith('midia/voz/feminina/'), g['passos'][0])
        await page.evaluate("Sessao.sair()")
        await page.evaluate("(() => { S.tela = 'ajustes'; render(); })()")
        await tap(A('ajVozTipo', '[data-v="masculina"]'), 300)
        check('choosing the male voice plays a sample of it', bool(achar(await calls(), 'previa', lambda o: o.get('nome', '').startswith('midia/voz/masculina/'))))
        await page.evaluate("Sessao.pico()")
        g = achar(await calls(), 'guiaStart')[-1][2]
        check('and the sessions use it', g['passos'][0].get('a', '').startswith('midia/voz/masculina/'), g['passos'][0])
        await page.evaluate("Sessao.sair()")
        await page.evaluate("(() => { setPref('vozTipo', 'android'); })()")
        await page.evaluate("Sessao.pico()")
        g = achar(await calls(), 'guiaStart')[-1][2]
        check("the phone's voice can still be chosen", not g['passos'][0].get('a'), g['passos'][0])
        await page.evaluate("Sessao.sair()")
        await page.evaluate("(() => { setPref('vozTipo', 'feminina'); setPref('lang', 'en'); setIdioma('en'); S.tela = 'inicio'; render(); })()")
        await page.evaluate("Sessao.pico()")
        g = achar(await calls(), 'guiaStart')[-1][2]
        check('English keeps the phone voice (no recordings yet)', not g['passos'][0].get('a'), g['passos'][0])
        await page.evaluate("Sessao.sair()")
        # ---- an app without the recordings falls back to the sounds made in code
        await page.evaluate("window.__fnMidia = false")
        await page.evaluate("Sessao.pico()")
        await page.evaluate("Sessao.escolher && (Sessao.fase = 'escolha')")
        await page.evaluate("Sessao.escolher('som')")
        g = achar(await calls(), 'guiaStart')[-1][2]
        check('without recordings, the chosen sea falls back to the sea made in code', g['som'] == 'ondas', g['som'])
        await page.evaluate("Sessao.sair()")
        await page.evaluate("window.__fnMidia = true")

        # ---- update never applies during a session
        await page.evaluate("Sessao.pico()")
        await page.evaluate("LS.set('staged', { build: 999, path: '/data/bundles/999' })")
        await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
        check('update not applied with a session running', await page.evaluate("window.__switched") is None)
        await page.evaluate("Sessao.sair()")

        # ---- an update made for other native files asks for the new APK and is never loaded
        await page.evaluate("(() => { window.FN_BUILD = 5; LS.del('staged'); S.precisaApk = false; window.__mock.novoShell = 'zzz999'; })()")
        antes = len(achar(await calls(), 'fetchBundle'))
        r = await page.evaluate("checarAtualizacao(true)")
        check('an update for other native files asks for the APK instead', r == 'apk' and len(achar(await calls(), 'fetchBundle')) == antes and await page.evaluate("LS.get('staged')") is None, r)
        await page.evaluate("(() => { S.tela = 'inicio'; render(); })()")
        check('home shows the install-the-new-version card', await page.locator(A('baixarApk')).count() == 1)
        await page.evaluate("(() => { window.__mock.novoShell = null; S.precisaApk = false; })()")
        r = await page.evaluate("checarAtualizacao(true)")
        check('same native files: the page update is downloaded', r in ('staged', 'applied') and len(achar(await calls(), 'fetchBundle')) == antes + 1, r)
        await page.evaluate("(() => { window.FN_BUILD = 0; LS.del('staged'); LS.del('trying'); LS.del('trying_path'); })()")

        check('no page errors', not errs, errs[:5])
        await b.close()
    falhas = [n for n, ok in resultados if not ok]
    print(f'\n{len(resultados) - len(falhas)}/{len(resultados)} checks passed')
    sys.exit(1 if falhas else 0)

asyncio.run(main())
