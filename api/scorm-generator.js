/**
 * SCORM 1.2 package generator
 * Produces a ZIP with imsmanifest.xml + a self-contained HTML quiz player.
 */
import JSZip from 'jszip';

/* ── imsmanifest.xml ──────────────────────────────────────────────────────── */
function buildManifest(course) {
  const safe = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.whiteboardai.${course.id}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG_1">
    <organization identifier="ORG_1">
      <title>${safe(course.title)}</title>
      <item identifier="ITEM_1" identifierref="RES_1">
        <title>${safe(course.title)}</title>
        <adlcp:masteryscore>70</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES_1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`;
}

/* ── Self-contained HTML player ───────────────────────────────────────────── */
function buildHTML(course) {
  const courseData = JSON.stringify(course, null, 0);
  const totalQuestions = course.scenes.reduce(
    (acc, s) => acc + (s.quiz?.length || 0), 0
  );

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escHtml(course.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --accent:#3851d8;--accent-light:#eef1fc;--green:#1a8e5a;--green-light:#e8f8f1;
  --ink:#2d2d2d;--paper:#faf8f5;--muted:#767676;--border:#e5e5e5;
  --radius:12px;--shadow:0 2px 16px rgba(56,81,216,.10);
}
body{font-family:'Inter',sans-serif;background:var(--paper);color:var(--ink);min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:0 16px 60px}
/* dot paper */
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:radial-gradient(circle,rgba(45,45,45,.12) 1.4px,transparent 1.4px);
  background-size:28px 28px}

/* layout */
.shell{position:relative;z-index:1;width:100%;max-width:760px;padding-top:40px}

/* top progress bar */
.top-bar{height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:36px}
.top-bar-fill{height:100%;background:var(--accent);border-radius:2px;transition:width .4s ease}

/* scene card */
.card{background:#fff;border-radius:var(--radius);box-shadow:var(--shadow);padding:36px 40px;margin-bottom:24px}

/* scene header */
.scene-type{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:var(--accent);background:var(--accent-light);padding:4px 12px;border-radius:999px;margin-bottom:16px}
.scene-title{font-family:'Caveat',cursive;font-size:2.4rem;font-weight:700;color:var(--ink);line-height:1.2;margin-bottom:8px}
.underline{height:4px;background:linear-gradient(90deg,var(--accent),var(--accent)60%,transparent);border-radius:2px;margin-bottom:20px;width:min(60%,280px)}
.narration{font-size:15px;line-height:1.7;color:#444;margin-bottom:20px}
.bullets{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:20px}
.bullets li{display:flex;align-items:flex-start;gap:10px;font-size:14px;line-height:1.5}
.bullets li::before{content:'✓';color:var(--green);font-weight:700;flex-shrink:0;margin-top:1px}

/* quiz */
.quiz-separator{border:none;border-top:2px dashed var(--border);margin:24px 0}
.quiz-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:16px}
.question{margin-bottom:24px}
.question-text{font-size:15px;font-weight:600;margin-bottom:12px;line-height:1.5}
.options{display:flex;flex-direction:column;gap:8px}
.option{display:flex;align-items:center;gap:10px;padding:10px 14px;border:2px solid var(--border);border-radius:8px;cursor:pointer;transition:all .15s}
.option:hover{border-color:var(--accent);background:var(--accent-light)}
.option input{accent-color:var(--accent);width:16px;height:16px;cursor:pointer}
.option.correct{border-color:var(--green);background:var(--green-light)}
.option.wrong{border-color:#e74444;background:#fff5f5}
.feedback{font-size:13px;margin-top:8px;padding:8px 12px;border-radius:6px;line-height:1.5}
.feedback.ok{background:var(--green-light);color:var(--green)}
.feedback.fail{background:#fff5f5;color:#b91c1c}

/* navigation */
.nav{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
.step-counter{font-size:13px;color:var(--muted)}
.btn{display:inline-flex;align-items:center;gap:6px;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;border:none;transition:all .15s}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{background:#2a3fb8}
.btn-primary:disabled{opacity:.5;cursor:not-allowed}
.btn-outline{background:transparent;border:2px solid var(--border);color:var(--ink)}
.btn-outline:hover{border-color:var(--accent);color:var(--accent)}

/* completion screen */
.completion{text-align:center;padding:60px 40px}
.score-circle{width:120px;height:120px;border-radius:50%;border:6px solid var(--accent);display:inline-flex;flex-direction:column;align-items:center;justify-content:center;margin-bottom:24px}
.score-number{font-family:'Caveat',cursive;font-size:2.6rem;font-weight:700;color:var(--accent);line-height:1}
.score-label{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.completion h2{font-family:'Caveat',cursive;font-size:2.2rem;font-weight:700;margin-bottom:8px}
.completion p{color:var(--muted);font-size:15px;max-width:400px;margin:0 auto}
.passed{color:var(--green)}.failed{color:#b91c1c}

/* course header */
.course-header{text-align:center;margin-bottom:40px}
.course-title{font-family:'Caveat',cursive;font-size:2.8rem;font-weight:700;color:var(--ink);line-height:1.2}
.course-meta{font-size:13px;color:var(--muted);margin-top:8px}

@media(max-width:540px){
  .card{padding:24px 20px}
  .scene-title{font-size:1.9rem}
  .btn{padding:10px 20px;font-size:14px}
}
</style>
</head>
<body>
<div class="shell">
  <div id="root"></div>
</div>

<script>
/* ── SCORM 1.2 API wrapper ──────────────────────────────────────────────── */
var _api = null;
function _findAPI(w) {
  try { if (w.API) return w.API; if (w.parent && w.parent !== w) return _findAPI(w.parent); } catch(e) {}
  return null;
}
function _getAPI() { if (!_api) _api = _findAPI(window); return _api; }
function scormInit()            { try { _getAPI()?.LMSInitialize(""); } catch(e){} }
function scormSet(k,v)          { try { _getAPI()?.LMSSetValue(k, String(v)); } catch(e){} }
function scormCommit()          { try { _getAPI()?.LMSCommit(""); } catch(e){} }
function scormFinish(score, passed) {
  try {
    scormSet("cmi.core.score.raw", score);
    scormSet("cmi.core.score.max", 100);
    scormSet("cmi.core.score.min", 0);
    scormSet("cmi.core.lesson_status", passed ? "passed" : "failed");
    scormCommit();
    _getAPI()?.LMSFinish("");
  } catch(e){}
}

/* ── Course data ────────────────────────────────────────────────────────── */
var COURSE = ${courseData};
var TOTAL_Q = ${totalQuestions};

/* ── State ──────────────────────────────────────────────────────────────── */
var currentScene = 0;
var answers = {};     // { "sceneIdx_qIdx": optionIdx }
var checked = {};     // { "sceneIdx_qIdx": true } — submitted questions
var correctCount = 0;

var SCENE_ICONS = {title:"🎯",problem:"🤔",solution:"✅",example:"💡",closing:"🚀",content:"📋"};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;") }

function renderScene(idx) {
  var scene = COURSE.scenes[idx];
  var total = COURSE.scenes.length;
  var pct = Math.round((idx / total) * 100);
  var hasQuiz = scene.quiz && scene.quiz.length > 0;
  var allAnswered = hasQuiz && scene.quiz.every(function(_, qi){ return answers[idx+"_"+qi] !== undefined; });

  var html = "";

  /* progress bar */
  html += '<div class="top-bar"><div class="top-bar-fill" style="width:'+pct+'%"></div></div>';

  /* course title on first scene */
  if (idx === 0) {
    html += '<div class="course-header">';
    html += '<div class="course-title">'+esc(COURSE.title)+'</div>';
    html += '<div class="course-meta">'+total+' escena'+(total!==1?"s":"")+(TOTAL_Q>0?" · "+TOTAL_Q+" preguntas":"")+'</div>';
    html += '</div>';
  }

  html += '<div class="card">';

  /* scene type badge */
  html += '<div class="scene-type">'+(SCENE_ICONS[scene.type]||"📋")+" "+esc(scene.type)+'</div>';
  html += '<div class="scene-title">'+esc(scene.title)+'</div>';
  html += '<div class="underline"></div>';

  /* narration */
  if (scene.narration) {
    html += '<div class="narration">'+esc(scene.narration)+'</div>';
  }

  /* bullets */
  if (scene.bullets && scene.bullets.length) {
    html += '<ul class="bullets">';
    scene.bullets.forEach(function(b){ html += '<li>'+esc(b)+'</li>'; });
    html += '</ul>';
  }

  /* quiz */
  if (hasQuiz) {
    html += '<hr class="quiz-separator"/>';
    html += '<div class="quiz-label">✏️ Preguntas de comprensión</div>';
    scene.quiz.forEach(function(q, qi) {
      var key = idx+"_"+qi;
      var isChecked = checked[key];
      html += '<div class="question" id="q_'+key+'">';
      html += '<div class="question-text">'+(qi+1)+'. '+esc(q.question)+'</div>';
      html += '<div class="options">';
      (q.options||[]).forEach(function(opt, oi) {
        var isSelected = answers[key] === oi;
        var cls = "option";
        if (isChecked && isSelected) cls += (oi === q.correctAnswer ? " correct" : " wrong");
        if (isChecked && oi === q.correctAnswer) cls += " correct";
        html += '<label class="'+cls+'">';
        html += '<input type="radio" name="q_'+key+'" value="'+oi+'"'+(isSelected?" checked":"")+(isChecked?" disabled":"")+' onchange="selectAnswer('+idx+','+qi+','+oi+')">';
        html += esc(opt);
        html += '</label>';
      });
      html += '</div>';
      if (isChecked) {
        var correct = answers[key] === q.correctAnswer;
        html += '<div class="feedback '+(correct?"ok":"fail")+'">';
        html += correct ? "✅ ¡Correcto!" : "❌ Incorrecto. "+esc(q.explanation||"La respuesta era: "+esc((q.options||[])[q.correctAnswer]||""));
        html += '</div>';
      }
      html += '</div>';
    });
  }

  /* nav */
  html += '<div class="nav">';
  html += '<span class="step-counter">Escena '+(idx+1)+' de '+total+'</span>';
  html += '<div style="display:flex;gap:10px">';
  if (hasQuiz && !allAnswered) {
    html += '<button class="btn btn-primary" onclick="checkAnswers('+idx+')" '+(Object.keys(answers).filter(function(k){return k.startsWith(idx+"_")}).length < scene.quiz.length ? "disabled" : "")+'>Verificar respuestas</button>';
  } else if (idx < total - 1) {
    html += '<button class="btn btn-primary" onclick="goTo('+(idx+1)+')">Siguiente →</button>';
  } else {
    html += '<button class="btn btn-primary" onclick="finish()">Finalizar ✓</button>';
  }
  html += '</div>';
  html += '</div>';

  html += '</div>'; /* end card */
  return html;
}

function renderCompletion() {
  var pct = Math.round((currentScene / COURSE.scenes.length) * 100);
  var score = TOTAL_Q > 0 ? Math.round((correctCount / TOTAL_Q) * 100) : 100;
  var passed = score >= 70;

  var html = '<div class="top-bar"><div class="top-bar-fill" style="width:100%"></div></div>';
  html += '<div class="card completion">';
  html += '<div class="score-circle">';
  html += '<span class="score-number">'+score+'</span>';
  html += '<span class="score-label">puntos</span>';
  html += '</div>';
  html += '<h2 class="'+(passed?"passed":"failed")+'">'+(passed?"¡Aprobado! 🎉":"Seguí intentando 💪")+'</h2>';
  if (TOTAL_Q > 0) {
    html += '<p>Respondiste '+correctCount+' de '+TOTAL_Q+' preguntas correctamente.</p>';
  } else {
    html += '<p>Completaste el curso "'+esc(COURSE.title)+'" exitosamente.</p>';
  }
  html += '</div>';
  return html;
}

/* ── Actions ────────────────────────────────────────────────────────────── */
function selectAnswer(sceneIdx, qIdx, optIdx) {
  answers[sceneIdx+"_"+qIdx] = optIdx;
  /* re-render to enable verify button */
  var scene = COURSE.scenes[sceneIdx];
  var allPicked = scene.quiz.every(function(_,qi){ return answers[sceneIdx+"_"+qi] !== undefined; });
  if (allPicked) {
    var btn = document.querySelector(".btn-primary");
    if (btn) btn.disabled = false;
  }
}

function checkAnswers(sceneIdx) {
  var scene = COURSE.scenes[sceneIdx];
  scene.quiz.forEach(function(q, qi) {
    var key = sceneIdx+"_"+qi;
    checked[key] = true;
    if (answers[key] === q.correctAnswer) correctCount++;
  });
  document.getElementById("root").innerHTML = renderScene(sceneIdx);
  scormSet("cmi.core.lesson_status","incomplete");
  scormCommit();
}

function goTo(idx) {
  currentScene = idx;
  document.getElementById("root").innerHTML = renderScene(idx);
  window.scrollTo(0, 0);
}

function finish() {
  var score = TOTAL_Q > 0 ? Math.round((correctCount / TOTAL_Q) * 100) : 100;
  var passed = score >= 70;
  document.getElementById("root").innerHTML = renderCompletion();
  window.scrollTo(0, 0);
  scormFinish(score, passed);
}

/* ── Boot ───────────────────────────────────────────────────────────────── */
scormInit();
scormSet("cmi.core.lesson_status", "incomplete");
document.getElementById("root").innerHTML = renderScene(0);
</script>
</body>
</html>`;
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Public: build ZIP buffer ─────────────────────────────────────────────── */
export async function buildScormZip(course) {
  const zip = new JSZip();
  zip.file('imsmanifest.xml', buildManifest(course));
  zip.file('index.html', buildHTML(course));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
