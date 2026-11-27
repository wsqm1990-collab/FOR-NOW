/* ---------- conteúdo: roteiros, fichas e fontes ----------
   Roteiros autorais, frases curtas, uma instrução por vez.
   Cada passo: [segundos, inglês, português, espanhol]. Texto vazio = silêncio
   (a tela mantém a última frase, mais apagada). Versão do conteúdo: 1 · nov/2026. */
const CONTEUDO_VERSAO = 1;
const CONTEUDO_REVISAO = ['Nov 2026', 'nov/2026', 'nov/2026'];

const FONTES = {
  opas: { nome: ['PAHO/WHO — Doing What Matters in Times of Stress (Brazilian edition)', 'OPAS/OMS — Faça o que importa em tempos de estresse (versão adaptada para o Brasil)', 'OPS/OMS — En tiempos de estrés, haz lo que importa (edición de Brasil)'], url: 'https://www.paho.org/pt/documentos/faca-que-importa-em-tempos-estresse-guia-ilustrado-versao-adaptada-para-brasil' },
  nhsResp: { nome: ['NHS — Breathing exercise for stress', 'NHS — Exercício de respiração para o estresse', 'NHS — Ejercicio de respiración para el estrés'], url: 'https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/' },
  nhsPmr: { nome: ['NHS Inform — Progressive muscle relaxation', 'NHS Inform — Relaxamento muscular progressivo', 'NHS Inform — Relajación muscular progresiva'], url: 'https://www.nhsinform.scot/healthy-living/mental-wellbeing/breathing-and-relaxation-exercises/progressive-muscle-relaxation/' },
  papola: { nome: ['Papola et al., JAMA Psychiatry, 2024 — psychotherapies for generalized anxiety (65 studies)', 'Papola e colaboradores, JAMA Psychiatry, 2024 — psicoterapias para ansiedade generalizada (65 estudos)', 'Papola y colaboradores, JAMA Psychiatry, 2024 — psicoterapias para la ansiedad generalizada (65 estudios)'], url: 'https://pubmed.ncbi.nlm.nih.gov/37851421/' },
  mayo: { nome: ['Mayo Clinic — Napping for adults', 'Mayo Clinic — Cochilos em adultos', 'Mayo Clinic — Siestas en adultos'], url: 'https://www.mayoclinic.org/healthy-lifestyle/adult-health/in-depth/napping/art-20048319' },
  nhlbi: { nome: ['NHLBI — Insomnia treatment and stimulus control', 'NHLBI — Tratamento da insônia e controle de estímulos', 'NHLBI — Tratamiento del insomnio y control de estímulos'], url: 'https://www.nhlbi.nih.gov/health/insomnia/treatment' },
  riemann: { nome: ['Riemann et al. — European insomnia guideline, 2023', 'Riemann e colaboradores — Diretriz europeia de insônia, 2023', 'Riemann y colaboradores — Guía europea de insomnio, 2023'], url: 'https://pubmed.ncbi.nlm.nih.gov/38016484/' },
  samu: { nome: ['Brazilian Ministry of Health — SAMU 192', 'Ministério da Saúde — SAMU 192', 'Ministerio de Salud de Brasil — SAMU 192'], url: 'https://www.gov.br/saude/pt-br/composicao/saes/samu-192' },
  ubs: { nome: ['Brazilian Ministry of Health — Anxiety in primary care', 'Ministério da Saúde — Ansiedade na atenção primária', 'Ministerio de Salud de Brasil — Ansiedad en atención primaria'], url: 'https://linhasdecuidado.saude.gov.br/portal/ansiedade/unidade-de-atencao-primaria/' },
};

/* sons de fundo. "midia/..." são gravações que vêm dentro do app (natureza e músicas);
   os outros são feitos em código e servem no navegador e como reserva. */
const SONS = [
  ['silencio', ['Silence', 'Silêncio', 'Silencio'], 'base'],
  /* gravações reais (BigSoundBank, CC0) */
  ['midia/sons/N01.ogg', ['Summer rain', 'Chuva de verão', 'Lluvia de verano'], 'natureza'],
  ['midia/sons/N06.ogg', ['Rain on a tent', 'Chuva na barraca', 'Lluvia en la carpa'], 'natureza'],
  ['midia/sons/N02.ogg', ['Sea', 'Mar', 'Mar'], 'natureza'],
  ['midia/sons/N03.ogg', ['Countryside night', 'Noite no campo', 'Noche en el campo'], 'natureza'],
  ['midia/sons/N04.ogg', ['Stream', 'Riacho', 'Arroyo'], 'natureza'],
  ['midia/sons/N05.ogg', ['Fireplace', 'Lareira', 'Chimenea'], 'natureza'],
  /* ruídos e batidas binaurais (feitos em código: tools/binaural.py) */
  ['midia/ruidos/marrom.ogg', ['Brown noise', 'Ruído marrom', 'Ruido marrón'], 'ruido'],
  ['midia/ruidos/rosa.ogg', ['Pink noise', 'Ruído rosa', 'Ruido rosa'], 'ruido'],
  ['midia/ruidos/branco.ogg', ['White noise', 'Ruído branco', 'Ruido blanco'], 'ruido'],
  ['midia/binaural/delta.ogg', ['Binaural delta, 2 Hz', 'Binaural delta, 2 Hz', 'Binaural delta, 2 Hz'], 'binaural'],
  ['midia/binaural/teta.ogg', ['Binaural theta, 6 Hz', 'Binaural teta, 6 Hz', 'Binaural theta, 6 Hz'], 'binaural'],
  ['midia/binaural/alfa.ogg', ['Binaural alpha, 10 Hz', 'Binaural alfa, 10 Hz', 'Binaural alfa, 10 Hz'], 'binaural'],
  ['midia/binaural/beta.ogg', ['Binaural beta, 16 Hz', 'Binaural beta, 16 Hz', 'Binaural beta, 16 Hz'], 'binaural'],
  ['midia/binaural/gama.ogg', ['Binaural gamma, 40 Hz', 'Binaural gama, 40 Hz', 'Binaural gamma, 40 Hz'], 'binaural'],
  /* só no navegador (testes), quando não há gravações */
  ['grave', ['Soft noise', 'Ruído suave', 'Ruido suave'], 'reserva'],
  ['chuva', ['Simple rain', 'Chuva simples', 'Lluvia simple'], 'reserva'],
  ['ondas', ['Simple waves', 'Ondas simples', 'Olas simples'], 'reserva'],
];
const MUSICAS = [
  /* piano de verdade, gravações livres: Musopen (CC0), Open Goldberg (CC0), Musopen via Wikimedia Commons */
  ['R01', ['Chopin: Nocturne Op. 9 No. 2', 'Chopin: Noturno Op. 9 nº 2', 'Chopin: Nocturno Op. 9 n.º 2'], 'piano'],
  ['R02', ['Chopin: Nocturne Op. 9 No. 1', 'Chopin: Noturno Op. 9 nº 1', 'Chopin: Nocturno Op. 9 n.º 1'], 'piano'],
  ['R03', ['Chopin: Nocturne Op. 27 No. 2', 'Chopin: Noturno Op. 27 nº 2', 'Chopin: Nocturno Op. 27 n.º 2'], 'piano'],
  ['R04', ['Chopin: Nocturne Op. 55 No. 2', 'Chopin: Noturno Op. 55 nº 2', 'Chopin: Nocturno Op. 55 n.º 2'], 'piano'],
  ['R05', ['Chopin: Nocturne Op. 62 No. 2', 'Chopin: Noturno Op. 62 nº 2', 'Chopin: Nocturno Op. 62 n.º 2'], 'piano'],
  ['R06', ['Chopin: Nocturne Op. 72 No. 1', 'Chopin: Noturno Op. 72 nº 1', 'Chopin: Nocturno Op. 72 n.º 1'], 'piano'],
  ['R07', ['Bach: Goldberg Aria', 'Bach: Ária das Variações Goldberg', 'Bach: Aria de las Variaciones Goldberg'], 'piano'],
  ['R08', ['Satie: Gymnopédie No. 1', 'Satie: Gymnopédie nº 1', 'Satie: Gymnopédie n.º 1'], 'piano'],
  /* feitas com ElevenLabs */
  ['M03', ['Strings, adagio', 'Cordas em adágio', 'Cuerdas en adagio'], 'classica'],
  ['M04', ['Celtic harp', 'Harpa celta', 'Arpa celta'], 'celta'],
  ['M07', ['Celtic flute', 'Celta com flauta', 'Celta con flauta'], 'celta'],
  ['M08', ['Ethereal choir', 'Coral etéreo', 'Coro etéreo'], 'canticos'],
  ['M10', ['Soft guitar', 'Violão suave', 'Guitarra suave'], 'violao'],
  ['M11', ['Gentle morning', 'Manhã suave', 'Mañana suave'], 'manha'],
];
const CATEGORIAS = [
  ['piano', ['Piano', 'Piano', 'Piano']],
  ['classica', ['Classical', 'Clássica', 'Clásica']],
  ['celta', ['Celtic', 'Celta', 'Celta']],
  ['canticos', ['Choir', 'Coral', 'Coro']],
  ['violao', ['Guitar', 'Violão', 'Guitarra']],
  ['manha', ['Morning', 'Manhã', 'Mañana']],
  ['natureza', ['Nature', 'Natureza', 'Naturaleza']],
  ['ruido', ['Noise', 'Ruídos', 'Ruidos']],
  ['binaural', ['Binaural', 'Binaurais', 'Binaurales']],
];
/* o que saiu do app e o que ficou no lugar (para escolhas e mixes antigos continuarem tocando) */
const SUBSTITUI = {
  'midia/musicas/M01.ogg': 'midia/musicas/R01.ogg', 'midia/musicas/M02.ogg': 'midia/musicas/R03.ogg',
  'midia/musicas/M05.ogg': 'midia/musicas/M08.ogg', 'midia/musicas/M06.ogg': 'midia/musicas/R08.ogg',
  'midia/musicas/M09.ogg': 'midia/musicas/R05.ogg',
};
const ID_SUBSTITUI = { M01: 'R01', M02: 'R03', M05: 'M08', M06: 'R08', M09: 'R05' };
const caminhoMusica = id => `midia/musicas/${id}.ogg`;
/* tudo o que pode tocar ao fundo, com o nome e a categoria */
const FUNDOS = [...SONS.map(([v, n, c]) => ({ v, n, c })), ...MUSICAS.map(([id, n, c]) => ({ v: caminhoMusica(id), n, c, musica: id }))];
/* o mix não tem mais instrumentos feitos em código (soavam sintéticos) */
const CAMADAS = [];
const nomeSom = id => {
  if (id && id.startsWith('mix:')) { const m = Mix.de(id); return m ? m.nome : tr(SONS[0][1]); }
  const c = CAMADAS.find(x => x[0] === id);
  if (c) return tr(c[1]);
  const f = FUNDOS.find(x => x.v === id);
  return tr((f || FUNDOS[0]).n);
};

/* ---------- para que serve cada som e música ----------
   Quatro usos. Cada som tem um peso para cada uso [relaxar, focar, acalmar, dormir] (o maior é o
   uso principal) e uma frase curta do porquê. Os pesos também decidem a categoria de um mix. */
const USOS = ['relaxar', 'focar', 'acalmar', 'dormir'];
const USO_NOME = { relaxar: ['Relax', 'Relaxar', 'Relajarse'], focar: ['Focus', 'Focar', 'Concentrarse'], acalmar: ['Soothe', 'Acalmar', 'Calmarse'], dormir: ['Sleep', 'Dormir', 'Dormir'] };
const USO_TITULO = { relaxar: ['To relax', 'Para relaxar', 'Para relajarte'], focar: ['To focus', 'Para focar', 'Para concentrarte'], acalmar: ['To soothe', 'Para acalmar', 'Para calmarte'], dormir: ['To sleep', 'Para dormir', 'Para dormir'] };
const USO_DET = {
  relaxar: ['To unwind: warm and pleasant.', 'Para desacelerar: quente e agradável.', 'Para bajar el ritmo: cálido y agradable.'],
  focar: ['To study or work: steady, no words.', 'Para estudar ou trabalhar: constante, sem palavras.', 'Para estudiar o trabajar: constante, sin palabras.'],
  acalmar: ['When anxiety rises: slow and steady.', 'Quando a ansiedade sobe: lento e firme.', 'Cuando sube la ansiedad: lento y firme.'],
  dormir: ['To fall asleep: low, slow, barely changing.', 'Para pegar no sono: grave, lento, quase sem mudar.', 'Para dormirte: grave, lento, casi sin cambios.'],
};
const PERFIL = {
  'midia/sons/N01.ogg': [[0.10, 0.35, 0.10, 0.45], ['Real summer rain, heavy drops on a terrace', 'Chuva de verão de verdade, gotas grossas num terraço', 'Lluvia de verano real, gotas gruesas en una terraza']],
  'midia/sons/N06.ogg': [[0.10, 0.30, 0.15, 0.45], ['Real rain on a tent, steady', 'Chuva de verdade batendo numa barraca, constante', 'Lluvia real sobre una carpa, constante']],
  'midia/sons/N02.ogg': [[0.30, 0.05, 0.50, 0.15], ['Real small waves, at the pace of a calm breath', 'Ondas pequenas de verdade, no ritmo de uma respiração calma', 'Olas pequeñas reales, al ritmo de una respiración tranquila']],
  'midia/sons/N03.ogg': [[0.25, 0.05, 0.10, 0.60], ['Crickets on a countryside night, recorded live', 'Grilos numa noite de campo, gravados ao vivo', 'Grillos en una noche de campo, grabados en vivo']],
  'midia/sons/N04.ogg': [[0.30, 0.50, 0.15, 0.05], ['A real mountain stream, clear and continuous', 'Riacho de montanha de verdade, claro e contínuo', 'Arroyo de montaña real, claro y continuo']],
  'midia/sons/N05.ogg': [[0.60, 0.10, 0.15, 0.15], ['A real fireplace, soft crackling', 'Lareira de verdade, estalos suaves', 'Chimenea real, crujidos suaves']],
  'midia/ruidos/marrom.ogg': [[0.05, 0.50, 0.10, 0.35], ['Deep, even noise, like a distant river; covers other sounds', 'Ruído grave e uniforme, como um rio distante; cobre outros barulhos', 'Ruido grave y uniforme, como un río lejano; tapa otros ruidos']],
  'midia/ruidos/rosa.ogg': [[0.10, 0.25, 0.15, 0.50], ['Balanced noise, like fine steady rain', 'Ruído equilibrado, como chuva fina e constante', 'Ruido equilibrado, como lluvia fina y constante']],
  'midia/ruidos/branco.ogg': [[0.05, 0.65, 0.05, 0.25], ['Even hiss that covers voices and noise', 'Chiado uniforme que cobre vozes e barulhos', 'Siseo uniforme que tapa voces y ruidos']],
  'midia/binaural/delta.ogg': [[0.05, 0.00, 0.15, 0.80], ['A tone in each ear, heard as a very slow pulse (2 per second). Headphones.', 'Um tom em cada ouvido, ouvido como um pulso bem lento (2 por segundo). Use fones.', 'Un tono en cada oído, que se oye como un pulso muy lento (2 por segundo). Usa auriculares.']],
  'midia/binaural/teta.ogg': [[0.20, 0.00, 0.60, 0.20], ['Slow pulse (6 per second), common in meditation. Headphones.', 'Pulso lento (6 por segundo), comum em meditação. Use fones.', 'Pulso lento (6 por segundo), común en meditación. Usa auriculares.']],
  'midia/binaural/alfa.ogg': [[0.60, 0.20, 0.15, 0.05], ['Pulse of 10 per second, linked to awake calm. Headphones.', 'Pulso de 10 por segundo, ligado à calma acordada. Use fones.', 'Pulso de 10 por segundo, ligado a la calma despierta. Usa auriculares.']],
  'midia/binaural/beta.ogg': [[0.05, 0.85, 0.05, 0.05], ['Faster pulse (16 per second), for attention. Headphones.', 'Pulso mais rápido (16 por segundo), para atenção. Use fones.', 'Pulso más rápido (16 por segundo), para la atención. Usa auriculares.']],
  'midia/binaural/gama.ogg': [[0.05, 0.85, 0.05, 0.05], ['Fast pulse (40 per second), used for concentration. Headphones.', 'Pulso rápido (40 por segundo), usado para concentração. Use fones.', 'Pulso rápido (40 por segundo), usado para concentrarse. Usa auriculares.']],
  'midia/musicas/R01.ogg': [[0.60, 0.15, 0.15, 0.10], ['Real piano: a calm, singing melody', 'Piano de verdade: melodia cantada e tranquila', 'Piano real: melodía cantada y tranquila']],
  'midia/musicas/R02.ogg': [[0.25, 0.05, 0.55, 0.15], ['Real piano, slow and soft, a little wistful', 'Piano de verdade, lento e suave, um pouco melancólico', 'Piano real, lento y suave, algo melancólico']],
  'midia/musicas/R03.ogg': [[0.20, 0.05, 0.15, 0.60], ['Real piano, soft and flowing, unhurried', 'Piano de verdade, macio, fluindo sem pressa', 'Piano real, suave, fluye sin prisa']],
  'midia/musicas/R04.ogg': [[0.60, 0.20, 0.10, 0.10], ['Real piano: two lines talking slowly', 'Piano de verdade: duas linhas conversando devagar', 'Piano real: dos líneas que conversan despacio']],
  'midia/musicas/R05.ogg': [[0.20, 0.05, 0.60, 0.15], ['Real piano, serene and singing', 'Piano de verdade, sereno e cantado', 'Piano real, sereno y cantado']],
  'midia/musicas/R06.ogg': [[0.15, 0.05, 0.20, 0.60], ['Real piano, simple and slow, gently rocking', 'Piano de verdade, simples e lento, que embala', 'Piano real, sencillo y lento, que mece']],
  'midia/musicas/R07.ogg': [[0.20, 0.55, 0.15, 0.10], ['Real piano, clear and orderly, steady pace', 'Piano de verdade, claro e ordenado, ritmo constante', 'Piano real, claro y ordenado, ritmo constante']],
  'midia/musicas/R08.ogg': [[0.20, 0.10, 0.15, 0.55], ['Real piano, very slow and spacious', 'Piano de verdade, bem lento e espaçoso', 'Piano real, muy lento y espacioso']],
  'midia/musicas/M03.ogg': [[0.25, 0.05, 0.60, 0.10], ['Long, gentle strings with no big moments', 'Cordas longas e suaves, sem momentos fortes', 'Cuerdas largas y suaves, sin momentos fuertes']],
  'midia/musicas/M04.ogg': [[0.60, 0.15, 0.15, 0.10], ['Light harp, a peaceful old tune', 'Harpa leve, melodia antiga e tranquila', 'Arpa ligera, melodía antigua y tranquila']],
  'midia/musicas/M07.ogg': [[0.60, 0.15, 0.15, 0.10], ['Soft flute over harp, misty and calm', 'Flauta suave sobre harpa, calma e enevoada', 'Flauta suave sobre arpa, calma y brumosa']],
  'midia/musicas/M08.ogg': [[0.10, 0.00, 0.30, 0.60], ['Soft, long voices that float', 'Vozes suaves e longas que flutuam', 'Voces suaves y largas que flotan']],
  'midia/musicas/M10.ogg': [[0.30, 0.55, 0.10, 0.05], ['Gentle guitar, no words, steady pace', 'Violão dedilhado, sem palavras, ritmo constante', 'Guitarra punteada, sin palabras, ritmo constante']],
  'midia/musicas/M11.ogg': [[0.25, 0.65, 0.05, 0.05], ['Light and bright, to start or keep going', 'Leve e clara, para começar ou seguir em frente', 'Ligera y clara, para empezar o seguir adelante']],
};
const usoDe = v => {
  if (v && v.startsWith('mix:')) { const m = Mix.de(v); return m ? m.cat : null; }
  const p = PERFIL[v];
  return p ? USOS[p[0].indexOf(Math.max(...p[0]))] : null;
};
const porQue = v => (PERFIL[v] ? tr(PERFIL[v][1]) : '');
/* uma música como fundo: ela e as outras do mesmo estilo, uma depois da outra (null se não é música) */
function listaDoEstilo(v) {
  const m = /^midia\/musicas\/([MR]\d\d)\.ogg$/.exec(v || '');
  return m ? Mus.lista(m[1], 'estilo') : null;
}
/* versão 8D: o som gira devagar em volta de você (com fones). Só no que vai para o Android. */
const tem8D = v => /^midia\/(musicas|sons)\/\w+\.ogg$/.test(v || '');
const com8D = v => (prefs().oitoD && temMidia() && tem8D(v)) ? v.replace('midia/', 'midia/8d/') : v;
/* gravações só existem no app instalado; no navegador ficam os sons feitos em código */
const temMidia = () => !!(Nat.on && window.__fnMidia !== false);
const listaSons = () => FUNDOS.filter(f => f.c !== 'reserva' && (temMidia() || !f.v.startsWith('midia/'))).map(f => [f.v, tr(f.n)]);
const MODOS = { pico: ['Spike', 'Pico', 'Pico'], paz: ['Peace', 'Paz', 'Paz'], cochilo: ['Nap', 'Cochilo', 'Siesta'], madrugada: ['Night', 'Madrugada', 'Madrugada'], respirar: ['Breathing', 'Respiração', 'Respiración'], musica: ['Music', 'Música', 'Música'] };
const nomeModo = m => tr(MODOS[m] || m);
const rotuloPrincipal = () => t(prefs().rotulo === 'pico' ? 'btn_pico' : 'btn_dificil');

const TEC = {
  /* ----- pico ----- */
  ambiente: {
    modo: 'pico', nome: ["What's around you", 'O que está em volta', 'Lo que te rodea'],
    escolha: ["Keep going with what's around you", 'Continuar com o que está em volta', 'Seguir con lo que te rodea'],
    passos: [
      [8, 'Feel where your feet meet the floor.', 'Sinta onde os pés encontram o chão.', 'Siente dónde tus pies tocan el suelo.'],
      [5, 'Pick one object in front of you.', 'Escolha um objeto à sua frente.', 'Elige un objeto frente a ti.'],
      [8, 'Notice a color or a detail on it.', 'Repare numa cor ou num detalhe dele.', 'Fíjate en un color o en un detalle.'],
      [8, 'Now notice a sound nearby.', 'Agora perceba um som por perto.', 'Ahora nota un sonido cercano.'],
      [14, 'You can just stay with that for a moment.', 'Pode ficar só com isso por um momento.', 'Puedes quedarte solo con eso un momento.'],
    ],
    /* quando você volta para o ambiente (pelo Trocar, ou de novo na mesma sessão) */
    volta: [
      [6, "That's okay. Come back to what's around you.", 'Tudo bem. Volte para o que está em volta.', 'Está bien. Vuelve a lo que te rodea.'],
      [10, 'Touch something near you and notice its texture.', 'Encoste a mão em alguma coisa e repare na textura.', 'Toca algo cerca de ti y fíjate en su textura.'],
      [10, "Notice if it's cool or warm, smooth or rough.", 'Repare se é frio ou morno, liso ou áspero.', 'Nota si está frío o tibio, liso o áspero.'],
      [14, 'Now find three things of the same color.', 'Agora encontre com os olhos três coisas da mesma cor.', 'Ahora encuentra con la vista tres cosas del mismo color.'],
      [16, 'You can just stay with that for a moment.', 'Pode ficar só com isso por um momento.', 'Puedes quedarte solo con eso un momento.'],
    ],
    ficha: {
      serve: ["Bring your attention to what's around you when your mind races, to get through the moment.", 'Trazer a atenção para o que está em volta quando a cabeça acelera, para atravessar o momento.', 'Llevar la atención a lo que te rodea cuando la mente se acelera, para atravesar el momento.'],
      fontes: ['opas'],
      adaptado: ['Short sentences, one at a time. The first one makes sense even if you stop listening after it.', 'Frases curtas, uma por vez. A primeira faz sentido mesmo que você pare de ouvir depois dela.', 'Frases cortas, una a la vez. La primera tiene sentido aunque dejes de escuchar después.'],
      trocar: ["If looking around is making you more agitated, switch or stop. There's no right way.", 'Se olhar em volta estiver te deixando mais agitado, troque ou encerre. Não existe jeito certo.', 'Si mirar alrededor te pone más agitado, cambia o termina. No hay una forma correcta.'],
      limite: ["The WHO guide was studied as a whole; this exercise on its own has little direct research. A spike can also ease by itself, so feeling better afterwards doesn't prove the exercise did it.", 'O guia da OMS foi estudado como um conjunto; este exercício isolado tem pouca pesquisa direta. Um pico também pode aliviar sozinho, então a melhora depois do exercício não prova que foi ele.', 'La guía de la OMS se estudió como un conjunto; este ejercicio por sí solo tiene poca investigación directa. Un pico también puede aliviarse solo, así que sentirte mejor después no prueba que haya sido el ejercicio.'],
    },
  },
  respiracao: {
    modo: 'pico', nome: ['Breathe slowly', 'Respirar devagar', 'Respirar despacio'], escolha: ['Breathe slowly', 'Respirar devagar', 'Respirar despacio'],
    passos: [
      [6, 'Let the air come in however it comes.', 'Deixe o ar entrar do jeito que vier.', 'Deja que el aire entre como venga.'],
      [7, 'Let it out slowly, no rush.', 'Solte devagar, sem pressa.', 'Suéltalo despacio, sin prisa.'],
      [7, 'No need to fill your chest or hold your breath.', 'Não precisa encher o peito nem prender o ar.', 'No hace falta llenar el pecho ni contener el aire.'],
      [12, 'Just let the out-breath be a little slower.', 'Só deixe a saída do ar ficar um pouco mais lenta.', 'Solo deja que la salida del aire sea un poco más lenta.'],
      [24, 'Keep going like this, at your own pace.', 'Continue assim, no seu ritmo.', 'Sigue así, a tu ritmo.'],
      [10, '', '', ''],
    ],
    ficha: {
      serve: ['Give your body a slower rhythm, without forcing.', 'Dar ao corpo um ritmo mais lento, sem forçar.', 'Darle al cuerpo un ritmo más lento, sin forzar.'],
      fontes: ['nhsResp'],
      adaptado: ['No counting, no holding your breath, no big breaths in. Just a slightly slower out-breath.', 'Sem contar, sem prender o ar e sem inspirações grandes. Só a saída do ar um pouco mais lenta.', 'Sin contar, sin contener el aire y sin inspiraciones grandes. Solo la salida del aire un poco más lenta.'],
      trocar: ["Paying attention to breathing or your heartbeat makes some people feel worse, especially in a spike. If that's you, tap Switch: the app goes straight back to what's around you.", 'Prestar atenção na respiração ou no coração deixa algumas pessoas pior, principalmente num pico. Se for o seu caso, toque em Trocar: o app volta direto para o que está em volta.', 'Prestar atención a la respiración o al corazón empeora a algunas personas, sobre todo en un pico. Si es tu caso, toca Cambiar: la app vuelve directo a lo que te rodea.'],
      limite: ['Responses vary from person to person.', 'A resposta varia de pessoa para pessoa.', 'La respuesta varía de persona a persona.'],
    },
  },
  som: {
    modo: 'pico', nome: ['Listen to a sound', 'Ouvir um som', 'Escuchar un sonido'], escolha: ['Listen to a sound', 'Ouvir um som', 'Escuchar un sonido'], usaSom: true,
    passos: [
      [10, 'Choose a sound and stay with it for a moment.', 'Escolha um som e fique com ele por um instante.', 'Elige un sonido y quédate con él un instante.'],
      [20, "When you notice you've started talking with a thought, you can come back to the sound.", 'Quando perceber que começou a conversar com um pensamento, pode voltar ao som.', 'Cuando notes que empezaste a conversar con un pensamiento, puedes volver al sonido.'],
      [24, 'No need to empty your mind. Just come back, as many times as it takes.', 'Não precisa esvaziar a cabeça. É só voltar, quantas vezes for.', 'No hace falta vaciar la mente. Solo vuelve, las veces que haga falta.'],
      [20, 'You can just stay with the sound.', 'Pode ficar só com o som.', 'Puedes quedarte solo con el sonido.'],
    ],
    ficha: {
      serve: ['Give your attention a place to rest: a sound. When a thought pulls, you come back.', 'Dar à atenção um lugar para descansar: um som. Quando um pensamento puxar, você volta.', 'Darle a la atención un lugar donde descansar: un sonido. Cuando un pensamiento te arrastre, vuelves.'],
      fontes: ['opas'],
      adaptado: ['You choose the sound: rain, low noise, waves or the sound of where you are.', 'Você escolhe o som: chuva, ruído grave, ondas ou o som do lugar onde você está.', 'Tú eliges el sonido: lluvia, ruido grave, olas o el sonido del lugar donde estás.'],
      trocar: ['If the sound bothers you, change the sound (top of the screen) or the technique.', 'Se o som incomodar, troque o som (no alto da tela) ou a técnica.', 'Si el sonido te molesta, cambia el sonido (arriba en la pantalla) o la técnica.'],
      limite: ['Background sound is a personal preference. No sound here promises a special effect.', 'Som de ambiente é preferência pessoal. Nenhum som aqui tem efeito especial prometido.', 'El sonido ambiente es preferencia personal. Ningún sonido aquí promete un efecto especial.'],
    },
  },
  /* ----- paz ----- */
  musculos: {
    modo: 'paz', nome: ['Let the body go', 'Soltar o corpo', 'Soltar el cuerpo'], escolha: ['5 min · Let the body go', '5 min · Soltar o corpo', '5 min · Soltar el cuerpo'],
    desc: ['Hands, shoulders, face and legs, slowly.', 'Mãos, ombros, rosto e pernas, devagar.', 'Manos, hombros, cara y piernas, despacio.'], minutos: 5,
    passos: [
      [7, "If it's comfortable, gently close your hands.", 'Se for confortável, feche as mãos de leve.', 'Si te resulta cómodo, cierra las manos suavemente.'],
      [14, 'Now let go. Notice the difference.', 'Agora solte. Repare na diferença.', 'Ahora suelta. Nota la diferencia.'],
      [7, 'Lift your shoulders a little, without forcing.', 'Suba um pouco os ombros, sem forçar.', 'Sube un poco los hombros, sin forzar.'],
      [16, 'And let them drop. Let your shoulders rest.', 'E deixe que desçam. Deixe os ombros descansarem.', 'Y déjalos caer. Deja que los hombros descansen.'],
      [9, 'If any part hurts, you can just let go, without squeezing.', 'Se alguma parte doer, pode só soltar, sem apertar.', 'Si alguna parte duele, puedes solo soltar, sin apretar.'],
      [6, 'Gently scrunch your forehead and eyes.', 'Franza de leve a testa e os olhos.', 'Frunce suavemente la frente y los ojos.'],
      [16, 'Let your face go: forehead, eyes, jaw.', 'Solte o rosto: a testa, os olhos, o maxilar.', 'Suelta la cara: la frente, los ojos, la mandíbula.'],
      [7, 'Press your feet gently into the floor.', 'Empurre os pés de leve contra o chão.', 'Presiona suavemente los pies contra el suelo.'],
      [16, 'And let your legs go.', 'E solte as pernas.', 'Y suelta las piernas.'],
      [22, "Now let your body be heavy where it's resting.", 'Agora deixe o corpo pesar onde está apoiado.', 'Ahora deja que el cuerpo pese donde está apoyado.'],
      [30, 'Nothing else to do. Stay as long as you like.', 'Não precisa fazer mais nada. Fique o quanto quiser.', 'No hace falta hacer nada más. Quédate el tiempo que quieras.'],
    ],
    ficha: {
      serve: ['Release tension from the body, slowly, a few areas at a time.', 'Soltar tensão do corpo, devagar, por poucas regiões.', 'Soltar tensión del cuerpo, despacio, por pocas zonas.'],
      fontes: ['nhsPmr', 'papola'],
      adaptado: ['Few areas, little force. If something hurts, you just let go, without squeezing. The voice leaves after about two minutes.', 'Poucas regiões e pouca força. Se algo doer, você só solta, sem apertar. A voz sai depois de uns dois minutos.', 'Pocas zonas y poca fuerza. Si algo duele, solo sueltas, sin apretar. La voz se va después de unos dos minutos.'],
      trocar: ['If paying attention to your body feels uncomfortable, tap Switch to stay with a sound.', 'Se prestar atenção no corpo te deixar desconfortável, toque em Trocar para ficar com um som.', 'Si prestar atención al cuerpo te incomoda, toca Cambiar para quedarte con un sonido.'],
      limite: ['Relaxation tends to help in the short term. In the review of 65 studies, the longest-lasting effect came from CBT.', 'Relaxamento costuma ajudar no curto prazo. Na revisão de 65 estudos, o efeito mais duradouro foi o da TCC.', 'La relajación suele ayudar a corto plazo. En la revisión de 65 estudios, el efecto más duradero fue el de la TCC.'],
    },
  },
  somLongo: {
    modo: 'paz', nome: ['Stay with a sound', 'Ficar com um som', 'Quedarte con un sonido'], escolha: ['10 min · Stay with a sound', '10 min · Ficar com um som', '10 min · Quedarte con un sonido'],
    desc: ['Your attention rests on a sound. The voice leaves early.', 'A atenção descansa num som. A voz sai cedo.', 'La atención descansa en un sonido. La voz se va pronto.'], minutos: 10, usaSom: true,
    passos: [
      [12, 'Choose a sound and stay with it for a moment.', 'Escolha um som e fique com ele por um instante.', 'Elige un sonido y quédate con él un instante.'],
      [40, "When you notice you've started talking with a thought, you can come back to the sound.", 'Quando perceber que começou a conversar com um pensamento, pode voltar ao som.', 'Cuando notes que empezaste a conversar con un pensamiento, puedes volver al sonido.'],
      [60, 'No need to empty your mind. Just come back, as many times as it takes.', 'Não precisa esvaziar a cabeça. É só voltar, quantas vezes for.', 'No hace falta vaciar la mente. Solo vuelve, las veces que haga falta.'],
      [20, "I'll be quiet now. Stay with the sound.", 'Eu fico em silêncio agora. Continue com o som.', 'Ahora me quedo en silencio. Sigue con el sonido.'],
    ],
    ficha: {
      serve: ['Awake rest, with your attention on a sound.', 'Descanso acordado, com a atenção num som.', 'Descanso despierto, con la atención en un sonido.'],
      fontes: ['opas'],
      adaptado: ['The voice leaves after a little over two minutes. The rest is the sound you chose or silence, with no surprise at the end.', 'A voz sai depois de pouco mais de dois minutos. O resto é o som escolhido ou silêncio, sem surpresa no fim.', 'La voz se va después de poco más de dos minutos. El resto es el sonido elegido o silencio, sin sorpresa al final.'],
      trocar: ['If the silence or the sound bothers you, change the sound at the top of the screen.', 'Se o silêncio ou o som incomodar, troque o som no alto da tela.', 'Si el silencio o el sonido te molesta, cambia el sonido arriba en la pantalla.'],
      limite: ['Background sound is a personal preference. No sound here promises a special effect.', 'Som de ambiente é preferência pessoal. Nenhum som aqui tem efeito especial prometido.', 'El sonido ambiente es preferencia personal. Ningún sonido aquí promete un efecto especial.'],
    },
  },
  /* ----- uso interno ----- */
  momento: {
    modo: 'pico', nome: ['One more moment', 'Mais um momento', 'Un momento más'], usaSom: true,
    passos: [[10, 'Stay a little longer. Nothing to do.', 'Fique mais um pouco. Não precisa fazer nada.', 'Quédate un poco más. No hace falta hacer nada.'], [50, '', '', '']],
  },
  soltar: {
    modo: 'madrugada', nome: ['Let the body go (night)', 'Soltar o corpo (madrugada)', 'Soltar el cuerpo (madrugada)'],
    passos: [
      [10, 'Let your body sink into the mattress.', 'Deixe o corpo pesar no colchão.', 'Deja que el cuerpo pese sobre el colchón.'],
      [10, 'Let your shoulders go.', 'Solte os ombros.', 'Suelta los hombros.'],
      [14, 'Let your face go: forehead, eyes, jaw.', 'Solte o rosto: a testa, os olhos, o maxilar.', 'Suelta la cara: la frente, los ojos, la mandíbula.'],
      [12, 'Let your hands be heavy.', 'Deixe as mãos pesadas.', 'Deja que las manos pesen.'],
      [16, 'No need to fall asleep now. Resting counts.', 'Não precisa dormir agora. Descansar já conta.', 'No hace falta dormir ahora. Descansar también cuenta.'],
      [20, 'If thoughts come, let them pass like noise outside.', 'Se vierem pensamentos, deixe que passem como barulho lá fora.', 'Si vienen pensamientos, deja que pasen como ruido afuera.'],
      [8, "I'll be quiet now.", 'Eu vou ficar em silêncio.', 'Me voy a quedar en silencio.'],
      [50, '', '', ''],
    ],
  },
};
const nomeTecnica = id => (TEC[id] ? tr(TEC[id].nome) : id && id.startsWith('resp_') && RESP[id.slice(5)] ? tr(RESP[id.slice(5)].nome) : id === 'musica' ? tr(MODOS.musica) : id);
/* os passos de uma técnica no idioma atual: [[texto, segundos], ...] */
function passosDe(id, volta) {
  const t = TEC[id];
  const lista = volta && t.volta ? t.volta : t.passos;
  return lista.map(p => [tr([p[1], p[2], p[3]]), p[0]]);
}

/* fichas dos momentos que não são técnicas da lista */
const FICHAS_MODO = {
  cochilo: {
    nome: ['Nap', 'Cochilo', 'Siesta'],
    serve: ['Rest or nap, ideally early in the afternoon, and then notice how your energy feels.', 'Descansar ou cochilar, de preferência no começo da tarde, e depois perceber como ficou sua disposição.', 'Descansar o dormir una siesta, de preferencia temprano en la tarde, y después notar cómo quedó tu energía.'],
    fontes: ['mayo'],
    adaptado: ['20 minutes counted from the moment you tap Start, including the time to fall asleep. You can adjust it. The app only says the alarm is set after checking with Android.', '20 minutos contados do toque em Começar, já com o tempo para adormecer. Você ajusta. O app só diz que o alarme está marcado depois de conferir com o Android.', '20 minutos contados desde que tocas Empezar, incluido el tiempo para dormirte. Puedes ajustarlo. La app solo dice que la alarma está puesta después de confirmarlo con Android.'],
    trocar: ['If you wake up groggier or your night gets worse after naps, try earlier, shorter, or just an awake pause.', 'Se você acorda mais grogue ou a noite piora depois dos cochilos, experimente mais cedo, mais curto ou só uma pausa acordada.', 'Si despiertas más aturdido o la noche empeora después de las siestas, prueba más temprano, más corta o solo una pausa despierto.'],
    limite: ["Time of day, length and your night's sleep change the effect.", 'Horário, duração e o seu sono da noite mudam o efeito.', 'La hora, la duración y tu sueño de la noche cambian el efecto.'],
  },
  madrugada: {
    nome: ['Awake in the night', 'Acordei de madrugada', 'Me desperté de madrugada'],
    serve: ['Ease the struggle with sleep and put the phone down.', 'Diminuir a luta com o sono e largar o celular.', 'Disminuir la lucha con el sueño y dejar el teléfono.'],
    fontes: ['nhlbi', 'riemann'],
    adaptado: ['Dark screen, no clock, no questions. The advice to get up comes from stimulus control, with no timer.', 'Tela escura, sem relógio e sem perguntas. A orientação de levantar vem do controle de estímulos, sem cronômetro.', 'Pantalla oscura, sin reloj y sin preguntas. La sugerencia de levantarte viene del control de estímulos, sin cronómetro.'],
    trocar: ['If getting up is hard, find a comfortable position and just rest.', 'Se levantar for difícil, escolha uma posição confortável e só descanse.', 'Si levantarte es difícil, busca una posición cómoda y solo descansa.'],
    limite: ["This is not full CBT-I, the first-line treatment for chronic insomnia. If the trouble keeps coming back and affects your day, it's worth getting an assessment.", 'Isto não é a TCC-I completa, que é o tratamento de primeira linha para insônia crônica. Se a dificuldade se repete e atrapalha seu dia, vale procurar avaliação.', 'Esto no es la TCC-I completa, el tratamiento de primera línea para el insomnio crónico. Si la dificultad se repite y afecta tu día, vale la pena buscar una evaluación.'],
  },
};

/* roteiros do cochilo, com o horário já confirmado */
function roteiroCochilo(tipo, alvo) {
  const h = alvo ? hhmm(alvo) : '';
  /* com a voz gravada, a frase é fixa (a hora fica na tela); com a voz do celular, ela diz a hora */
  const escolher = (fixa, comHora) => (!h || clipe(tr(fixa))) ? tr(fixa) : tr(comHora);
  const travesseiro = [7, tr(['Feel the pillow supporting you.', 'Sinta o apoio do travesseiro.', 'Siente el apoyo de la almohada.'])];
  const descanse = [12, tr(["You can rest now. If you don't fall asleep, that's fine: resting counts.", 'Você pode descansar agora. Se não dormir, tudo bem: descansar já conta.', 'Ya puedes descansar. Si no te duermes, está bien: descansar también cuenta.'])];
  let primeira;
  if (tipo === 'proprio') primeira = [6, escolher(['Your alarm is set.', 'Seu despertador está marcado.', 'Tu alarma está puesta.'],
    [`Your alarm is set for ${h}.`, `Seu alarme ficou para ${h}.`, `Tu alarma quedó para las ${h}.`])];
  else if (tipo === 'relogio') primeira = [7, escolher(["Your alarm is in the phone's Clock.", 'O despertador está no Relógio do celular.', 'La alarma está en el Reloj del teléfono.'],
    [`Your alarm is in the phone's Clock, at ${h}.`, `O despertador está no Relógio do celular, às ${h}.`, `La alarma está en el Reloj del teléfono, a las ${h}.`])];
  else return [[tr(['This rest has no alarm.', 'Este descanso não tem despertador.', 'Este descanso no tiene alarma.']), 6], [travesseiro[1], 7], [tr(['You can rest now.', 'Você pode descansar agora.', 'Ya puedes descansar.']), 10]];
  return [[primeira[1], primeira[0]], [travesseiro[1], travesseiro[0]], [descanse[1], descanse[0]]];
}

/* madrugada, bem desperto: só texto, sem cronômetro */
const MADRUGADA_DESPERTO = [
  ["If it's safe and comfortable for you, get up for a while.", 'Se for seguro e confortável para você, levante por um tempo.', 'Si es seguro y cómodo para ti, levántate un rato.'],
  ['Do something calm, in dim light.', 'Faça algo tranquilo, com pouca luz.', 'Haz algo tranquilo, con poca luz.'],
  ['Go back to bed when you feel sleepy.', 'Volte para a cama quando sentir sono.', 'Vuelve a la cama cuando sientas sueño.'],
  ['If getting up is hard, find a comfortable position and just rest.', 'Se levantar for difícil, escolha uma posição confortável e só descanse.', 'Si levantarte es difícil, busca una posición cómoda y solo descansa.'],
];

/* ---------- respiração guiada ----------
   Cada exercício é uma lista de fases [tipo, segundos]. A voz guia os dois primeiros ciclos;
   depois ficam o círculo e uma vibração curta a cada fase. */
const RESP = {
  quadrada: {
    nome: ['Box breathing', 'Respiração quadrada', 'Respiración cuadrada'],
    det: ['In 4, hold 4, out 4, pause 4', 'Inspire 4, segure 4, solte 4, pausa 4', 'Inhala 4, sostén 4, suelta 4, pausa 4'],
    fases: [['in', 4], ['hold', 4], ['out', 4], ['pausa', 4]],
    intro: ['Box breathing. Breathe in, hold, breathe out and pause, all for the same time. Follow the circle.', 'Respiração quadrada. Inspire, segure, solte e faça uma pausa, todos no mesmo tempo. Siga o círculo.', 'Respiración cuadrada. Inhala, sostén, suelta y haz una pausa, todo con el mismo tiempo. Sigue el círculo.'],
  },
  r478: {
    nome: ['4-7-8 breathing', 'Respiração 4-7-8', 'Respiración 4-7-8'],
    det: ['In 4, hold 7, out 8', 'Inspire 4, segure 7, solte 8', 'Inhala 4, sostén 7, suelta 8'],
    fases: [['in', 4], ['hold', 7], ['out', 8]], aviso: true,
    intro: ['Four, seven, eight breathing. Breathe in counting to four, hold to seven and let it out slowly to eight.', 'Respiração quatro, sete, oito. Inspire contando até quatro, segure até sete e solte devagar até oito.', 'Respiración cuatro, siete, ocho. Inhala contando hasta cuatro, sostén hasta siete y suelta despacio hasta ocho.'],
  },
  coerente: {
    nome: ['Coherent breathing', 'Respiração coerente', 'Respiración coherente'],
    det: ['In 5 and out 5, like a wave', 'Inspire 5 e solte 5, como uma onda', 'Inhala 5 y suelta 5, como una ola'],
    fases: [['in', 5], ['out', 5]],
    intro: ['Coherent breathing. Breathe in and out at the same pace, slowly, like a wave.', 'Respiração coerente. Inspire e solte no mesmo ritmo, devagar, como uma onda.', 'Respiración coherente. Inhala y suelta al mismo ritmo, despacio, como una ola.'],
  },
  longa: {
    nome: ['Long exhale', 'Expiração longa', 'Exhalación larga'],
    det: ['In 4, out 6', 'Inspire 4, solte 6', 'Inhala 4, suelta 6'],
    fases: [['in', 4], ['out', 6]],
    intro: ['Long exhale. Let the breath out last longer than the breath in.', 'Expiração longa. Deixe a saída do ar ficar mais longa que a entrada.', 'Exhalación larga. Deja que la salida del aire dure más que la entrada.'],
  },
  suspiro: {
    nome: ['Double sigh', 'Suspiro duplo', 'Suspiro doble'],
    det: ['Two breaths in, one long breath out', 'Duas entradas de ar, uma saída longa', 'Dos entradas de aire, una salida larga'],
    fases: [['in', 2.5], ['in2', 1.2], ['outLonga', 6], ['pausa', 3]], aviso: true,
    intro: ['Double sigh. Breathe in through your nose, take in a little more, and let it all out very slowly through your mouth.', 'Suspiro duplo. Puxe o ar pelo nariz, puxe mais um pouquinho, e solte tudo bem devagar pela boca.', 'Suspiro doble. Toma aire por la nariz, toma un poquito más y suéltalo todo muy despacio por la boca.'],
  },
  livre: {
    nome: ['Your own timing', 'No seu tempo', 'A tu ritmo'],
    det: ['Choose each time', 'Você escolhe cada tempo', 'Tú eliges cada tiempo'],
    fases: null,
    intro: ['Breathing at your own timing. Follow the circle.', 'Respiração no seu tempo. Siga o círculo.', 'Respiración a tu ritmo. Sigue el círculo.'],
  },
};
const RESP_AVISO = ['If it feels uncomfortable, go back to breathing normally. You can shorten the times.', 'Se ficar desconfortável, volte a respirar normalmente. Pode encurtar os tempos.', 'Si te resulta incómodo, vuelve a respirar normalmente. Puedes acortar los tiempos.'];
const RESP_FIM = [
  ['You can go back to breathing at your own pace.', 'Pode voltar a respirar no seu ritmo.', 'Puedes volver a respirar a tu ritmo.'],
  ['Notice how your body feels now.', 'Repare como o corpo está agora.', 'Nota cómo está tu cuerpo ahora.'],
];
/* o que a voz diz em cada fase: [primeiro ciclo, segundo ciclo] */
const RESP_FALA = {
  in: [['Breathe in through your nose.', 'Inspire pelo nariz.', 'Inhala por la nariz.'], ['Breathe in.', 'Inspire.', 'Inhala.']],
  in2: [['A little more air.', 'Mais um pouquinho de ar.', 'Un poquito más de aire.'], ['A little more air.', 'Mais um pouquinho de ar.', 'Un poquito más de aire.']],
  hold: [['Hold the air.', 'Segure o ar.', 'Sostén el aire.'], ['Hold.', 'Segure.', 'Sostén.']],
  out: [['Let the air out slowly.', 'Solte o ar devagar.', 'Suelta el aire despacio.'], ['Breathe out.', 'Solte.', 'Suelta.']],
  outLonga: [['And let it all out, slowly.', 'E solte tudo, bem devagar.', 'Y suéltalo todo, despacio.'], ['Breathe out.', 'Solte.', 'Suelta.']],
  pausa: [['Pause.', 'Pausa.', 'Pausa.'], ['Pause.', 'Pausa.', 'Pausa.']],
};
const RESP_ROTULO = { in: ['Breathe in', 'Inspire', 'Inhala'], in2: ['A little more', 'Mais um pouco', 'Un poco más'], hold: ['Hold', 'Segure', 'Sostén'], out: ['Breathe out', 'Solte', 'Suelta'], outLonga: ['Breathe out', 'Solte', 'Suelta'], pausa: ['Pause', 'Pausa', 'Pausa'] };

/* ---------- dormir: relaxamento guiado do corpo, com música que vai sumindo ---------- */
const DORMIR = [
  ['Lie down in the way that is most comfortable for you.', 'Deite do jeito mais confortável para você.', 'Acuéstate de la forma más cómoda para ti.'],
  ['Put the phone aside. You do not need to look at the screen.', 'Deixe o celular de lado. Não precisa olhar para a tela.', 'Deja el teléfono a un lado. No necesitas mirar la pantalla.'],
  ['Let the air out slowly, a little longer than usual.', 'Solte o ar devagar, um pouco mais longo que o normal.', 'Suelta el aire despacio, un poco más largo de lo normal.'],
  ['Once more. Let the breath out be slow.', 'Mais uma vez. Deixe a saída do ar ficar lenta.', 'Una vez más. Deja que la salida del aire sea lenta.'],
  ['Now bring your attention to your feet.', 'Agora leve a atenção para os pés.', 'Ahora lleva la atención a los pies.'],
  ['Let your feet be heavy, sinking into the mattress.', 'Deixe os pés pesados, afundando no colchão.', 'Deja los pies pesados, hundiéndose en el colchón.'],
  ['Move up to your legs. Let your legs be loose.', 'Suba para as pernas. Deixe as pernas soltas.', 'Sube a las piernas. Deja las piernas sueltas.'],
  ['Your hips and belly can rest too.', 'O quadril e a barriga também podem descansar.', 'La cadera y la barriga también pueden descansar.'],
  ['Notice your chest rising and falling, without controlling anything.', 'Repare no peito subindo e descendo, sem controlar nada.', 'Nota el pecho subiendo y bajando, sin controlar nada.'],
  ['Now your hands. Let your hands be heavy and warm.', 'Agora as mãos. Deixe as mãos pesadas e mornas.', 'Ahora las manos. Deja las manos pesadas y tibias.'],
  ['Your arms, up to your shoulders. Let your shoulders drop.', 'Os braços, até os ombros. Deixe os ombros descerem.', 'Los brazos, hasta los hombros. Deja que los hombros bajen.'],
  ['Your neck can rest on the pillow.', 'O pescoço pode descansar no travesseiro.', 'El cuello puede descansar en la almohada.'],
  ['Release your jaw, your tongue, your forehead and your eyes.', 'Solte o maxilar, a língua, a testa e os olhos.', 'Suelta la mandíbula, la lengua, la frente y los ojos.'],
  ['If thoughts come, let them pass, like clouds.', 'Se vierem pensamentos, deixe que passem, como nuvens.', 'Si vienen pensamientos, deja que pasen, como nubes.'],
  ['You do not need to try to sleep. Resting already counts.', 'Não precisa tentar dormir. Descansar já conta.', 'No necesitas intentar dormir. Descansar ya cuenta.'],
  ['Imagine a peaceful place where you like to be.', 'Imagine um lugar tranquilo, onde você gosta de estar.', 'Imagina un lugar tranquilo, donde te gusta estar.'],
  ['Notice the colors, the sounds and the temperature of that place.', 'Repare nas cores, nos sons e na temperatura desse lugar.', 'Nota los colores, los sonidos y la temperatura de ese lugar.'],
  ['Let your body get heavier and heavier.', 'Deixe o corpo cada vez mais pesado.', 'Deja que el cuerpo esté cada vez más pesado.'],
  ['I will be quiet now. The music goes on for a while.', 'Eu vou ficar em silêncio agora. A música continua por um tempo.', 'Me quedaré en silencio ahora. La música sigue un rato.'],
  ['Good night.', 'Boa noite.', 'Buenas noches.'],
];
