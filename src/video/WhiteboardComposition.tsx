import React, { memo } from 'react';
import { AbsoluteFill, useCurrentFrame, Audio, staticFile, Series, interpolate } from 'remotion';
import type { VideoConfig, WhiteboardScene, DrawPrimitive } from './types';
import { BOARD_STYLES } from './types';

/* ────────────────────────────────────────────────────────────
   EASING
──────────────────────────────────────────────────────────── */
function easeOut(f: number, delay: number, dur: number) {
  const t = Math.max(0, Math.min(1, (f - delay) / Math.max(dur, 1)));
  return 1 - Math.pow(1 - t, 3);
}

// easeOutBack: slight overshoot then settle — for UI pops (bullets, pills, CTA)
function springOut(f: number, delay: number, dur: number): number {
  const t = Math.max(0, Math.min(1, (f - delay) / Math.max(dur, 1)));
  if (t >= 1) return 1;
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Returns the current "pen tip" position (SVG canvas coords) for a DrawPrimitive at progress t ∈ [0,1]
function primTip(prim: DrawPrimitive, t: number): [number, number] {
  const lp = (a: number, b: number, u: number) => a + (b - a) * u;
  switch (prim.type) {
    case 'line': case 'arrow':
      return [lp(prim.x1, prim.x2, t), lp(prim.y1, prim.y2, t)];
    case 'circle': {
      const angle = -Math.PI / 2 + t * 2 * Math.PI;
      return [prim.cx + prim.r * Math.cos(angle), prim.cy + prim.r * Math.sin(angle)];
    }
    case 'arc': {
      const sr = (prim.start * Math.PI) / 180, er = (prim.end * Math.PI) / 180;
      const angle = sr + t * (er - sr);
      return [prim.cx + prim.r * Math.cos(angle), prim.cy + prim.r * Math.sin(angle)];
    }
    case 'rect': {
      const { x, y, w, h } = prim;
      const d = t * 2 * (w + h);
      if (d < w)         return [x + d, y];
      if (d < w + h)     return [x + w, y + d - w];
      if (d < 2*w + h)   return [x + w - (d - w - h), y + h];
      return [x, y + h - (d - 2*w - h)];
    }
    case 'poly': {
      if (!prim.points?.length) return [200, 200];
      const pts: [number,number][] = [...prim.points, prim.points[0]];
      let totalLen = 0;
      for (let i = 1; i < pts.length; i++) totalLen += Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
      let target = t * totalLen, acc = 0;
      for (let i = 1; i < pts.length; i++) {
        const seg = Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
        if (acc + seg >= target) {
          const frac = seg > 0 ? (target - acc) / seg : 0;
          return [pts[i-1][0] + frac*(pts[i][0]-pts[i-1][0]), pts[i-1][1] + frac*(pts[i][1]-pts[i-1][1])];
        }
        acc += seg;
      }
      return pts[pts.length-1];
    }
    case 'dot':   return [prim.cx, prim.cy];
    case 'text':  return [prim.x + t * (prim.text?.length ?? 0) * (prim.size ?? 24) * 0.55, prim.y];
    default:      return [200, 200];
  }
}

/* ────────────────────────────────────────────────────────────
   DRAWING CANVAS — renders AI-generated primitives one by one
──────────────────────────────────────────────────────────── */
const COLOR_MAP: Record<string, string> = {
  red: '#e74444', orange: '#e9582b', yellow: '#f0b623',
  purple: '#6330f7', white: '#ffffff', green: 'green_placeholder',
  accent: 'accent_placeholder', ink: 'ink_placeholder',
};

function resolveColor(c: string | undefined, accent: string, green: string, ink: string, lightBg = false): string {
  if (!c) return ink;
  if (c === 'accent') return accent;
  if (c === 'green')  return green;
  if (c === 'ink')    return ink;
  if (c === 'accent_light') return accent + '88';
  if (c === 'green_light')  return green + '88';
  // white is invisible on light boards — use ink instead
  if (c === 'white' && lightBg) return ink;
  return COLOR_MAP[c] ?? c;
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = (startDeg * Math.PI) / 180;
  const e = (endDeg   * Math.PI) / 180;
  const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function arrowHead(x1: number, y1: number, x2: number, y2: number, size = 14): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a1 = angle + 2.5;
  const a2 = angle - 2.5;
  return `M ${x2} ${y2} L ${x2 + size * Math.cos(a1)} ${y2 + size * Math.sin(a1)}
          M ${x2} ${y2} L ${x2 + size * Math.cos(a2)} ${y2 + size * Math.sin(a2)}`;
}

const DrawingCanvas: React.FC<{
  primitives: DrawPrimitive[];
  f: number;
  sceneDuration: number;
  startAt?: number;
  accent: string; green: string; ink: string;
  lightBg?: boolean;
  scale?: number;
  offsetX?: number; offsetY?: number;
}> = ({ primitives, f, sceneDuration, startAt = 10, accent, green, ink, lightBg = false, scale = 1, offsetX = 0, offsetY = 0 }) => {
  if (!primitives || primitives.length === 0) return null;

  // Each stroke takes DRAW_DUR frames to animate.
  // Their start times are evenly spread from startAt to (sceneDuration - DRAW_DUR - END_PAD).
  const DRAW_DUR = 22;
  const END_PAD  = 20;
  const spread   = Math.max(0, sceneDuration - startAt - DRAW_DUR - END_PAD);
  const n        = primitives.length;
  const primStart = (i: number) =>
    startAt + (n <= 1 ? 0 : (i / (n - 1)) * spread);

  const rc = (c?: string) => resolveColor(c, accent, green, ink, lightBg);

  // Find the actively-animating primitive for the pen nib
  let nibX = -999, nibY = -999, nibOpacity = 0;
  for (let i = 0; i < primitives.length; i++) {
    const ps = primStart(i);
    const localT = (f - ps) / DRAW_DUR;
    if (localT > 0 && localT < 1) {
      const [nx, ny] = primTip(primitives[i], Math.min(localT, 1));
      nibX = nx; nibY = ny;
      nibOpacity = Math.min(localT * 4, 1) * Math.min((1 - localT) * 4, 1);
      break;
    }
  }

  return (
    <svg
      style={{ position: 'absolute', left: offsetX, top: offsetY, overflow: 'visible' }}
      width={1} height={1}
    >
      <defs>
        <filter id="hd" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.022 0.038" numOctaves="3" seed="7" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.8" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <radialGradient id="nib-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <g transform={`scale(${scale})`} filter="url(#hd)">
        {primitives.map((prim, i) => {
          const pStart = primStart(i);
          const p = easeOut(f, pStart, DRAW_DUR);
          if (p <= 0) return null;

          const PL = 1000;
          const drawn = Math.min(p, 1);
          const offset = PL * (1 - drawn);
          const baseStroke: React.SVGProps<SVGPathElement> = {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: PL,
            strokeDashoffset: offset,
          };

          switch (prim.type) {
            case 'line': {
              const d = `M ${prim.x1} ${prim.y1} L ${prim.x2} ${prim.y2}`;
              return (
                <path key={i} d={d} stroke={rc(prim.color)} strokeWidth={prim.w ?? 4}
                  fill="none" pathLength={PL} {...baseStroke} />
              );
            }

            case 'circle': {
              const { cx, cy, r } = prim;
              const d = `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`;
              const fillColor = prim.fill ? rc(prim.color) + '30' : 'none';
              return (
                <path key={i} d={d} stroke={rc(prim.color)} strokeWidth={prim.w ?? 4}
                  fill={fillColor} pathLength={PL} {...baseStroke} />
              );
            }

            case 'arc': {
              const d = arcPath(prim.cx, prim.cy, prim.r, prim.start, prim.end);
              return (
                <path key={i} d={d} stroke={rc(prim.color)} strokeWidth={prim.w ?? 4}
                  fill="none" pathLength={PL} {...baseStroke} />
              );
            }

            case 'rect': {
              const { x, y, w, h } = prim;
              const d = `M ${x} ${y} L ${x+w} ${y} L ${x+w} ${y+h} L ${x} ${y+h} Z`;
              const fillColor = prim.fill ? rc(prim.color) + '25' : 'none';
              return (
                <path key={i} d={d} stroke={rc(prim.color)} strokeWidth={prim.sw ?? 4}
                  fill={fillColor} pathLength={PL} {...baseStroke} />
              );
            }

            case 'poly': {
              if (!prim.points?.length) return null;
              const d = prim.points.map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') + ' Z';
              const fillColor = prim.fill ? rc(prim.color) + '25' : 'none';
              return (
                <path key={i} d={d} stroke={rc(prim.color)} strokeWidth={prim.w ?? 4}
                  fill={fillColor} pathLength={PL} {...baseStroke} />
              );
            }

            case 'path': {
              const fillColor = prim.fill ? rc(prim.color) + '25' : 'none';
              return (
                <path key={i} d={prim.d} stroke={rc(prim.color)} strokeWidth={prim.w ?? 4}
                  fill={fillColor} pathLength={PL} {...baseStroke} />
              );
            }

            case 'dot': {
              const { cx, cy, r = 8 } = prim;
              return (
                <circle key={i} cx={cx} cy={cy} r={r * drawn}
                  fill={rc(prim.color)} opacity={p} />
              );
            }

            case 'arrow': {
              const { x1, y1, x2, y2 } = prim;
              const lineD  = `M ${x1} ${y1} L ${x2} ${y2}`;
              const headD  = arrowHead(x1, y1, x2, y2);
              const headP  = Math.max(0, (p - 0.7) / 0.3);
              return (
                <React.Fragment key={i}>
                  <path d={lineD} stroke={rc(prim.color)} strokeWidth={prim.w ?? 4}
                    fill="none" pathLength={PL} {...baseStroke} />
                  <path d={headD} stroke={rc(prim.color)} strokeWidth={prim.w ?? 4}
                    fill="none" strokeLinecap="round"
                    strokeDasharray={PL} strokeDashoffset={PL * (1 - headP)} />
                </React.Fragment>
              );
            }

            case 'text': {
              const chars = Math.floor(drawn * (prim.text?.length ?? 0));
              return (
                <text key={i}
                  x={prim.x} y={prim.y}
                  fontFamily="'Caveat', cursive"
                  fontSize={prim.size ?? 30}
                  fontWeight={prim.bold ? 700 : 400}
                  fill={rc(prim.color ?? 'ink')}
                  textAnchor="middle"
                >
                  {prim.text?.slice(0, chars)}
                </text>
              );
            }

            default: return null;
          }
        })}
      </g>
      {/* Pen nib — follows the tip of the currently-drawing stroke */}
      {nibOpacity > 0 && (
        <g transform={`scale(${scale})`} style={{ pointerEvents: 'none' }}>
          <circle cx={nibX} cy={nibY} r={18} fill="url(#nib-glow)" opacity={nibOpacity * 0.5}/>
          <circle cx={nibX} cy={nibY} r={5} fill="#fff" opacity={nibOpacity * 0.9}/>
          <circle cx={nibX} cy={nibY} r={3} fill="#3851d8" opacity={nibOpacity}/>
        </g>
      )}
    </svg>
  );
};

/* ────────────────────────────────────────────────────────────
   HAND-WRITTEN TEXT (char-by-char reveal)
──────────────────────────────────────────────────────────── */
const HW: React.FC<{
  text: string; x: number; y: number; size?: number;
  color: string; bold?: boolean; p: number;
  center?: boolean; italic?: boolean; maxWidth?: number;
}> = ({ text, x, y, size = 42, color, bold, p, center, italic, maxWidth }) => {
  if (p <= 0) return null;
  const chars = Math.floor(Math.min(p, 1) * text.length);
  return (
    <div style={{
      position: 'absolute', left: x, top: y, fontSize: size,
      fontFamily: "'Caveat', cursive",
      fontWeight: bold ? 700 : 400,
      fontStyle: italic ? 'italic' : 'normal',
      color, whiteSpace: maxWidth ? 'normal' : 'nowrap', maxWidth,
      userSelect: 'none',
      transform: center ? 'translateX(-50%)' : undefined,
    }}>
      {text.slice(0, chars)}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   BULLET WITH CHECKMARK
──────────────────────────────────────────────────────────── */
const Bullet: React.FC<{
  text: string; x: number; y: number;
  color: string; ink: string; p: number; maxWidth?: number;
}> = ({ text, x, y, color, ink, p, maxWidth = 500 }) => {
  if (p <= 0) return null;
  const checkP  = Math.max(0, (p - 0.15) / 0.85);
  const tp = Math.max(0, Math.min(1, p));
  const c1 = 1.70158, c3 = c1 + 1;
  const circleS = tp >= 1 ? 1 : Math.max(0, 1 + c3 * Math.pow(tp - 1, 3) + c1 * Math.pow(tp - 1, 2));
  return (
    <>
      <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={1} height={1}>
        <circle cx={x + 14} cy={y + 14} r={14 * circleS} fill={color + '22'} opacity={p > 0 ? 1 : 0} />
        <path
          d={`M ${x + 3} ${y + 14} L ${x + 11} ${y + 22} L ${x + 25} ${y + 2}`}
          stroke={color} strokeWidth={3.5} fill="none"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={60} strokeDashoffset={60 * (1 - checkP)}
        />
      </svg>
      <HW text={text} x={x + 40} y={y - 2} size={38} color={ink} p={Math.min(p * 1.6, 1)} maxWidth={maxWidth - 40} />
    </>
  );
};

/* ────────────────────────────────────────────────────────────
   ANIMATED WOBBLY UNDERLINE
──────────────────────────────────────────────────────────── */
const Underline: React.FC<{ x: number; y: number; w: number; color: string; p: number }> = ({ x, y, w, color, p }) => {
  if (p <= 0) return null;
  const PL = w;
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={1} height={1}>
      <path
        d={`M ${x} ${y} Q ${x + w * 0.25} ${y - 5}, ${x + w * 0.5} ${y + 4} Q ${x + w * 0.75} ${y - 4}, ${x + w} ${y}`}
        stroke={color} strokeWidth={4} fill="none" strokeLinecap="round"
        strokeDasharray={PL * 1.05} strokeDashoffset={PL * 1.05 * (1 - Math.min(p, 1))}
      />
    </svg>
  );
};

/* ────────────────────────────────────────────────────────────
   BOARD TEXTURE
──────────────────────────────────────────────────────────── */
const BoardTexture = memo<{ boardStyle: string; ink: string }>(({ boardStyle, ink }) => {
  const dotColor = boardStyle === 'dark' ? '#ffffff' : ink;
  const dotOpacity = boardStyle === 'dark' ? 0.07 : 0.1;
  const vigOpacity = boardStyle === 'dark' ? 0.18 : boardStyle === 'chalk' ? 0.22 : 0.1;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Dot paper background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <pattern id="dot-grid" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
            <circle cx="18" cy="18" r="1.6" fill={dotColor} opacity={dotOpacity}/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)"/>
      </svg>

      {/* Chalk tray / bottom strip for chalk style */}
      {boardStyle === 'chalk' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 22,
          borderTop: '3px solid rgba(240,240,232,0.22)',
          background: 'rgba(255,255,255,0.04)',
        }}/>
      )}

      {/* Subtle dark vignette for cinematic feel */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,${vigOpacity}) 100%)`,
      }}/>
    </div>
  );
});

/* ────────────────────────────────────────────────────────────
   TITLE SCENE
──────────────────────────────────────────────────────────── */
const TitleScene: React.FC<{ scene: WhiteboardScene; ink: string; accent: string; green: string; lightBg?: boolean }> = ({ scene, ink, accent, green, lightBg = false }) => {
  const f = useCurrentFrame();
  const e = (d: number, dur: number) => easeOut(f, d, dur);

  // Panel width is 1280 - 640(left) - 60(right) = 580px. Keep content inside ~520px.
  const PANEL_W = 520;
  const titleSize = scene.title.length > 30 ? 54 : scene.title.length > 18 ? 64 : 74;
  const charsPerLine = Math.floor(PANEL_W / (titleSize * 0.54));
  const titleLines = Math.ceil(scene.title.length / charsPerLine);
  const titleBlockH = titleLines * titleSize * 1.45;
  const subtitleY = 68 + titleBlockH + 28;

  // Truncate topic pill so it never wraps
  const topicLabel = (scene.topic || 'Video').slice(0, 36) + ((scene.topic?.length ?? 0) > 36 ? '…' : '');

  return (
    <AbsoluteFill>
      {/* Corner brackets */}
      <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={1280} height={720}>
        {[[[30,30],[30,80],[80,30]], [[1250,30],[1200,30],[1250,80]],
          [[30,690],[30,640],[80,690]], [[1250,690],[1200,690],[1250,640]]
        ].map((pts, gi) => (
          <path key={gi}
            d={`M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]} M ${pts[0][0]} ${pts[0][1]} L ${pts[2][0]} ${pts[2][1]}`}
            stroke={accent + '55'} strokeWidth={3} fill="none" strokeLinecap="round"
            strokeDasharray={100} strokeDashoffset={100 * (1 - e(gi * 2, 12))}
          />
        ))}
      </svg>

      {/* Left panel: AI drawing */}
      <div style={{ position: 'absolute', left: 40, top: 80, width: 540, height: 540 }}>
        {scene.drawing && scene.drawing.length > 0
          ? <DrawingCanvas
              primitives={scene.drawing} f={f} sceneDuration={scene.duration} startAt={8}
              accent={accent} green={green} ink={ink} lightBg={lightBg}
              scale={1.3} offsetX={30} offsetY={30}
            />
          : <svg style={{ position: 'absolute', overflow: 'visible' }} width={1} height={1}>
              <path d="M 270 270 A 200 200 0 1 1 270.1 270"
                stroke={accent + '30'} strokeWidth={3} fill="none"
                strokeDasharray={1260} strokeDashoffset={1260 * (1 - e(5, 60))}
              />
            </svg>
        }
      </div>

      {/* Right panel: title & subtitle — vertically stacked, no overlaps */}
      <div style={{ position: 'absolute', left: 620, top: 80, width: PANEL_W }}>
        {/* topic pill — one line, truncated */}
        <div style={{
          display: 'inline-block', opacity: springOut(f, 0, 14), maxWidth: PANEL_W,
          background: accent + '20', border: `2px solid ${accent}`,
          borderRadius: 999, padding: '3px 18px',
          fontFamily: "'Caveat', cursive", fontSize: 28, color: accent, fontWeight: 700,
          whiteSpace: 'nowrap', overflow: 'hidden',
          transform: `scale(${0.85 + 0.15 * springOut(f, 0, 14)})`,
          transformOrigin: 'left center',
        }}>
          {topicLabel}
        </div>

        {/* title — sized to fit within panel width */}
        <HW text={scene.title} x={0} y={68} size={titleSize} bold color={ink}
          p={e(8, 30)} maxWidth={PANEL_W} />

        {/* underline — capped to panel width */}
        <Underline x={0} y={68 + titleBlockH + 4}
          w={Math.min(scene.title.length * titleSize * 0.54, PANEL_W)}
          color={accent} p={e(36, 16)} />

        {/* subtitle — positioned after title */}
        {scene.subtitle && (
          <HW text={scene.subtitle} x={0} y={subtitleY + 14} size={40}
            color={green} italic p={e(50, 22)} maxWidth={PANEL_W} />
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ────────────────────────────────────────────────────────────
   CONTENT SCENE (problem / solution / content)
──────────────────────────────────────────────────────────── */
const ContentScene: React.FC<{ scene: WhiteboardScene; ink: string; accent: string; green: string; lightBg?: boolean }> = ({ scene, ink, accent, green, lightBg = false }) => {
  const f = useCurrentFrame();
  const e = (d: number, dur: number) => easeOut(f, d, dur);

  const titleColor  = scene.type === 'problem' ? accent : scene.type === 'solution' ? green : accent;
  const bulletColor = scene.type === 'solution' ? green : accent;

  // Right panel: 1280 - 620(left) - 40(right) = 620px, keep content in ~580px
  const PANEL_W = 580;
  const titleSize = scene.title.length > 28 ? 52 : scene.title.length > 16 ? 62 : 72;
  const charsPerLine = Math.floor(PANEL_W / (titleSize * 0.54));
  const titleLines  = Math.ceil(scene.title.length / charsPerLine);
  const titleBlockH = titleLines * titleSize * 1.45;
  const subtitleY   = 24 + titleBlockH + 12;
  // Subtitle size shrinks for long subtitles so it always fits in 2 lines max
  const SUB_SIZE    = scene.subtitle && scene.subtitle.length > 60 ? 28 : 34;
  const subCPL      = Math.floor(PANEL_W / (SUB_SIZE * 0.58));
  const subLines    = scene.subtitle ? Math.ceil(scene.subtitle.length / subCPL) : 0;
  const subBlockH   = subLines * SUB_SIZE * 1.55;
  const bulletsTop  = subtitleY + (scene.subtitle ? subBlockH + 14 : 20);

  return (
    <AbsoluteFill>
      {/* Left: AI drawing */}
      <div style={{ position: 'absolute', left: 40, top: 100, width: 520, height: 520 }}>
        {scene.drawing && scene.drawing.length > 0
          ? <DrawingCanvas
              primitives={scene.drawing} f={f} sceneDuration={scene.duration} startAt={12}
              accent={accent} green={green} ink={ink} lightBg={lightBg}
              scale={1.28} offsetX={10} offsetY={10}
            />
          : <svg style={{ position: 'absolute', overflow: 'visible' }} width={1} height={1}>
              <path d="M 60 260 A 200 200 0 1 1 60.1 260"
                stroke={titleColor + '30'} strokeWidth={3} fill="none"
                strokeDasharray={1260} strokeDashoffset={1260 * (1 - e(15, 60))}
              />
            </svg>
        }
      </div>

      {/* Right: title + subtitle + bullets */}
      <div style={{ position: 'absolute', left: 620, top: 50, width: PANEL_W }}>
        <HW text={scene.title} x={0} y={24} size={titleSize} bold color={titleColor}
          p={e(0, 22)} maxWidth={PANEL_W} />
        <Underline x={0} y={24 + titleBlockH + 4}
          w={Math.min(scene.title.length * titleSize * 0.54, PANEL_W)}
          color={titleColor} p={e(20, 14)} />

        {scene.subtitle && (
          <HW text={scene.subtitle} x={0} y={subtitleY + 14} size={SUB_SIZE}
            color={ink} italic p={e(26, 16)} maxWidth={PANEL_W} />
        )}

        {/* bullets — evenly spaced based on how many there are */}
        <div style={{ position: 'absolute', top: bulletsTop, left: 0, width: PANEL_W }}>
          {scene.bullets.slice(0, 5).map((b, i) => {
            const maxBullets = Math.min(scene.bullets.length, 5);
            const spacing = Math.min(100, Math.floor((720 - 50 - bulletsTop) / maxBullets));
            return (
              <div key={i} style={{ position: 'absolute', top: i * spacing, left: 0, width: PANEL_W }}>
                <Bullet
                  text={b.length > 55 ? b.slice(0, 55) + '…' : b}
                  x={0} y={0} color={bulletColor} ink={ink}
                  p={e(34 + i * 13, 18)} maxWidth={PANEL_W}
                />
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ────────────────────────────────────────────────────────────
   EXAMPLE SCENE
──────────────────────────────────────────────────────────── */
const ExampleScene: React.FC<{ scene: WhiteboardScene; ink: string; accent: string; green: string; lightBg?: boolean }> = ({ scene, ink, accent, green, lightBg = false }) => {
  const f = useCurrentFrame();
  const e = (d: number, dur: number) => easeOut(f, d, dur);
  const bullets = scene.bullets.slice(0, 4);
  const cols = Math.min(bullets.length, 4);

  // Usable width for cards: 1280 - 80 (left) - 80 (right) = 1120
  const CARDS_W = 1120;
  const boxW = Math.floor((CARDS_W - (cols - 1) * 24) / cols);

  // Dynamic header sizing (title takes up to top 220px of canvas)
  const titleSize = scene.title.length > 32 ? 50 : scene.title.length > 20 ? 60 : 72;
  const charsPerLine = Math.floor(CARDS_W / (titleSize * 0.54));
  const titleLines  = Math.ceil(scene.title.length / charsPerLine);
  const titleBlockH = titleLines * titleSize * 1.45;
  const underlineY  = 40 + titleBlockH + 4;
  const subtitleY   = underlineY + 20;
  const cardsTop    = subtitleY + (scene.subtitle ? 50 : 10);

  return (
    <AbsoluteFill>
      {/* Title row */}
      <HW text={scene.title} x={80} y={40} size={titleSize} bold color={accent}
        p={e(0, 22)} maxWidth={scene.drawing && scene.drawing.length > 0 ? 860 : CARDS_W} />
      <Underline x={80} y={underlineY} w={Math.min(scene.title.length * titleSize * 0.54, CARDS_W)}
        color={accent} p={e(20, 14)} />
      {scene.subtitle && (
        <HW text={scene.subtitle} x={80} y={subtitleY} size={34}
          color={ink} italic p={e(24, 14)} maxWidth={850} />
      )}

      {/* Mini drawing top-right (only when title fits in ~860px) */}
      {scene.drawing && scene.drawing.length > 0 && (
        <div style={{ position: 'absolute', right: 60, top: 10, transform: 'scale(0.35)', transformOrigin: 'top right' }}>
          <DrawingCanvas
            primitives={scene.drawing} f={f} sceneDuration={scene.duration} startAt={8}
            accent={accent} green={green} ink={ink} lightBg={lightBg}
            scale={1} offsetX={0} offsetY={0}
          />
        </div>
      )}

      {/* Cards */}
      <div style={{ position: 'absolute', top: cardsTop, left: 80, right: 80 }}>
        <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={1} height={1}>
          {bullets.map((_, i) => {
            const x = i * (boxW + 24);
            const c = i % 2 === 0 ? accent : green;
            return (
              <React.Fragment key={i}>
                <path
                  d={`M ${x} 0 L ${x + boxW} 0 L ${x + boxW} 290 L ${x} 290 Z`}
                  stroke={c} strokeWidth={4} fill={c + '12'}
                  strokeDasharray={1000} strokeDashoffset={1000 * (1 - e(30 + i * 12, 18))}
                  strokeLinecap="round" strokeLinejoin="round"
                />
                {i < bullets.length - 1 && (
                  <path d={`M ${x + boxW + 2} 145 L ${x + boxW + 22} 145`}
                    stroke={ink + '60'} strokeWidth={4}
                    strokeDasharray={22} strokeDashoffset={22 * (1 - e(50 + i * 12, 8))}
                    strokeLinecap="round"
                  />
                )}
              </React.Fragment>
            );
          })}
        </svg>
        {bullets.map((b, i) => {
          const x = i * (boxW + 24);
          const c = i % 2 === 0 ? accent : green;
          return (
            <React.Fragment key={i}>
              <HW text={`${i + 1}`} x={x + boxW / 2} y={10} size={50} bold color={c} p={e(44 + i * 12, 10)} center />
              <HW text={b.length > 40 ? b.slice(0, 40) + '…' : b}
                x={x + 14} y={76} size={28} color={ink} p={e(54 + i * 12, 14)} maxWidth={boxW - 28} />
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ────────────────────────────────────────────────────────────
   CLOSING SCENE
──────────────────────────────────────────────────────────── */
const ClosingScene: React.FC<{ scene: WhiteboardScene; ink: string; accent: string; green: string; lightBg?: boolean }> = ({ scene, ink, accent, green, lightBg = false }) => {
  const f = useCurrentFrame();
  const e = (d: number, dur: number) => easeOut(f, d, dur);

  // Right panel width: 1280 - 640(left) - 40(right gutter) = 600px, use 560 for content
  const PANEL_W = 560;
  const titleSize = scene.title.length > 26 ? 54 : scene.title.length > 16 ? 64 : 76;
  const charsPerLine = Math.floor(PANEL_W / (titleSize * 0.54));
  const titleLines  = Math.ceil(scene.title.length / charsPerLine);
  const titleBlockH = titleLines * titleSize * 1.45;
  const underlineY  = titleBlockH + 8;
  const bulletsTop  = underlineY + 40;
  const maxBullets  = 3;
  const bulletSpacing = 110;
  const ctaTop = bulletsTop + maxBullets * bulletSpacing + 10;

  return (
    <AbsoluteFill>
      {/* Left: AI drawing */}
      <div style={{ position: 'absolute', left: 40, top: 80, width: 560, height: 560 }}>
        {scene.drawing && scene.drawing.length > 0
          ? <DrawingCanvas
              primitives={scene.drawing} f={f} sceneDuration={scene.duration} startAt={8}
              accent={accent} green={green} ink={ink} lightBg={lightBg}
              scale={1.38} offsetX={10} offsetY={10}
            />
          : null
        }
      </div>

      {/* Right: title + checkmarks + CTA */}
      <div style={{ position: 'absolute', left: 640, top: 60, width: PANEL_W }}>
        <HW text={scene.title} x={0} y={0} size={titleSize} bold color={accent}
          p={e(0, 22)} maxWidth={PANEL_W} />
        <Underline x={0} y={underlineY}
          w={Math.min(scene.title.length * titleSize * 0.54, PANEL_W)}
          color={accent} p={e(20, 14)} />

        <div style={{ position: 'absolute', top: bulletsTop, left: 0 }}>
          {scene.bullets.slice(0, maxBullets).map((b, i) => (
            <div key={i} style={{ position: 'absolute', top: i * bulletSpacing, left: 0, width: PANEL_W }}>
              <Bullet
                text={b.length > 50 ? b.slice(0, 50) + '…' : b}
                x={0} y={0} color={green} ink={ink}
                p={e(28 + i * 16, 18)} maxWidth={PANEL_W}
              />
            </div>
          ))}
        </div>

        {/* CTA — only show if it fits within canvas */}
        {scene.subtitle && ctaTop < 600 && (
          <div style={{
            position: 'absolute', top: ctaTop, left: 0,
            background: accent, borderRadius: 14,
            padding: '12px 28px',
            opacity: e(74, 16),
            transform: `scale(${0.88 + 0.12 * e(74, 16)})`,
            transformOrigin: 'left center',
          }}>
            <HW
              text={scene.subtitle.length > 40 ? scene.subtitle.slice(0, 40) + '…' : scene.subtitle}
              x={0} y={0} size={44} bold color="#fff" p={e(78, 18)}
            />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ────────────────────────────────────────────────────────────
   SCENE ROUTER + TRANSITION
──────────────────────────────────────────────────────────── */
const SceneRenderer: React.FC<{ scene: WhiteboardScene; ink: string; accent: string; green: string; lightBg?: boolean }> = ({ scene, ink, accent, green }) => {
  // ink is dark (#2d2d2d) on light boards (classic/colorful), light on dark/chalk
  const lightBg = ink === '#2d2d2d';
  const p = { scene, ink, accent, green, lightBg };
  switch (scene.type) {
    case 'title':   return <TitleScene   {...p} />;
    case 'example': return <ExampleScene {...p} />;
    case 'closing': return <ClosingScene {...p} />;
    default:        return <ContentScene {...p} />;
  }
};

// Dip-to-background transition: uses the board color so cuts are invisible to the viewer.
// 4 frames in + 4 frames out at scene boundaries.
const FadeTransition: React.FC<{ duration: number; bgColor: string }> = ({ duration, bgColor }) => {
  const f = useCurrentFrame();
  const FADES = 4;
  const opacity = Math.max(
    interpolate(f, [0, FADES], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    interpolate(f, [duration - FADES, duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  );
  if (opacity <= 0) return null;
  return <AbsoluteFill style={{ backgroundColor: bgColor, opacity, pointerEvents: 'none' }} />;
};

/* ────────────────────────────────────────────────────────────
   SCENE PROGRESS INDICATOR
──────────────────────────────────────────────────────────── */
const SceneProgress: React.FC<{ scenes: WhiteboardScene[]; accent: string; ink: string }> = ({ scenes, accent, ink }) => {
  const f = useCurrentFrame();
  let currentIdx = 0, cum = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (f < cum + scenes[i].duration) { currentIdx = i; break; }
    cum += scenes[i].duration;
    currentIdx = i;
  }
  if (scenes.length <= 1) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 18, left: 0, right: 0,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      gap: 8, pointerEvents: 'none',
    }}>
      {scenes.map((_, i) => (
        <div key={i} style={{
          height: 7,
          width: i === currentIdx ? 28 : 7,
          borderRadius: 4,
          background: i === currentIdx ? accent : ink + '30',
          boxShadow: i === currentIdx ? `0 0 8px ${accent}88` : 'none',
        }}/>
      ))}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   HUMAND WATERMARK
──────────────────────────────────────────────────────────── */
const HumandWatermark: React.FC<{ boardStyle: string }> = ({ boardStyle }) => {
  // White on dark boards, dark-ink on light boards — both at low opacity
  const color = boardStyle === 'dark' || boardStyle === 'chalk' ? '#ffffff' : '#1a1a2e';
  return (
    <div style={{
      position: 'absolute', bottom: 14, right: 20,
      opacity: 0.18, pointerEvents: 'none',
    }}>
      <svg viewBox="100 464 880 153" width={148} height={26} style={{ display: 'block', color }}>
        <path fill="currentColor" d="M109.22,572.21c-2.48,0-4.44-.75-5.87-2.23-1.43-1.49-2.14-3.35-2.14-5.59v-89.39c0-2.48.71-4.44,2.14-5.87,1.43-1.43,3.38-2.14,5.87-2.14,2.36,0,4.25.72,5.68,2.14,1.43,1.43,2.14,3.38,2.14,5.87v89.39c0,2.23-.72,4.1-2.14,5.59-1.43,1.49-3.32,2.23-5.68,2.23ZM109.22,612.44c-2.48,0-4.44-.71-5.87-2.14-1.43-1.43-2.14-3.32-2.14-5.68v-86.04c0-2.48.71-4.44,2.14-5.87,1.43-1.43,3.38-2.14,5.87-2.14,2.36,0,4.25.72,5.68,2.14,1.43,1.43,2.14,3.38,2.14,5.87v86.04c0,2.36-.72,4.25-2.14,5.68-1.43,1.43-3.32,2.14-5.68,2.14ZM188.19,612.44c-2.36,0-4.28-.74-5.77-2.23-1.49-1.49-2.24-3.35-2.24-5.59v-47.49c0-7.57-1.4-13.75-4.19-18.53-2.79-4.78-6.61-8.38-11.45-10.8-4.84-2.42-10.37-3.63-16.58-3.63-5.84,0-11.08,1.15-15.74,3.45-4.65,2.3-8.35,5.4-11.08,9.31-2.73,3.91-4.1,8.41-4.1,13.5h-10.8c.25-7.82,2.33-14.81,6.24-20.95,3.91-6.15,9.15-11.02,15.74-14.62,6.58-3.6,13.9-5.4,21.98-5.4,8.69,0,16.48,1.83,23.37,5.49,6.89,3.66,12.35,9.03,16.39,16.11,4.03,7.08,6.05,15.77,6.05,26.07v47.49c0,2.24-.74,4.1-2.23,5.59-1.49,1.49-3.35,2.23-5.59,2.23Z" />
        <path fill="currentColor" d="M291.17,613.56c-8.82,0-16.67-1.83-23.56-5.49-6.89-3.66-12.32-9.03-16.3-16.11-3.97-7.08-5.96-15.77-5.96-26.07v-47.49c0-2.23.75-4.1,2.24-5.59,1.49-1.49,3.35-2.23,5.59-2.23s4.1.74,5.59,2.23c1.49,1.49,2.24,3.35,2.24,5.59v47.49c0,7.57,1.43,13.75,4.28,18.53,2.85,4.78,6.71,8.38,11.55,10.8,4.84,2.42,10.3,3.63,16.39,3.63s11.11-1.15,15.83-3.45c4.72-2.3,8.44-5.4,11.18-9.31,2.73-3.91,4.1-8.41,4.1-13.5h10.61c-.25,7.82-2.3,14.81-6.15,20.95-3.85,6.15-9.06,11.02-15.64,14.62-6.58,3.6-13.91,5.4-21.97,5.4ZM332.14,612.44c-2.36,0-4.26-.71-5.68-2.14-1.43-1.43-2.14-3.38-2.14-5.87v-86.04c0-2.36.71-4.25,2.14-5.68,1.42-1.43,3.32-2.14,5.68-2.14s4.28.72,5.77,2.14c1.49,1.43,2.23,3.32,2.23,5.68v86.04c0,2.48-.74,4.44-2.23,5.87-1.49,1.43-3.42,2.14-5.77,2.14Z" />
        <path fill="currentColor" d="M401.23,612.44c-2.48,0-4.44-.71-5.87-2.14-1.43-1.43-2.14-3.32-2.14-5.68v-86.04c0-2.36.71-4.28,2.14-5.77,1.43-1.49,3.38-2.23,5.87-2.23,2.36,0,4.25.74,5.68,2.23,1.43,1.49,2.14,3.42,2.14,5.77v86.04c0,2.36-.72,4.25-2.14,5.68-1.43,1.43-3.32,2.14-5.68,2.14ZM465.48,612.44c-2.24,0-4.1-.71-5.59-2.14-1.49-1.43-2.24-3.32-2.24-5.68v-53.45c0-8.57-2.2-15.21-6.61-19.93-4.41-4.72-10.03-7.08-16.86-7.08-7.33,0-13.35,2.42-18.06,7.26-4.72,4.84-7.08,11.17-7.08,19h-10.8c.25-8.07,1.98-15.18,5.21-21.32,3.23-6.15,7.7-10.96,13.41-14.43,5.71-3.47,12.23-5.21,19.55-5.21s13.6,1.68,19.18,5.03c5.59,3.35,9.93,8.17,13.04,14.43,3.1,6.27,4.66,13.69,4.66,22.26v53.45c0,2.36-.72,4.25-2.14,5.68-1.43,1.43-3.32,2.14-5.68,2.14ZM529.74,612.44c-2.36,0-4.28-.71-5.77-2.14-1.49-1.43-2.24-3.32-2.24-5.68v-53.45c0-8.57-2.17-15.21-6.52-19.93-4.35-4.72-10-7.08-16.95-7.08-7.33,0-13.32,2.48-17.97,7.45-4.65,4.97-6.98,11.49-6.98,19.55h-13.6c.12-8.32,1.92-15.61,5.4-21.88,3.48-6.27,8.29-11.14,14.43-14.62,6.15-3.47,13.13-5.21,20.95-5.21,7.2,0,13.6,1.68,19.18,5.03,5.59,3.35,9.96,8.17,13.13,14.43,3.17,6.27,4.75,13.69,4.75,22.26v53.45c0,2.36-.75,4.25-2.24,5.68-1.49,1.43-3.35,2.14-5.59,2.14Z" />
        <path fill="currentColor" d="M632.72,613.37c-9.44,0-17.88-2.26-25.33-6.8-7.45-4.53-13.35-10.71-17.69-18.53-4.35-7.82-6.52-16.64-6.52-26.45s2.26-18.81,6.8-26.63c4.53-7.82,10.71-14,18.53-18.53,7.82-4.53,16.64-6.8,26.44-6.8s18.41,2.27,26.17,6.8c7.76,4.53,13.9,10.71,18.44,18.53,4.53,7.82,6.86,16.7,6.98,26.63l-6.33,3.17c0,9.19-2.08,17.45-6.24,24.77-4.16,7.33-9.81,13.13-16.95,17.41-7.14,4.28-15.24,6.43-24.3,6.43ZM634.96,599.22c6.95,0,13.13-1.64,18.53-4.94,5.4-3.29,9.68-7.79,12.85-13.5,3.17-5.71,4.75-12.11,4.75-19.18s-1.58-13.62-4.75-19.28c-3.17-5.65-7.45-10.15-12.85-13.5-5.4-3.35-11.58-5.03-18.53-5.03s-13.01,1.68-18.53,5.03c-5.53,3.35-9.9,7.85-13.13,13.5-3.23,5.65-4.84,12.08-4.84,19.28s1.61,13.47,4.84,19.18c3.23,5.71,7.6,10.21,13.13,13.5,5.52,3.29,11.7,4.94,18.53,4.94ZM678.54,612.44c-2.24,0-4.13-.71-5.68-2.14-1.55-1.43-2.33-3.32-2.33-5.68v-30.73l3.54-16.2,12.48,3.91v43.02c0,2.36-.75,4.25-2.24,5.68-1.49,1.43-3.42,2.14-5.77,2.14Z" />
        <path fill="currentColor" d="M742.04,612.44c-2.48,0-4.44-.71-5.87-2.14-1.43-1.43-2.14-3.32-2.14-5.68v-86.04c0-2.48.71-4.44,2.14-5.87,1.43-1.43,3.38-2.14,5.87-2.14,2.36,0,4.25.72,5.68,2.14,1.43,1.43,2.14,3.38,2.14,5.87v86.04c0,2.36-.72,4.25-2.14,5.68-1.43,1.43-3.32,2.14-5.68,2.14ZM821.01,612.44c-2.36,0-4.28-.74-5.77-2.23-1.49-1.49-2.24-3.35-2.24-5.59v-47.49c0-7.57-1.4-13.75-4.19-18.53-2.79-4.78-6.61-8.38-11.45-10.8-4.84-2.42-10.37-3.63-16.58-3.63-5.84,0-11.08,1.15-15.74,3.45-4.65,2.3-8.35,5.4-11.08,9.31-2.73,3.91-4.1,8.41-4.1,13.5h-10.8c.25-7.82,2.33-14.81,6.24-20.95,3.91-6.15,9.15-11.02,15.74-14.62,6.58-3.6,13.9-5.4,21.98-5.4,8.69,0,16.48,1.83,23.37,5.49,6.89,3.66,12.35,9.03,16.39,16.11,4.03,7.08,6.05,15.77,6.05,26.07v47.49c0,2.24-.74,4.1-2.23,5.59-1.49,1.49-3.35,2.23-5.59,2.23Z" />
        <path fill="currentColor" d="M926.41,613.37c-9.81,0-18.62-2.26-26.44-6.8-7.82-4.53-14-10.71-18.53-18.53-4.53-7.82-6.8-16.7-6.8-26.63s2.17-18.62,6.52-26.45c4.34-7.82,10.24-14,17.69-18.53,7.45-4.53,15.89-6.8,25.33-6.8,8.07,0,15.36,1.71,21.88,5.12,6.52,3.42,11.83,7.92,15.92,13.5v-53.26c0-2.48.77-4.44,2.33-5.87,1.55-1.43,3.45-2.14,5.68-2.14,2.36,0,4.28.72,5.77,2.14,1.49,1.43,2.24,3.38,2.24,5.87v86.97c-.25,9.68-2.64,18.41-7.17,26.17-4.53,7.76-10.65,13.91-18.34,18.44-7.7,4.53-16.39,6.8-26.07,6.8ZM926.41,599.22c6.95,0,13.13-1.68,18.53-5.03,5.4-3.35,9.68-7.85,12.85-13.5,3.17-5.65,4.75-12.07,4.75-19.28s-1.58-13.47-4.75-19.18c-3.17-5.71-7.45-10.21-12.85-13.5-5.4-3.29-11.58-4.94-18.53-4.94s-13.01,1.65-18.53,4.94c-5.53,3.29-9.9,7.79-13.13,13.5-3.23,5.71-4.84,12.11-4.84,19.18s1.61,13.63,4.84,19.28c3.23,5.65,7.6,10.15,13.13,13.5,5.52,3.35,11.7,5.03,18.53,5.03Z" />
      </svg>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   MAIN COMPOSITION
──────────────────────────────────────────────────────────── */
export const WhiteboardComposition: React.FC<{ config: VideoConfig }> = ({ config }) => {
  const { boardStyle, accentColor, scenes } = config;
  const style  = BOARD_STYLES[boardStyle] ?? BOARD_STYLES.classic;
  const ink    = style.ink;
  const accent = accentColor ?? '#3851d8';
  const green  = boardStyle === 'dark' ? '#4ed364' : '#1a8e5a';

  return (
    <AbsoluteFill style={{ backgroundColor: style.bg, overflow: 'hidden' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap');`}</style>
      <BoardTexture boardStyle={boardStyle} ink={ink} />
      <Series>
        {scenes.map((scene) => (
          <Series.Sequence key={scene.id} durationInFrames={scene.duration}>
            <AbsoluteFill>
              <SceneRenderer scene={scene} ink={ink} accent={accent} green={green} />
              <FadeTransition duration={scene.duration} bgColor={style.bg} />
              {scene.audioUrl && (
                <Audio src={
                  scene.audioUrl.startsWith('http://') || scene.audioUrl.startsWith('https://')
                    ? scene.audioUrl
                    : (scene.audioUrl.startsWith('/') ? scene.audioUrl : staticFile(scene.audioUrl))
                } />
              )}
            </AbsoluteFill>
          </Series.Sequence>
        ))}
      </Series>
      <SceneProgress scenes={scenes} accent={accent} ink={ink} />
      <HumandWatermark boardStyle={boardStyle} />
    </AbsoluteFill>
  );
};
