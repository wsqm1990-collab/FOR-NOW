// Monta o app em web/www/index.html: uma página com estilos e código embutidos, mais os sons.
// Uso: node tools/build.mjs [numeroDaVersao]   (o GitHub passa BUILD_NUMBER)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'web', 'src'), out = path.join(root, 'web', 'www');
const build = Number(process.env.BUILD_NUMBER || process.argv[2] || 0);
const HEAD = ['01-head.html', '01-estilo.css'];
const BODY = ['02-body.html'];
const JS = ['02-idioma.js', '03-nativo.js', '04-dados.js', '05-conteudo.js', '06-guia.js', '07-sessao.js', '08-cochilo.js', '08b-respirar.js',
  '08c-musica.js', '08d-mix.js', '09-aprender.js', '10-ajustes.js', '11-atualizacao.js', '12-telas.js', '13-app.js'];
const read = f => fs.readFileSync(path.join(src, f), 'utf8');
const head = HEAD.map(f => (f.endsWith('.css') ? `<style>\n${read(f)}\n</style>` : read(f))).join('\n');
const body = BODY.map(read).join('\n');
/* frases gravadas (texto -> arquivo dentro do app), feito pelo tools/audio-app.py */
const vozPt = fs.existsSync(path.join(src, 'voz-pt.json')) ? read('voz-pt.json') : '{}';
const creditos = fs.existsSync(path.join(src, 'creditos.json')) ? read('creditos.json') : '[]';
const js = `/* ===== voz-pt.json ===== */\nconst VOZ_PT = ${JSON.stringify(JSON.parse(vozPt))};\n`
  + `/* ===== creditos.json ===== */\nconst CREDITOS = ${JSON.stringify(JSON.parse(creditos))};\n`
  + JS.map(f => `/* ===== ${f} ===== */\n` + read(f)).join('\n');
if (js.includes('</script')) throw new Error('um script contém </script>');

// Se uma versão recém-baixada não conseguir abrir em 15 s, o app volta para a anterior.
const guard = `window.FN_BUILD=${build};
setTimeout(function(){try{var tr=JSON.parse(localStorage.getItem('fn:trying')||'null');if(tr&&tr===window.FN_BUILD&&!window.__fnOk){var C=window.Capacitor,p=window.capacitorExports&&capacitorExports.registerPlugin?capacitorExports.registerPlugin('ForNow'):(C&&C.Plugins&&C.Plugins.ForNow);if(p)p.reloadApp();}}catch(e){}},15000);`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
${head}
</head>
<body>
${body}
<script src="capacitor.js"></script>
<script>${guard}</script>
<script>
${js}
</script>
</body>
</html>
`;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
// os sons ambientes vão ao lado da página (o lado Android também os lê daqui)
const sons = path.join(root, 'web', 'sons');
fs.rmSync(path.join(out, 'sons'), { recursive: true, force: true });
if (fs.existsSync(sons)) fs.cpSync(sons, path.join(out, 'sons'), { recursive: true });
// a fonte da voz (Lora, licença OFL, sem modificação) vai junto
const fontes = path.join(root, 'web', 'fonts');
fs.rmSync(path.join(out, 'fonts'), { recursive: true, force: true });
if (fs.existsSync(fontes)) fs.cpSync(fontes, path.join(out, 'fonts'), { recursive: true });
console.log(`web/www/index.html: versão ${build}, ${(html.length / 1024).toFixed(0)} KB`);
