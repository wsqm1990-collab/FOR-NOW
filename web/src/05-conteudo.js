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

const SONS = [['silencio', ['Silence', 'Silêncio', 'Silencio']], ['chuva', ['Rain', 'Chuva', 'Lluvia']], ['grave', ['Low noise', 'Ruído grave', 'Ruido grave']], ['ondas', ['Waves', 'Ondas', 'Olas']]];
const nomeSom = id => tr((SONS.find(s => s[0] === id) || SONS[0])[1]);
const listaSons = () => SONS.map(([v, n]) => [v, tr(n)]);
const MODOS = { pico: ['Spike', 'Pico', 'Pico'], paz: ['Peace', 'Paz', 'Paz'], cochilo: ['Nap', 'Cochilo', 'Siesta'], madrugada: ['Night', 'Madrugada', 'Madrugada'] };
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
const nomeTecnica = id => (TEC[id] ? tr(TEC[id].nome) : id);
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
  const travesseiro = [7, tr(['Feel the pillow supporting you.', 'Sinta o apoio do travesseiro.', 'Siente el apoyo de la almohada.'])];
  const descanse = [12, tr(["You can rest now. If you don't fall asleep, that's fine: resting counts.", 'Você pode descansar agora. Se não dormir, tudo bem: descansar já conta.', 'Ya puedes descansar. Si no te duermes, está bien: descansar también cuenta.'])];
  let primeira;
  if (tipo === 'proprio') primeira = [6, tr([`Your alarm is set for ${h}.`, `Seu alarme ficou para ${h}.`, `Tu alarma quedó para las ${h}.`])];
  else if (tipo === 'relogio') primeira = [7, h ? tr([`Your alarm is in the phone's Clock, at ${h}.`, `O despertador está no Relógio do celular, às ${h}.`, `La alarma está en el Reloj del teléfono, a las ${h}.`])
    : tr(["Your alarm is in the phone's Clock.", 'O despertador está no Relógio do celular.', 'La alarma está en el Reloj del teléfono.'])];
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
