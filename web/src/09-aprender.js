/* ---------- descobrir o que ajuda ----------
   Regras simples e visíveis:
   1) suas escolhas explícitas valem primeiro (fixar, ocultar);
   2) o app aprende rápido o que incomoda (você trocou) e devagar o que ajuda (você marcou);
   3) toda sugestão mostra a contagem real, inclui os resultados mistos e pode ser desfeita;
   4) nada muda sozinho no pico; sugestões só aparecem longe de um pico e fora da noite.
   O número 3 é uma escolha de desenho para testar, sem valor estatístico ou clínico. */
const POSITIVA = { pico: 'sim', paz: 'sim' };

const Aprender = {
  stats(modo, desde = 0) {
    const h = Hist.todos().filter(r => r.modo === modo && r.fim && r.ini >= desde);
    const porTec = {};
    const base = () => ({ usos: 0, trocas: 0, aval: 0, sim: 0, meio: 0, nao: 0, sem: 0 });
    for (const r of h) {
      for (const p of r.passos || []) {
        const s = porTec[p.tec] = porTec[p.tec] || base();
        s.usos++;
        if (p.trocou) s.trocas++;
      }
      /* a resposta conta para a técnica com que a sessão terminou */
      const ult = (r.passos || []).filter(p => p.tec !== 'momento').pop();
      if (!ult) continue;
      const s = porTec[ult.tec] = porTec[ult.tec] || base();
      if (r.resp == null) s.sem++;
      else { s.aval++; if (r.resp === POSITIVA[modo]) s.sim++; else if (r.resp === 'nao') s.nao++; else s.meio++; }
    }
    return { total: h.length, porTec, h };
  },
  sugestao() {
    const h = Hist.todos();
    const ultPico = h.filter(r => r.modo === 'pico').pop();
    if (Sessao.ativa) return null;
    if (ultPico && agora() - (ultPico.fim || ultPico.ini) < 2 * 3600000) return null;
    const hr = new Date().getHours();
    if (hr >= 22 || hr < 7) return null;
    const vistas = LS.get('sugVistas', {}) || {};
    const p = prefs();
    for (const modo of ['pico', 'paz']) {
      const { porTec } = this.stats(modo);
      for (const tec of Object.keys(porTec)) {
        const s = porTec[tec], t = TEC[tec];
        if (!t || t.modo !== modo || tec === 'momento') continue;
        const kO = `ocultar:${modo}:${tec}`;
        if (!(p.ocultas[modo] || []).includes(tec) && s.trocas >= 2 && s.trocas / s.usos >= 0.66 && (vistas[kO] == null || s.usos >= vistas[kO] + 3)) {
          return { k: kO, tipo: 'ocultar', modo, tec, s, marca: s.usos };
        }
        const kF = `fixar:${modo}:${tec}`;
        if (s.aval >= 3 && s.sim / s.aval >= 0.6 && Sessao.primeiraDe(modo) !== tec && (vistas[kF] == null || s.aval >= vistas[kF] + 3)) {
          return { k: kF, tipo: 'fixar', modo, tec, s, marca: s.aval };
        }
      }
    }
    return null;
  },
  dispensar(sug) { const v = LS.get('sugVistas', {}) || {}; v[sug.k] = sug.marca; LS.set('sugVistas', v); },
  ocultar(modo, tec) {
    const p = prefs();
    const o = (p.ocultas[modo] || []).filter(x => x !== tec);
    o.push(tec);
    setPref('ocultas.' + modo, o);
    if (p.primeira[modo] === tec) setPref('primeira.' + modo, null);
  },
  restaurar(modo, tec) { setPref('ocultas.' + modo, (prefs().ocultas[modo] || []).filter(x => x !== tec)); },
  fixar(modo, tec) {
    const p = prefs();
    setPref('primeira.' + modo, tec);
    setPref('ordem.' + modo, [tec, ...(p.ordem[modo] || []).filter(x => x !== tec)]);
    this.restaurar(modo, tec);
  },
  desafixar(modo) { setPref('primeira.' + modo, null); },
  mover(modo, tec, d) {
    const o = [...(prefs().ordem[modo] || [])];
    const i = o.indexOf(tec), j = i + d;
    if (i < 0 || j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    setPref('ordem.' + modo, o);
  },

  /* tela Revisão: por momento, nas últimas duas semanas */
  revisao() {
    const desde = agora() - 14 * 86400000;
    const out = [];
    for (const modo of ['pico', 'paz', 'cochilo', 'madrugada']) {
      const h = Hist.todos().filter(r => r.modo === modo && r.ini >= desde);
      if (!h.length) continue;
      const fim = h.filter(r => r.fim);
      const resp = {};
      let sem = 0;
      for (const r of fim) { if (r.resp == null) sem++; else resp[r.resp] = (resp[r.resp] || 0) + 1; }
      const trocas = fim.reduce((a, r) => a + (r.passos || []).filter(p => p.trocou).length, 0);
      const saiu = fim.filter(r => r.saida === 'saiu' || r.saida === 'interrompida').length;
      out.push({ modo, n: h.length, resp, sem, trocas, saiu });
    }
    return out;
  },
};
