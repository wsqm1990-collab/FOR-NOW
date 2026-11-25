/* ---------- telas ---------- */
const S = { tela: 'inicio', de: null, ficha: null, filtro: 'todos', alarmeTocando: false, precisaApk: false, sug: null };

const PAIS = {
  paz: 'inicio', cochilo: 'inicio', apoio: 'inicio', historico: 'inicio', revisao: 'inicio', ajustes: 'inicio',
  tecnicas: 'ajustes', diagnostico: 'ajustes', privacidade: 'ajustes', acesso: 'ajustes', preparar: 'ajustes',
  contato: 'apoio', ficha: 'tecnicas',
};
const voltarBtn = () => `<button class="icone" data-a="voltar">${esc(t('back'))}</button>`;
const topo = (titulo, extra = '') => `<div class="topo">${voltarBtn()}<span class="marca">${esc(titulo)}</span>${extra || '<span style="min-width:3rem"></span>'}</div>`;
const chips = (acao, atual, lista, extra = '') => `<div class="grupo">${lista.map(([v, n]) => `<button class="chip" data-a="${acao}" data-v="${esc(v)}" ${extra} aria-pressed="${String(v) === String(atual)}">${esc(n)}</button>`).join('')}</div>`;
const botao = (acao, rotulo, cls = '', extra = '') => `<button class="btn ${cls}" data-a="${acao}" ${extra}>${esc(rotulo)}</button>`;

function render() {
  aplicarTema();
  const app = $('#app');
  let html;
  switch (S.tela) {
    case 'sessao': html = viewSessao(); break;
    case 'paz': html = viewPaz(); break;
    case 'cochilo': html = viewCochilo(); break;
    case 'cochiloSessao': html = viewCochiloSessao(); break;
    case 'alarme': html = viewAlarme(); break;
    case 'madrugada': html = viewMadrugada(); break;
    case 'madDesperto': html = viewMadDesperto(); break;
    case 'madLado': html = `<section class="sessao"><div class="instr-caixa"><p class="instr calado">${esc(t('good_night'))}</p></div></section>`; break;
    case 'apoio': html = viewApoio(); break;
    case 'contato': html = viewContato(); break;
    case 'historico': html = viewHistorico(); break;
    case 'revisao': html = viewRevisao(); break;
    case 'ajustes': html = viewAjustes(); break;
    case 'tecnicas': html = viewTecnicas(); break;
    case 'ficha': html = viewFicha(); break;
    case 'preparar': html = viewPreparar(); break;
    case 'diagnostico': html = viewDiagnostico(); break;
    case 'privacidade': html = viewPrivacidade(); break;
    case 'acesso': html = viewAcesso(); break;
    default: S.tela = 'inicio'; html = viewInicio();
  }
  app.innerHTML = html;
}

/* ----- início ----- */
function viewInicio() {
  const cartoes = [];
  if (Sessao.ativa && Sessao.modo === 'cochilo') {
    const fim = Coch.quandoTermina();
    cartoes.push(`<div class="cartao suave"><p><b>${esc(t('nap_running'))}</b>${fim ? esc(t('until', { h: hhmm(fim) })) : ''}</p>${botao('voltarCochilo', t('back_to_nap'))}</div>`);
  }
  if (S.precisaApk) cartoes.push(`<div class="cartao"><p>${esc(t('need_apk'))}</p>${botao('baixarApk', t('get_apk'))}</div>`);
  const pend = pendenteParaMostrar();
  S.sug = null;
  if (pend) {
    cartoes.push(`<div class="cartao"><div class="linha" style="align-items:flex-start"><p style="flex:1"><b>${esc(perguntaDe(pend.tipo))}</b></p><button class="icone" data-a="pendFechar" data-id="${pend.id}" aria-label="${esc(t('not_now'))}">✕</button></div>
      <div class="grupo">${opcoesDe(pend.tipo).map(([v, n]) => `<button class="chip" data-a="pendResp" data-id="${pend.id}" data-v="${v}">${esc(n)}</button>`).join('')}</div></div>`);
  } else {
    const sug = Aprender.sugestao();
    if (sug) { S.sug = sug; cartoes.push(viewSugestao(sug)); }
  }
  const item = (acao, titulo, det, cls = '') => `<button class="btn esq ${cls}" data-a="${acao}"><span><span>${esc(titulo)}</span>${det ? `<span class="det">${esc(det)}</span>` : ''}</span></button>`;
  return `<section class="tela">
    <div class="topo"><span class="marca">For Now</span><button class="icone" data-a="ajustes">${esc(t('settings'))}</button></div>
    <button class="btn pico" data-a="pico">${esc(rotuloPrincipal())}</button>
    ${cartoes.join('')}
    <div class="pilha">
      ${item('pazAbrir', t('peace'), t('peace_det'))}
      ${item('cochilo', t('nap'), t('nap_det'))}
      ${item('madrugada', t('night'), t('night_det'))}
      ${item('apoio', t('support'), '', 'suave')}
    </div>
    <div class="rodape-links">${botao('historico', t('history'), 'discreto', 'style="width:auto"')}${botao('revisao', t('review'), 'discreto', 'style="width:auto"')}</div>
  </section>`;
}
function viewSugestao(sug) {
  const s = sug.s, m = nomeModo(sug.modo), n = nomeTecnica(sug.tec);
  if (sug.tipo === 'ocultar') {
    return `<div class="cartao"><p>${esc(t('sug_hide', { m, n, t: s.trocas, u: s.usos }))}</p><p class="pequeno">${esc(t('sug_hide_note'))}</p>
      <div class="linha">${botao('sugSim', t('sug_hide_yes'))}${botao('sugNao', t('keep'), 'discreto')}</div></div>`;
  }
  return `<div class="cartao"><p>${esc(t('sug_pin', { m, n, s: s.sim, a: s.aval }))}</p><p class="pequeno">${esc(t('sug_pin_mixed', { meio: s.meio, nao: s.nao, sem: s.sem }))}</p>
    <div class="linha">${botao('sugSim', t('sug_pin_yes'))}${botao('sugNao', t('not_now'), 'discreto')}</div></div>`;
}
function pendenteParaMostrar() {
  const hr = new Date().getHours();
  for (const p of Pend.todas()) {
    if (p.tipo === 'cochilo') return p;
    if (p.tipo === 'madrugada' && hr >= 7 && hr < 20 && agora() - p.em > 3 * 3600000) return p;
  }
  return null;
}

/* ----- sessão (pico, paz, madrugada) ----- */
function viewSessao() {
  const m = Sessao.modo, f = Sessao.fase;
  if (!Sessao.r) { S.tela = 'inicio'; return viewInicio(); }
  const titulo = m === 'pico' ? t('title_pico') : m === 'paz' ? t('peace') : '';
  const cab = `<div class="topo"><span class="marca">${esc(titulo)}</span></div>`;
  if (f === 'escolha') {
    return `<section class="sessao">${cab}
      <div class="instr-caixa"><div class="centro"><p class="pergunta">${esc(t('how_continue'))}</p><p class="sub">${esc(t('or_stay'))}</p></div></div>
      <div class="escolhas">${Sessao.ordem('pico').map(x => botao('escolher', tr(TEC[x].escolha), '', `data-v="${x}"`)).join('')}
      ${botao('irFim', t('end'), 'discreto')}</div></section>`;
  }
  if (f === 'fim') {
    return `<section class="sessao">${cab}<div class="instr-caixa"><p class="pergunta">${esc(t('what_now'))}</p></div>
      <div class="escolhas">${botao('continuarDia', t('go_on_day'), 'forte')}${botao('maisMomento', t('one_more'))}${botao('falar', t('talk_someone'))}</div></section>`;
  }
  if (f === 'resposta') {
    return `<section class="sessao">${cab}<div class="instr-caixa"><p class="pergunta">${esc(perguntaDe(m))}</p></div>
      <div class="escolhas">${opcoesDe(m).map(([v, n]) => botao('responder', n, '', `data-v="${v}"`)).join('')}
      ${botao('responder', t('skip'), 'discreto', 'data-v="pular"')}
      <p class="pequeno centro">${esc(t('optional_answer'))}</p></div></section>`;
  }
  if (f === 'quieto') {
    return `<section class="sessao"><div class="instr-caixa"><p class="instr calado">…</p></div>
      <div class="barra">${botao('madEncerrar', t('end'), 'discreto')}</div></section>`;
  }
  const g = Guia.g, fr = Guia.frase(g), p = prefs();
  const pausado = !!(g && g.pausadoEm);
  const tec = TEC[Sessao.tec] || {};
  const mostraSom = m === 'paz' || tec.usaSom;
  const voz = g ? g.voz : p.voz[m] !== false;
  const somAtual = g ? g.som : Sessao.somPara(m, Sessao.tec);
  const podeTrocar = m === 'pico' || m === 'paz';
  return `<section class="sessao">
    <div class="topo"><span class="marca">${esc(titulo)}</span><div class="grupo" style="justify-content:flex-end">
      ${mostraSom ? `<button class="chip" data-a="sSom" aria-label="${esc(t('sound_aria', { s: nomeSom(somAtual) }))}">${esc(t('sound_x', { s: nomeSom(somAtual) }))}</button>` : ''}
      <button class="chip" data-a="sVoz" aria-pressed="${voz}">${esc(voz ? t('voice_on') : t('text_only'))}</button></div></div>
    <div class="instr-caixa"><p id="instr" class="instr${fr.calado ? ' calado' : ''}" aria-live="polite">${esc(fr.texto)}</p></div>
    <p class="estado" id="estado">${pausado ? esc(t('paused')) : ''}</p>
    <div class="barra">
      ${pausado ? botao('sContinuar', t('resume')) : botao('sPausar', t('pause'))}
      ${podeTrocar ? botao('sTrocar', t('switch')) : ''}
      ${botao('sSair', t('leave'))}
    </div></section>`;
}
/* troca só a frase, sem refazer a tela inteira */
function atualizarFrase() {
  const el = $('#instr');
  if (!el) { if (S.tela === 'sessao' || S.tela === 'cochiloSessao') render(); return; }
  const fr = Guia.frase();
  if (el.textContent === fr.texto) { el.classList.toggle('calado', fr.calado); return; }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fr.texto; el.classList.toggle('calado', fr.calado); return; }
  el.classList.add('sai');
  setTimeout(() => { el.textContent = fr.texto; el.classList.toggle('calado', fr.calado); el.classList.remove('sai'); }, 350);
}
function atualizarEstadoSessao() { if (S.tela === 'sessao' || S.tela === 'cochiloSessao') render(); }

/* ----- paz ----- */
function viewPaz() {
  const p = prefs();
  return `<section class="tela">${topo(t('peace'))}
    <p class="sub">${esc(t('peace_intro'))}</p>
    <div class="pilha">${Sessao.ordem('paz').map(x => `<button class="btn esq" data-a="paz" data-v="${x}"><span><span>${esc(tr(TEC[x].escolha))}</span><span class="det">${esc(tr(TEC[x].desc || ''))}</span></span></button>`).join('')}</div>
    <div class="secao"><h2>${esc(t('sound'))}</h2>${chips('ajSom', p.som.paz, listaSons(), 'data-m="paz"')}</div>
    <div class="secao"><h2>${esc(t('voice'))}</h2>${chips('ajVoz', String(p.voz.paz !== false), [['true', t('voice_on')], ['false', t('text_only')]], 'data-m="paz"')}</div>
  </section>`;
}

/* ----- cochilo ----- */
function viewCochilo() {
  const p = prefs(), st = Coch.st, alvo = Coch.alvo();
  let painel = '';
  if (Coch.painel === 'relogioVolta') {
    painel = `<div class="cartao"><p><b>${esc(t('clock_come_back'))}</b></p><p class="sub">${esc(t('clock_check_explain'))}</p>
      ${botao('cochiloRelogioConferir', t('check_now'), 'forte')}${botao('cochiloSem', t('rest_no_alarm'), 'discreto')}</div>`;
  } else if (Coch.painel === 'relogioNao') {
    painel = `<div class="cartao"><p><b>${esc(t('clock_not_confirmed'))}</b></p><p>${esc(Coch.motivo)}</p><p class="sub">${esc(t('check_clock_before'))}</p>
      ${botao('cochiloRelogioConfiro', t('clock_ok_manual'))}${botao('cochiloRelogio', t('open_clock_again'))}${botao('cochiloSem', t('rest_no_alarm'), 'discreto')}</div>`;
  } else if (Coch.painel === 'falhou' || (st && !Coch.pronto()) || !Nat.on) {
    painel = `<div class="cartao"><p><b>${esc(t('not_guaranteed'))}</b></p>
      ${Coch.motivo ? `<p>${esc(Coch.motivo)}</p>` : ''}${Coch.problemas().map(x => `<p>${esc(x)}</p>`).join('')}
      ${st && !st.exato ? botao('cochiloAutorizar', t('allow_alarms'), 'forte') : ''}
      ${st && !st.notif ? botao('cochiloNotif', t('allow_notif'), 'forte') : ''}
      ${Nat.on ? botao('cochiloRelogio', t('use_clock')) : ''}
      ${botao('cochiloSem', t('rest_no_alarm'))}</div>`;
  } else if (!st) {
    painel = `<p class="sub centro">${esc(t('checking_alarm'))}</p>`;
  } else {
    const av = Coch.avisos();
    painel = `${botao('cochiloComecar', t('start'), 'forte')}
      ${av.length ? `<div class="cartao">${av.map(x => `<p class="pequeno aviso">${esc(x)}</p>`).join('')}${botao('preparar', t('prep_alarm'), 'discreto')}</div>` : ''}`;
  }
  return `<section class="tela">${topo(t('nap'))}
    <p class="grande">${Coch.min} min</p>
    <p class="centro sub" id="cochilo-hora">${t('wake_at', { h: hhmm(alvo) })}</p>
    <div class="linha"><button class="btn" data-a="cochiloMenos" aria-label="${esc(t('less5'))}">− 5 min</button><button class="btn" data-a="cochiloMais" aria-label="${esc(t('more5'))}">+ 5 min</button></div>
    ${painel}
    <div class="secao"><h2>${esc(t('sound_while_resting'))}</h2>${chips('ajSom', p.som.cochilo, listaSons(), 'data-m="cochilo"')}</div>
    <div class="secao"><h2>${esc(t('short_voice_start'))}</h2>${chips('ajCochiloVoz', String(!!p.cochiloVoz), [['true', t('with_voice')], ['false', t('no_voice')]])}</div>
    <div class="rodape-links">${botao('ficha', t('why'), 'discreto', 'style="width:auto" data-v="cochilo"')}${botao('preparar', t('prep_alarm'), 'discreto', 'style="width:auto"')}</div>
  </section>`;
}
function viewCochiloSessao() {
  const r = Sessao.r;
  if (!r || r.modo !== 'cochilo') { S.tela = 'inicio'; return viewInicio(); }
  const tipo = r.extra.alarme, fim = Coch.quandoTermina();
  const rot = tipo === 'proprio' ? t('alarm_confirmed') : tipo === 'relogio' ? t('alarm_in_clock') : t('no_alarm');
  const hora = tipo === 'proprio' ? hhmm(fim) : (tipo === 'relogio' && r.extra.alvo ? hhmm(r.extra.alvo) : '');
  const g = Guia.g, fr = Guia.frase(g);
  return `<section class="sessao">
    <div class="topo"><span class="marca">${esc(t('nap'))}</span>${g ? `<button class="chip" data-a="sVoz" aria-pressed="${g.voz}">${esc(g.voz ? t('voice_on') : t('text_only'))}</button>` : ''}</div>
    <div class="instr-caixa"><div class="centro pilha">
      <p class="sub">${esc(rot)}</p>${hora ? `<p class="grande">${hora}</p>` : ''}
      <p id="instr" class="instr${fr.calado ? ' calado' : ''}" style="font-size:1.25rem" aria-live="polite">${esc(g ? fr.texto : t('phone_aside'))}</p>
    </div></div>
    <div class="barra">${tipo !== 'proprio' ? botao('cochiloTerminar', t('woke_up')) : ''}${botao('cochiloCancelar', t('cancel_nap_btn'))}</div></section>`;
}
function viewAlarme() {
  return `<section class="sessao"><div class="instr-caixa"><div class="centro pilha"><p class="sub">${esc(t('time_to_wake'))}</p><p class="grande">${hhmm(agora())}</p></div></div>
    <button class="btn forte" style="min-height:6rem;font-size:1.45rem" data-a="alarmeDesligar">${esc(t('turn_off'))}</button></section>`;
}

/* ----- madrugada ----- */
function viewMadrugada() {
  return `<section class="tela"><div class="topo"><span class="marca"></span></div>
    <p class="titulo">${esc(t('night'))}</p>
    <div class="pilha">${botao('madLado', t('put_phone_down'), 'forte')}${botao('madSoltar', t('help_release'))}${botao('madDesperto', t('wide_awake'))}</div>
    <div class="rodape-links">${botao('madVoltar', t('back_word'), 'discreto', 'style="width:auto"')}</div></section>`;
}
function viewMadDesperto() {
  return `<section class="tela"><div class="topo"><span class="marca"></span></div>
    <div class="pilha" style="margin-top:2rem">${MADRUGADA_DESPERTO.map(x => `<p class="instr" style="font-size:1.35rem;text-align:left">${esc(tr(x))}</p>`).join('')}</div>
    <div style="margin-top:auto">${botao('madEntendi', t('got_it'), 'forte')}</div></section>`;
}

/* ----- apoio de uma pessoa ----- */
function viewApoio() {
  const c = prefs().contato;
  const link = k => `<a href="#" data-a="link" data-v="${FONTES[k].url}">${esc(tr(FONTES[k].nome))}</a>`;
  return `<section class="tela">${topo(t('talk_title'))}
    <p class="sub">${esc(t('nothing_dialed'))}</p>
    <div class="cartao"><p><b>${esc(t('trusted'))}</b></p>
      ${c ? `<p>${esc(c.nome)}</p>${botao('contatoLigar', t('call_x', { n: c.nome }), 'forte')}${botao('contatoMensagem', t('message'))}${botao('contato', t('change_contact'), 'discreto')}`
    : `<p class="sub">${esc(t('pick_someone'))}</p>${botao('contato', t('choose_contact'))}`}</div>
    <div class="cartao"><p><b>${esc(t('cvv_title'))}</b></p><p class="sub">${esc(t('cvv_text'))}</p>
      ${botao('ligar', t('call_188'), '', 'data-v="188"')}${botao('link', t('cvv_chat'), 'discreto', 'data-v="https://cvv.org.br/chat/"')}</div>
    <div class="cartao"><p><b>${esc(t('need_care'))}</b></p><p class="sub">${esc(t('need_care_text'))}</p>
      ${botao('ligar', t('call_192'), 'alerta', 'data-v="192"')}</div>
    <div class="cartao suave"><p><b>${esc(t('ubs_title'))}</b></p><p>${esc(t('ubs_text'))}</p>
      <p class="pequeno fonte">${esc(t('sources'))}: ${link('samu')} · ${link('ubs')}</p></div>
  </section>`;
}
function viewContato() {
  const c = prefs().contato || {};
  return `<section class="tela">${topo(t('contact_title'))}
    <label>${esc(t('name'))}<input type="text" id="ct-nome" autocomplete="off" value="${esc(c.nome || '')}"></label>
    <label>${esc(t('phone'))}<input type="tel" id="ct-tel" autocomplete="off" value="${esc(c.tel || '')}"></label>
    ${botao('contatoSalvar', t('save'), 'forte')}${c.nome ? botao('contatoApagar', t('delete_contact'), 'discreto') : ''}
    <p class="pequeno">${esc(t('contact_note'))}</p></section>`;
}

/* ----- histórico ----- */
const SAIDAS = {
  continuar: ['Went on with the day', 'Continuou o dia', 'Siguió con el día'], falar: ['Went to talk to someone', 'Foi falar com alguém', 'Fue a hablar con alguien'],
  saiu: ['Left before the end', 'Saiu antes do fim', 'Salió antes del final'], notificacao: ['Ended from the notification', 'Encerrado pela notificação', 'Terminado desde la notificación'],
  interrompida: ['Interrupted', 'Interrompido', 'Interrumpido'], acordou: ['Woke up', 'Acordou', 'Despertó'], cancelou: ['Nap cancelled', 'Cochilo cancelado', 'Siesta cancelada'],
  celular_de_lado: ['Put the phone down', 'Deixou o celular de lado', 'Dejó el teléfono'], levantar: ['Got up for a while', 'Levantou um pouco', 'Se levantó un rato'],
  fim: ['To the end', 'Até o fim', 'Hasta el final'], substituida: ['Changed moment', 'Trocou de momento', 'Cambió de momento'],
};
function nomeTecHist(tec, r) {
  if (tec !== 'cochilo') return nomeTecnica(tec);
  const a = r && r.extra && r.extra.alarme;
  return t('nap') + (a === 'proprio' ? t('nap_own') : a === 'relogio' ? t('nap_clock') : a === 'sem' ? t('nap_none') : '');
}
function viewHistorico() {
  const f = S.filtro;
  const h = Hist.todos().filter(r => f === 'todos' || r.modo === f).slice().reverse();
  const dia = ts => {
    const d = new Date(ts), hoje = new Date(), ontem = new Date(agora() - 86400000);
    if (d.toDateString() === hoje.toDateString()) return t('today');
    if (d.toDateString() === ontem.toDateString()) return t('yesterday');
    return d.toLocaleDateString(LOCALE[LANG], { weekday: 'short', day: 'numeric', month: 'short' });
  };
  let ult = '', itens = '';
  for (const r of h) {
    const d = dia(r.ini);
    if (d !== ult) { itens += `<h2 style="font-size:0.95rem;color:var(--muted);margin:1rem 0 0">${esc(d)}</h2>`; ult = d; }
    const seq = (r.passos || []).map(p => esc(nomeTecHist(p.tec, r)) + (p.trocou ? esc(t('switched')) : '')).join(' → ') || '—';
    const resp = r.resp != null ? `${esc(perguntaDe(r.modo).replace(/[?¿]/g, ''))}: ${esc(nomeResp(r.modo, r.resp) || r.resp)}`
      : esc(r.pulou ? t('skipped') : r.fim ? t('no_answer') : t('in_progress'));
    const saida = SAIDAS[r.saida] ? ' · ' + esc(tr(SAIDAS[r.saida])) : '';
    itens += `<div class="item"><div class="txt"><b>${hhmm(r.ini)} · ${esc(nomeModo(r.modo))}</b><div class="pequeno">${seq}</div>
      <div class="pequeno">${resp}${saida}</div></div>
      <button class="icone" data-a="histApagar" data-id="${r.id}" aria-label="${esc(t('delete_entry'))}">✕</button></div>`;
  }
  return `<section class="tela">${topo(t('history'))}
    ${chips('histFiltro', f, [['todos', t('all')], ...['pico', 'paz', 'cochilo', 'madrugada'].map(m => [m, nomeModo(m)])])}
    <div>${itens || `<p class="sub">${esc(t('nothing_yet'))}</p>`}</div>
    ${h.length ? botao('histLimpar', t('delete_history'), 'discreto') : ''}</section>`;
}

/* ----- revisão ----- */
function viewRevisao() {
  const rev = LS.get('rev', {}) || {};
  const blocos = Aprender.revisao().map(d => {
    const resp = opcoesDe(d.modo).map(([v, n]) => `${n} ${d.resp[v] || 0}`).join(' · ') + ' · ' + t('no_answer_n', { n: d.sem });
    const atual = rev[d.modo] && rev[d.modo].v;
    return `<div class="cartao"><p><b>${esc(nomeModo(d.modo))}</b> · ${esc(d.n === 1 ? t('time1') : t('times', { n: d.n }))}</p>
      <p class="pequeno">${esc(perguntaDe(d.modo))} ${esc(resp)}</p>
      ${d.trocas ? `<p class="pequeno">${esc(t('switches', { n: d.trocas }))}</p>` : ''}${d.saiu ? `<p class="pequeno">${esc(t('left_early', { n: d.saiu }))}</p>` : ''}
      <p class="pequeno">${esc(t('this_moment'))}</p>${chips('revDecidir', atual, [['manter', t('r_keep')], ['simplificar', t('r_simplify')], ['tirar', t('r_remove')]], `data-m="${d.modo}"`)}</div>`;
  }).join('');
  const sc = (LS.get('semCelular', []) || []).slice(-1)[0];
  return `<section class="tela">${topo(t('review'))}
    <p class="sub">${esc(t('review_intro'))}</p>
    ${blocos || `<p class="sub">${esc(t('no_records_2w'))}</p>`}
    <div class="cartao"><p><b>${esc(t('used_without_phone'))}</b></p>
      ${chips('revSemCelular', sc && agora() - sc.em < 7 * 86400000 ? sc.v : '', [['sim', t('yes')], ['ainda_nao', t('not_yet')]])}</div>
  </section>`;
}

/* ----- ajustes ----- */
function viewAjustes() {
  const p = prefs();
  const modos = ['pico', 'paz', 'cochilo', 'madrugada'];
  const v = Diag.voz;
  return `<section class="tela">${topo(t('settings'))}
    <div class="secao"><h2>${esc(t('language'))}</h2>${chips('ajLang', LANG, LANGS)}</div>
    <div class="secao"><h2>${esc(t('main_button'))}</h2>${chips('ajRotulo', p.rotulo, [['dificil', t('btn_dificil')], ['pico', t('btn_pico')]])}</div>
    <div class="secao"><h2>${esc(t('voice'))}</h2>
      ${modos.map(m => `<div class="item"><div class="txt">${esc(nomeModo(m))}</div>${chips('ajVoz', String(p.voz[m] !== false), [['true', t('on')], ['false', t('text_only')]], `data-m="${m}"`)}</div>`).join('')}
      <div class="item"><div class="txt">${esc(t('speed'))}</div>${chips('ajVel', String(p.velocidade), [['0.8', t('slower')], ['0.9', t('calm')], ['1', t('normal')]])}</div>
      ${botao('ajTestarVoz', t('test_voice'))}
      ${v && v.status === 'falta' ? `<p class="pequeno aviso">${esc(t('voice_missing'))}</p>` : ''}
      <p class="pequeno">${esc(t('voice_note'))}</p></div>
    <div class="secao"><h2>${esc(t('sounds'))}</h2>
      ${[['pico', t('pico_sound')], ['paz', nomeModo('paz')], ['cochilo', nomeModo('cochilo')], ['madrugada', nomeModo('madrugada')]].map(([m, n]) => `<div class="pilha" style="gap:0.4rem"><span class="pequeno">${esc(n)}</span>${chips('ajSom', p.som[m], listaSons(), `data-m="${m}"`)}</div>`).join('')}
      <div class="grupo">${listaSons().slice(1).map(([s, n]) => botao('ajOuvir', t('listen_x', { s: n.toLowerCase() }), 'discreto', `style="width:auto" data-v="${s}"`)).join('')}</div></div>
    <div class="secao"><h2>${esc(t('look'))}</h2>
      ${chips('ajTema', p.tema, [['auto', t('theme_auto')], ['claro', t('light')], ['escuro', t('dark')]])}
      ${chips('ajTexto', String(p.texto), [['1', t('text_normal')], ['1.15', t('text_big')], ['1.3', t('text_bigger')]])}</div>
    <div class="secao"><h2>${esc(t('more'))}</h2>
      ${botao('tecnicas', t('techniques_why'), 'esq')}${botao('contato', t('contact_title'), 'esq')}${botao('preparar', t('prep_alarm'), 'esq')}
      ${botao('diagnostico', t('diag_test'), 'esq')}${botao('acesso', t('quick_access'), 'esq')}${botao('privacidade', t('your_data'), 'esq')}</div>
    <div class="secao"><h2>${esc(t('updates'))}</h2>
      <p class="pequeno">${esc(t('updates_note', { v: versaoTexto() }))}</p>
      ${chips('ajAtualizar', String(p.atualizar !== false), [['true', t('auto_update')], ['false', t('only_when_ask')]])}
      ${botao('atualizarAgora', t('check_update'))}</div>
  </section>`;
}
function viewTecnicas() {
  const p = prefs();
  const bloco = modo => `<div class="secao"><h2>${esc(nomeModo(modo))}</h2>${(p.ordem[modo] || []).filter(x => TEC[x]).map((x, i) => {
    const oculta = (p.ocultas[modo] || []).includes(x), fixa = !oculta && Sessao.primeiraDe(modo) === x;
    const nome = nomeTecnica(x);
    return `<div class="item"><div class="txt"><b>${esc(nome)}</b>${oculta ? ` <span class="pequeno">${esc(t('hidden'))}</span>` : fixa ? ` <span class="pequeno">${esc(t('starts_with'))}</span>` : ''}
      <div class="grupo" style="margin-top:0.4rem">
        <button class="chip" data-a="ficha" data-v="${x}">${esc(t('why'))}</button>
        ${oculta ? `<button class="chip" data-a="tecRestaurar" data-m="${modo}" data-v="${x}">${esc(t('bring_back'))}</button>` : `<button class="chip" data-a="tecOcultar" data-m="${modo}" data-v="${x}">${esc(t('hide'))}</button>`}
        ${!oculta && !fixa ? `<button class="chip" data-a="tecFixar" data-m="${modo}" data-v="${x}">${esc(t('start_with'))}</button>` : ''}
        ${i > 0 ? `<button class="chip" data-a="tecSubir" data-m="${modo}" data-v="${x}" aria-label="${esc(t('move_up', { n: nome }))}">↑</button>` : ''}
      </div></div></div>`;
  }).join('')}</div>`;
  return `<section class="tela">${topo(t('techniques'))}
    <p class="sub">${esc(t('tech_intro'))}</p>
    ${bloco('pico')}${bloco('paz')}
    <div class="secao"><h2>${esc(t('other_moments'))}</h2>
      ${botao('ficha', nomeModo('cochilo') + ' · ' + t('why'), 'esq', 'data-v="cochilo"')}${botao('ficha', nomeModo('madrugada') + ' · ' + t('why'), 'esq', 'data-v="madrugada"')}</div>
  </section>`;
}
function viewFicha() {
  const id = S.ficha, f = TEC[id] ? TEC[id].ficha : FICHAS_MODO[id];
  if (!f) { S.tela = 'tecnicas'; return viewTecnicas(); }
  const nome = TEC[id] ? nomeTecnica(id) : tr(FICHAS_MODO[id].nome);
  const bloco = (titulo, txt, cls = '') => `<div class="cartao ${cls}"><p><b>${esc(t(titulo))}</b></p><p>${esc(tr(txt))}</p></div>`;
  return `<section class="tela">${topo(t('why'))}
    <p class="titulo">${esc(nome)}</p>
    ${bloco('what_for', f.serve)}
    <div class="cartao"><p><b>${esc(t('where_from'))}</b></p>${f.fontes.map(k => `<p class="fonte"><a href="#" data-a="link" data-v="${FONTES[k].url}">${esc(tr(FONTES[k].nome))}</a></p>`).join('')}</div>
    ${bloco('adapted', f.adaptado)}${bloco('when_switch', f.trocar)}${bloco('limit', f.limite, 'suave')}
    <p class="pequeno">${esc(t('ficha_note', { v: CONTEUDO_VERSAO, r: tr(CONTEUDO_REVISAO) }))}</p>
  </section>`;
}
function viewPreparar() {
  const st = Coch.st;
  if (!Nat.on) return `<section class="tela">${topo(t('prep_alarm'))}<p class="sub">${esc(t('prep_only_app'))}</p></section>`;
  if (!st) return `<section class="tela">${topo(t('prep_alarm'))}<p class="sub">${esc(t('checking'))}</p></section>`;
  const it = (ok, titulo, txt, acao, rotulo, extra = '') => `<div class="item"><div class="status"><span class="m ${ok === true ? 'ok' : 'aviso'}">${ok === true ? '✓' : ok === false ? '!' : '?'}</span>
    <div class="txt"><b>${esc(titulo)}</b>${txt ? `<div class="pequeno">${esc(txt)}</div>` : ''}${acao ? `<button class="btn" data-a="${acao}" ${extra} style="margin-top:0.5rem">${esc(rotulo)}</button>` : ''}</div></div></div>`;
  const x = ehXiaomi(st);
  return `<section class="tela">${topo(t('prep_alarm'))}
    <p class="sub">${esc(t('prep_intro'))}</p>
    ${it(st.exato, t('exact_title'), st.exato ? t('allowed') : t('missing'), st.exato ? '' : 'cochiloAutorizar', t('allow'))}
    ${it(st.notif, t('notif_title'), st.notif ? t('allowed') : t('notif_why'), st.notif ? '' : 'cochiloNotif', t('allow'))}
    ${it(st.telaCheia !== false, t('fs_title'), st.telaCheia === false ? t('fs_blocked') : t('allowed'), st.telaCheia === false ? 'abrirTelaCheia' : '', t('open_setting'))}
    ${it(st.bateria, t('bat_title'), st.bateria ? t('bat_ok') : t('bat_how'), st.bateria ? '' : 'abrirAppAjustes', t('open_app_settings'))}
    ${x ? it(null, t('x_autostart'), t('x_autostart_txt'), 'abrirXiaomi', t('open'), 'data-v="autostart"') : ''}
    ${x ? it(null, t('x_perm'), t('x_perm_txt'), 'abrirXiaomi', t('open'), 'data-v="permissoes"') : ''}
    ${x ? it(null, t('x_lock'), t('x_lock_txt')) : ''}
    ${it(st.volumeAlarme > 0, t('alarm_volume'), st.volumeAlarme != null ? t('alarm_volume_txt', { a: st.volumeAlarme, b: st.volumeAlarmeMax }) : '')}
    ${botao('diagTeste', t('test_1min'), 'forte')}${botao('prepOk', t('checked_all'), 'discreto')}
  </section>`;
}
function viewDiagnostico() {
  const d = Diag;
  return `<section class="tela">${topo(t('diag'))}
    <p class="sub">${esc(t('diag_intro'))}</p>
    ${botao('diagTeste', t('test_alarm_1min'), 'forte')}
    ${d.teste && d.teste > agora() ? `<p class="centro">${t('test_set_for', { h: hhmm(d.teste) })}</p>` : ''}
    <div class="secao"><h2>${esc(t('logged_alarms'))}</h2>${d.log.length ? d.log.slice(-12).reverse().map(x => `<p class="pequeno">${esc(linhaLog(x))}</p>`).join('') : `<p class="pequeno">${esc(t('none_yet'))}</p>`}</div>
    <div class="secao"><h2>${esc(t('report'))}</h2><div class="relatorio" id="relatorio">${esc(Nat.on ? d.relatorio() : t('only_app'))}</div>
      ${botao('diagCompartilhar', t('share_report'))}</div>
  </section>`;
}
function viewPrivacidade() {
  return `<section class="tela">${topo(t('your_data'))}
    <div class="cartao"><p>${esc(t('priv1'))}</p><p>${esc(t('priv2'))}</p><p>${esc(t('priv3'))}</p></div>
    ${botao('historico', t('see_delete'))}${botao('apagarTudo', t('delete_all'), 'alerta')}
    <p class="pequeno">${esc(t('delete_all_note'))}</p>
  </section>`;
}
function viewAcesso() {
  return `<section class="tela">${topo(t('quick_access'))}
    <p class="sub">${esc(t('qa_intro', { b: rotuloPrincipal() }))}</p>
    <div class="cartao"><p><b>${esc(t('qa_widget'))}</b></p><p>${esc(t('qa_widget_txt'))}</p></div>
    <div class="cartao"><p><b>${esc(t('qa_tile'))}</b></p><p>${esc(t('qa_tile_txt'))}</p></div>
    <div class="cartao"><p><b>${esc(t('qa_shortcuts'))}</b></p><p>${esc(t('qa_shortcuts_txt'))}</p></div>
  </section>`;
}
