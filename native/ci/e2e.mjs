// Walks through the installed app on the emulator through Chrome DevTools (the debug build
// allows it) and checks the native parts: the session service with the screen off, Switch, the
// voice, the nap alarm ringing on time, the deep link from the widget/tile, the night screen and
// the automatic update. Writes results.json, summary.txt and screenshots.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const OUT = process.argv[2] || 'test-out';
const PKG = process.argv[3] || 'com.wsqm1990.fornow';
const UP = Number(process.argv[4] || 0);
const SHELL_ID = process.argv[5] || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const adb = (...a) => (spawnSync('adb', a, { encoding: 'utf8', maxBuffer: 64 << 20 }).stdout || '');
const results = [];
function check(name, ok, info, fatal = true) {
  results.push({ name, ok: !!ok, fatal, info: info === undefined ? null : info });
  console.log(`${ok ? 'PASS' : fatal ? 'FAIL' : 'WARN'} ${name}${info === undefined ? '' : ' — ' + JSON.stringify(info).slice(0, 400)}`);
}
function screen(name) {
  const r = spawnSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 });
  if (r.stdout && r.stdout.length > 1000) fs.writeFileSync(`${OUT}/${name}.png`, r.stdout);
}
const logcat = () => adb('logcat', '-d', '-s', 'ForNow:*');

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.events = []; }
  open() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => res();
      this.ws.onerror = e => rej(new Error('websocket error ' + (e && e.message)));
      this.ws.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
        else this.events.push(m);
      };
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('timeout ' + method)); } }, 30000); });
  }
  close() { try { this.ws.close(); } catch { /* closed */ } }
}

let cdp = null;
const todosEventos = [];
async function connect() {
  if (cdp) { todosEventos.push(...cdp.events); cdp.close(); }
  for (let i = 0; i < 40; i++) {
    const pid = adb('shell', 'pidof', PKG).trim().split(/\s+/)[0];
    if (pid) {
      adb('forward', '--remove-all');
      adb('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`);
      try {
        const list = await (await fetch('http://127.0.0.1:9222/json')).json();
        const page = list.find(t => t.type === 'page' && /localhost/.test(t.url));
        if (page) {
          cdp = new CDP(page.webSocketDebuggerUrl);
          await cdp.open();
          await cdp.send('Runtime.enable');
          return page;
        }
      } catch { /* not ready */ }
    }
    await sleep(1000);
  }
  throw new Error('could not reach the app WebView');
}
async function ev(expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  return r.result.value;
}
const q = s => JSON.stringify(s);
const click = async (sel, wait = 300) => { await ev(`(() => { const el = document.querySelector(${q(sel)}); if (!el) throw new Error('missing ' + ${q(sel)}); el.click(); return true; })()`); await sleep(wait); };
async function waitFor(expr, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await ev(expr)) return true; } catch { /* page busy */ } await sleep(300); }
  return false;
}
const A = (a, extra = '') => `[data-a="${a}"]${extra}`;
const pronto = () => waitFor(`typeof window.FN_BUILD === 'number' && typeof Sessao === 'object' && !!document.querySelector('#app section')`, 40000);
const estadoGuia = () => ev(`Nat.call('guiaState')`);
// every button stays on screen with its words inside (the emulator screen is small, like a phone
// with a big display-size setting)
const FORA = `(() => { const W = innerWidth, out = [];
  if (document.documentElement.scrollWidth > W + 1) out.push('page scrolls sideways');
  for (const el of document.querySelectorAll('button, .btn, .chip, a')) {
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    const n = (el.dataset.a || el.tagName) + ' ' + el.textContent.trim().slice(0, 24);
    if (r.left < -1 || r.right > W + 1) out.push(n + ' off screen'); else if (el.scrollWidth > el.clientWidth + 2) out.push(n + ' cut');
  } return out; })()`;
async function cabe(nome) { const r = await ev(FORA); check(`${nome}: every button fits on screen`, r.length === 0, r); }

async function main() {
  await connect();
  check('app opens to the home screen', await pronto() && await waitFor(`!!document.querySelector('[data-a="pico"]')`, 20000));
  check('native bridge is on', await ev('Nat.on'), await ev('({ build: window.FN_BUILD, lang: LANG, ua: navigator.userAgent })'));
  const info = await ev(`Nat.call('info')`);
  check('the APK carries the same native fingerprint as version.json (so page updates reach it)', info && info.shellId && info.shellId === SHELL_ID, { app: info && info.shellId, release: SHELL_ID });
  check('English is the main language', (await ev(`document.querySelector('[data-a="pico"]').textContent.trim()`)) === "It's hard right now");
  check('screen size', true, await ev('({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })'));
  await cabe('home');
  screen('01-home');

  // ---- spike: one tap, the first sentence right away, the service keeps the timeline
  const t0 = Date.now();
  await click(A('pico'), 200);
  const primeira = await waitFor(`Sessao.fase === 'guia' && (document.querySelector('#instr') || {}).textContent === 'Feel where your feet meet the floor.'`, 3000);
  check('spike shows the first sentence within 3 s of the tap', primeira, Date.now() - t0);
  const st1 = await (async () => { for (let i = 0; i < 20; i++) { const s = await estadoGuia(); if (s && s.running) return s; await sleep(250); } return await estadoGuia(); })();
  check('the session runs in the Android service', st1 && st1.running, st1);
  await cabe('spike');
  screen('02-spike');
  adb('shell', 'cmd', 'statusbar', 'expand-notifications'); await sleep(1500); screen('03-spike-notification'); adb('shell', 'cmd', 'statusbar', 'collapse'); await sleep(500);
  const notifs = adb('shell', 'dumpsys', 'notification', '--noredact');
  check('the session notification is neutral (no session details)', notifs.includes(PKG) && !/Feel where your feet/.test(notifs), null, false);

  // screen off: the voice keeps going from the service
  adb('logcat', '-c');
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); await sleep(1500);
  adb('shell', 'input', 'keyevent', 'KEYCODE_POWER');
  await sleep(30000);
  const lc1 = logcat();
  fs.writeFileSync(`${OUT}/logcat-background.txt`, lc1);
  const falas = (lc1.match(/fala result=\d/g) || []).length;
  check('with the screen off, the session kept speaking', falas >= 2, { falas }, false);
  check('text-to-speech accepted the sentences', /fala result=0/.test(lc1), (lc1.match(/tts init status=-?\d+|fala result=-?\d+/g) || []).slice(0, 6), false);
  adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'); await sleep(800);
  adb('shell', 'wm', 'dismiss-keyguard'); await sleep(800);
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`); await sleep(2500);
  await connect(); await pronto();
  check('back in the app, the same session is still on', await waitFor(`Sessao.ativa && Sessao.modo === 'pico'`, 8000));

  // Switch: no menu; from breathing straight back to the surroundings
  await ev(`(() => { if (Sessao.fase !== 'guia') Sessao.tocar('ambiente'); return true; })()`); await sleep(500);
  const antes = await ev('Sessao.tec');
  await click(A('sTrocar'), 800);
  const depois = await ev('Sessao.tec');
  check('Switch changes the technique at once', antes !== depois, { antes, depois });
  const st2 = await estadoGuia();
  check('the new technique is playing on the phone', st2 && st2.running && st2.id === (await ev('Guia.g && Guia.g.id')), st2);
  screen('04-switch');
  await click(A('sSair'), 1000);
  const st3 = await estadoGuia();
  check('Leave stops the session on the phone', st3 && !st3.running, st3);
  check('history keeps the session as "left before the end"', await ev(`(() => { const h = Hist.todos(); const r = h[h.length - 1]; return r && r.saida === 'saiu' && r.resp === null; })()`));

  // ---- peace with a sound: pause and resume reach the service
  await click(A('pazAbrir')); await click(A('paz', '[data-v="somLongo"]'), 1500);
  await click(A('sPausar'), 800);
  const p1 = await estadoGuia();
  check('pause reaches the phone', p1 && p1.pausadoEm > 0, p1);
  await cabe('peace, paused');
  await click(A('sContinuar'), 800);
  const p2 = await estadoGuia();
  check('resume reaches the phone', p2 && p2.running && p2.pausadoEm === 0, p2);
  screen('05-peace');
  await click(A('sSair'), 800);

  // ---- nap: never claims an alarm Android did not confirm
  await click(A('cochilo'), 1500);
  const semPermissao = await ev(`!!document.querySelector('[data-a="cochiloAutorizar"]') || !!document.querySelector('[data-a="cochiloComecar"]')`);
  check('nap screen shows either Start or the honest "not guaranteed" panel', semPermissao);
  await cabe('nap');
  screen('06-nap-before');
  adb('shell', 'appops', 'set', PKG, 'SCHEDULE_EXACT_ALARM', 'allow');
  adb('shell', 'pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS');
  await ev('Coch.checar()'); await sleep(800);
  check('with permission, Start appears', await ev(`!!document.querySelector('[data-a="cochiloComecar"]')`), await ev('Coch.st'));
  screen('07-nap-ready');
  await click(A('voltar'), 500);

  // the real alarm, with the screen off: rings on time, the Turn off screen comes up
  adb('logcat', '-c');
  const alvo = Date.now() + 40000;
  const ag = await ev(`Nat.call('alarmeAgendar', { at: ${alvo}, tipo: 'teste' })`);
  check('Android confirmed the test alarm', ag && ag.ok && ag.confirmado, ag);
  const dumpAlarm = adb('shell', 'dumpsys', 'alarm');
  check('the alarm is an alarm clock in Android', dumpAlarm.includes(PKG), null, false);
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); await sleep(1000);
  adb('shell', 'input', 'keyevent', 'KEYCODE_POWER');
  let tocou = null;
  for (let i = 0; i < 40 && !tocou; i++) {
    await sleep(2000);
    const lc = logcat();
    const m = lc.match(/alarme tocou tipo=teste previsto=(\d+) real=(\d+)/);
    if (m) tocou = { previsto: +m[1], real: +m[2], atraso: +m[2] - +m[1] };
  }
  check('the test alarm rang', !!tocou, tocou);
  check('it rang within 10 s of the time', tocou && Math.abs(tocou.atraso) <= 10000, tocou, false);
  await sleep(2500);
  screen('08-alarm-ringing');
  const topo = adb('shell', 'dumpsys', 'activity', 'activities');
  check('the Turn off screen opened over the lock screen', /AlarmeActivity/.test(topo), null, false);
  adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'); await sleep(500);
  adb('shell', 'wm', 'dismiss-keyguard'); await sleep(500);
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`); await sleep(2500);
  await connect(); await pronto();
  const tocando = await ev(`Nat.call('alarmeStatus').then(s => s.tocando)`);
  check('the alarm is still ringing until it is turned off', tocando, null, false);
  await ev(`Nat.call('alarmeDesligar')`); await sleep(1500);
  check('Turn off stops the alarm', !(await ev(`Nat.call('alarmeStatus').then(s => s.tocando)`)));
  const log = await ev(`Nat.call('alarmeLog').then(r => r.itens)`);
  check('the diagnostics log has predicted, rang and turned off', log && log.some(x => x.tipo === 'teste' && x.tocou && x.desligado), log && log.slice(-2));
  fs.writeFileSync(`${OUT}/logcat-alarm.txt`, logcat());
  await ev(`(() => { S.tela = 'inicio'; render(); return true; })()`);

  // ---- the widget, tile and shortcuts open the session straight away (fornow://pico)
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); await sleep(1000);
  adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'fornow://pico', '-n', `${PKG}/.MainActivity`); await sleep(2500);
  await connect(); await pronto();
  check('fornow://pico (widget, tile, shortcut) starts the session', await waitFor(`Sessao.ativa && Sessao.modo === 'pico' && S.tela === 'sessao'`, 6000));
  screen('09-from-widget');
  await ev(`(() => { Sessao.sair(); return true; })()`); await sleep(600);
  const pkgInfo = adb('shell', 'dumpsys', 'package', PKG);
  check('the quick settings tile and the widget are installed', /PicoTile/.test(pkgInfo) && /PicoWidget/.test(pkgInfo), null, false);

  // ---- night: dark and dim, no questions
  await click(A('madrugada'), 1200);
  check('night screen is dark', (await ev(`document.documentElement.dataset.noite`)) === '1');
  await cabe('night');
  screen('10-night');
  await click(A('madVoltar'), 600);

  // ---- languages
  await click(A('ajustes'), 600); await click(A('ajLang', '[data-v="pt"]'), 600); await click(A('voltar'), 400);
  check('Portuguese works', (await ev(`document.querySelector('[data-a="pico"]').textContent.trim()`)) === 'Está difícil agora');
  await cabe('Portuguese home');
  screen('11-home-pt');
  await click(A('ajustes'), 600); await click(A('ajLang', '[data-v="en"]'), 600); await click(A('voltar'), 400);

  // ---- automatic update: switch to a newer copy of the page, data stays
  if (UP && fs.existsSync('upd.zip')) {
    adb('push', 'upd.zip', '/data/local/tmp/upd.zip');
    adb('shell', `cat /data/local/tmp/upd.zip | run-as ${PKG} sh -c 'mkdir -p files/bundles && cat > files/upd.zip && rm -rf files/bundles/${UP} && mkdir files/bundles/${UP} && cd files/bundles/${UP} && unzip -q -o ../../upd.zip && ls'`);
    const dir = `/data/user/0/${PKG}/files/bundles/${UP}`;
    const nHist = await ev('Hist.todos().length');
    await ev(`(() => { LS.set('staged', { build: ${UP}, path: ${q(dir)} }); return aplicarAtualizacao(); })()`);
    await sleep(6000);
    await connect(); await pronto();
    check('update: the app switched to the new version', (await ev('window.FN_BUILD')) === UP, await ev('window.FN_BUILD'), false);
    await sleep(3000);
    check('update: the new version confirmed itself', (await ev(`LS.get('trying')`)) == null, null, false);
    check('update: history kept', (await ev('Hist.todos().length')) === nHist, null, false);
    adb('shell', 'am', 'force-stop', PKG); await sleep(1000);
    adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`); await sleep(5000);
    await connect(); await pronto();
    check('update: still on the new version after a restart', (await ev('window.FN_BUILD')) === UP, null, false);
  }

  todosEventos.push(...cdp.events);
  const excecoes = todosEventos.filter(m => m.method === 'Runtime.exceptionThrown').map(m => (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text);
  check('no uncaught JavaScript errors', excecoes.length === 0, excecoes.slice(0, 10));
  const erros = todosEventos.filter(m => m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error').map(m => m.params.args.map(a => a.value || a.description).join(' '));
  check('no console errors', erros.length === 0, erros.slice(0, 10), false);
}

try { await main(); } catch (e) { check('test ran to the end', false, String((e && e.stack) || e)); screen('99-crash'); }
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
const failed = results.filter(r => !r.ok && r.fatal);
fs.writeFileSync(`${OUT}/summary.txt`, results.map(r => `${r.ok ? 'PASS' : r.fatal ? 'FAIL' : 'WARN'} ${r.name}${r.ok ? '' : ' — ' + JSON.stringify(r.info).slice(0, 300)}`).join('\n') + '\n');
console.log(`\n${results.length - failed.length}/${results.length} checks passed (warnings don't block)`);
if (cdp) cdp.close();
process.exit(failed.length ? 1 : 0);
