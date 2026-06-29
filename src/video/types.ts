export type SceneType = 'title' | 'problem' | 'solution' | 'example' | 'closing' | 'content';

export interface WhiteboardScene {
  id: number;
  type: SceneType;
  title: string;
  subtitle: string;
  narration: string;
  bullets: string[];
  duration: number; // frames
  audioUrl: string | null;
  topic?: string;
}

export interface VideoConfig {
  topic: string;
  accentColor: string;
  boardStyle: 'classic' | 'dark' | 'chalk' | 'colorful';
  scenes: WhiteboardScene[];
}

export const BOARD_STYLES = {
  classic:  { bg: '#faf8f5', ink: '#2d2d2d', name: 'Clásica' },
  dark:     { bg: '#1a1a2e', ink: '#e0e0e0', name: 'Oscura' },
  chalk:    { bg: '#2d5016', ink: '#f0f0e8', name: 'Tiza' },
  colorful: { bg: '#fff5eb', ink: '#2d2d2d', name: 'Colorida' },
};

export const ACCENT_COLORS = [
  { color: '#e74444', name: 'Rojo' },
  { color: '#496be3', name: 'Azul' },
  { color: '#28c040', name: 'Verde' },
  { color: '#6330f7', name: 'Púrpura' },
  { color: '#46badd', name: 'Sky Blue' },
  { color: '#e9582b', name: 'Naranja' },
  { color: '#f0b623', name: 'Amarillo' },
];
