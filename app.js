const input = document.querySelector('#sourceInput');
const footnoteInput = document.querySelector('#footnoteInput');
const discoverBtn = document.querySelector('#discoverBtn');
const footnoteBtn = document.querySelector('#footnoteBtn');
const clearBtn = document.querySelector('#clearBtn');
const results = document.querySelector('#results');
const emptyState = document.querySelector('#emptyState');
const detectStatus = document.querySelector('#detectStatus');
const candidateList = document.querySelector('#candidateList');
const libraryCount = document.querySelector('#libraryCount');
const libraryUpdated = document.querySelector('#libraryUpdated');
const preparedFilePath = document.querySelector('#preparedFilePath');
const storageMode = document.querySelector('#storageMode');
const googleLoginBtn = document.querySelector('#googleLoginBtn');
const googleConfig = document.querySelector('#googleConfig');
const googleClientInput = document.querySelector('#googleClientInput');
const saveGoogleClient = document.querySelector('#saveGoogleClient');
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
const firebaseConfig = window.RESEARCH_MASTER_FIREBASE_CONFIG || {};
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let firebaseModules = null;
let firebaseUser = null;
const authState = {
  mode: 'cookie',
  cloudFiles: JSON.parse(sessionStorage.getItem('cookie-firebase-files') || '{}'),
};
let selectedRefKeys = new Set(JSON.parse(sessionStorage.getItem(selectedRefsKey) || '[]'));

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

discoverBtn.addEventListener('click', () => discover());
footnoteBtn.addEventListener('click', () => parseFootnotes());
clearBtn.addEventListener('click', () => {
  input.value = '';
  items = [];
  livePayload = null;
  renderDetection(null, 'idle');
  render();
});
input.addEventListener('input', scheduleLiveDetection);
googleLoginBtn.addEventListener('click', handleGoogleLogin);
saveGoogleClient.addEventListener('click', saveGoogleClientId);
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

document.querySelectorAll('input[name="formatMode"], #showJson, #groupLang, #apaVariant, #chicagoVariant').forEach((control) => {
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

function setTheme(theme) {
  document.body.dataset.theme = theme;
  sessionStorage.setItem('cookie-theme', theme);
  themeToggle.checked = theme === 'dark';
  if (window.lucide) window.lucide.createIcons();
}

async function discover() {
  const current = items[0];
  const seed = current ? current.doi || current.title || current.sourceInput || input.value : input.value;
  const chunks = splitInput(seed);
  if (!chunks.length) return;
  setBusy(true, current ? '補全中' : '偵測中');
  try {
    const payload = await runDetection(chunks[0]);
    if (current) {
      const completed = mergeMetadata(current, payload.best || payload.candidates?.[0] || {});
      completed.candidates = payload.candidates || current.candidates || [completed];
      completed.conflicts = conflictReportForCandidate(completed, payload.conflicts || []);
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

async function initGoogleAuth() {
  if (!hasFirebaseConfig()) return null;
  if (firebaseAuth && firebaseDb) return { auth: firebaseAuth, db: firebaseDb };
  firebaseModules = await loadFirebaseModules();
  firebaseApp = firebaseModules.initializeApp(firebaseConfig);
  firebaseAuth = firebaseModules.getAuth(firebaseApp);
  firebaseDb = firebaseModules.getFirestore(firebaseApp);
  firebaseModules.onAuthStateChanged(firebaseAuth, async (user) => {
    firebaseUser = user;
    if (!user) {
      authState.mode = 'cookie';
      storageMode.textContent = 'Cookie 暫存';
      googleLoginBtn.querySelector('span').textContent = '登入帳號';
      renderLibrary(libraryState);
      return;
    }
    authState.mode = 'firebase';
    storageMode.textContent = 'Firebase 雲端同步';
    googleLoginBtn.querySelector('span').textContent = '登出';
    await loadFirebaseLibrary();
    await syncGoogleLibrary();
    renderLibrary(libraryState);
  });
  return { auth: firebaseAuth, db: firebaseDb };
}

async function loadFirebaseModules() {
  if (firebaseModules) return firebaseModules;
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'),
  ]);
  return { ...appModule, ...authModule, ...firestoreModule };
}

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

async function handleGoogleLogin() {
  if (!hasFirebaseConfig()) {
    googleConfig.hidden = !googleConfig.hidden;
    setStorageNotice('Firebase 尚未設定。網站可先用 Cookie 暫存；要開放所有使用者登入，請在 firebase-config.js 填入 Firebase Web App config，並在 Firebase Console 啟用 Google 登入與 Firestore。');
    return;
  }
  try {
    await initGoogleAuth();
    if (firebaseUser) {
      await firebaseModules.signOut(firebaseAuth);
      setStorageNotice('已登出，改用 Cookie／瀏覽器暫存模式。');
      return;
    }
    const provider = new firebaseModules.GoogleAuthProvider();
    await firebaseModules.signInWithPopup(firebaseAuth, provider);
    googleConfig.hidden = true;
  } catch (error) {
    setStorageNotice(`Firebase 登入失敗：${error.message}`);
  }
}

function saveGoogleClientId() {
  if (hasFirebaseConfig()) {
    googleConfig.hidden = true;
    setStorageNotice('Firebase 設定已存在。請點選「登入帳號」開啟 Google 登入視窗。');
    return;
  }
  setStorageNotice('Firebase 尚未設定：請在 firebase-config.js 填入 Firebase config，並把此 GitHub Pages 網域加入 Firebase Authentication 授權網域。');
}

function setStorageNotice(message) {
  storageMode.textContent = 'Cookie 暫存';
  libraryUpdated.textContent = message;
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
    renderDetection({ message: '看起來像頁下註，請貼到下方「註腳解析」欄位還原書目。' }, 'idle');
    return;
  }
  renderDetection({ message: '正在準備搜尋免費開放 API：Crossref、DataCite、Semantic Scholar、Europe PMC、PubMed、DOAJ、Open Library、Library of Congress、Google Books；OpenAlex 僅作免費額度補充，Airiti／Google Scholar 等保留導向路徑。' }, 'loading');
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
  try {
    payload = await getJson(`/api/discover?q=${encodeURIComponent(value)}`);
  } catch (error) {
    payload = await clientDiscover(value);
    payload.warning = `目前使用瀏覽器直連資料庫模式：${error.message}`;
  }
  livePayload = payload;
  return payload;
}

function renderDetection(payload, state) {
  const dot = detectStatus.querySelector('.status-dot');
  dot.className = `status-dot ${state || 'idle'}`;
  candidateList.innerHTML = '';

  if (!payload) {
    detectStatus.querySelector('p').textContent = '尚未輸入。輸入 DOI、學者姓名或篇名後，這裡會即時顯示搜尋狀況。';
    updateMetrics();
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

  const candidates = payload.candidates || [];
  const missing = payload.missing?.length || 0;
  const conflicts = payload.conflicts?.length || 0;
  updateMetrics(payload);
  detectStatus.querySelector('p').textContent =
    state === 'loading'
      ? '正在搜尋資料庫...'
      : `偵測為 ${kindLabel(payload.inferred?.kind)}，找到 ${candidates.length} 筆候選；缺失 ${missing} 欄，衝突 ${conflicts} 處。`;

  if (!candidates.length) {
    candidateList.innerHTML = '<div class="candidate-empty">目前沒有資料庫命中。下方驗證路徑仍會保留 Airiti、Google Scholar 與 Crossref 搜尋入口。</div>';
    return;
  }

  candidates.slice(0, 8).forEach((candidate, index) => {
    const card = document.createElement('button');
    card.className = 'candidate-card';
    card.type = 'button';
    card.innerHTML = `
      <span class="candidate-rank">${index + 1}</span>
      <span class="candidate-main">
        <strong>${escapeHtml(candidate.title || '[待補題名]')}</strong>
        <em>${escapeHtml(metaLine(candidate) || candidate.source || '')}</em>
      </span>
      <span class="candidate-score">${candidate.confidence || 55}%</span>
    `;
    card.addEventListener('click', () => selectCandidate(candidate, payload));
    candidateList.appendChild(card);
  });
}

function updateMetrics(payload = livePayload) {
  const current = items[0];
  stats.itemCount.textContent = String(payload?.candidates?.length || 0);
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
    query: '關鍵字／學者姓名',
  }[kind] || '線索';
}

async function selectCandidate(candidate, payload = livePayload) {
  const item = {
    ...candidate,
    candidates: payload?.candidates || [candidate],
    conflicts: conflictReportForCandidate(candidate, payload?.conflicts || []),
    missing: missingFields(candidate),
    routes: payload?.routes?.length ? payload.routes : verificationRoutes(candidate.title || ''),
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

function splitInput(value) {
  const text = value.trim();
  if (!text) return [];
  if (/\n/.test(text) && !/\b(Ibid\.?|同前註|同註|前引書)|頁\s*\d|pp?\./i.test(text)) {
    return text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  }
  return [text];
}

function setBusy(isBusy, label = '處理中') {
  [discoverBtn, footnoteBtn].forEach((button) => {
    button.disabled = isBusy;
  });
  if (isBusy) {
    discoverBtn.querySelector('span').textContent = label;
  } else {
    discoverBtn.querySelector('span').textContent = '補全缺失欄位';
  }
}

function render() {
  emptyState.hidden = items.length > 0;
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
  node.querySelector('.eyebrow').textContent = `${typeLabels[item.type] || item.type || '文獻'} · ${item.source || 'Manual'}`;
  node.querySelector('h3').textContent = item.title || item.sourceInput || '待補題名';
  node.querySelector('.meta-line').textContent = metaLine(item);
  node.querySelector('.confidence').textContent = `${item.confidence || 55}%`;

  const warnings = node.querySelector('.warnings');
  renderWarnings(warnings, item);

  const output = node.querySelector('.citation-output');
  const tabs = [...node.querySelectorAll('.citation-tabs button')];
  const outputs = citationOutputs(item);
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

  node.querySelector('.reverse').addEventListener('click', () => expandItem(item, node));
  const openButton = node.querySelector('.open-url');
  const directUrl = literatureUrl(item);
  if (directUrl) openButton.href = directUrl;
  else openButton.removeAttribute('href');
  openButton.classList.toggle('disabled', !directUrl);
  openButton.setAttribute('aria-disabled', directUrl ? 'false' : 'true');
  openButton.title = directUrl ? '開啟這筆文獻的 DOI 或來源頁面' : '目前沒有可開啟的文獻網址';
  openButton.addEventListener('click', (event) => {
    event.preventDefault();
    if (!directUrl) return;
    window.location.assign(directUrl);
  });
  renderRoutes(node.querySelector('.routes'), item.routes || []);

  return node;
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
    if (authState.mode === 'firebase' && firebaseUser) await syncGoogleLibrary();
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
  if (authState.mode === 'firebase') {
    libraryUpdated.textContent = summary.updatedAt ? `Firebase 雲端已同步：${new Date(summary.updatedAt).toLocaleString('zh-TW')}` : 'Firebase 雲端同步模式';
    preparedFilePath.textContent = authState.cloudFiles.libraryPath || `Firebase://users/${firebaseUser?.uid || 'current-user'}/libraries/default`;
    renderLibrarySelector();
    renderLibraryHistory();
    renderLibraryEditor();
    return;
  }
  libraryUpdated.textContent = summary.updatedAt ? `Cookie 暫存更新：${new Date(summary.updatedAt).toLocaleString('zh-TW')}，關閉分頁後清除` : 'Cookie 暫存模式：關閉分頁後清除';
  preparedFilePath.textContent = 'Cookie session://prepared-bibliography.md';
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
  const ok = window.confirm(`確定要從個人文獻資料庫刪除 ${chosen.length} 筆文獻嗎？這會同步更新 Cookie 暫存${authState.mode === 'firebase' ? '與 Firebase 雲端資料庫' : ''}。`);
  if (!ok) return;
  for (const item of chosen) {
    await deleteLibraryItem(item, { confirm: false, skipSync: true });
  }
  editorSelectedKeys.clear();
  if (authState.mode === 'firebase' && firebaseUser) await syncGoogleLibrary();
  renderLibrary(libraryState);
  render();
  if (selectedRefKeys.size) buildSelectedBibliography();
  else bibliographyOutput.textContent = '尚未選取文獻。';
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
  if (!options.skipSync && authState.mode === 'firebase' && firebaseUser) await syncGoogleLibrary();
  renderLibrary(libraryState);
  render();
  if (selectedRefKeys.size) buildSelectedBibliography();
  else bibliographyOutput.textContent = '尚未選取文獻。';
}

function persistSelectedRefs() {
  sessionStorage.setItem(selectedRefsKey, JSON.stringify([...selectedRefKeys]));
}

function buildSelectedBibliography() {
  const chosen = sortBibliographyItems(libraryState.items.filter((item) => selectedRefKeys.has(fingerprintItem(item))));
  if (!chosen.length) {
    bibliographyOutput.textContent = '尚未套用文獻。請先到個人文獻資料庫編輯模式勾選資料，並按「套用到輸出列表」。';
    return;
  }
  bibliographyOutput.textContent = bibliographyListOutput(chosen);
}

function bibliographyListOutput(list) {
  const mode = selectedBibliographyMode();
  const apa = groupedBibliographyText(list, formatApaTemplate);
  const chicago = groupedBibliographyText(list, formatChicagoTemplate);
  if (mode === 'apa') return `【APA References／中國大陸研究格式】\n${apa}`;
  if (mode === 'chicago') return `【Chicago Bibliography／國防雜誌格式】\n${chicago}`;
  return `【APA References／中國大陸研究格式】\n${apa}\n\n【Chicago Bibliography／國防雜誌格式】\n${chicago}`;
}

function groupedBibliographyText(list, formatter) {
  if (!document.querySelector('#groupLang').checked) {
    return sortBibliographyItems(list).map(formatter).join('\n\n');
  }
  const zh = sortBibliographyItems(list.filter(isChinese));
  const foreign = sortBibliographyItems(list.filter((item) => !isChinese(item)));
  const sections = [];
  if (zh.length) sections.push(['中文文獻', zh]);
  if (foreign.length) sections.push(['外文文獻', foreign]);
  return sections
    .map(([heading, itemsInGroup]) => `${heading}\n${itemsInGroup.map(formatter).join('\n\n')}`)
    .join('\n\n');
}

async function syncGoogleLibrary() {
  if (!firebaseUser || !firebaseDb || !firebaseModules) return;
  const payload = {
    updatedAt: libraryState.updatedAt || new Date().toISOString(),
    count: libraryState.items.length,
    items: libraryState.items,
    selectedRefKeys: [...selectedRefKeys],
  };
  const ref = firebaseLibraryRef();
  await firebaseModules.setDoc(ref, payload, { merge: true });
  authState.cloudFiles = {
    libraryPath: `Firebase://users/${firebaseUser.uid}/libraries/default`,
    markdownName: `Firebase://users/${firebaseUser.uid}/libraries/default/preparedBibliography`,
  };
  sessionStorage.setItem('cookie-firebase-files', JSON.stringify(authState.cloudFiles));
}

async function loadFirebaseLibrary() {
  if (!firebaseUser || !firebaseDb || !firebaseModules) return;
  const snapshot = await firebaseModules.getDoc(firebaseLibraryRef());
  if (!snapshot.exists()) return;
  const remote = snapshot.data();
  const remoteItems = Array.isArray(remote.items) ? remote.items : [];
  const localItems = Array.isArray(libraryState.items) ? libraryState.items : [];
  const mergedItems = mergeLibraryItems([...remoteItems, ...localItems]);
  libraryState = {
    updatedAt: newestTimestamp(remote.updatedAt, libraryState.updatedAt),
    items: mergedItems,
  };
  if (Array.isArray(remote.selectedRefKeys) && !selectedRefKeys.size) {
    selectedRefKeys = new Set(remote.selectedRefKeys);
    persistSelectedRefs();
  }
  sessionStorage.setItem(cookieKey, JSON.stringify(libraryState));
}

function firebaseLibraryRef() {
  return firebaseModules.doc(firebaseDb, 'users', firebaseUser.uid, 'libraries', 'default');
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
    '# Cookie Prepared Bibliography',
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
  }
  if (item.conflicts?.length) {
    container.appendChild(tag(`Metadata 衝突：${item.conflicts.map((c) => missingLabels[c.field] || c.field).join('、')}`, 'danger'));
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
  const parts = [
    formatAuthors(item.authors, item),
    item.year,
    item.containerTitle,
    item.volume ? `Vol. ${item.volume}` : '',
    item.issue ? `No. ${item.issue}` : '',
    item.pages ? `pp. ${item.pages}` : '',
    item.doi ? `DOI: ${item.doi}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function citationOutputs(item) {
  return {
    note: noteOutput(item),
    bibliography: referenceOutput(item),
    apa: formatApaTemplate(item),
    chicago: formatChicagoTemplate(item),
    json: JSON.stringify(cleanJson(item), null, 2),
  };
}

function noteOutput(item) {
  const apa = `【APA 夾註／In-text Citation】\n${formatApaInText(item)}`;
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
  return `${apa}\n\n${chicago}`;
}

function formatApaInText(item) {
  const author = apaInTextAuthors(item);
  const year = item.year || '[年份待補]';
  const pages = item.pageLocator || (selectedApaVariant() === 'withPage' ? item.pages : '');
  const locator = pages ? `, ${isChinese(item) ? `頁${pages}` : `p. ${pages}`}` : '';
  if (selectedApaVariant() === 'narrative') {
    return isChinese(item) ? `${author}（${year}${pages ? `，頁${pages}` : ''}）` : `${author} (${year}${locator})`;
  }
  return isChinese(item) ? `（${author} ${year}${locator}）` : `(${author}, ${year}${locator})`;
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
  if (item.titleTranslation) return ` ${item.titleRomanization || ''} [${item.titleTranslation}].`;
  return ' [待補英文譯名／漢語拼音]';
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
    const key = item.doi ? `doi:${item.doi}` : `${(item.title || '').toLowerCase().replace(/\W/g, '')}:${item.year || ''}`;
    if (!map.has(key)) map.set(key, item);
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
    if (currentEmpty && incomingHasValue) merged[field] = incoming;
  });
  merged.source = base.source === 'Manual' && supplement?.source ? supplement.source : base.source || supplement?.source;
  merged.confidence = Math.max(Number(base.confidence || 0), Number(supplement?.confidence || 0), 55);
  merged.corroboratedBy = [...new Set([...(base.corroboratedBy || []), ...(supplement?.corroboratedBy || []), supplement?.source].filter(Boolean))];
  return merged;
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

function verificationRoutes(query) {
  const encoded = encodeURIComponent(query);
  return [
    { name: 'Airiti Library', priority: 'high', url: `https://www.airitilibrary.com/Search/alDetailedMesh?DocIDs=${encoded}`, note: '繁體中文與臺灣期刊優先人工核對路徑' },
    { name: 'Google Scholar', priority: 'high', url: `https://scholar.google.com/scholar?q=${encoded}`, note: '引用與被引用脈絡核對' },
    { name: 'Crossref', priority: 'live', url: `https://search.crossref.org/?q=${encoded}`, note: 'DOI 與出版資料核對' },
    { name: 'OpenAlex', priority: 'live', url: `https://openalex.org/search?filter=works.default.search:${encoded}`, note: '被引用與參考文獻擴展' },
    { name: 'Semantic Scholar', priority: 'live', url: `https://www.semanticscholar.org/search?q=${encoded}&sort=relevance`, note: 'AI／英文文獻引用脈絡補充' },
    { name: 'DataCite', priority: 'live', url: `https://commons.datacite.org/?query=${encoded}`, note: '資料集、報告與 DOI 補充來源' },
    { name: 'Europe PMC', priority: 'oa', url: `https://europepmc.org/search?query=${encoded}`, note: '生命科學與醫學開放文獻補充' },
    { name: 'arXiv', priority: 'oa', url: `https://arxiv.org/search/?query=${encoded}&searchtype=all`, note: '預印本與冷門作者補充搜尋' },
    { name: 'JSTOR', priority: 'database', url: `https://www.jstor.org/action/doBasicSearch?Query=${encoded}`, note: '人文社會科學期刊與專書章節導向' },
    { name: 'Project MUSE', priority: 'database', url: `https://muse.jhu.edu/search?action=search&query=${encoded}`, note: '人文社會科學出版品導向' },
    { name: 'ERIC', priority: 'database', url: `https://eric.ed.gov/?q=${encoded}`, note: '教育學文獻資料庫導向' },
    { name: 'PubMed', priority: 'database', url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encoded}`, note: '醫學與生命科學資料庫導向' },
    { name: 'CNKI', priority: 'database', url: `https://kns.cnki.net/kns8s/defaultresult/index?kw=${encoded}`, note: '中國大陸期刊、學位論文與會議資料導向' },
    { name: '萬方數據', priority: 'database', url: `https://s.wanfangdata.com.cn/paper?q=${encoded}`, note: '中國大陸期刊與學位論文資料導向' },
    { name: 'WorldCat', priority: 'book', url: `https://search.worldcat.org/search?q=${encoded}`, note: '全球圖書館館藏與專書查找' },
    { name: '臺灣博碩士論文知識加值系統', priority: 'tw', url: `https://ndltd.ncl.edu.tw/cgi-bin/gs32/gsweb.cgi?o=dwebmge&mode=basic&q=${encoded}`, note: '臺灣學位論文導向' },
    { name: 'NDDS 全國文獻傳遞服務', priority: 'tw', url: `https://ndds.stpi.niar.org.tw/?lang=zh_TW`, note: '臺灣期刊、館藏與文獻傳遞服務入口' },
    { name: 'Google Books', priority: 'book', url: `https://www.google.com/search?tbm=bks&q=${encoded}`, note: '專書、譯本與 ISBN 補充搜尋' },
    { name: 'Open Library', priority: 'book', url: `https://openlibrary.org/search?q=${encoded}`, note: '專書與開放書目補充搜尋' },
    { name: 'Library of Congress', priority: 'book', url: `https://www.loc.gov/books/?q=${encoded}`, note: '美國國會圖書館書目核對' },
    { name: 'DOAJ', priority: 'oa', url: `https://doaj.org/search/articles?source=%7B%22query%22%3A%7B%22query_string%22%3A%7B%22query%22%3A%22${encoded}%22%7D%7D%7D`, note: '開放取用期刊補充' },
  ];
}

function literatureUrl(item) {
  if (item.doi) return `https://doi.org/${item.doi}`;
  if (item.url) return item.url;
  if (item.openAlexId) return item.openAlexId;
  if (item.semanticId) return `https://www.semanticscholar.org/paper/${item.semanticId}`;
  const routes = item.routes?.length ? item.routes : verificationRoutes(item.title || item.sourceInput || '');
  return routes.find((route) => route.name === 'Google Scholar')?.url || routes[0]?.url || '';
}

async function expandItem(item, node) {
  const target = node.querySelector('.expansion');
  target.innerHTML = '<div class="mini-ref"><span>正在擴展參考文獻與被引用研究...</span></div>';
  try {
    const expansion = await postJson('/api/reverse', item);
    target.innerHTML = '';
    renderMiniRefs(target, '重要參考文獻', expansion.references);
    renderMiniRefs(target, '後續被引用研究', expansion.citations);
    if (!expansion.references.length && !expansion.citations.length) {
      target.innerHTML = '<div class="mini-ref"><span>目前資料庫未回傳可用的雙向擴展結果，請使用下方 Airiti／Google Scholar 路徑核對。</span></div>';
    }
  } catch (error) {
    target.innerHTML = '<div class="mini-ref"><span>目前無法由後端擴展引用脈絡。請使用下方 Google Scholar、OpenAlex、Semantic Scholar 或 Airiti 路徑核對引用與被引用研究。</span></div>';
  }
}

function renderMiniRefs(container, title, refs) {
  if (!refs?.length) return;
  const heading = document.createElement('h4');
  heading.textContent = title;
  container.appendChild(heading);
  refs.slice(0, 6).forEach((ref) => {
    const div = document.createElement('div');
    div.className = 'mini-ref';
    div.innerHTML = `<p>${escapeHtml(ref.title || '[待補題名]')}</p><span>${escapeHtml(metaLine(ref))}</span>`;
    container.appendChild(div);
  });
}

async function clientDiscover(value) {
  const inferred = clientInferKind(value);
  const query = inferred.value;
  const jobs = inferred.kind === 'doi'
    ? [clientCrossrefDoi(query), clientOpenAlexDoi(query), clientDataCiteDoi(query)]
    : [
      clientCrossrefQuery(query),
      clientCrossrefAuthorQuery(query),
      clientOpenAlexQuery(query),
      clientOpenAlexAuthorQuery(query),
      clientSemanticAuthorQuery(query),
      clientDataCiteQuery(query),
      clientEuropePmcQuery(query),
      clientPubMedQuery(query),
      clientDoajQuery(query),
      clientGoogleBooksQuery(query),
      clientOpenLibraryQuery(query),
      clientLibraryOfCongressQuery(query),
    ];
  const settled = await Promise.allSettled(jobs);
  const candidates = dedupeItems(settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])))
    .filter((item) => item.title || item.doi || item.isbn)
    .map((item) => ({ ...item, missing: missingFields(item), routes: verificationRoutes(item.title || query) }))
    .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
  const best = candidates[0] || {
    source: 'Manual',
    type: 'article',
    title: query,
    authors: [],
    year: '',
    confidence: 30,
    sourceInput: query,
    routes: verificationRoutes(query),
  };
  return {
    input: value,
    inferred,
    best,
    candidates,
    conflicts: [],
    missing: missingFields(best),
    routes: verificationRoutes(best.title || query),
  };
}

function clientInferKind(inputValue) {
  const value = inputValue.trim();
  const doi = value.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0]?.replace(/[.,;，。；）\]\s]+$/u, '') || '';
  if (doi) return { kind: 'doi', value: doi };
  const isbn = value.replace(/[-\s]/g, '').match(/^(97[89])?\d{9}[\dXx]$/);
  if (isbn) return { kind: 'isbn', value: value.replace(/[^\dXx]/g, '') };
  if (/^https?:\/\//i.test(value)) return { kind: 'url', value };
  return { kind: 'query', value };
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
  url.searchParams.set('rows', '6');
  const data = await externalJson(url);
  return (data.message?.items || []).map(clientCrossrefMap);
}

async function clientCrossrefAuthorQuery(query) {
  const url = new URL('https://api.crossref.org/works');
  url.searchParams.set('query.author', query);
  url.searchParams.set('rows', '10');
  const data = await externalJson(url);
  return (data.message?.items || []).map(clientCrossrefMap);
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
  url.searchParams.set('per-page', '6');
  const data = await externalJson(url);
  return (data.results || []).map(clientOpenAlexMap);
}

async function clientOpenAlexAuthorQuery(query) {
  const authorsUrl = new URL('https://api.openalex.org/authors');
  authorsUrl.searchParams.set('search', query);
  authorsUrl.searchParams.set('per-page', '2');
  const authors = await externalJson(authorsUrl);
  const authorIds = (authors.results || [])
    .filter((author) => author.display_name && authorNameMatches(author.display_name, query))
    .map((author) => String(author.id || '').split('/').pop())
    .filter(Boolean);
  const workJobs = authorIds.map(async (authorId) => {
    const worksUrl = new URL('https://api.openalex.org/works');
    worksUrl.searchParams.set('filter', `author.id:${authorId}`);
    worksUrl.searchParams.set('sort', 'cited_by_count:desc');
    worksUrl.searchParams.set('per-page', '12');
    const works = await externalJson(worksUrl);
    return (works.results || []).map(clientOpenAlexMap);
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
  url.searchParams.set('limit', '3');
  url.searchParams.set('fields', 'name,paperCount,papers.paperId,papers.title,papers.authors,papers.year,papers.venue,papers.externalIds,papers.url');
  const data = await externalJson(url);
  return (data.data || [])
    .filter((author) => authorNameMatches(author.name || '', query))
    .slice(0, 2)
    .flatMap((author) => (author.papers || []).slice(0, 16).map((paper) => ({
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

function authorNameMatches(name, query) {
  const normalize = (value) => normalizeText(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const cleanName = normalize(name);
  const tokens = normalizeText(query).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
  if (!tokens.length) return false;
  return tokens.every((token) => cleanName.includes(normalize(token)));
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
  return (data.items || []).map((volume) => {
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
  });
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
  return (data.results || []).map((record) => ({
    source: 'Library of Congress',
    type: 'book',
    title: normalizeText(record.title || ''),
    authors: normalizeAuthorList(Array.isArray(record.contributor) ? record.contributor.join('; ') : record.contributor || ''),
    year: normalizeText(String(record.date || '').match(/\b(18|19|20)\d{2}\b/)?.[0] || ''),
    issued: normalizeText(record.date || ''),
    publisher: normalizeText(Array.isArray(record.publisher) ? record.publisher[0] : record.publisher || ''),
    place: normalizeText(Array.isArray(record.location) ? record.location[0] : record.location || ''),
    url: normalizeText(record.url || ''),
    language: normalizeText(Array.isArray(record.language) ? record.language[0] : record.language || ''),
    confidence: 70,
  }));
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
  googleClientInput.value = hasFirebaseConfig() ? firebaseConfig.projectId : '';
  if (hasFirebaseConfig()) initGoogleAuth().catch((error) => setStorageNotice(`Firebase 初始化失敗：${error.message}`));
  loadLibrary();
  render();
});
