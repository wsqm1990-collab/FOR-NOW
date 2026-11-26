/* ---------- músicas e sono ----------
   Uma música (ou um som da natureza) toca pelo tempo escolhido; as músicas seguem uma atrás da
   outra com transição suave. "Dormir agora" junta uma voz que solta o corpo nos primeiros minutos,
   tela bem escura e a música sumindo devagar no fim. Tudo pelo Android, com a tela apagada. */
const Mus = {
  /* todas as músicas, começando pela escolhida */
  lista(desde) {
    const ids = MUSICAS.map(m => m[0]);
    const k = Math.max(0, ids.indexOf(desde));
    return [...ids.slice(k), ...ids.slice(0, k)].map(caminhoMusica);
  },
  tocar(v, dormir) {
    const p = prefs(), m = p.musica;
    const ehMusica = /^M\d\d$/.test(v);
    if (ehMusica) setPref('musica.ultima', v);
    const sons = ehMusica ? this.lista(v) : [v];
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
      tec: 'musica', tipo: dormir ? 'dormir' : 'musica', passos, sons, som: sons[0], voz: p.voz.musica !== false,
      totalMs: totalS * 1000, fimFadeMs: minutos ? Math.min(180000, totalS * 150) : 4000, volSom: 0.6,
    });
    Sessao.salvarEstado();
    if (dormir && Nat.on) Nat.safe('brilho', { nivel: 0.05 });
    S.tela = 'sessao';
    render();
  },
  dormir() { this.tocar(prefs().musica.ultima || 'M02', true); },
  nomeAtual(g = Guia.g) {
    if (!g) return '';
    const v = g.sons && g.sons.length ? g.sons[Math.min(g.faixa || 0, g.sons.length - 1)] : g.som;
    return nomeSom(v);
  },
  restaMin(g = Guia.g) { return g ? Math.max(1, Math.ceil((g.total - Guia.decorrido(g)) / 60000)) : 0; },
};
