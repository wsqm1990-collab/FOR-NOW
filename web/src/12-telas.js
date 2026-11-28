/* ---------- telas ---------- */
const S = { tela: 'inicio', de: null, ficha: null, filtro: 'todos', alarmeTocando: false, precisaApk: false, sug: null };

const PAIS = {
  paz: 'inicio', cochilo: 'inicio', respirar: 'inicio', musica: 'inicio', mix: 'musica', creditos: 'ajustes', apoio: 'inicio', historico: 'inicio', revisao: 'inicio', ajustes: 'inicio',
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
    case 'respirar': html = viewRespirar(); break;
    case 'musica': html = viewMusica(); break;
    case 'mix': html = viewMix(); break;
    case 'creditos': html = viewCreditos(); break;
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
  if (S.tela === 'sessao' && Sessao.modo === 'respirar') requestAnimationFrame(() => atualizarCirculo(true));
  /* o som do mix sendo montado só toca enquanto se está na tela dele */
  if (S.tela !== 'mix' && Mix.ouvindo()) Mix.pararDeOuvir();
}

/* ----- início ----- */
function viewInicio() {
  const cartoes = [];
  if (Sessao.ativa && Sessao.modo === 'cochilo') {
    const fim = Coch.quandoTermina();
    cartoes.push(`<div class="cartao suave"><p><b>${esc(t('nap_running'))}</b>${fim ? esc(t('until', { h: hhmm(fim) })) : ''}</p>${botao('voltarCochilo', t('back_to_nap'))}</div>`);
  }
  if (S.precisaApk) cartoes.push(`<div class="cartao"><p>${esc(t('need_apk'))}</p>${botao('baixarApk', t('get_apk'))}</div>`);
  const sug = idiomaSugerido();
  if (sug) {
    const antes = LANG; setIdioma(sug);
    const txt = sug === 'pt' ? t('lang_suggest_pt') : t('lang_suggest_es');
    const sim = sug === 'pt' ? t('lang_use_pt') : t('lang_use_es'), nao = t('not_now');
    setIdioma(antes);
    cartoes.push(`<div class="cartao suave"><p>${esc(txt)}</p><div class="linha">${botao('idiomaSim', sim, 'forte', `data-v="${sug}"`)}${botao('idiomaNao', nao, 'discreto')}</div></div>`);
  }
  const pend = pendenteParaMostrar();
  S.sug = null;
  if (pend) {
    cartoes.push(`<div class="cartao"><div class="linha" style="align-items:flex-start"><p style="flex:1"><b>${esc(perguntaDe(pend.tipo))}</b></p><button class="icone" data-a="pendFechar" data-id="${pend.id}" aria-label="${esc(t('not_now'))}">✕</button></div>
      <div class="grupo">${opcoesDe(pend.tipo).map(([v, n]) => `<button class="chip" data-a="pendResp" data-id="${pend.id}" data-v="${v}">${esc(n)}</button>`).join('')}</div></div>`);
  } else {
    const sug = Aprender.sugestao();
    if (sug) { S.sug = sug; cartoes.push(viewSugestao(sug)); }
  }
  const item = (acao, ic, titulo, det, cls = '') => `<button class="linha-item ${cls}" data-a="${acao}">${icone(ic)}<span class="txt"><span class="t">${esc(titulo)}</span>${det ? `<span class="d">${esc(det)}</span>` : ''}</span></button>`;
  return `<section class="tela">
    <div class="topo inicio-topo"><span class="marca">For Now</span><button class="icone" data-a="ajustes">${esc(t('settings'))}</button></div>
    <div class="pedra"><button class="btn pico" data-a="pico">${esc(rotuloPrincipal())}</button></div>
    ${cartoes.join('')}
    <nav class="lista-inicio">
      ${item('respirar', 'respirar', t('breathe'), t('breathe_det'))}
      ${item('pazAbrir', 'paz', t('peace'), t('peace_det'))}
      ${item('musica', 'musica', t('music'), t('music_det'))}
      ${item('cochilo', 'cochilo', t('nap'), t('nap_det'))}
      ${item('madrugada', 'noite', t('night'), t('night_det'))}
      ${item('apoio', 'apoio', t('support'), '', 'apoio')}
    </nav>
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
  if (m === 'respirar') return viewRespSessao(Guia.g);
  if (m === 'musica') return viewMusSessao(Guia.g);
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
      ${mostraSom ? `<button class="chip chip-som" data-a="sSom" aria-label="${esc(t('sound_aria', { s: nomeSom(somAtual) }))}">${icone('musica')}${esc(nomeSom(somAtual))}</button>` : ''}
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
    <div class="secao"><h2>${esc(t('sound'))}</h2>${botaoSom('paz')}</div>
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
    <p class="grande">${esc(fmtDur(Coch.min))}</p>
    <p class="centro sub" id="cochilo-hora">${t('wake_at', { h: hhmm(alvo) })}</p>
    <div class="linha"><button class="btn" data-a="cochiloMenos" aria-label="${esc(t('less_n', { n: Coch.passo(-1) }))}">− ${Coch.passo(-1)} min</button><button class="btn" data-a="cochiloMais" aria-label="${esc(t('more_n', { n: Coch.passo(1) }))}">+ ${Coch.passo(1)} min</button></div>
    <div class="grupo atalhos">${[20, 45, 60, 90, 120].map(m => `<button class="chip" data-a="cochiloDur" data-v="${m}" aria-pressed="${Coch.min === m}">${esc(fmtDur(m))}</button>`).join('')}</div>
    ${painel}
    <div class="secao"><h2>${esc(t('sound_while_resting'))}</h2>${botaoSom('cochilo')}</div>
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
    <div class="secao"><h2>${esc(t('voice_type'))}</h2>
      ${chips('ajVozTipo', p.vozTipo, [['feminina', t('voice_female')], ['masculina', t('voice_male')], ['android', t('voice_phone')]])}
      <p class="pequeno">${esc(t('voice_rec_note'))}</p></div>
    <div class="secao"><h2>${esc(t('voice'))}</h2>
      ${modos.map(m => `<div class="item"><div class="txt">${esc(nomeModo(m))}</div>${chips('ajVoz', String(p.voz[m] !== false), [['true', t('on')], ['false', t('text_only')]], `data-m="${m}"`)}</div>`).join('')}
      <div class="item"><div class="txt">${esc(t('speed'))}</div>${chips('ajVel', String(p.velocidade), [['0.8', t('slower')], ['0.9', t('calm')], ['1', t('normal')]])}</div>
      ${botao('ajTestarVoz', t('test_voice'))}
      ${v && v.status === 'falta' ? `<p class="pequeno aviso">${esc(t('voice_missing'))}</p>` : ''}
      <p class="pequeno">${esc(t('voice_note'))}</p></div>
    <div class="secao"><h2>${esc(t('sounds'))}</h2>
      ${[['pico', t('pico_sound')], ['paz', nomeModo('paz')], ['cochilo', nomeModo('cochilo')], ['madrugada', nomeModo('madrugada')], ['respirar', t('breathe')]].map(([m, n]) => `<div class="item"><div class="txt">${esc(n)}</div>${botaoSom(m)}</div>`).join('')}
      ${temMidia() ? linha8D() : ''}</div>
    <div class="secao"><h2>${esc(t('look'))}</h2>
      ${chips('ajTema', p.tema, [['auto', t('theme_auto')], ['claro', t('light')], ['escuro', t('dark')]])}
      ${chips('ajTexto', String(p.texto), [['1', t('text_normal')], ['1.15', t('text_big')], ['1.3', t('text_bigger')]])}</div>
    <div class="secao"><h2>${esc(t('more'))}</h2>
      ${botao('tecnicas', t('techniques_why'), 'esq')}${botao('contato', t('contact_title'), 'esq')}${botao('preparar', t('prep_alarm'), 'esq')}
      ${botao('diagnostico', t('diag_test'), 'esq')}${botao('acesso', t('quick_access'), 'esq')}${botao('privacidade', t('your_data'), 'esq')}${botao('creditos', t('credits'), 'esq')}</div>
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

/* ----- som de fundo: um botão que abre a lista, por categoria ----- */
function botaoSom(modo) {
  return `<button class="btn esq som-escolha" data-a="abrirSons" data-m="${modo}"><span><span>${esc(nomeSom(somReal(prefs().som[modo] || 'silencio')))}</span></span><span aria-hidden="true">›</span></button>`;
}
/* tudo o que pode tocar ao fundo, por uso: sons, músicas e os mixes salvos */
function fundosPorUso() {
  const base = FUNDOS.filter(f => f.c !== 'base' && f.c !== 'reserva' && (temMidia() || !f.v.startsWith('midia/')));
  const mixes = temMidia() ? Mix.todos() : [];
  return USOS.map(u => [u, [
    ...mixes.filter(m => m.cat === u).map(m => ({ v: 'mix:' + m.id, nome: m.nome, mix: m })),
    ...base.filter(f => usoDe(f.v) === u).map(f => ({ v: f.v, nome: tr(f.n), musica: f.musica, c: f.c })),
  ]]).filter(([, l]) => l.length);
}
function folhaSons(modo, atual) {
  atual = somReal(atual || 'silencio');
  const chip = (v, nome) => `<button class="chip" data-a="escolherSom" data-m="${modo}" data-v="${esc(v)}" aria-pressed="${v === atual}">${esc(nome)}</button>`;
  S.folhaSons = { modo, atual };
  abrirFolha(`<p class="pergunta">${esc(t('choose_sound'))}</p>
    ${temMidia() ? linha8D() : ''}
    <div class="grupo">${chip('silencio', tr(SONS[0][1]))}</div>
    ${fundosPorUso().map(([u, l]) => `<div class="secao"><h2>${esc(tr(USO_TITULO[u]))}</h2><p class="pequeno">${esc(tr(USO_DET[u]))}</p>
      <div class="grupo">${l.map(x => chip(x.v, x.nome)).join('')}</div></div>`).join('')}
    <button class="btn discreto" data-a="fecharFolha">${esc(t('back_word'))}</button>`);
}

/* ----- respirar ----- */
function viewRespirar() {
  const p = prefs(), r = p.respirar;
  const det = ex => ex === 'livre' ? Resp.fasesDe('livre').map(([f, s]) => `${tr(RESP_ROTULO[f])} ${s}`).join(', ') : tr(RESP[ex].det);
  const item = ex => `<button class="linha-item${r.ex === ex ? ' marcado' : ''}" data-a="respComecar" data-v="${ex}"><span class="txt"><span class="t">${esc(tr(RESP[ex].nome))}</span><span class="d">${esc(det(ex))}</span></span><span class="ic-play" aria-hidden="true">▶</span></button>`;
  const passo = campo => `<div class="item"><div class="txt">${esc(tr(RESP_ROTULO[campo]))}</div><div class="grupo passo">
      <button class="chip" data-a="respLivre" data-v="${campo}" data-d="-1" aria-label="${esc(t('less'))}">−</button>
      <span class="valor">${esc(t('sec_x', { n: r.livre[campo] }))}</span>
      <button class="chip" data-a="respLivre" data-v="${campo}" data-d="1" aria-label="${esc(t('more_btn'))}">+</button></div></div>`;
  return `<section class="tela">${topo(t('breathe'))}
    <p class="sub">${esc(t('breathe_intro'))}</p>
    <div class="lista-inicio">${Object.keys(RESP).map(item).join('')}</div>
    <div class="secao"><h2>${esc(t('your_times'))}</h2>${['in', 'hold', 'out', 'pausa'].map(passo).join('')}</div>
    <div class="secao"><h2>${esc(t('duration'))}</h2>${chips('respMin', String(r.min), [1, 3, 5, 10].map(n => [String(n), t('min_x', { n })]))}</div>
    <div class="secao"><h2>${esc(t('voice'))}</h2>${chips('ajVoz', String(p.voz.respirar !== false), [['true', t('voice_on')], ['false', t('text_only')]], 'data-m="respirar"')}</div>
    <div class="secao"><h2>${esc(t('vibration'))}</h2>${chips('respVib', String(r.vib !== false), [['true', t('on')], ['false', t('off')]])}</div>
    <div class="secao"><h2>${esc(t('background'))}</h2>${botaoSom('respirar')}</div>
  </section>`;
}
function viewRespSessao(g) {
  const nome = g && g.titulo ? tr(g.titulo) : t('breathe');
  if (Sessao.fase === 'respFim' || !g) {
    return `<section class="sessao resp"><div class="topo"><span class="marca">${esc(nome)}</span></div>
      <div class="instr-caixa"><p class="pergunta">${esc(t('breathe_done'))}</p></div>
      <div class="escolhas">${botao('respDeNovo', t('again'), 'forte')}${botao('sSair', t('finish'))}</div></section>`;
  }
  const pausado = !!g.pausadoEm, fr = Guia.frase(g);
  return `<section class="sessao resp">
    <div class="topo">
      <button class="chip chip-som" data-a="sSom" aria-label="${esc(t('sound_aria', { s: nomeSom(g.som) }))}">${icone('musica')}${esc(nomeSom(g.som))}</button>
      <button class="chip" data-a="sVoz" aria-pressed="${g.voz}">${esc(g.voz ? t('voice_on') : t('text_only'))}</button></div>
    <p class="resp-nome">${esc(nome)}</p>
    <div class="resp-caixa"><div class="circulo-halo" aria-hidden="true"></div><div class="circulo" id="circulo"></div><div class="resp-texto"><span id="resp-rotulo"></span><span id="resp-seg"></span></div></div>
    <p id="instr" class="instr pequena${fr.calado ? ' calado' : ''}" aria-live="polite">${esc(fr.texto)}</p>
    <p class="estado" id="estado">${pausado ? esc(t('paused')) : ''}</p>
    <div class="barra">${pausado ? botao('sContinuar', t('resume')) : botao('sPausar', t('pause'))}${botao('sSair', t('leave'))}</div>
  </section>`;
}

/* ----- músicas e sono ----- */
/* uma linha da lista: ícone, nome e para quê; um mix tem o lápis para editar */
function linhaFundo(x) {
  const ic = x.mix ? icone('mix') : x.musica ? icone('musica') : x.c === 'binaural' ? icone('binaural') : x.c === 'frequencia' ? icone('onda') : x.c === 'ruido' ? icone('ruido') : icone('natureza');
  const det = x.mix ? `${t('my_mix')}: ${Mix.descricao(x.mix)}` : porQue(x.v);
  const tocar = `<button class="linha-item" data-a="musTocar" data-v="${esc(x.musica || x.v)}">${ic}<span class="txt"><span class="t">${esc(x.nome)}</span><span class="d">${esc(det)}</span></span></button>`;
  return x.mix ? `<div class="linha-mix">${tocar}<button class="icone editar" data-a="mixEditar" data-id="${esc(x.mix.id)}" aria-label="${esc(t('edit_x', { s: x.nome }))}">${icone('lapis')}</button></div>` : tocar;
}
function viewMusica() {
  const m = prefs().musica, uso = S.musUso || m.uso || 'relaxar';
  const lista = (fundosPorUso().find(([u]) => u === uso) || [uso, []])[1];
  const grupos = [
    ['music_songs', lista.filter(x => x.musica)],
    ['music_nature', lista.filter(x => x.c === 'natureza')],
    ['music_tones', lista.filter(x => x.c === 'ruido' || x.c === 'binaural')],
    ['music_freqs', lista.filter(x => x.c === 'frequencia'), 'freq_det'],
    ['my_mixes', lista.filter(x => x.mix)],
  ].filter(([, l]) => l.length);
  const tile = u => `<button class="uso-tile uso-${u}" data-a="musUso" data-v="${u}" aria-pressed="${uso === u}">${icone('uso_' + u)}<span class="t">${esc(tr(USO_NOME[u]))}</span></button>`;
  return `<section class="tela">${topo(t('music'))}
    <button class="btn dormir-agora" data-a="musDormir"><span>${esc(t('sleep_now'))}</span><small>${esc(t('sleep_det'))}</small></button>
    <p class="pergunta-uso">${esc(t('music_what_for'))}</p>
    <div class="usos">${USOS.map(tile).join('')}</div>
    <p class="sub centro uso-det">${esc(tr(USO_DET[uso]))}</p>
    ${grupos.map(([k, l, d]) => `<div class="secao"><h2>${esc(t(k))}</h2>${d ? `<p class="pequeno">${esc(t(d))}</p>` : ''}<div class="lista-inicio">${l.map(linhaFundo).join('')}</div></div>`).join('')}
    ${temMidia() ? `<button class="linha-item criar-mix" data-a="mixNovo">${icone('mix')}<span class="txt"><span class="t">${esc(t('mix_create'))}</span><span class="d">${esc(t('mix_create_det'))}</span></span></button>` : ''}
    <div class="secao ajustes-musica"><h2>${esc(t('music_settings'))}</h2>
      <div class="item"><div class="txt">${esc(t('plays_for'))}</div></div>
      ${chips('musTimer', String(m.timer), [['15', t('min_x', { n: 15 })], ['30', t('min_x', { n: 30 })], ['45', t('min_x', { n: 45 })], ['60', t('min_x', { n: 60 })], ['0', t('no_end')]])}
      <div class="item"><div class="txt">${esc(t('sleep_voice'))}</div>${chips('musVoz', String(m.vozDormir !== false), [['true', t('on')], ['false', t('off')]])}</div>
      ${temMidia() ? linha8D() : ''}
    </div>
  </section>`;
}

/* ----- criar meu mix ----- */
function viewMix() {
  const e = Mix.edit;
  if (!e) { S.tela = 'musica'; return viewMusica(); }
  const chipMix = (v, nome) => `<button class="chip" data-a="mixCamada" data-v="${esc(v)}" aria-pressed="${Mix.tem(v)}">${esc(nome)}</button>`;
  const de = c => FUNDOS.filter(f => f.c === c && (temMidia() || !f.v.startsWith('midia/')));
  const natureza = de('natureza'), ruidos = de('ruido'), binaurais = de('binaural');
  const musicas = FUNDOS.filter(f => f.musica);
  const vol = c => `<div class="item mix-vol"><div class="txt">${esc(nomeSom(c.v))}</div>
      <input type="range" min="5" max="100" step="5" value="${Math.round(c.vol * 100)}" data-in="mixVol" data-v="${esc(c.v)}" aria-label="${esc(t('volume_of', { s: nomeSom(c.v) }))}">
      <button class="icone" data-a="mixCamada" data-v="${esc(c.v)}" aria-label="${esc(t('remove_x', { s: nomeSom(c.v) }))}">✕</button></div>`;
  const aviso = !temMidia() ? t('mix_only_app') : Sessao.ativa ? t('mix_no_preview') : '';
  return `<section class="tela">${topo(e.id ? t('mix_edit') : t('mix_create'))}
    <p class="sub">${esc(t('mix_intro'))}</p>
    ${aviso ? `<p class="pequeno aviso">${esc(aviso)}</p>` : ''}
    <div class="secao"><h2>${esc(t('mix_song'))}</h2><p class="pequeno">${esc(t('mix_song_det'))}</p>
      <div class="grupo">${musicas.map(f => chipMix(f.v, tr(f.n))).join('')}</div></div>
    <div class="secao"><h2>${esc(t('mix_nature'))}</h2><div class="grupo">${natureza.map(f => chipMix(f.v, tr(f.n))).join('')}</div></div>
    <div class="secao"><h2>${esc(t('music_noise'))}</h2><div class="grupo">${ruidos.map(f => chipMix(f.v, tr(f.n))).join('')}</div></div>
    <div class="secao"><h2>${esc(t('music_binaural'))}</h2><p class="pequeno">${esc(t('binaural_det'))}</p>
      <div class="grupo">${binaurais.map(f => chipMix(f.v, tr(f.n))).join('')}</div></div>
    ${temMidia() ? `<div class="secao freqs"><h2>${esc(t('music_freqs'))}</h2><p class="pequeno">${esc(t('freq_det'))}</p>${freqPorUso(chipMix)}</div>` : ''}
    <div class="secao"><h2>${esc(t('mix_volumes'))}</h2>${e.camadas.length ? e.camadas.map(vol).join('') : `<p class="pequeno">${esc(t('mix_empty'))}</p>`}</div>
    ${temMidia() ? `<div class="secao">${linha8D()}</div>` : ''}
    <div class="cartao mix-uso" id="mix-uso">${mixUsoHtml()}</div>
    <label>${esc(t('mix_name'))}<input type="text" id="mix-nome" data-in="mixNome" maxlength="40" value="${esc(e.nome || '')}" placeholder="${esc(Mix.nomeSugerido())}"></label>
    <div class="pilha">${e.camadas.length ? botao('mixSalvar', t('save'), 'forte') : ''}${e.id ? botao('mixApagar', t('mix_delete'), 'discreto') : ''}</div>
  </section>`;
}
/* para que o mix serve, decidido pelo app (e a escolha manual, se quiser) */
function mixUsoHtml() {
  const e = Mix.edit;
  if (!e || !e.camadas.length) return `<p class="pequeno">${esc(t('mix_use_empty'))}</p>`;
  const c = Mix.classificar(e.camadas);
  const uso = e.uso && e.uso !== 'auto' ? e.uso : c.uso;
  const porque = e.uso && e.uso !== 'auto' ? esc(t('mix_use_manual')) : esc(t('mix_because', { r: c.razoes.join(t('and_word')) }));
  return `<p>${esc(t('mix_for'))} <b>${esc(tr(USO_NOME[uso]))}</b>. ${porque}</p>
    <p class="pequeno">${esc(t('mix_change_use'))}</p>
    ${chips('mixUso', e.uso || 'auto', [['auto', t('mix_auto')], ...USOS.map(u => [u, tr(USO_NOME[u])])])}`;
}
function atualizarMixUso() { const el = $('#mix-uso'); if (el) el.innerHTML = mixUsoHtml(); }
function viewMusSessao(g) {
  const dormir = !!(Sessao.r && Sessao.r.extra.dormir);
  if (Sessao.fase === 'quieto' || !g) {
    return `<section class="sessao"><div class="instr-caixa"><p class="instr calado">…</p></div>
      <div class="barra">${botao('sSair', t('end'), 'discreto')}</div></section>`;
  }
  const pausado = !!g.pausadoEm, fr = Guia.frase(g), varias = !!(g.sons && g.sons.length > 1);
  const timer = Sessao.r.extra.min;
  return `<section class="sessao musica${dormir ? ' noturna' : ''}">
    <div class="topo"><span class="marca">${esc(dormir ? t('sleep_now') : t('music'))}</span><div class="grupo" style="justify-content:flex-end">${temMidia() ? `<button class="chip" data-a="tog8D" aria-pressed="${!!prefs().oitoD}">8D</button>` : ''}${dormir ? `<button class="chip" data-a="sVoz" aria-pressed="${g.voz}">${esc(g.voz ? t('voice_on') : t('text_only'))}</button>` : ''}</div></div>
    <div class="musica-agora">
      <div class="disco${pausado ? ' parado' : ''}" aria-hidden="true"><span></span></div>
      <p class="pequeno">${esc(t('now_playing'))}</p>
      <p class="titulo-faixa" id="mus-nome">${esc(Mus.nomeAtual(g))}</p>
      ${!dormir && timer ? `<p class="sub" id="mus-resta">${esc(t('ends_in', { n: Mus.restaMin(g) }))}</p>` : ''}
    </div>
    <p id="instr" class="instr pequena${fr.calado ? ' calado' : ''}" aria-live="polite">${esc(fr.texto)}</p>
    ${temMidia() ? blocoExtra(g) : ''}
    <p class="estado" id="estado">${pausado ? esc(t('paused')) : ''}</p>
    <div class="barra">${pausado ? botao('sContinuar', t('resume')) : botao('sPausar', t('pause'))}${varias ? botao('musProxima', t('next_track')) : ''}${botao('sSair', t('stop'))}</div>
  </section>`;
}
/* "som por baixo": um som da natureza, ruído ou binaural tocando junto, no volume que quiser */
function blocoExtra(g) {
  const x = g.extra;
  return `<div class="extra">
    <button class="extra-escolha" data-a="extraEscolher">${icone(x && x.v.startsWith('midia/binaural/') ? 'binaural' : x && x.v.startsWith('midia/frequencias/') ? 'onda' : 'natureza')}<span class="txt"><span class="d">${esc(t('bg_under'))}</span><span class="t">${esc(x ? nomeSom(x.v) : t('bg_none'))}</span></span><span aria-hidden="true">›</span></button>
    ${x ? `<input type="range" min="5" max="100" step="5" value="${Math.round(x.vol * 100)}" data-in="extraVol" aria-label="${esc(t('volume_of', { s: nomeSom(x.v) }))}">` : ''}
    ${x && x.v.startsWith('midia/binaural/') ? `<p class="pequeno centro">${esc(t('binaural_phones'))}</p>` : ''}
    ${x && x.v.startsWith('midia/frequencias/') ? `<p class="pequeno centro">${esc(porQue(x.v))}</p>` : ''}
  </div>`;
}
/* as 12 frequências, separadas pelo que cada uma costuma fazer (do grave ao agudo em cada uso) */
function freqPorUso(chip) {
  return USOS.map(u => [u, FREQUENCIAS.filter(([v]) => usoDe(v) === u)]).filter(([, l]) => l.length)
    .map(([u, l]) => `<p class="rotulo-uso">${esc(tr(USO_TITULO[u]))}</p><div class="grupo">${l.map(([v, n]) => chip(v, tr(n))).join('')}</div>`).join('');
}
function folhaExtra() {
  const g = Guia.g, atual = g && g.extra ? g.extra.v : 'silencio';
  const chip = (v, nome) => `<button class="chip" data-a="extraSom" data-v="${esc(v)}" aria-pressed="${v === atual}">${esc(nome)}</button>`;
  const de = c => FUNDOS.filter(f => f.c === c && f.v.startsWith('midia/'));
  abrirFolha(`<p class="pergunta">${esc(t('bg_choose'))}</p><p class="sub centro">${esc(t('bg_choose_det'))}</p>
    <div class="grupo">${chip('silencio', t('bg_none'))}</div>
    <div class="secao"><h2>${esc(t('mix_nature'))}</h2><div class="grupo">${de('natureza').map(f => chip(f.v, tr(f.n))).join('')}</div></div>
    <div class="secao"><h2>${esc(t('music_noise'))}</h2><div class="grupo">${de('ruido').map(f => chip(f.v, tr(f.n))).join('')}</div></div>
    <div class="secao"><h2>${esc(t('music_binaural'))}</h2><p class="pequeno">${esc(t('binaural_det'))}</p><div class="grupo">${de('binaural').map(f => chip(f.v, tr(f.n))).join('')}</div></div>
    <div class="secao freqs"><h2>${esc(t('music_freqs'))}</h2><p class="pequeno">${esc(t('freq_det'))} ${esc(t('freq_under'))}</p>${freqPorUso(chip)}</div>
    <button class="btn discreto" data-a="fecharFolha">${esc(t('back_word'))}</button>`);
}
function atualizarMusica() {
  const g = Guia.g;
  if (!g || Sessao.modo !== 'musica') return;
  const n = $('#mus-nome'), r = $('#mus-resta');
  if (n) { const v = Mus.nomeAtual(g); if (n.textContent !== v) n.textContent = v; }
  if (r) { const v = t('ends_in', { n: Mus.restaMin(g) }); if (r.textContent !== v) r.textContent = v; }
}

/* ícones de traço fino, na cor do texto de destaque */
const ICONES = {
  respirar: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.6" opacity=".55"/>',
  uso_relaxar: '<path d="M5 19c0-8.2 5-13.2 14-14-0.8 9-5.8 14-14 14z"/><path d="M5 19l7.5-7.5"/>',
  uso_focar: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
  uso_acalmar: '<path d="M3 13c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 3.3-1.5 4.8-.6"/><path d="M5 17.5c1.8-1.3 3.6-1.3 5.4 0s3.6 1.3 5.4 0 2.6-1 3.2-.5" opacity=".6"/>',
  uso_dormir: '<path d="M19.2 14.6A7.6 7.6 0 1 1 9.4 4.8a6.1 6.1 0 0 0 9.8 9.8z"/>',
  binaural: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  ruido: '<path d="M3 12h2l1.5-4 2 8 2-10 2 12 2-9 2 6 1.5-3H21"/>',
  onda: '<path d="M2 12c1.7-4.7 3.3-7 5-7s3.3 2.3 5 7 3.3 7 5 7 3.3-2.3 5-7"/>',
  natureza: '<path d="M3 15c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 3.3-1.5 4.8-.6"/><path d="M3 10c2.2-2 4.4-2 6.6 0s4.4 2 6.6 0 3.3-1.5 4.8-.6"/>',
  mix: '<path d="M6 4v16M12 4v16M18 4v16"/><circle cx="6" cy="14" r="2" fill="currentColor"/><circle cx="12" cy="8" r="2" fill="currentColor"/><circle cx="18" cy="12" r="2" fill="currentColor"/>',
  lapis: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14 7l3 3"/>',
  paz: '<path d="M5 19c0-8.2 5-13.2 14-14-0.8 9-5.8 14-14 14z"/><path d="M5 19l7.5-7.5"/>',
  musica: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.6" cy="17.6" r="2.4"/><circle cx="16.6" cy="15.6" r="2.4"/>',
  cochilo: '<circle cx="12" cy="13" r="7"/><path d="M12 9.6V13l2.4 1.8"/><path d="M4.6 6.2l2.3-1.8M19.4 6.2l-2.3-1.8"/>',
  noite: '<path d="M19.2 14.6A7.6 7.6 0 1 1 9.4 4.8a6.1 6.1 0 0 0 9.8 9.8z"/>',
  apoio: '<path d="M6.7 4.6h2.5l1.3 3.6-1.8 1.3a10.2 10.2 0 0 0 5.8 5.8l1.3-1.8 3.6 1.3v2.5a1.6 1.6 0 0 1-1.7 1.6A15.4 15.4 0 0 1 5.1 6.3a1.6 1.6 0 0 1 1.6-1.7z"/>',
};
const icone = nome => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome] || ''}</svg>`;

/* som 8D: liga e desliga para todos os sons e músicas */
function linha8D() {
  return `<div class="item oito-d"><div class="txt"><b>${esc(t('eight_d'))}</b><div class="pequeno">${esc(t('eight_d_det'))}</div></div>${chips('tog8D', String(!!prefs().oitoD), [['false', t('off')], ['true', t('on')]])}</div>`;
}

/* o celular está em português (ou espanhol) e o app em inglês: sugere uma vez */
function idiomaSugerido() {
  if (LS.get('idiomaSugerido') || LANG !== 'en') return null;
  const l = String((navigator.languages && navigator.languages[0]) || navigator.language || '').slice(0, 2).toLowerCase();
  return l === 'pt' || l === 'es' ? l : null;
}

/* créditos dos sons (gravações reais livres) */
function viewCreditos() {
  const linhas = (typeof CREDITOS !== 'undefined' ? CREDITOS : []).map(c => {
    const nome = nomeSom(c.id.startsWith('N') ? `midia/sons/${c.id}.ogg` : `midia/musicas/${c.id}.ogg`);
    return `<div class="item"><div class="txt"><b>${esc(nome)}</b><div class="pequeno">${esc(c.titulo)}${c.autor ? ', ' + esc(c.autor) : ''}. ${esc(c.fonte)}, ${esc(c.licenca)}.</div></div></div>`;
  }).join('');
  return `<section class="tela">${topo(t('credits'))}<p class="sub">${esc(t('credits_det'))}</p><div class="pilha">${linhas}</div></section>`;
}
