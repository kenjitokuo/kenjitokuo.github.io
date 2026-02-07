// researchmap.js
'use strict';

const PERMALINK = 'tokuo';
const LANG = 'en';
const LIMIT = 200;
const SCRIPT_VERSION = '2026-02-07z';

const TYPES = [
  { key: 'research_interests', label: 'Research Interests / Keywords' },
  { key: 'research_experience', label: 'Research Experience' },
  { key: 'education', label: 'Education' },
  { key: 'committee_memberships', label: 'Committee Memberships' },
  { key: 'awards', label: 'Awards' },
  { key: 'published_papers', label: 'Published Papers' },
  { key: 'misc', label: 'MISC' },
  { key: 'books_etc', label: 'Books and Other Publications' },
  { key: 'presentations', label: 'Presentations' },
  { key: 'teaching_experience', label: 'Teaching Experience' },
  { key: 'association_memberships', label: 'Professional Memberships' },
  { key: 'works', label: 'Works' },
  { key: 'industrial_property_rights', label: 'Industrial Property Rights' },
  { key: 'social_contribution', label: 'Social Contribution' },
  { key: 'media_coverage', label: 'Media Coverage' },
  { key: 'academic_contribution', label: 'Academic Contribution' },
  { key: 'others', label: 'Others' }
];

const SEP_VENUE = ' - ';
const PROFILE_URL = `https://researchmap.jp/${encodeURIComponent(PERMALINK)}?lang=${encodeURIComponent(LANG)}`;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function stripHtml(s) { return String(s).replace(/<[^>]*>/g, ''); }
function hasJapaneseScript(s) { return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(String(s || '')); }

function normalizeTypos(s) {
  return String(s || '')
    .replace(/\bUniverisity\b/g, 'University')
    .replace(/\bUniveristy\b/g, 'University')
    .replace(/\bEnviroment\b/g, 'Environment')
    .replace(/\bEnvironment Studies\b/g, 'Environmental Studies')
    .replace(/\bHuman and Environment Studies\b/g, 'Human and Environmental Studies');
}

function cleanNoQuestion(s) {
  return normalizeTypos(String(s || ''))
    .replace(/\uFFFD/g, '')
    .replace(/[?？]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeBareDate(s) { return /^[0-9]{4}([-/][0-9]{1,2}){0,2}$/.test(String(s || '')); }
function looksLikeUrl(s) { return /^https?:\/\//.test(String(s || '')); }
function looksLikeNumberOnly(s) { return /^[0-9]+$/.test(String(s || '')); }

function pickLang(v) {
  if (v == null) return '';
  if (typeof v === 'string') return cleanNoQuestion(stripHtml(v).replace(/\s+/g, ' ').trim());
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    if (typeof v[LANG] === 'string' && v[LANG].trim()) return cleanNoQuestion(stripHtml(v[LANG]).replace(/\s+/g, ' ').trim());
    if (typeof v.en === 'string' && v.en.trim()) return cleanNoQuestion(stripHtml(v.en).replace(/\s+/g, ' ').trim());
    if (typeof v.ja === 'string' && v.ja.trim()) return cleanNoQuestion(stripHtml(v.ja).replace(/\s+/g, ' ').trim());
    for (const k of Object.keys(v)) {
      const s = pickLang(v[k]);
      if (s) return s;
    }
  }
  return '';
}

function pickEnOnlyNoJa(v) {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    const s = cleanNoQuestion(stripHtml(v).replace(/\s+/g, ' ').trim());
    if (!s) return '';
    if (hasJapaneseScript(s)) return '';
    return s;
  }
  if (typeof v === 'object') {
    const en = (typeof v.en === 'string' && v.en.trim()) ? cleanNoQuestion(stripHtml(v.en).replace(/\s+/g, ' ').trim()) : '';
    if (en && !hasJapaneseScript(en)) return en;
    const lang = (typeof v[LANG] === 'string' && v[LANG].trim()) ? cleanNoQuestion(stripHtml(v[LANG]).replace(/\s+/g, ' ').trim()) : '';
    if (lang && !hasJapaneseScript(lang)) return lang;
  }
  return '';
}

function get(item, key) { return item && Object.prototype.hasOwnProperty.call(item, key) ? pickLang(item[key]) : ''; }
function getEnNoJa(item, key) { return item && Object.prototype.hasOwnProperty.call(item, key) ? pickEnOnlyNoJa(item[key]) : ''; }

function joinNonEmpty(parts, sep = ' / ') {
  const xs = parts.map(s => cleanNoQuestion(s).trim()).filter(Boolean);
  return xs.join(sep);
}

function joinNonEmptyComma(parts) {
  const xs = parts.map(s => cleanNoQuestion(s).trim()).filter(Boolean);
  return xs.join(', ');
}

function collectStrings(x, path = '') {
  const out = [];
  if (x == null) return out;
  if (typeof x === 'string') {
    const s = cleanNoQuestion(stripHtml(x).replace(/\s+/g, ' ').trim());
    if (s) out.push({ path, s });
    return out;
  }
  if (typeof x === 'number') { out.push({ path, s: String(x) }); return out; }
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) out.push(...collectStrings(x[i], `${path}[${i}]`));
    return out;
  }
  if (typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) {
      if (k === '@id' || k === '@type') continue;
      out.push(...collectStrings(v, path ? `${path}.${k}` : k));
    }
  }
  return out;
}

function preferKeys(item, keys, getter) {
  for (const k of keys) {
    const s = getter(item, k);
    if (s) return s;
  }
  return '';
}

function bestByPathKeywords(obj, keywords, opts = {}) {
  const { enNoJa = false, exclude = [], require = [] } = opts;
  const xs = collectStrings(obj);
  const cands = [];
  for (const { path, s } of xs) {
    if (!s) continue;
    if (s.length < 2 || s.length > 240) continue;
    if (looksLikeBareDate(s) || looksLikeUrl(s) || looksLikeNumberOnly(s)) continue;
    if (exclude.some(re => re.test(s))) continue;
    if (require.length && !require.every(re => re.test(s))) continue;
    const p = (path || '').toLowerCase();
    let hit = 0;
    for (const kw of keywords) if (p.includes(kw)) hit += 1;
    if (hit === 0) continue;
    const v = enNoJa ? pickEnOnlyNoJa(s) : pickLang(s);
    if (!v) continue;
    const score = 25 * hit + Math.min(20, Math.floor(v.length / 12));
    cands.push({ s: cleanNoQuestion(v), score });
  }
  cands.sort((a, b) => b.score - a.score);
  return cands.length ? cands[0].s : '';
}

function bestByValueRegex(item, includeRes, opts = {}) {
  const { excludeRes = [] } = opts;
  const xs = collectStrings(item);
  const cands = [];
  for (const { s } of xs) {
    if (!s) continue;
    if (s.length < 2 || s.length > 240) continue;
    if (looksLikeBareDate(s) || looksLikeUrl(s) || looksLikeNumberOnly(s)) continue;
    if (excludeRes.some(re => re.test(s))) continue;
    let hit = 0;
    for (const re of includeRes) if (re.test(s)) hit += 1;
    if (hit === 0) continue;
    const score = 50 * hit + Math.min(20, Math.floor(s.length / 12));
    cands.push({ s, score });
  }
  cands.sort((a, b) => b.score - a.score);
  return cands.length ? cands[0].s : '';
}

/* Education extractors */

function extractEducationSchool(item) {
  const v1 = preferKeys(item, ['university', 'school', 'institution', 'affiliation', 'organization', 'school_name', 'university_name', 'institution_name'], get);
  if (v1) return v1;
  const v2 = bestByValueRegex(item, [/\bUniversity\b/i], { excludeRes: [/^Department of\b/i, /\bGraduate School\b/i, /\bFaculty\b/i, /^College of\b/i] });
  if (v2) return v2;
  return bestByPathKeywords(item, ['university', 'institution', 'school', 'organization'], { exclude: [/^Department of\b/i] });
}

function extractEducationGraduateSchool(item) {
  const v1 = preferKeys(item, ['graduate_school', 'graduate', 'school_of', 'graduate_school_name', 'grad_school', 'gradschool'], get);
  if (v1 && /\bGraduate School\b/i.test(v1)) return v1;
  const v2 = bestByValueRegex(item, [/\bGraduate School\b/i], { excludeRes: [/^Department of\b/i, /^Faculty of\b/i, /^College of\b/i] });
  if (v2) return v2;
  return bestByPathKeywords(item, ['graduate', 'grad', 'graduate_school', 'gradschool'], { exclude: [/^Department of\b/i, /^Faculty of\b/i, /^College of\b/i], require: [/\bGraduate School\b/i] });
}

function extractEducationFaculty(item) {
  const v1 = preferKeys(item, ['faculty', 'college', 'division', 'faculty_name', 'college_name', 'division_name'], get);
  if (v1 && !/\bGraduate School\b/i.test(v1) && !/^Department of\b/i.test(v1)) return v1;
  const v2 = bestByValueRegex(item, [/^Faculty of\b/i, /^College of\b/i], { excludeRes: [/^Department of\b/i, /\bGraduate School\b/i] });
  if (v2) return v2;
  const v3 = bestByValueRegex(item, [/\bFaculty\b/i], { excludeRes: [/^Department of\b/i, /\bGraduate School\b/i] });
  if (v3) return v3;
  return bestByPathKeywords(item, ['faculty', 'college', 'division'], { exclude: [/^Department of\b/i, /\bGraduate School\b/i] });
}

function extractEducationDepartment(item) {
  return bestByValueRegex(item, [/^Department of\b/i], { excludeRes: [] }) || '';
}

/* Titles */

function bestEffortTitle(typeKey, item) {
  const prefer = (keys) => preferKeys(item, keys, get);
  const preferEnNoJa = (keys) => preferKeys(item, keys, getEnNoJa);

  if (typeKey === 'research_interests') {
    const t = preferEnNoJa(['research_interest', 'keyword', 'research_keyword', 'research_interests', 'name', 'title']);
    if (t) return t;
    return bestFromWholeEnNoJa(item);
  }

  if (typeKey === 'research_experience') {
    const org = prefer(['affiliation', 'institution', 'organization', 'workplace', 'employer', 'university', 'company', 'school']);
    const dept = prefer(['graduate_school', 'faculty', 'college', 'department', 'division', 'section']);
    const pos = prefer(['position', 'job', 'role', 'occupation', 'title']);
    return cleanNoQuestion(joinNonEmpty([org, dept, pos], ' / ') || bestFromWhole(item));
  }

  if (typeKey === 'education') {
    const school = extractEducationSchool(item);
    let grad = extractEducationGraduateSchool(item);
    let faculty = extractEducationFaculty(item);
    const dept = extractEducationDepartment(item);
    const degree = prefer(['degree', 'education_level', 'qualification', 'status', 'completion']);
    if (grad && faculty && cleanNoQuestion(grad) === cleanNoQuestion(faculty)) faculty = '';
    return cleanNoQuestion(joinNonEmpty([school, grad, faculty, dept, degree], ' / ') || bestFromWhole(item));
  }

  if (typeKey === 'teaching_experience') {
    const course = prefer(['course_name', 'course', 'subject', 'class_name', 'name', 'title']);
    const org = prefer(['affiliation', 'institution', 'organization', 'university', 'school']);
    return cleanNoQuestion(joinNonEmpty([course, org], ' / ') || bestFromWhole(item));
  }

  if (typeKey === 'association_memberships') {
    return cleanNoQuestion(prefer(['association', 'organization', 'society', 'name', 'title']) || bestFromWhole(item));
  }

  if (typeKey === 'academic_contribution') {
    const act = prefer(['activity', 'contribution', 'role', 'name', 'title', 'description', 'summary']);
    const org = prefer(['organization', 'institution', 'affiliation']);
    return cleanNoQuestion(joinNonEmpty([act, org], ' / ') || bestFromWhole(item));
  }

  return cleanNoQuestion(prefer(['title', 'name', 'paper_title', 'book_title', 'presentation_title', 'work_title', 'project_title', 'activity_title', 'subject', 'description', 'summary']) || bestFromWhole(item));

  function bestFromWhole(obj) {
    const xs = collectStrings(obj);
    const cands = [];
    for (const { path, s } of xs) {
      if (!s) continue;
      if (s.length < 2 || s.length > 240) continue;
      if (looksLikeBareDate(s) || looksLikeUrl(s) || looksLikeNumberOnly(s)) continue;
      let score = 0;
      const p = (path || '').toLowerCase();
      if (p.includes('title') || p.includes('name')) score += 30;
      if (p.includes('keyword') || p.includes('interest') || p.includes('area')) score += 20;
      if (p.includes('course') || p.includes('subject')) score += 18;
      if (p.includes('affiliation') || p.includes('institution') || p.includes('organization') || p.includes('society')) score += 14;
      score += Math.min(20, Math.floor(s.length / 12));
      cands.push({ s: cleanNoQuestion(s), score });
    }
    cands.sort((a, b) => b.score - a.score);
    return cands.length ? cands[0].s : '(no title)';
  }

  function bestFromWholeEnNoJa(obj) {
    const xs = collectStrings(obj);
    const cands = [];
    for (const { path, s } of xs) {
      const v = pickEnOnlyNoJa(s);
      if (!v) continue;
      if (v.length < 2 || v.length > 240) continue;
      if (looksLikeBareDate(v) || looksLikeUrl(v) || looksLikeNumberOnly(v)) continue;
      let score = 0;
      const p = (path || '').toLowerCase();
      if (p.includes('title') || p.includes('name')) score += 30;
      if (p.includes('keyword') || p.includes('interest')) score += 20;
      score += Math.min(20, Math.floor(v.length / 12));
      cands.push({ s: cleanNoQuestion(v), score });
    }
    cands.sort((a, b) => b.score - a.score);
    return cands.length ? cands[0].s : '(no title)';
  }
}

/* Date: year-only */

function yearTokenFromRaw(raw) {
  const s = String(raw || '');
  if (!s) return '';
  if (/9999/.test(s)) return 'present';
  const m = s.match(/\b(19\d{2}|20\d{2})\b/);
  return m ? m[1] : '';
}

function yearPairFromSingleRaw(raw) {
  const s = String(raw || '');
  if (!s) return [];
  const years = [];
  if (/9999/.test(s)) years.push('present');
  const ms = s.match(/\b(19\d{2}|20\d{2}|9999)\b/g) || [];
  for (const y of ms) {
    const yy = (y === '9999') ? 'present' : y;
    if (!years.includes(yy)) years.push(yy);
    if (years.length >= 2) break;
  }
  return years;
}

function pickYearRange(item) {
  const startRaw = get(item, 'start_date') || get(item, 'from_date') || get(item, 'publication_date') || get(item, 'date') || get(item, 'year') || get(item, 'modified');
  const endRaw = get(item, 'to_date') || get(item, 'end_date');
  const sy = yearTokenFromRaw(startRaw);
  const ey = yearTokenFromRaw(endRaw);
  if (sy && ey) return cleanNoQuestion(`${sy}-${ey}`);
  const pair = yearPairFromSingleRaw(startRaw);
  if (pair.length >= 2) return cleanNoQuestion(`${pair[0]}-${pair[1]}`);
  return cleanNoQuestion(sy || '');
}

/* Venue */

function bestEffortVenue(typeKey, item) {
  if (!item) return '';
  const prefer = (keys) => preferKeys(item, keys, get);
  if (typeKey === 'published_papers') return cleanNoQuestion(prefer(['journal', 'journal_name', 'journal_title', 'publication_name', 'published_in', 'container_title', 'source', 'publisher', 'proceedings', 'conference', 'book_title']));
  if (typeKey === 'misc') return cleanNoQuestion(prefer(['journal', 'journal_name', 'journal_title', 'publication_name', 'published_in', 'source', 'publisher', 'magazine', 'book_title', 'proceedings', 'conference']));
  if (typeKey === 'presentations') return cleanNoQuestion(prefer(['conference', 'conference_name', 'conference_title', 'meeting', 'meeting_name', 'meeting_title', 'event', 'event_name', 'event_title', 'society', 'society_name', 'organization', 'organization_name', 'venue', 'place', 'proceedings', 'publisher']));
  return '';
}

/* Links: papers only, external only, forbid researchmap / api.researchmap */

function isForbiddenHost(url) {
  try {
    const u = new URL(url);
    const host = (u.hostname || '').toLowerCase();
    if (host === 'researchmap.jp' || host.endsWith('.researchmap.jp')) return true;
    if (host === 'api.researchmap.jp') return true;
    return false;
  } catch {
    return true;
  }
}

function cleanUrlToken(u) {
  let s = String(u || '').trim();
  if (!s) return '';
  s = s.replace(/&amp;/g, '&');
  while (/[)\],.;:!?]+$/.test(s)) s = s.replace(/[)\],.;:!?]+$/, '');
  while (/^[(\[]+/.test(s)) s = s.replace(/^[(\[]+/, '');
  return s.trim();
}

function normalizeExternalUrl(raw) {
  const s0 = cleanUrlToken(raw);
  if (!s0) return '';
  if (!/^https?:\/\//.test(s0)) return '';
  try {
    const u = new URL(s0);
    const fmt = (u.searchParams.get('format') || '').toLowerCase();
    if (fmt === 'json') return '';
    u.searchParams.delete('format');
    const out = u.toString();
    if (isForbiddenHost(out)) return '';
    if (/format=json/i.test(out)) return '';
    if (/\.json([?#]|$)/i.test(out)) return '';
    return out;
  } catch {
    return '';
  }
}

function extractUrlsFromHtmlOrTextString(s) {
  const out = [];
  const raw = String(s || '');
  if (!raw) return out;
  const hrefRe = /href\s*=\s*(['"])(https?:\/\/[^'"]+)\1/gi;
  let m;
  while ((m = hrefRe.exec(raw)) !== null) {
    const u = normalizeExternalUrl(m[2]);
    if (u && !out.includes(u)) out.push(u);
  }
  const plainRe = /https?:\/\/[^\s"'<>()]+/g;
  const ms = raw.match(plainRe) || [];
  for (const cand of ms) {
    const u = normalizeExternalUrl(cand);
    if (u && !out.includes(u)) out.push(u);
  }
  const doiRe = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/ig;
  const ds = raw.match(doiRe) || [];
  for (const d of ds) {
    const u = normalizeExternalUrl(`https://doi.org/${d}`);
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

function collectExternalUrlCandidatesDeep(x, out, depth = 0) {
  if (x == null) return;
  if (depth > 12) return;
  if (typeof x === 'string') {
    const urls = extractUrlsFromHtmlOrTextString(x);
    for (const u of urls) if (!out.includes(u)) out.push(u);
    return;
  }
  if (typeof x === 'number' || typeof x === 'boolean') return;
  if (Array.isArray(x)) { for (const v of x) collectExternalUrlCandidatesDeep(v, out, depth + 1); return; }
  if (typeof x === 'object') { for (const [k, v] of Object.entries(x)) { if (k === '@type') continue; collectExternalUrlCandidatesDeep(v, out, depth + 1); } }
}

function scorePaperUrl(u) {
  let score = 0;
  try {
    const url = new URL(u);
    const host = (url.hostname || '').toLowerCase();
    const path = (url.pathname || '').toLowerCase();
    if (host === 'doi.org') score += 90;
    if (host === 'jstage.jst.go.jp') score += 80;
    if (host.endsWith('springer.com') || host === 'link.springer.com') score += 70;
    if (host.endsWith('sciencedirect.com')) score += 70;
    if (host.endsWith('wiley.com') || host === 'onlinelibrary.wiley.com') score += 70;
    if (host.endsWith('tandfonline.com')) score += 70;
    if (host === 'projecteuclid.org') score += 60;
    if (host === 'arxiv.org') score += 55;
    if (host.endsWith('nature.com')) score += 65;
    if (host.endsWith('aps.org')) score += 65;
    if (host.endsWith('dl.acm.org') || host.endsWith('ieeexplore.ieee.org') || host.endsWith('acm.org') || host.endsWith('ieee.org')) score += 60;
    if (host.endsWith('cambridge.org')) score += 65;
    if (host.endsWith('academic.oup.com') || host.endsWith('oup.com') || host.endsWith('oxfordjournals.org')) score += 65;
    if (/\/article\//.test(path) || /\/abs\//.test(path) || /\/doi\//.test(path) || /\/document\//.test(path)) score += 10;
    if (/\.pdf$/.test(path)) score -= 10;
  } catch {
    score = 0;
  }
  return score;
}

function pickPaperExternalLink(item) {
  const candidates = [];
  const doi1 = item?.identifiers?.doi?.[0];
  const doi2 = item?.doi;
  const doi = pickLang(doi1) || pickLang(doi2);
  if (doi) {
    const nd = normalizeExternalUrl(`https://doi.org/${String(doi).trim()}`);
    if (nd) candidates.push(nd);
  }
  const deep = [];
  collectExternalUrlCandidatesDeep(item, deep);
  for (const u of deep) if (!candidates.includes(u)) candidates.push(u);
  const scored = candidates.map(u => ({ u, s: scorePaperUrl(u) })).sort((a, b) => b.s - a.s);
  return scored.length ? scored[0].u : '';
}

/* Summary (Affiliation / Degree) */

function sortKeyYearStart(item) {
  const s = get(item, 'start_date') || get(item, 'from_date') || get(item, 'date') || get(item, 'publication_date') || get(item, 'year') || '';
  const y = yearTokenFromRaw(s);
  if (!y) return -1;
  if (y === 'present') return 9999;
  const n = parseInt(y, 10);
  return Number.isFinite(n) ? n : -1;
}

function computeAffiliationFromResearchExperience(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const xs = items.slice().sort((a, b) => sortKeyYearStart(b) - sortKeyYearStart(a));
  return cleanNoQuestion(bestEffortTitle('research_experience', xs[0]));
}

function degreePriority(deg) {
  const s = String(deg || '').toLowerCase();
  if (!s) return 0;
  if (s.includes('doctor') || s.includes('ph.d') || s.includes('phd')) return 5;
  if (s.includes('master') || s.includes('m.s') || s.includes('msc') || s.includes('m.sc')) return 4;
  if (s.includes('bachelor') || s.includes('b.s') || s.includes('ba') || s.includes('b.a') || s.includes('b.sc')) return 3;
  if (s.includes('associate')) return 2;
  return 1;
}

function computeDegreeLineFromEducation(items) {
  const FALLBACK = 'Doctor (Human and Environmental Studies, Kyoto University)';
  if (!Array.isArray(items) || items.length === 0) return FALLBACK;
  const candidates = [];
  for (const it of items) {
    const degRaw = preferKeys(it, ['degree', 'education_level', 'qualification', 'status', 'completion'], get);
    const deg = cleanNoQuestion(degRaw);
    if (!deg) continue;
    const pr = degreePriority(deg);
    if (pr < 5) continue;
    const school = extractEducationSchool(it);
    const grad = extractEducationGraduateSchool(it);
    const faculty = extractEducationFaculty(it);
    let primary = grad || faculty || '';
    if (!primary) {
      const dept = extractEducationDepartment(it);
      if (dept) primary = dept;
    }
    const inside = cleanNoQuestion(joinNonEmptyComma([primary, school]));
    const line = inside ? `${deg} (${inside})` : deg;
    candidates.push({ line, p: pr, y: sortKeyYearStart(it) });
  }
  if (!candidates.length) return FALLBACK;
  candidates.sort((a, b) => (b.p - a.p) || (b.y - a.y));
  return candidates[0].line || FALLBACK;
}

/* Fetch (429 aware) */

async function fetchJsonWithRetry(url, maxRetry = 5) {
  let lastErr = null;
  for (let i = 0; i <= maxRetry; i++) {
    try {
      const res = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store', headers: { 'Accept': 'application/json' } });
      if (res.status === 429) {
        const ra = res.headers.get('Retry-After');
        const waitMs = ra && /^\d+$/.test(ra) ? Math.min(60000, parseInt(ra, 10) * 1000) : Math.min(12000, 500 * (2 ** i));
        await sleep(waitMs);
        throw new Error('HTTP 429 Too Many Requests');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i === maxRetry) break;
      const backoff = Math.min(12000, 500 * (2 ** i));
      await sleep(backoff);
    }
  }
  throw lastErr;
}

async function fetchAllItems(typeKey) {
  let start = 1;
  const all = [];
  for (;;) {
    const url = `https://api.researchmap.jp/${encodeURIComponent(PERMALINK)}/${encodeURIComponent(typeKey)}?format=json&lang=${encodeURIComponent(LANG)}&limit=${LIMIT}&start=${start}`;
    const data = await fetchJsonWithRetry(url, 5);
    const items = Array.isArray(data?.items) ? data.items : [];
    all.push(...items);
    if (items.length < LIMIT) break;
    start += items.length;
    await sleep(250);
  }
  return all;
}

/* Render */

function render(root, sections) {
  root.textContent = '';
  for (const sec of sections) {
    if (!sec.error && (!sec.items || sec.items.length === 0)) continue;
    const section = document.createElement('section');
    section.style.margin = '14px 0 20px 0';
    const h = document.createElement('h3');
    h.textContent = `${sec.label}${sec.error ? ' (error)' : ` (${sec.items.length})`}`;
    h.style.margin = '0 0 8px 0';
    section.appendChild(h);
    if (sec.error) {
      const p = document.createElement('p');
      p.textContent = sec.error;
      p.style.color = '#b00020';
      p.style.margin = '0';
      section.appendChild(p);
      root.appendChild(section);
      continue;
    }
    const ul = document.createElement('ul');
    ul.style.margin = '0';
    ul.style.paddingLeft = '18px';
    for (const item of sec.items) {
      const li = document.createElement('li');
      if (sec.key === '_affiliation' || sec.key === '_degree') {
        li.textContent = cleanNoQuestion(item && item._text ? item._text : '');
        ul.appendChild(li);
        continue;
      }
      if (sec.key === 'published_papers') {
        const title = cleanNoQuestion(bestEffortTitle(sec.key, item));
        const year = cleanNoQuestion(pickYearRange(item));
        const venue = cleanNoQuestion(bestEffortVenue(sec.key, item));
        const link = pickPaperExternalLink(item);
        if (link) {
          const a = document.createElement('a');
          a.href = link;
          a.textContent = title;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          li.appendChild(a);
        } else {
          li.appendChild(document.createTextNode(title));
        }
        if (venue) li.appendChild(document.createTextNode(`${SEP_VENUE}${venue}`));
        if (year) li.appendChild(document.createTextNode(` (${year})`));
        ul.appendChild(li);
        continue;
      }
      if (sec.key === 'misc' || sec.key === 'presentations') {
        const title = cleanNoQuestion(bestEffortTitle(sec.key, item));
        const year = cleanNoQuestion(pickYearRange(item));
        const venue = cleanNoQuestion(bestEffortVenue(sec.key, item));
        let line = title;
        if (venue) line += `${SEP_VENUE}${venue}`;
        if (year) line += ` (${year})`;
        li.textContent = line;
        ul.appendChild(li);
        continue;
      }
      const title = cleanNoQuestion(bestEffortTitle(sec.key, item));
      const year = cleanNoQuestion(pickYearRange(item));
      li.textContent = year ? `${title} (${year})` : title;
      ul.appendChild(li);
    }
    section.appendChild(ul);
    root.appendChild(section);
  }
}

async function loadAll() {
  const root = document.getElementById('rm-auto');
  if (!root) return;

  root.textContent = 'Loading…';

  const sections = [];
  let researchExperienceItems = [];
  let educationItems = [];
  let affiliation = '';
  let degreeLine = '';

  for (const t of TYPES) {
    try {
      const items = await fetchAllItems(t.key);
      sections.push({ key: t.key, label: t.label, items, error: '' });

      if (t.key === 'research_experience') {
        researchExperienceItems = items;
        affiliation = computeAffiliationFromResearchExperience(researchExperienceItems);
      }
      if (t.key === 'education') {
        educationItems = items;
        degreeLine = computeDegreeLineFromEducation(educationItems);
      }

      const injected = [];
      if (affiliation) injected.push({ key: '_affiliation', label: 'Affiliation', items: [{ _text: affiliation }], error: '' });
      if (degreeLine) injected.push({ key: '_degree', label: 'Degree', items: [{ _text: degreeLine }], error: '' });
      render(root, injected.concat(sections));

    } catch (e) {
      sections.push({ key: t.key, label: t.label, items: [], error: `Failed to load ${t.key}: ${String(e?.message || e)}` });
      const injected = [];
      if (affiliation) injected.push({ key: '_affiliation', label: 'Affiliation', items: [{ _text: affiliation }], error: '' });
      if (degreeLine) injected.push({ key: '_degree', label: 'Degree', items: [{ _text: degreeLine }], error: '' });
      render(root, injected.concat(sections));
    }

    await sleep(800);
  }
}

(function boot() {
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadAll);
    else loadAll();
  } catch (e) {
    const root = document.getElementById('rm-auto');
    if (root) root.textContent = `Fatal error: ${String(e?.message || e)}`;
  }
})();
