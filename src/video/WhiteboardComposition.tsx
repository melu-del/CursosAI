import React, { memo } from 'react';
import { AbsoluteFill, useCurrentFrame, Audio, staticFile, Series } from 'remotion';
import type { VideoConfig, WhiteboardScene } from './types';
import { BOARD_STYLES } from './types';

/* ── Easing ──────────────────────────────────────────────────── */
function ease(frame: number, delay: number, dur: number): number {
  const t = Math.max(0, Math.min(1, (frame - delay) / Math.max(dur, 1)));
  return 1 - Math.pow(1 - t, 3);
}

/* ── Primitives ──────────────────────────────────────────────── */
const FadeIn: React.FC<{ p: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ p, children, style }) => {
  if (p <= 0) return null;
  return <div style={{ position: 'absolute', opacity: p, transform: `translateY(${(1 - p) * 14}px)`, ...style }}>{children}</div>;
};

const HW: React.FC<{ text: string; x: number; y: number; size?: number; color: string; bold?: boolean; p: number; center?: boolean }> = ({ text, x, y, size = 42, color, bold, p, center }) => {
  if (p <= 0) return null;
  const chars = Math.floor(Math.min(p, 1) * text.length);
  return (
    <div style={{ position: 'absolute', left: x, top: y, fontSize: size, fontFamily: "'Caveat', cursive", fontWeight: bold ? 700 : 400, color, whiteSpace: 'nowrap', userSelect: 'none', transform: center ? 'translateX(-50%)' : undefined }}>
      {text.slice(0, chars)}
    </div>
  );
};

const Line: React.FC<{ x: number; y: number; w: number; h?: number; color: string; p: number; rotate?: number }> = ({ x, y, w, h = 3, color, p, rotate }) => {
  if (p <= 0) return null;
  return <div style={{ position: 'absolute', left: x, top: y, width: w * Math.min(p, 1), height: h, backgroundColor: color, borderRadius: h / 2, transform: rotate ? `rotate(${rotate}deg)` : undefined, transformOrigin: '0 50%' }} />;
};

const Box: React.FC<{ x: number; y: number; w: number; h: number; color: string; p: number; bg?: string; radius?: number }> = ({ x, y, w, h, color, p, bg, radius = 8 }) => {
  if (p <= 0) return null;
  return <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, border: `3px solid ${color}`, borderRadius: radius, opacity: p, background: bg || 'transparent', transform: `scale(${0.9 + 0.1 * Math.min(p, 1)})`, transformOrigin: 'center' }} />;
};

const Wiggle: React.FC<{ x: number; y: number; w: number; color: string; p: number }> = ({ x, y, w, color, p }) => {
  if (p <= 0) return null;
  return (
    <svg width={w * p} height={20} style={{ position: 'absolute', left: x, top: y, overflow: 'visible' }}>
      <path d={`M 0 10 Q ${w * 0.15} 2, ${w * 0.25} 12 Q ${w * 0.4} 20, ${w * 0.5} 10 Q ${w * 0.65} 0, ${w * 0.75} 12 Q ${w * 0.9} 18, ${w} 10`} stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" />
    </svg>
  );
};

/* ── Board Texture ───────────────────────────────────────────── */
const BoardTexture = memo<{ boardStyle: string }>(({ boardStyle }) => {
  if (boardStyle === 'classic') return (
    <div style={{ position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none' }}>
      {Array.from({ length: 20 }, (_, i) => <div key={i} style={{ position: 'absolute', top: 54 * (i + 1), left: 0, right: 0, height: 1, backgroundColor: '#8a8a8a' }} />)}
    </div>
  );
  if (boardStyle === 'dark') return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)' }} />;
  if (boardStyle === 'chalk') return <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 30, borderTop: '4px solid rgba(240,240,232,0.3)', pointerEvents: 'none' }} />;
  return null;
});

/* ── TITLE SCENE ─────────────────────────────────────────────── */
const TitleScene: React.FC<{ scene: WhiteboardScene; ink: string; accent: string; accent2: string }> = ({ scene, ink, accent, accent2 }) => {
  const f = useCurrentFrame();
  const titleSize = scene.title.length > 30 ? 80 : scene.title.length > 20 ? 100 : 120;
  return (
    <AbsoluteFill>
      <Line x={240} y={160} w={60} color={accent} p={ease(f, 0, 12)} />
      <Line x={240} y={160} w={40} h={3} color={accent} p={ease(f, 0, 12)} rotate={90} />
      <Line x={1620} y={160} w={60} color={accent} p={ease(f, 0, 12)} />
      <Line x={1680} y={160} w={40} h={3} color={accent} p={ease(f, 0, 12)} rotate={90} />
      <HW text={scene.title} x={960} y={300} size={titleSize} bold color={ink} p={ease(f, 2, 35)} center />
      <Wiggle x={340} y={440} w={1240} color={accent} p={ease(f, 34, 18)} />
      {scene.subtitle && <HW text={scene.subtitle} x={960} y={490} size={52} color={accent2} p={ease(f, 48, 22)} center />}
      <FadeIn p={ease(f, 65, 15)} style={{ left: 920, top: 580, fontSize: 80 }}>💡</FadeIn>
      <Line x={240} y={920} w={60} color={accent} p={ease(f, 80, 10)} />
      <Line x={240} y={880} w={40} h={3} color={accent} p={ease(f, 80, 10)} rotate={90} />
      <Line x={1620} y={920} w={60} color={accent} p={ease(f, 80, 10)} />
      <Line x={1680} y={880} w={40} h={3} color={accent} p={ease(f, 80, 10)} rotate={90} />
    </AbsoluteFill>
  );
};

/* ── CONTENT SCENE (problem / solution / content) ────────────── */
const ContentScene: React.FC<{ scene: WhiteboardScene; ink: string; accent: string; accent2: string; green: string }> = ({ scene, ink, accent, accent2, green }) => {
  const f = useCurrentFrame();
  const titleColor = scene.type === 'problem' ? accent : scene.type === 'solution' ? green : accent2;
  const icon = scene.type === 'problem' ? '🤔' : scene.type === 'solution' ? '✅' : '📋';

  return (
    <AbsoluteFill>
      <HW text={scene.title} x={200} y={60} size={76} bold color={titleColor} p={ease(f, 0, 20)} />
      <Wiggle x={200} y={145} w={Math.min(scene.title.length * 28, 800)} color={titleColor} p={ease(f, 18, 12)} />

      <FadeIn p={ease(f, 10, 14)} style={{ left: 200, top: 220, fontSize: 90 }}>{icon}</FadeIn>

      {scene.subtitle && (
        <HW text={scene.subtitle} x={340} y={230} size={36} color={ink} p={ease(f, 22, 16)} />
      )}

      {/* Bullets */}
      <Box x={160} y={320} w={1600} h={Math.min(scene.bullets.length * 110 + 60, 560)} color={titleColor} p={ease(f, 30, 16)} />
      {scene.bullets.slice(0, 5).map((b, i) => (
        <HW key={i} text={`• ${b}`} x={220} y={370 + i * 105} size={36} color={ink} p={ease(f, 40 + i * 12, 14)} />
      ))}
    </AbsoluteFill>
  );
};

/* ── EXAMPLE SCENE ───────────────────────────────────────────── */
const ExampleScene: React.FC<{ scene: WhiteboardScene; ink: string; accent: string; accent2: string; green: string }> = ({ scene, ink, accent, accent2, green }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <HW text={scene.title} x={200} y={60} size={76} bold color={accent2} p={ease(f, 0, 20)} />
      <Wiggle x={200} y={145} w={Math.min(scene.title.length * 28, 800)} color={accent2} p={ease(f, 18, 12)} />

      <FadeIn p={ease(f, 12, 14)} style={{ left: 200, top: 220, fontSize: 90 }}>💡</FadeIn>
      {scene.subtitle && <HW text={scene.subtitle} x={340} y={230} size={36} color={ink} p={ease(f, 22, 16)} />}

      {/* Example boxes */}
      {scene.bullets.slice(0, 4).map((b, i) => {
        const cols = Math.min(scene.bullets.length, 4);
        const boxW = Math.floor((1600 - (cols - 1) * 30) / cols);
        const x = 160 + i * (boxW + 30);
        return (
          <React.Fragment key={i}>
            <Box x={x} y={360} w={boxW} h={300} color={i === 0 ? accent : green} p={ease(f, 35 + i * 14, 14)} />
            <HW text={`${i + 1}.`} x={x + boxW / 2} y={390} size={52} bold color={i === 0 ? accent : green} p={ease(f, 42 + i * 14, 10)} center />
            <HW text={b.slice(0, 40)} x={x + boxW / 2} y={455} size={28} color={ink} p={ease(f, 50 + i * 14, 10)} center />
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

/* ── CLOSING SCENE ───────────────────────────────────────────── */
const ClosingScene: React.FC<{ scene: WhiteboardScene; ink: string; accent: string; accent2: string; green: string }> = ({ scene, ink, accent, accent2, green }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <HW text={scene.title} x={960} y={80} size={90} bold color={accent2} p={ease(f, 0, 20)} center />
      <Wiggle x={700} y={175} w={520} color={accent2} p={ease(f, 16, 10)} />

      {scene.bullets.slice(0, 3).map((b, i) => (
        <React.Fragment key={i}>
          <FadeIn p={ease(f, 24 + i * 20, 10)} style={{ left: 340, top: 240 + i * 150, fontSize: 44, color: green }}>✅</FadeIn>
          <HW text={b} x={420} y={250 + i * 150} size={42} bold color={ink} p={ease(f, 30 + i * 20, 16)} />
        </React.Fragment>
      ))}

      <FadeIn p={ease(f, 85, 16)} style={{ left: 1300, top: 300, fontSize: 120 }}>🚀</FadeIn>
      <Box x={500} y={700} w={920} h={130} color={accent} p={ease(f, 92, 12)} radius={12} />
      {scene.subtitle && <HW text={scene.subtitle} x={960} y={730} size={68} bold color={accent} p={ease(f, 98, 18)} center />}
    </AbsoluteFill>
  );
};

/* ── SINGLE SCENE WRAPPER ────────────────────────────────────── */
const SceneRenderer: React.FC<{ scene: WhiteboardScene; ink: string; accent: string; accent2: string; green: string }> = ({ scene, ink, accent, accent2, green }) => {
  const props = { scene, ink, accent, accent2, green };
  switch (scene.type) {
    case 'title':   return <TitleScene {...props} />;
    case 'example': return <ExampleScene {...props} />;
    case 'closing': return <ClosingScene {...props} />;
    default:        return <ContentScene {...props} />;
  }
};

/* ── MAIN COMPOSITION ────────────────────────────────────────── */
export const WhiteboardComposition: React.FC<{ config: VideoConfig }> = ({ config }) => {
  const { boardStyle, accentColor, scenes } = config;
  const style = BOARD_STYLES[boardStyle];
  const ink = style.ink;
  const accent = accentColor;
  const accent2 = boardStyle === 'dark' ? '#6fd1e7' : '#496be3';
  const green = boardStyle === 'dark' ? '#4ed364' : '#28c040';

  return (
    <AbsoluteFill style={{ backgroundColor: style.bg, overflow: 'hidden' }}>
      <BoardTexture boardStyle={boardStyle} />
      <Series>
        {scenes.map((scene) => (
          <Series.Sequence key={scene.id} durationInFrames={scene.duration}>
            <AbsoluteFill>
              <SceneRenderer scene={scene} ink={ink} accent={accent} accent2={accent2} green={green} />
              {scene.audioUrl && (
                <Audio src={scene.audioUrl.startsWith('/') ? scene.audioUrl : staticFile(scene.audioUrl)} />
              )}
            </AbsoluteFill>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
