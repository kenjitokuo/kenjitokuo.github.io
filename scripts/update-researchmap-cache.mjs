import { readFile, mkdir, writeFile } from 'node:fs/promises';

const TYPES = [
  'research_interests', 'research_experience', 'education',
  'committee_memberships', 'awards', 'published_papers', 'misc',
  'books_etc', 'presentations', 'teaching_experience',
  'association_memberships', 'works', 'industrial_property_rights',
  'social_contribution', 'media_coverage', 'academic_contribution', 'others'
];
const PERMALINK = 'tokuo';
const LANG = 'en';
const LIMIT = 200;
const PATH = new URL('../data/researchmap-cache.json', import.meta.url);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function previousSnapshot() {
  try {
    const data = JSON.parse(await readFile(PATH, 'utf8'));
    if (data.version === 1 && data.permalink === PERMALINK &&
        data.lang === LANG && data.sections && typeof data.sections === 'object') {
      return data;
    }
  } catch {
    // First run can start without a snapshot.
  }
  return null;
}

async function fetchPage(key, start) {
  const url = 'https://api.researchmap.jp/' + encodeURIComponent(PERMALINK) +
    '/' + encodeURIComponent(key) + '?format=json&lang=' +
    encodeURIComponent(LANG) + '&limit=' + LIMIT + '&start=' + start;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000)
      });
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        throw Object.assign(new Error(key + ': HTTP ' + response.status), { permanent: true });
      }
      if (response.status === 429 || response.status >= 500) {
        if (attempt < 2) {
          await sleep(1500 * (2 ** attempt));
          continue;
        }
      }
      if (!response.ok) throw new Error(key + ': HTTP ' + response.status);
      const data = await response.json();
      if (!data || !Array.isArray(data.items)) {
        throw Object.assign(new Error(key + ': invalid items response'), { permanent: true });
      }
      return data.items;
    } catch (error) {
      lastErr = error;
      if (error.permanent || attempt === 2) break;
      await sleep(1500 * (2 ** attempt));
    }
  }
  throw lastErr || new Error(key + ': request failed');
}

async function fetchAll(key) {
  const all = [];
  let start = 1;
  for (let page = 0; page < 50; page++) {
    await sleep(600);
    const items = await fetchPage(key, start);
    all.push(...items);
    if (items.length < LIMIT) return all;
    start += items.length;
  }
  throw new Error(key + ': too many API pages');
}

async function main() {
  const previous = await previousSnapshot();
  const sections = { ...(previous?.sections || {}) };
  let succeeded = 0;
  let failed = 0;
  for (const key of TYPES) {
    try {
      const items = await fetchAll(key);
      sections[key] = items;
      succeeded++;
      console.log(key + ': ' + items.length + ' items');
    } catch (error) {
      failed++;
      console.warn(key + ': ' + String(error) +
        (Array.isArray(sections[key]) ? '; saved category kept' : '; no saved category'));
    }
  }

  if (succeeded === 0) {
    throw new Error('All API requests failed. The existing snapshot remains unchanged.');
  }

  const snapshot = {
    version: 1,
    permalink: PERMALINK,
    lang: LANG,
    updatedAt: new Date().toISOString(),
    sections
  };
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  console.log('Updated ' + succeeded + ' categories; failed ' + failed + '.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
