# Whiteboard AI

Generador de videos explicativos estilo pizarra a partir de documentos.

## Cómo arrancar

```bash
# 1. Instalá dependencias
npm install

# 2. Configurá el .env
cp .env.example .env
# Editá .env y agregá tu GEMINI_API_KEY

# 3. Arrancá la app (API + frontend en paralelo)
npm run dev
```

Abrí http://localhost:5174

## Cómo usarla

1. Subí un PDF, DOCX o pegá texto directo
2. Hacé clic en **Generar guión con IA** — Gemini genera las escenas
3. Revisá el preview con las animaciones whiteboard
4. Hacé clic en **Agregar narración** — genera audio TTS por escena
5. Exportá a MP4

## Stack

- **Frontend**: React + TypeScript + Vite
- **Video**: Remotion (composición y render)
- **Backend**: Express (API local)
- **IA**: Gemini 2.0 Flash (guión) + Gemini TTS (narración)
- **Estilo**: Whiteboard con Caveat font, animaciones CSS puras
