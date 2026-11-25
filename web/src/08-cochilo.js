/* ---------- cochilo ----------
   Regra principal: o app só diz que o alarme está marcado depois de conferir com o Android.
   Uma contagem na tela nunca é tratada como despertador. */
const Coch = {
  st: null,          // situação do despertador no Android
  min: 20,
  painel: null,      // null | 'falhou' | 'relogioVolta' | 'relogioNao'
  motivo: '',
  ocupado: false,

  async abrir() {
    this.min = prefs().cochiloMin;
    this.painel = null;
    this.motivo = '';
    S.tela = 'cochilo';
    render();
    await this.checar();
  },
  async checar() {
    this.st = Nat.on ? await Nat.safe('alarmeStatus') : null;
    if (S.tela === 'cochilo' || S.tela === 'preparar' || S.tela === 'diagnostico') render();
    return this.st;
  },
  alvo() { return agora() + this.min * 60000; },
  pronto(st = this.st) { return !!(st && st.exato && st.notif); },
  /* o que impede o despertador de ser garantido */
  problemas(st = this.st) {
    if (!Nat.on) return [t('p_only_app')];
    if (!st) return [t('p_no_status')];
    const out = [];
    if (!st.exato) out.push(t('p_exact'));
    if (!st.notif) out.push(t('p_notif'));
    return out;
  },
  /* o que não impede, mas vale saber */
  avisos(st = this.st) {
    if (!st) return [];
    const out = [];
    if (st.volumeAlarme === 0) out.push(t('a_volume0'));
    if (!st.bateria) out.push(t('a_battery'));
    if (st.telaCheia === false) out.push(t('a_fullscreen'));
    if (/xiaomi|poco|redmi/i.test(st.fabricante || '') && !LS.get('prep_ok')) out.push(t('a_xiaomi'));
    return out;
  },
  ajustar(d) {
    this.min = Math.max(10, Math.min(45, this.min + d));
    render();
  },

  async comecar() {
    if (this.ocupado) return;
    this.ocupado = true;
    try {
      await this.checar();
      if (!this.pronto()) { this.painel = 'falhou'; this.motivo = ''; render(); return; }
      const alvo = this.alvo();
      const r = await Nat.safe('alarmeAgendar', { at: alvo, tipo: 'cochilo' });
      if (!r || !r.ok || !r.confirmado) {
        this.painel = 'falhou';
        this.motivo = r && r.erro === 'sem_permissao_exata' ? t('p_exact') : t('android_not_confirmed') + (r && r.erro ? ` (${r.erro})` : '');
        render();
        return;
      }
      setPref('cochiloMin', this.min);
      this.iniciarSessao('proprio', r.at || alvo);
    } finally { this.ocupado = false; }
  },
  iniciarSessao(tipo, alvo) {
    this.painel = null;
    Sessao.novo('cochilo', { alarme: tipo, alvo: alvo || null, min: this.min });
    const p = prefs();
    const som = p.som.cochilo;
    const voz = p.cochiloVoz && p.voz.cochilo !== false;
    let totalMs = 0;
    if (som !== 'silencio') totalMs = alvo ? Math.max(30000, alvo - agora() - 10000) : this.min * 60000;
    Sessao.tocarCochilo(roteiroCochilo(tipo, alvo), voz, som, totalMs);
    S.tela = 'cochiloSessao';
    render();
  },

  /* plano B: o Relógio do próprio celular */
  async relogioAbrir() {
    const alvo = this.alvo(), d = new Date(alvo);
    LS.set('relogio', { alvo, min: this.min });
    const r = await Nat.safe('abrirRelogio', { hora: d.getHours(), minuto: d.getMinutes(), mensagem: t('clock_label') });
    if (!r) { this.painel = 'relogioNao'; this.motivo = t('clock_open_fail'); render(); return; }
    this.painel = 'relogioVolta';
    render();
  },
  async relogioConferir() {
    const rel = LS.get('relogio');
    if (!rel) return;
    const r = await Nat.safe('proximoAlarme');
    const alvoMin = Math.floor(rel.alvo / 60000) * 60000;
    const ok = !!(r && r.at && r.at > agora() && Math.abs(r.at - alvoMin) <= 60000);
    if (ok) { LS.del('relogio'); this.min = rel.min || this.min; this.iniciarSessao('relogio', r.at); return; }
    this.painel = 'relogioNao';
    this.motivo = r && r.at ? t('clock_other', { a: hhmm(r.at), b: hhmm(alvoMin) }) : t('clock_none');
    render();
  },
  relogioConfiro() { const rel = LS.get('relogio'); LS.del('relogio'); if (rel) this.min = rel.min || this.min; this.iniciarSessao('relogio', null); },
  semDespertador() { LS.del('relogio'); this.iniciarSessao('sem', null); },

  /* fim do cochilo */
  quandoTermina() {
    const r = Sessao.r;
    if (!r || r.modo !== 'cochilo') return null;
    return r.extra.alvo || (r.ini + (r.extra.min || 20) * 60000);
  },
  finalizar(saida) {
    const r = Sessao.encerrar(saida || 'acordou');
    if (r) Pend.add({ id: r.id, tipo: 'cochilo', em: agora() });
    S.alarmeTocando = false;
    if (S.tela === 'cochiloSessao' || S.tela === 'alarme') S.tela = 'inicio';
    render();
  },
  cancelar() {
    const r = Sessao.r;
    const tipo = r && r.extra.alarme;
    const quando = this.quandoTermina();
    const texto = tipo === 'proprio' ? t('cancel_nap_alarm', { h: hhmm(quando) }) : tipo === 'relogio' ? t('cancel_nap_clock') : '';
    abrirFolha(`<p class="pergunta">${esc(t('cancel_nap_q'))}</p>${texto ? `<p class="sub centro">${esc(texto)}</p>` : ''}
      <button class="btn forte" data-a="cochiloCancelarSim">${esc(t('cancel_nap'))}</button>
      <button class="btn discreto" data-a="fecharFolha">${esc(t('back_word'))}</button>`);
  },
  async cancelarSim() {
    fecharFolha();
    if (Sessao.r && Sessao.r.extra.alarme === 'proprio') await Nat.safe('alarmeCancelar', { tipo: 'cochilo' });
    Sessao.encerrar('cancelou');
    S.tela = 'inicio';
    render();
  },
  /* confere, ao voltar para o app, se o cochilo já terminou */
  async conferirAoVoltar() {
    const r = Sessao.r;
    if (!r || r.modo !== 'cochilo' || r.fim) return;
    if (r.extra.alarme === 'proprio' && Nat.on) {
      const st = await Nat.safe('alarmeStatus');
      if (st && st.tocando) { S.alarmeTocando = true; S.tela = 'alarme'; render(); return; }
      if (st && !(st.cochilo && st.cochilo > agora())) { this.finalizar('acordou'); return; }
      return;
    }
    const fim = this.quandoTermina();
    if (fim && agora() >= fim) this.finalizar('acordou');
  },
  /* eventos do despertador nativo */
  evento(ev) {
    if (!ev) return;
    if (ev.type === 'tocando') { S.alarmeTocando = true; if (ev.tipo === 'cochilo' || S.tela !== 'diagnostico') { S.tela = 'alarme'; render(); } }
    else if (ev.type === 'desligado' || ev.type === 'parou') {
      S.alarmeTocando = false;
      if (ev.tipo === 'cochilo' && Sessao.r && Sessao.r.modo === 'cochilo') this.finalizar('acordou');
      else { if (S.tela === 'alarme') S.tela = 'inicio'; render(); }
    }
  },
};
