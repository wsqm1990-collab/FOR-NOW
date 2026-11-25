/* ---------- o lado Android (Capacitor) ----------
   No navegador, cada chamada aqui simplesmente não acontece, e a mesma página continua funcionando. */
const Nat = (() => {
  const C = () => window.Capacitor;
  const nativo = () => { try { return !!(C() && C().isNativePlatform && C().isNativePlatform()); } catch { return false; } };
  const cache = {};
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
    listen(evt, fn, name = 'ForNow') { const p = plugin(name); if (p && typeof p.addListener === 'function') { try { p.addListener(evt, fn); } catch { /* nada */ } } },
  };
})();
