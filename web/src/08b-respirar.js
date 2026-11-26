/* ---------- respirar: exercícios guiados por um círculo ----------
   A voz guia as duas primeiras voltas (gravada, em português); depois ficam o círculo e uma
   vibração curta a cada fase. O Android cuida do tempo, com a tela ligada ou não; a tela só
   acompanha. Os tempos são exatos: a frase nunca estica uma fase. */
const Resp = {
  fasesDe(ex) {
    if (ex !== 'livre') return RESP[ex].fases;
    const l = prefs().respirar.livre;
    return [['in', l.in], ['hold', l.hold], ['out', l.out], ['pausa', l.pausa]].filter(([, s]) => s > 0);
  },
  /* [texto, segundos, vibração ms, fase] */
  passos(ex, minutos, vib) {
    const def = RESP[ex], fases = this.fasesDe(ex);
    const ciclo = fases.reduce((a, [, s]) => a + s, 0) || 1;
    const n = Math.max(2, Math.round((minutos * 60) / ciclo));
    const seg = txt => Math.ceil(txt.length / 12) + 2;
    const out = [];
    const intro = tr(def.intro);
    out.push([intro, seg(intro), 0, 'intro']);
    if (def.aviso) { const a = tr(RESP_AVISO); out.push([a, seg(a), 0, 'intro']); }
    out.push(['', 1.5, 0, 'pronto']);
    for (let c = 0; c < n; c++) {
      for (const [f, s] of fases) out.push([c < 2 ? tr(RESP_FALA[f][c ? 1 : 0]) : '', s, vib ? 35 : 0, f]);
    }
    out.push([tr(RESP_FIM[0]), 5, vib ? 60 : 0, 'fim']);
    out.push([tr(RESP_FIM[1]), 7, 0, 'fim']);
    return out;
  },
  comecar(ex) {
    const p = prefs(), r = p.respirar;
    ex = RESP[ex] ? ex : (RESP[r.ex] ? r.ex : 'quadrada');
    if (ex === 'livre' && !this.fasesDe('livre').length) ex = 'quadrada';
    setPref('respirar.ex', ex);
    const passos = this.passos(ex, r.min, r.vib);
    Sessao.novo('respirar', { ex, min: r.min });
    Sessao.tec = 'resp_' + ex;
    Sessao.fase = 'guia';
    Sessao.r.passos.push({ tec: 'resp_' + ex, ini: agora(), fim: null });
    Hist.salvar(Sessao.r);
    Guia.iniciar({
      tec: 'resp_' + ex, tipo: 'respirar', exato: true, passos, fases: passos.map(x => x[3]), titulo: RESP[ex].nome,
      voz: p.voz.respirar !== false, som: p.som.respirar, fimFadeMs: 8000, volSom: 0.4,
    });
    Sessao.salvarEstado();
    S.tela = 'sessao';
    render();
  },
  /* a fase de agora e quanto falta nela */
  agora(g = Guia.g) {
    if (!g || !g.fases) return null;
    const e = Guia.decorrido(g);
    let i = 0, acc = 0;
    while (i < g.dur.length - 1 && e >= acc + g.dur[i]) { acc += g.dur[i]; i++; }
    return { i, fase: g.fases[i], resta: Math.max(0, acc + g.dur[i] - e), dur: g.dur[i] };
  },
  ajustarLivre(campo, delta) {
    const l = prefs().respirar.livre;
    const v = Math.max(campo === 'in' || campo === 'out' ? 2 : 0, Math.min(12, (Number(l[campo]) || 0) + delta));
    setPref('respirar.livre.' + campo, v);
  },
};

/* o tamanho do círculo em cada fase (ele cresce na entrada do ar e diminui na saída) */
const ESCALA_FASE = { in: 1, in2: 1.1, out: 0.56, outLonga: 0.56, intro: 0.56, pronto: 0.56, fim: 0.72 };
function atualizarCirculo(forcar) {
  const el = $('#circulo');
  if (!el) return;
  const g = Guia.g, a = Resp.agora(g);
  if (!a) return;
  const rot = $('#resp-rotulo'), seg = $('#resp-seg');
  const nome = RESP_ROTULO[a.fase] ? tr(RESP_ROTULO[a.fase]) : '';
  if (rot && rot.textContent !== nome) rot.textContent = nome;
  if (seg) seg.textContent = RESP_ROTULO[a.fase] && !g.pausadoEm ? String(Math.max(1, Math.ceil(a.resta / 1000))) : '';
  if (g.pausadoEm) {
    const atual = getComputedStyle(el).transform;
    el.style.transitionDuration = '0s';
    if (atual && atual !== 'none') el.style.transform = atual;
    el.dataset.passo = '';
    return;
  }
  if (!forcar && el.dataset.passo === String(a.i)) return;
  el.dataset.passo = String(a.i);
  const alvo = ESCALA_FASE[a.fase];
  if (alvo == null) return;              /* segurar e pausa: o círculo fica onde está */
  el.style.transitionDuration = (a.resta / 1000).toFixed(2) + 's';
  el.style.transform = `scale(${alvo})`;
}
