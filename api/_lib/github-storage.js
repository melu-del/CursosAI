const REPO = 'melu-del/CursosAI';
const PATH = 'storage/dynamic-courses.json';
const API_URL = `https://api.github.com/repos/${REPO}/contents/${PATH}`;

function authHeaders() {
  return {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'whiteboard-ai',
  };
}

export async function loadDynamicCourses() {
  const res = await fetch(API_URL, { headers: authHeaders() });
  if (res.status === 404) return {};
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  const data = await res.json();
  return JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
}

export async function saveDynamicCourses(courses) {
  const getRes = await fetch(API_URL, { headers: authHeaders() });
  const sha = getRes.ok ? (await getRes.json()).sha : undefined;

  const content = Buffer.from(JSON.stringify(courses, null, 2)).toString('base64');
  const putRes = await fetch(API_URL, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'chore: update dynamic courses',
      content,
      sha,
    }),
  });
  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub write failed: ${putRes.status} ${err}`);
  }
}

export async function saveCourse(course) {
  const courses = await loadDynamicCourses();
  courses[course.id] = course;
  await saveDynamicCourses(courses);
}

export async function deleteCourse(id) {
  const courses = await loadDynamicCourses();
  delete courses[id];
  await saveDynamicCourses(courses);
}

function fileApiUrl(repoPath) {
  return `https://api.github.com/repos/${REPO}/contents/${repoPath}`;
}

export async function saveAudioFile(courseId, filename, buffer) {
  const repoPath = `storage/audio/${courseId}/${filename}`;
  const url = fileApiUrl(repoPath);
  const getRes = await fetch(url, { headers: authHeaders() });
  const sha = getRes.ok ? (await getRes.json()).sha : undefined;

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `chore: add audio ${courseId}/${filename}`,
      content: buffer.toString('base64'),
      sha,
    }),
  });
  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub audio upload failed: ${putRes.status} ${err}`);
  }
}

export async function loadAudioFile(courseId, filename) {
  const repoPath = `storage/audio/${courseId}/${filename}`;
  const res = await fetch(fileApiUrl(repoPath), { headers: authHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return Buffer.from(data.content, 'base64');
}
