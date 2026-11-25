/* ---------- atualizações automáticas ----------
   Cada montagem publica a página do app como um zip junto do release. O app procura uma versão
   mais nova (no máximo a cada 6 horas, só com a tela inicial parada), baixa em segundo plano e
   só troca quando você sai do app sem nenhuma sessão em andamento. Nunca no meio de um pico,
   de um descanso ou de um cochilo, e nunca ao abrir o app. Se a versão nova não abrir direito,
   o app volta para a anterior e não tenta aquela de novo.
   É o único uso de internet do app: nada seu é enviado. */
const REPO = 'wsqm1990-collab/for-now';
const UPD = { busy: false, url: `https://github.com/${REPO}/releases/latest/download/version.json` };
const buildAtual = () => Number(window.FN_BUILD) || 0;
const versaoTexto = () => (buildAtual() ? '0.1.' + buildAtual() : 'dev');

function podeTrocarVersao() {
  return !Sessao.ativa && !S.alarmeTocando && $('#folha').hidden;
}
async function checarAtualizacao(manual) {
  if (!Nat.on || !buildAtual() || UPD.busy) return 'busy';
  if (!manual && !prefs().atualizar) return 'off';
  const ult = LS.get('upd_em') || 0;
  if (!manual && agora() - ult < 6 * 3600000) return 'later';
  if (!manual && (S.tela !== 'inicio' || Sessao.ativa)) return 'later';
  UPD.busy = true;
  let res = 'none';
  try {
    const r = await Nat.call('fetchText', { url: UPD.url });
    LS.set('upd_em', agora());
    const v = JSON.parse((r && r.text) || '{}');
    const ruins = LS.get('bad') || [];
    if (!(Number(v.build) > buildAtual()) || ruins.includes(Number(v.build))) return res;
    const info = await Nat.safe('info');
    if (v.minShell && (!info || (info.shell || 1) < v.minShell)) { S.precisaApk = v.apk || true; render(); return (res = 'apk'); }
    const b = await Nat.call('fetchBundle', { url: v.zip, build: String(v.build), sha256: v.sha256 || '' });
    LS.set('staged', { build: Number(v.build), path: b.path });
    res = 'staged';
    if (manual) { aplicarAtualizacao(); res = 'applied'; }
  } catch (e) {
    res = 'error';
    try { console.warn('atualização: ' + ((e && (e.message || e.code)) || e)); } catch { /* nada */ }
  } finally { UPD.busy = false; }
  return res;
}
async function checarAgora() {
  aviso(t('checking_upd'));
  const r = await checarAtualizacao(true);
  if (r === 'none') aviso(t('up_to_date', { v: versaoTexto() }));
  else if (r === 'error') aviso(t('upd_failed'));
  else if (r === 'apk') aviso(t('upd_apk'));
}
function aplicarAtualizacao() {
  const st = LS.get('staged');
  if (!Nat.on || !st || !(st.build > buildAtual())) { if (st && !(st.build > buildAtual())) LS.del('staged'); return false; }
  LS.set('trying', st.build);
  LS.set('trying_path', st.path);
  LS.del('staged');
  Nat.call('setServerBasePath', { path: st.path }, 'WebView').catch(() => { LS.del('trying'); });
  return true;
}
/* uma versão nova que abriu bem passa a ser a guardada; uma que voltou atrás nunca é tentada de novo */
function confirmarVersao() {
  const tr = LS.get('trying'), caminho = LS.get('trying_path');
  if (tr == null) return;
  LS.del('trying');
  LS.del('trying_path');
  if (Number(tr) === buildAtual()) {
    Nat.safe('keepBundle', { path: caminho || '' });
    Nat.safe('cleanBundles', { keep: [String(tr), String(caminho || '').split('/').pop()] });
  } else {
    const ruins = LS.get('bad') || [];
    if (!ruins.includes(Number(tr))) ruins.push(Number(tr));
    LS.set('bad', ruins.slice(-10));
  }
}
/* troca de versão só quando você sai do app e nada está em andamento */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && podeTrocarVersao() && LS.get('staged')) aplicarAtualizacao();
});
