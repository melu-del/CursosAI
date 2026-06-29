import { GoogleGenAI } from '@google/genai';

const SCENE_TYPES = ['title', 'problem', 'solution', 'example', 'closing'];

const SYSTEM_PROMPT = `
Sos un experto en crear videos explicativos estilo whiteboard. Tu tarea es analizar
un texto y generar un guión estructurado para un video explicativo de pizarra.

El video tiene entre 3 y 6 escenas. Cada escena usa uno de estos tipos:
- "title"    → pantalla de título, introducción al tema
- "problem"  → el problema o contexto que justifica el tema
- "solution" → la solución o concepto central
- "example"  → un ejemplo concreto, analogía o caso de uso
- "closing"  → cierre con takeaways y llamado a la acción

Reglas:
- Escribí en español neutro / argentino informal (tuteo, tono claro y didáctico).
- El campo "narration" es el texto exacto que se va a leer en voz alta.
  Debe sonar natural, entre 15 y 30 segundos (aprox. 40–80 palabras).
- El campo "title" es el título de la escena (máx 50 caracteres).
- El campo "subtitle" es un resumen de la escena para mostrar en pantalla (máx 80 caracteres).
- El campo "bullets" son 2-4 puntos clave de esa escena para mostrar visualmente.
- Respondé ÚNICAMENTE con JSON válido, sin texto antes ni después.

{
  "topic": "Título general del video (máx 60 caracteres)",
  "scenes": [
    {
      "type": "title",
      "title": "¿Qué es X?",
      "subtitle": "Una introducción simple a X",
      "narration": "Texto para leer en voz alta...",
      "bullets": ["Punto clave 1", "Punto clave 2"]
    }
  ]
}
`;

export async function generateScript(rawText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY en el .env');

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `${SYSTEM_PROMPT}\n\nTexto a analizar:\n\n${rawText.slice(0, 8000)}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ parts: [{ text: prompt }] }],
    config: { temperature: 0.7 },
  });

  const raw = response.text?.trim() || '';
  // Strip markdown fences if present
  const json = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '');

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Gemini devolvió JSON inválido: ' + raw.slice(0, 200));
  }

  // Normalize and add frame durations (will be updated after audio generation)
  const FPS = 30;
  const DEFAULT_DURATION_S = 8;

  return parsed.scenes.map((s, i) => ({
    id: i + 1,
    type: s.type || SCENE_TYPES[Math.min(i, SCENE_TYPES.length - 1)],
    title: s.title || `Escena ${i + 1}`,
    subtitle: s.subtitle || '',
    narration: s.narration || '',
    bullets: Array.isArray(s.bullets) ? s.bullets : [],
    duration: DEFAULT_DURATION_S * FPS, // will be updated after audio
    audioUrl: null,
    topic: parsed.topic || '',
  }));
}
