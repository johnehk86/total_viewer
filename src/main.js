import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './style.css';

const renderers = {
  pdf: () => import('./renderers/pdf.js').then((m) => m.renderPdf),
  docx: () => import('./renderers/docx.js').then((m) => m.renderDocx),
  hwp: () => import('./renderers/hwp.js').then((m) => m.renderHwp),
  hwpx: () => import('./renderers/hwpx.js').then((m) => m.renderHwpx),
};

const unsupportedHints = {
  doc: '구형 Word 문서(.doc)는 지원하지 않아요. Word에서 .docx로 다시 저장한 뒤 열어 주세요.',
};

const $ = (id) => document.getElementById(id);
const fileInput = $('file-input');
const viewport = $('viewport');
const content = $('content');
const views = { empty: $('empty'), loading: $('loading'), error: $('error') };

const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const DEFAULT_ZOOM = ZOOM_STEPS.indexOf(1);
let zoomIndex = DEFAULT_ZOOM;
let current = null; // handle returned by the active renderer
let pageUnit = '쪽';

function showView(name) {
  for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
}

function setDocInfo(file, type) {
  const open = Boolean(file);
  $('app-title').hidden = open;
  $('doc-info').hidden = !open;
  if (!open) return;
  $('doc-badge').textContent = type ? type.toUpperCase() : '?';
  $('doc-badge').dataset.type = type || '';
  $('doc-name').textContent = file.name;
  $('doc-name').title = file.name;
  $('doc-meta').textContent = formatSize(file.size);
}

function setControlsVisible(visible) {
  $('zoom').hidden = !visible;
  $('page-indicator').hidden = !visible;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function extensionOf(name) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

// Fall back to magic bytes when the extension is missing or wrong.
function sniffType(bytes) {
  const head = String.fromCharCode(...bytes.slice(0, 8));
  if (head.startsWith('%PDF')) return 'pdf';
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return 'hwp'; // OLE/CFB
  if (head.startsWith('PK')) return 'docx';
  return null;
}

function reset() {
  current?.destroy?.();
  current = null;
  content.replaceChildren();
  content.style.zoom = '';
  zoomIndex = DEFAULT_ZOOM;
  updateZoomUi();
  setControlsVisible(false);
  viewport.scrollTop = 0;
}

function goHome() {
  reset();
  setDocInfo(null);
  showView('empty');
  document.title = '문서 뷰어';
}

function showError(message) {
  content.replaceChildren();
  setControlsVisible(false);
  $('error-msg').textContent = message;
  showView('error');
}

async function openFile(file) {
  if (!file) return;
  reset();
  document.title = `${file.name} · 문서 뷰어`;

  let type = extensionOf(file.name);
  setDocInfo(file, renderers[type] ? type : null);
  if (unsupportedHints[type]) return showError(unsupportedHints[type]);

  showView('loading');
  try {
    const buffer = await file.arrayBuffer();
    if (!renderers[type]) {
      type = sniffType(new Uint8Array(buffer));
      setDocInfo(file, type);
    }
    if (!renderers[type]) {
      throw new Error('PDF, Word(.docx), 한글(.hwp, .hwpx) 파일만 열 수 있어요.');
    }

    const render = await renderers[type]();
    current = await render(buffer, content);
    showView(null);

    pageUnit = current.pageUnit || '쪽';
    if (current.pages) {
      $('doc-meta').textContent = `${current.pages}${pageUnit} · ${formatSize(file.size)}`;
    }
    setControlsVisible(true);
    fitToWidth();
    updatePageIndicator();
  } catch (err) {
    console.error(err);
    showError(err.message || String(err));
  }
}

// ───────── Zoom ─────────

function updateZoomUi(scale = ZOOM_STEPS[zoomIndex]) {
  $('zoom-reset').textContent = `${Math.round(scale * 100)}%`;
  $('zoom-out').disabled = zoomIndex === 0;
  $('zoom-in').disabled = zoomIndex === ZOOM_STEPS.length - 1;
}

function setZoom(index) {
  if (!current || index < 0 || index >= ZOOM_STEPS.length || index === zoomIndex) return;
  zoomIndex = index;
  const scale = ZOOM_STEPS[zoomIndex];
  updateZoomUi();
  if (current.setZoom) current.setZoom(scale); // PDF re-renders crisply at the new scale
  else content.style.zoom = scale;
}

// Fixed-layout pages (HWP, DOCX) can be wider than a phone screen; shrink them to fit on open.
// PDF canvases already scale down via CSS max-width.
function fitToWidth() {
  if (current.setZoom) return;
  const pages = [...content.querySelectorAll('.doc-page')];
  const widest = Math.max(0, ...pages.map((p) => p.offsetWidth));
  const style = getComputedStyle(content);
  const available = content.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  if (!widest || widest <= available) return;
  const scale = available / widest;
  content.style.zoom = scale;
  // Park the step index just below the fitted scale so + zooms in from here.
  zoomIndex = Math.max(0, ZOOM_STEPS.findLastIndex((step) => step <= scale));
  updateZoomUi(scale);
}

$('zoom-in').addEventListener('click', () => setZoom(zoomIndex + 1));
$('zoom-out').addEventListener('click', () => setZoom(zoomIndex - 1));
$('zoom-reset').addEventListener('click', () => setZoom(DEFAULT_ZOOM));

// ───────── Page indicator ─────────

function updatePageIndicator() {
  const pages = content.querySelectorAll('.doc-page');
  const indicator = $('page-indicator');
  if (pages.length < 2) {
    indicator.hidden = true;
    return;
  }
  // The current page is the last one whose top edge has passed a third of the way down the view.
  const threshold = viewport.getBoundingClientRect().top + viewport.clientHeight / 3;
  let currentPage = 1;
  pages.forEach((page, i) => {
    if (page.getBoundingClientRect().top <= threshold) currentPage = i + 1;
  });
  indicator.hidden = false;
  indicator.textContent = `${currentPage} / ${pages.length}${pageUnit}`;
}

let indicatorFrame = 0;
viewport.addEventListener('scroll', () => {
  if (!current) return;
  cancelAnimationFrame(indicatorFrame);
  indicatorFrame = requestAnimationFrame(updatePageIndicator);
});

// ───────── File input, drag & drop, shortcuts ─────────

$('home').addEventListener('click', goHome);

fileInput.addEventListener('change', () => {
  openFile(fileInput.files[0]);
  fileInput.value = ''; // allow reopening the same file
});

const overlay = $('drag-overlay');
let dragDepth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth++;
  overlay.hidden = false;
});
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) overlay.hidden = true;
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  overlay.hidden = true;
  openFile(e.dataTransfer?.files[0]);
});

window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === 'o') {
    e.preventDefault();
    fileInput.click();
  } else if (current && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    setZoom(zoomIndex + 1);
  } else if (current && e.key === '-') {
    e.preventDefault();
    setZoom(zoomIndex - 1);
  } else if (current && e.key === '0') {
    e.preventDefault();
    setZoom(DEFAULT_ZOOM);
  }
});

updateZoomUi();
