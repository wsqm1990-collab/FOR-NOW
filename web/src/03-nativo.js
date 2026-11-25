/* ---------- o lado Android (Capacitor) ----------
   No navegador, cada chamada aqui simplesmente não acontece, e a mesma página continua funcionando. */
const Nat = (() => {
  const C = () => window.Capacitor;
  const nativo = () => { try { return !!(C() && C().isNativePlatform && C().isNativePlatform()); } catch { return false; } };
  const cache = {};
  const regs = [];   /* { evt, fn, name, h }: every listener this page added, to add back if Android dropped them */
  async function adicionar(r) {
    const p = plugin(r.name);
    if (!p || typeof p.addListener !== 'function') return;
    try { r.h = await p.addListener(r.evt, r.fn); } catch { r.h = null; }
  }
  function plugin(name) {
    if (!nativo()) return null;
    if (cache[name]) return cache[name];
    try {
      const reg = (window.capacitorExports && window.capacitorExports.registerPlugin) || (C().registerPlugin && C().registerPlugin.bind(C()));
      cache[name] = reg ? reg(name) : (C().Plugins && C().Plugins[name]) || null;
    } catch { cache[name] = (C().Plugins && C().Plugins[name]) || null; }
    return cache[name];
  }
  return {
    get on() { return nativo() && !!plugin('ForNow'); },
    async call(m, o, name = 'ForNow') {
      const p = plugin(name);
      if (!p || typeof p[m] !== 'function') throw { code: 'unavailable' };
      return p[m](o || {});
    },
    safe(m, o, name) {
      return this.call(m, o, name).catch(e => {
        try { console.warn('nativo ' + (name || 'ForNow') + '.' + m + ': ' + ((e && (e.message || e.code)) || String(e))); } catch { /* nada */ }
        return null;
      });
    },
    listen(evt, fn, name = 'ForNow') { const r = { evt, fn, name, h: null }; regs.push(r); return adicionar(r); },
    /* Capacitor drops every listener when a page starts loading. If that happens just after this
       page added its listeners (it can, on a slow start), Android's events stop arriving; this puts
       them all back, removing the old ones first so nothing runs twice. Returns true if all were there. */
    async garantirOuvintes() {
      if (!this.on || !regs.length) return true;
      const st = await this.safe('ouvintes');
      if (!st) return true;
      if (regs.filter(r => r.name === 'ForNow').every(r => st[r.evt] !== false)) return true;
      for (const r of regs) {
        try { if (r.h && typeof r.h.remove === 'function') await r.h.remove(); } catch { /* já não existia */ }
        await adicionar(r);
      }
      try { console.warn('nativo: listeners were missing and were added back'); } catch { /* nada */ }
      return false;
    },
  };
})();
