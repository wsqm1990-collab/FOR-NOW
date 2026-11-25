/* ---------- cada toque no app ---------- */
const ACT = {
  /* início */
  pico: () => Sessao.pico(),
  pazAbrir: () => { S.tela = 'paz'; render(); },
  paz: el => Sessao.paz(el.dataset.v),
  cochilo: () => Coch.abrir(),
  voltarCochilo: () => { S.tela = 'cochiloSessao'; render(); },
  madrugada: () => abrirMadrugada(),
  apoio: () => { S.tela = 'apoio'; render(); },
  historico: () => { S.tela = 'historico'; render(); },
  revisao: () => { S.tela = 'revisao'; render(); },
  ajustes: () => { S.tela = 'ajustes'; render(); carregarVoz(); },
  voltar: () => voltar(),
  baixarApk: () => abrirUrl(typeof S.precisaApk === 'string' ? S.precisaApk : `https://github.com/${REPO}/releases/latest`),

  /* sessão */
  sPausar: () => { Guia.pausar(); render(); },
  sContinuar: () => { Guia.continuar(); render(); },
  sTrocar: () => Sessao.trocar(),
  sSair: () => Sessao.sair(),
  sVoz: () => {
    const g = Guia.g;
    if (!g) return;
    const v = !g.voz, m = Sessao.modo;
    Guia.setVoz(v);
    if (m === 'cochilo') setPref('cochiloVoz', v); else if (m) setPref('voz.' + m, v);
    render();
  },
  sSom: () => {
    const g = Guia.g;
    if (!g) return;
    const ids = SONS.map(s => s[0]);
    const prox = ids[(ids.indexOf(g.som) + 1) % ids.length];
    Guia.setSom(prox);
    if (Sessao.modo) setPref('som.' + Sessao.modo, prox);
    render();
  },
  escolher: el => Sessao.escolher(el.dataset.v),
  irFim: () => Sessao.irParaFim(),
  continuarDia: () => Sessao.continuarDia(),
  maisMomento: () => Sessao.maisUmMomento(),
  falar: () => Sessao.falar(),
  responder: el => Sessao.responder(el.dataset.v),

  /* cochilo */
  cochiloMenos: () => Coch.ajustar(-5),
  cochiloMais: () => Coch.ajustar(5),
  cochiloComecar: () => Coch.comecar(),
  cochiloAutorizar: () => Nat.safe('alarmePermitir'),
  cochiloNotif: async () => {
    const r = await Nat.safe('askNotif');
    if (!r || !r.granted) Nat.safe('openNotifSettings');
    setTimeout(() => Coch.checar(), 700);
  },
  cochiloRelogio: () => Coch.relogioAbrir(),
  cochiloRelogioConferir: () => Coch.relogioConferir(),
  cochiloRelogioConfiro: () => Coch.relogioConfiro(),
  cochiloSem: () => Coch.semDespertador(),
  cochiloCancelar: () => Coch.cancelar(),
  cochiloCancelarSim: () => Coch.cancelarSim(),
  cochiloTerminar: () => Coch.finalizar('acordou'),
  ajCochiloVoz: el => { setPref('cochiloVoz', el.dataset.v === 'true'); render(); },
  alarmeDesligar: () => {
    Nat.safe('alarmeDesligar');
    S.alarmeTocando = false;
    if (Sessao.r && Sessao.modo === 'cochilo') Coch.finalizar('acordou');
    else { S.tela = 'inicio'; render(); }
  },

  /* madrugada */
  madLado: () => madrugadaLado(),
  madSoltar: () => Sessao.madrugadaSoltar(),
  madDesperto: () => { if (Sessao.r) { Sessao.r.extra.via = 'desperto'; Hist.salvar(Sessao.r); } S.tela = 'madDesperto'; render(); },
  madEntendi: () => madrugadaFechar('levantar'),
  madEncerrar: () => madrugadaFechar('fim'),
  madVoltar: () => { Sessao.encerrar('saiu'); S.tela = 'inicio'; render(); },

  /* apoio de uma pessoa: o app só abre o discador ou a mensagem, nunca liga sozinho */
  ligar: el => { if (Nat.on) Nat.safe('discar', { numero: el.dataset.v }); else location.href = 'tel:' + el.dataset.v; },
  contatoLigar: () => { const c = prefs().contato; if (c) ACT.ligar({ dataset: { v: c.tel } }); },
  contatoMensagem: () => { const c = prefs().contato; if (c) Nat.safe('mensagem', { numero: c.tel }); },
  link: el => abrirUrl(el.dataset.v),
  contato: () => { S.de = S.tela; S.tela = 'contato'; render(); },
  contatoSalvar: () => salvarContato(),
  contatoApagar: () => { setPref('contato', null); S.tela = S.de || 'apoio'; S.de = null; render(); },

  /* sugestões e perguntas que esperaram você voltar */
  sugSim: () => {
    const s = S.sug;
    if (!s) return;
    if (s.tipo === 'ocultar') { Aprender.ocultar(s.modo, s.tec); aviso(t('saved_hidden')); }
    else { Aprender.fixar(s.modo, s.tec); aviso(t('saved_first', { m: nomeModo(s.modo), n: nomeTecnica(s.tec) })); }
    Aprender.dispensar(s);
    render();
  },
  sugNao: () => { if (S.sug) Aprender.dispensar(S.sug); render(); },
  pendResp: el => { const r = Hist.pegar(el.dataset.id); if (r) { r.resp = el.dataset.v; Hist.salvar(r); } Pend.tirar(el.dataset.id); render(); },
  pendFechar: el => { Pend.tirar(el.dataset.id); render(); },

  /* histórico */
  histFiltro: el => { S.filtro = el.dataset.v; render(); },
  histApagar: el => abrirFolha(`<p class="pergunta">${esc(t('delete_entry_q'))}</p>${botao('histApagarSim', t('delete'), 'forte', `data-id="${esc(el.dataset.id)}"`)}${botao('fecharFolha', t('back_word'), 'discreto')}`),
  histApagarSim: el => {
    const id = el.dataset.id;
    if (Sessao.r && Sessao.r.id === id) {
      if (Sessao.modo === 'cochilo' && Sessao.r.extra.alarme === 'proprio') Nat.safe('alarmeCancelar', { tipo: 'cochilo' });
      Sessao.encerrar('apagado');
    }
    Hist.apagar(id);
    Pend.tirar(id);
    fecharFolha();
    render();
  },
  histLimpar: () => abrirFolha(`<p class="pergunta">${esc(t('delete_history_q'))}</p><p class="sub centro">${esc(t('delete_history_note'))}</p>${botao('histLimparSim', t('delete'), 'forte')}${botao('fecharFolha', t('back_word'), 'discreto')}`),
  histLimparSim: () => {
    if (Sessao.ativa) {
      if (Sessao.modo === 'cochilo' && Sessao.r.extra.alarme === 'proprio') Nat.safe('alarmeCancelar', { tipo: 'cochilo' });
      Sessao.encerrar('apagado');
    }
    Hist.limpar();
    LS.del('pend');
    LS.del('sugVistas');
    fecharFolha();
    render();
  },
  fecharFolha: () => fecharFolha(),

  /* revisão */
  revDecidir: el => { const rev = LS.get('rev', {}) || {}; rev[el.dataset.m] = { v: el.dataset.v, em: agora() }; LS.set('rev', rev); render(); },
  revSemCelular: el => { const a = LS.get('semCelular', []) || []; a.push({ v: el.dataset.v, em: agora() }); LS.set('semCelular', a.slice(-60)); render(); },

  /* ajustes */
  ajLang: el => { setPref('lang', el.dataset.v); setIdioma(el.dataset.v); enviarRotulos(); render(); carregarVoz(); },
  ajRotulo: el => { setPref('rotulo', el.dataset.v); enviarRotulos(); render(); },
  ajVoz: el => { setPref('voz.' + el.dataset.m, el.dataset.v === 'true'); render(); },
  ajVel: el => { setPref('velocidade', Number(el.dataset.v)); render(); },
  ajTestarVoz: () => testarVoz(),
  ajSom: el => { setPref('som.' + el.dataset.m, el.dataset.v); ouvirSom(el.dataset.v); render(); },
  ajOuvir: el => ouvirSom(el.dataset.v),
  ajTema: el => { setPref('tema', el.dataset.v); render(); },
  ajTexto: el => { setPref('texto', Number(el.dataset.v)); render(); },
  ajAtualizar: el => { setPref('atualizar', el.dataset.v === 'true'); render(); },
  atualizarAgora: () => checarAgora(),
  tecnicas: () => { S.tela = 'tecnicas'; render(); },
  ficha: el => { S.ficha = el.dataset.v; S.de = S.tela; S.tela = 'ficha'; render(); },
  tecOcultar: el => { Aprender.ocultar(el.dataset.m, el.dataset.v); render(); },
  tecRestaurar: el => { Aprender.restaurar(el.dataset.m, el.dataset.v); render(); },
  tecFixar: el => { Aprender.fixar(el.dataset.m, el.dataset.v); render(); },
  tecSubir: el => { Aprender.mover(el.dataset.m, el.dataset.v, -1); render(); },
  preparar: () => { S.de = S.tela; S.tela = 'preparar'; render(); Coch.checar(); },
  prepOk: () => { LS.set('prep_ok', agora()); voltar(); },
  abrirTelaCheia: () => Nat.safe('abrirTelaCheia'),
  abrirAppAjustes: () => Nat.safe('openAppSettings'),
  abrirXiaomi: el => Nat.safe('abrirXiaomi', { tipo: el.dataset.v }),
  diagnostico: () => { S.tela = 'diagnostico'; render(); Diag.carregar(); },
  diagTeste: () => Diag.testar(),
  diagCompartilhar: () => Nat.safe('compartilharTexto', { texto: Diag.relatorio(), titulo: 'For Now · report' }),
  acesso: () => { S.tela = 'acesso'; render(); },
  privacidade: () => { S.tela = 'privacidade'; render(); },
  apagarTudo: () => abrirFolha(`<p class="pergunta">${esc(t('delete_all_q'))}</p><p class="sub centro">${esc(t('delete_all_note'))}</p>${botao('apagarTudoSim', t('delete_all'), 'forte')}${botao('fecharFolha', t('back_word'), 'discreto')}`),
  apagarTudoSim: () => apagarTudo(),
};

function abrirUrl(url) { if (Nat.on) Nat.safe('abrirLink', { url }); else window.open(url, '_blank'); }
async function carregarVoz() {
  if (!Nat.on) return;
  Diag.voz = await Nat.safe('vozStatus', { lang: TTS_LANG[LANG] });
  if (S.tela === 'ajustes') render();
}

/* ---------- voltar (botão do app e botão do Android) ---------- */
function voltar() {
  if (!$('#folha').hidden) { fecharFolha(); return; }
  const tl = S.tela;
  if (tl === 'sessao') { Sessao.sair(); return; }
  if (tl === 'cochiloSessao') { S.tela = 'inicio'; render(); return; }      /* o cochilo continua */
  if (tl === 'alarme' || tl === 'madLado') return;
  if (tl === 'madrugada' || tl === 'madDesperto') { ACT.madVoltar(); return; }
  if (tl === 'inicio') { Nat.safe('minimizar'); return; }
  let dest = PAIS[tl] || 'inicio';
  if (['ficha', 'preparar', 'contato'].includes(tl) && S.de && S.de !== tl) { dest = S.de; S.de = null; }
  S.tela = dest;
  render();
  if (dest === 'cochilo') Coch.checar();
}

/* ---------- madrugada ---------- */
function abrirMadrugada() {
  Sessao.novo('madrugada', { via: null });
  S.tela = 'madrugada';
  render();
  if (Nat.on) Nat.safe('brilho', { nivel: 0.05 });
}
function madrugadaLado() {
  if (Sessao.r) Sessao.r.extra.via = 'lado';
  const r = Sessao.encerrar('celular_de_lado');
  if (r) Pend.add({ id: r.id, tipo: 'madrugada', em: agora() });
  S.tela = 'madLado';
  render();
  if (Nat.on) Nat.safe('brilho', { nivel: 0.05 });
  setTimeout(() => { if (S.tela === 'madLado') { Nat.safe('minimizar'); S.tela = 'inicio'; } }, 1500);
}
function madrugadaFechar(saida) {
  const r = Sessao.encerrar(saida);
  if (r) Pend.add({ id: r.id, tipo: 'madrugada', em: agora() });
  S.tela = 'inicio';
  if (Nat.on) Nat.safe('minimizar');
  render();
}

/* ---------- abrir direto (widget, bloco nas Configurações rápidas, atalhos, alarme) ---------- */
function executarAcao(acao) {
  if (!acao) return;
  if (acao === 'pico') { if (!(Sessao.ativa && Sessao.modo === 'pico')) Sessao.pico(); else { S.tela = 'sessao'; render(); } }
  else if (acao === 'paz') { if (!Sessao.ativa) { S.tela = 'paz'; render(); } }
  else if (acao === 'cochilo') { if (Sessao.ativa && Sessao.modo === 'cochilo') { S.tela = 'cochiloSessao'; render(); } else if (!Sessao.ativa) Coch.abrir(); }
  else if (acao === 'madrugada') { if (!Sessao.ativa) abrirMadrugada(); }
  else if (acao === 'alarme') { S.alarmeTocando = true; S.tela = 'alarme'; render(); }
}

/* ---------- primeira vez ---------- */
async function primeiraVez() {
  if (LS.get('iniciado')) return;
  LS.set('iniciado', agora());
  const info = await Nat.safe('info');
  /* com o TalkBack ligado, a voz do app falaria por cima do leitor de tela */
  if (info && info.talkback) { for (const m of ['pico', 'paz', 'cochilo', 'madrugada']) setPref('voz.' + m, false); }
}

/* ---------- a cada 15 segundos ---------- */
function tique() {
  if (S.tela === 'cochilo') { const el = $('#cochilo-hora'); if (el) el.innerHTML = t('wake_at', { h: hhmm(Coch.alvo()) }); }
  if (Sessao.ativa && Sessao.modo === 'cochilo' && Sessao.r.extra.alarme !== 'proprio') Coch.conferirAoVoltar();
}

function onClick(e) {
  const el = e.target.closest('[data-a]');
  if (!el) { if (e.target && e.target.id === 'folha') fecharFolha(); return; }
  const fn = ACT[el.dataset.a];
  if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  try {
    const r = fn(el, e);
    if (r && typeof r.catch === 'function') r.catch(err => { try { console.warn('ação ' + el.dataset.a, err); } catch { /* nada */ } });
  } catch (err) { console.error(err); }
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  const escuroDeNoite = ['madrugada', 'madDesperto', 'madLado'].includes(S.tela) || (S.tela === 'sessao' && Sessao.modo === 'madrugada');
  if (Nat.on && !escuroDeNoite) Nat.safe('brilho', { nivel: -1 });
  if (S.tela === 'madLado') S.tela = 'inicio';
  if (S.tela === 'cochilo' && Coch.painel === 'relogioVolta') { await Coch.relogioConferir(); return; }
  if (Sessao.ativa && Sessao.modo === 'cochilo') await Coch.conferirAoVoltar();
  if (['cochilo', 'preparar'].includes(S.tela)) await Coch.checar();
  if (S.tela === 'diagnostico') await Diag.carregar();
  if (Guia.g) Guia.tick();
  render();
});

async function iniciar() {
  setIdioma(prefs().lang);
  Guia.aoMudar = () => atualizarFrase();
  Guia.aoTerminar = () => Sessao.guiaTerminou();
  document.addEventListener('click', onClick);
  render();
  Nat.listen('guia', ev => Guia.evento(ev));
  Nat.listen('alarme', ev => Coch.evento(ev));
  Nat.listen('launch', ev => executarAcao(ev && ev.acao));
  Nat.listen('backButton', () => voltar(), 'App');
  const restaurou = await Sessao.restaurar();
  let acao = null;
  if (Nat.on) { const r = await Nat.safe('launchAction'); acao = r && r.acao; }
  else acao = (location.hash || '').replace('#', '') || null;
  if (acao) executarAcao(acao);
  else if (restaurou) render();
  if (Sessao.ativa && Sessao.modo === 'cochilo') await Coch.conferirAoVoltar();
  if (Nat.on) { const st = await Nat.safe('alarmeStatus'); if (st && st.tocando && S.tela !== 'alarme') { S.alarmeTocando = true; S.tela = 'alarme'; render(); } }
  window.__fnOk = true;
  confirmarVersao();
  if (Nat.on) { enviarRotulos(); primeiraVez(); }
  setTimeout(() => checarAtualizacao(false), 10000);
  setInterval(tique, 15000);
}
iniciar();
