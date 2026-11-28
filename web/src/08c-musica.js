/* ---------- músicas e sono ----------
   Uma música (ou um som da natureza) toca pelo tempo escolhido; as músicas seguem uma atrás da
   outra com transição suave. "Dormir agora" junta uma voz que solta o corpo nos primeiros minutos,
   tela bem escura e a música sumindo devagar no fim. Tudo pelo Android, com a tela apagada. */
/* os sons por baixo da música que ficam para as próximas (até 4); antes era um só ("fundo") */
const MAX_FUNDOS = 4;
function fundosSalvos() {
  const m = prefs().musica;
  const l = Array.isArray(m.fundos) && m.fundos.length ? m.fundos : (m.fundo && m.fundo.v ? [m.fundo] : []);
  return l.filter(x => x && x.v && x.v !== 'silencio').slice(0, MAX_FUNDOS).map(x => ({ v: x.v, vol: Number(x.vol) || 0.3 }));
}
function salvarFundos(l) {
  setPref('musica.fundos', (l || []).map(x => ({ v: x.v, vol: x.vol })));
  if (prefs().musica.fundo) setPref('musica.fundo', null);
}
/* o volume com que cada tipo de som entra por baixo da música */
const volFundo = v => (v.startsWith('midia/binaural/') || v.startsWith('midia/frequencias/') ? 0.3 : 0.45);

const Mus = {
  /* as músicas começando pela escolhida: as do mesmo uso (relaxar, focar...), ou, para dormir e
     para fundo, só as do mesmo estilo (muda menos ainda) */
  lista(desde, como) {
    desde = ID_SUBSTITUI[desde] || desde;
    const cat = (MUSICAS.find(m => m[0] === desde) || [])[2], uso = usoDe(caminhoMusica(desde));
    const ids = MUSICAS.filter(m => como === 'uso' ? usoDe(caminhoMusica(m[0])) === uso : !como || m[2] === cat).map(m => m[0]);
    const k = Math.max(0, ids.indexOf(desde));
    return [...ids.slice(k), ...ids.slice(0, k)].map(caminhoMusica);
  },
  tocar(v, dormir) {
    const p = prefs(), m = p.musica;
    v = ID_SUBSTITUI[v] || v;
    const ehMusica = /^[MR]\d\d$/.test(v), ehMix = v.startsWith('mix:');
    if (ehMusica) setPref('musica.ultima', v);
    const sons = ehMix ? null : ehMusica ? this.lista(v, dormir ? 'estilo' : 'uso') : [v];
    const minutos = Number(m.timer) || 0;            /* 0 = sem fim (8 horas) */
    const totalS = minutos ? minutos * 60 : 8 * 3600;
    const passos = [];
    if (dormir && m.vozDormir) DORMIR.forEach((f, i) => passos.push([tr(f), i === DORMIR.length - 1 ? 12 : 26]));
    passos.push(['', 2]);
    Sessao.novo('musica', { som: v, dormir: !!dormir, min: minutos });
    Sessao.tec = 'musica';
    Sessao.fase = 'guia';
    Sessao.r.passos.push({ tec: 'musica', ini: agora(), fim: null });
    Hist.salvar(Sessao.r);
    Guia.iniciar({
      tec: 'musica', tipo: dormir ? 'dormir' : 'musica', passos, sons, som: ehMix ? v : sons[0], voz: p.voz.musica !== false,
      extras: fundosSalvos().filter(x => x.v !== caminhoMusica(v)),
      totalMs: totalS * 1000, fimFadeMs: minutos ? Math.min(180000, totalS * 150) : 4000, volSom: 0.6,
    });
    Sessao.salvarEstado();
    if (dormir && Nat.on) Nat.safe('brilho', { nivel: 0.05 });
    S.tela = 'sessao';
    render();
  },
  dormir() { this.tocar(prefs().musica.ultima || 'R03', true); },
  nomeAtual(g = Guia.g) {
    if (!g) return '';
    const v = g.sons && g.sons.length ? g.sons[Math.min(g.faixa || 0, g.sons.length - 1)] : g.som;
    return nomeSom(v);
  },
  restaMin(g = Guia.g) { return g ? Math.max(1, Math.ceil((g.total - Guia.decorrido(g)) / 60000)) : 0; },
};
