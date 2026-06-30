import { useState } from 'react';
import type { QuizQuestion } from '../video/types';

const TYPE_LABEL: Record<string, string> = {
  single:   'Selección única',
  multiple: 'Selección múltiple',
  text:     'Respuesta abierta',
};

function formatCorrect(q: QuizQuestion): string {
  if (q.type === 'single') {
    const n = Number(q.correctAnswer);
    const idx = Number.isInteger(n) ? n : 0;
    return q.options?.[idx] ?? '';
  }
  if (q.type === 'multiple') {
    const arr = Array.isArray(q.correctAnswer)
      ? (q.correctAnswer as number[]).map((x) => Number(x)).filter((n) => Number.isInteger(n))
      : [];
    return arr.map((i) => q.options?.[i]).filter(Boolean).join(' | ');
  }
  return String(q.correctAnswer || '');
}

function formatForCopy(q: QuizQuestion, i: number): string {
  const lines: string[] = [];
  lines.push(`Pregunta ${i + 1} (${TYPE_LABEL[q.type] || q.type})`);
  lines.push(q.question);
  if (q.options && q.options.length) {
    lines.push('');
    q.options.forEach((opt, oi) => {
      const letter = String.fromCharCode(65 + oi);
      lines.push(`  ${letter}) ${opt}`);
    });
  }
  lines.push('');
  lines.push(`Respuesta correcta: ${formatCorrect(q)}`);
  lines.push(`Explicación: ${q.explanation || ''}`);
  return lines.join('\n');
}

function formatAllForCopy(quiz: QuizQuestion[]): string {
  return quiz.map((q, i) => formatForCopy(q, i)).join('\n\n---\n\n');
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  document.body.removeChild(ta);
  if (!ok) throw new Error('No pudimos copiar al portapapeles.');
  return true;
}

const QuestionCard = ({ q, index }: { q: QuizQuestion; index: number }) => {
  const [copied, setCopied] = useState(false);
  const correctIdxs: number[] =
    q.type === 'multiple'
      ? (Array.isArray(q.correctAnswer)
          ? (q.correctAnswer as number[]).map((x) => Number(x)).filter((n) => Number.isInteger(n))
          : [])
      : q.type === 'single'
        ? (Number.isInteger(Number(q.correctAnswer)) ? [Number(q.correctAnswer)] : [])
        : [];

  const handleCopy = async () => {
    try {
      await copyToClipboard(formatForCopy(q, index));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };

  return (
    <div className="quiz-q">
      <div className="quiz-q-head">
        <span className="quiz-q-type">{TYPE_LABEL[q.type] || q.type}</span>
        <button className="quiz-copy" onClick={handleCopy}>
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <div className="quiz-q-title">{index + 1}. {q.question}</div>

      {q.options && q.options.length > 0 && (
        <ol type="A" className="quiz-options">
          {q.options.map((opt, oi) => (
            <li key={oi} className={correctIdxs.includes(oi) ? 'correct' : ''}>
              {opt}
              {correctIdxs.includes(oi) && <span className="quiz-correct-tag"> Correcta</span>}
            </li>
          ))}
        </ol>
      )}

      {q.type === 'text' && (
        <div className="quiz-text-answer">
          <span className="quiz-label">Respuesta esperada:</span> {String(q.correctAnswer || '')}
        </div>
      )}

      {q.explanation && (
        <div className="quiz-explanation">
          <span className="quiz-label">Explicación:</span> {q.explanation}
        </div>
      )}
    </div>
  );
};

export const LessonQuiz = ({ quiz }: { quiz: QuizQuestion[] }) => {
  const [copiedAll, setCopiedAll] = useState(false);

  if (!quiz || quiz.length === 0) return null;

  const handleCopyAll = async () => {
    try {
      await copyToClipboard(formatAllForCopy(quiz));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    } catch (_) {}
  };

  return (
    <div className="quiz-block">
      <div className="quiz-head">
        <h4>Preguntas de evaluación</h4>
        <button className="quiz-copy quiz-copy-all" onClick={handleCopyAll}>
          {copiedAll ? 'Todas copiadas' : 'Copiar todas'}
        </button>
      </div>
      <div className="quiz-list">
        {quiz.map((q, i) => (
          <QuestionCard key={i} q={q} index={i} />
        ))}
      </div>
    </div>
  );
};
