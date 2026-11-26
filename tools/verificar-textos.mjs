// Confere os textos do app antes de montar:
// 1) frases proibidas (garantir segurança, mandar a pessoa se acalmar, prometer cura, dizer "alarme pronto");
// 2) todo texto existe nos três idiomas (inglês, português, espanhol) e não está vazio;
// 3) todo som e toda música dizem para que servem (relaxar, focar, acalmar, dormir).
// Uso: node tools/verificar-textos.mjs   (sai com erro se algo falhar)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'web', 'src');
const erros = [];

const PROIBIDAS = [
  /you(?: a|')re safe/i, /calm down/i, /just anxiety/i, /\bcures?\b/i, /alarm is ready/i,
  /você está segur[oa]/i, /acalme-se/i, /se acalme/i, /fique calm[oa]/i, /é só ansiedade/i, /\bcura\b/i, /alarme pronto/i,
  /estás a salvo/i, /estás segur[oa]/i, /cálmate/i, /cálmese/i, /solo es ansiedad/i, /alarma lista/i,
];
/* procura só dentro de textos entre aspas, não nos comentários */
const textos = s => (s.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || []);
for (const f of fs.readdirSync(src).filter(x => x.endsWith('.js') || x.endsWith('.html'))) {
  for (const t of textos(fs.readFileSync(path.join(src, f), 'utf8'))) {
    for (const re of PROIBIDAS) if (re.test(t)) erros.push(`${f}: frase proibida ${re} em ${t.slice(0, 80)}`);
  }
}

/* carrega o conteúdo num ambiente isolado e confere os três idiomas */
const ctx = { console, document: { documentElement: {}, querySelector: () => null }, localStorage: { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 } };
vm.createContext(ctx);
for (const f of ['02-idioma.js', '04-dados.js', '05-conteudo.js', '07-sessao.js']) vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8') + '\n;globalThis.__ok = true;', ctx, { filename: f });
const trio = (a, onde) => {
  if (!Array.isArray(a) || a.length !== 3) { erros.push(`${onde}: precisa de [en, pt, es]`); return; }
  a.forEach((s, i) => { if (typeof s !== 'string' || !s.trim()) erros.push(`${onde}: texto vazio em ${['en', 'pt', 'es'][i]}`); });
};
const r = vm.runInContext(`({ STR, TEC, FICHAS_MODO, FONTES, SONS, MODOS, RESPOSTAS, MADRUGADA_DESPERTO, CONTEUDO_REVISAO, USOS, USO_NOME, USO_TITULO, USO_DET, PERFIL, CAMADAS, MUSICAS })`, ctx);
/* cada som e música diz para que serve, nos três idiomas, e tem um peso para cada uso */
for (const u of r.USOS) { trio(r.USO_NOME[u], `USO_NOME.${u}`); trio(r.USO_TITULO[u], `USO_TITULO.${u}`); trio(r.USO_DET[u], `USO_DET.${u}`); }
for (const [v, [pesos, txt]] of Object.entries(r.PERFIL)) {
  trio(txt, `PERFIL.${v}`);
  if (!Array.isArray(pesos) || pesos.length !== r.USOS.length) erros.push(`PERFIL.${v}: precisa de ${r.USOS.length} pesos`);
}
for (const [v] of [...r.SONS.filter(x => x[2] === 'natureza'), ...r.MUSICAS.map(m => [`midia/musicas/${m[0]}.ogg`]), ...r.CAMADAS]) if (!r.PERFIL[v]) erros.push(`PERFIL: falta ${v}`);
for (const [v, n] of r.CAMADAS) trio(n, `CAMADAS.${v}`);
for (const [k, v] of Object.entries(r.STR)) trio(v, `STR.${k}`);
for (const [id, t] of Object.entries(r.TEC)) {
  trio(t.nome, `TEC.${id}.nome`);
  if (t.escolha) trio(t.escolha, `TEC.${id}.escolha`);
  if (t.desc) trio(t.desc, `TEC.${id}.desc`);
  for (const [nome, lista] of [['passos', t.passos], ['volta', t.volta]]) {
    if (!lista) continue;
    lista.forEach((p, i) => {
      if (!Array.isArray(p) || p.length !== 4 || typeof p[0] !== 'number') { erros.push(`TEC.${id}.${nome}[${i}]: precisa de [segundos, en, pt, es]`); return; }
      const vazios = p.slice(1).filter(s => !s).length;
      if (vazios !== 0 && vazios !== 3) erros.push(`TEC.${id}.${nome}[${i}]: silêncio precisa ser vazio nos três idiomas`);
    });
  }
  if (t.ficha) for (const c of ['serve', 'adaptado', 'trocar', 'limite']) trio(t.ficha[c], `TEC.${id}.ficha.${c}`);
  if (t.ficha) for (const k of t.ficha.fontes) if (!r.FONTES[k]) erros.push(`TEC.${id}.ficha: fonte ${k} não existe`);
}
for (const [id, f] of Object.entries(r.FICHAS_MODO)) {
  for (const c of ['nome', 'serve', 'adaptado', 'trocar', 'limite']) trio(f[c], `FICHAS_MODO.${id}.${c}`);
  for (const k of f.fontes) if (!r.FONTES[k]) erros.push(`FICHAS_MODO.${id}: fonte ${k} não existe`);
}
for (const [k, f] of Object.entries(r.FONTES)) { trio(f.nome, `FONTES.${k}.nome`); if (!/^https:\/\//.test(f.url)) erros.push(`FONTES.${k}: link sem https`); }
for (const [v, n] of r.SONS) trio(n, `SONS.${v}`);
for (const [k, n] of Object.entries(r.MODOS)) trio(n, `MODOS.${k}`);
for (const [k, R] of Object.entries(r.RESPOSTAS)) { trio(R.pergunta, `RESPOSTAS.${k}.pergunta`); for (const [v, n] of R.op) trio(n, `RESPOSTAS.${k}.${v}`); }
r.MADRUGADA_DESPERTO.forEach((x, i) => trio(x, `MADRUGADA_DESPERTO[${i}]`));
trio(r.CONTEUDO_REVISAO, 'CONTEUDO_REVISAO');

/* toda chave usada com t('...') existe */
const usadas = new Set();
for (const f of fs.readdirSync(src).filter(x => x.endsWith('.js'))) for (const m of fs.readFileSync(path.join(src, f), 'utf8').matchAll(/\bt\('([a-z0-9_]+)'/g)) usadas.add(m[1]);
for (const k of usadas) if (!r.STR[k]) erros.push(`t('${k}') não existe em STR`);

if (erros.length) { console.error(erros.join('\n')); console.error(`\n${erros.length} problema(s) nos textos.`); process.exit(1); }
console.log(`textos ok: ${Object.keys(r.STR).length} frases da interface, ${Object.keys(r.TEC).length} técnicas, 3 idiomas, nenhuma frase proibida`);
