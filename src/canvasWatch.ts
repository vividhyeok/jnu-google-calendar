import { GoogleAuth } from 'google-auth-library';
import { notifyDiscord } from './notify';

const CANVAS_ORIGIN = 'https://canvas.jejunu.ac.kr';
const SEOUL_TZ = 'Asia/Seoul';
const STORAGE_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_write';
const STATE_OBJECT = 'canvas-watch/state.json';

type Assignment = { uid: string; title: string; course: string; dueDate: string; url: string };
type Announcement = { id: string; title: string; course: string; postedAt: string; url: string; message: string };
type CanvasState = {
  version: 1;
  assignments: Record<string, Assignment>;
  announcementIds: Record<string, true>;
  lastReminderDate?: string;
};

type AssignmentChange =
  | { type: 'new'; current: Assignment }
  | { type: 'changed'; previous: Assignment; current: Assignment }
  | { type: 'deleted'; previous: Assignment };

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing environment variable: ' + name);
  return value;
}

function dateInSeoul(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function addDays(date: string, days: number) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000);
}

function unescapeIcs(value: string) {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function toDueDate(raw: string) {
  const value = raw.trim();
  if (/^\d{8}/.test(value)) {
    if (value.endsWith('Z') && value.length >= 16) {
      const iso = value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z');
      if (iso !== value) return dateInSeoul(new Date(iso));
    }
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  throw new Error('Canvas ICS contains invalid DTSTART');
}

function splitTitle(summary: string) {
  const match = summary.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  if (!match) return { title: summary.trim(), course: '' };
  return {
    title: match[1].trim(),
    course: match[2].replace(/\s+\d{6}\s*$/, '').trim(),
  };
}

export function parseAssignmentsIcs(text: string): Assignment[] {
  const lines: string[] = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^[ \t]/.test(raw) && lines.length) lines[lines.length - 1] += raw.slice(1);
    else lines.push(raw);
  }

  const events: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line === 'END:VEVENT') { if (current) events.push(current); current = null; continue; }
    if (!current) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).split(';')[0];
    if (!(key in current)) current[key] = line.slice(colon + 1);
  }

  return events.flatMap(event => {
    const uid = event.UID?.trim();
    if (!uid?.startsWith('event-assignment-') || !event.DTSTART || !event.SUMMARY) return [];
    const summary = unescapeIcs(event.SUMMARY);
    const { title, course } = splitTitle(summary);
    return [{
      uid,
      title,
      course,
      dueDate: toDueDate(event.DTSTART),
      url: unescapeIcs(event.URL ?? ''),
    }];
  });
}

export function diffAssignments(previous: Assignment[], current: Assignment[], today: string): AssignmentChange[] {
  const before = new Map(previous.map(item => [item.uid, item]));
  const now = new Map(current.map(item => [item.uid, item]));
  const changes: AssignmentChange[] = [];
  for (const item of current) {
    const old = before.get(item.uid);
    if (!old) changes.push({ type: 'new', current: item });
    else if (old.dueDate !== item.dueDate || old.title !== item.title || old.course !== item.course) {
      changes.push({ type: 'changed', previous: old, current: item });
    }
  }
  for (const old of previous) {
    if (!now.has(old.uid) && old.dueDate >= today) changes.push({ type: 'deleted', previous: old });
  }
  return changes;
}

function assignmentLabel(item: Assignment) {
  return item.course ? `[${item.course}] ${item.title}` : item.title;
}

export function formatAssignmentChanges(changes: AssignmentChange[]) {
  if (!changes.length) return '';
  const lines = ['📚 Canvas 과제 변경'];
  for (const change of changes) {
    if (change.type === 'new') {
      lines.push(`\n[새 과제] ${assignmentLabel(change.current)}\n마감: ${change.current.dueDate}${change.current.url ? `\n${change.current.url}` : ''}`);
    } else if (change.type === 'changed') {
      const due = change.previous.dueDate === change.current.dueDate
        ? `마감: ${change.current.dueDate}`
        : `마감: ${change.previous.dueDate} → ${change.current.dueDate}`;
      lines.push(`\n[과제 변경] ${assignmentLabel(change.current)}\n${due}${change.current.url ? `\n${change.current.url}` : ''}`);
    } else {
      lines.push(`\n[과제 삭제] ${assignmentLabel(change.previous)}\n기존 마감: ${change.previous.dueDate}`);
    }
  }
  return lines.join('\n');
}

function stripHtml(html: string) {
  const text = html
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
  return text.length > 700 ? text.slice(0, 697) + '...' : text;
}

function parseNext(link: string | null) {
  if (!link) return null;
  for (const part of link.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

async function canvasJson<T>(url: URL, token: string): Promise<T[]> {
  const all: T[] = [];
  let next: string | null = url.toString();
  while (next) {
    const response = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error('Canvas API request failed (HTTP ' + response.status + ')');
    const json = await response.json();
    if (!Array.isArray(json)) throw new Error('Canvas API returned invalid JSON');
    all.push(...json as T[]);
    next = parseNext(response.headers.get('link'));
  }
  return all;
}

async function fetchCourses(token: string) {
  const url = new URL('/api/v1/courses', CANVAS_ORIGIN);
  url.searchParams.set('enrollment_state', 'active');
  url.searchParams.set('enrollment_type', 'student');
  url.searchParams.set('per_page', '100');
  const rows = await canvasJson<{ id?: unknown; name?: unknown }>(url, token);
  return rows.flatMap(row => typeof row.id === 'number'
    ? [{ id: row.id, name: typeof row.name === 'string' ? row.name : `course_${row.id}` }]
    : []);
}

async function fetchAnnouncements(token: string, courses: {id:number;name:string}[], today: string): Promise<Announcement[]> {
  if (!courses.length) return [];
  const names = new Map(courses.map(c => [`course_${c.id}`, c.name]));
  const url = new URL('/api/v1/announcements', CANVAS_ORIGIN);
  for (const course of courses) url.searchParams.append('context_codes[]', `course_${course.id}`);
  url.searchParams.set('start_date', addDays(today, -30));
  url.searchParams.set('end_date', addDays(today, 1));
  url.searchParams.set('active_only', 'true');
  url.searchParams.set('per_page', '100');
  const rows = await canvasJson<{id?:unknown;title?:unknown;message?:unknown;posted_at?:unknown;context_code?:unknown;html_url?:unknown}>(url, token);
  return rows.flatMap(row => {
    if ((typeof row.id !== 'number' && typeof row.id !== 'string') || typeof row.title !== 'string') return [];
    const context = typeof row.context_code === 'string' ? row.context_code : '';
    return [{
      id: String(row.id),
      title: row.title,
      course: names.get(context) ?? context,
      postedAt: typeof row.posted_at === 'string' ? row.posted_at : '',
      url: typeof row.html_url === 'string' ? row.html_url : '',
      message: typeof row.message === 'string' ? stripHtml(row.message) : '',
    }];
  });
}

function formatAnnouncement(item: Announcement) {
  return [
    '📢 새 공지사항',
    item.course ? `[${item.course}]` : '',
    item.title,
    item.message ? `\n${item.message}` : '',
    item.url ? `\n${item.url}` : '',
  ].filter(Boolean).join('\n');
}

type Reminder = { title: string; course: string; dueDate: string; url: string };

async function fetchIncompleteReminders(token: string, courses: {id:number;name:string}[], today: string): Promise<Reminder[]> {
  const names = new Map(courses.map(c => [c.id, c.name]));
  const url = new URL('/api/v1/planner/items', CANVAS_ORIGIN);
  url.searchParams.set('start_date', today);
  url.searchParams.set('end_date', addDays(today, 3));
  url.searchParams.set('filter', 'incomplete_items');
  url.searchParams.set('per_page', '100');
  const rows = await canvasJson<{course_id?:unknown;plannable_type?:unknown;plannable?:unknown;html_url?:unknown}>(url, token);
  return rows.flatMap(row => {
    if (row.plannable_type !== 'assignment' && row.plannable_type !== 'quiz') return [];
    const p = row.plannable && typeof row.plannable === 'object' ? row.plannable as Record<string, unknown> : {};
    const title = typeof p.title === 'string' ? p.title : typeof p.name === 'string' ? p.name : '';
    const rawDue = typeof p.due_at === 'string' ? p.due_at : typeof p.todo_date === 'string' ? p.todo_date : '';
    if (!title || !rawDue) return [];
    const dueDate = dateInSeoul(new Date(rawDue));
    if (dueDate < today || dueDate > addDays(today, 3)) return [];
    const courseId = typeof row.course_id === 'number' ? row.course_id : undefined;
    const rawUrl = typeof row.html_url === 'string' ? row.html_url : '';
    return [{
      title,
      course: courseId ? names.get(courseId) ?? '' : '',
      dueDate,
      url: rawUrl.startsWith('/') ? CANVAS_ORIGIN + rawUrl : rawUrl,
    }];
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
}

export function formatReminder(reminders: Reminder[], today: string) {
  if (!reminders.length) return '';
  const lines = ['📚 오늘의 과제 체크'];
  for (const item of reminders) {
    const d = daysBetween(today, item.dueDate);
    const label = d === 0 ? 'D-DAY' : `D-${d}`;
    lines.push(`${label}  ${item.course ? `[${item.course}] ` : ''}${item.title}${item.url ? `\n${item.url}` : ''}`);
  }
  return lines.join('\n\n');
}

let storageToken: string | undefined;
async function getStorageToken() {
  if (storageToken) return storageToken;
  const auth = new GoogleAuth({ scopes: [STORAGE_SCOPE] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Cloud Storage authentication failed');
  storageToken = token.token;
  return storageToken;
}

async function readState(bucket: string): Promise<CanvasState | null> {
  const token = await getStorageToken();
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(STATE_OBJECT)}?alt=media`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Canvas state read failed (HTTP ' + response.status + ')');
  const value = await response.json() as Partial<CanvasState>;
  if (value.version !== 1 || !value.assignments || !value.announcementIds) throw new Error('Canvas state is invalid');
  return value as CanvasState;
}

async function writeState(bucket: string, state: CanvasState) {
  const token = await getStorageToken();
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(STATE_OBJECT)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('Canvas state write failed (HTTP ' + response.status + ')');
}

async function sendChunked(content: string, username: string) {
  if (!content) return;
  const max = 1850;
  let rest = content;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < 500) cut = max;
    await notifyDiscord(rest.slice(0, cut), username);
    rest = rest.slice(cut).trimStart();
  }
  if (rest) await notifyDiscord(rest, username);
}

export async function runCanvasWatch(now = new Date()) {
  const token = requireEnv('CANVAS_API_TOKEN');
  const icsUrlText = requireEnv('CANVAS_ICS_URL');
  const bucket = requireEnv('CANVAS_STATE_BUCKET');
  const icsUrl = new URL(icsUrlText);
  if (icsUrl.origin !== CANVAS_ORIGIN || !icsUrl.pathname.startsWith('/feeds/calendars/')) throw new Error('Invalid Canvas ICS URL');

  const today = dateInSeoul(now);
  console.info('Canvas watch started');
  const [icsResponse, courses] = await Promise.all([
    fetch(icsUrl, { signal: AbortSignal.timeout(20_000) }),
    fetchCourses(token),
  ]);
  if (!icsResponse.ok) throw new Error('Canvas ICS request failed (HTTP ' + icsResponse.status + ')');
  const assignments = parseAssignmentsIcs(await icsResponse.text());
  const [announcements, previous] = await Promise.all([
    fetchAnnouncements(token, courses, today),
    readState(bucket),
  ]);

  const baseline = previous === null;
  const previousAssignments = previous ? Object.values(previous.assignments) : [];
  const changes = baseline ? [] : diffAssignments(previousAssignments, assignments, today);
  if (changes.length) await sendChunked(formatAssignmentChanges(changes), 'JNU 과제 알리미');

  const knownAnnouncements = previous?.announcementIds ?? {};
  if (!baseline) {
    for (const announcement of announcements.filter(item => !knownAnnouncements[item.id])) {
      await sendChunked(formatAnnouncement(announcement), 'JNU 공지 알리미');
    }
  }

  let lastReminderDate = previous?.lastReminderDate;
  if (lastReminderDate !== today) {
    const reminders = await fetchIncompleteReminders(token, courses, today);
    const message = formatReminder(reminders, today);
    if (message) await sendChunked(message, 'JNU 과제 알리미');
    lastReminderDate = today;
  }

  const announcementIds = { ...knownAnnouncements };
  for (const item of announcements) announcementIds[item.id] = true;
  const nextState: CanvasState = {
    version: 1,
    assignments: Object.fromEntries(assignments.map(item => [item.uid, item])),
    announcementIds,
    ...(lastReminderDate ? { lastReminderDate } : {}),
  };
  await writeState(bucket, nextState);
  console.info(`Canvas watch completed: ${assignments.length} assignments, ${announcements.length} recent announcements, ${changes.length} assignment changes`);
  return 0;
}
