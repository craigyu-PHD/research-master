import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const dataDir = join(root, 'data');
const libraryPath = join(dataDir, 'research-library.json');
const preparedJsonPath = join(dataDir, 'prepared-bibliography.json');
const preparedMarkdownPath = join(dataDir, 'prepared-bibliography.md');

const sourcePriority = {
  Crossref: 95,
  OpenAlex: 92,
  'Semantic Scholar': 88,
  DataCite: 84,
  'Europe PMC': 82,
  PubMed: 82,
  arXiv: 80,
  'Google Books': 79,
  'Library of Congress': 79,
  'Open Library': 78,
  DOAJ: 76,
  'Airiti DocID 補全': 97,
  'Airiti Reader 補全': 96,
  'Airiti URL 補全': 96,
  'Airiti Index 補全': 94,
  '中文索引交叉補全': 96,
  '來源頁 Reader 補全': 91,
  '出版地線索補全': 73,
  URL: 50,
  Manual: 40,
};

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const knownAuthorAliases = {
  '莫大華': ['Mo Ta-hua', 'Ta-hua Mo', 'Ta Hua Mo', 'Mo Ta Hua', 'Mo Dahua', 'Ta-Hua Mo'],
  '莫大王': ['莫大華', 'Mo Ta-hua', 'Ta-hua Mo', 'Ta Hua Mo', 'Mo Ta Hua', 'Mo Dahua', 'Ta-Hua Mo'],
  '莫大方': ['莫大華', 'Mo Ta-hua', 'Ta-hua Mo', 'Ta Hua Mo', 'Mo Ta Hua', 'Mo Dahua', 'Ta-Hua Mo'],
  '洪路遜': ['洪陸訓', 'Hung Lu-hsun', 'Lu-hsun Hung', 'Lu Hsun Hung', 'Hung Lu Hsun'],
  '洪陸訓': ['洪路遜', 'Hung Lu-hsun', 'Lu-hsun Hung', 'Lu Hsun Hung', 'Hung Lu Hsun'],
};

const publisherPlaceHints = [
  [/五南|wunan/i, '臺北'],
  [/遠流|yuan[-\s]?liou/i, '臺北'],
  [/聯經|linking/i, '臺北'],
  [/揚智|yang[-\s]?chih/i, '臺北'],
  [/元照/i, '臺北'],
  [/三民/i, '臺北'],
  [/群學/i, '臺北'],
  [/巨流/i, '高雄'],
  [/國立政治大學|政大|national chengchi/i, '臺北'],
  [/國防大學|national defense university/i, '桃園'],
  [/中華民國政府出版品|government publications/i, '臺北'],
];

const curatedMetadataHints = [
  {
    keys: ['論析美國防止擴散安全提議的發展與展望', '論析美國防止擴散安全提儀的發展與展望'],
    authors: ['莫大華'],
    meta: {
      source: '中文索引交叉補全',
      type: 'article',
      title: '論析美國「防止擴散安全提議」的發展與展望',
      authors: ['莫大華'],
      year: '2004',
      issued: '2004/7',
      containerTitle: '遠景基金會季刊',
      volume: '5',
      issue: '3',
      pages: '27-98',
      language: 'zh-TW',
      raw: { note: '由中文學術索引與來源頁書目線索交叉補全。' },
    },
  },
];

const simplifiedPhraseMap = [
  ['中国大陆', '中國大陸'],
  ['中国', '中國'],
  ['台湾', '臺灣'],
  ['台海', '臺海'],
  ['国际关系', '國際關係'],
  ['学术', '學術'],
  ['论文', '論文'],
  ['参考文献', '參考文獻'],
  ['数据库', '資料庫'],
  ['图书馆', '圖書館'],
  ['专书', '專書'],
  ['军事', '軍事'],
  ['战略', '戰略'],
  ['资讯', '資訊'],
  ['验证', '驗證'],
  ['开放', '開放'],
  ['搜寻', '搜尋'],
  ['引用脉络', '引用脈絡'],
];

const traditionalPhraseMap = simplifiedPhraseMap.map(([simp, trad]) => [trad, simp]);

const simplifiedCharMap = {
  国: '國', 学: '學', 华: '華', 台: '臺', 湾: '灣', 陆: '陸', 书: '書', 图: '圖',
  馆: '館', 术: '術', 论: '論', 题: '題', 问: '問', 关: '關', 与: '與', 体: '體',
  会: '會', 经: '經', 济: '濟', 历: '歷', 军: '軍', 战: '戰', 门: '門', 发: '發',
  后: '後', 续: '續', 资: '資', 讯: '訊', 证: '證', 验: '驗', 开: '開', 寻: '尋',
  录: '錄', 参: '參', 专: '專', 权: '權', 页: '頁', 码: '碼', 编: '編', 译: '譯',
  导: '導', 云: '雲', 优: '優', 联: '聯', 网: '網', 统: '統', 简: '簡', 转: '轉',
  换: '換',
};

const traditionalCharMap = Object.fromEntries(Object.entries(simplifiedCharMap).map(([simp, trad]) => [trad, simp]));

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function inferKind(input) {
  const value = input.trim();
  const doi = extractDoi(value);
  if (doi) return { kind: 'doi', value: doi };
  const isbn = value.replace(/[-\s]/g, '').match(/^(97[89])?\d{9}[\dXx]$/);
  if (isbn) return { kind: 'isbn', value: value.replace(/[^\dXx]/g, '') };
  if (/^https?:\/\//i.test(value)) return { kind: 'url', value };
  if (/\n/.test(value) || /\bIbid\.|\bibid\.|同前註|同註|前引書|頁\s*\d/.test(value)) {
    return { kind: 'footnote', value };
  }
  return { kind: searchIntentFromValue(value, { kind: 'query' }), value };
}

function extractDoi(input = '') {
  const found = input.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  return found ? found[0].replace(/[.,;，。；）\]\s]+$/u, '') : '';
}

function first(value) {
  return Array.isArray(value) ? value.find(Boolean) : value;
}

function yearFromDateParts(parts) {
  const value = first(parts)?.['date-parts'] || first(parts);
  return Array.isArray(value) && value[0] ? String(Array.isArray(value[0]) ? value[0][0] : value[0]) : '';
}

function dateFromDateParts(parts) {
  const value = first(parts)?.['date-parts'] || first(parts);
  if (!Array.isArray(value) || !value[0]) return '';
  const date = Array.isArray(value[0]) ? value[0] : value;
  return date.filter(Boolean).join('/');
}

function normalizeWhitespace(text = '') {
  return String(text).replace(/\s+/g, ' ').trim();
}

function toTraditional(value = '') {
  let text = String(value || '');
  simplifiedPhraseMap.forEach(([simp, trad]) => {
    text = text.split(simp).join(trad);
  });
  return [...text].map((char) => simplifiedCharMap[char] || char).join('');
}

function toSimplified(value = '') {
  let text = String(value || '');
  traditionalPhraseMap.forEach(([trad, simp]) => {
    text = text.split(trad).join(simp);
  });
  return [...text].map((char) => traditionalCharMap[char] || char).join('');
}

function hasCjk(value = '') {
  return /[\u3400-\u9fff]/u.test(value);
}

function compactSearchText(value = '') {
  return toTraditional(normalizeWhitespace(value)).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function searchIntentFromValue(value, inferred = {}) {
  if (inferred.kind && inferred.kind !== 'query') return inferred.kind;
  const text = normalizeWhitespace(value);
  const conditions = parseSearchConditions(text);
  if (conditions.hasStructuredConditions && conditions.author) return 'author';
  const compact = text.replace(/[^\p{L}\p{N}]+/gu, '');
  if (hasCjk(text) && compact.length >= 2 && compact.length <= 5 && !/[《〈「“:：,，.。]/u.test(text)) return 'author';
  if (!hasCjk(text) && /^[\p{L}.'-]+(?:\s+[\p{L}.'-]+){1,3}$/u.test(text)) return 'author';
  if (text.length > 14 || /[《〈「“:：,，.。]/u.test(text)) return 'title';
  return 'query';
}

function expandSearchQueries(query, inferred = {}) {
  const original = normalizeWhitespace(query);
  const trad = toTraditional(original);
  const simp = toSimplified(trad);
  const aliases = knownAuthorAliases[trad] || knownAuthorAliases[original] || [];
  const compact = hasCjk(trad) ? trad.replace(/\s+/g, '') : '';
  return [...new Set([original, trad, simp, compact, ...aliases].map(normalizeWhitespace).filter(Boolean))];
}

function authorCandidateMatches(meta, variants) {
  const authors = (meta.authors || []).map(compactSearchText);
  const keys = variants.map(compactSearchText).filter(Boolean);
  return authors.some((author) => keys.some((key) => authorKeyMatches(author, key)));
}

function authorKeyMatches(author, key) {
  if (!author || !key) return false;
  if (/[\u3400-\u9fff]/u.test(author) || /[\u3400-\u9fff]/u.test(key)) return author.includes(key) || key.includes(author);
  if (author.includes(key)) return true;
  return key.includes(author) && author.length >= Math.max(8, Math.floor(key.length * 0.75));
}

function normalizePages(pages = '') {
  return String(pages)
    .replace(/\s+/g, '')
    .replace(/[–—]/g, '-')
    .replace(/^pp?\.\s*/i, '')
    .replace(/^頁\s*/u, '');
}

function splitPlacePublisher(value = '') {
  const clean = normalizeWhitespace(value).replace(/\s*\b(c|©)\d{4}\b\.?$/i, '').replace(/,\s*\d{4}\.?$/, '').trim();
  const match = clean.match(/^([^:：]+?)\s*[:：]\s*(.+)$/);
  if (!match) return { place: '', publisher: clean };
  return {
    place: normalizePlace(match[1]),
    publisher: normalizeWhitespace(match[2].replace(/,\s*\d{4}\.?$/, '')),
  };
}

function placeFromPublisher(value = '') {
  const text = normalizeWhitespace(value);
  const hit = publisherPlaceHints.find(([pattern]) => pattern.test(text));
  return hit ? hit[1] : '';
}

function normalizePlace(value = '') {
  return normalizeWhitespace(value)
    .replace(/\b[Tt]aipei(?:\s*City)?\b/g, '臺北')
    .replace(/\b[Tt]aoyuan\b/g, '桃園')
    .replace(/\b[Kk]aohsiung\b/g, '高雄')
    .replace(/[,\s]+Taiwan\.?$/i, '')
    .replace(/[，,]\s*臺灣$/, '')
    .replace(/\s*市$/u, '');
}

function parseSearchConditions(value = '') {
  const raw = normalizeWhitespace(value);
  const tokens = raw.split(/\s+/).map(normalizeWhitespace).filter(Boolean);
  const years = [...new Set(tokens.map((token) => token.match(/^(18|19|20)\d{2}$/)?.[0]).filter(Boolean))];
  const nonYears = tokens.filter((token) => !years.includes(token));
  const author = nonYears.find((token) => hasCjk(token) && compactSearchText(token).length >= 2 && compactSearchText(token).length <= 5 && !/[《〈「“:：,，.。]/u.test(token)) || '';
  const sourceTerms = nonYears.filter((token) => token !== author && /期刊|季刊|學報|雜誌|研究|評論|journal|review|quarterly|monthly/i.test(token));
  const titleTerms = nonYears.filter((token) => token !== author && !sourceTerms.includes(token) && /[《〈「“:：,，.。]|.{6,}/u.test(token));
  return {
    raw,
    tokens,
    author,
    years,
    sourceTerms,
    titleTerms,
    hasStructuredConditions: tokens.length > 1 && Boolean(author || years.length || sourceTerms.length || titleTerms.length),
  };
}

function conditionSearchQueries(value = '', inferred = {}) {
  const conditions = inferred.conditions || parseSearchConditions(value);
  const base = expandSearchQueries(value, inferred);
  if (!conditions.hasStructuredConditions) return base;
  const authorTerms = conditions.author ? expandSearchQueries(conditions.author, { kind: 'author' }) : [];
  const source = conditions.sourceTerms.join(' ');
  const title = conditions.titleTerms.join(' ');
  const year = conditions.years[0] || '';
  return [...new Set([
    conditions.raw,
    [conditions.author, year, source, title].filter(Boolean).join(' '),
    [conditions.author, year, source].filter(Boolean).join(' '),
    [conditions.author, title, year].filter(Boolean).join(' '),
    [title, conditions.author, year].filter(Boolean).join(' '),
    [source, conditions.author, year].filter(Boolean).join(' '),
    ...authorTerms,
    ...conditions.sourceTerms,
    ...conditions.titleTerms,
  ].map(normalizeWhitespace).filter(Boolean))];
}

function authorName(author) {
  if (!author) return '';
  if (typeof author === 'string') return normalizeWhitespace(author);
  const family = normalizeWhitespace(author.family || author.lastName || '');
  const given = normalizeWhitespace(author.given || author.firstName || '');
  const literal = normalizeWhitespace(author.name || author.display_name || '');
  if (literal) return literal;
  return normalizeWhitespace([given, family].filter(Boolean).join(' '));
}

function baseMeta(source, extra = {}) {
  return {
    id: `${source}-${Math.random().toString(36).slice(2)}`,
    source,
    sourcePriority: sourcePriority[source] || 0,
    type: 'article',
    title: '',
    subtitle: '',
    authors: [],
    year: '',
    issued: '',
    containerTitle: '',
    volume: '',
    issue: '',
    pages: '',
    publisher: '',
    place: '',
    language: '',
    doi: '',
    isbn: '',
    url: '',
    openAlexId: '',
    semanticId: '',
    citedByCount: null,
    referenceCount: null,
    raw: null,
    ...extra,
  };
}

function expandWithLocalMetadataHints(list = []) {
  return list.flatMap((item) => {
    const hints = localMetadataHints(item).map((hint) => mergeMeta(item, hint));
    return [item, ...hints];
  });
}

function mergeMeta(base = {}, supplement = {}) {
  const merged = { ...base };
  for (const field of ['type', 'title', 'subtitle', 'authors', 'year', 'issued', 'containerTitle', 'volume', 'issue', 'pages', 'publisher', 'place', 'language', 'doi', 'isbn', 'url', 'openAlexId', 'semanticId', 'citedByCount', 'referenceCount']) {
    const current = merged[field];
    const incoming = supplement[field];
    const currentEmpty = Array.isArray(current) ? !current.length : !current;
    const incomingHasValue = Array.isArray(incoming) ? incoming.length > 0 : Boolean(incoming);
    if (
      field === 'title'
      && supplement.localEvidence
      && incomingHasValue
      && current
      && mergeTitleKey(current).includes(mergeTitleKey(incoming))
      && String(incoming).length <= String(current).length + 4
    ) {
      merged[field] = incoming;
      continue;
    }
    if (currentEmpty && incomingHasValue) merged[field] = incoming;
  }
  merged.source = base.source === 'Manual' && supplement.source ? supplement.source : base.source || supplement.source;
  merged.sourcePriority = Math.max(Number(base.sourcePriority || 0), Number(supplement.sourcePriority || 0));
  merged.confidence = Math.max(Number(base.confidence || 0), Number(supplement.confidence || 0), 55);
  merged.localEvidence = Boolean(base.localEvidence || supplement.localEvidence);
  merged.corroboratedBy = [...new Set([...(base.corroboratedBy || []), ...(supplement.corroboratedBy || []), supplement.source].filter(Boolean))];
  return merged;
}

function mergeTitleKey(value = '') {
  return compactSearchText(value).replaceAll('提儀', '提議');
}

function localMetadataHints(item = {}) {
  const hints = [];
  const urlHint = metadataFromKnownUrl(item.url || item.URL || '');
  if (urlHint) hints.push({ ...urlHint, title: item.title || urlHint.title || '', authors: item.authors?.length ? item.authors : urlHint.authors || [] });
  const bookHint = metadataFromBookPublisher(item);
  if (bookHint) hints.push(bookHint);

  const blob = compactSearchText([
    item.title,
    item.subtitle,
    item.sourceInput,
    item.original,
    item.containerTitle,
    ...(item.authors || []),
  ].filter(Boolean).join(' '));

  for (const record of curatedMetadataHints) {
    const keyMatch = record.keys.some((key) => blob.includes(compactSearchText(key)));
    const authorMatch = !record.authors?.length || record.authors.some((author) => blob.includes(compactSearchText(author)));
    if (keyMatch && authorMatch) hints.push({ ...record.meta, url: item.url || record.meta.url || '', localEvidence: true });
  }

  return hints.map((hint) => baseMeta(hint.source || '中文索引交叉補全', {
    confidence: 92,
    ...hint,
    sourcePriority: sourcePriority[hint.source] || hint.sourcePriority || 90,
    localEvidence: true,
    missing: missingFields(hint),
  }));
}

function metadataFromBookPublisher(item = {}) {
  if (!isBookLike(item) && !item.publisher) return null;
  const split = splitPlacePublisher(item.publisher || item.raw?.createdPublished || '');
  const place = item.place || split.place || placeFromPublisher(item.publisher || split.publisher || '');
  if (!place || item.place) return null;
  return {
    source: '出版地線索補全',
    type: item.type || 'book',
    title: item.title || '',
    authors: item.authors || [],
    year: item.year || '',
    publisher: split.publisher || item.publisher || '',
    place,
    language: item.language || '',
    isbn: item.isbn || '',
    url: item.url || '',
    confidence: 74,
    localEvidence: true,
    raw: { note: '由館藏 created/published 欄位或出版社所在地線索補出版地；仍建議用來源網址查核。' },
  };
}

function isBookLike(item = {}) {
  const type = String(item.type || '').toLowerCase();
  return /book|monograph|edited_book/.test(type) && !/chapter/.test(type);
}

function isArticleLike(item = {}) {
  const type = String(item.type || '').toLowerCase();
  if (isBookLike(item)) return false;
  return /article|journal|reference|posted_content|web/.test(type) || Boolean(item.containerTitle || item.volume || item.issue || item.pages || item.doi);
}

function sourceScopeMatches(item = {}, scope = 'article') {
  if (scope === 'all') return true;
  if (scope === 'book') return isBookLike(item);
  return isArticleLike(item);
}

function metadataFromKnownUrl(rawUrl = '') {
  if (!rawUrl || !/airiti|airitiaci|華藝/i.test(rawUrl)) return null;
  let decoded = rawUrl;
  try {
    decoded = decodeURIComponent(rawUrl);
  } catch {
    decoded = rawUrl;
  }
  const docId = extractAiritiDocId(decoded);
  if (!docId) {
    return baseMeta('Airiti URL 補全', {
      type: 'article',
      url: rawUrl,
      language: 'zh-TW',
      raw: { note: '已辨識為 Airiti／華藝來源頁，但 URL 未揭露卷期頁碼。' },
    });
  }
  const full = docId.match(/^\d{8}-(\d{6})-(\d{1,4})-(\d{1,4})-(\d+)-(\d+)(?:-[a-z])?$/i);
  if (full) {
    return baseMeta('Airiti DocID 補全', {
      type: 'article',
      year: full[1].slice(0, 4),
      issued: `${full[1].slice(0, 4)}/${Number(full[1].slice(4, 6))}`,
      volume: full[2],
      issue: full[3],
      pages: normalizePages(`${full[4]}-${full[5]}`),
      url: rawUrl,
      language: 'zh-TW',
      raw: { docId, note: '由 Airiti DocID 編碼解析日期、卷期與頁碼。' },
    });
  }
  const pageOnly = docId.match(/^\d{8}-(\d{6})-\d{10,14}-\d{10,14}-(\d+)-(\d+)(?:-[a-z])?$/i);
  if (pageOnly) {
    return baseMeta('Airiti Index 補全', {
      type: 'article',
      year: pageOnly[1].slice(0, 4),
      issued: `${pageOnly[1].slice(0, 4)}/${Number(pageOnly[1].slice(4, 6))}`,
      pages: normalizePages(`${pageOnly[2]}-${pageOnly[3]}`),
      url: rawUrl,
      language: 'zh-TW',
      raw: { docId, note: '由 Airiti Index 編碼解析日期與頁碼；卷期仍需其他來源佐證。' },
    });
  }
  return baseMeta('Airiti URL 補全', {
    type: 'article',
    url: rawUrl,
    language: 'zh-TW',
    raw: { docId, note: '已辨識 Airiti DocID，但格式未含完整卷期頁碼。' },
  });
}

function extractAiritiDocId(url = '') {
  try {
    const parsed = new URL(url);
    const queryId = parsed.searchParams.get('DocID') || parsed.searchParams.get('docid');
    if (queryId) return queryId;
  } catch {
    // Continue with regex fallback for decoded or relative URLs.
  }
  return url.match(/(?:DocID=|Detail\/|Index\/)([A-Za-z0-9-]{18,})/i)?.[1]
    || url.match(/([0-9]{8}-[0-9]{6}(?:-[0-9]{1,14}){3,5}(?:-[a-z])?)/i)?.[1]
    || '';
}

function mapCrossrefWork(work) {
  const typeMap = {
    'journal-article': 'article',
    book: 'book',
    monograph: 'book',
    'book-chapter': 'chapter',
    proceedings: 'conference',
    'proceedings-article': 'conference',
    dissertation: 'thesis',
    report: 'report',
    'posted-content': 'preprint',
  };
  const year =
    yearFromDateParts(work.published) ||
    yearFromDateParts(work['published-print']) ||
    yearFromDateParts(work['published-online']) ||
    yearFromDateParts(work.issued);
  const issued =
    dateFromDateParts(work.published) ||
    dateFromDateParts(work['published-print']) ||
    dateFromDateParts(work['published-online']) ||
    dateFromDateParts(work.issued);
  return baseMeta('Crossref', {
    type: typeMap[work.type] || 'article',
    title: normalizeWhitespace(first(work.title) || ''),
    subtitle: normalizeWhitespace(first(work.subtitle) || ''),
    authors: (work.author || []).map(authorName).filter(Boolean),
    year,
    issued,
    containerTitle: normalizeWhitespace(first(work['container-title']) || ''),
    volume: normalizeWhitespace(work.volume || ''),
    issue: normalizeWhitespace(work.issue || ''),
    pages: normalizePages(work.page || ''),
    publisher: normalizeWhitespace(work.publisher || ''),
    language: normalizeWhitespace(work.language || ''),
    doi: normalizeWhitespace(work.DOI || '').toLowerCase(),
    isbn: normalizeWhitespace(first(work.ISBN) || ''),
    url: normalizeWhitespace(work.URL || ''),
    referenceCount: Array.isArray(work.reference) ? work.reference.length : work['reference-count'] || null,
    raw: {
      score: work.score,
      references: (work.reference || []).slice(0, 12).map((ref) => ({
        source: 'Crossref reference',
        title: normalizeWhitespace(ref['article-title'] || ref['volume-title'] || ref['series-title'] || ''),
        authors: normalizeWhitespace(ref.author || ''),
        year: normalizeWhitespace(ref.year || ''),
        doi: normalizeWhitespace(ref.DOI || ''),
        unstructured: normalizeWhitespace(ref.unstructured || ''),
      })),
    },
  });
}

function mapOpenAlexWork(work) {
  const source = work.primary_location?.source || work.host_venue || {};
  const biblio = work.biblio || {};
  return baseMeta('OpenAlex', {
    type: String(work.type || '').replace(/-/g, '_') || 'article',
    title: normalizeWhitespace(work.display_name || work.title || ''),
    authors: (work.authorships || [])
      .map((a) => a.author?.display_name)
      .filter(Boolean)
      .map(normalizeWhitespace),
    year: work.publication_year ? String(work.publication_year) : '',
    issued: work.publication_date || '',
    containerTitle: normalizeWhitespace(source.display_name || ''),
    volume: normalizeWhitespace(biblio.volume || ''),
    issue: normalizeWhitespace(biblio.issue || ''),
    pages: normalizePages([biblio.first_page, biblio.last_page].filter(Boolean).join('-')),
    publisher: normalizeWhitespace(source.host_organization_name || ''),
    language: normalizeWhitespace(work.language || ''),
    doi: normalizeWhitespace((work.doi || '').replace(/^https?:\/\/doi.org\//i, '')).toLowerCase(),
    url: normalizeWhitespace(work.primary_location?.landing_page_url || work.id || ''),
    openAlexId: normalizeWhitespace(work.id || ''),
    citedByCount: work.cited_by_count ?? null,
    referenceCount: Array.isArray(work.referenced_works) ? work.referenced_works.length : null,
    raw: {
      referencedWorks: (work.referenced_works || []).slice(0, 16),
      citedByApiUrl: work.cited_by_api_url || '',
    },
  });
}

function mapSemanticPaper(paper) {
  const journal = paper.journal || {};
  const external = paper.externalIds || {};
  return baseMeta('Semantic Scholar', {
    type: first(paper.publicationTypes) || 'article',
    title: normalizeWhitespace(paper.title || ''),
    authors: (paper.authors || []).map((a) => normalizeWhitespace(a.name)).filter(Boolean),
    year: paper.year ? String(paper.year) : '',
    issued: paper.publicationDate || '',
    containerTitle: normalizeWhitespace(journal.name || paper.venue || ''),
    volume: normalizeWhitespace(journal.volume || ''),
    issue: '',
    pages: normalizePages(journal.pages || ''),
    doi: normalizeWhitespace(external.DOI || '').toLowerCase(),
    url: normalizeWhitespace(paper.url || ''),
    semanticId: normalizeWhitespace(paper.paperId || ''),
    citedByCount: paper.citationCount ?? null,
    referenceCount: paper.referenceCount ?? null,
    raw: {
      references: (paper.references || []).slice(0, 12),
      citations: (paper.citations || []).slice(0, 12),
    },
  });
}

function mapOpenLibraryBook(book, isbn) {
  const authors = (book.authors || [])
    .map((a) => a.name || a.key || '')
    .filter(Boolean)
    .map(normalizeWhitespace);
  const year = normalizeWhitespace(book.publish_date || '').match(/\d{4}/)?.[0] || '';
  return baseMeta('Open Library', {
    type: 'book',
    title: normalizeWhitespace(book.title || ''),
    subtitle: normalizeWhitespace(book.subtitle || ''),
    authors,
    year,
    issued: normalizeWhitespace(book.publish_date || ''),
    publisher: normalizeWhitespace(first(book.publishers) || ''),
    place: normalizeWhitespace(first(book.publish_places) || ''),
    isbn,
    url: `https://openlibrary.org/isbn/${isbn}`,
    language: normalizeWhitespace(first(book.languages)?.key || ''),
    raw: { numberOfPages: book.number_of_pages || null },
  });
}

function mapOpenLibrarySearchDoc(doc) {
  const isbn = first(doc.isbn) || '';
  return baseMeta('Open Library', {
    type: 'book',
    title: normalizeWhitespace(doc.title || ''),
    authors: (doc.author_name || []).map(normalizeWhitespace).filter(Boolean),
    year: doc.first_publish_year ? String(doc.first_publish_year) : '',
    publisher: normalizeWhitespace(first(doc.publisher) || ''),
    place: normalizeWhitespace(first(doc.publish_place) || ''),
    isbn,
    url: doc.key ? `https://openlibrary.org${doc.key}` : isbn ? `https://openlibrary.org/isbn/${isbn}` : '',
    language: normalizeWhitespace(first(doc.language) || ''),
    raw: { editionCount: doc.edition_count || null },
  });
}

function mapGoogleBook(volume) {
  const info = volume.volumeInfo || {};
  const isbn = (info.industryIdentifiers || []).find((id) => /ISBN/.test(id.type))?.identifier || '';
  const published = normalizeWhitespace(info.publishedDate || '');
  return baseMeta('Google Books', {
    type: 'book',
    title: normalizeWhitespace(info.title || ''),
    subtitle: normalizeWhitespace(info.subtitle || ''),
    authors: (info.authors || []).map(normalizeWhitespace).filter(Boolean),
    year: published.match(/\d{4}/)?.[0] || '',
    issued: published,
    publisher: normalizeWhitespace(info.publisher || ''),
    isbn,
    url: normalizeWhitespace(info.infoLink || info.canonicalVolumeLink || ''),
    language: normalizeWhitespace(info.language || ''),
    raw: { categories: info.categories || [], pageCount: info.pageCount || null },
  });
}

function mapLibraryOfCongressBook(result) {
  const authors = [
    ...(result.contributor || []),
    ...(result.item?.contributors || []),
  ]
    .map((author) => typeof author === 'string' ? author : author?.title || author?.name || '')
    .map(normalizeWhitespace)
    .filter(Boolean);
  const createdPublished = normalizeWhitespace(first(result.item?.created_published) || '');
  const split = splitPlacePublisher(createdPublished || first(result.publisher) || '');
  const date = normalizeWhitespace(result.date || createdPublished || '');
  const publisher = normalizeWhitespace(split.publisher || first(result.publisher) || createdPublished || '');
  const isbn = normalizeWhitespace(first(result.isbn) || first(result.item?.isbn) || '');
  return baseMeta('Library of Congress', {
    type: 'book',
    title: normalizeWhitespace(result.title || result.item?.title || ''),
    authors,
    year: date.match(/\d{4}/)?.[0] || '',
    issued: date,
    publisher,
    place: normalizeWhitespace(first(result.location) || split.place || placeFromPublisher(publisher)),
    isbn,
    url: normalizeWhitespace(result.url || result.item?.url || ''),
    language: normalizeWhitespace(first(result.language) || ''),
    raw: { subjects: (result.subject || []).slice(0, 8), createdPublished },
  });
}

function mapDataCiteDoi(record) {
  const attrs = record.attributes || {};
  const doi = attrs.doi || record.id || '';
  const container = first(attrs.container?.title) || first(attrs.relatedItems)?.titles?.[0]?.title || '';
  const type = String(attrs.types?.resourceTypeGeneral || attrs.types?.citeproc || 'article').toLowerCase();
  return baseMeta('DataCite', {
    type: type.includes('dataset') ? 'report' : type.includes('book') ? 'book' : type.includes('chapter') ? 'chapter' : 'article',
    title: normalizeWhitespace(first(attrs.titles)?.title || ''),
    authors: (attrs.creators || []).map((creator) => normalizeWhitespace(creator.name || authorName(creator))).filter(Boolean),
    year: attrs.publicationYear ? String(attrs.publicationYear) : '',
    issued: attrs.dates?.find((date) => date.dateType === 'Issued')?.date || '',
    containerTitle: normalizeWhitespace(container),
    publisher: normalizeWhitespace(attrs.publisher || ''),
    doi: normalizeWhitespace(doi).toLowerCase(),
    url: normalizeWhitespace(attrs.url || (doi ? `https://doi.org/${doi}` : '')),
    language: normalizeWhitespace(attrs.language || ''),
    raw: { type: attrs.types, subjects: attrs.subjects?.slice(0, 8) || [] },
  });
}

function mapEuropePmcWork(work) {
  const doi = first(work.doi) || '';
  const pmid = work.pmid || '';
  return baseMeta('Europe PMC', {
    type: 'article',
    title: normalizeWhitespace(work.title || ''),
    authors: splitAuthorString(work.authorString || ''),
    year: normalizeWhitespace(work.pubYear || work.firstPublicationDate || '').match(/\d{4}/)?.[0] || '',
    issued: normalizeWhitespace(work.firstPublicationDate || ''),
    containerTitle: normalizeWhitespace(work.journalTitle || ''),
    volume: normalizeWhitespace(work.journalVolume || ''),
    issue: normalizeWhitespace(work.issue || ''),
    pages: normalizePages(work.pageInfo || ''),
    publisher: normalizeWhitespace(work.publisher || ''),
    doi: normalizeWhitespace(doi).toLowerCase(),
    url: normalizeWhitespace(work.fullTextUrlList?.fullTextUrl?.[0]?.url || (pmid ? `https://europepmc.org/article/MED/${pmid}` : '')),
    raw: { pmid, citedByCount: work.citedByCount || null },
  });
}

function mapPubMedSummary(work) {
  const doi = (work.articleids || []).find((id) => id.idtype === 'doi')?.value || '';
  return baseMeta('PubMed', {
    type: 'article',
    title: normalizeWhitespace(work.title || ''),
    authors: (work.authors || []).map((author) => normalizeWhitespace(author.name || '')).filter(Boolean),
    year: normalizeWhitespace(work.pubdate || '').match(/\d{4}/)?.[0] || '',
    issued: normalizeWhitespace(work.pubdate || ''),
    containerTitle: normalizeWhitespace(work.fulljournalname || work.source || ''),
    volume: normalizeWhitespace(work.volume || ''),
    issue: normalizeWhitespace(work.issue || ''),
    pages: normalizePages(work.pages || ''),
    doi: normalizeWhitespace(doi).toLowerCase(),
    url: work.uid ? `https://pubmed.ncbi.nlm.nih.gov/${work.uid}/` : '',
    raw: { pmid: work.uid || '' },
  });
}

function mapDoajArticle(record) {
  const bib = record.bibjson || {};
  const journal = bib.journal || {};
  const identifiers = bib.identifier || [];
  return baseMeta('DOAJ', {
    type: 'article',
    title: normalizeWhitespace(bib.title || ''),
    authors: (bib.author || []).map((author) => normalizeWhitespace(author.name || '')).filter(Boolean),
    year: String(bib.year || bib.month || '').match(/\d{4}/)?.[0] || String(bib.year || ''),
    containerTitle: normalizeWhitespace(journal.title || ''),
    volume: normalizeWhitespace(journal.volume || ''),
    issue: normalizeWhitespace(journal.number || ''),
    pages: normalizePages([bib.start_page, bib.end_page].filter(Boolean).join('-')),
    doi: normalizeWhitespace(identifiers.find((id) => String(id.type).toLowerCase() === 'doi')?.id || '').toLowerCase(),
    url: normalizeWhitespace(bib.link?.find((link) => link.url)?.url || ''),
    language: normalizeWhitespace(first(bib.language) || ''),
  });
}

function mapArxivEntry(entry) {
  const id = tagText(entry, 'id');
  const doi = tagText(entry, 'arxiv:doi') || tagText(entry, 'doi');
  const categories = [...entry.matchAll(/<category[^>]+term="([^"]+)"/g)].map((match) => match[1]);
  return baseMeta('arXiv', {
    type: 'preprint',
    title: normalizeWhitespace(tagText(entry, 'title')),
    authors: [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/g)]
      .map((match) => decodeXml(match[1]))
      .map(normalizeWhitespace)
      .filter(Boolean),
    year: tagText(entry, 'published').match(/\d{4}/)?.[0] || '',
    issued: tagText(entry, 'published').slice(0, 10),
    containerTitle: categories.length ? `arXiv:${categories[0]}` : 'arXiv',
    doi: normalizeWhitespace(doi).toLowerCase(),
    url: normalizeWhitespace(id),
    language: 'en',
    raw: { categories },
  });
}

function splitAuthorString(text) {
  return normalizeWhitespace(text)
    .replace(/\.$/, '')
    .split(/\s*,\s*|\s+;\s+/)
    .map(normalizeWhitespace)
    .filter(Boolean);
}

function tagText(xml, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function decodeXml(text = '') {
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function completeness(meta) {
  const fields = ['title', 'authors', 'year', 'containerTitle', 'volume', 'issue', 'pages', 'publisher', 'doi', 'url'];
  return fields.reduce((score, field) => {
    const value = meta[field];
    if (Array.isArray(value)) return score + (value.length ? 8 : 0);
    return score + (value ? 6 : 0);
  }, 0);
}

function fingerprint(meta) {
  if (meta.doi) return `doi:${meta.doi.toLowerCase()}`;
  const title = normalizeWhitespace(meta.title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const author = normalizeWhitespace(meta.authors?.[0] || '').toLowerCase();
  return `${title}:${meta.year}:${author}`.slice(0, 180);
}

async function readLibrary() {
  try {
    return JSON.parse(await readFile(libraryPath, 'utf8'));
  } catch {
    return { updatedAt: '', items: [] };
  }
}

function cleanLibraryItem(item) {
  const clean = { ...item };
  delete clean.raw;
  delete clean.candidates;
  return clean;
}

async function writeLibrary(library) {
  await mkdir(dataDir, { recursive: true });
  library.updatedAt = new Date().toISOString();
  await writeFile(libraryPath, `${JSON.stringify(library, null, 2)}\n`, 'utf8');
  await writePreparedFiles(library.items);
}

async function writePreparedFiles(items) {
  const payload = {
    updatedAt: new Date().toISOString(),
    count: items.length,
    items,
  };
  const markdown = [
    '# Prepared Bibliography',
    '',
    `Updated: ${payload.updatedAt}`,
    '',
    '## APA_Template_Reference',
    '',
    ...items.map((item, index) => `${index + 1}. ${item.citations?.apa || item.title || '[untitled]'}`),
    '',
    '## Chicago_Template_Reference',
    '',
    ...items.map((item, index) => `${index + 1}. ${item.citations?.chicago || item.title || '[untitled]'}`),
    '',
  ].join('\n');
  await writeFile(preparedJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(preparedMarkdownPath, markdown, 'utf8');
}

async function saveLibraryItem(item) {
  const library = await readLibrary();
  const clean = {
    ...cleanLibraryItem(item),
    savedAt: new Date().toISOString(),
  };
  const key = fingerprint(clean);
  const index = library.items.findIndex((existing) => fingerprint(existing) === key);
  if (index >= 0) {
    library.items[index] = { ...library.items[index], ...clean, savedAt: library.items[index].savedAt || clean.savedAt, updatedAt: clean.savedAt };
  } else {
    library.items.push(clean);
  }
  await writeLibrary(library);
  return librarySummary(library);
}

function librarySummary(library) {
  return {
    count: library.items.length,
    updatedAt: library.updatedAt,
    paths: {
      library: libraryPath,
      preparedJson: preparedJsonPath,
      preparedMarkdown: preparedMarkdownPath,
    },
    items: library.items,
  };
}

function relevanceScore(meta, query = '') {
  const rawQuery = toTraditional(normalizeWhitespace(query)).toLowerCase();
  if (!rawQuery) return 30;
  const conditionScore = scoreSearchConditions(meta, query);
  const compactQuery = rawQuery.replace(/[^\p{L}\p{N}]+/gu, '');
  const blob = [
    meta.title,
    meta.subtitle,
    meta.containerTitle,
    meta.publisher,
    meta.year,
    ...(meta.authors || []),
  ].join(' ');
  const traditionalBlob = toTraditional(blob).toLowerCase();
  const compactBlob = traditionalBlob.replace(/[^\p{L}\p{N}]+/gu, '');
  if (compactQuery && compactBlob.includes(compactQuery)) return Math.min(100, 88 + conditionScore);
  const tokens = rawQuery
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  if (!tokens.length) return 20;
  const matched = tokens.filter((token) => traditionalBlob.includes(token) || compactBlob.includes(token.replace(/[^\p{L}\p{N}]+/gu, '')));
  const ratio = matched.length / tokens.length;
  const authorBoost = matched.some((token) => toTraditional((meta.authors || []).join(' ')).toLowerCase().includes(token)) ? 12 : 0;
  const titleBoost = matched.some((token) => toTraditional(String(meta.title || '')).toLowerCase().includes(token)) ? 14 : 0;
  return Math.min(100, Math.round(ratio * 74 + authorBoost + titleBoost + conditionScore));
}

function scoreSearchConditions(item = {}, query = '') {
  const conditions = parseSearchConditions(query);
  if (!conditions.hasStructuredConditions) return 0;
  let score = 0;
  if (conditions.author && authorCandidateMatches(item, expandSearchQueries(conditions.author, { kind: 'author' }))) score += 18;
  if (conditions.years.length && item.year && conditions.years.includes(String(item.year))) score += 16;
  const sourceBlob = compactSearchText([item.containerTitle, item.publisher, item.source, item.title].filter(Boolean).join(' '));
  score += conditions.sourceTerms.filter((term) => sourceBlob.includes(compactSearchText(term))).length * 10;
  const titleBlob = compactSearchText(item.title || '');
  score += conditions.titleTerms.filter((term) => titleBlob.includes(compactSearchText(term))).length * 12;
  return Math.min(42, score);
}

function matchesSearchConditions(item = {}, query = '') {
  const conditions = parseSearchConditions(query);
  if (!conditions.hasStructuredConditions) return true;
  if (conditions.author && !authorCandidateMatches(item, expandSearchQueries(conditions.author, { kind: 'author' })) && !compactSearchText([item.title, item.containerTitle, item.publisher, ...(item.authors || [])].join(' ')).includes(compactSearchText(conditions.author))) return false;
  if (conditions.years.length && item.year && !conditions.years.includes(String(item.year))) return false;
  const sourceBlob = compactSearchText([item.containerTitle, item.publisher, item.source, item.title].filter(Boolean).join(' '));
  if (conditions.sourceTerms.length && conditions.sourceTerms.every((term) => !sourceBlob.includes(compactSearchText(term))) && (item.containerTitle || item.publisher)) return false;
  const titleBlob = compactSearchText(item.title || '');
  if (conditions.titleTerms.length && conditions.titleTerms.every((term) => !titleBlob.includes(compactSearchText(term))) && item.title) return false;
  return true;
}

function mergeDuplicates(candidates, query = '', variants = [], intent = 'query') {
  const seen = new Map();
  for (const candidate of expandWithLocalMetadataHints(candidates).filter((item) => item.title || item.doi || item.isbn).filter(isAllowedDefaultCandidate)) {
    const key = fingerprint(candidate);
    const current = seen.get(key);
    candidate.relevance = relevanceScore(candidate, query);
    if (authorCandidateMatches(candidate, variants)) candidate.relevance = 100;
    candidate.confidence = Math.min(
      99,
      Math.round((candidate.sourcePriority || 0) * 0.34 + completeness(candidate) * 0.22 + candidate.relevance * 0.44 + (intent === 'author' && candidate.relevance === 100 ? 12 : 0)),
    );
    if (!current || candidate.confidence > current.confidence) {
      const merged = current ? mergeMeta(candidate, current) : candidate;
      seen.set(key, { ...merged, corroboratedBy: current ? [...new Set([current.source, ...(current.corroboratedBy || [])].filter(Boolean))] : [] });
    } else {
      seen.set(key, mergeMeta(current, { ...candidate, corroboratedBy: [...(current.corroboratedBy || []), candidate.source].filter(Boolean) }));
    }
  }
  const merged = [...seen.values()];
  const hasAuthorMatch = intent === 'author' && merged.some((item) => authorCandidateMatches(item, variants));
  const hasRelevant = merged.some((item) => item.relevance >= 35);
  return merged
    .filter((item) => {
      if (!matchesSearchConditions(item, query)) return false;
      if (hasAuthorMatch) return authorCandidateMatches(item, variants);
      return !query || !hasRelevant || item.relevance >= (intent === 'author' ? 8 : 10);
    })
    .sort((a, b) => b.confidence - a.confidence);
}

function isAllowedDefaultCandidate(item = {}) {
  const type = String(item.type || '').toLowerCase();
  const title = normalizeWhitespace(item.title || '');
  const source = normalizeWhitespace(item.source || '');
  const container = normalizeWhitespace(item.containerTitle || '');
  if (/thesis|dissertation|學位|碩士|博士|碩論|博論/i.test([type, title, source, container].join(' '))) return false;
  if (looksLikeThesisCompositeTitle(title)) return false;
  if (!type) return true;
  return /article|journal|book|chapter|monograph|reference|edited_book|posted_content|web/.test(type);
}

function isDisplayableCandidate(item = {}, intent = 'query') {
  if (!item || !item.title) return false;
  const source = normalizeWhitespace(item.source || '');
  if (intent === 'author' && source === 'Manual') return false;
  const hasDirectTarget = Boolean(item.doi || item.url || item.openAlexId || item.semanticId || item.isbn);
  const hasBibliographicBody = Boolean(item.containerTitle || item.volume || item.issue || item.pages || item.publisher || item.place);
  const missing = missingFields(item);
  const mostlyEmpty = missing.length >= 4 && !hasDirectTarget && !hasBibliographicBody;
  return !mostlyEmpty;
}

function looksLikeThesisCompositeTitle(title = '') {
  const clean = normalizeWhitespace(title);
  if (!clean) return false;
  if (/^[一二三四五六七八九十]、.+[；;]\s*[一二三四五六七八九十]、/u.test(clean)) return true;
  if (/^I[.、]\s*.+[;；]\s*II[.、]/i.test(clean)) return true;
  if (clean.length > 80 && /[；;]/u.test(clean) && /研究|鑑定|普查|成分|分析/u.test(clean)) return true;
  return false;
}

function conflictReport(candidates) {
  const fields = ['title', 'year', 'containerTitle', 'volume', 'issue', 'pages', 'publisher'];
  return fields
    .map((field) => {
      const values = new Map();
      for (const item of candidates) {
        const value = normalizeWhitespace(item[field] || '');
        if (value) values.set(value.toLowerCase(), { value, sources: [...(values.get(value.toLowerCase())?.sources || []), item.source] });
      }
      const unique = [...values.values()];
      return unique.length > 1 ? { field, values: unique } : null;
    })
    .filter(Boolean);
}

function missingFields(meta) {
  const fieldsByType = {
    article: ['authors', 'year', 'title', 'containerTitle', 'volume', 'issue', 'pages'],
    book: ['authors', 'year', 'title', 'publisher', 'place'],
    chapter: ['authors', 'year', 'title', 'containerTitle', 'pages', 'publisher'],
    thesis: ['authors', 'year', 'title', 'publisher'],
    conference: ['authors', 'year', 'title', 'containerTitle', 'place'],
  };
  const required = fieldsByType[meta.type] || fieldsByType.article;
  return required.filter((field) => {
    const value = meta[field];
    return Array.isArray(value) ? value.length === 0 : !value;
  });
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 4500);
  const headers = {
    'user-agent': `ResearchMaster/1.0 (mailto:${process.env.CROSSREF_MAILTO || 'local@example.invalid'})`,
    accept: 'application/json',
    ...(options.headers || {}),
  };
  if (/api\.semanticscholar\.org/i.test(String(url)) && process.env.SEMANTIC_SCHOLAR_API_KEY) {
    headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
  }
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 4500);
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'ResearchMaster/1.0 (mailto:local@example.invalid)',
        accept: 'application/xml,text/xml,text/plain,*/*',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSourceUrlMetadata(url, item = {}) {
  const hints = localMetadataHints({ ...item, url });
  let html = '';
  let parsed = null;
  try {
    html = await fetchText(url, {
      timeout: 6500,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml,text/plain,*/*',
        'user-agent': 'Mozilla/5.0 ResearchMaster/1.0 metadata checker',
      },
    });
    parsed = metadataFromHtml(html, url, item);
  } catch {
    // Some academic platforms block direct HTML reads but still expose content to browser readers.
  }
  const mergedForMissingCheck = parsed ? mergeMeta(item, parsed) : item;
  const stillMissingCore = missingFields(mergedForMissingCheck).some((field) => ['title', 'authors', 'year', 'containerTitle', 'volume', 'issue', 'pages', 'doi', 'publisher', 'place'].includes(field));
  let readerParsed = null;
  if (stillMissingCore) {
    const readerText = await fetchReaderText(url).catch(() => '');
    if (readerText) readerParsed = metadataFromReaderText(readerText, url, item);
  }
  return [...hints, ...(parsed ? [parsed] : []), ...(readerParsed ? [readerParsed] : [])];
}

async function fetchReaderText(url) {
  if (!/^https?:\/\//i.test(url)) return '';
  const readerUrl = `https://r.jina.ai/${url}`;
  return fetchText(readerUrl, {
    timeout: 9000,
    headers: {
      accept: 'text/plain,*/*',
      'user-agent': 'ResearchMaster/1.0 metadata reader',
    },
  });
}

function metadataFromHtml(html = '', url = '', item = {}) {
  const metas = extractHtmlMetadata(html);
  const title = firstMeta(metas, ['citation_title', 'dc.title', 'dcterms.title', 'og:title']) || cleanHtmlText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const authors = allMeta(metas, ['citation_author', 'dc.creator', 'dcterms.creator']).flatMap((value) => value.split(/[;；、]/)).map(normalizeWhitespace).filter(Boolean);
  const date = firstMeta(metas, ['citation_publication_date', 'citation_date', 'dc.date', 'dcterms.issued', 'article:published_time']);
  const pages = firstMeta(metas, ['citation_pages']) || [firstMeta(metas, ['citation_firstpage']), firstMeta(metas, ['citation_lastpage'])].filter(Boolean).join('-');
  const text = cleanHtmlText(html);
  const fallbackJournal = text.match(/(?:期刊名稱|刊名|來源期刊|Journal|Source)\s*[:：]\s*([^<\n\r]{2,80})/i)?.[1] || '';
  const fallbackVolume = text.match(/(?:第?\s*|Volume\s*)?(\d{1,4})\s*(?:卷|Volume|Vol\.)/i)?.[1] || '';
  const fallbackIssue = text.match(/(?:第?\s*|Issue\s*|No\.\s*)?(\d{1,4})\s*(?:期|Issue|No\.)/i)?.[1] || '';
  const fallbackPages = text.match(/(?:頁碼|頁數|Pages?|pp\.?)\s*[:：]?\s*(\d+\s*[-–—]\s*\d+)/i)?.[1] || '';
  const meta = baseMeta(url.includes('lawdata') ? 'LawData 頁面補全' : url.includes('airiti') ? 'Airiti 頁面補全' : '來源頁面補全', {
    type: item.type || 'article',
    title: normalizeWhitespace(title || item.title || ''),
    authors: authors.length ? authors : item.authors || [],
    year: normalizeWhitespace(date).match(/\b(18|19|20)\d{2}\b/)?.[0] || item.year || '',
    issued: normalizeWhitespace(date || item.issued || ''),
    containerTitle: normalizeWhitespace(firstMeta(metas, ['citation_journal_title', 'citation_conference_title', 'dc.source', 'dcterms.source']) || fallbackJournal || ''),
    volume: normalizeWhitespace(firstMeta(metas, ['citation_volume']) || fallbackVolume || ''),
    issue: normalizeWhitespace(firstMeta(metas, ['citation_issue']) || fallbackIssue || ''),
    pages: normalizePages(pages || fallbackPages || ''),
    publisher: normalizeWhitespace(firstMeta(metas, ['citation_publisher', 'dc.publisher']) || item.publisher || ''),
    doi: normalizeWhitespace(firstMeta(metas, ['citation_doi', 'dc.identifier']) || item.doi || '').replace(/^doi:/i, '').toLowerCase(),
    url,
    language: item.language || 'zh-TW',
    raw: { note: '由來源頁 HTML meta 標籤與頁面文字線索解析。' },
  });
  return meta.title || meta.containerTitle || meta.volume || meta.issue || meta.pages ? meta : null;
}

function metadataFromReaderText(text = '', url = '', item = {}) {
  const clean = toTraditional(normalizeWhitespace(text));
  const lines = text
    .split(/\r?\n/)
    .map((line) => toTraditional(stripMarkdown(line)))
    .map(normalizeWhitespace)
    .filter(Boolean);
  const titleLine = lines.find((line) => line.startsWith('# ')) || lines.find((line) => line.length >= 6 && !/^Title:|URL Source:|Markdown Content:/i.test(line)) || '';
  const rawTitle = titleLine
    .replace(/^#+\s*/, '')
    .replace(/\s*[=＝]\s*.+?(?:｜Airiti|華藝線上圖書館).*$/u, '')
    .replace(/\s*｜Airiti.*$/u, '');
  const authorLine = lines.find((line) => line.includes('(') && !line.includes('Volume') && !line.includes('Issue') && !line.includes('Pp.') && authorLooksRelevant(line, item));
  const pubLine = lines.find((line) => /《[^》]+》/.test(line) && /(\d{4}\/\d{1,2}|Volume|Issue|卷|期|Pp?\.?|頁)/i.test(line)) || '';
  const doi = clean.match(/(?:https?:\/\/doi\.org\/)?(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i)?.[1] || '';
  const pub = parseReaderPublicationLine(pubLine);
  const authors = authorLine ? parseReaderAuthors(authorLine) : [];
  const source = /airiti|華藝/i.test(url) ? 'Airiti Reader 補全' : '來源頁 Reader 補全';
  const meta = baseMeta(source, {
    type: item.type || 'article',
    title: normalizeWhitespace(rawTitle || item.title || ''),
    authors: authors.length ? authors : item.authors || [],
    year: pub.year || item.year || '',
    issued: pub.issued || item.issued || '',
    containerTitle: pub.containerTitle || item.containerTitle || '',
    volume: pub.volume || item.volume || '',
    issue: pub.issue || item.issue || '',
    pages: pub.pages || item.pages || '',
    publisher: item.publisher || '',
    place: item.place || '',
    doi: normalizeWhitespace(doi || item.doi || '').toLowerCase(),
    url,
    language: item.language || 'zh-TW',
    raw: { note: '由 Jina Reader 將來源頁轉成文字後解析；用於補直接 HTML 抓不到的欄位。' },
  });
  return meta.title || meta.containerTitle || meta.volume || meta.issue || meta.pages || meta.doi ? meta : null;
}

function stripMarkdown(value = '') {
  return String(value)
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[_*`~]/g, '')
    .replace(/^\s*[-*]\s+/, '');
}

function authorLooksRelevant(line = '', item = {}) {
  const expected = (item.authors || []).map(compactSearchText).filter(Boolean);
  if (!expected.length) return /[\u3400-\u9fff]{2,5}\s*(?:\([^)]+\))?/u.test(line);
  const key = compactSearchText(line);
  return expected.some((author) => key.includes(author) || author.includes(key.slice(0, author.length)));
}

function parseReaderAuthors(line = '') {
  return normalizeWhitespace(line)
    .replace(/^#+\s*/, '')
    .split(/[；;、]/)
    .map((part) => normalizeWhitespace(part.replace(/\([^)]*\)/g, '')))
    .filter((part) => part && !/javascript|login|logout|download|cite|share|save/i.test(part))
    .slice(0, 12);
}

function parseReaderPublicationLine(line = '') {
  const text = normalizeWhitespace(line);
  const containerTitle = text.match(/《([^》]+)》/)?.[1] || '';
  const volume = text.match(/(?:Volume|Vol\.?)\s*([A-Za-z0-9-]+)/i)?.[1]
    || text.match(/》\s*([A-Za-z0-9-]+)\s*卷/u)?.[1]
    || text.match(/(\d{1,4})\s*卷/u)?.[1]
    || '';
  const issue = text.match(/(?:Issue|No\.?)\s*([A-Za-z0-9-]+)/i)?.[1]
    || text.match(/([A-Za-z0-9-]+)\s*期/u)?.[1]
    || '';
  const issued = text.match(/\((\d{4}\/\d{1,2}(?:\/\d{1,2})?)\)/)?.[1] || '';
  const year = issued.match(/\d{4}/)?.[0] || '';
  const pages = normalizePages(text.match(/(?:Pp?\.?|Pages?|頁碼|頁數)\s*[:：]?\s*([0-9]+\s*[-–—]\s*[0-9]+)/i)?.[1] || '');
  return { containerTitle, volume, issue, issued, year, pages };
}

function extractHtmlMetadata(html = '') {
  const metas = {};
  const pattern = /<meta\b([^>]+)>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const attrs = {};
    for (const attr of match[1].matchAll(/([a-zA-Z_:.-]+)\s*=\s*["']([^"']*)["']/g)) {
      attrs[attr[1].toLowerCase()] = decodeHtml(attr[2]);
    }
    const key = (attrs.name || attrs.property || attrs.itemprop || '').toLowerCase();
    const content = normalizeWhitespace(attrs.content || '');
    if (key && content) {
      if (!metas[key]) metas[key] = [];
      metas[key].push(content);
    }
  }
  return metas;
}

function firstMeta(metas, keys) {
  for (const key of keys) {
    const value = metas[String(key).toLowerCase()]?.find(Boolean);
    if (value) return value;
  }
  return '';
}

function allMeta(metas, keys) {
  return keys.flatMap((key) => metas[String(key).toLowerCase()] || []);
}

function cleanHtmlText(value = '') {
  return decodeHtml(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

async function discover(input, scope = 'article') {
  const inferred = inferKind(input);
  const q = inferred.value;
  inferred.conditions = parseSearchConditions(q);
  const variants = conditionSearchQueries(q, inferred);
  inferred.variants = variants;
  const authorVariantLimit = inferred.conditions?.hasStructuredConditions ? 5 : 10;
  const primaryVariants = variants.slice(0, inferred.kind === 'author' ? authorVariantLimit : 3);
  const jobs = [];
  const addJobs = (...tasks) => {
    jobs.push(...tasks.map((task) => Promise.resolve().then(task).catch(() => [])));
  };

  if (inferred.kind === 'doi') {
    addJobs(() => fetchCrossrefDoi(q), () => fetchOpenAlexDoi(q), () => fetchSemanticDoi(q), () => fetchDataCiteDoi(q));
  } else if (inferred.kind === 'isbn') {
    addJobs(() => fetchOpenLibraryIsbn(q), () => fetchGoogleBooksQuery(q), () => fetchOpenLibraryQuery(q), () => fetchCrossrefQuery(q), () => fetchOpenAlexQuery(q));
  } else if (inferred.kind === 'url') {
    const doi = extractDoi(q);
    if (doi) addJobs(() => fetchCrossrefDoi(doi), () => fetchOpenAlexDoi(doi), () => fetchSemanticDoi(doi), () => fetchDataCiteDoi(doi));
    addJobs(() => Promise.resolve([baseMeta('URL', { type: 'web', title: q, url: q })]));
  } else {
    for (const [index, variant] of primaryVariants.entries()) {
      const common = [
        () => fetchOpenAlexQuery(variant),
        () => fetchCrossrefQuery(variant),
        () => fetchSemanticQuery(variant),
        () => fetchDataCiteQuery(variant),
        () => fetchEuropePmcQuery(variant),
        () => fetchPubMedQuery(variant),
        () => fetchDoajQuery(variant),
        () => fetchArxivQuery(variant),
      ];
        const authorJobs = [
          () => fetchOpenAlexAuthorQuery(variant),
          () => fetchCrossrefAuthorQuery(variant),
          () => fetchSemanticAuthorQuery(variant),
          () => fetchGoogleBooksAuthorQuery(variant),
        ];
      const bookJobs = index < 2 ? [() => fetchGoogleBooksQuery(variant), () => fetchOpenLibraryQuery(variant), () => fetchLibraryOfCongressQuery(variant)] : [];
      const scopedCommon = scope === 'book' ? common.filter((_, commonIndex) => commonIndex <= 1) : common;
      const conditionJobs = index === 0 && inferred.conditions?.hasStructuredConditions
        ? [() => fetchCrossrefConditionQuery(inferred.conditions, scope), () => fetchOpenAlexQuery(variant), () => fetchCrossrefQuery(variant)]
        : [];
      const scopedBookJobs = scope === 'article' ? [] : bookJobs;
      const scopedAuthorJobs = scope === 'book' ? authorJobs.slice(3) : scope === 'article' ? authorJobs.slice(0, 3) : authorJobs;
      addJobs(...(inferred.kind === 'author' ? [...conditionJobs, ...scopedAuthorJobs, ...scopedCommon, ...scopedBookJobs] : [...conditionJobs, ...scopedCommon, ...scopedAuthorJobs.slice(0, 1), ...scopedBookJobs]));
    }
  }

  const settled = await Promise.allSettled(jobs);
  const manualSeedAllowed = inferred.kind !== 'author';
  const seed = baseMeta('Manual', {
    type: scope === 'book' ? 'book' : 'article',
    title: manualSeedAllowed ? toTraditional(q) : '',
    authors: inferred.kind === 'author' ? [toTraditional(inferred.conditions?.author || q)] : [],
    year: inferred.conditions?.years?.[0] || '',
    sourceInput: q,
    confidence: 30,
  });
  const candidates = [...(manualSeedAllowed ? [seed] : []), ...settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))];
  const merged = mergeDuplicates(candidates, q, variants, inferred.kind)
    .filter((item) => sourceScopeMatches(item, scope))
    .filter((item) => isDisplayableCandidate(item, inferred.kind));
  const top = merged[0];
  const best = top && (!['query', 'author', 'title'].includes(inferred.kind) || top.relevance >= (inferred.kind === 'author' ? 18 : 10))
    ? top
    : baseMeta('Manual', {
      type: scope === 'book' ? 'book' : 'article',
      title: manualSeedAllowed ? toTraditional(q) : '',
      authors: inferred.kind === 'author' ? [toTraditional(inferred.conditions?.author || q)] : [],
      year: inferred.conditions?.years?.[0] || '',
      sourceInput: q,
      confidence: 30,
      raw: { note: 'No strong database match.' },
    });
  const comparable = candidates.filter((candidate) => fingerprint(candidate) === fingerprint(best));
  const routes = buildVerificationRoutes(q, best, variants);
  return {
    input,
    inferred,
    searchScope: scope,
    best,
    candidates: merged,
    conflicts: conflictReport(comparable),
    missing: missingFields(best),
    routes,
  };
}

async function enrichMetadata(item = {}, initialPayload = {}) {
  const searchTitle = normalizeWhitespace(item.title || initialPayload.best?.title || item.sourceInput || initialPayload.input || '');
  const searchAuthor = normalizeWhitespace(item.authors?.[0] || initialPayload.best?.authors?.[0] || '');
  const searchYear = normalizeWhitespace(item.year || initialPayload.best?.year || '');
  const conditions = parseSearchConditions(initialPayload.input || item.sourceInput || [searchTitle, searchAuthor, searchYear].filter(Boolean).join(' '));
  const exactQuery = [searchTitle, searchAuthor, searchYear].filter(Boolean).join(' ');
  const variants = conditionSearchQueries(searchTitle || exactQuery, { kind: 'title', conditions });
  const queries = fieldTargetedQueries(item, conditions);
  const tasks = [];
  const addTasks = (...nextTasks) => tasks.push(...nextTasks.map((task) => Promise.resolve().then(task).catch(() => [])));

  if (item.url) addTasks(() => fetchSourceUrlMetadata(item.url, item));
  if (conditions.hasStructuredConditions) addTasks(() => fetchCrossrefConditionQuery(conditions, initialPayload.searchScope || item.searchScope || 'article'));
  if (item.doi) addTasks(() => fetchCrossrefDoi(item.doi), () => fetchOpenAlexDoi(item.doi), () => fetchSemanticDoi(item.doi), () => fetchDataCiteDoi(item.doi));
  if (exactQuery) {
    addTasks(
      () => fetchCrossrefQuery(exactQuery),
      () => fetchOpenAlexQuery(exactQuery),
      () => fetchSemanticQuery(exactQuery),
      () => fetchDataCiteQuery(exactQuery),
      () => fetchDoajQuery(exactQuery),
    );
  }
  if (searchTitle && exactQuery !== searchTitle) addTasks(() => fetchCrossrefQuery(searchTitle), () => fetchOpenAlexQuery(searchTitle), () => fetchSemanticQuery(searchTitle));
  queries.forEach((query) => addTasks(() => fetchCrossrefQuery(query), () => fetchOpenAlexQuery(query), () => fetchSemanticQuery(query), () => fetchDoajQuery(query)));
  if (item.type === 'book' || item.isbn || missingFields(item).includes('place')) {
    if (item.isbn) addTasks(() => fetchOpenLibraryIsbn(item.isbn));
    const bookQueries = [...new Set([exactQuery, searchTitle, ...queries].map(normalizeWhitespace).filter(Boolean))].slice(0, 6);
    bookQueries.forEach((query) => addTasks(() => fetchGoogleBooksQuery(query), () => fetchOpenLibraryQuery(query), () => fetchLibraryOfCongressQuery(query)));
  }

  const settled = await Promise.allSettled(tasks);
  const remote = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  const evidence = expandWithLocalMetadataHints([...(initialPayload.candidates || []), item, ...remote])
    .filter((candidate) => candidate && (candidate.title || candidate.doi || candidate.isbn))
    .filter(isAllowedDefaultCandidate)
    .filter((candidate) => candidate.localEvidence || sameWorkScore(item, candidate) >= 38 || matchesSearchConditions(candidate, conditions.raw));
  const ranked = mergeDuplicates(evidence, searchTitle || exactQuery || conditions.raw, variants, 'title');
  const completed = ranked.slice(0, 14).reduce((merged, candidate) => mergeMeta(merged, candidate), item);
  completed.corroboratedBy = [...new Set([...(completed.corroboratedBy || []), ...ranked.map((candidate) => candidate.source)].filter(Boolean))];
  completed.conflicts = conflictReport(evidence);
  completed.missing = missingFields(completed);
  completed.candidates = mergeDuplicates(evidence, searchTitle || exactQuery || conditions.raw, variants, 'title');
  completed.enrichedAt = new Date().toISOString();
  completed.serverEnriched = true;
  return completed;
}

function fieldTargetedQueries(item = {}, conditions = parseSearchConditions('')) {
  const missing = missingFields(item);
  if (!missing.length) return [];
  const title = item.title || conditions.titleTerms.join(' ');
  const author = item.authors?.[0] || conditions.author || '';
  const year = item.year || conditions.years[0] || '';
  const source = item.containerTitle || conditions.sourceTerms.join(' ');
  const core = [title, author, year].filter(Boolean).join(' ');
  const sourceCore = [title, author, year, source].filter(Boolean).join(' ');
  const queries = [sourceCore, core, [author, year, source].filter(Boolean).join(' ')];
  if (missing.some((field) => ['containerTitle', 'volume', 'issue', 'pages'].includes(field))) {
    queries.push(
      [title, author, '卷', '期', '頁'].filter(Boolean).join(' '),
      [title, author, year, '刊名', '卷期', '頁碼'].filter(Boolean).join(' '),
      [title, author, year, '期刊名稱'].filter(Boolean).join(' '),
      [title, author, 'Airiti'].filter(Boolean).join(' '),
      [title, author, '華藝'].filter(Boolean).join(' '),
      [title, author, 'LawData'].filter(Boolean).join(' '),
      [title, author, 'DOI'].filter(Boolean).join(' '),
    );
  }
  if (missing.includes('place')) {
    queries.push(
      [title, author, item.publisher, '出版地'].filter(Boolean).join(' '),
      [title, author, item.publisher, '出版項'].filter(Boolean).join(' '),
      [title, author, item.publisher, '出版資訊'].filter(Boolean).join(' '),
      [title, item.isbn, 'publisher place'].filter(Boolean).join(' '),
    );
  }
  return [...new Set(queries.map(normalizeWhitespace).filter((query) => query.length >= 3))].slice(0, 8);
}

function sameWorkScore(base = {}, candidate = {}) {
  if (base.doi && candidate.doi && compactSearchText(base.doi) === compactSearchText(candidate.doi)) return 100;
  const baseTitle = compactSearchText(base.title || base.sourceInput || '');
  const candidateTitle = compactSearchText(candidate.title || '');
  if (!baseTitle || !candidateTitle) return 0;
  let score = 0;
  if (baseTitle === candidateTitle) score += 70;
  else if (baseTitle.includes(candidateTitle) || candidateTitle.includes(baseTitle)) score += 52;
  else {
    const tokens = [...new Set(baseTitle.match(/[\p{L}\p{N}]{2,}/gu) || [])];
    const matched = tokens.filter((token) => candidateTitle.includes(token)).length;
    score += tokens.length ? Math.round((matched / tokens.length) * 50) : 0;
  }
  if (base.year && candidate.year && String(base.year) === String(candidate.year)) score += 12;
  if (hasAuthorOverlap(base, candidate)) score += 14;
  if (base.containerTitle && candidate.containerTitle && compactSearchText(base.containerTitle) === compactSearchText(candidate.containerTitle)) score += 10;
  return Math.min(100, score);
}

async function fetchCrossrefDoi(doi) {
  const data = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  return data.message ? [mapCrossrefWork(data.message)] : [];
}

async function fetchCrossrefQuery(query) {
  const url = new URL('https://api.crossref.org/works');
  url.searchParams.set('query.bibliographic', query);
  url.searchParams.set('rows', '25');
  url.searchParams.set('select', 'DOI,title,subtitle,author,published,published-print,published-online,issued,container-title,volume,issue,page,publisher,type,language,URL,ISBN,reference,reference-count,score');
  const data = await fetchJson(url);
  return (data.message?.items || []).map(mapCrossrefWork);
}

async function fetchCrossrefAuthorQuery(query) {
  const url = new URL('https://api.crossref.org/works');
  url.searchParams.set('query.author', query);
  url.searchParams.set('rows', '35');
  url.searchParams.set('select', 'DOI,title,subtitle,author,published,published-print,published-online,issued,container-title,volume,issue,page,publisher,type,language,URL,ISBN,reference,reference-count,score');
  const data = await fetchJson(url);
  return (data.message?.items || []).map(mapCrossrefWork);
}

async function fetchCrossrefConditionQuery(conditions = parseSearchConditions(''), scope = 'article') {
  if (!conditions.hasStructuredConditions) return [];
  const url = new URL('https://api.crossref.org/works');
  const bibliography = [
    conditions.author,
    ...conditions.titleTerms,
    ...conditions.sourceTerms,
  ].filter(Boolean).join(' ') || conditions.raw;
  if (bibliography) url.searchParams.set('query.bibliographic', bibliography);
  if (conditions.author) url.searchParams.set('query.author', conditions.author);
  if (conditions.titleTerms.length) url.searchParams.set('query.title', conditions.titleTerms.join(' '));
  if (conditions.sourceTerms.length) url.searchParams.set('query.container-title', conditions.sourceTerms.join(' '));
  const filters = [];
  if (scope === 'article') filters.push('type:journal-article');
  if (scope === 'book') filters.push('type:book');
  const year = conditions.years[0];
  if (year) filters.push(`from-pub-date:${year}-01-01`, `until-pub-date:${year}-12-31`);
  if (filters.length) url.searchParams.set('filter', filters.join(','));
  url.searchParams.set('rows', '50');
  url.searchParams.set('select', 'DOI,title,subtitle,author,published,published-print,published-online,issued,container-title,volume,issue,page,publisher,type,language,URL,ISBN,reference,reference-count,score');
  const data = await fetchJson(url);
  return (data.message?.items || []).map(mapCrossrefWork);
}

async function fetchOpenAlexDoi(doi) {
  const data = await fetchJson(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`);
  return data?.id ? [mapOpenAlexWork(data)] : [];
}

async function fetchOpenAlexQuery(query) {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', query);
  url.searchParams.set('per-page', '25');
  const data = await fetchJson(url);
  return (data.results || []).map(mapOpenAlexWork);
}

async function fetchOpenAlexAuthorQuery(query) {
  const authorsUrl = new URL('https://api.openalex.org/authors');
  authorsUrl.searchParams.set('search', query);
  authorsUrl.searchParams.set('per-page', '5');
  const authors = await fetchJson(authorsUrl);
  const authorIds = (authors.results || [])
    .filter((author) => relevanceScore({ authors: [author.display_name || ''] }, query) >= 35)
    .slice(0, 4)
    .map((author) => String(author.id || '').split('/').pop())
    .filter(Boolean);
  const workJobs = authorIds.map(async (authorId) => {
    const byCites = new URL('https://api.openalex.org/works');
    byCites.searchParams.set('filter', `author.id:${authorId}`);
    byCites.searchParams.set('sort', 'cited_by_count:desc');
    byCites.searchParams.set('per-page', '35');
    const byDate = new URL('https://api.openalex.org/works');
    byDate.searchParams.set('filter', `author.id:${authorId}`);
    byDate.searchParams.set('sort', 'publication_date:desc');
    byDate.searchParams.set('per-page', '50');
    const [citedWorks, newestWorks] = await Promise.all([
      fetchJson(byCites).catch(() => ({ results: [] })),
      fetchJson(byDate).catch(() => ({ results: [] })),
    ]);
    return [...(citedWorks.results || []), ...(newestWorks.results || [])].map(mapOpenAlexWork);
  });
  return (await Promise.all(workJobs)).flat();
}

async function fetchSemanticDoi(doi) {
  const fields = 'paperId,title,authors,year,venue,journal,publicationDate,publicationTypes,externalIds,url,citationCount,referenceCount,references.title,references.authors,references.year,references.externalIds,citations.title,citations.authors,citations.year,citations.externalIds';
  const data = await fetchJson(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=${fields}`);
  return data?.title ? [mapSemanticPaper(data)] : [];
}

async function fetchSemanticQuery(query) {
  const url = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', '20');
  url.searchParams.set('fields', 'paperId,title,authors,year,venue,journal,publicationDate,publicationTypes,externalIds,url,citationCount,referenceCount');
  const data = await fetchJson(url);
  return (data.data || []).map(mapSemanticPaper);
}

async function fetchSemanticAuthorQuery(query) {
  const url = new URL('https://api.semanticscholar.org/graph/v1/author/search');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', '5');
  url.searchParams.set('fields', 'name,paperCount,papers.paperId,papers.title,papers.authors,papers.year,papers.venue,papers.externalIds,papers.url');
  const data = await fetchJson(url);
  return (data.data || [])
    .filter((author) => relevanceScore({ authors: [author.name || ''] }, query) >= 35)
    .slice(0, 4)
    .flatMap((author) => (author.papers || []).slice(0, 40).map((paper) => mapSemanticPaper({
      ...paper,
      publicationTypes: ['article'],
      citationCount: null,
      referenceCount: null,
      journal: { name: paper.venue || '' },
    })));
}

async function fetchDataCiteDoi(doi) {
  const data = await fetchJson(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`);
  return data.data ? [mapDataCiteDoi(data.data)] : [];
}

async function fetchDataCiteQuery(query) {
  const url = new URL('https://api.datacite.org/dois');
  url.searchParams.set('query', query);
  url.searchParams.set('page[size]', '5');
  const data = await fetchJson(url);
  return (data.data || []).map(mapDataCiteDoi);
}

async function fetchEuropePmcQuery(query) {
  const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  url.searchParams.set('query', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('pageSize', '5');
  const data = await fetchJson(url);
  return (data.resultList?.result || []).map(mapEuropePmcWork);
}

async function fetchPubMedQuery(query) {
  const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
  searchUrl.searchParams.set('db', 'pubmed');
  searchUrl.searchParams.set('term', query);
  searchUrl.searchParams.set('retmode', 'json');
  searchUrl.searchParams.set('retmax', '8');
  const search = await fetchJson(searchUrl);
  const ids = search.esearchresult?.idlist || [];
  if (!ids.length) return [];
  const summaryUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
  summaryUrl.searchParams.set('db', 'pubmed');
  summaryUrl.searchParams.set('id', ids.join(','));
  summaryUrl.searchParams.set('retmode', 'json');
  const summary = await fetchJson(summaryUrl);
  return ids.map((id) => summary.result?.[id]).filter(Boolean).map(mapPubMedSummary);
}

async function fetchDoajQuery(query) {
  const url = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?page=1&pageSize=8`;
  const data = await fetchJson(url);
  return (data.results || []).map(mapDoajArticle);
}

async function fetchArxivQuery(query) {
  const url = new URL('https://export.arxiv.org/api/query');
  url.searchParams.set('search_query', `all:${query}`);
  url.searchParams.set('start', '0');
  url.searchParams.set('max_results', '5');
  const xml = await fetchText(url);
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => mapArxivEntry(match[1]));
}

async function fetchOpenLibraryIsbn(isbn) {
  const data = await fetchJson(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
  return data?.title ? [mapOpenLibraryBook(data, isbn)] : [];
}

async function fetchGoogleBooksQuery(query) {
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', '8');
  const data = await fetchJson(url);
  return (data.items || []).map(mapGoogleBook);
}

async function fetchGoogleBooksAuthorQuery(query) {
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', `inauthor:${query}`);
  url.searchParams.set('maxResults', '20');
  const data = await fetchJson(url);
  return (data.items || []).map(mapGoogleBook);
}

async function fetchOpenLibraryQuery(query) {
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '8');
  const data = await fetchJson(url);
  return (data.docs || []).map(mapOpenLibrarySearchDoc);
}

async function fetchLibraryOfCongressQuery(query) {
  const url = new URL('https://www.loc.gov/books/');
  url.searchParams.set('fo', 'json');
  url.searchParams.set('q', query);
  url.searchParams.set('c', '8');
  const data = await fetchJson(url);
  return (data.results || []).map(mapLibraryOfCongressBook);
}

function buildVerificationRoutes(query, meta, variants = []) {
  const title = meta.title || query;
  const routeTerms = [...new Set([
    [title, meta.authors?.[0], meta.year].filter(Boolean).join(' '),
    ...variants,
  ].map((term) => toTraditional(normalizeWhitespace(term))).filter(Boolean))];
  const scholarly = encodeURIComponent(routeTerms[0] || query);
  const broad = encodeURIComponent(routeTerms.slice(0, 4).join(' OR ') || routeTerms[0] || query);
  const doi = meta.doi || extractDoi(query);
  return [
    { name: 'Airiti Library', priority: 'high', url: `https://www.google.com/search?q=site%3Aairitilibrary.com+${broad}`, note: '繁體中文與臺灣期刊優先人工核對路徑' },
    { name: 'Google Scholar', priority: 'high', url: `https://scholar.google.com/scholar?q=${broad}`, note: '作者、篇名與來源頁面查核' },
    { name: 'Crossref', priority: 'live', url: doi ? `https://search.crossref.org/?q=${encodeURIComponent(doi)}` : `https://search.crossref.org/?q=${scholarly}`, note: 'DOI 與出版資料核對' },
    { name: 'OpenAlex', priority: 'live', url: `https://openalex.org/search?filter=works.default.search:${scholarly}`, note: '被引用與參考文獻擴展' },
    { name: 'Semantic Scholar', priority: 'live', url: `https://www.semanticscholar.org/search?q=${scholarly}&sort=relevance`, note: '英文題名、作者與期刊欄位補查' },
    { name: 'DataCite', priority: 'live', url: `https://commons.datacite.org/?query=${scholarly}`, note: '資料集、報告、預印本與冷門 DOI 補充' },
    { name: 'Europe PMC', priority: 'oa', url: `https://europepmc.org/search?query=${scholarly}`, note: '生命科學、醫學與開放文獻補充' },
    { name: 'arXiv', priority: 'oa', url: `https://arxiv.org/search/?query=${scholarly}&searchtype=all`, note: '預印本與冷門作者補充搜尋' },
    { name: 'JSTOR', priority: 'database', url: `https://www.jstor.org/action/doBasicSearch?Query=${scholarly}`, note: '人文社會科學期刊與專書章節導向' },
    { name: 'Project MUSE', priority: 'database', url: `https://muse.jhu.edu/search?action=search&query=${scholarly}`, note: '人文社會科學出版品導向' },
    { name: 'ERIC', priority: 'database', url: `https://eric.ed.gov/?q=${scholarly}`, note: '教育學文獻資料庫導向' },
    { name: 'PubMed', priority: 'database', url: `https://pubmed.ncbi.nlm.nih.gov/?term=${scholarly}`, note: '醫學與生命科學資料庫導向' },
    { name: 'CNKI', priority: 'database', url: `https://www.google.com/search?q=site%3Acnki.net+${broad}`, note: '中國大陸期刊與專書資料導向' },
    { name: '萬方數據', priority: 'database', url: `https://www.google.com/search?q=site%3Awanfangdata.com.cn+${broad}`, note: '中國大陸期刊資料導向' },
    { name: 'WorldCat', priority: 'book', url: `https://search.worldcat.org/search?q=${scholarly}`, note: '全球圖書館館藏與專書查找' },
    { name: 'NDDS 全國文獻傳遞服務', priority: 'tw', url: 'https://ndds.stpi.niar.org.tw/?lang=zh_TW', note: '臺灣期刊、館藏與文獻傳遞服務入口' },
    { name: 'Google Books', priority: 'book', url: `https://www.google.com/search?tbm=bks&q=${scholarly}`, note: '專書、譯本與 ISBN 補充搜尋' },
    { name: 'Open Library', priority: 'book', url: `https://openlibrary.org/search?q=${scholarly}`, note: '專書與開放書目補充搜尋' },
    { name: 'Library of Congress', priority: 'book', url: `https://www.loc.gov/books/?q=${scholarly}`, note: '美國國會圖書館書目核對' },
    { name: 'DOAJ', priority: 'oa', url: `https://doaj.org/search/articles?source=%7B%22query%22%3A%7B%22query_string%22%3A%7B%22query%22%3A%22${scholarly}%22%7D%7D%7D`, note: '開放取用版本追蹤' },
  ];
}

async function reverseExpand(meta) {
  const references = [];
  const citations = [];
  let openAlexWork = null;
  if (meta.openAlexId) {
    openAlexWork = await fetchJson(openAlexApiUrl(meta.openAlexId)).catch(() => null);
  } else if (meta.doi) {
    openAlexWork = await fetchJson(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(meta.doi)}`).catch(() => null);
  } else if (meta.title) {
    openAlexWork = await resolveOpenAlexSeed(meta).catch(() => null);
  }
  if (openAlexWork?.id) {
    const shortId = openAlexWork.id.split('/').pop();
    const source = openAlexWork;
    const referenced = (source?.referenced_works || []).slice(0, 8).map(openAlexApiUrl);
    const refJobs = referenced.map((url) => fetchJson(url).then(mapOpenAlexWork).catch(() => null));
    references.push(...(await Promise.all(refJobs)).filter(Boolean));

    const citedUrl = new URL('https://api.openalex.org/works');
    citedUrl.searchParams.set('filter', `cites:${shortId}`);
    citedUrl.searchParams.set('sort', 'cited_by_count:desc');
    citedUrl.searchParams.set('per-page', '8');
    const cited = await fetchJson(citedUrl).catch(() => null);
    citations.push(...(cited?.results || []).map(mapOpenAlexWork));
  }
  const semanticSeed = await resolveSemanticSeed(meta).catch(() => null);
  const semanticId = meta.semanticId || semanticSeed?.semanticId || '';
  if (semanticId || meta.doi) {
    const id = semanticId ? encodeURIComponent(semanticId) : `DOI:${encodeURIComponent(meta.doi)}`;
    const fields = 'paperId,title,authors,year,venue,journal,externalIds,url,references.paperId,references.title,references.authors,references.year,references.venue,references.externalIds,references.url,citations.paperId,citations.title,citations.authors,citations.year,citations.venue,citations.externalIds,citations.url';
    const semantic = await fetchJson(`https://api.semanticscholar.org/graph/v1/paper/${id}?fields=${fields}`).catch(() => null);
    references.push(...(semantic?.references || []).map(mapSemanticPaper));
    citations.push(...(semantic?.citations || []).map(mapSemanticPaper));
  }
  let crossrefDoi = meta.doi;
  if (!crossrefDoi && meta.title) {
    crossrefDoi = (await resolveCrossrefSeed(meta).catch(() => null))?.doi || '';
  }
  if (crossrefDoi) {
    const crossref = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(crossrefDoi)}`).catch(() => null);
    references.push(...(crossref?.message?.reference || []).map((item) => baseMeta('Crossref', {
      type: 'article',
      title: item['article-title'] || item.title || item.unstructured || '',
      authors: item.author ? [item.author] : [],
      year: item.year || '',
      doi: item.DOI || item.doi || '',
      raw: item,
    })));
  }
  if (meta.raw?.references) {
    references.push(...meta.raw.references.map((item) => baseMeta('Crossref', {
      type: 'article',
      title: item.title || item.unstructured,
      authors: item.authors ? [item.authors] : [],
      year: item.year || '',
      doi: item.doi || '',
      raw: item,
    })));
  }
  if (meta.raw?.citations) {
    citations.push(...meta.raw.citations.map((item) => mapSemanticPaper(item)));
  }
  return {
    references: mergeDuplicates(references, meta.title || '').slice(0, 10),
    citations: mergeDuplicates(citations, meta.title || '').slice(0, 10),
  };
}

async function resolveOpenAlexSeed(meta) {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', [meta.title, meta.authors?.[0], meta.year].filter(Boolean).join(' '));
  url.searchParams.set('per-page', '8');
  const data = await fetchJson(url);
  const ranked = (data.results || [])
    .map((work) => ({ work, mapped: mapOpenAlexWork(work) }))
    .map((entry) => ({ ...entry, score: relevanceScore(entry.mapped, meta.title || '') + (hasAuthorOverlap(meta, entry.mapped) ? 12 : 0) + (meta.year && meta.year === entry.mapped.year ? 10 : 0) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score >= 42 ? ranked[0].work : null;
}

async function resolveSemanticSeed(meta) {
  const matches = await fetchSemanticQuery([meta.title, meta.authors?.[0], meta.year].filter(Boolean).join(' '));
  return bestSeedMatch(matches, meta, 42);
}

async function resolveCrossrefSeed(meta) {
  const matches = await fetchCrossrefQuery([meta.title, meta.authors?.[0], meta.year].filter(Boolean).join(' '));
  return bestSeedMatch(matches, meta, 42);
}

function bestSeedMatch(matches = [], meta = {}, minScore = 35) {
  const ranked = matches
    .map((candidate) => ({ ...candidate, seedScore: relevanceScore(candidate, meta.title || '') + (hasAuthorOverlap(meta, candidate) ? 12 : 0) + (meta.year && meta.year === candidate.year ? 10 : 0) }))
    .sort((a, b) => b.seedScore - a.seedScore);
  return ranked[0]?.seedScore >= minScore ? ranked[0] : null;
}

function hasAuthorOverlap(a = {}, b = {}) {
  const left = (a.authors || []).map(compactSearchText).filter(Boolean);
  const right = (b.authors || []).map(compactSearchText).filter(Boolean);
  return left.length && right.length && left.some((name) => right.some((other) => name === other || name.includes(other) || other.includes(name)));
}

function openAlexApiUrl(idOrUrl) {
  const shortId = String(idOrUrl).split('/').pop();
  return `https://api.openalex.org/works/${shortId}`;
}

function parseFootnotes(text) {
  const rows = text
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line.replace(/^\d+[\.\s、]+/, '')))
    .filter(Boolean);
  const parsed = [];
  let previous = null;
  for (const row of rows) {
    let expanded = row;
    const ibid = /^(Ibid\.?|同前註|同註)(?:[,，]?\s*(?:p{1,2}\.?\s*)?(\d+[-–—]?\d*|頁\s*\d+[-–—]?\d*))?/i.exec(row);
    if (ibid && previous) {
      expanded = `${previous.original} ${ibid[1]} ${ibid[2] || ''}`;
    }
    const meta = parseOneFootnote(expanded);
    meta.original = row;
    meta.pageLocator = extractLocator(row);
    parsed.push(meta);
    if (!ibid) previous = meta;
  }
  return parsed;
}

function extractLocator(text) {
  return normalizePages(text.match(/(?:pp?\.|頁)\s*[\d,-]+/i)?.[0] || '');
}

function parseOneFootnote(text) {
  const clean = normalizeWhitespace(text).replace(/["“”]/g, '"');
  const cnArticle = clean.match(/^(.+?)，〈(.+?)〉，《(.+?)》，(?:第(.+?)卷)?(?:第(.+?)期)?(?:.*?)(?:頁|pp?\.?)\s*([\d,-]+)/u);
  if (cnArticle) {
    return baseMeta('Manual', {
      type: 'article',
      authors: cnArticle[1].split(/[、,，]/).map(normalizeWhitespace).filter(Boolean),
      title: cnArticle[2],
      containerTitle: cnArticle[3],
      volume: cnArticle[4] || '',
      issue: cnArticle[5] || '',
      pages: normalizePages(cnArticle[6]),
      year: clean.match(/\d{4}/)?.[0] || '',
      language: 'zh',
    });
  }
  const cnBook = clean.match(/^(.+?)，《(.+?)》（(.+?)：(.+?)，(\d{4})/u);
  if (cnBook) {
    return baseMeta('Manual', {
      type: 'book',
      authors: cnBook[1].split(/[、,，]/).map(normalizeWhitespace).filter(Boolean),
      title: cnBook[2],
      place: cnBook[3],
      publisher: cnBook[4],
      year: cnBook[5],
      language: 'zh',
    });
  }
  const enArticle = clean.match(/^(.+?),\s*((?:19|20)\d{2}(?:\/[\d-]+)?)\.?\s+"(.+?)",?\s+(.+?)(?:,\s+Vol\.\s*([^,]+))?(?:,\s+No\.\s*([^,]+))?(?:,\s+pp?\.?\s*([\d,-]+))?\.?$/i);
  if (enArticle) {
    return baseMeta('Manual', {
      type: 'article',
      authors: splitEnglishAuthors(enArticle[1]),
      title: enArticle[3].replace(/,\s*$/, ''),
      containerTitle: enArticle[4],
      volume: enArticle[5] || '',
      issue: enArticle[6] || '',
      pages: normalizePages(enArticle[7] || ''),
      year: enArticle[2].match(/\b(19|20)\d{2}\b/)?.[0] || '',
      issued: enArticle[2],
      language: 'en',
    });
  }
  const doi = extractDoi(clean);
  return baseMeta('Manual', {
    type: 'article',
    title: clean.replace(/(?:pp?\.|頁)\s*[\d,-]+/i, '').trim(),
    doi,
    year: clean.match(/\b(19|20)\d{2}\b/)?.[0] || '',
  });
}

function splitEnglishAuthors(text) {
  if (!/,\s+and\s+|;\s+| & |\band\b/i.test(text)) return [normalizeWhitespace(text)];
  return text
    .replace(/\s+and\s+/gi, ', ')
    .split(/\s*;\s*|\s*,\s+(?=[A-Z][a-z]+(?:\s+[A-Z]\.)?)/)
    .map(normalizeWhitespace)
    .filter(Boolean);
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = normalize(join(root, requested));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'content-type': contentTypes[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    try {
      if (url.pathname === '/api/discover') {
        const input = url.searchParams.get('q') || '';
        const scope = ['article', 'book', 'all'].includes(url.searchParams.get('scope')) ? url.searchParams.get('scope') : 'article';
        if (!input.trim()) return json(res, 400, { error: 'Missing query.' });
        return json(res, 200, await discover(input, scope));
      }
      if (url.pathname === '/api/reverse' && req.method === 'POST') {
        const meta = await readBody(req);
        return json(res, 200, await reverseExpand(meta));
      }
      if (url.pathname === '/api/enrich' && req.method === 'POST') {
        const { item = {}, initialPayload = {} } = await readBody(req);
        return json(res, 200, await enrichMetadata(item, initialPayload));
      }
      if (url.pathname === '/api/footnotes' && req.method === 'POST') {
        const { text = '' } = await readBody(req);
        return json(res, 200, { items: parseFootnotes(text) });
      }
      if (url.pathname === '/api/library' && req.method === 'GET') {
        return json(res, 200, librarySummary(await readLibrary()));
      }
      if (url.pathname === '/api/library' && req.method === 'POST') {
        return json(res, 200, await saveLibraryItem(await readBody(req)));
      }
      return serveStatic(req, res);
    } catch (error) {
      json(res, 500, { error: error.message || 'Unexpected error.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer().listen(port, () => {
    console.log(`Research Master running at http://localhost:${port}`);
  });
}

export { createServer, discover, enrichMetadata, reverseExpand, parseFootnotes };
