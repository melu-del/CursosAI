import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveAudioFile } from './_lib/github-storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ON_VERCEL = !!process.env.VERCEL;

const VOICE = 'Puck';
const MODEL = 'gemini-2.5-flash-preview-tts';
const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const BIT_DEPTH = 16;
const FPS = 30;
const PADDING_S = 1.2;

/** PCM base64 → WAV buffer */
function pcmToWav(pcmBase64) {
  const pcm = Buffer.from(pcmBase64, 'base64');
  const byteRate = SAMPLE_RATE * CHANNELS * (BIT_DEPTH / 8);
  const blockAlign = CHANNELS * (BIT_DEPTH / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BIT_DEPTH, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function wavDurationS(buf) {
  try {
    const byteRate = buf.readUInt32LE(28);
    const dataSize = buf.readUInt32LE(40);
    return byteRate > 0 ? dataSize / byteRate : 8;
  } catch { return 8; }
}

async function synthesize(ai, text) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  const audioPart = parts.find(p => p.inlineData?.mimeType?.startsWith('audio/'));
  if (!audioPart) throw new Error('Gemini TTS no devolvió audio para: ' + text.slice(0, 60));

  return pcmToWav(audioPart.inlineData.data);
}

export async function generateAudio(scenes, courseId, onProgress = () => {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY en el .env');

  const ai = new GoogleGenAI({ apiKey });
  const audioDir = path.join(ROOT, 'storage', courseId, 'audio');
  if (!ON_VERCEL) fs.mkdirSync(audioDir, { recursive: true });

  const enriched = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene.narration) {
      enriched.push(scene);
      continue;
    }

    const filename = `scene_${i + 1}.wav`;
    const audioUrl = ON_VERCEL
      ? `/api/storage?course=${courseId}&file=${filename}`
      : `/storage/${courseId}/audio/${filename}`;

    console.log(`[audio] Generando escena ${i + 1}/${scenes.length}...`);
    try {
      const wav = await synthesize(ai, scene.narration);
      if (ON_VERCEL) {
        await saveAudioFile(courseId, filename, wav);
      } else {
        fs.writeFileSync(path.join(audioDir, filename), wav);
      }
      const durationS = wavDurationS(wav);
      const durationFrames = Math.ceil((durationS + PADDING_S) * FPS);
      enriched.push({ ...scene, audioUrl, duration: durationFrames });
    } catch (err) {
      console.warn(`[audio] Error en escena ${i + 1}:`, err.message);
      enriched.push({ ...scene, duration: 8 * FPS });
    }

    onProgress(enriched.length);
    await new Promise(r => setTimeout(r, 300));
  }

  return enriched;
}
