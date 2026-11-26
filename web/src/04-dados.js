/* ---------- dados: tudo fica neste celular (armazenamento do próprio app, fora do backup do Google) ---------- */
const LS = {
  get(k, d = null) { try { const v = localStorage.getItem('fn:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fn:' + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem('fn:' + k); } catch { /* nada */ } },
  chaves() {
    const out = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('fn:')) out.push(k.slice(3)); } } catch { /* nada */ }
    return out;
  },
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const agora = () => Date.now();
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hhmm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

const PADRAO = {
  lang: 'en',                   // en (principal) | pt | es
  rotulo: 'dificil',            // 'dificil' → "It's hard right now"; 'pico' → "My anxiety is peaking"
  tema: 'auto',                 // auto (escuro das 20h às 6h) | claro | escuro
  texto: 1,                     // 1 | 1.15 | 1.3
  voz: { pico: true, paz: true, cochilo: true, madrugada: true, respirar: true, musica: true },
  vozTipo: 'feminina',          // feminina | masculina (gravadas, em português) | android (a voz do celular)
  velocidade: 0.9,
  som: { pico: 'midia/sons/N01.ogg', paz: 'midia/sons/N01.ogg', cochilo: 'silencio', madrugada: 'silencio', respirar: 'midia/musicas/M06.ogg' },
  respirar: { ex: 'quadrada', min: 3, vib: true, livre: { in: 4, hold: 2, out: 6, pausa: 0 } },
  musica: { timer: 30, vozDormir: true, ultima: 'M02' },
  cochiloMin: 20,
  cochiloVoz: true,
  ordem: { pico: ['ambiente', 'respiracao', 'som'], paz: ['musculos', 'somLongo'] },
  ocultas: { pico: [], paz: [] },
  primeira: { pico: null, paz: null },
  contato: null,                // { nome, tel }
  atualizar: true,
};
function prefs() {
  const p = LS.get('prefs', {}) || {};
  const out = JSON.parse(JSON.stringify(PADRAO));
  for (const k of Object.keys(p)) {
    const a = out[k], b = p[k];
    if (a && typeof a === 'object' && !Array.isArray(a) && b && typeof b === 'object' && !Array.isArray(b)) Object.assign(a, b);
    else out[k] = b;
  }
  return out;
}
function setPref(caminho, valor) {
  const p = LS.get('prefs', {}) || {};
  const partes = caminho.split('.');
  let o = p;
  for (let i = 0; i < partes.length - 1; i++) {
    if (!o[partes[i]] || typeof o[partes[i]] !== 'object') o[partes[i]] = {};
    o = o[partes[i]];
  }
  o[partes[partes.length - 1]] = valor;
  LS.set('prefs', p);
}

/* Histórico. Cada registro: { id, modo, ini, fim, passos: [{ tec, ini, fim, trocou }], saida, resp, extra }
   resp === null quer dizer "sem resposta" — nunca é tratado como "não ajudou". */
const Hist = {
  todos() { return LS.get('hist', []) || []; },
  pegar(id) { return this.todos().find(x => x.id === id) || null; },
  salvar(r) {
    const h = this.todos();
    const i = h.findIndex(x => x.id === r.id);
    if (i >= 0) h[i] = r; else h.push(r);
    LS.set('hist', h.slice(-1500));
  },
  apagar(id) { LS.set('hist', this.todos().filter(x => x.id !== id)); },
  limpar() { LS.del('hist'); },
};

/* perguntas que esperam você voltar ao app (cochilo, madrugada) */
const Pend = {
  todas() { return LS.get('pend', []) || []; },
  add(p) { const a = this.todas().filter(x => x.id !== p.id); a.push(p); LS.set('pend', a); },
  tirar(id) { LS.set('pend', this.todas().filter(x => x.id !== id)); },
};

/* o que não se apaga com "Apagar tudo": só o controle das atualizações do app */
const MANTER_AO_APAGAR = ['staged', 'trying', 'trying_path', 'bad', 'upd_em'];
