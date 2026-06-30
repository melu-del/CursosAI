import { GoogleGenAI } from '@google/genai';

const SCENE_TYPES = ['title', 'problem', 'solution', 'example', 'closing'];

const FPS = 30;
const DEFAULT_DURATION_S = 8;

const DRAWING_INSTRUCTIONS = `
El campo "drawing" es un array de 6 a 14 primitivas SVG para ilustrar el concepto ESPECÍFICO de la escena, como si fuera dibujado a mano en una pizarra. El canvas tiene 400×400 píxeles. Centro en (200,200). Usá el rango 30–370 en x e y.

PRIMITIVAS disponibles:
{ "type": "line",   "x1":N, "y1":N, "x2":N, "y2":N, "color":"...", "w":N }
{ "type": "circle", "cx":N, "cy":N, "r":N,  "color":"...", "fill":true|false, "w":N }
{ "type": "arc",    "cx":N, "cy":N, "r":N,  "start":grados, "end":grados, "color":"...", "w":N }
{ "type": "rect",   "x":N,  "y":N,  "w":N,  "h":N, "color":"...", "fill":true|false }
{ "type": "poly",   "points":[[x,y],...], "color":"...", "fill":true|false, "w":N }
{ "type": "path",   "d":"SVG path", "color":"...", "w":N, "fill":true|false }
{ "type": "text",   "x":N, "y":N, "text":"...", "color":"...", "size":N, "bold":true|false }
{ "type": "dot",    "cx":N, "cy":N, "r":N, "color":"..." }
{ "type": "arrow",  "x1":N, "y1":N, "x2":N, "y2":N, "color":"...", "w":N }

Colores: "accent" (azul marca), "green" (verde éxito), "ink" (negro/texto), "red", "orange", "yellow", "purple", "white"

REGLAS:
- El dibujo debe representar el CONCEPTO PRINCIPAL de la escena (si habla de volcanes → dibujá un volcán; si habla de fotosíntesis → sol + planta; si habla de economía → gráfica con barras; etc.)
- El orden de las primitivas define el orden de animación: empezá con las formas base y terminá con los detalles
- Usá poly para triángulos, montañas, flechas grandes
- Usá path para curvas y formas orgánicas
- Incluí texto solo si es muy representativo (fórmulas, etiquetas clave)
- Hacé el dibujo reconocible con pocas formas (estilo pizarra simple)

EJEMPLOS (seguí este estilo para otros conceptos):

Volcán:
[{"type":"poly","points":[[60,370],[200,60],[340,370]],"color":"ink","fill":false,"w":4},
 {"type":"path","d":"M 165 60 Q 200 10 235 60","color":"orange","fill":true,"w":5},
 {"type":"line","x1":178,"y1":52,"x2":150,"y2":15,"color":"red","w":5},
 {"type":"line","x1":200,"y1":45,"x2":200,"y2":5,"color":"orange","w":5},
 {"type":"line","x1":222,"y1":52,"x2":250,"y2":15,"color":"red","w":5},
 {"type":"path","d":"M 110 220 Q 140 200 170 220 Q 200 240 230 220","color":"accent","w":3},
 {"type":"dot","cx":130,"cy":310,"r":6,"color":"ink"},
 {"type":"dot","cx":260,"cy":310,"r":6,"color":"ink"}]

Célula:
[{"type":"circle","cx":200,"cy":200,"r":150,"color":"green","fill":false,"w":5},
 {"type":"circle","cx":200,"cy":200,"r":55,"color":"accent","fill":true,"w":4},
 {"type":"dot","cx":150,"cy":130,"r":10,"color":"ink"},
 {"type":"dot","cx":270,"cy":155,"r":8,"color":"ink"},
 {"type":"dot","cx":135,"cy":270,"r":10,"color":"ink"},
 {"type":"dot","cx":265,"cy":270,"r":8,"color":"ink"},
 {"type":"dot","cx":310,"cy":220,"r":9,"color":"green"},
 {"type":"path","d":"M 200 355 Q 230 370 200 390","color":"green","w":4}]

Fotosíntesis:
[{"type":"circle","cx":320,"cy":70,"r":50,"color":"yellow","fill":true,"w":4},
 {"type":"line","x1":320,"y1":30,"x2":320,"y2":10,"color":"yellow","w":4},
 {"type":"line","x1":355,"y1":45,"x2":375,"y2":25,"color":"yellow","w":4},
 {"type":"line","x1":360,"y1":70,"x2":385,"y2":70,"color":"yellow","w":4},
 {"type":"path","d":"M 140 380 L 140 200","color":"green","w":6},
 {"type":"path","d":"M 140 250 Q 80 220 60 180","color":"green","w":5},
 {"type":"path","d":"M 140 300 Q 220 270 240 230","color":"green","w":5},
 {"type":"arrow","x1":300,"y1":120,"x2":200,"y2":200,"color":"yellow","w":3},
 {"type":"text","x":85,"y":370,"text":"CO₂+H₂O","color":"ink","size":26},
 {"type":"text","x":220,"y":200,"text":"O₂","color":"green","size":32,"bold":true}]

Corazón / Sistema circulatorio:
[{"type":"path","d":"M 200 290 Q 100 210 100 150 Q 100 90 160 90 Q 190 90 200 120 Q 210 90 240 90 Q 300 90 300 150 Q 300 210 200 290","color":"red","fill":true,"w":4},
 {"type":"arrow","x1":200,"y1":290,"x2":200,"y2":355,"color":"red","w":4},
 {"type":"arrow","x1":200,"y1":355,"x2":80,"y2":290,"color":"accent","w":3},
 {"type":"arrow","x1":80,"y1":250,"x2":200,"y2":180,"color":"accent","w":3}]

Cadena alimentaria:
[{"type":"circle","cx":60,"cy":200,"r":35,"color":"green","fill":true},
 {"type":"text","x":60,"y":205,"text":"🌿","color":"white","size":28},
 {"type":"arrow","x1":100,"y1":200,"x2":155,"y2":200,"color":"ink","w":4},
 {"type":"circle","cx":190,"cy":200,"r":35,"color":"orange","fill":true},
 {"type":"text","x":190,"y":205,"text":"🐛","color":"white","size":28},
 {"type":"arrow","x1":230,"y1":200,"x2":285,"y2":200,"color":"ink","w":4},
 {"type":"circle","cx":320,"cy":200,"r":35,"color":"accent","fill":true},
 {"type":"text","x":320,"y":205,"text":"🐦","color":"white","size":28},
 {"type":"text","x":190,"y":270,"text":"Cadena alimentaria","color":"ink","size":24}]

Generá el dibujo más adecuado para el TEMA ESPECÍFICO de cada escena.`;

const TONE_RULES = {
  informal:    'Tono cercano y amigable, lenguaje simple y directo.',
  profesional: 'Lenguaje cuidado y seguro. Evitá coloquialismos pero sin sonar rígido.',
  formal:      'Lenguaje formal y serio. Oraciones bien estructuradas. Evitá cualquier coloquialismo o informalidad.',
};

const DIALECT_RULES = {
  rioplatense:     'Variante rioplatense: usá "vos" y sus conjugaciones (tenés, sabés, hacés). Sin coloquialismos ni expresiones informales (nada de "che", "dale", etc.). Tono apropiado para capacitaciones corporativas.',
  latinoamericano: 'Español neutro latinoamericano: usá "tú" o formas impersonales. Sin regionalismos ni expresiones locales. Comprensible en toda Latinoamérica.',
};

const DURATION_CONFIG = {
  corto: { scenes: '3 y 4',   scenesMulti: '3 y 4',   words: '25 y 40',   durationS: 10 },
  medio: { scenes: '5 y 7',   scenesMulti: '4 y 6',   words: '50 y 80',   durationS: 18 },
  largo: { scenes: '8 y 12',  scenesMulti: '6 y 10',  words: '100 y 140', durationS: 30 },
};

function buildPrompt(rawText, numVideos, videoType, tone = 'informal', dialect = 'rioplatense', duration = 'medio') {
  const quizSchema = `"quiz": [
      {
        "type": "single",
        "question": "¿Cuál es...?",
        "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
        "correctAnswer": 0,
        "explanation": "Porque..."
      }
    ]`;

  const drawingSchema = `"drawing": [
      {"type": "circle", "cx": 200, "cy": 200, "r": 100, "color": "accent", "fill": false},
      {"type": "arrow",  "x1": 200, "y1": 100, "x2": 200, "y2": 50, "color": "green"}
    ]`;

  const sceneSchemaBase = `{
      "type": "title",
      "title": "¿Qué es X?",
      "subtitle": "Una introducción simple a X",
      "narration": "Texto para leer en voz alta...",
      "bullets": ["Punto clave 1", "Punto clave 2"],
      ${drawingSchema},
      "quiz": []
    }`;

  const sceneSchemaEvaluacion = `{
      "type": "title",
      "title": "¿Qué es X?",
      "subtitle": "Una introducción simple a X",
      "narration": "Texto para leer en voz alta...",
      "bullets": ["Punto clave 1", "Punto clave 2"],
      ${drawingSchema},
      ${quizSchema}
    }`;

  const sceneSchema = videoType === 'evaluacion' ? sceneSchemaEvaluacion : sceneSchemaBase;

  const singleSchema = `{
  "topic": "Título general del video (máx 60 caracteres)",
  "scenes": [
    ${sceneSchema}
  ]
}`;

  const multiSchema = `[
  ${Array.from({ length: numVideos }, (_, i) => `{
    "topic": "Título del video ${i + 1} (máx 60 caracteres)",
    "scenes": [ ...escenas... ]
  }`).join(',\n  ')}
]`;

  const toneRule    = TONE_RULES[tone]       || TONE_RULES.informal;
  const dialectRule = DIALECT_RULES[dialect] || DIALECT_RULES.rioplatense;
  const dur         = DURATION_CONFIG[duration] || DURATION_CONFIG.medio;

  const baseRules = `Reglas:
- Escribí en español.
- Variante: ${dialectRule}
- Formalidad: ${toneRule}
- El campo "narration" es el texto exacto que se va a leer en voz alta.
- El campo "title" es el título de la escena (máx 50 caracteres).
- El campo "subtitle" es un resumen de la escena para mostrar en pantalla (máx 80 caracteres).
- El campo "bullets" son 2-4 puntos clave de esa escena para mostrar visualmente.
- Respondé ÚNICAMENTE con JSON válido, sin texto antes ni después.

Tipos de escena disponibles:
- "title"    → pantalla de título, introducción al tema
- "problem"  → el problema o contexto que justifica el tema
- "solution" → la solución o concepto central
- "example"  → un ejemplo concreto, analogía o caso de uso
- "closing"  → cierre con takeaways y llamado a la acción

${DRAWING_INSTRUCTIONS}`;

  const quizRule = videoType === 'evaluacion'
    ? `- Incluí 2-3 preguntas de evaluación por escena (tipo single choice) basadas en el contenido de esa escena.\n- Cada pregunta debe tener: type "single", question, options (4 opciones), correctAnswer (índice 0-3), explanation.`
    : `- El campo "quiz" debe ser un array vacío [] en todas las escenas.`;

  const rules = `${baseRules}\n\n- La narración de cada escena debe tener entre ${dur.words} palabras.\n- ${quizRule}`;

  const sceneCount = dur.scenes;
  const sceneCountMulti = dur.scenesMulti;

  if (numVideos === 1) {
    return `Sos un experto en crear videos explicativos estilo whiteboard. Analizá el siguiente texto y generá un guión para UN video explicativo de pizarra con entre ${sceneCount} escenas.

${rules}

Formato de respuesta:
${singleSchema}

Texto a analizar:

${rawText}`;
  }

  return `Sos un experto en crear videos explicativos estilo whiteboard. Analizá el siguiente texto y dividilo en ${numVideos} videos independientes. Cada video debe cubrir un subtema o aspecto distinto del contenido, con entre ${sceneCountMulti} escenas cada uno.

${rules}

Formato de respuesta (un array de ${numVideos} videos):
${multiSchema}

Texto a analizar:

${rawText}`;
}

function normalizeScenes(scenes, topic, durationS = DEFAULT_DURATION_S) {
  return scenes.map((s, i) => ({
    id: i + 1,
    type: s.type || SCENE_TYPES[Math.min(i, SCENE_TYPES.length - 1)],
    title: s.title || `Escena ${i + 1}`,
    subtitle: s.subtitle || '',
    narration: s.narration || '',
    bullets: Array.isArray(s.bullets) ? s.bullets : [],
    quiz: Array.isArray(s.quiz) ? s.quiz : [],
    drawing: Array.isArray(s.drawing) ? s.drawing : [],
    duration: durationS * FPS,
    audioUrl: null,
    topic: topic || '',
  }));
}

export async function generateScript(rawText, numVideos = 1, videoType = 'explicativo', tone = 'informal', dialect = 'rioplatense', duration = 'medio') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY en el .env');

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(rawText, numVideos, videoType, tone, dialect, duration);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ parts: [{ text: prompt }] }],
    config: { temperature: 0.7 },
  });

  const raw = response.text?.trim() || '';
  const json = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '');

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Gemini devolvió JSON inválido: ' + raw.slice(0, 200));
  }

  const durationS = (DURATION_CONFIG[duration] || DURATION_CONFIG.medio).durationS;

  if (numVideos === 1) {
    const data = Array.isArray(parsed) ? parsed[0] : parsed;
    return [{ topic: data.topic || '', scenes: normalizeScenes(data.scenes || [], data.topic, durationS) }];
  }

  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr.map(v => ({
    topic: v.topic || '',
    scenes: normalizeScenes(v.scenes || [], v.topic, durationS),
  }));
}
