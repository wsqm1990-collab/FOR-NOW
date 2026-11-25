/* A stand-in for the Android side, so the page's native paths can be tested in a desktop browser. */
window.__calls = [];
window.__mock = {
  exato: true, notif: true, bateria: false, telaCheia: true, volumeAlarme: 5, fabricante: 'Xiaomi POCO',
  proximo: 0, cochilo: 0, tocando: false, acao: '', log: [], talkback: false,
};
(function () {
  const listeners = {};
  let guia = null;
  const M = window.__mock;
  function impl(name, m, o) {
    if (name === 'ForNow') {
      if (m === 'guiaStart') { guia = { id: o.id, ini: o.ini, pausa: 0, pausadoEm: 0, running: true, passos: o.passos, som: o.som, voz: o.voz }; return Promise.resolve({}); }
      if (m === 'guiaUpdate') { if (guia && guia.running && guia.id === o.id) for (const k of ['pausa', 'pausadoEm', 'som', 'voz']) if (o[k] != null) guia[k] = o[k]; return Promise.resolve({}); }
      if (m === 'guiaStop') { if (guia && guia.id === o.id) { guia.running = false; guia.ended = true; } return Promise.resolve({}); }
      if (m === 'guiaState') return Promise.resolve(guia ? { id: guia.id, ini: guia.ini, pausa: guia.pausa, pausadoEm: guia.pausadoEm, running: guia.running, complete: !!guia.complete } : {});
      if (m === 'alarmeStatus') return Promise.resolve({ exato: M.exato, notif: M.notif, telaCheia: M.telaCheia, bateria: M.bateria, volumeAlarme: M.volumeAlarme, volumeAlarmeMax: 7, naoPerturbe: 1, proximo: M.proximo, cochilo: M.cochilo, teste: 0, tocando: M.tocando, fabricante: M.fabricante });
      if (m === 'alarmeAgendar') {
        if (!M.exato) return Promise.resolve({ ok: false, erro: 'sem_permissao_exata' });
        if (o.tipo === 'cochilo') M.cochilo = o.at;
        M.proximo = o.at;
        M.log.push({ tipo: o.tipo, previsto: o.at, marcado: Date.now(), estado: 'marcado' });
        return Promise.resolve({ ok: true, at: o.at, proximo: o.at, confirmado: true });
      }
      if (m === 'alarmeCancelar') { if (o.tipo === 'cochilo') M.cochilo = 0; return Promise.resolve({}); }
      if (m === 'alarmeDesligar') { M.tocando = false; return Promise.resolve({}); }
      if (m === 'alarmeLog') return Promise.resolve({ itens: M.log });
      if (m === 'proximoAlarme') return Promise.resolve({ at: M.proximo });
      if (m === 'abrirRelogio') return Promise.resolve({ ok: true });
      if (m === 'askNotif') return Promise.resolve({ granted: true });
      if (m === 'launchAction') { const a = M.acao; M.acao = ''; return Promise.resolve({ acao: a }); }
      if (m === 'vozStatus') return Promise.resolve({ status: 'ok', motor: 'com.google.android.tts' });
      if (m === 'info') return Promise.resolve({ shell: 1, versionCode: 7, installer: '', sdk: 35, maker: 'Xiaomi', model: 'POCO', talkback: M.talkback });
      if (m === 'fetchText') return Promise.resolve({ text: JSON.stringify({ build: 999, zip: 'https://example.invalid/web.zip', sha256: '', minShell: 1 }) });
      if (m === 'fetchBundle') return Promise.resolve({ path: '/data/bundles/999' });
      return Promise.resolve({});
    }
    if (name === 'WebView' && m === 'setServerBasePath') { window.__switched = o.path; return Promise.resolve({}); }
    return Promise.resolve({});
  }
  function plugin(name) {
    return new Proxy({}, {
      get(_, m) {
        if (m === 'then') return undefined;
        if (m === 'addListener') return (evt, fn) => { (listeners[name + ':' + evt] = listeners[name + ':' + evt] || []).push(fn); return Promise.resolve({ remove() {} }); };
        return o => { window.__calls.push([name, m, JSON.parse(JSON.stringify(o || {}))]); return impl(name, m, o || {}); };
      },
    });
  }
  window.__emit = (name, evt, data) => (listeners[name + ':' + evt] || []).forEach(f => f(data));
  window.__guia = () => guia;
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', registerPlugin: plugin, Plugins: {} };
})();
