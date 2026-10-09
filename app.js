const input = document.querySelector('#sourceInput');
const searchScopeControls = document.querySelectorAll('input[name="searchScope"]');
const footnoteInput = document.querySelector('#footnoteInput') || input;
const discoverBtn = document.querySelector('#discoverBtn');
const footnoteBtn = document.querySelector('#footnoteBtn');
const clearBtn = document.querySelector('#clearBtn');
const results = document.querySelector('#results');
const detectStatus = document.querySelector('#detectStatus');
const candidateList = document.querySelector('#candidateList');
const enrichSummary = document.querySelector('#enrichSummary');
const libraryCount = document.querySelector('#libraryCount');
const libraryUpdated = document.querySelector('#libraryUpdated');
const preparedFilePath = document.querySelector('#preparedFilePath');
const storageMode = document.querySelector('#storageMode');
const themeToggle = document.querySelector('#themeToggle');
const librarySelector = document.querySelector('#librarySelector');
const libraryHistory = document.querySelector('#libraryHistory');
const openLibraryEditor = document.querySelector('#openLibraryEditor');
const libraryEditor = document.querySelector('#libraryEditor');
const libraryEditorList = document.querySelector('#libraryEditorList');
const librarySearch = document.querySelector('#librarySearch');
const libraryEditorCount = document.querySelector('#libraryEditorCount');
const selectAllLibrary = document.querySelector('#selectAllLibrary');
const clearLibrarySelection = document.querySelector('#clearLibrarySelection');
const applyLibrarySelection = document.querySelector('#applyLibrarySelection');
const deleteSelectedLibrary = document.querySelector('#deleteSelectedLibrary');
const closeLibraryEditor = document.querySelector('#closeLibraryEditor');
const traditionalOutput = document.querySelector('#traditionalOutput');
const buildBibliographyBtn = document.querySelector('#buildBibliographyBtn');
const bibliographyOutput = document.querySelector('#bibliographyOutput');
const copyBibliographyBtn = document.querySelector('#copyBibliographyBtn');
const template = document.querySelector('#itemTemplate');
const stats = {
  itemCount: document.querySelector('#itemCount'),
  missingCount: document.querySelector('#missingCount'),
  conflictCount: document.querySelector('#conflictCount'),
  confidenceAvg: document.querySelector('#confidenceAvg'),
};

let items = [];
let livePayload = null;
let liveTimer = null;
let liveRequestId = 0;
let libraryState = { updatedAt: '', items: [] };
let editorSelectedKeys = new Set();
const cookieKey = 'cookie-session-library';
const selectedRefsKey = 'cookie-selected-references';
const translationCacheKey = 'cookie-title-translation-cache';
const authState = {
  mode: 'cookie',
  cloudFiles: {},
};
let selectedRefKeys = new Set(JSON.parse(sessionStorage.getItem(selectedRefsKey) || '[]'));
let translationCache = JSON.parse(sessionStorage.getItem(translationCacheKey) || '{}');

const typeLabels = {
  article: '期刊論文',
  book: '專書',
  chapter: '專書論文',
  thesis: '學位論文',
  conference: '研討會論文',
  report: '研究報告',
  preprint: '預印本',
  web: '網路資料',
};

const missingLabels = {
  authors: '作者',
  year: '年份',
  title: '題名',
  containerTitle: '刊名／書名',
  volume: '卷',
  issue: '期',
  pages: '頁碼',
  publisher: '出版者',
  place: '出版地',
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
      sourcePriority: 96,
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
  ['期刊', '期刊'],
  ['参考文献', '參考文獻'],
  ['数据库', '資料庫'],
  ['图书馆', '圖書館'],
  ['专书', '專書'],
  ['著作', '著作'],
  ['军事', '軍事'],
  ['战略', '戰略'],
  ['资讯', '資訊'],
  ['权威', '權威'],
  ['验证', '驗證'],
  ['开放', '開放'],
  ['搜寻', '搜尋'],
  ['引用脉络', '引用脈絡'],
];

const traditionalPhraseMap = simplifiedPhraseMap.map(([simp, trad]) => [trad, simp]);

const simplifiedCharMap = {
  国: '國', 学: '學', 华: '華', 台: '臺', 湾: '灣', 陆: '陸', 书: '書', 图: '圖',
  馆: '館', 术: '術', 论: '論', 文: '文', 题: '題', 问: '問', 关: '關', 系: '係',
  对: '對', 与: '與', 体: '體', 会: '會', 经: '經', 济: '濟', 历: '歷', 史: '史',
  政: '政', 军: '軍', 战: '戰', 略: '略', 门: '門', 发: '發', 展: '展', 后: '後',
  续: '續', 资: '資', 讯: '訊', 证: '證', 验: '驗', 开: '開', 放: '放', 搜: '搜',
  寻: '尋', 录: '錄', 参: '參', 专: '專', 著: '著', 权: '權', 威: '威', 缺: '缺',
  失: '失', 字: '字', 段: '段', 页: '頁', 码: '碼', 编: '編', 译: '譯', 导: '導',
  向: '向', 云: '雲', 端: '端', 优: '優', 化: '化', 联: '聯', 网: '網', 路: '路',
  系: '系', 统: '統', 繁: '繁', 简: '簡', 转: '轉', 换: '換',
};

const traditionalCharMap = Object.fromEntries(Object.entries(simplifiedCharMap).map(([simp, trad]) => [trad, simp]));

discoverBtn.addEventListener('click', () => discover());
footnoteBtn?.addEventListener('click', () => parseFootnotes());
clearBtn.addEventListener('click', () => {
  input.value = '';
  items = [];
  livePayload = null;
  renderDetection(null, 'idle');
  render();
});
input.addEventListener('input', scheduleLiveDetection);
searchScopeControls.forEach((control) => control.addEventListener('change', () => {
  if (livePayload) {
    const scoped = applySearchScope(livePayload);
    livePayload = scoped;
    renderDetection(scoped, 'done');
  }
  if (input.value.trim().length >= 3) scheduleLiveDetection();
}));
themeToggle.addEventListener('change', () => setTheme(themeToggle.checked ? 'dark' : 'light'));
openLibraryEditor.addEventListener('click', showLibraryEditor);
closeLibraryEditor.addEventListener('click', hideLibraryEditor);
librarySearch.addEventListener('input', renderLibraryEditor);
selectAllLibrary.addEventListener('click', selectAllEditorItems);
clearLibrarySelection.addEventListener('click', clearEditorSelection);
applyLibrarySelection.addEventListener('click', applyEditorSelection);
deleteSelectedLibrary.addEventListener('click', deleteEditorSelection);
buildBibliographyBtn.addEventListener('click', buildSelectedBibliography);
copyBibliographyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(bibliographyOutput.textContent);
  copyBibliographyBtn.querySelector('span').textContent = '已複製';
  setTimeout(() => {
    copyBibliographyBtn.querySelector('span').textContent = '複製參考文獻列表';
  }, 1300);
});

document.querySelectorAll('input[name="formatMode"], #showJson, #groupLang, #traditionalOutput, #apaVariant, #chicagoVariant').forEach((control) => {
  control.addEventListener('change', () => {
    render();
    renderLibrarySelector();
    renderLibraryHistory();
    renderLibraryEditor();
    if (selectedRefKeys.size) buildSelectedBibliography();
  });
});

document.querySelectorAll('input[name="bibliographyMode"]').forEach((control) => {
  control.addEventListener('change', () => {
    if (selectedRefKeys.size) buildSelectedBibliography();
  });
});

function selectedFormatMode() {
  return document.querySelector('input[name="formatMode"]:checked').value;
}

function selectedSearchScope() {
  return document.querySelector('input[name="searchScope"]:checked')?.value || 'article';
}

function parseSearchConditions(value = '') {
  const raw = normalizeText(value);
  const tokens = raw.split(/\s+/).map(normalizeText).filter(Boolean);
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
  ].map(normalizeText).filter(Boolean))];
}

function selectedBibliographyMode() {
  return document.querySelector('input[name="bibliographyMode"]:checked').value;
}

function shouldShowJson() {
  return document.querySelector('#showJson').checked;
}

function selectedApaVariant() {
  return document.querySelector('#apaVariant').value;
}

function selectedChicagoVariant() {
  return document.querySelector('#chicagoVariant').value;
}

function shouldUseTraditionalOutput() {
  return !traditionalOutput || traditionalOutput.checked;
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  sessionStorage.setItem('cookie-theme', theme);
  themeToggle.checked = theme === 'dark';
  if (window.lucide) window.lucide.createIcons();
}

async function discover() {
  const current = items[0];
  const hasCandidatePayload = livePayload?.candidates?.length;
  const seed = hasCandidatePayload ? livePayload.input || input.value : current ? current.doi || current.title || current.sourceInput || input.value : input.value;
  const chunks = splitInput(seed);
  if (!chunks.length) return;
  setBusy(true, hasCandidatePayload ? '批次補全中' : current ? '補全中' : '偵測中');
  try {
    let payload = hasCandidatePayload ? livePayload : await runDetection(chunks[0]);
    if (payload?.candidates?.length) {
      payload = await enrichCandidatePayload(payload);
      livePayload = payload;
      if (current) {
        const matched = payload.candidates.find((candidate) => fingerprintItem(candidate) === fingerprintItem(current))
          || payload.candidates.find((candidate) => sameWorkScore(current, candidate) >= 58);
        if (matched) {
          matched.citations = citationOutputs(matched);
          items = [matched];
          render();
        }
      }
    } else if (current) {
      const enriched = await enrichSelectedMetadata(current, payload);
      const completed = mergeMetadata(enriched, payload.best || payload.candidates?.[0] || {});
      completed.candidates = dedupeItems([...(payload.candidates || []), ...(current.candidates || []), completed]);
      completed.conflicts = metadataConflictReport(completed.candidates);
      completed.missing = missingFields(completed);
      completed.routes = payload.routes?.length ? payload.routes : verificationRoutes(completed.title || chunks[0]);
      completed.inferred = payload.inferred || current.inferred;
      completed.sourceInput = current.sourceInput || chunks[0];
      completed.citations = citationOutputs(completed);
      items = [completed];
      render();
    }
    renderDetection(payload, 'done');
  } catch (error) {
    renderDetection({ error: error.message }, 'error');
  } finally {
    setBusy(false);
  }
}

async function enrichCandidatePayload(payload) {
  const sourceCandidates = (payload.candidates || []).slice(0, 40);
  const total = sourceCandidates.length;
  const beforeMissing = sourceCandidates.reduce((sum, candidate) => sum + missingFields(candidate).length, 0);
  let completedCount = 0;
  const enriched = await mapWithConcurrency(sourceCandidates, 3, async (candidate) => {
    try {
      const item = await enrichSelectedMetadata(candidate, payload);
      completedCount += 1;
      discoverBtn.querySelector('span').textContent = `補全 ${completedCount}/${total}`;
      renderEnrichmentSummary({ total, completed: completedCount, beforeMissing, working: true });
      return item;
    } catch {
      completedCount += 1;
      discoverBtn.querySelector('span').textContent = `補全 ${completedCount}/${total}`;
      renderEnrichmentSummary({ total, completed: completedCount, beforeMissing, working: true });
      return {
        ...candidate,
        missing: missingFields(candidate),
        conflicts: candidate.conflicts || [],
      };
    }
  });
  const candidates = dedupeItems(enriched).filter((item) => sourceScopeMatches(item, payload.searchScope || selectedSearchScope())).sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
  const afterMissing = candidates.reduce((sum, candidate) => sum + (candidate.missing || missingFields(candidate)).length, 0);
  const conflicts = candidates.flatMap((item) => item.conflicts || []);
  const summary = {
    total,
    completed: candidates.length,
    beforeMissing,
    afterMissing,
    filled: Math.max(0, beforeMissing - afterMissing),
    conflictCount: conflicts.length,
    corroboratedCount: candidates.filter((item) => item.corroboratedBy?.length).length,
  };
  return {
    ...payload,
    best: candidates[0] || payload.best,
    candidates,
    missing: candidates.flatMap((item) => item.missing || missingFields(item)),
    conflicts,
    enrichmentSummary: summary,
    enrichedAt: new Date().toISOString(),
    searchScope: payload.searchScope || selectedSearchScope(),
  };
}

async function mapWithConcurrency(list, limit, worker) {
  const results = new Array(list.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const index = next;
      next += 1;
      results[index] = await worker(list[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function enrichSelectedMetadata(item, initialPayload = {}) {
  if (!item.serverEnriched) {
    const serverResult = await postJson('/api/enrich', {
      item: cleanJson(item),
      initialPayload: slimEnrichmentPayload(initialPayload),
    }).catch(() => null);
    if (serverResult && (serverResult.title || serverResult.doi || serverResult.isbn)) {
      return {
        ...serverResult,
        missing: missingFields(serverResult),
        citations: citationOutputs(serverResult),
      };
    }
  }

  const searchTitle = normalizeText(item.title || initialPayload.best?.title || item.sourceInput || input.value);
  const searchAuthor = normalizeText(item.authors?.[0] || initialPayload.best?.authors?.[0] || '');
  const searchYear = normalizeText(item.year || initialPayload.best?.year || '');
  const conditions = parseSearchConditions(initialPayload.input || item.sourceInput || input.value || '');
  const exactQuery = [searchTitle, searchAuthor, searchYear].filter(Boolean).join(' ');
  const variants = expandSearchQueries(searchTitle || exactQuery, { kind: 'title' });
  const conditionQueries = fieldTargetedQueries(item, conditions);
  const seedLocalHints = localMetadataHints(item).map((hint) => mergeMetadata(item, hint));
  const jobs = [];

  if (item.doi) {
    jobs.push(
      clientCrossrefDoi(item.doi),
      clientOpenAlexDoi(item.doi),
      clientDataCiteDoi(item.doi),
      fetchSemanticByDoi(item.doi),
    );
  }
  if (exactQuery) {
    jobs.push(
      clientCrossrefQuery(exactQuery),
      clientOpenAlexQuery(exactQuery),
      clientSemanticQuery(exactQuery),
      clientDataCiteQuery(exactQuery),
      clientEuropePmcQuery(exactQuery),
      clientPubMedQuery(exactQuery),
      clientDoajQuery(exactQuery),
    );
  }
  if (searchTitle && exactQuery !== searchTitle) {
    jobs.push(clientCrossrefQuery(searchTitle), clientOpenAlexQuery(searchTitle), clientSemanticQuery(searchTitle));
  }
  conditionQueries.forEach((query) => {
    jobs.push(clientCrossrefQuery(query), clientOpenAlexQuery(query), clientSemanticQuery(query), clientDoajQuery(query));
  });
  if (item.type === 'book' || item.isbn || missingFields(item).includes('place')) {
    if (item.isbn) jobs.push(clientOpenLibraryIsbn(item.isbn));
    if (exactQuery) jobs.push(clientGoogleBooksQuery(exactQuery), clientOpenLibraryQuery(exactQuery), clientLibraryOfCongressQuery(exactQuery));
    if (searchTitle && exactQuery !== searchTitle) jobs.push(clientGoogleBooksQuery(searchTitle), clientOpenLibraryQuery(searchTitle), clientLibraryOfCongressQuery(searchTitle));
  }

  const settled = await Promise.allSettled(jobs);
  const remote = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  const expandedEvidence = expandWithLocalMetadataHints([...(initialPayload.candidates || []), ...(item.candidates || []), item, ...remote]);
  const evidence = [...seedLocalHints, ...expandedEvidence]
    .filter((candidate) => candidate && (candidate.title || candidate.doi || candidate.isbn))
    .filter(isAllowedDefaultCandidate)
    .filter((candidate) => candidate.localEvidence || sameWorkScore(item, candidate) >= 44);
  const ranked = rankCandidates(
    evidence,
    searchTitle || exactQuery,
    variants,
    'title',
  );

  const completed = dedupeItems([...seedLocalHints, ...ranked]).slice(0, 12).reduce((merged, candidate) => mergeMetadata(merged, candidate), item);
  completed.corroboratedBy = [...new Set([...(completed.corroboratedBy || []), ...ranked.map((candidate) => candidate.source)].filter(Boolean))];
  completed.conflicts = metadataConflictReport(evidence);
  completed.missing = missingFields(completed);
  completed.candidates = dedupeItems(evidence);
  completed.enrichedAt = new Date().toISOString();
  return completed;
}

function slimEnrichmentPayload(payload = {}) {
  return {
    input: payload.input || input.value.trim(),
    searchScope: payload.searchScope || selectedSearchScope(),
    inferred: payload.inferred || {},
    best: payload.best ? cleanJson(payload.best) : null,
    candidates: (payload.candidates || []).slice(0, 20).map(cleanJson),
  };
}

function fieldTargetedQueries(item = {}, conditions = parseSearchConditions(input.value || '')) {
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
  return [...new Set(queries.map(normalizeText).filter((query) => query.length >= 3))].slice(0, 8);
}

async function parseFootnotes() {
  const text = (footnoteInput?.value || '').trim() || input.value.trim();
  if (!text) return;
  setBusy(true, '解析中');
  try {
    const payload = await postJson('/api/footnotes', { text });
    items = dedupeItems(payload.items.map((item) => ({
      ...item,
      candidates: [item],
      conflicts: [],
      missing: missingFields(item),
      routes: verificationRoutes(item.title || item.original || ''),
      inferred: { kind: 'footnote' },
    })));
    items.forEach((item) => {
      item.citations = citationOutputs(item);
    });
    render();
  } catch (error) {
    const payload = { items: clientParseFootnotes(text) };
    items = dedupeItems(payload.items.map((item) => ({
      ...item,
      candidates: [item],
      conflicts: [],
      missing: missingFields(item),
      routes: verificationRoutes(item.title || item.original || ''),
      inferred: { kind: 'footnote' },
    })));
    items.forEach((item) => {
      item.citations = citationOutputs(item);
    });
    render();
    libraryUpdated.textContent = `已使用瀏覽器端註腳解析模式：${error.message}`;
  } finally {
    setBusy(false);
  }
}

function scheduleLiveDetection() {
  clearTimeout(liveTimer);
  const value = input.value.trim();
  if (!value) {
    livePayload = null;
    renderDetection(null, 'idle');
    return;
  }
  if (value.length < 3) {
    renderDetection({ message: '請再輸入更多線索。' }, 'idle');
    return;
  }
  if (/\n/.test(value) || /\b(Ibid\.?|同前註|同註|前引書)|頁\s*\d|pp?\./i.test(value)) {
    renderDetection({ message: '看起來像頁下註，系統會直接在輸入偵測中嘗試還原書目。' }, 'loading');
  }
    renderDetection({ message: '正在判斷輸入類型並啟動中英／繁簡檢索：Crossref、OpenAlex、Semantic Scholar、DataCite、Europe PMC、PubMed、DOAJ、Open Library、Library of Congress、Google Books；Airiti／Google Scholar／CNKI 等保留導向路徑。' }, 'loading');
  liveTimer = setTimeout(async () => {
    const requestId = ++liveRequestId;
    try {
      const payload = await runDetection(value);
      if (requestId === liveRequestId) renderDetection(payload, 'done');
    } catch (error) {
      if (requestId === liveRequestId) renderDetection({ error: error.message }, 'error');
    }
  }, 350);
}

async function runDetection(value) {
  let payload;
  const scope = selectedSearchScope();
  try {
    payload = await getJson(`/api/discover?q=${encodeURIComponent(value)}&scope=${encodeURIComponent(scope)}`);
  } catch (error) {
    payload = await clientDiscover(value);
    payload.warning = `目前使用瀏覽器直連資料庫模式：${error.message}`;
  }
  payload = applySearchScope(payload);
  livePayload = payload;
  return payload;
}

function applySearchScope(payload) {
  if (!payload || !payload.candidates) return payload;
  const scope = selectedSearchScope();
  const intent = payload.inferred?.kind || 'query';
  const scoped = scope === 'all' ? payload.candidates : payload.candidates.filter((item) => sourceScopeMatches(item, scope));
  const candidates = scoped.filter((item) => isDisplayableCandidate(item, intent));
  const best = sourceScopeMatches(payload.best || {}, scope) && isDisplayableCandidate(payload.best || {}, intent) ? payload.best : candidates[0] || payload.best;
  return {
    ...payload,
    searchScope: scope,
    candidates,
    best,
    missing: missingFields(best || {}),
    conflicts: metadataConflictReport(candidates.filter((item) => fingerprintItem(item) === fingerprintItem(best || {}))),
  };
}

function sourceScopeMatches(item = {}, scope = selectedSearchScope()) {
  if (scope === 'all') return true;
  if (scope === 'book') return isBookLike(item);
  return isArticleLike(item);
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

function renderDetection(payload, state) {
  const dot = detectStatus.querySelector('.status-dot');
  dot.className = `status-dot ${state || 'idle'}`;
  candidateList.innerHTML = '';

  if (!payload) {
    detectStatus.querySelector('p').textContent = '尚未輸入。輸入 DOI、學者姓名或篇名後，這裡會即時顯示搜尋狀況。';
    updateMetrics();
    renderEnrichmentSummary(null);
    return;
  }
  if (payload.error) {
    detectStatus.querySelector('p').textContent = `搜尋失敗：${payload.error}`;
    return;
  }
  if (payload.message) {
    detectStatus.querySelector('p').textContent = payload.message;
    return;
  }

  const candidates = (payload.candidates || []).filter((candidate) => isDisplayableCandidate(candidate, payload.inferred?.kind || 'query'));
  const missing = payload.missing?.length || 0;
  const conflicts = payload.conflicts?.length || 0;
  const variants = payload.inferred?.variants?.length ? `；已啟用 ${payload.inferred.variants.length} 組中英／繁簡檢索詞` : '';
  const scopeLabel = { article: '期刊', book: '專書', all: '期刊＋專書' }[payload.searchScope || selectedSearchScope()] || '期刊';
  updateMetrics(payload);
  renderEnrichmentSummary(payload.enrichmentSummary || null);
  detectStatus.querySelector('p').textContent =
    state === 'loading'
      ? '正在搜尋資料庫...'
      : `偵測為 ${kindLabel(payload.inferred?.kind)}，範圍：${scopeLabel}，找到 ${candidates.length} 筆候選；缺失 ${missing} 欄，衝突 ${conflicts} 處${variants}。`;

  if (!candidates.length) {
    candidateList.innerHTML = '<div class="candidate-empty">目前沒有資料庫命中。下方驗證路徑仍會保留 Airiti、Google Scholar 與 Crossref 搜尋入口。</div>';
    return;
  }

  candidates.slice(0, 40).forEach((candidate, index) => {
    const card = document.createElement('button');
    card.className = 'candidate-card';
    card.type = 'button';
    const statusBits = [
      `缺 ${candidate.missing?.length ?? missingFields(candidate).length}`,
      `衝突 ${candidate.conflicts?.length || 0}`,
      candidate.corroboratedBy?.length ? `佐證 ${candidate.corroboratedBy.length + 1}` : '',
    ].filter(Boolean).join(' · ');
    card.innerHTML = `
      <span class="candidate-rank">${String(index + 1).padStart(2, '0')}</span>
      <span class="candidate-main">
        <strong>${escapeHtml(candidate.title || '[待補題名]')}</strong>
        <em>${escapeHtml(metaLine(candidate) || candidate.source || '')}</em>
        <small>${escapeHtml(statusBits)}</small>
      </span>
      <span class="candidate-score">${candidate.confidence || 55}%</span>
    `;
    card.addEventListener('click', () => selectCandidate(candidate, payload));
    candidateList.appendChild(card);
  });
  if (payload.inferred?.kind === 'author') {
    candidateList.appendChild(authorDatabaseHints(payload.input || input.value.trim(), payload.inferred?.variants || []));
  }
}

function renderEnrichmentSummary(summary) {
  if (!enrichSummary) return;
  if (!summary) {
    enrichSummary.innerHTML = '<strong>補全統計</strong><span>尚未執行補全</span>';
    return;
  }
  if (summary.working) {
    enrichSummary.innerHTML = `
      <strong>補全統計</strong>
      <span>處理 ${summary.completed || 0}/${summary.total || 0} 筆；補全前缺 ${summary.beforeMissing || 0} 欄</span>
    `;
    return;
  }
  enrichSummary.innerHTML = `
    <strong>補全統計</strong>
    <span>處理 ${summary.completed || 0}/${summary.total || 0} 筆，補上 ${summary.filled || 0} 欄，仍缺 ${summary.afterMissing || 0} 欄</span>
    <small>衝突 ${summary.conflictCount || 0} 組；交叉佐證 ${summary.corroboratedCount || 0} 筆${summary.afterMissing ? '；未補欄位保留為待人工查核' : ''}</small>
  `;
}

function authorDatabaseHints(query, variants = []) {
  const wrap = document.createElement('div');
  wrap.className = 'database-hints';
  const terms = encodeURIComponent([query, ...variants].filter(Boolean).slice(0, 4).join(' OR '));
  const compact = encodeURIComponent(query || variants[0] || '');
  const links = [
    ['Airiti 華藝', `https://www.google.com/search?q=site%3Aairitilibrary.com+${terms}`],
    ['Airiti ACI', `https://www.google.com/search?q=site%3Aairitiaci.com+${terms}`],
    ['Google Scholar', `https://scholar.google.com/scholar?q=${terms}`],
    ['CNKI', `https://www.google.com/search?q=site%3Acnki.net+${terms}`],
    ['萬方', `https://www.google.com/search?q=site%3Awanfangdata.com.cn+${terms}`],
  ];
  wrap.innerHTML = `
    <strong>完整著作延伸檢索</strong>
    <span>部分臺灣與中文資料庫沒有免費公開 API；請用這些入口補查未回傳的作者著作。</span>
    <div>${links.map(([name, url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a>`).join('')}</div>
  `;
  return wrap;
}

function updateMetrics(payload = livePayload) {
  const current = items[0];
  if (stats.itemCount) stats.itemCount.textContent = String(payload?.candidates?.length || 0);
  stats.missingCount.textContent = String(current?.missing?.length ?? payload?.missing?.length ?? 0);
  stats.conflictCount.textContent = String(current?.conflicts?.length ?? payload?.conflicts?.length ?? 0);
  const confidence = current?.confidence || payload?.best?.confidence || null;
  stats.confidenceAvg.textContent = confidence ? `${confidence}%` : '--';
}

function kindLabel(kind) {
  return {
    doi: 'DOI',
    isbn: 'ISBN',
    url: '網址',
    footnote: '頁下註',
    author: '作者姓名',
    title: '篇名／書名',
    query: '關鍵字／學者姓名',
  }[kind] || '線索';
}

async function selectCandidate(candidate, payload = livePayload) {
  const item = {
    ...candidate,
    candidates: payload?.candidates || [candidate],
    conflicts: candidate.conflicts?.length ? candidate.conflicts : conflictReportForCandidate(candidate, payload?.conflicts || []),
    missing: missingFields(candidate),
    routes: candidate.routes?.length ? candidate.routes : verificationRoutes([candidate.title, candidate.authors?.[0], candidate.year].filter(Boolean).join(' '), payload?.inferred?.variants || []),
    inferred: payload?.inferred || { kind: 'query' },
    sourceInput: payload?.input || input.value.trim(),
  };
  item.citations = citationOutputs(item);
  items = [item];
  render();
}

function conflictReportForCandidate(candidate, conflicts) {
  if (!conflicts.length) return [];
  const blob = JSON.stringify(candidate).toLowerCase();
  return conflicts.filter((conflict) => conflict.values?.some((value) => blob.includes(String(value.value).toLowerCase())));
}

function metadataConflictReport(evidence = []) {
  const fields = ['year', 'containerTitle', 'volume', 'issue', 'pages', 'publisher', 'doi'];
  return fields
    .map((field) => {
      const values = new Map();
      evidence.forEach((item) => {
        const raw = Array.isArray(item?.[field]) ? item[field].join('; ') : item?.[field];
        const value = normalizeText(raw || '');
        if (!value) return;
        const key = compactSearchText(value);
        if (!key) return;
        const current = values.get(key) || { value, sources: [] };
        current.sources = [...new Set([...current.sources, item.source || 'Unknown'])];
        values.set(key, current);
      });
      const unique = [...values.values()];
      return unique.length > 1 ? { field, values: unique } : null;
    })
    .filter(Boolean);
}

function splitInput(value) {
  const text = value.trim();
  if (!text) return [];
  if (/\n/.test(text) && !/\b(Ibid\.?|同前註|同註|前引書)|頁\s*\d|pp?\./i.test(text)) {
    return text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  }
  return [text];
}

function setBusy(isBusy, label = '處理中') {
  [discoverBtn, footnoteBtn].filter(Boolean).forEach((button) => {
    button.disabled = isBusy;
  });
  if (isBusy) {
    discoverBtn.querySelector('span').textContent = label;
  } else {
    discoverBtn.querySelector('span').textContent = '補全缺失欄位';
  }
}

function render() {
  results.innerHTML = '';
  const sorted = sortItems(items);
  const current = sorted[0];
  const candidateTotal = livePayload?.candidates?.length || 0;
  const missingTotal = current?.missing?.length || 0;
  const conflictTotal = current?.conflicts?.length || 0;
  const confidence = current?.confidence || null;

  updateMetrics({ candidates: Array.from({ length: candidateTotal }), missing: Array.from({ length: missingTotal }), conflicts: Array.from({ length: conflictTotal }), best: { confidence } });

  sorted.forEach((item) => {
    results.appendChild(renderItem(item));
  });
  if (window.lucide) window.lucide.createIcons();
}

function renderItem(item) {
  const node = template.content.firstElementChild.cloneNode(true);
  const displayItem = toTraditionalItem(item);
  node.classList.add(`type-${displayItem.type || 'article'}`);
  node.querySelector('.eyebrow').textContent = `${typeLabels[displayItem.type] || displayItem.type || '文獻'} · ${displayItem.source || 'Manual'}`;
  node.querySelector('h3').textContent = displayItem.title || displayItem.sourceInput || '待補題名';
  node.querySelector('.meta-line').textContent = metaLine(displayItem);
  animateConfidence(node.querySelector('.confidence'), Number(displayItem.confidence || 55));

  const warnings = node.querySelector('.warnings');
  renderWarnings(warnings, displayItem);

  const output = node.querySelector('.citation-output');
  const tabs = [...node.querySelectorAll('.citation-tabs button')];
  const outputs = citationOutputs(displayItem);
  const initialTab = 'note';
  setOutput(initialTab);
  tabs.forEach((tab) => {
    if (tab.dataset.tab === 'json') tab.hidden = !shouldShowJson();
    tab.addEventListener('click', () => setOutput(tab.dataset.tab));
  });

  function setOutput(tabName) {
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === tabName));
    output.textContent = outputs[tabName] || '';
  }

  node.querySelector('.copy').addEventListener('click', async () => {
    const copied = await copyText(output.textContent);
    item.citations = citationOutputs(item);
    await saveToLibrary(item, { reason: 'copy' });
    node.querySelector('.copy span').textContent = copied ? '已複製並保存' : '已保存';
    setTimeout(() => {
      node.querySelector('.copy span').textContent = '複製';
    }, 1300);
  });

  node.querySelector('.save-library').addEventListener('click', async () => {
    item.citations = citationOutputs(item);
    await saveToLibrary(item, { reason: 'manual' });
    node.querySelector('.save-library span').textContent = '已存入';
    setTimeout(() => {
      node.querySelector('.save-library span').textContent = '存入個人文獻資料庫';
    }, 1400);
  });

  node.querySelector('.deselect').addEventListener('click', () => {
    items = [];
    render();
  });

  const openButton = node.querySelector('.open-url');
  const directUrl = literatureUrl(item);
  if (directUrl) openButton.href = directUrl;
  else openButton.removeAttribute('href');
  openButton.classList.toggle('disabled', !directUrl);
  openButton.setAttribute('aria-disabled', directUrl ? 'false' : 'true');
  openButton.title = directUrl ? '開啟這筆文獻的 DOI 或來源頁面' : '目前沒有可開啟的文獻網址';
  if (!directUrl) {
    openButton.addEventListener('click', (event) => event.preventDefault());
  } else {
    openButton.addEventListener('click', (event) => {
      event.preventDefault();
      openExternalUrl(directUrl);
    });
  }
  renderRoutes(node.querySelector('.routes'), item.routes || []);

  return node;
}

function animateConfidence(node, value = 55) {
  if (!node) return;
  const target = Math.max(0, Math.min(100, Math.round(value)));
  const start = performance.now();
  const duration = 900;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const draw = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const current = Math.round(target * easeOut(progress));
    node.textContent = `${current}%`;
    node.style.setProperty('--progress', `${current * 3.6}deg`);
    if (progress < 1) requestAnimationFrame(draw);
  };
  node.textContent = '0%';
  node.style.setProperty('--progress', '0deg');
  requestAnimationFrame(draw);
}

async function saveToLibrary(item, options = {}) {
  try {
    const now = new Date().toISOString();
    const incrementCopy = options.reason === 'copy' ? 1 : 0;
    const clean = {
      ...cleanJson(item),
      citations: citationOutputs(item),
      savedAt: item.savedAt || now,
      usedAt: now,
      usageReason: options.reason || 'copy',
      copyCount: Number(item.copyCount || 0) + incrementCopy,
    };
    const key = fingerprintItem(clean);
    const index = libraryState.items.findIndex((existing) => fingerprintItem(existing) === key);
    if (index >= 0) {
      libraryState.items[index] = {
        ...libraryState.items[index],
        ...clean,
        savedAt: libraryState.items[index].savedAt || clean.savedAt,
        copyCount: Number(libraryState.items[index].copyCount || 0) + incrementCopy,
        usedAt: now,
        updatedAt: now,
      };
    } else {
      libraryState.items.push(clean);
    }
    libraryState.updatedAt = new Date().toISOString();
    sessionStorage.setItem(cookieKey, JSON.stringify(libraryState));
    renderLibrary(libraryState);
    libraryUpdated.textContent = options.reason === 'copy'
      ? `已複製並存入個人文獻資料庫：${new Date(now).toLocaleString('zh-TW')}`
      : `已手動存入個人文獻資料庫：${new Date(now).toLocaleString('zh-TW')}`;
  } catch (error) {
    libraryUpdated.textContent = `保存失敗：${error.message}`;
  }
}

async function loadLibrary() {
  libraryState = JSON.parse(sessionStorage.getItem(cookieKey) || '{"updatedAt":"","items":[]}');
  renderLibrary(libraryState);
}

function renderLibrary(summary) {
  const count = summary.count ?? summary.items?.length ?? 0;
  libraryCount.textContent = `${count} 筆已保存`;
  libraryUpdated.textContent = summary.updatedAt ? `瀏覽器暫存更新：${new Date(summary.updatedAt).toLocaleString('zh-TW')}，關閉分頁後清除` : '瀏覽器暫存模式：關閉分頁後清除';
  if (preparedFilePath) preparedFilePath.textContent = 'browser-session://prepared-bibliography.md';
  renderLibrarySelector();
  renderLibraryHistory();
  renderLibraryEditor();
}

function renderLibrarySelector() {
  librarySelector.innerHTML = '';
  if (!libraryState.items.length) {
    librarySelector.innerHTML = '<div class="candidate-empty">個人文獻資料庫目前沒有資料。選取候選文獻並按「複製」後，才會進入資料庫並可輸出參考文獻。</div>';
    return;
  }
  const selectedItems = sortItems(libraryState.items.filter((item) => selectedRefKeys.has(fingerprintItem(item))));
  if (!selectedItems.length) {
    librarySelector.innerHTML = '<div class="candidate-empty">尚未套用輸出文獻。請先進入「個人文獻資料庫編輯」，勾選資料後按「套用到輸出列表」。</div>';
    return;
  }
  selectedItems.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'reference-option reference-preview';
    card.innerHTML = `
      <span>
        <strong>${escapeHtml(item.title || '[待補題名]')}</strong>
        <em>${escapeHtml(metaLine(item) || item.source || '')}</em>
        <small>${escapeHtml(formatTimestamp(item.usedAt || item.updatedAt || item.savedAt))}</small>
      </span>
    `;
    librarySelector.appendChild(card);
  });
}

function renderLibraryHistory() {
  libraryHistory.innerHTML = '';
  if (!libraryState.items.length) {
    libraryHistory.innerHTML = '<div class="candidate-empty">尚無使用紀錄。按下文獻卡片中的「複製」後，該筆文獻才會保存到這裡。</div>';
    return;
  }
  sortItems(libraryState.items).forEach((item) => {
    const key = fingerprintItem(item);
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
      <label>
        <span>
          <strong>${escapeHtml(item.title || '[待補題名]')}</strong>
          <em>${escapeHtml(formatTimestamp(item.usedAt || item.updatedAt || item.savedAt))} · ${usageLabel(item)} · ${escapeHtml(formatAuthors(item.authors, item) || item.source || '')}</em>
        </span>
      </label>
      <div class="history-actions">
        <button type="button" class="view-ref">查看</button>
        <button type="button" class="delete-ref" title="從個人文獻資料庫刪除">刪除</button>
      </div>
    `;
    row.querySelector('.view-ref').addEventListener('click', () => {
      items = [{ ...item, missing: missingFields(item), conflicts: item.conflicts || [] }];
      render();
    });
    row.querySelector('.delete-ref').addEventListener('click', () => deleteLibraryItem(item, { confirm: true }));
    libraryHistory.appendChild(row);
  });
}

function showLibraryEditor() {
  editorSelectedKeys = new Set(selectedRefKeys);
  libraryEditor.hidden = false;
  renderLibraryEditor();
  libraryEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideLibraryEditor() {
  libraryEditor.hidden = true;
}

function renderLibraryEditor() {
  if (!libraryEditorList) return;
  const query = librarySearch.value.trim().toLowerCase();
  const filtered = sortItems(libraryState.items).filter((item) => {
    if (!query) return true;
    return [item.title, item.containerTitle, item.year, item.doi, item.source, ...(item.authors || [])]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
  libraryEditorCount.textContent = `${filtered.length} / ${libraryState.items.length} 筆，已選 ${editorSelectedKeys.size} 筆`;
  libraryEditorList.innerHTML = '';
  if (!libraryState.items.length) {
    libraryEditorList.innerHTML = '<div class="candidate-empty">目前沒有已使用文獻。按「複製」後才會保存進個人文獻資料庫。</div>';
    return;
  }
  if (!filtered.length) {
    libraryEditorList.innerHTML = '<div class="candidate-empty">找不到符合篩選條件的文獻。</div>';
    return;
  }
  filtered.forEach((item) => {
    const key = fingerprintItem(item);
    const row = document.createElement('article');
    row.className = 'editor-row';
    row.innerHTML = `
      <label class="editor-check">
        <input type="checkbox" ${editorSelectedKeys.has(key) ? 'checked' : ''} />
        <span>列入輸出</span>
      </label>
      <div class="editor-main">
        <strong>${escapeHtml(item.title || '[待補題名]')}</strong>
        <em>${escapeHtml(metaLine(item) || item.source || '')}</em>
        <small>${escapeHtml(formatTimestamp(item.usedAt || item.updatedAt || item.savedAt))} · ${escapeHtml(usageLabel(item))}</small>
      </div>
      <div class="editor-actions">
        <button type="button" class="view-ref">查看</button>
        <button type="button" class="delete-ref">刪除</button>
      </div>
    `;
    row.querySelector('input').addEventListener('change', (event) => {
      if (event.target.checked) editorSelectedKeys.add(key);
      else editorSelectedKeys.delete(key);
      libraryEditorCount.textContent = `${filtered.length} / ${libraryState.items.length} 筆，已選 ${editorSelectedKeys.size} 筆`;
    });
    row.querySelector('.view-ref').addEventListener('click', () => {
      items = [{ ...item, missing: missingFields(item), conflicts: item.conflicts || [] }];
      render();
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    row.querySelector('.delete-ref').addEventListener('click', () => deleteLibraryItem(item, { confirm: true }));
    libraryEditorList.appendChild(row);
  });
}

function visibleEditorItems() {
  const query = librarySearch.value.trim().toLowerCase();
  return sortItems(libraryState.items).filter((item) => {
    if (!query) return true;
    return [item.title, item.containerTitle, item.year, item.doi, item.source, ...(item.authors || [])]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
}

function selectAllEditorItems() {
  visibleEditorItems().forEach((item) => editorSelectedKeys.add(fingerprintItem(item)));
  renderLibraryEditor();
}

function clearEditorSelection() {
  visibleEditorItems().forEach((item) => editorSelectedKeys.delete(fingerprintItem(item)));
  renderLibraryEditor();
}

function applyEditorSelection() {
  selectedRefKeys = new Set(editorSelectedKeys);
  persistSelectedRefs();
  renderLibrarySelector();
  renderLibraryHistory();
  renderLibraryEditor();
  buildSelectedBibliography();
  document.querySelector('.bibliography-builder').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteEditorSelection() {
  const chosen = libraryState.items.filter((item) => editorSelectedKeys.has(fingerprintItem(item)));
  if (!chosen.length) {
    libraryUpdated.textContent = '請先勾選要刪除的文獻。';
    return;
  }
  const ok = window.confirm(`確定要從個人文獻資料庫刪除 ${chosen.length} 筆文獻嗎？這會同步更新瀏覽器暫存。`);
  if (!ok) return;
  for (const item of chosen) {
    await deleteLibraryItem(item, { confirm: false, skipSync: true });
  }
  editorSelectedKeys.clear();
  renderLibrary(libraryState);
  render();
  if (selectedRefKeys.size) buildSelectedBibliography();
  else bibliographyOutput.textContent = bibliographyPlaceholder();
}

async function deleteLibraryItem(item, options = {}) {
  if (options.confirm) {
    const ok = window.confirm(`確定要從個人文獻資料庫刪除「${item.title || '這筆文獻'}」嗎？`);
    if (!ok) return;
  }
  const key = fingerprintItem(item);
  libraryState.items = libraryState.items.filter((existing) => fingerprintItem(existing) !== key);
  selectedRefKeys.delete(key);
  if (items.some((current) => fingerprintItem(current) === key)) items = [];
  libraryState.updatedAt = new Date().toISOString();
  persistSelectedRefs();
  sessionStorage.setItem(cookieKey, JSON.stringify(libraryState));
  renderLibrary(libraryState);
  render();
  if (selectedRefKeys.size) buildSelectedBibliography();
  else bibliographyOutput.textContent = bibliographyPlaceholder();
}

function bibliographyPlaceholder() {
  return '從個人文獻資料庫套用文獻後，按「產出列表」即可在此顯示。';
}

function persistSelectedRefs() {
  sessionStorage.setItem(selectedRefsKey, JSON.stringify([...selectedRefKeys]));
}

async function buildSelectedBibliography() {
  const chosen = sortBibliographyItems(libraryState.items.filter((item) => selectedRefKeys.has(fingerprintItem(item))));
  if (!chosen.length) {
    bibliographyOutput.textContent = bibliographyPlaceholder();
    return;
  }
  bibliographyOutput.textContent = '正在補齊中文文獻英文譯名並產出參考文獻列表...';
  await Promise.all(chosen.map((item) => ensureEnglishTitleTranslation(item)));
  sessionStorage.setItem(cookieKey, JSON.stringify(libraryState));
  bibliographyOutput.textContent = bibliographyListOutput(chosen);
}

function bibliographyListOutput(list) {
  const mode = selectedBibliographyMode();
  const apa = groupedBibliographyText(list, formatApaTemplate);
  const chicago = groupedBibliographyText(list, formatChicagoTemplate);
  if (mode === 'apa') return `【APA References／中國大陸研究格式】\n${apa}`;
  if (mode === 'chicago') return `【Chicago Bibliography／國防雜誌格式】\n${chicago}`;
  return `【Chicago Bibliography／國防雜誌格式】\n${chicago}\n\n【APA References／中國大陸研究格式】\n${apa}`;
}

function groupedBibliographyText(list, formatter) {
  const normalized = list.map(toTraditionalItem);
  if (!document.querySelector('#groupLang').checked) {
    return sortBibliographyItems(normalized).map(formatter).join('\n\n');
  }
  const zh = sortBibliographyItems(normalized.filter(isChinese));
  const foreign = sortBibliographyItems(normalized.filter((item) => !isChinese(item)));
  const sections = [];
  if (zh.length) sections.push(['中文文獻', zh]);
  if (foreign.length) sections.push(['外文文獻', foreign]);
  return sections
    .map(([heading, itemsInGroup]) => `${heading}\n${itemsInGroup.map(formatter).join('\n\n')}`)
    .join('\n\n');
}

function mergeLibraryItems(list) {
  const map = new Map();
  list.forEach((item) => {
    if (!item) return;
    const key = fingerprintItem(item);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      return;
    }
    map.set(key, {
      ...existing,
      ...item,
      savedAt: oldestTimestamp(existing.savedAt, item.savedAt),
      usedAt: newestTimestamp(existing.usedAt, item.usedAt),
      updatedAt: newestTimestamp(existing.updatedAt, item.updatedAt),
      copyCount: Math.max(Number(existing.copyCount || 0), Number(item.copyCount || 0)),
    });
  });
  return [...map.values()];
}

function newestTimestamp(...values) {
  return values.filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || '';
}

function oldestTimestamp(...values) {
  return values.filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0] || '';
}

function preparedBibliographyMarkdown(list, updatedAt) {
  return [
    '# Browser Session Prepared Bibliography',
    '',
    `Updated: ${updatedAt}`,
    '',
    '## APA_Template_Reference',
    '',
    ...list.map((item, index) => `${index + 1}. ${item.citations?.apa || formatApaTemplate(item)}`),
    '',
    '## Chicago_Template_Reference',
    '',
    ...list.map((item, index) => `${index + 1}. ${item.citations?.chicago || formatChicagoTemplate(item)}`),
    '',
  ].join('\n');
}

function renderWarnings(container, item) {
  container.innerHTML = '';
  if (item.missing?.length) {
    container.appendChild(tag(`缺失：${item.missing.map((field) => missingLabels[field] || field).join('、')}`, 'warn'));
    container.appendChild(tag('處理：改用 DOI、題名＋作者與資料庫導向補查；仍缺則保留待人工確認', 'warn'));
  }
  if (item.conflicts?.length) {
    container.appendChild(tag(`Metadata 衝突：${item.conflicts.map((c) => missingLabels[c.field] || c.field).join('、')}`, 'danger'));
    container.appendChild(tag('處理：優先採 DOI／Airiti／期刊頁，其次 Crossref／OpenAlex；衝突值保留提示', 'danger'));
  }
  if (item.corroboratedBy?.length) {
    container.appendChild(tag(`交叉佐證：${item.corroboratedBy.join('、')}`, ''));
  }
  if (isChinese(item) && !item.titleTranslation) {
    container.appendChild(tag('中文文獻：可補英文譯名／漢語拼音以符合範本', 'warn'));
  }
  if (!item.doi && item.type === 'article') {
    container.appendChild(tag('未找到 DOI，建議走 Airiti／Google Scholar 核對', 'warn'));
  }
}

function tag(text, level) {
  const el = document.createElement('span');
  el.className = `tag ${level || ''}`.trim();
  el.textContent = text;
  return el;
}

function metaLine(item) {
  const meta = toTraditionalItem(item);
  const parts = [
    formatAuthors(meta.authors, meta),
    meta.year,
    meta.containerTitle,
    meta.volume ? `Vol. ${meta.volume}` : '',
    meta.issue ? `No. ${meta.issue}` : '',
    meta.pages ? `pp. ${meta.pages}` : '',
    meta.doi ? `DOI: ${meta.doi}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function citationOutputs(item) {
  const meta = toTraditionalItem(item);
  return {
    note: noteOutput(meta),
    bibliography: referenceOutput(meta),
    apa: formatApaTemplate(meta),
    chicago: formatChicagoTemplate(meta),
    json: JSON.stringify(cleanJson(meta), null, 2),
  };
}

function noteOutput(item) {
  const apa = `【APA 夾注】\n${formatApaInText(item)}`;
  const chicago = `【Chicago Style 註腳／國防雜誌】\n${formatChicagoFootnote(item)}`;
  const mode = selectedFormatMode();
  if (mode === 'apa') return apa;
  if (mode === 'chicago') return chicago;
  return `${chicago}\n\n${apa}`;
}

function referenceOutput(item) {
  const apa = `【APA References／中國大陸研究格式】\n${formatApaTemplate(item)}`;
  const chicago = `【Chicago Bibliography／國防雜誌格式】\n${formatChicagoTemplate(item)}`;
  const mode = selectedFormatMode();
  if (mode === 'apa') return apa;
  if (mode === 'chicago') return chicago;
  return `${chicago}\n\n${apa}`;
}

function formatApaInText(item) {
  const author = apaInTextAuthors(item);
  const year = item.year || '[年份待補]';
  const pages = item.pageLocator || (selectedApaVariant() === 'withPage' ? item.pages : '');
  const locator = pages ? `, ${isChinese(item) ? `頁${pages}` : `p. ${pages}`}` : '';
  if (selectedApaVariant() === 'narrative') {
    return isChinese(item) ? `${author}（${year}${pages ? `，頁${pages}` : ''}）` : `${author} (${year}${locator})`;
  }
  return isChinese(item) ? `（${author}，${year}${locator}）` : `(${author}, ${year}${locator})`;
}

function formatChicagoFootnote(item) {
  const authors = isChinese(item) ? zhAuthors(item) : chicagoFootnoteAuthors(item);
  const year = item.year || '[年份待補]';
  const pages = item.pageLocator || item.pages;
  if (selectedChicagoVariant() === 'short') {
    if (isChinese(item)) return `${authors}，〈${item.title || item.containerTitle || '[短題名待補]'}〉${pages ? `，頁${pages}` : ''}。`;
    return `${authors}, “${item.title || item.containerTitle || '[short title]'}”${pages ? `, ${pages}` : ''}.`;
  }
  if (isChinese(item)) {
    if (item.type === 'book') {
      return `${authors}，《${item.title || '[待補書名]'}》（${item.place || '[待補出版地]'}：${item.publisher || '[待補出版社]'}，${year}）${pages ? `，頁${pages}` : ''}。`;
    }
    return `${authors}，〈${item.title || '[待補篇名]'}〉，《${item.containerTitle || '[待補刊名]'}》，${zhVolumeIssue(item)}（${year}）${pages ? `：${pages}` : ''}。`;
  }
  if (item.type === 'book') {
    return `${authors}, ${item.title || '[title]'} (${item.place || '[place]'}: ${item.publisher || '[publisher]'}, ${year})${pages ? `, ${pages}` : ''}.${doiSuffix(item)}`;
  }
  return `${authors}, “${item.title || '[title]'},” ${item.containerTitle || '[journal]'}${item.volume ? ` ${item.volume}` : ''}${item.issue ? `, no. ${item.issue}` : ''} (${year})${pages ? `: ${pages}` : ''}.${doiSuffix(item)}`;
}

function formatApaTemplate(item) {
  if (isChinese(item)) {
    if (item.type === 'book') {
      return `${zhAuthors(item)}，${item.year || '[待補年份]'}，《${item.title || '[待補書名]'}》${item.place ? `，${item.place}` : ''}${item.publisher ? `：${item.publisher}` : '：[待補出版社]'}。${translationHint(item)}`;
    }
    if (item.type === 'chapter') {
      return `${zhAuthors(item)}，${item.year || '[待補年份]'}，〈${item.title || '[待補篇名]'}〉，《${item.containerTitle || '[待補專書名]'}》${item.pages ? `：${item.pages}` : '：[待補頁碼]'}${item.place || item.publisher ? `，${item.place || '[待補出版地]'}：${item.publisher || '[待補出版社]'}` : ''}。${translationHint(item)}`;
    }
    return `${zhAuthors(item)}，${item.year || '[待補年份]'}，〈${item.title || '[待補篇名]'}〉，《${item.containerTitle || '[待補刊名]'}》，${zhVolumeIssue(item)}${item.pages ? `：${item.pages}` : '：[待補頁碼]'}。${translationHint(item)}`;
  }

  if (item.type === 'book') {
    return `${apaReferenceAuthors(item)} (${item.year || '[year]'}). ${sentenceCase(item.title || '[title]')}.${item.place ? ` ${item.place}:` : ''} ${item.publisher || '[publisher]'}.${doiSuffix(item)}`;
  }
  if (item.type === 'chapter') {
    return `${apaReferenceAuthors(item)} (${item.year || '[year]'}). ${sentenceCase(item.title || '[chapter title]')}. In ${titleCase(item.containerTitle || '[book title]')}${item.pages ? ` (pp. ${item.pages})` : ''}.${item.place ? ` ${item.place}:` : ''} ${item.publisher || '[publisher]'}.${doiSuffix(item)}`;
  }
  return `${apaReferenceAuthors(item)} (${item.year || '[year]'}). ${sentenceCase(item.title || '[title]')}. ${titleCase(item.containerTitle || '[journal]')}${enVolumeIssue(item)}${item.pages ? `, ${item.pages}` : ', [pages]'}.${doiSuffix(item)}`;
}

function formatChicagoTemplate(item) {
  if (isChinese(item)) {
    if (item.type === 'book') {
      return `${zhAuthors(item)}，${dateForChicago(item)}。《${item.title || '[待補書名]'}》。${item.place || '[待補出版地]'}：${item.publisher || '[待補出版社]'}。`;
    }
    if (item.type === 'chapter') {
      return `${zhAuthors(item)}，${dateForChicago(item)}。〈${item.title || '[待補篇名]'}〉，《${item.containerTitle || '[待補專書名]'}》。${item.place || '[待補出版地]'}：${item.publisher || '[待補出版社]'}。${item.pages ? `頁${item.pages}。` : ''}`;
    }
    if (item.type === 'web') {
      return `${zhAuthors(item)}，${dateForChicago(item)}。〈${item.title || '[待補篇名]'}〉，《${item.containerTitle || '網站名稱待補'}》，${item.url ? `<${item.url}>` : '<URL待補>'}（檢索日期：${todayTaipei()}）。`;
    }
    return `${zhAuthors(item)}，${dateForChicago(item)}。〈${item.title || '[待補篇名]'}〉，《${item.containerTitle || '[待補刊名]'}》，${zhVolumeIssue(item)}${item.pages ? `，頁${item.pages}` : '，頁[待補]'}。`;
  }

  if (item.type === 'book') {
    return `${enAuthors(item)}, ${dateForChicago(item)}. ${item.title || '[title]'}.${item.place ? ` ${item.place}:` : ''} ${item.publisher || '[publisher]'}.${urlSuffix(item)}`;
  }
  if (item.type === 'web') {
    return `${enAuthors(item)}, ${dateForChicago(item)}. “${item.title || '[title]'}.” ${item.containerTitle || 'Website'}, ${item.url || '<URL>'} (accessed ${todayTaipei('en')}).`;
  }
  return `${enAuthors(item)}, ${dateForChicago(item)}. “${item.title || '[title]'},” ${item.containerTitle || '[journal]'}${item.volume ? `, Vol. ${item.volume}` : ''}${item.issue ? `, No. ${item.issue}` : ''}${item.pages ? `, pp. ${item.pages}` : ', pp. [pages]'}.${urlSuffix(item)}`;
}

function zhAuthors(item) {
  return item.authors?.length ? item.authors.join('、') : '[待補作者]';
}

function enAuthors(item) {
  if (!item.authors?.length) return '[author]';
  if (item.authors.length === 1) return invertEnglishName(item.authors[0]);
  const names = item.authors.map((name, index) => (index === 0 ? invertEnglishName(name) : name));
  if (names.length === 2) return names.join(', and ');
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

function apaReferenceAuthors(item) {
  if (!item.authors?.length) return '[author]';
  const names = item.authors.map(apaName);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  if (names.length <= 20) return `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}`;
  return `${names.slice(0, 19).join(', ')}, ... ${names.at(-1)}`;
}

function apaName(name) {
  if (!name || /[\u3400-\u9fff]/.test(name)) return name || '';
  let family = '';
  let given = '';
  if (name.includes(',')) {
    const parts = name.split(',');
    family = parts[0].trim();
    given = parts.slice(1).join(' ').trim();
  } else {
    const parts = name.trim().split(/\s+/);
    family = parts.pop() || '';
    given = parts.join(' ');
  }
  const initials = given
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(' ');
  return initials ? `${family}, ${initials}` : family;
}

function sentenceCase(text) {
  const value = String(text || '').trim();
  if (!value || /^\[.+\]$/.test(value)) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function titleCase(text) {
  return String(text || '').trim();
}

async function ensureEnglishTitleTranslation(item) {
  if (!item || !isChinese(item) || item.titleTranslation || item.autoTitleTranslation) return item;
  const title = normalizeText(item.title || '');
  if (!title || /^\[.+\]$/.test(title)) return item;
  const cacheKey = compactSearchText(title);
  if (translationCache[cacheKey]) {
    item.autoTitleTranslation = translationCache[cacheKey];
    return item;
  }
  try {
    const translated = await translateChineseTitle(title);
    if (translated) {
      item.autoTitleTranslation = translated;
      translationCache[cacheKey] = translated;
      sessionStorage.setItem(translationCacheKey, JSON.stringify(translationCache));
    }
  } catch {
    item.autoTitleTranslationStatus = 'unavailable';
  }
  return item;
}

async function translateChineseTitle(title) {
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', title);
  url.searchParams.set('langpair', 'zh-TW|en');
  url.searchParams.set('mt', '1');
  const response = await fetch(url);
  if (!response.ok) return '';
  const data = await response.json();
  const text = titleCase(decodeHtmlEntities(normalizeText(data.responseData?.translatedText || '')));
  if (!text || text === title || hasCjk(text)) return '';
  return text;
}

function decodeHtmlEntities(value = '') {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function apaInTextAuthors(item) {
  if (!item.authors?.length) return isChinese(item) ? '作者待補' : 'Author';
  if (isChinese(item)) return item.authors.length > 2 ? `${item.authors[0]}等` : item.authors.join('、');
  const names = item.authors.map((name) => englishSurname(name));
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names[0]} et al.`;
}

function chicagoFootnoteAuthors(item) {
  if (!item.authors?.length) return '[author]';
  if (item.authors.length === 1) return item.authors[0];
  if (item.authors.length === 2) return item.authors.join(' and ');
  return `${item.authors.slice(0, 3).join(', ')} et al.`;
}

function invertEnglishName(name) {
  if (!name || name.includes(',')) return name || '';
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2 || /[\u3400-\u9fff]/.test(name)) return name;
  const family = parts.pop();
  return `${family}, ${parts.join(' ')}`;
}

function englishSurname(name) {
  if (!name) return '';
  if (name.includes(',')) return name.split(',')[0].trim();
  const parts = name.trim().split(/\s+/);
  return parts.at(-1) || name;
}

function formatAuthors(authors, item) {
  if (!authors?.length) return '';
  return isChinese(item) ? authors.join('、') : authors.slice(0, 3).join(', ') + (authors.length > 3 ? ' et al.' : '');
}

function zhVolumeIssue(item) {
  if (item.volume && item.issue) return `${item.volume}（${item.issue}）`;
  if (item.volume) return `第${item.volume}卷`;
  if (item.issue) return `第${item.issue}期`;
  return '[待補卷期]';
}

function enVolumeIssue(item) {
  if (item.volume && item.issue) return `, ${item.volume} (${item.issue})`;
  if (item.volume) return `, ${item.volume}`;
  if (item.issue) return `, (${item.issue})`;
  return '';
}

function doiSuffix(item) {
  return item.doi ? ` https://doi.org/${item.doi}` : item.url ? ` ${item.url}` : '';
}

function urlSuffix(item) {
  if (item.doi) return ` <https://doi.org/${item.doi}>.`;
  if (item.url) return ` <${item.url}>.`;
  return '';
}

function translationHint(item) {
  if (!isChinese(item)) return '';
  const translated = item.titleTranslation || item.autoTitleTranslation;
  if (translated) return ` ${item.titleRomanization || ''} [${translated}].`;
  return ' [英文譯名待補：可按「產出列表」自動嘗試免 Key 補譯]';
}

function dateForChicago(item) {
  return item.issued || item.year || '[待補年份]';
}

function isChinese(item) {
  const blob = [item.language, item.title, item.containerTitle, ...(item.authors || [])].join(' ');
  return /zh|chinese|[\u3400-\u9fff]/i.test(blob);
}

function todayTaipei(locale = 'zh') {
  const date = new Date();
  if (locale === 'en') {
    return date.toLocaleDateString('en-US', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'long', day: 'numeric' });
  }
  return date.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric' });
}

function formatTimestamp(value) {
  if (!value) return '尚未記錄時間';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function usageLabel(item) {
  const count = Number(item.copyCount || 0);
  if (count > 0) return `已複製 ${count} 次`;
  return item.usageReason === 'manual' ? '手動存入' : '已使用';
}

function missingFields(item) {
  const required = item.type === 'book'
    ? ['authors', 'year', 'title', 'publisher', 'place']
    : ['authors', 'year', 'title', 'containerTitle', 'volume', 'issue', 'pages'];
  return required.filter((field) => {
    const value = item[field];
    return Array.isArray(value) ? value.length === 0 : !value;
  });
}

function sortItems(list) {
  const sorted = [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'zh-Hant'));
  if (!document.querySelector('#groupLang').checked) return sorted;
  return sorted.sort((a, b) => Number(isChinese(b)) - Number(isChinese(a)) || sortKey(a).localeCompare(sortKey(b), 'zh-Hant'));
}

function sortKey(item) {
  return item.authors?.[0] || item.title || '';
}

function sortBibliographyItems(list) {
  return [...list].sort((a, b) => {
    const keyA = bibliographySortKey(a);
    const keyB = bibliographySortKey(b);
    return keyA.localeCompare(keyB, 'zh-Hant-u-co-stroke') || String(a.year || '').localeCompare(String(b.year || ''));
  });
}

function bibliographySortKey(item) {
  if (isChinese(item)) return item.authors?.[0] || item.title || '';
  return englishSurname(item.authors?.[0] || item.title || '').toLowerCase();
}

function dedupeItems(list) {
  const map = new Map();
  for (const item of list) {
    const key = item.doi ? `doi:${item.doi}` : `${compactSearchText(item.title || item.sourceInput || '')}:${item.year || ''}`;
    if (!map.has(key)) {
      map.set(key, item);
    } else {
      map.set(key, mergeMetadata(map.get(key), item));
    }
  }
  return [...map.values()];
}

function mergeMetadata(base, supplement) {
  const merged = { ...base };
  const fields = [
    'type',
    'title',
    'subtitle',
    'authors',
    'year',
    'issued',
    'containerTitle',
    'volume',
    'issue',
    'pages',
    'publisher',
    'place',
    'language',
    'doi',
    'isbn',
    'url',
    'openAlexId',
    'semanticId',
    'citedByCount',
    'referenceCount',
  ];
  fields.forEach((field) => {
    const current = merged[field];
    const incoming = supplement?.[field];
    const currentEmpty = Array.isArray(current) ? !current.length : !current;
    const incomingHasValue = Array.isArray(incoming) ? incoming.length > 0 : Boolean(incoming);
    if (
      field === 'title'
      && supplement?.localEvidence
      && incomingHasValue
      && current
      && mergeTitleKey(current).includes(mergeTitleKey(incoming))
      && String(incoming).length <= String(current).length + 4
    ) {
      merged[field] = incoming;
      return;
    }
    if (currentEmpty && incomingHasValue) merged[field] = incoming;
  });
  merged.source = base.source === 'Manual' && supplement?.source ? supplement.source : base.source || supplement?.source;
  merged.confidence = Math.max(Number(base.confidence || 0), Number(supplement?.confidence || 0), 55);
  merged.corroboratedBy = [...new Set([...(base.corroboratedBy || []), ...(supplement?.corroboratedBy || []), supplement?.source].filter(Boolean))];
  merged.localEvidence = Boolean(base.localEvidence || supplement?.localEvidence);
  return merged;
}

function mergeTitleKey(value = '') {
  return compactSearchText(value).replaceAll('提儀', '提議');
}

function expandWithLocalMetadataHints(list = []) {
  return list.flatMap((item) => {
    const hints = localMetadataHints(item).map((hint) => mergeMetadata(item, hint));
    return [item, ...hints];
  });
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
    if (keyMatch && authorMatch) {
      hints.push({
        ...record.meta,
        url: item.url || record.meta.url || '',
        localEvidence: true,
      });
    }
  }

  return hints.map((hint) => ({
    confidence: 92,
    ...hint,
    sourcePriority: hint.sourcePriority || 90,
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
    sourcePriority: 73,
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
    return {
      source: 'Airiti URL 補全',
      sourcePriority: 96,
      type: 'article',
      url: rawUrl,
      language: 'zh-TW',
      raw: { note: '已辨識為 Airiti／華藝來源頁，但 URL 未揭露卷期頁碼。' },
    };
  }
  const full = docId.match(/^\d{8}-(\d{6})-(\d{1,4})-(\d{1,4})-(\d+)-(\d+)(?:-[a-z])?$/i);
  if (full) {
    return {
      source: 'Airiti DocID 補全',
      sourcePriority: 97,
      type: 'article',
      year: full[1].slice(0, 4),
      issued: `${full[1].slice(0, 4)}/${Number(full[1].slice(4, 6))}`,
      volume: full[2],
      issue: full[3],
      pages: normalizePageText(`${full[4]}-${full[5]}`),
      url: rawUrl,
      language: 'zh-TW',
      raw: { docId, note: '由 Airiti DocID 編碼解析日期、卷期與頁碼。' },
    };
  }
  const pageOnly = docId.match(/^\d{8}-(\d{6})-\d{10,14}-\d{10,14}-(\d+)-(\d+)(?:-[a-z])?$/i);
  if (pageOnly) {
    return {
      source: 'Airiti Index 補全',
      sourcePriority: 94,
      type: 'article',
      year: pageOnly[1].slice(0, 4),
      issued: `${pageOnly[1].slice(0, 4)}/${Number(pageOnly[1].slice(4, 6))}`,
      pages: normalizePageText(`${pageOnly[2]}-${pageOnly[3]}`),
      url: rawUrl,
      language: 'zh-TW',
      raw: { docId, note: '由 Airiti Index 編碼解析日期與頁碼；卷期仍需其他來源佐證。' },
    };
  }
  return {
    source: 'Airiti URL 補全',
    sourcePriority: 92,
    type: 'article',
    url: rawUrl,
    language: 'zh-TW',
    raw: { docId, note: '已辨識 Airiti DocID，但格式未含完整卷期頁碼。' },
  };
}

function extractAiritiDocId(url = '') {
  try {
    const parsed = new URL(url);
    const queryId = parsed.searchParams.get('DocID') || parsed.searchParams.get('docid');
    if (queryId) return queryId;
  } catch {
    // Keep regex fallback for relative or already-decoded URLs.
  }
  return url.match(/(?:DocID=|Detail\/|Index\/)([A-Za-z0-9-]{18,})/i)?.[1]
    || url.match(/([0-9]{8}-[0-9]{6}(?:-[0-9]{1,14}){3,5}(?:-[a-z])?)/i)?.[1]
    || '';
}

function fingerprintItem(item) {
  if (item.doi) return `doi:${item.doi.toLowerCase()}`;
  return `${(item.title || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')}:${item.year || ''}`;
}

function cleanJson(item) {
  const clone = { ...item };
  delete clone.raw;
  delete clone.candidates;
  return clone;
}

function renderRoutes(container, routes) {
  container.innerHTML = '';
  routes.slice(0, 18).forEach((route) => {
    const link = document.createElement('a');
    link.className = 'route-link';
    link.href = route.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.innerHTML = `<strong>${escapeHtml(route.name)}</strong><span>${escapeHtml(route.note || '')}</span><span>${escapeHtml(route.priority || '')}</span>`;
    container.appendChild(link);
  });
}

function verificationRoutes(query, variants = []) {
  const terms = [...new Set([query, ...variants].map((term) => toTraditional(normalizeText(term))).filter(Boolean))];
  const primary = terms[0] || query || '';
  const broad = terms.slice(0, 4).join(' OR ');
  const encoded = encodeURIComponent(primary);
  const encodedBroad = encodeURIComponent(broad || primary);
  return [
    { name: 'Airiti Library', priority: 'high', url: `https://www.google.com/search?q=site%3Aairitilibrary.com+${encodedBroad}`, note: '繁體中文與臺灣期刊優先人工核對路徑' },
    { name: 'Google Scholar', priority: 'high', url: `https://scholar.google.com/scholar?q=${encodedBroad}`, note: '作者、篇名與來源頁面查核' },
    { name: 'Crossref', priority: 'live', url: `https://search.crossref.org/?q=${encoded}`, note: 'DOI 與出版資料核對' },
    { name: 'OpenAlex', priority: 'live', url: `https://openalex.org/search?filter=works.default.search:${encoded}`, note: '被引用與參考文獻擴展' },
    { name: 'Semantic Scholar', priority: 'live', url: `https://www.semanticscholar.org/search?q=${encoded}&sort=relevance`, note: '英文題名、作者與期刊欄位補查' },
    { name: 'DataCite', priority: 'live', url: `https://commons.datacite.org/?query=${encoded}`, note: '資料集、報告與 DOI 補充來源' },
    { name: 'Europe PMC', priority: 'oa', url: `https://europepmc.org/search?query=${encoded}`, note: '生命科學與醫學開放文獻補充' },
    { name: 'arXiv', priority: 'oa', url: `https://arxiv.org/search/?query=${encoded}&searchtype=all`, note: '預印本與冷門作者補充搜尋' },
    { name: 'JSTOR', priority: 'database', url: `https://www.jstor.org/action/doBasicSearch?Query=${encoded}`, note: '人文社會科學期刊與專書章節導向' },
    { name: 'Project MUSE', priority: 'database', url: `https://muse.jhu.edu/search?action=search&query=${encoded}`, note: '人文社會科學出版品導向' },
    { name: 'ERIC', priority: 'database', url: `https://eric.ed.gov/?q=${encoded}`, note: '教育學文獻資料庫導向' },
    { name: 'PubMed', priority: 'database', url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encoded}`, note: '醫學與生命科學資料庫導向' },
    { name: 'CNKI', priority: 'database', url: `https://www.google.com/search?q=site%3Acnki.net+${encodedBroad}`, note: '中國大陸期刊與專書資料導向' },
    { name: '萬方數據', priority: 'database', url: `https://www.google.com/search?q=site%3Awanfangdata.com.cn+${encodedBroad}`, note: '中國大陸期刊資料導向' },
    { name: 'WorldCat', priority: 'book', url: `https://search.worldcat.org/search?q=${encoded}`, note: '全球圖書館館藏與專書查找' },
    { name: 'NDDS 全國文獻傳遞服務', priority: 'tw', url: `https://ndds.stpi.niar.org.tw/?lang=zh_TW`, note: '臺灣期刊、館藏與文獻傳遞服務入口' },
    { name: 'Google Books', priority: 'book', url: `https://www.google.com/search?tbm=bks&q=${encoded}`, note: '專書、譯本與 ISBN 補充搜尋' },
    { name: 'Open Library', priority: 'book', url: `https://openlibrary.org/search?q=${encoded}`, note: '專書與開放書目補充搜尋' },
    { name: 'Library of Congress', priority: 'book', url: `https://www.loc.gov/books/?q=${encoded}`, note: '美國國會圖書館書目核對' },
    { name: 'DOAJ', priority: 'oa', url: `https://doaj.org/search/articles?source=%7B%22query%22%3A%7B%22query_string%22%3A%7B%22query%22%3A%22${encoded}%22%7D%7D%7D`, note: '開放取用期刊補充' },
  ];
}

function literatureUrl(item) {
  const directCandidates = [
    item.doi ? `https://doi.org/${item.doi}` : '',
    item.url || '',
    item.openAlexId || '',
    item.semanticId ? `https://www.semanticscholar.org/paper/${item.semanticId}` : '',
  ];
  return directCandidates.find((url) => url && !isSearchPageUrl(url)) || '';
}

function isSearchPageUrl(url = '') {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname;
    return (host === 'google.com' && path.startsWith('/search'))
      || (host === 'scholar.google.com' && path.startsWith('/scholar'))
      || (host === 'search.crossref.org')
      || (host === 'openalex.org' && path === '/search')
      || (host === 'semanticscholar.org' && path.startsWith('/search'))
      || (host === 'commons.datacite.org' && parsed.searchParams.has('query'));
  } catch {
    return true;
  }
}

async function expandItem(item, node) {
  const target = node.querySelector('.expansion');
  const button = node.querySelector('.reverse');
  const label = button?.querySelector('span');
  const originalLabel = label?.textContent || '擴展資料';
  if (label) label.textContent = '搜尋中';
  if (button) button.disabled = true;
  target.innerHTML = '<div class="mini-ref"><span>正在擴展參考文獻與被引用研究...</span></div>';
  try {
    let expansion = await postJson('/api/reverse', item).catch(() => ({ references: [], citations: [] }));
    if (!expansion.references?.length && !expansion.citations?.length) {
      expansion = await clientReverseExpand(item).catch(() => ({ references: [], citations: [] }));
    }
    expansion = normalizeCitationExpansion(item, expansion);
    expansion.related = await relatedContextItems(item);
    renderCitationContext(target, item, expansion);
  } catch (error) {
    renderCitationContext(target, item, { references: [], citations: [] });
  } finally {
    if (label) label.textContent = originalLabel;
    if (button) button.disabled = false;
  }
}

async function clientReverseExpand(item) {
  const [openAlex, semantic, crossref] = await Promise.all([
    clientOpenAlexReverseExpand(item).catch(() => ({ references: [], citations: [] })),
    clientSemanticReverseExpand(item).catch(() => ({ references: [], citations: [] })),
    clientCrossrefReverseExpand(item).catch(() => ({ references: [], citations: [] })),
  ]);
  return {
    references: dedupeItems([...(openAlex.references || []), ...(semantic.references || []), ...(crossref.references || [])]).slice(0, 16),
    citations: dedupeItems([...(openAlex.citations || []), ...(semantic.citations || [])]).slice(0, 16),
  };
}

async function clientCrossrefReverseExpand(item) {
  let doi = item.doi;
  if (!doi && item.title) {
    const resolved = await resolveCrossrefSeed(item).catch(() => null);
    doi = resolved?.doi || '';
  }
  if (!doi) return { references: [], citations: [] };
  const data = await externalJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  const refs = data.message?.reference || [];
  return {
    references: refs.map(clientCrossrefReferenceMap).filter((ref) => ref.title || ref.doi).slice(0, 12),
    citations: [],
  };
}

function clientCrossrefReferenceMap(ref) {
  return {
    source: 'Crossref Reference',
    type: 'article',
    title: normalizeText(ref['article-title'] || ref.articleTitle || ref['series-title'] || ref.unstructured || ''),
    authors: normalizeAuthorList(ref.author || ''),
    year: normalizeText(ref.year || ''),
    containerTitle: normalizeText(ref['journal-title'] || ref.volumeTitle || ''),
    volume: normalizeText(ref.volume || ''),
    issue: normalizeText(ref.issue || ''),
    pages: normalizePageText(ref['first-page'] || ref.pages || ''),
    doi: normalizeText(ref.DOI || ref.doi || '').toLowerCase(),
    url: ref.DOI || ref.doi ? `https://doi.org/${normalizeText(ref.DOI || ref.doi).toLowerCase()}` : '',
    confidence: ref.DOI || ref.doi ? 78 : 62,
  };
}

async function clientOpenAlexReverseExpand(item) {
  let work = null;
  if (item.openAlexId) {
    work = await externalJson(openAlexApiUrl(item.openAlexId));
  } else if (item.doi) {
    work = await externalJson(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(item.doi)}`);
  } else if (item.title) {
    work = await resolveOpenAlexSeed(item).catch(() => null);
  }
  if (!work?.id) return { references: [], citations: [] };
  const referenceUrls = (work.referenced_works || []).slice(0, 8).map(openAlexApiUrl);
  const referenceResults = await Promise.allSettled(referenceUrls.map((url) => externalJson(url)));
  const references = referenceResults
    .filter((result) => result.status === 'fulfilled' && result.value?.id)
    .map((result) => clientOpenAlexMap(result.value));
  const shortId = String(work.id || '').split('/').pop();
  const citedUrl = new URL('https://api.openalex.org/works');
  citedUrl.searchParams.set('filter', `cites:${shortId}`);
  citedUrl.searchParams.set('sort', 'cited_by_count:desc');
  citedUrl.searchParams.set('per-page', '8');
  const cited = await externalJson(citedUrl).catch(() => ({ results: [] }));
  return {
    references,
    citations: (cited.results || []).map(clientOpenAlexMap),
  };
}

async function clientSemanticReverseExpand(item) {
  let resolvedId = item.semanticId;
  if (!resolvedId && !item.doi && item.title) {
    const resolved = await resolveSemanticSeed(item).catch(() => null);
    resolvedId = resolved?.semanticId || '';
  }
  const id = resolvedId
    ? encodeURIComponent(resolvedId)
    : item.doi
      ? `DOI:${encodeURIComponent(item.doi)}`
      : '';
  if (!id) return { references: [], citations: [] };
  const fields = [
    'paperId',
    'title',
    'authors',
    'year',
    'venue',
    'journal',
    'externalIds',
    'url',
    'references.paperId',
    'references.title',
    'references.authors',
    'references.year',
    'references.venue',
    'references.externalIds',
    'references.url',
    'citations.paperId',
    'citations.title',
    'citations.authors',
    'citations.year',
    'citations.venue',
    'citations.externalIds',
    'citations.url',
  ].join(',');
  const data = await externalJson(`https://api.semanticscholar.org/graph/v1/paper/${id}?fields=${fields}`);
  return {
    references: (data.references || []).map(clientSemanticPaperMap).filter((paper) => paper.title),
    citations: (data.citations || []).map(clientSemanticPaperMap).filter((paper) => paper.title),
  };
}

async function resolveOpenAlexSeed(item) {
  const query = [item.title, item.authors?.[0], item.year].filter(Boolean).join(' ');
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', query);
  url.searchParams.set('per-page', '8');
  const data = await externalJson(url);
  const mapped = (data.results || []).map((work) => ({ ...clientOpenAlexMap(work), rawOpenAlexWork: work }));
  return bestSeedMatch(mapped, item, 42)?.rawOpenAlexWork || null;
}

async function resolveSemanticSeed(item) {
  const query = [item.title, item.authors?.[0], item.year].filter(Boolean).join(' ');
  const url = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', '8');
  url.searchParams.set('fields', 'paperId,title,authors,year,venue,journal,externalIds,url');
  const data = await externalJson(url);
  const mapped = (data.data || []).map(clientSemanticPaperMap);
  return bestSeedMatch(mapped, item, 42);
}

async function resolveCrossrefSeed(item) {
  const matches = await clientCrossrefQuery([item.title, item.authors?.[0], item.year].filter(Boolean).join(' '));
  return bestSeedMatch(matches, item, 42);
}

function bestSeedMatch(matches = [], item = {}, minScore = 35) {
  const variants = expandSearchQueries(item.title || item.sourceInput || '', { kind: 'title' });
  const ranked = matches
    .map((candidate) => ({
      ...candidate,
      seedScore: relevanceForCandidate(candidate, item.title || item.sourceInput || '', variants, 'title')
        + (item.year && candidate.year === item.year ? 10 : 0)
        + (hasAuthorOverlap(item, candidate) ? 12 : 0),
    }))
    .sort((a, b) => b.seedScore - a.seedScore);
  return ranked[0]?.seedScore >= minScore ? ranked[0] : null;
}

function sameWorkScore(base = {}, candidate = {}) {
  if (base.doi && candidate.doi && compactSearchText(base.doi) === compactSearchText(candidate.doi)) return 100;
  const title = base.title || base.sourceInput || '';
  const variants = expandSearchQueries(title, { kind: 'title' });
  let score = relevanceForCandidate(candidate, title, variants, 'title');
  if (base.year && candidate.year && String(base.year) === String(candidate.year)) score += 10;
  if (hasAuthorOverlap(base, candidate)) score += 14;
  if (base.containerTitle && candidate.containerTitle && compactSearchText(base.containerTitle) === compactSearchText(candidate.containerTitle)) score += 8;
  return score;
}

function clientSemanticPaperMap(paper) {
  return {
    source: 'Semantic Scholar',
    type: 'article',
    title: normalizeText(paper.title || ''),
    authors: (paper.authors || []).map((a) => normalizeText(a.name || '')).filter(Boolean),
    year: paper.year ? String(paper.year) : '',
    containerTitle: normalizeText(paper.venue || paper.journal?.name || ''),
    doi: normalizeText(paper.externalIds?.DOI || '').toLowerCase(),
    url: normalizeText(paper.url || (paper.paperId ? `https://www.semanticscholar.org/paper/${paper.paperId}` : '')),
    semanticId: normalizeText(paper.paperId || ''),
    confidence: 82,
  };
}

async function relatedContextItems(item) {
  const local = (item.candidates || [])
    .filter((candidate) => fingerprintItem(candidate) !== fingerprintItem(item))
    .filter((candidate) => candidate.title || candidate.doi)
    .slice(0, 10);
  const author = item.authors?.[0] || '';
  const searchTerms = [
    author,
    item.title,
    item.containerTitle ? `${author} ${item.containerTitle}` : '',
    item.sourceInput,
  ].filter(Boolean).slice(0, 4);
  const remoteJobs = [
    author ? clientOpenAlexAuthorQuery(author).catch(() => []) : Promise.resolve([]),
    ...searchTerms.map((term) => clientOpenAlexQuery(term).catch(() => [])),
  ];
  const remote = (await Promise.all(remoteJobs)).flat();
  return rankCandidates([...local, ...remote], item.title || author || item.sourceInput || '', searchTerms, 'title')
    .filter((candidate) => fingerprintItem(candidate) !== fingerprintItem(item))
    .slice(0, 12);
}

function openAlexApiUrl(idOrUrl) {
  const shortId = String(idOrUrl || '').split('/').pop();
  return `https://api.openalex.org/works/${shortId}`;
}

function renderCitationContext(container, item, expansion) {
  const related = (expansion.related || []).slice(0, 12).map(toTraditionalItem);
  const references = (expansion.references || []).slice(0, 10).map(toTraditionalItem);
  const citations = (expansion.citations || []).slice(0, 10).map(toTraditionalItem);
  container.innerHTML = '';
  container.appendChild(citationGraphView(item, references, citations, related, expansion));
  if (!references.length && !citations.length && !related.length) {
    const fallback = document.createElement('div');
    fallback.className = 'mini-ref';
    fallback.innerHTML = '<span>目前沒有足夠的開放 Metadata 建立關聯圖。請使用下方 Google Scholar、OpenAlex、Semantic Scholar 或 Airiti 路徑延伸查核。</span>';
    container.appendChild(fallback);
  }
}

function normalizeCitationExpansion(baseItem, expansion = {}) {
  const references = dedupeItems(expansion.references || [])
    .filter((candidate) => candidate.title || candidate.doi)
    .filter((candidate) => fingerprintItem(candidate) !== fingerprintItem(baseItem))
    .map((candidate) => ({ ...candidate, relationVerified: true, relationType: 'reference' }));
  const allCitations = dedupeItems(expansion.citations || [])
    .filter((candidate) => candidate.title || candidate.doi)
    .filter((candidate) => fingerprintItem(candidate) !== fingerprintItem(baseItem))
    .map((candidate) => ({ ...candidate, relationVerified: true, relationType: 'citation' }));
  const nonSelfCitations = allCitations.filter((candidate) => !hasAuthorOverlap(baseItem, candidate));
  return {
    ...expansion,
    references,
    citations: nonSelfCitations,
    selfCitationsFiltered: allCitations.length - nonSelfCitations.length,
  };
}

function hasAuthorOverlap(a = {}, b = {}) {
  const left = (a.authors || []).map(compactAuthorName).filter(Boolean);
  const right = (b.authors || []).map(compactAuthorName).filter(Boolean);
  if (!left.length || !right.length) return false;
  return left.some((name) => right.some((other) => name === other || name.includes(other) || other.includes(name)));
}

function compactAuthorName(name = '') {
  return compactSearchText(name).replace(/等|etal|jr|junior/gi, '');
}

function citationGraphView(item, references, citations, related, expansion = {}) {
  const graph = document.createElement('div');
  graph.className = 'graph-view';
  const center = toTraditionalItem(item);
  const groups = [
    { type: 'reference', label: '重要前作', emptyLabel: '開放資料庫未提供本文參考文獻', items: references, x: 25, y: 38 },
    { type: 'citation', label: '後續引用', emptyLabel: '開放資料庫未提供其他作者後續引用', items: citations, x: 75, y: 38 },
    { type: 'related', label: '同作者／同主題', emptyLabel: '尚無同作者或同主題關聯', items: related, x: 50, y: 74 },
  ];
  const maxCount = Math.max(1, ...groups.map((group) => group.items.length));
  const nodes = [
    {
      id: 'center',
      title: center.title || center.sourceInput || '目前文獻',
      meta: metaLine(center) || '目前選取文獻',
      type: 'center',
      strength: 1,
      x: 50,
      y: 50,
      vx: 0,
      vy: 0,
      fixed: true,
      indexLabel: '本文',
      typeLabel: '目前文獻',
      items: [...references, ...citations, ...related],
      emptyLabel: '目前沒有可列出的關聯文獻',
      groupNode: false,
    },
  ];
  const edges = groups.map((group) => ({
    from: 'center',
    to: group.type,
    type: group.type,
    strength: group.items.length ? 0.35 + (group.items.length / maxCount) * 0.65 : 0.18,
  }));
  groups.forEach((group) => {
    nodes.push({
      id: group.type,
      title: group.label,
      meta: group.items.length ? `${group.items.length} 筆文獻` : group.emptyLabel,
      type: group.type,
      strength: group.items.length ? 0.35 + (group.items.length / maxCount) * 0.65 : 0.14,
      x: group.x,
      y: group.y,
      vx: 0,
      vy: 0,
      fixed: true,
      indexLabel: String(group.items.length),
      typeLabel: group.label,
      items: group.items,
      emptyLabel: group.emptyLabel,
      groupNode: true,
    });
  });
  graph.innerHTML = `
    <div class="graph-head">
      <strong>引用脈絡 Graph View</strong>
      <span>前作＝本文參考文獻；後續引用＝其他文獻引用本文；同作者／同主題僅作延伸閱讀。</span>
    </div>
    <div class="graph-canvas" aria-label="引用脈絡互動關聯圖">
      <svg class="graph-links" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
      <div class="graph-nodes"></div>
    </div>
    <div class="graph-legend">
      <span class="${references.length ? '' : 'inactive'}"><i class="legend-dot reference"></i>本文參考文獻${references.length ? ` ${references.length}` : ' 0'}</span>
      <span class="${citations.length ? '' : 'inactive'}"><i class="legend-dot citation"></i>其他作者引用本文${citations.length ? ` ${citations.length}` : ' 0'}</span>
      <span class="${related.length ? '' : 'inactive'}"><i class="legend-dot related"></i>延伸閱讀${related.length ? ` ${related.length}` : ' 0'}</span>
      ${expansion.selfCitationsFiltered ? `<span class="inactive"><i class="legend-dot muted-dot"></i>已排除同作者自引 ${expansion.selfCitationsFiltered}</span>` : ''}
    </div>
    <div class="graph-detail" aria-live="polite"></div>
  `;
  hydrateGraphView(graph, nodes, edges);
  return graph;
}

function hydrateGraphView(graph, nodes, edges) {
  const canvas = graph.querySelector('.graph-canvas');
  const svg = graph.querySelector('.graph-links');
  const nodeLayer = graph.querySelector('.graph-nodes');
  const detail = graph.querySelector('.graph-detail');
  let expandedType = null;
  let dragging = null;
  let frame = null;

  function mountNode(node) {
    if (nodeLayer.querySelector(`[data-id="${CSS.escape(node.id)}"]`)) return;
    const el = document.createElement('button');
    el.className = `graph-node ${node.type}${node.itemNode ? ' item-node' : ''}`;
    el.dataset.id = node.id;
    el.title = `${node.title}\n${node.meta}`;
    el.type = 'button';
    el.setAttribute('aria-label', `${node.typeLabel}：${node.title}`);
    el.innerHTML = `<strong>${escapeHtml(node.indexLabel || '')}</strong><span>${escapeHtml(node.typeLabel || '')}</span>`;
    let startPoint = null;
    el.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      dragging = {
        node,
        pointerId: event.pointerId,
        offsetX: rect.width ? ((event.clientX - rect.left) / rect.width) * 100 - node.x : 0,
        offsetY: rect.height ? ((event.clientY - rect.top) / rect.height) * 100 - node.y : 0,
      };
      startPoint = { x: event.clientX, y: event.clientY };
      node.fixed = true;
      el.classList.add('dragging');
      el.setPointerCapture?.(event.pointerId);
      renderGraph();
    });
    el.addEventListener('pointermove', (event) => {
      if (!dragging || dragging.node !== node) return;
      setNodeFromPointer(node, canvas, event, dragging);
      renderGraph();
    });
    el.addEventListener('pointerup', (event) => {
      if (dragging?.node === node) {
        el.releasePointerCapture?.(event.pointerId);
        el.classList.remove('dragging');
        dragging = null;
        node.fixed = node.type === 'center' || Boolean(node.groupNode) || Boolean(node.itemNode);
        const moved = startPoint ? Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y) : 0;
        if (moved < 6) handleGraphNodeClick(node);
        startPoint = null;
      }
    });
    nodeLayer.appendChild(el);
  }

  nodes.forEach(mountNode);

  function handleGraphNodeClick(node) {
    if (node.groupNode) {
      toggleGraphGroup(node);
      return;
    }
    if (node.itemNode) {
      renderGraphDetail(detail, {
        ...node,
        typeLabel: node.typeLabel || '關聯文獻',
        items: node.sourceItem ? [node.sourceItem] : [],
      });
    }
  }

  function toggleGraphGroup(groupNode) {
    if (expandedType === groupNode.type) {
      collapseGraphGroup();
      detail.hidden = true;
      return;
    }
    collapseGraphGroup();
    expandedType = groupNode.type;
    const groupEl = nodeLayer.querySelector(`[data-id="${CSS.escape(groupNode.id)}"]`);
    groupEl?.classList.add('expanded');
    renderGraphDetail(detail, groupNode);
    if (!groupNode.items?.length) {
      renderGraph();
      return;
    }
    const count = Math.min(12, groupNode.items.length);
    groupNode.items.slice(0, count).forEach((item, index) => {
      const angle = (-Math.PI / 2) + (index / Math.max(1, count)) * Math.PI * 2;
      const radius = count > 8 ? 18 : 15;
      const child = {
        id: `${groupNode.type}-item-${index}`,
        title: item.title || '[待補題名]',
        meta: metaLine(item) || item.source || '',
        type: groupNode.type,
        strength: Math.max(0.35, Math.min(1, Number(item.confidence || 66) / 100)),
        x: Math.max(7, Math.min(93, groupNode.x + Math.cos(angle) * radius)),
        y: Math.max(9, Math.min(91, groupNode.y + Math.sin(angle) * radius)),
        vx: 0,
        vy: 0,
        fixed: true,
        indexLabel: graphNodeTitle(item.title || '[待補題名]'),
        typeLabel: [item.year, item.authors?.[0]].filter(Boolean).join(' · ') || groupNode.typeLabel,
        itemNode: true,
        sourceItem: item,
      };
      nodes.push(child);
      edges.push({ from: groupNode.id, to: child.id, type: groupNode.type, strength: child.strength, child: true });
      mountNode(child);
    });
    renderGraph();
  }

  function collapseGraphGroup() {
    if (!expandedType) return;
    nodeLayer.querySelectorAll('.graph-node.expanded').forEach((el) => el.classList.remove('expanded'));
    nodeLayer.querySelectorAll('.graph-node.item-node').forEach((el) => el.remove());
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      if (nodes[index].itemNode) nodes.splice(index, 1);
    }
    for (let index = edges.length - 1; index >= 0; index -= 1) {
      if (edges[index].child) edges.splice(index, 1);
    }
    expandedType = null;
    renderGraph();
  }

  function tick() {
    if (!document.body.contains(graph)) {
      if (frame) cancelAnimationFrame(frame);
      return;
    }
    nodes.forEach((node) => {
      if (node.fixed) return;
      const dx = 50 - node.x;
      const dy = 50 - node.y;
      node.vx += dx * 0.0008;
      node.vy += dy * 0.0008;
      nodes.forEach((other) => {
        if (other === node) return;
        const rx = node.x - other.x;
        const ry = node.y - other.y;
        const distance = Math.max(5, Math.hypot(rx, ry));
        const force = 11 / (distance * distance);
        node.vx += (rx / distance) * force;
        node.vy += (ry / distance) * force;
      });
      node.vx *= 0.9;
      node.vy *= 0.9;
      node.x = Math.max(6, Math.min(94, node.x + node.vx));
      node.y = Math.max(8, Math.min(92, node.y + node.vy));
    });
    renderGraph();
    frame = requestAnimationFrame(tick);
  }

  function renderGraph() {
    nodes.forEach((node) => {
      const el = nodeLayer.querySelector(`[data-id="${CSS.escape(node.id)}"]`);
      if (!el) return;
      el.style.left = `${node.x}%`;
      el.style.top = `${node.y}%`;
    });
    const canvasRect = canvas.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${Math.max(1, canvasRect.width)} ${Math.max(1, canvasRect.height)}`);
    const centerFor = (nodeId) => {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      return node && canvasRect.width && canvasRect.height
        ? { x: (node.x / 100) * canvasRect.width, y: (node.y / 100) * canvasRect.height }
        : null;
    };
    svg.innerHTML = edges.map((edge) => {
      const from = centerFor(edge.from);
      const to = centerFor(edge.to);
      if (!from || !to) return '';
      const width = 0.28 + edge.strength * 0.55;
      return `<line class="${edge.type}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke-width="${width}" />`;
    }).join('');
  }

  renderGraph();
  detail.hidden = true;
  frame = requestAnimationFrame(tick);
}

function graphNodeTitle(title = '') {
  const clean = normalizeText(title);
  if (!clean) return '[待補題名]';
  if (hasCjk(clean)) return clean.length > 18 ? `${clean.slice(0, 17)}...` : clean;
  return clean.length > 28 ? `${clean.slice(0, 27)}...` : clean;
}

function renderGraphDetail(container, node) {
  if (!container || !node) return;
  const items = (node.items || []).slice(0, 12);
  container.hidden = false;
  container.innerHTML = `
    <div class="graph-detail-head">
      <strong>${escapeHtml(node.typeLabel || node.title)}</strong>
      <span>${items.length ? `${items.length} 筆關聯文獻` : escapeHtml(node.emptyLabel || '目前沒有開放資料庫回傳的關聯文獻')}</span>
    </div>
  `;
  if (!items.length) return;
  const list = document.createElement('ol');
  items.forEach((item) => {
    const li = document.createElement('li');
    const url = literatureUrl(item);
    li.innerHTML = `
      <strong>${escapeHtml(item.title || '[待補題名]')}</strong>
      <span>${escapeHtml(metaLine(item) || item.source || '')}</span>
      ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">前往來源</a>` : ''}
    `;
    list.appendChild(li);
  });
  container.appendChild(list);
}

function setNodeFromPointer(node, canvas, event, dragState = {}) {
  const rect = canvas.getBoundingClientRect();
  const nextX = rect.width ? ((event.clientX - rect.left) / rect.width) * 100 - Number(dragState.offsetX || 0) : node.x;
  const nextY = rect.height ? ((event.clientY - rect.top) / rect.height) * 100 - Number(dragState.offsetY || 0) : node.y;
  node.x = Math.max(5, Math.min(95, nextX));
  node.y = Math.max(6, Math.min(94, nextY));
  node.vx = 0;
  node.vy = 0;
}

function renderContextList(container, title, refs) {
  if (!refs.length) return;
  const section = document.createElement('section');
  section.className = 'context-list';
  section.innerHTML = `<h4>${escapeHtml(title)}</h4>`;
  const list = document.createElement('ol');
  refs.forEach((ref) => {
    const li = document.createElement('li');
    const url = literatureUrl(ref);
    li.innerHTML = `
      <strong>${escapeHtml(ref.title || '[待補題名]')}</strong>
      <span>${escapeHtml(metaLine(ref) || ref.source || '')}</span>
      ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">前往來源</a>` : ''}
    `;
    list.appendChild(li);
  });
  section.appendChild(list);
  container.appendChild(section);
}

async function clientDiscover(value) {
  const inferred = clientInferKind(value);
  const query = inferred.value;
  const scope = selectedSearchScope();
  inferred.conditions = parseSearchConditions(query);
  if (inferred.kind === 'footnote') {
    const candidates = rankCandidates(clientParseFootnotes(query), query, [query], 'footnote');
    const best = candidates[0] || clientParseFootnotes(query)[0];
    return {
      input: value,
      inferred: { ...inferred, variants: [query] },
      best,
      candidates,
      conflicts: [],
      missing: missingFields(best),
      routes: verificationRoutes(best?.title || query, [query]),
    };
  }
  const variants = conditionSearchQueries(query, inferred);
  inferred.variants = variants;
  const authorVariantLimit = inferred.conditions?.hasStructuredConditions ? 5 : 10;
  const primaryVariants = variants.slice(0, inferred.kind === 'author' ? authorVariantLimit : 3);
  const jobs = inferred.kind === 'doi'
    ? [clientCrossrefDoi(query), clientOpenAlexDoi(query), clientDataCiteDoi(query)]
    : inferred.kind === 'isbn'
      ? [clientGoogleBooksQuery(query), clientOpenLibraryQuery(query), clientCrossrefQuery(query), clientOpenAlexQuery(query)]
      : primaryVariants.flatMap((variant, index) => {
        const common = [
          clientOpenAlexQuery(variant),
          clientCrossrefQuery(variant),
          clientDataCiteQuery(variant),
          clientEuropePmcQuery(variant),
          clientPubMedQuery(variant),
          clientDoajQuery(variant),
        ];
        const authorJobs = [
          clientOpenAlexAuthorQuery(variant),
          clientCrossrefAuthorQuery(variant),
          clientSemanticAuthorQuery(variant),
          clientGoogleBooksAuthorQuery(variant),
        ];
        const bookJobs = index < 2 ? [clientGoogleBooksQuery(variant), clientOpenLibraryQuery(variant), clientLibraryOfCongressQuery(variant)] : [];
        const scopedCommon = scope === 'book' ? common.slice(0, 2) : common;
        const conditionJobs = index === 0 && inferred.conditions?.hasStructuredConditions
          ? [clientOpenAlexQuery(variant), clientCrossrefQuery(variant)]
          : [];
        const scopedBookJobs = scope === 'article' ? [] : bookJobs;
        const scopedAuthorJobs = scope === 'book' ? authorJobs.slice(3) : scope === 'article' ? authorJobs.slice(0, 3) : authorJobs;
        return inferred.kind === 'author' ? [...conditionJobs, ...scopedAuthorJobs, ...scopedCommon, ...scopedBookJobs] : [...conditionJobs, ...scopedCommon, ...scopedAuthorJobs.slice(0, 1), ...scopedBookJobs];
      });
  const settled = await Promise.allSettled(jobs);
  const manualSeedAllowed = inferred.kind !== 'author';
  const seed = {
    source: 'Manual',
    sourcePriority: 40,
    type: scope === 'book' ? 'book' : 'article',
    title: manualSeedAllowed ? toTraditional(query) : '',
    authors: inferred.kind === 'author' ? [toTraditional(inferred.conditions?.author || query)] : [],
    year: inferred.conditions?.years?.[0] || '',
    confidence: 30,
    sourceInput: query,
  };
  const candidates = rankCandidates(
    expandWithLocalMetadataHints([...(manualSeedAllowed ? [seed] : []), ...settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))]),
    query,
    variants,
    inferred.kind,
  );
  const scopedCandidates = candidates
    .filter((item) => sourceScopeMatches(item, scope))
    .filter((item) => isDisplayableCandidate(item, inferred.kind));
  const best = scopedCandidates[0] || candidates[0] || {
    source: 'Manual',
    type: scope === 'book' ? 'book' : 'article',
    title: manualSeedAllowed ? toTraditional(query) : '',
    authors: inferred.kind === 'author' ? [toTraditional(inferred.conditions?.author || query)] : [],
    year: inferred.conditions?.years?.[0] || '',
    confidence: 30,
    sourceInput: query,
    routes: verificationRoutes(query, variants),
  };
  return {
    input: value,
    inferred,
    searchScope: scope,
    best,
    candidates: scopedCandidates.length ? scopedCandidates : candidates,
    conflicts: [],
    missing: missingFields(best),
    routes: verificationRoutes(best.title || query, variants),
  };
}

function clientInferKind(inputValue) {
  const value = inputValue.trim();
  const doi = value.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0]?.replace(/[.,;，。；）\]\s]+$/u, '') || '';
  if (doi) return { kind: 'doi', value: doi };
  const isbn = value.replace(/[-\s]/g, '').match(/^(97[89])?\d{9}[\dXx]$/);
  if (isbn) return { kind: 'isbn', value: value.replace(/[^\dXx]/g, '') };
  if (/^https?:\/\//i.test(value)) return { kind: 'url', value };
  if (/\n/.test(value) || /\bIbid\.|\bibid\.|同前註|同註|前引書|頁\s*\d|pp?\./i.test(value)) return { kind: 'footnote', value };
  const kind = searchIntentFromValue(value, { kind: 'query' });
  return { kind, value };
}

async function externalJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function clientCrossrefDoi(doi) {
  const data = await externalJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  return data.message ? [clientCrossrefMap(data.message)] : [];
}

async function clientCrossrefQuery(query) {
  const url = new URL('https://api.crossref.org/works');
  url.searchParams.set('query.bibliographic', query);
  url.searchParams.set('rows', '20');
  const data = await externalJson(url);
  return (data.message?.items || []).map(clientCrossrefMap);
}

async function clientCrossrefAuthorQuery(query) {
  const url = new URL('https://api.crossref.org/works');
  url.searchParams.set('query.author', query);
  url.searchParams.set('rows', '30');
  const data = await externalJson(url);
  return (data.message?.items || []).map(clientCrossrefMap);
}

async function fetchSemanticByDoi(doi) {
  const url = new URL(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}`);
  url.searchParams.set('fields', 'paperId,title,authors,year,venue,journal,externalIds,url');
  const data = await externalJson(url);
  return data?.title ? [clientSemanticPaperMap(data)] : [];
}

function clientCrossrefMap(work) {
  return {
    source: 'Crossref',
    sourcePriority: 95,
    type: work.type === 'book' ? 'book' : work.type === 'book-chapter' ? 'chapter' : 'article',
    title: normalizeText(Array.isArray(work.title) ? work.title[0] : work.title),
    subtitle: normalizeText(Array.isArray(work.subtitle) ? work.subtitle[0] : work.subtitle),
    authors: (work.author || []).map((author) => normalizeText([author.given, author.family].filter(Boolean).join(' '))).filter(Boolean),
    year: String(work.published?.['date-parts']?.[0]?.[0] || work.issued?.['date-parts']?.[0]?.[0] || ''),
    issued: '',
    containerTitle: normalizeText(Array.isArray(work['container-title']) ? work['container-title'][0] : work['container-title']),
    volume: normalizeText(work.volume || ''),
    issue: normalizeText(work.issue || ''),
    pages: normalizePageText(work.page || ''),
    publisher: normalizeText(work.publisher || ''),
    language: normalizeText(work.language || ''),
    doi: normalizeText(work.DOI || '').toLowerCase(),
    isbn: normalizeText(Array.isArray(work.ISBN) ? work.ISBN[0] : work.ISBN),
    url: normalizeText(work.URL || ''),
    confidence: 88,
  };
}

async function clientOpenAlexDoi(doi) {
  const data = await externalJson(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`);
  return data?.id ? [clientOpenAlexMap(data)] : [];
}

async function clientOpenAlexQuery(query) {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', query);
  url.searchParams.set('per-page', '20');
  const data = await externalJson(url);
  return (data.results || []).map(clientOpenAlexMap);
}

async function clientOpenAlexAuthorQuery(query) {
  const authorsUrl = new URL('https://api.openalex.org/authors');
  authorsUrl.searchParams.set('search', query);
  authorsUrl.searchParams.set('per-page', '5');
  const authors = await externalJson(authorsUrl);
  const authorIds = (authors.results || [])
    .filter((author) => author.display_name && authorNameMatches(author.display_name, query))
    .map((author) => String(author.id || '').split('/').pop())
    .filter(Boolean);
  const workJobs = authorIds.map(async (authorId) => {
    const byCites = new URL('https://api.openalex.org/works');
    byCites.searchParams.set('filter', `author.id:${authorId}`);
    byCites.searchParams.set('sort', 'cited_by_count:desc');
    byCites.searchParams.set('per-page', '30');
    const byDate = new URL('https://api.openalex.org/works');
    byDate.searchParams.set('filter', `author.id:${authorId}`);
    byDate.searchParams.set('sort', 'publication_date:desc');
    byDate.searchParams.set('per-page', '50');
    const [citedWorks, newestWorks] = await Promise.all([
      externalJson(byCites).catch(() => ({ results: [] })),
      externalJson(byDate).catch(() => ({ results: [] })),
    ]);
    return [...(citedWorks.results || []), ...(newestWorks.results || [])].map(clientOpenAlexMap);
  });
  return (await Promise.all(workJobs)).flat();
}

function clientOpenAlexMap(work) {
  const source = work.primary_location?.source || {};
  const biblio = work.biblio || {};
  return {
    source: 'OpenAlex',
    sourcePriority: 92,
    type: String(work.type || 'article').replace(/-/g, '_'),
    title: normalizeText(work.display_name || work.title || ''),
    authors: (work.authorships || []).map((a) => normalizeText(a.author?.display_name || '')).filter(Boolean),
    year: work.publication_year ? String(work.publication_year) : '',
    issued: work.publication_date || '',
    containerTitle: normalizeText(source.display_name || ''),
    volume: normalizeText(biblio.volume || ''),
    issue: normalizeText(biblio.issue || ''),
    pages: normalizePageText([biblio.first_page, biblio.last_page].filter(Boolean).join('-')),
    publisher: normalizeText(source.host_organization_name || ''),
    language: normalizeText(work.language || ''),
    doi: normalizeText((work.doi || '').replace(/^https?:\/\/doi.org\//i, '')).toLowerCase(),
    url: normalizeText(work.primary_location?.landing_page_url || work.id || ''),
    openAlexId: normalizeText(work.id || ''),
    citedByCount: work.cited_by_count ?? null,
    referenceCount: Array.isArray(work.referenced_works) ? work.referenced_works.length : null,
    confidence: 86,
  };
}

async function clientSemanticAuthorQuery(query) {
  const url = new URL('https://api.semanticscholar.org/graph/v1/author/search');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', '5');
  url.searchParams.set('fields', 'name,paperCount,papers.paperId,papers.title,papers.authors,papers.year,papers.venue,papers.externalIds,papers.url');
  const data = await externalJson(url);
  return (data.data || [])
    .filter((author) => authorNameMatches(author.name || '', query))
    .slice(0, 4)
    .flatMap((author) => (author.papers || []).slice(0, 40).map((paper) => ({
      source: 'Semantic Scholar',
      type: 'article',
      title: normalizeText(paper.title || ''),
      authors: (paper.authors || []).map((a) => normalizeText(a.name || '')).filter(Boolean),
      year: paper.year ? String(paper.year) : '',
      containerTitle: normalizeText(paper.venue || ''),
      doi: normalizeText(paper.externalIds?.DOI || '').toLowerCase(),
      url: normalizeText(paper.url || (paper.paperId ? `https://www.semanticscholar.org/paper/${paper.paperId}` : '')),
      semanticId: normalizeText(paper.paperId || ''),
      confidence: 74,
    })));
}

async function clientSemanticQuery(query) {
  const url = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', '20');
  url.searchParams.set('fields', 'paperId,title,authors,year,venue,journal,externalIds,url');
  const data = await externalJson(url);
  return (data.data || []).map(clientSemanticPaperMap);
}

function authorNameMatches(name, query) {
  const cleanName = compactSearchText(name);
  const variants = expandSearchQueries(query, { kind: 'author' }).map(compactSearchText).filter(Boolean);
  if (!variants.length) return false;
  if (variants.some((variant) => cleanName.includes(variant) || variant.includes(cleanName))) return true;
  const tokens = toTraditional(query).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
  return tokens.length > 0 && tokens.every((token) => cleanName.includes(compactSearchText(token)));
}

async function clientDataCiteDoi(doi) {
  const data = await externalJson(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`);
  return data.data ? [clientDataCiteMap(data.data)] : [];
}

async function clientDataCiteQuery(query) {
  const url = new URL('https://api.datacite.org/dois');
  url.searchParams.set('query', query);
  url.searchParams.set('page[size]', '5');
  const data = await externalJson(url);
  return (data.data || []).map(clientDataCiteMap);
}

function clientDataCiteMap(record) {
  const attrs = record.attributes || {};
  const title = attrs.titles?.find(Boolean)?.title || '';
  return {
    source: 'DataCite',
    type: String(attrs.types?.citeproc || 'article').toLowerCase(),
    title: normalizeText(title),
    authors: (attrs.creators || []).map((creator) => normalizeText(creator.name || '')).filter(Boolean),
    year: attrs.publicationYear ? String(attrs.publicationYear) : '',
    containerTitle: '',
    publisher: normalizeText(attrs.publisher || ''),
    doi: normalizeText(attrs.doi || record.id || '').toLowerCase(),
    url: normalizeText(attrs.url || ''),
    language: normalizeText(attrs.language || ''),
    confidence: 78,
  };
}

async function clientEuropePmcQuery(query) {
  const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  url.searchParams.set('query', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('pageSize', '8');
  const data = await externalJson(url);
  return (data.resultList?.result || []).map((work) => ({
    source: 'Europe PMC',
    type: 'article',
    title: normalizeText(work.title || ''),
    authors: normalizeAuthorList(work.authorString || ''),
    year: normalizeText(work.pubYear || ''),
    issued: normalizeText(work.firstPublicationDate || ''),
    containerTitle: normalizeText(work.journalTitle || work.bookOrReportDetails || ''),
    volume: normalizeText(work.journalVolume || ''),
    issue: normalizeText(work.issue || ''),
    pages: normalizePageText(work.pageInfo || ''),
    doi: normalizeText(work.doi || '').toLowerCase(),
    url: normalizeText(work.doi ? `https://doi.org/${work.doi}` : work.fullTextUrlList?.fullTextUrl?.[0]?.url || ''),
    language: normalizeText(work.language || ''),
    confidence: 76,
  }));
}

async function clientPubMedQuery(query) {
  const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
  searchUrl.searchParams.set('db', 'pubmed');
  searchUrl.searchParams.set('term', query);
  searchUrl.searchParams.set('retmode', 'json');
  searchUrl.searchParams.set('retmax', '8');
  const search = await externalJson(searchUrl);
  const ids = search.esearchresult?.idlist || [];
  if (!ids.length) return [];
  const summaryUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
  summaryUrl.searchParams.set('db', 'pubmed');
  summaryUrl.searchParams.set('id', ids.join(','));
  summaryUrl.searchParams.set('retmode', 'json');
  const summary = await externalJson(summaryUrl);
  return ids.map((id) => summary.result?.[id]).filter(Boolean).map((work) => ({
    source: 'PubMed',
    type: 'article',
    title: normalizeText(work.title || ''),
    authors: (work.authors || []).map((author) => normalizeText(author.name || '')).filter(Boolean),
    year: normalizeText(String(work.pubdate || '').match(/\b(18|19|20)\d{2}\b/)?.[0] || ''),
    issued: normalizeText(work.pubdate || ''),
    containerTitle: normalizeText(work.fulljournalname || work.source || ''),
    volume: normalizeText(work.volume || ''),
    issue: normalizeText(work.issue || ''),
    pages: normalizePageText(work.pages || ''),
    doi: normalizeText((work.articleids || []).find((id) => id.idtype === 'doi')?.value || '').toLowerCase(),
    url: `https://pubmed.ncbi.nlm.nih.gov/${work.uid}/`,
    language: '',
    confidence: 76,
  }));
}

async function clientDoajQuery(query) {
  const url = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?page=1&pageSize=8`;
  const data = await externalJson(url);
  return (data.results || []).map((record) => {
    const bib = record.bibjson || {};
    const journal = bib.journal || {};
    const identifiers = bib.identifier || [];
    return {
      source: 'DOAJ',
      type: 'article',
      title: normalizeText(bib.title || ''),
      authors: (bib.author || []).map((author) => normalizeText(author.name || '')).filter(Boolean),
      year: normalizeText(String(bib.year || bib.month || '').match(/\b(18|19|20)\d{2}\b/)?.[0] || bib.year || ''),
      containerTitle: normalizeText(journal.title || ''),
      volume: normalizeText(journal.volume || ''),
      issue: normalizeText(journal.number || ''),
      pages: normalizePageText([bib.start_page, bib.end_page].filter(Boolean).join('-')),
      doi: normalizeText(identifiers.find((id) => String(id.type).toLowerCase() === 'doi')?.id || '').toLowerCase(),
      url: normalizeText(bib.link?.find((link) => link.url)?.url || ''),
      language: normalizeText(bib.language?.[0] || ''),
      confidence: 74,
    };
  });
}

async function clientGoogleBooksQuery(query) {
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', '6');
  const data = await externalJson(url);
  return (data.items || []).map(clientGoogleBookMap);
}

async function clientGoogleBooksAuthorQuery(query) {
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', `inauthor:${query}`);
  url.searchParams.set('maxResults', '20');
  const data = await externalJson(url);
  return (data.items || []).map(clientGoogleBookMap);
}

async function clientOpenLibraryIsbn(isbn) {
  const clean = normalizeText(isbn).replace(/[^\dXx]/g, '');
  if (!clean) return [];
  const data = await externalJson(`https://openlibrary.org/isbn/${encodeURIComponent(clean)}.json`);
  if (!data?.title) return [];
  return [{
    source: 'Open Library',
    type: 'book',
    title: normalizeText(data.title || ''),
    subtitle: normalizeText(data.subtitle || ''),
    authors: (data.authors || []).map((author) => normalizeText(author.name || author.key || '')).filter(Boolean),
    year: normalizeText(data.publish_date || '').match(/\d{4}/)?.[0] || '',
    issued: normalizeText(data.publish_date || ''),
    publisher: normalizeText(Array.isArray(data.publishers) ? data.publishers[0] : data.publishers),
    place: normalizeText(Array.isArray(data.publish_places) ? data.publish_places[0] : data.publish_places),
    isbn: clean,
    url: `https://openlibrary.org/isbn/${clean}`,
    language: normalizeText(Array.isArray(data.languages) ? data.languages[0]?.key || data.languages[0] : ''),
    confidence: 78,
  }];
}

function clientGoogleBookMap(volume) {
  const info = volume.volumeInfo || {};
  const published = normalizeText(info.publishedDate || '');
  return {
    source: 'Google Books',
    type: 'book',
    title: normalizeText(info.title || ''),
    subtitle: normalizeText(info.subtitle || ''),
    authors: (info.authors || []).map(normalizeText).filter(Boolean),
    year: published.match(/\d{4}/)?.[0] || '',
    issued: published,
    publisher: normalizeText(info.publisher || ''),
    isbn: normalizeText(info.industryIdentifiers?.find((id) => /ISBN/.test(id.type))?.identifier || ''),
    url: normalizeText(info.infoLink || info.canonicalVolumeLink || ''),
    language: normalizeText(info.language || ''),
    confidence: 76,
  };
}

async function clientOpenLibraryQuery(query) {
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '6');
  const data = await externalJson(url);
  return (data.docs || []).map((doc) => ({
    source: 'Open Library',
    type: 'book',
    title: normalizeText(doc.title || ''),
    authors: (doc.author_name || []).map(normalizeText).filter(Boolean),
    year: doc.first_publish_year ? String(doc.first_publish_year) : '',
    publisher: normalizeText(Array.isArray(doc.publisher) ? doc.publisher[0] : doc.publisher),
    place: normalizeText(Array.isArray(doc.publish_place) ? doc.publish_place[0] : doc.publish_place),
    isbn: normalizeText(Array.isArray(doc.isbn) ? doc.isbn[0] : doc.isbn),
    url: doc.key ? `https://openlibrary.org${doc.key}` : '',
    language: normalizeText(Array.isArray(doc.language) ? doc.language[0] : doc.language),
    confidence: 72,
  }));
}

async function clientLibraryOfCongressQuery(query) {
  const url = new URL('https://www.loc.gov/books/');
  url.searchParams.set('fo', 'json');
  url.searchParams.set('q', query);
  url.searchParams.set('c', '8');
  const data = await externalJson(url);
  return (data.results || []).map((record) => {
    const createdPublished = normalizeText(Array.isArray(record.item?.created_published) ? record.item.created_published[0] : record.item?.created_published || '');
    const split = splitPlacePublisher(createdPublished || (Array.isArray(record.publisher) ? record.publisher[0] : record.publisher || ''));
    const publisher = normalizeText(Array.isArray(record.publisher) ? record.publisher[0] : record.publisher || split.publisher);
    return {
      source: 'Library of Congress',
      type: 'book',
      title: normalizeText(record.title || ''),
      authors: normalizeAuthorList(Array.isArray(record.contributor) ? record.contributor.join('; ') : record.contributor || ''),
      year: normalizeText(String(record.date || createdPublished).match(/\b(18|19|20)\d{2}\b/)?.[0] || ''),
      issued: normalizeText(record.date || createdPublished),
      publisher: split.publisher || publisher,
      place: normalizeText(Array.isArray(record.location) ? record.location[0] : record.location || split.place || placeFromPublisher(publisher)),
      url: normalizeText(record.url || ''),
      language: normalizeText(Array.isArray(record.language) ? record.language[0] : record.language || ''),
      raw: { createdPublished },
      confidence: 72,
    };
  });
}

function clientParseFootnotes(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      source: 'Manual',
      type: 'article',
      title: normalizeText(line.replace(/(?:pp?\.|頁)\s*[\d,-]+/i, '')),
      authors: [],
      year: line.match(/\b(19|20)\d{2}\b/)?.[0] || '',
      doi: clientInferKind(line).kind === 'doi' ? clientInferKind(line).value : '',
      original: line,
      pageLocator: normalizePageText(line.match(/(?:pp?\.|頁)\s*[\d,-]+/i)?.[0] || ''),
      confidence: 45,
      routes: verificationRoutes(line),
    }));
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

function toTraditionalItem(item = {}) {
  if (!shouldUseTraditionalOutput()) return { ...item };
  const convert = (value) => (typeof value === 'string' ? toTraditional(value) : value);
  return {
    ...item,
    title: convert(item.title),
    subtitle: convert(item.subtitle),
    authors: Array.isArray(item.authors) ? item.authors.map(convert) : [],
    containerTitle: convert(item.containerTitle),
    publisher: convert(item.publisher),
    place: convert(item.place),
    language: convert(item.language),
    sourceInput: convert(item.sourceInput),
    original: convert(item.original),
  };
}

function hasCjk(value = '') {
  return /[\u3400-\u9fff]/u.test(value);
}

function compactSearchText(value = '') {
  return toTraditional(normalizeText(value)).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function searchBlob(item = {}) {
  return compactSearchText([
    item.title,
    item.subtitle,
    item.containerTitle,
    item.publisher,
    item.year,
    ...(item.authors || []),
  ].filter(Boolean).join(' '));
}

function expandSearchQueries(query, inferred = {}) {
  const original = normalizeText(query);
  const trad = toTraditional(original);
  const simp = toSimplified(trad);
  const aliases = knownAuthorAliases[trad] || knownAuthorAliases[original] || [];
  const compact = hasCjk(trad) ? trad.replace(/\s+/g, '') : '';
  return [...new Set([original, trad, simp, compact, ...aliases].map(normalizeText).filter(Boolean))];
}

function searchIntentFromValue(value, inferred = {}) {
  if (inferred.kind && inferred.kind !== 'query') return inferred.kind;
  const text = normalizeText(value);
  const conditions = parseSearchConditions(text);
  if (conditions.hasStructuredConditions && conditions.author) return 'author';
  const compact = text.replace(/[^\p{L}\p{N}]+/gu, '');
  if (hasCjk(text) && compact.length >= 2 && compact.length <= 5 && !/[《〈「“:：,，.。]/u.test(text)) return 'author';
  if (!hasCjk(text) && /^[\p{L}.'-]+(?:\s+[\p{L}.'-]+){1,3}$/u.test(text)) return 'author';
  if (text.length > 14 || /[《〈「“:：,，.。]/u.test(text)) return 'title';
  return 'query';
}

function authorCandidateMatches(item, variants) {
  const authors = (item.authors || []).map(compactSearchText);
  const queryKeys = variants.map(compactSearchText).filter(Boolean);
  return authors.some((author) => queryKeys.some((query) => authorKeyMatches(author, query)));
}

function authorKeyMatches(author, query) {
  if (!author || !query) return false;
  if (hasCjk(author) || hasCjk(query)) return author.includes(query) || query.includes(author);
  if (author.includes(query)) return true;
  return query.includes(author) && author.length >= Math.max(8, Math.floor(query.length * 0.75));
}

function relevanceForCandidate(item, query, variants, intent) {
  const blob = searchBlob(item);
  const keys = variants.map(compactSearchText).filter(Boolean);
  const conditionScore = scoreSearchConditions(item, query);
  if (!keys.length) return 20;
  if (authorCandidateMatches(item, variants)) return Math.min(100, 88 + conditionScore);
  if (keys.some((key) => key && blob.includes(key))) return Math.min(100, (intent === 'author' ? 72 : 88) + conditionScore);
  const rawTokens = toTraditional(query).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
  const matched = rawTokens.filter((token) => blob.includes(compactSearchText(token))).length;
  const ratio = rawTokens.length ? matched / rawTokens.length : 0;
  return Math.min(100, Math.round(ratio * (intent === 'author' ? 56 : 70) + conditionScore));
}

function scoreSearchConditions(item = {}, query = '') {
  const conditions = parseSearchConditions(query);
  if (!conditions.hasStructuredConditions) return 0;
  let score = 0;
  if (conditions.author && authorCandidateMatches(item, expandSearchQueries(conditions.author, { kind: 'author' }))) score += 18;
  if (conditions.years.length && item.year && conditions.years.includes(String(item.year))) score += 16;
  const sourceBlob = compactSearchText([item.containerTitle, item.publisher, item.source, item.title].filter(Boolean).join(' '));
  const sourceHits = conditions.sourceTerms.filter((term) => sourceBlob.includes(compactSearchText(term))).length;
  score += sourceHits * 10;
  const titleBlob = compactSearchText(item.title || '');
  const titleHits = conditions.titleTerms.filter((term) => titleBlob.includes(compactSearchText(term))).length;
  score += titleHits * 12;
  return Math.min(42, score);
}

function matchesSearchConditions(item = {}, query = '') {
  const conditions = parseSearchConditions(query);
  if (!conditions.hasStructuredConditions) return true;
  if (conditions.author && !authorCandidateMatches(item, expandSearchQueries(conditions.author, { kind: 'author' })) && !searchBlob(item).includes(compactSearchText(conditions.author))) return false;
  if (conditions.years.length && item.year && !conditions.years.includes(String(item.year))) return false;
  const sourceBlob = compactSearchText([item.containerTitle, item.publisher, item.source, item.title].filter(Boolean).join(' '));
  const sourceMismatch = conditions.sourceTerms.length && conditions.sourceTerms.every((term) => !sourceBlob.includes(compactSearchText(term)));
  if (sourceMismatch && (item.containerTitle || item.publisher)) return false;
  const titleBlob = compactSearchText(item.title || '');
  const titleMismatch = conditions.titleTerms.length && conditions.titleTerms.every((term) => !titleBlob.includes(compactSearchText(term)));
  if (titleMismatch && item.title) return false;
  return true;
}

function rankCandidates(list, query, variants, intent) {
  const prepared = list
    .filter((item) => item.title || item.doi || item.isbn)
    .filter(isAllowedDefaultCandidate)
    .map((item) => {
      const relevance = relevanceForCandidate(item, query, variants, intent);
      const base = Number(item.confidence || 55);
      const authorBoost = intent === 'author' && authorCandidateMatches(item, variants) ? 18 : 0;
      const confidence = Math.max(20, Math.min(99, Math.round(base * 0.42 + relevance * 0.5 + authorBoost)));
      return {
        ...toTraditionalItem(item),
        relevance,
        confidence,
        missing: missingFields(item),
        routes: verificationRoutes(item.title || query, variants),
      };
    });
  const hasStrongAuthor = intent === 'author' && prepared.some((item) => authorCandidateMatches(item, variants));
  const filtered = prepared.filter((item) => {
    if (!matchesSearchConditions(item, query)) return false;
    if (intent === 'author' && hasStrongAuthor) return authorCandidateMatches(item, variants);
    return item.relevance >= (intent === 'author' ? 8 : 10);
  });
  return dedupeItems(filtered).sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
}

function isAllowedDefaultCandidate(item = {}) {
  const type = String(item.type || '').toLowerCase();
  const title = normalizeText(item.title || '');
  const source = normalizeText(item.source || '');
  const container = normalizeText(item.containerTitle || '');
  if (/thesis|dissertation|學位|碩士|博士|碩論|博論/i.test([type, title, source, container].join(' '))) return false;
  if (looksLikeThesisCompositeTitle(title)) return false;
  if (!type) return true;
  return /article|journal|book|chapter|monograph|reference|edited_book|posted_content|web/.test(type);
}

function isDisplayableCandidate(item = {}, intent = 'query') {
  if (!item || !item.title) return false;
  const source = normalizeText(item.source || '');
  if (intent === 'author' && source === 'Manual') return false;
  const hasDirectTarget = Boolean(item.doi || item.url || item.openAlexId || item.semanticId || item.isbn);
  const hasBibliographicBody = Boolean(item.containerTitle || item.volume || item.issue || item.pages || item.publisher || item.place);
  const mostlyEmpty = missingFields(item).length >= 4 && !hasDirectTarget && !hasBibliographicBody;
  return !mostlyEmpty;
}

function looksLikeThesisCompositeTitle(title = '') {
  const clean = normalizeText(title);
  if (!clean) return false;
  if (/^[一二三四五六七八九十]、.+[；;]\s*[一二三四五六七八九十]、/u.test(clean)) return true;
  if (/^I[.、]\s*.+[;；]\s*II[.、]/i.test(clean)) return true;
  if (clean.length > 80 && /[；;]/u.test(clean) && /研究|鑑定|普查|成分|分析/u.test(clean)) return true;
  return false;
}

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeAuthorList(value = '') {
  return String(value || '')
    .split(/\s*(?:;|\band\b|、|，)\s*/i)
    .map((author) => normalizeText(author.replace(/\.$/, '')))
    .filter(Boolean);
}

function normalizePageText(value = '') {
  return String(value || '').replace(/\s+/g, '').replace(/[–—]/g, '-').replace(/^pp?\.\s*/i, '').replace(/^頁\s*/u, '');
}

function splitPlacePublisher(value = '') {
  const clean = normalizeText(value).replace(/\s*\b(c|©)\d{4}\b\.?$/i, '').replace(/,\s*\d{4}\.?$/, '').trim();
  const match = clean.match(/^([^:：]+?)\s*[:：]\s*(.+)$/);
  if (!match) return { place: '', publisher: clean };
  return {
    place: normalizePlace(match[1]),
    publisher: normalizeText(match[2].replace(/,\s*\d{4}\.?$/, '')),
  };
}

function placeFromPublisher(value = '') {
  const text = normalizeText(value);
  const hit = publisherPlaceHints.find(([pattern]) => pattern.test(text));
  return hit ? hit[1] : '';
}

function normalizePlace(value = '') {
  return normalizeText(value)
    .replace(/\b[Tt]aipei(?:\s*City)?\b/g, '臺北')
    .replace(/\b[Tt]aoyuan\b/g, '桃園')
    .replace(/\b[Kk]aohsiung\b/g, '高雄')
    .replace(/[,\s]+Taiwan\.?$/i, '')
    .replace(/[，,]\s*臺灣$/, '')
    .replace(/\s*市$/u, '');
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function openExternalUrl(url) {
  if (!url) return false;
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) {
    try {
      opened.opener = null;
    } catch {}
    return true;
  }
  return false;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

function showError(error) {
  items = [{
    source: 'System',
    type: 'report',
    title: '處理失敗',
    authors: [],
    year: '',
    confidence: 0,
    missing: [],
    conflicts: [],
    routes: [],
    raw: { error: error.message },
    sourceInput: input.value,
  }];
  render();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();
  setTheme(sessionStorage.getItem('cookie-theme') || 'light');
  if (storageMode) storageMode.textContent = '瀏覽器暫存';
  loadLibrary();
  render();
});
