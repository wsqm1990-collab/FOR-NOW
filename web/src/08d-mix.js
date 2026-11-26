/* ---------- meus mixes ----------
   Um mix junta instrumentos (feitos para combinar sempre entre si) ou uma música pronta, com sons
   da natureza, cada um no seu volume. Enquanto monta, você ouve ao vivo (pelo Android).
   Ao salvar, o app decide sozinho para que ele serve (relaxar, focar, acalmar ou dormir) somando
   o peso de cada som pelo volume dele no conjunto, e diz por quê. Dá para trocar, se discordar. */
const Mix = {
  edit: null,        // o mix sendo montado: { id, nome, camadas: [{ v, vol }], uso: 'auto' | um dos USOS }
  ultimoEnvio: 0,
  envioTimer: null,

  todos() { return LS.get('mixes', []) || []; },
  de(v) { const id = String(v || '').replace(/^mix:/, ''); return this.todos().find(m => m.id === id) || null; },

  /* para que serve um conjunto, e os dois sons que mais pesaram nisso */
  classificar(camadas) {
    const tot = [0, 0, 0, 0];
    for (const c of camadas) { const p = PERFIL[c.v]; if (p) p[0].forEach((w, i) => { tot[i] += w * c.vol; }); }
    if (!tot.some(x => x > 0)) return { uso: null, razoes: [] };
    const i = tot.indexOf(Math.max(...tot));
    const razoes = camadas.filter(c => PERFIL[c.v]).map(c => [c.v, PERFIL[c.v][0][i] * c.vol])
      .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([v]) => nomeSom(v).toLowerCase());
    return { uso: USOS[i], razoes };
  },
  usoFinal(m) { return m.uso && m.uso !== 'auto' ? m.uso : (this.classificar(m.camadas).uso || 'relaxar'); },

  /* as camadas como o Android toca: uma música segue com as do mesmo estilo */
  plano(camadas) {
    return camadas.filter(c => c.vol > 0).map(c => ({ sons: (listaDoEstilo(c.v) || [c.v]).map(somReal), vol: Math.round(c.vol * 100) / 100 }));
  },
  descricao(m) { return m.camadas.map(c => nomeSom(c.v)).join(', '); },

  /* ----- montar ----- */
  novo() { this.edit = { id: null, nome: '', camadas: [], uso: 'auto' }; },
  editar(id) {
    const m = this.de(id);
    if (!m) return false;
    this.edit = JSON.parse(JSON.stringify({ id: m.id, nome: m.nome, camadas: m.camadas, uso: m.uso || 'auto' }));
    return true;
  },
  tem(v) { return !!this.edit && this.edit.camadas.some(c => c.v === v); },
  temMusica() { return !!this.edit && this.edit.camadas.some(c => c.v.startsWith('midia/musicas/')); },
  alternar(v) {
    const e = this.edit;
    if (!e) return;
    const i = e.camadas.findIndex(c => c.v === v);
    if (i >= 0) e.camadas.splice(i, 1);
    else {
      const musica = v.startsWith('midia/musicas/'), instrumento = v.startsWith('midia/camadas/');
      /* uma música pronta toca com a natureza, sem os instrumentos (cada música tem o seu tom) */
      if (musica) e.camadas = e.camadas.filter(c => !c.v.startsWith('midia/musicas/') && !c.v.startsWith('midia/camadas/'));
      if (instrumento) e.camadas = e.camadas.filter(c => !c.v.startsWith('midia/musicas/'));
      if (e.camadas.length >= 6) e.camadas.shift();
      e.camadas.push({ v, vol: musica ? 0.8 : 0.6 });
    }
    this.ouvir();
  },
  volume(v, vol) {
    const c = this.edit && this.edit.camadas.find(x => x.v === v);
    if (!c) return;
    c.vol = Math.max(0.05, Math.min(1, vol));
    this.ouvir();
  },
  nomeSugerido() {
    const e = this.edit;
    return (e && e.camadas.slice().sort((a, b) => b.vol - a.vol).slice(0, 2).map(c => nomeSom(c.v)).join(' + ')) || t('mix_word');
  },

  /* ----- ouvir enquanto monta: uma sessão sem histórico, que para ao sair da tela ----- */
  podeOuvir() { return temMidia() && !Sessao.ativa; },
  ouvindo() { return !!(Guia.g && Guia.g.tipo === 'mixPrevia'); },
  ouvir() {
    if (!this.podeOuvir() || !this.edit) return;
    if (!this.edit.camadas.length) { this.pararDeOuvir(); return; }
    if (!this.ouvindo()) {
      Guia.iniciar({ tec: 'mix', tipo: 'mixPrevia', passos: [['', 1]], camadas: this.edit.camadas, voz: false, totalMs: 60 * 60000, fimFadeMs: 4000, volSom: 0.7 });
      return;
    }
    /* mudanças ao vivo, no máximo a cada 150 ms (o Android desliza os volumes) */
    clearTimeout(this.envioTimer);
    const enviar = () => { this.ultimoEnvio = Date.now(); if (this.ouvindo() && this.edit) Guia.setCamadas(this.edit.camadas); };
    const espera = 150 - (Date.now() - this.ultimoEnvio);
    if (espera <= 0) enviar(); else this.envioTimer = setTimeout(enviar, espera);
  },
  pararDeOuvir() { clearTimeout(this.envioTimer); if (this.ouvindo()) Guia.parar(); },

  salvar(nome) {
    const e = this.edit;
    if (!e || !e.camadas.length) return null;
    const m = {
      id: e.id || 'm' + uid(),
      nome: (nome || '').trim().slice(0, 40) || this.nomeSugerido(),
      camadas: e.camadas.map(c => ({ v: c.v, vol: Math.round(c.vol * 100) / 100 })),
      uso: e.uso || 'auto',
    };
    m.cat = this.usoFinal(m);
    const l = this.todos();
    const i = l.findIndex(x => x.id === m.id);
    if (i >= 0) l[i] = m; else l.push(m);
    LS.set('mixes', l);
    this.edit = null;
    return m;
  },
  apagar(id) {
    LS.set('mixes', this.todos().filter(m => m.id !== id));
    /* quem usava este mix como fundo volta ao silêncio */
    const p = prefs();
    for (const k of Object.keys(p.som)) if (p.som[k] === 'mix:' + id) setPref('som.' + k, 'silencio');
    if (p.musica.ultima === 'mix:' + id) setPref('musica.ultima', 'M02');
    this.edit = null;
  },
};
