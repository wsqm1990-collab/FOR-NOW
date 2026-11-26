/* ---------- folha de confirmação e avisos curtos ---------- */
function abrirFolha(html) { const f = $('#folha'); f.innerHTML = `<div class="painel" role="dialog" aria-modal="true">${html}</div>`; f.hidden = false; }
function fecharFolha() { const f = $('#folha'); f.hidden = true; f.innerHTML = ''; }
let avisoTimer = null;
function aviso(txt) {
  const a = $('#aviso-rapido');
  a.textContent = txt;
  a.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { a.hidden = true; }, 3200);
}

/* ---------- aparência ---------- */
function ehNoite(d = new Date()) { const h = d.getHours(); return h >= 20 || h < 6; }
function aplicarTema() {
  const p = prefs(), r = document.documentElement;
  const dormindo = S.tela === 'sessao' && Sessao.modo === 'musica' && Sessao.r && Sessao.r.extra.dormir;
  const madrugada = ['madrugada', 'madDesperto', 'madLado', 'alarme'].includes(S.tela) || (S.tela === 'sessao' && Sessao.modo === 'madrugada') || dormindo;
  const escuro = madrugada || S.tela === 'cochiloSessao' || p.tema === 'escuro' || (p.tema === 'auto' && ehNoite());
  r.setAttribute('data-tema', escuro ? 'escuro' : 'claro');
  /* o céu desta hora, nos dias claros */
  const h = new Date().getHours();
  r.setAttribute('data-ceu', h >= 5 && h < 10 ? 'manha' : h >= 16 && h < 20 ? 'tarde' : 'dia');
  if (madrugada) r.setAttribute('data-noite', '1'); else r.removeAttribute('data-noite');
  r.style.setProperty('--fs', (18 * (Number(p.texto) || 1)).toFixed(1) + 'px');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(r).getPropertyValue('--ceu-1').trim() || '#D6E6EA');
  if (Nat.on) Nat.safe('setStyle', { style: escuro ? 'DARK' : 'LIGHT' }, 'SystemBars');
}

/* ---------- textos que o Android mostra fora do app: bloco, widget, atalhos ---------- */
function enviarRotulos() {
  if (!Nat.on) return;
  Nat.safe('setLabels', {
    tile: t('tile'), widget: rotuloPrincipal(), pico: rotuloPrincipal(), paz: t('peace'), cochilo: t('nap'), madrugada: t('night'),
    alarmTitle: t('time_to_wake'), alarmOff: t('turn_off'), alarmChannel: t('a_channel'), alarmTest: t('a_test'),
  });
}

/* ---------- prévia de som (Ajustes) ---------- */
let previa = null;
function ouvirSom(id) {
  try { if (previa) { previa.pause(); previa = null; } } catch { /* nada */ }
  if (!id || id === 'silencio') { if (Nat.on) Nat.safe('previaParar'); return; }
  id = somReal(id);
  if (Nat.on && id.startsWith('midia/')) { Nat.safe('previa', { nome: id, ms: 9000, vol: 0.7 }); return; }
  try {
    const a = new Audio('sons/' + id + '.ogg');
    a.volume = 0.6;
    a.play().catch(() => { /* nada */ });
    previa = a;
    setTimeout(() => { try { if (previa === a) { a.pause(); previa = null; } } catch { /* nada */ } }, 6000);
  } catch { /* nada */ }
}

/* ---------- voz ---------- */
async function testarVoz() {
  /* a voz gravada escolhida, se for o caso */
  const frase = 'Esta é a voz que vai te acompanhar aqui.';
  const clip = clipe(frase);
  if (clip) { await Nat.safe('previa', { nome: clip, ms: 6000, vol: 1 }); return; }
  const txt = t('voice_test_text');
  if (Nat.on) { await Nat.safe('falar', { texto: txt, rate: prefs().velocidade, lang: TTS_LANG[LANG] }); return; }
  try { if ('speechSynthesis' in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = TTS_LANG[LANG]; speechSynthesis.speak(u); } } catch { /* nada */ }
}

/* ---------- contato de confiança ---------- */
function salvarContato() {
  const nome = ($('#ct-nome') || {}).value || '';
  const tel = (($('#ct-tel') || {}).value || '').replace(/[^\d+]/g, '');
  if (!nome.trim() || tel.length < 3) { aviso(t('fill_contact')); return; }
  setPref('contato', { nome: nome.trim().slice(0, 40), tel: tel.slice(0, 20) });
  aviso(t('contact_saved'));
  S.tela = S.de || 'apoio';
  S.de = null;
  render();
}

/* ---------- apagar ---------- */
async function apagarTudo() {
  fecharFolha();
  if (Sessao.ativa) Sessao.encerrar('apagado');
  const lang = prefs().lang;
  for (const k of LS.chaves()) if (!MANTER_AO_APAGAR.includes(k)) LS.del(k);
  if (lang !== 'en') setPref('lang', lang); /* o idioma continua o mesmo */
  if (Nat.on) { await Nat.safe('alarmeCancelar', { tipo: 'cochilo' }); await Nat.safe('alarmeCancelar', { tipo: 'teste' }); await Nat.safe('alarmeLimparLog'); }
  S.tela = 'inicio';
  render();
  aviso(t('deleted_all'));
}

/* ---------- diagnóstico ---------- */
const Diag = {
  info: null, voz: null, log: [], teste: null,
  async carregar() {
    if (!Nat.on) { this.info = null; render(); return; }
    const [info, voz, log] = await Promise.all([Nat.safe('info'), Nat.safe('vozStatus', { lang: TTS_LANG[LANG] }), Nat.safe('alarmeLog')]);
    this.info = info; this.voz = voz; this.log = (log && log.itens) || [];
    await Coch.checar();
    render();
  },
  async testar() {
    if (!Nat.on) { aviso(t('test_only_app')); return; }
    const st = await Coch.checar();
    if (!Coch.pronto(st)) { aviso(t('allow_first')); S.tela = 'preparar'; render(); return; }
    const at = agora() + 60000;
    const r = await Nat.safe('alarmeAgendar', { at, tipo: 'teste' });
    if (!r || !r.ok) { aviso(t('test_refused')); return; }
    this.teste = at;
    aviso(t('test_set_toast', { h: hhmm(at) }));
    render();
  },
  /* o relatório fica em inglês, para quem for ajudar a corrigir */
  relatorio() {
    const st = Coch.st || {}, i = this.info || {}, v = this.voz || {};
    const yn = b => (b == null ? '?' : b ? 'yes' : 'no');
    const linhas = [
      `For Now ${versaoTexto()} · ${i.maker || '?'} ${i.model || ''} · Android SDK ${i.sdk || '?'} · language ${LANG}`,
      `Exact alarm allowed: ${yn(st.exato)} · Notifications: ${yn(st.notif)} · Full screen: ${yn(st.telaCheia)} · Battery unrestricted: ${yn(st.bateria)}`,
      `Alarm volume: ${st.volumeAlarme == null ? '?' : st.volumeAlarme + '/' + st.volumeAlarmeMax} · Do not disturb: ${st.naoPerturbe == null ? '?' : st.naoPerturbe}`,
      `Next phone alarm: ${st.proximo ? new Date(st.proximo).toISOString() : 'none'}`,
      `Voice for ${TTS_LANG[LANG]}: ${v.status || '?'} · engine: ${v.motor || '?'}`,
      'Alarm log:',
      ...(this.log.length ? this.log.slice(-12).map(x => '  ' + linhaLog(x, 'en')) : ['  none yet']),
    ];
    return linhas.join('\n');
  },
};
function linhaLog(x, forcar) {
  const antes = LANG;
  if (forcar) LANG = forcar;
  try {
    const hms = ts => new Date(ts).toLocaleTimeString(LOCALE[LANG]);
    let s = `${x.tipo === 'teste' ? t('log_test') : t('log_nap')} · ${t('log_expected', { t: hms(x.previsto) })}`;
    if (x.tocou) { const d = Math.round((x.tocou - x.previsto) / 1000); s += ' · ' + t('log_rang', { t: hms(x.tocou), d: (d >= 0 ? '+' : '') + d }); }
    else if (x.estado === 'expirado') s += ' · ' + t('log_expired');
    else if (x.estado === 'cancelado') s += ' · ' + t('log_cancelled');
    else if (x.previsto > agora()) s += ' · ' + t('log_waiting');
    else s += ' · ' + t('log_no_record');
    if (x.desligado) s += ' · ' + t('log_off', { t: hms(x.desligado) });
    return s;
  } finally { LANG = antes; }
}

/* ---------- Xiaomi / Poco ---------- */
const ehXiaomi = st => /xiaomi|poco|redmi/i.test((st && st.fabricante) || '');
