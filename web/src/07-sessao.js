/* ---------- sessões: o que acontece em cada momento ----------
   Uma sessão por vez. O registro vai para o histórico desde o começo e é completado no fim.
   Fases: 'guia' (frases tocando) · 'escolha' (depois da primeira técnica do pico) · 'fim' (como seguir)
          'resposta' (uma pergunta opcional) · 'quieto' (madrugada terminou) · 'cochilo' */
const RESPOSTAS = {
  pico: { pergunta: ['Did you get through it?', 'Deu para atravessar?', '¿Pudiste atravesarlo?'], op: [['sim', ['Yes', 'Sim', 'Sí']], ['mais_ou_menos', ['Somewhat', 'Mais ou menos', 'Más o menos']], ['nao', ['No', 'Não', 'No']]] },
  paz: { pergunta: ['Did you get some rest?', 'Teve algum descanso?', '¿Pudiste descansar algo?'], op: [['sim', ['Yes', 'Sim', 'Sí']], ['um_pouco', ['A little', 'Um pouco', 'Un poco']], ['nao', ['No', 'Não', 'No']]] },
  cochilo: { pergunta: ['How do you feel after the nap?', 'Como você ficou depois do cochilo?', '¿Cómo quedaste después de la siesta?'], op: [['disposto', ['More energized', 'Mais disposto', 'Con más energía']], ['igual', ['The same', 'Igual', 'Igual']], ['grogue', ['Groggier', 'Mais grogue', 'Más aturdido']], ['acordado', ['Rested awake', 'Descansei acordado', 'Descansé despierto']]] },
  madrugada: { pergunta: ['About the night: could you rest again?', 'Sobre a madrugada: deu para voltar a descansar?', 'Sobre la madrugada: ¿pudiste volver a descansar?'], op: [['sim', ['Yes', 'Sim', 'Sí']], ['mais_ou_menos', ['Somewhat', 'Mais ou menos', 'Más o menos']], ['nao', ['No', 'Não', 'No']]] },
};
const perguntaDe = modo => tr((RESPOSTAS[modo] || RESPOSTAS.pico).pergunta);
const opcoesDe = modo => (RESPOSTAS[modo] || RESPOSTAS.pico).op.map(([v, n]) => [v, tr(n)]);
const nomeResp = (modo, v) => { const o = opcoesDe(modo).find(x => x[0] === v); return o ? o[1] : null; };

const Sessao = {
  r: null,
  fase: null,
  tec: null,
  usadas: [],
  get ativa() { return !!this.r && !this.r.fim; },
  get modo() { return this.r ? this.r.modo : null; },

  novo(modo, extra) {
    if (this.ativa) this.encerrar('substituida');
    this.r = { id: uid(), modo, ini: agora(), fim: null, passos: [], saida: null, resp: null, extra: extra || {} };
    this.fase = null; this.tec = null; this.usadas = [];
    Hist.salvar(this.r);
    this.salvarEstado();
  },
  salvarEstado() { if (this.r) LS.set('sessao', { id: this.r.id, fase: this.fase, tec: this.tec, usadas: this.usadas }); },

  ordem(modo) {
    const p = prefs();
    return (p.ordem[modo] || []).filter(t => TEC[t] && !(p.ocultas[modo] || []).includes(t));
  },
  primeiraDe(modo) {
    const p = prefs(), o = this.ordem(modo);
    if (p.primeira[modo] && o.includes(p.primeira[modo])) return p.primeira[modo];
    return o[0] || (modo === 'pico' ? 'ambiente' : 'musculos');
  },
  somPara(modo, tec) {
    const p = prefs(), t = TEC[tec] || {};
    if (modo === 'paz') return p.som.paz;
    if (modo === 'madrugada') return p.som.madrugada;
    if (modo === 'cochilo') return p.som.cochilo;
    return t.usaSom ? p.som.pico : 'silencio';
  },

  /* começa (ou troca para) uma técnica */
  tocar(tec, opts = {}) {
    if (!this.r) return;
    const p = prefs(), m = this.r.modo, t = TEC[tec];
    const t0 = agora();
    const ult = this.r.passos[this.r.passos.length - 1];
    if (ult && !ult.fim) { ult.fim = t0; if (opts.trocou) ult.trocou = true; }
    const repetida = this.usadas.includes(tec) || !!opts.trocou;
    const passos = passosDe(tec, repetida);
    this.usadas.push(tec);
    this.tec = tec;
    this.fase = 'guia';
    this.r.passos.push({ tec, ini: t0, fim: null });
    Hist.salvar(this.r);
    Guia.iniciar({
      tec, passos, voz: p.voz[m] !== false, som: this.somPara(m, tec),
      totalMs: t.minutos ? t.minutos * 60000 : 0,
      fimFadeMs: m === 'pico' ? 3000 : 12000,
      volume: m === 'madrugada' ? 0.6 : 1,
    });
    this.salvarEstado();
  },

  /* ----- os momentos ----- */
  pico() {
    this.novo('pico');
    this.tocar(this.primeiraDe('pico'));
    S.tela = 'sessao';
    render();
  },
  paz(tec) {
    this.novo('paz');
    this.tocar(tec || this.primeiraDe('paz'));
    S.tela = 'sessao';
    render();
  },
  madrugadaSoltar() {
    if (this.ativa && this.modo === 'madrugada') this.r.extra.via = 'soltar';
    else this.novo('madrugada', { via: 'soltar' });
    this.tocar('soltar');
    S.tela = 'sessao';
    render();
  },
  tocarCochilo(passos, voz, som, totalMs) {
    this.tec = 'cochilo';
    this.fase = 'cochilo';
    this.r.passos.push({ tec: 'cochilo', ini: agora(), fim: null });
    Hist.salvar(this.r);
    Guia.iniciar({ tec: 'cochilo', passos, voz, som, totalMs, fimFadeMs: 8000, volume: 0.8 });
    this.salvarEstado();
  },

  /* Trocar: sem menu. Da respiração (ou de qualquer outra) volta direto para o ambiente. */
  trocar() {
    if (!this.ativa || this.fase !== 'guia') return;
    const m = this.r.modo, atual = this.tec;
    let prox;
    if (m === 'pico') {
      const o = this.ordem('pico').filter(t => t !== atual);
      prox = atual !== 'ambiente' && o.includes('ambiente') ? 'ambiente' : (o[0] || 'ambiente');
    } else if (m === 'paz') {
      prox = atual === 'musculos' ? 'somLongo' : 'musculos';
    } else return;
    this.tocar(prox, { trocou: true });
    render();
  },

  guiaTerminou() {
    if (!this.ativa) return;
    const ult = this.r.passos[this.r.passos.length - 1];
    if (ult && !ult.fim) ult.fim = agora();
    Hist.salvar(this.r);
    const m = this.r.modo;
    if (m === 'pico') this.fase = this.usadas.length === 1 ? 'escolha' : 'fim';
    else if (m === 'paz') this.fase = 'resposta';
    else if (m === 'madrugada') { this.fase = 'quieto'; Pend.add({ id: this.r.id, tipo: 'madrugada', em: agora() }); }
    else if (m === 'cochilo') this.fase = 'cochilo';
    this.salvarEstado();
    if (m === 'cochilo') { if (S.tela === 'cochiloSessao') render(); return; }
    if (S.tela === 'sessao') render();
  },

  /* Encerrar pela notificação do Android */
  paradaPorFora() {
    if (!this.ativa) return;
    if (this.modo === 'cochilo') {        /* o som para, o cochilo e o alarme continuam */
      const ult = this.r.passos[this.r.passos.length - 1];
      if (ult && !ult.fim) ult.fim = agora();
      Hist.salvar(this.r);
      if (S.tela === 'cochiloSessao') render();
      return;
    }
    this.encerrar('notificacao');
    if (S.tela === 'sessao') { S.tela = 'inicio'; render(); }
  },

  escolher(tec) { if (this.fase === 'escolha' || this.fase === 'fim') { this.tocar(tec); render(); } },
  irParaFim() { this.fase = 'fim'; this.salvarEstado(); render(); },
  continuarDia() { this.r.saida = 'continuar'; this.fase = 'resposta'; Hist.salvar(this.r); this.salvarEstado(); render(); },
  maisUmMomento() { this.tocar('momento'); render(); },
  falar() { this.encerrar('falar'); S.tela = 'apoio'; S.voltar = 'inicio'; render(); },
  responder(v) {
    if (!this.r) return;
    if (v === 'pular') this.r.pulou = true; else this.r.resp = v;
    this.encerrar(this.r.saida || 'fim');
    S.tela = 'inicio';
    render();
  },
  sair() {
    if (!this.ativa) { S.tela = 'inicio'; render(); return; }
    this.encerrar(this.fase === 'resposta' ? (this.r.saida || 'fim') : 'saiu');
    S.tela = 'inicio';
    render();
  },
  encerrar(saida) {
    if (!this.r) return null;
    Guia.parar();
    const t = agora();
    const ult = this.r.passos[this.r.passos.length - 1];
    if (ult && !ult.fim) ult.fim = t;
    if (!this.r.saida) this.r.saida = saida;
    this.r.fim = t;
    Hist.salvar(this.r);
    LS.del('sessao');
    const r = this.r;
    this.r = null; this.fase = null; this.tec = null; this.usadas = [];
    if (Nat.on) Nat.safe('brilho', { nivel: -1 });
    return r;
  },

  /* quando a página volta: a sessão continua de onde estava */
  async restaurar() {
    const s = LS.get('sessao');
    if (!s) return false;
    const r = Hist.pegar(s.id);
    if (!r || r.fim) { LS.del('sessao'); return false; }
    this.r = r; this.fase = s.fase; this.tec = s.tec; this.usadas = s.usadas || [];
    if (r.modo === 'cochilo') {
      const st = await Guia.restaurar();
      if (st === 'terminou' || st === 'parou') { const ult = r.passos[r.passos.length - 1]; if (ult && !ult.fim) ult.fim = agora(); Hist.salvar(r); }
      S.tela = 'cochiloSessao';
      return true;
    }
    if (this.fase === 'guia') {
      const st = await Guia.restaurar();
      if (st === 'rodando') { S.tela = 'sessao'; return true; }
      if (st === 'terminou') { this.guiaTerminou(); S.tela = 'sessao'; return true; }
      this.encerrar('interrompida');
      return false;
    }
    S.tela = 'sessao';
    return true;
  },
};
