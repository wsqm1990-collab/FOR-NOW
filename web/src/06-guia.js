/* ---------- o guia: uma linha do tempo de frases, com voz e som ----------
   Modelo de tempo (o mesmo do lado Android): decorrido = (pausadoEm || agora) - ini - pausa.
   No celular, o serviço do Android é dono do relógio, da voz e do som, e continua com a tela
   bloqueada. A página só acompanha. No navegador, a própria página faz tudo (para testes). */
const Guia = {
  g: null,
  timer: null,
  aoMudar: null,     // (g, i) => a tela troca a frase
  aoTerminar: null,  // (g) => a sessão decide o que vem depois

  iniciar(cfg) {
    this.parar();
    const passos = cfg.passos.filter(Boolean);
    // cada frase tem pelo menos o tempo de ser dita com calma (na respiração o tempo é exato)
    const dur = passos.map(([t, s]) => cfg.exato ? Math.max(300, s * 1000) : Math.max(1000, s * 1000, t ? (Math.ceil(t.length / 11) + 2) * 1000 : 0));
    let total = dur.reduce((a, b) => a + b, 0);
    /* um mix (salvo, ou sendo montado) toca em camadas; o resto é um som ou uma lista */
    const mix = cfg.camadas ? null : Mix.de(cfg.som && cfg.som.startsWith('mix:') ? cfg.som : '');
    const camadas = cfg.camadas || (mix ? mix.camadas : null);
    const sonsCfg = camadas ? null : (cfg.sons || listaDoEstilo(cfg.som));
    if (cfg.totalMs && cfg.totalMs > total) { dur[dur.length - 1] += cfg.totalMs - total; total = cfg.totalMs; }
    const g = this.g = {
      id: uid(), tec: cfg.tec, passos, dur, total, ini: agora(), pausa: 0, pausadoEm: 0,
      voz: !!cfg.voz, som: somReal(cfg.som || 'silencio'), fimFadeMs: cfg.fimFadeMs || 0, volume: cfg.volume || 1, idx: -1,
      sons: sonsCfg ? sonsCfg.map(somReal).filter(x => x !== 'silencio') : null, faixa: 0, tipo: cfg.tipo || '', fases: cfg.fases || null, titulo: cfg.titulo || null,
      camadas: camadas ? JSON.parse(JSON.stringify(camadas)) : null,
      extra: cfg.extra && cfg.extra.v ? { v: somReal(cfg.extra.v), vol: cfg.extra.vol } : null,
    };
    if (cfg.camadas) g.som = 'mix:';
    if (Nat.on) {
      const plano = {
        id: g.id, ini: g.ini, voz: g.voz, som: nativo(g.som), volume: g.volume, fimFade: g.fimFadeMs, rate: prefs().velocidade, lang: TTS_LANG[LANG],
        labels: { title: 'For Now', text: t('n_text'), paused: t('paused'), pause: t('pause'), resume: t('resume'), end: t('end'), channel: t('n_channel') },
        passos: passos.map((x, i) => ({ t: x[0], s: dur[i] / 1000, a: clipe(x[0]), v: x[2] || 0 })),
      };
      if (g.sons) plano.sons = g.sons.map(nativo);
      if (g.camadas || g.extra) plano.camadas = this.camadasDe(g);
      if (cfg.volSom != null) plano.volSom = cfg.volSom;
      Nat.safe('guiaStart', plano);
    } else GuiaWeb.iniciar(g);
    this.salvar();
    this.tick();
    return g;
  },
  salvar() { const g = this.g; if (!g) return; const { idx, ...resto } = g; LS.set('guia', resto); },
  decorrido(g = this.g) { return Math.max(0, (g.pausadoEm || agora()) - g.ini - g.pausa); },
  indice(g = this.g) {
    const e = this.decorrido(g);
    let i = 0, acc = 0;
    while (i < g.dur.length && e >= acc + g.dur[i]) { acc += g.dur[i]; i++; }
    return i;
  },
  /* a frase a mostrar: a do passo atual, ou a última dita antes de um silêncio */
  frase(g = this.g) {
    if (!g) return { texto: '', calado: true };
    const i = Math.min(Math.max(g.idx, 0), g.passos.length - 1);
    for (let k = i; k >= 0; k--) if (g.passos[k][0]) return { texto: g.passos[k][0], calado: k !== i };
    return { texto: '', calado: true };
  },
  tick() {
    clearTimeout(this.timer);
    const g = this.g;
    if (!g) return;
    const i = this.indice(g);
    if (i >= g.passos.length) { this.fim(); return; }
    if (i !== g.idx) {
      g.idx = i;
      if (!Nat.on) GuiaWeb.passo(g, i);
      if (this.aoMudar) this.aoMudar(g, i);
    }
    if (this.aoTique) this.aoTique(g);
    this.timer = setTimeout(() => this.tick(), document.visibilityState === 'visible' ? 250 : 1000);
  },
  sync(o) { if (this.g && Nat.on) Nat.safe('guiaUpdate', Object.assign({ id: this.g.id }, o)); },
  pausar() {
    const g = this.g;
    if (!g || g.pausadoEm) return;
    g.pausadoEm = agora();
    this.sync({ pausadoEm: g.pausadoEm });
    if (!Nat.on) GuiaWeb.pausar(g);
    this.salvar();
  },
  continuar() {
    const g = this.g;
    if (!g || !g.pausadoEm) return;
    g.pausa += agora() - g.pausadoEm;
    g.pausadoEm = 0;
    this.sync({ pausa: g.pausa, pausadoEm: 0, refalar: true });
    if (!Nat.on) { GuiaWeb.continuar(g); GuiaWeb.passo(g, g.idx); }
    this.salvar();
    this.tick();
  },
  setVoz(v) {
    const g = this.g;
    if (!g) return;
    g.voz = !!v;
    this.sync({ voz: g.voz, refalar: g.voz });
    if (!Nat.on) { if (g.voz) GuiaWeb.passo(g, g.idx); else GuiaWeb.calar(); }
    this.salvar();
  },
  setSom(s) {
    const g = this.g;
    if (!g) return;
    g.som = somReal(s);
    const mix = Mix.de(g.som.startsWith('mix:') ? g.som : '');
    g.camadas = mix ? JSON.parse(JSON.stringify(mix.camadas)) : null;
    const l = mix ? null : listaDoEstilo(g.som);
    g.sons = l ? l.map(somReal) : null;
    g.faixa = 0;
    this.enviarSons();
    if (!Nat.on) GuiaWeb.som(g.som, g);
    this.salvar();
  },
  /* lista de músicas: a próxima agora, com uma transição curta */
  /* as camadas como vão ao Android (na versão 8D, se ligada; os tons como receita) */
  camadasPlano(camadas) { return Mix.plano(camadas).map(c => ({ sons: c.sons.map(nativo), vol: c.vol })); },
  /* tudo o que toca ao fundo, como camadas: o mix (ou o som / a lista) e o som extra por baixo */
  camadasDe(g) {
    const base = g.camadas ? this.camadasPlano(g.camadas)
      : g.som === 'silencio' ? [] : [{ sons: (g.sons || [g.som]).map(nativo), vol: 1 }];
    if (g.extra && g.extra.v && g.extra.v !== 'silencio') base.push({ sons: [nativo(g.extra.v)], vol: Math.round(g.extra.vol * 100) / 100 });
    return base;
  },
  /* manda ao Android o fundo atual: o que muda entra e sai devagar, sem cortar */
  enviarSons() {
    const g = this.g;
    if (!g || !Nat.on) return;
    this.sync({ som: nativo(g.som), camadas: this.camadasDe(g) });
  },
  /* o som extra por baixo da música, e o volume dele */
  setExtra(v, vol) {
    const g = this.g;
    if (!g) return;
    g.extra = v && v !== 'silencio' ? { v: somReal(v), vol } : null;
    this.enviarSons();
    this.salvar();
  },
  /* o mix sendo montado mudou */
  setCamadas(camadas) {
    const g = this.g;
    if (!g) return;
    g.camadas = JSON.parse(JSON.stringify(camadas));
    this.enviarSons();
  },
  proxima() {
    const g = this.g;
    if (!g || !g.sons || g.sons.length < 2) return;
    g.faixa = (g.faixa + 1) % g.sons.length;
    this.sync({ proxima: true });
    this.salvar();
  },
  /* parar por escolha (Sair, Trocar): sem esperar o fim */
  parar() {
    clearTimeout(this.timer);
    if (this.g) {
      if (Nat.on) Nat.safe('guiaStop', { id: this.g.id });
      else GuiaWeb.parar();
    }
    this.g = null;
    LS.del('guia');
  },
  /* fim natural: o lado Android termina sozinho, com o som saindo devagar */
  fim() {
    clearTimeout(this.timer);
    const g = this.g;
    this.g = null;
    LS.del('guia');
    if (!Nat.on) GuiaWeb.parar();
    if (g && this.aoTerminar) this.aoTerminar(g);
  },
  /* quando a página volta (o Android pode ter fechado o app enquanto o guia seguia) */
  async restaurar() {
    const s = LS.get('guia');
    if (!s) return 'nada';
    if (Nat.on) {
      const st = await Nat.safe('guiaState');
      if (st && st.id === s.id && st.running) {
        this.g = Object.assign(s, { ini: st.ini, pausa: st.pausa, pausadoEm: st.pausadoEm, idx: -1 });
        this.tick();
        return 'rodando';
      }
      LS.del('guia');
      return st && st.id === s.id && st.complete ? 'terminou' : 'parou';
    }
    const g = Object.assign(s, { idx: -1 });
    if (this.decorrido(g) >= g.total) { LS.del('guia'); return 'terminou'; }
    this.g = g;
    GuiaWeb.iniciar(g);
    this.tick();
    return 'rodando';
  },
  /* eventos do Android: pausa pela notificação, ligação, fone desconectado, Encerrar */
  evento(ev) {
    const g = this.g;
    if (!g || !ev || ev.id !== g.id) return;
    if (ev.type === 'state') {
      g.ini = ev.ini; g.pausa = ev.pausa; g.pausadoEm = ev.pausadoEm;
      if (typeof ev.faixa === 'number') g.faixa = ev.faixa;
      this.salvar();
      if (typeof atualizarEstadoSessao === 'function') atualizarEstadoSessao();
      this.tick();
    } else if (ev.type === 'stopped' && (ev.by === 'notification' || ev.by === 'alarme')) {
      clearTimeout(this.timer);
      this.g = null;
      LS.del('guia');
      Sessao.paradaPorFora();
    } else if (ev.type === 'done') {
      this.tick();
    }
  },
};

/* no navegador (testes): voz do próprio navegador, se houver, e o som pela página */
/* a gravação de uma frase (em português, na voz escolhida), se existir */
function clipe(texto) {
  if (!texto || LANG !== 'pt' || !temMidia()) return '';
  const tipo = prefs().vozTipo;
  if (tipo === 'android') return '';
  const m = (typeof VOZ_PT !== 'undefined' && VOZ_PT[tipo === 'masculina' ? 'masculina' : 'feminina']) || {};
  return m[texto] || '';
}
/* o som que dá para tocar aqui: no app, as gravações (e as antigas chuva/ondas viram as gravadas);
   no navegador, os sons feitos em código */
function somReal(v) {
  if (!v) return 'silencio';
  if (SUBSTITUI[v]) v = SUBSTITUI[v];
  if (v.startsWith('midia/camadas/')) return 'silencio';
  if (v.startsWith('mix:')) return temMidia() && Mix.de(v) ? v : 'silencio';
  if (temMidia()) return v === 'chuva' ? 'midia/sons/N01.ogg' : v === 'ondas' ? 'midia/sons/N02.ogg' : v === 'grave' ? 'midia/ruidos/marrom.ogg' : v;
  if (v.startsWith('midia/')) return v === 'midia/sons/N02.ogg' ? 'ondas' : v.startsWith('midia/sons/') ? 'chuva' : v.startsWith('midia/ruidos/') ? 'grave' : 'silencio';
  return v;
}

const GuiaWeb = {
  audio: null,
  iniciar(g) { this.som(g.som, g); },
  som(id, g) {
    try {
      if (this.audio) { this.audio.pause(); this.audio = null; }
      if (id && id !== 'silencio' && !id.startsWith('mix:') && !id.startsWith('midia/')) {
        const a = new Audio('sons/' + id + '.ogg');
        a.loop = true;
        a.volume = Math.min(1, 0.6 * ((g && g.volume) || 1));
        a.play().catch(() => { /* sem permissão para tocar ainda */ });
        this.audio = a;
      }
    } catch { /* sem áudio */ }
  },
  passo(g, i) {
    const t = g && g.passos[i] && g.passos[i][0];
    if (!g || !g.voz || !t || g.pausadoEm || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = TTS_LANG[LANG];
      u.rate = prefs().velocidade;
      speechSynthesis.speak(u);
    } catch { /* sem voz */ }
  },
  calar() { try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch { /* nada */ } },
  pausar() { this.calar(); if (this.audio) this.audio.pause(); },
  continuar() { if (this.audio) this.audio.play().catch(() => { /* nada */ }); },
  parar() { this.calar(); if (this.audio) { this.audio.pause(); this.audio = null; } },
};
