// app.js — client-side CSV loader + search using PapaParse
let data = [];
let headers = [];
let headerMap = {}; // map original header -> normalized key (date/place/details/transport/recommend)
// Files to load and merge
const dataFiles = ['Book1.csv', 'places_extra.csv'];
// Synthetic source column header (Thai)
const SOURCE_COL = 'แหล่งข้อมูล';
// Friendly labels for source filenames (used in the UI). Update these to change displayed labels.
const sourceLabelMap = {
  'Book1.csv': 'สถานที่',
  'places_extra.csv': 'ข้อมูลเสริม'
};
const sourceFilter = document.getElementById('sourceFilter');
const sourceTabs = document.getElementById('sourceTabs');

// Maps for per-source data
const sourceHeadersMap = {}; // source -> headers array
const sourceRowsMap = {}; // source -> rows array
let currentSource = '__any__';

const columnSelect = document.getElementById('columnSelect');
const queryInput = document.getElementById('query');
const wholeWord = document.getElementById('wholeWord');
const thead = document.getElementById('thead');
const tbody = document.getElementById('tbody');
const stats = document.getElementById('stats');
const dateFilter = document.getElementById('dateFilter');
const zoneFilter = document.getElementById('zoneFilter');
const placeFilter = document.getElementById('placeFilter');

function showStats(rowsCount) {
  if (!stats) return;
  stats.classList.remove('hidden');
  // Thai: แถวทั้งหมด / แสดงผลที่ตรงกัน
  const shown = tbody ? tbody.rows.length : 0;
  stats.textContent = `แถวทั้งหมด: ${rowsCount} — แสดงผลที่ตรงกัน: ${shown}`;
}

function renderTable(rows) {
  // If the combined table elements are not present (we're using per-source tables), bail out
  if (!thead || !tbody) return;
  // Render header
  thead.innerHTML = '';
  tbody.innerHTML = '';
  if (!headers.length) return;
  const tr = document.createElement('tr');
  headers.forEach(h => {
    // Do not render the synthetic source column in the table display
    if (h === SOURCE_COL) return;
    const th = document.createElement('th');
    const key = (headerMap && headerMap[h]) ? headerMap[h] : 'other';
    th.textContent = h;
    // add a semantic class for responsive hiding (e.g. col-date, col-place)
    th.classList.add('col-' + key);
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  // Render rows
  rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    tr.tabIndex = 0; // make row focusable for keyboard users
    tr.classList.add('data-row');
    headers.forEach(h => {
      // Skip rendering the synthetic source column
      if (h === SOURCE_COL) return;
      const td = document.createElement('td');
      const cell = row[h] ?? '';
      // attach a column class so CSS can hide/show columns responsively
      const key = (headerMap && headerMap[h]) ? headerMap[h] : 'other';
      td.classList.add('col-' + key);
      td.innerHTML = renderCell(cell, document.getElementById('query').value, h);
      tr.appendChild(td);
    });
    // Attach click handler to open detail modal (mobile friendly)
    tr.addEventListener('click', () => openDetailModal(row));
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openDetailModal(row); });
    // apply row-level emphasis class if row contains Must or Try
    const rc = getRowEmphasis(row);
    if (rc) tr.classList.add(rc);
    tbody.appendChild(tr);
  });
  showStats(data.length);
  // enforce JS fallback for mobile compact mode (in case media queries don't trigger on some devices)
  if (typeof enforceMobileCompact === 'function') enforceMobileCompact();
}

// Modal helpers: open/close detail view for a row
const detailModal = document.getElementById('detailModal');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');

function openDetailModal(row){
  if (!detailModal || !modalContent) return;
  // mark modal with source class for source-specific styling (e.g., places_extra => 'source-extra')
  if (row && row._source) {
    if (row._source === 'places_extra.csv' || row._source === 'places_extra') {
      detailModal.classList.add('source-extra');
    } else {
      detailModal.classList.remove('source-extra');
    }
  } else {
    detailModal.classList.remove('source-extra');
  }
  // build a description list of header -> value
  const dl = document.createElement('dl');
  headers.forEach(h => {
    if (h === SOURCE_COL) return; // skip source col
    const dt = document.createElement('dt'); dt.textContent = h;
    const dd = document.createElement('dd');
    // preserve original newlines and basic HTML
    const v = row[h] ?? '';
    // Use a container with pre-wrap to preserve newlines
  const wrapper = document.createElement('div');
  wrapper.style.whiteSpace = 'pre-wrap';
  wrapper.innerHTML = renderCell(v, queryInput ? queryInput.value : '', h);
    dd.appendChild(wrapper);
    // If this header maps to a place, add a copy button to copy the place name to clipboard
    try {
      const key = headerMap && headerMap[h] ? headerMap[h] : null;
      const textVal = String(v || '');
      if (key === 'place' && textVal.trim()) {
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn btn-ghost btn-small';
        copyBtn.style.marginLeft = '8px';
        copyBtn.textContent = 'คัดลอกชื่อสถานที่';
        copyBtn.setAttribute('aria-label', 'คัดลอกชื่อสถานที่');
        copyBtn.addEventListener('click', async (e) => {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(textVal);
            } else {
              // fallback
              const ta = document.createElement('textarea');
              ta.value = textVal;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
            }
            const prev = copyBtn.textContent;
            copyBtn.textContent = 'คัดลอกแล้ว';
            setTimeout(()=> { copyBtn.textContent = prev; }, 1500);
          } catch (err) {
            console.error('copy failed', err);
          }
        });
        dd.appendChild(copyBtn);
      }
    } catch (e) { /* ignore errors */ }
    dl.appendChild(dt); dl.appendChild(dd);
  });
  modalContent.innerHTML = '';
  modalContent.appendChild(dl);
  detailModal.classList.remove('hidden');
  detailModal.setAttribute('aria-hidden', 'false');
  // focus close button for accessibility
  if (modalClose) modalClose.focus();
}

function closeDetailModal(){
  if (!detailModal) return;
  detailModal.classList.add('hidden');
  detailModal.setAttribute('aria-hidden', 'true');
}

if (modalClose) modalClose.addEventListener('click', closeDetailModal);
// close when tapping outside modal-inner
if (detailModal) detailModal.addEventListener('click', (e)=>{ if (e.target === detailModal) closeDetailModal(); });
// close on Escape
document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeDetailModal(); });

function applySearch() {
  const q = queryInput.value.trim();
  const isWhole = wholeWord ? wholeWord.checked : false;
  const qLower = q.toLowerCase();
  const selected = columnSelect ? columnSelect.value : '__any__';
  const dateVal = dateFilter ? dateFilter.value : '__any__';
  const zoneVal = zoneFilter ? zoneFilter.value : '__any__';
  const placeVal = placeFilter ? placeFilter.value.trim().toLowerCase() : '';

  // pick base rows depending on current source
  const baseRows = (currentSource === '__any__') ? data : (sourceRowsMap[currentSource] || []);

  const filtered = baseRows.filter(row => {
    // Apply date filter if present
    if (dateVal && dateVal !== '__any__') {
      const rowDate = (row._norm && row._norm.date) ? row._norm.date : (row[headers[0]] || '');
      if (String(rowDate).trim() !== String(dateVal).trim()) return false;
    }
    // Apply zone filter if present
    if (zoneVal && zoneVal !== '__any__') {
      const rowZone = (row._norm && row._norm.zone) ? row._norm.zone : (row[headers[1]] || '');
      if (String(rowZone).trim() !== String(zoneVal).trim()) return false;
    }
    // Apply place filter if present
    if (placeVal) {
      const rp = (row._norm && row._norm.place) ? row._norm.place.toLowerCase() : '';
      const matchPlaceAny = headers.some(h => (String(row[h] || '').toLowerCase().includes(placeVal)));
      if (!(rp.includes(placeVal) || matchPlaceAny)) return false;
    }

    // If no query, row passed filters — include
    if (!q) return true;

    // Otherwise apply text query across selected column(s)
    const searchIn = (h) => {
      const v = (row[h] ?? '').toString();
      if (isWhole) return v.toLowerCase() === qLower;
      return v.toLowerCase().includes(qLower);
    };
    if (selected && selected !== '__any__') {
      return searchIn(selected);
    }
    return headers.some(h => searchIn(h));
  });
  // If per-source tables are present, update them instead of the combined table
  if (document.getElementById('perSourceTables')) renderPerSourceTables();
  else renderTable(filtered);
}

// Filter helper for a given set of rows (used to render per-source tables)
function filterRowsForSource(rows){
  const q = queryInput.value.trim();
  const isWhole = wholeWord ? wholeWord.checked : false;
  const qLower = q.toLowerCase();
  const dateVal = dateFilter ? dateFilter.value : '__any__';
  const zoneVal = zoneFilter ? zoneFilter.value : '__any__';
  const placeVal = placeFilter ? placeFilter.value.trim().toLowerCase() : '';

  return rows.filter(row => {
    if (dateVal && dateVal !== '__any__'){
      const rowDate = (row._norm && row._norm.date) ? row._norm.date : (row[headers[0]] || '');
      if (String(rowDate).trim() !== String(dateVal).trim()) return false;
    }
    if (zoneVal && zoneVal !== '__any__'){
      const rowZone = (row._norm && row._norm.zone) ? row._norm.zone : (row[headers[1]] || '');
      if (String(rowZone).trim() !== String(zoneVal).trim()) return false;
    }
    if (placeVal){
      const rp = (row._norm && row._norm.place) ? row._norm.place.toLowerCase() : '';
      const matchPlaceAny = Object.keys(row).some(h => (String(row[h] || '').toLowerCase().includes(placeVal)));
      if (!(rp.includes(placeVal) || matchPlaceAny)) return false;
    }
    if (!q) return true;
    const searchIn = (h) => {
      const v = (row[h] ?? '').toString();
      if (isWhole) return v.toLowerCase() === qLower;
      return v.toLowerCase().includes(qLower);
    };
    // search across the source's own headers
    const hdrs = Object.keys(row).filter(k=>k !== '_norm' && k !== '_source');
    return hdrs.some(h => searchIn(h));
  });
}

function renderPerSourceTables(){
  const container = document.getElementById('perSourceTables');
  if (!container) return;
  container.innerHTML = '';
  // iterate sources in sourceRowsMap
  Object.keys(sourceRowsMap).forEach(src => {
    const hdrs = sourceHeadersMap[src] || [];
    const rows = sourceRowsMap[src] || [];
    const filtered = filterRowsForSource(rows);

    const section = document.createElement('section');
    section.className = 'source-section';
    const title = document.createElement('h3');
    title.textContent = src;
    section.appendChild(title);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'table-scroll';
    const table = document.createElement('table');
    table.className = 'source-table';
    const theadEl = document.createElement('thead');
    const tr = document.createElement('tr');
    hdrs.forEach(h => {
      if (h === SOURCE_COL) return;
      const th = document.createElement('th');
      const key = (headerMap && headerMap[h]) ? headerMap[h] : 'other';
      th.textContent = h;
      th.classList.add('col-' + key);
      tr.appendChild(th);
    });
    theadEl.appendChild(tr);
    table.appendChild(theadEl);

    const tbodyEl = document.createElement('tbody');
    filtered.forEach(r => {
      const trr = document.createElement('tr');
      hdrs.forEach(h => {
        if (h === SOURCE_COL) return;
        const td = document.createElement('td');
        const key = (headerMap && headerMap[h]) ? headerMap[h] : 'other';
        td.classList.add('col-' + key);
        td.innerHTML = renderCell(r[h] ?? '', queryInput.value, h);
        trr.appendChild(td);
      });
      trr.addEventListener('click', ()=> openDetailModal(r));
      // apply row-level emphasis class if row contains Must or Try
      const rc2 = getRowEmphasis(r);
      if (rc2) trr.classList.add(rc2);
      tbodyEl.appendChild(trr);
    });
    table.appendChild(tbodyEl);
    tableWrap.appendChild(table);
    section.appendChild(tableWrap);
    container.appendChild(section);
  });
  // also enforce mobile compact after rendering per-source tables
  if (typeof enforceMobileCompact === 'function') enforceMobileCompact();
}

// JS fallback to hide non-essential columns on devices that don't trigger media queries
function enforceMobileCompact(){
  try{
    const shouldCompact = window.innerWidth <= 880;
    if (shouldCompact) document.body.classList.add('mobile-compact');
    else document.body.classList.remove('mobile-compact');
  }catch(e){ /* ignore */ }
}

// keep fallback in sync on resize
window.addEventListener('resize', enforceMobileCompact);
// also call once immediately in case tables already present
window.addEventListener('load', enforceMobileCompact);

function loadParsed(result) {
  // result.data is array of objects (if header) or arrays
  if (!result || !result.data) return;
  // PapaParse may include an extra empty row at end — filter
  let parsed = result.data.filter(r => {
    if (!r) return false;
    // if r is array
    if (Array.isArray(r)) return r.some(v => v !== null && v !== '');
    return Object.values(r).some(v => v !== null && v !== '');
  });
  // Remove trailing/embedded metadata rows (the CSV contains another table later with headers like
  // 'สถานที่ (พินภาษาจีน)', 'ค่าเข้าโดยประมาณ') that should not be treated as itinerary rows.
  const metaKeywords = ['สถานที่ (พิน', 'ค่าเข้า', 'หมายเหตุ', 'พินภาษาจีน'];
  parsed = parsed.filter(r => {
    const vals = Array.isArray(r) ? r.map(String) : Object.values(r).map(String);
    const joined = vals.join(' ').toLowerCase();
    // if any meta keyword appears, drop the row
    for (const k of metaKeywords) if (joined.includes(k)) return false;
    // also drop rows where every cell matches a known header string (defensive)
    if (headers && headers.length && vals.every(v => headers.includes(v))) return false;
    return true;
  });
  if (!parsed.length) {
    alert('ไม่พบข้อมูลในไฟล์ CSV');
    return;
  }
  // If parsed rows are arrays, convert to objects using first row
  if (Array.isArray(parsed[0]) && result.meta && result.meta.fields === undefined) {
    // first row assumed to be header
    const headerRow = parsed[0];
    headers = headerRow.map(h => String(h));
    data = parsed.slice(1).map(arr => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = arr[i] ?? '');
      return obj;
    });
  } else {
    headers = result.meta && result.meta.fields ? result.meta.fields.map(f => String(f)) : Object.keys(parsed[0]);
    data = parsed.map(r => r);
  }

  // Build headerMap (map long header names to normalized keys for easier filters)
  headerMap = {};
  headers.forEach(h => {
    const key = detectHeaderKey(h) || null;
    headerMap[h] = key;
  });

  // Normalize rows: add a _norm map with keys like date/place/details/transport/recommend
  data = data.map(row => {
    const out = {};
    // keep original column keyed values
    headers.forEach(h => out[h] = row[h] ?? '');
    out._norm = {};
    headers.forEach(h => {
      const k = headerMap[h];
      if (k) out._norm[k] = String(row[h] ?? '').trim();
    });
    return out;
  });
  populateColumnSelect();
  populateDateFilter();
  populateZoneFilter();
  // If per-source container exists, render per-source tables; otherwise render combined table
  if (document.getElementById('perSourceTables')) renderPerSourceTables();
  else renderTable(data);
}

function detectHeaderKey(h){
  if (!h) return null;
  const s = String(h).toLowerCase();
  if (s.includes('วันที่') || s.includes('date') || s.includes('🗓')) return 'date';
  if (s.includes('สถานที่') || s.includes('place') || s.includes('สถาน')) return 'place';
  // Additional patterns for place names (Thai/Chinese pinyin headers)
  if (s.includes('ชื่อสถานที่') || s.includes('คำอ่าน') || s.includes('พินอิน') || s.includes('ชื่อ')) return 'place';
  if (s.includes('รายละเอียด') || s.includes('detail')) return 'details';
  if (s.includes('การเดินทาง') || s.includes('เดินทาง') || s.includes('trav')) return 'transport';
  if (s.includes('โซน') || s.includes('zone')) return 'zone';
  if (s.includes('แนะนำ') || s.includes('recommend') || s.includes('must') || s.includes('try')) return 'recommend';
  return null;
}
// find the header name in `headers` that maps to a normalized key (e.g. 'date','zone')
function findHeaderByKey(key){
  for(const h of headers){
    if(headerMap[h] === key) return h;
  }
  return null;
}

function populateDateFilter(){
  if (!dateFilter) return;
  const seen = new Set();
  const opts = [];
  const hdr = findHeaderByKey('date') || headers[0];
  // choose dataset depending on currentSource
  const rowsSource = (currentSource === '__any__') ? data : (sourceRowsMap[currentSource] || []);
  rowsSource.forEach(r => {
    const d = (r._norm && r._norm.date) ? r._norm.date : (r[hdr] || '');
    if (!d) return;
    if (!seen.has(d)) { seen.add(d); opts.push(d); }
  });
  // Clear and add default
  dateFilter.innerHTML = '';
  const any = document.createElement('option'); any.value='__any__'; any.textContent='ทุกวัน'; dateFilter.appendChild(any);
  opts.forEach(d => {
    const o = document.createElement('option'); o.value = d; o.textContent = d; dateFilter.appendChild(o);
  });
}

function populateZoneFilter(){
  if (!zoneFilter) return;
  const seen = new Set();
  const opts = [];
  const hdr = findHeaderByKey('zone') || (headers.length>1?headers[1]:headers[0]);
  const rowsSource = (currentSource === '__any__') ? data : (sourceRowsMap[currentSource] || []);
  rowsSource.forEach(r => {
    const z = (r._norm && r._norm.zone) ? r._norm.zone : (r[hdr] || '');
    if (!z) return;
    if (!seen.has(z)) { seen.add(z); opts.push(z); }
  });
  zoneFilter.innerHTML = '';
  const any = document.createElement('option'); any.value='__any__'; any.textContent='ทุกโซน'; zoneFilter.appendChild(any);
  opts.forEach(z => {
    const o = document.createElement('option'); o.value = z; o.textContent = z; zoneFilter.appendChild(o);
  });
}

function parseCsvText(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  loadParsed(result);
}

// Helper: convert a Papa.parse result into header array and row objects
function parseResultToRows(result, source){
  if(!result || !result.data) return { headers: [], rows: [], source };
  // basic cleanup: remove empty rows
  let parsed = result.data.filter(r => {
    if (!r) return false;
    return Object.values(r).some(v => v !== null && v !== '');
  });
  // filter obvious metadata/footer rows
  const metaKeywords = ['สถานที่ (พิน', 'ค่าเข้า', 'หมายเหตุ', 'พินภาษาจีน'];
  parsed = parsed.filter(r => {
    const vals = Object.values(r).map(String);
    const joined = vals.join(' ').toLowerCase();
    for (const k of metaKeywords) if (joined.includes(k)) return false;
    return true;
  });
  const hdrs = result.meta && result.meta.fields ? result.meta.fields.map(f => String(f)) : (parsed.length ? Object.keys(parsed[0]) : []);
  const rows = parsed.map(r => {
    const out = {};
    hdrs.forEach(h => out[h] = r[h] ?? '');
    // tag source so callers can use it
    out._source = source || '__unknown__';
    return out;
  });
  return { headers: hdrs, rows, source };
}

// Combine multiple parsed CSV results into the application's data model
function loadCombined(results){
  const combinedHeaders = [];
  const combinedRows = [];
  // clear maps
  Object.keys(sourceHeadersMap).forEach(k=>delete sourceHeadersMap[k]);
  Object.keys(sourceRowsMap).forEach(k=>delete sourceRowsMap[k]);
  results.forEach(res => {
    const { headers: hdrs, rows, source } = parseResultToRows(res.result, res.source);
    // record per-source
    sourceHeadersMap[source] = hdrs.slice();
    sourceRowsMap[source] = rows.map(r => Object.assign({}, r));
    hdrs.forEach(h => { if (!combinedHeaders.includes(h)) combinedHeaders.push(h); });
    rows.forEach(r => combinedRows.push(r));
  });
  // make sure SOURCE_COL exists in headers and will be shown as a column
  if (!combinedHeaders.includes(SOURCE_COL)) combinedHeaders.push(SOURCE_COL);
  if (!combinedRows.length) {
    alert('ไม่พบข้อมูลในไฟล์ CSV');
    return;
  }
  // combined headers used when viewing all sources
  const unionHeaders = combinedHeaders;

  // prepare combined data rows
  const combined = combinedRows.map(row => {
    const out = {};
    unionHeaders.forEach(h => out[h] = row[h] ?? '');
    out[SOURCE_COL] = row._source || row[SOURCE_COL] || '__unknown__';
    out._norm = {};
    unionHeaders.forEach(h => {
      const k = detectHeaderKey(h) || null;
      if (k) out._norm[k] = String(out[h] ?? '').trim();
    });
    out._source = row._source || out[SOURCE_COL];
    return out;
  });

  // build headerMap for union headers
  headerMap = {};
  unionHeaders.forEach(h => headerMap[h] = detectHeaderKey(h) || null);

  // set global combined dataset
  data = combined;

  // ensure each sourceHeadersMap includes SOURCE_COL
  Object.keys(sourceHeadersMap).forEach(src => {
    if (!sourceHeadersMap[src].includes(SOURCE_COL)) sourceHeadersMap[src].push(SOURCE_COL);
  });

  // default to 'all sources'
  // default to first source (Book1.csv) if available, otherwise 'all sources'
  const defaultSource = (results && results.length && results[0].source) ? results[0].source : '__any__';
  currentSource = defaultSource;
  headers = unionHeaders.slice();

  populateColumnSelect();
  populateDateFilter();
  populateZoneFilter();
  populateSourceFilterAndTabs();
  // set default active source/tab and render accordingly (Book1 by default)
  setCurrentSource(currentSource);
}

function fetchAndParseAll(files){
  Promise.all(files.map(url => fetch(url)
    .then(r => { if(!r.ok) throw new Error(url + ' fetch failed: ' + r.status); return r.text(); })
    .then(t => ({ result: Papa.parse(t, { header: true, skipEmptyLines: true }), source: url }))
  ))
  .then(results => loadCombined(results))
  .catch(err => alert('ไม่สามารถโหลดไฟล์ CSV: ' + err.message));
}

function populateSourceFilterAndTabs(){
  if (!sourceFilter) return;
  const seen = new Set();
  const opts = [];
  data.forEach(r => {
    const s = r._source || r[SOURCE_COL] || '__unknown__';
    if (!seen.has(s)) { seen.add(s); opts.push(s); }
  });
  sourceFilter.innerHTML = '';
  const any = document.createElement('option'); any.value='__any__'; any.textContent='ทุกแหล่ง'; sourceFilter.appendChild(any);
  opts.forEach(s => {
    const label = sourceLabelMap[s] || s;
    const o = document.createElement('option'); o.value = s; o.textContent = label; sourceFilter.appendChild(o);
  });

  // build tabs if container present
  if (sourceTabs) {
    sourceTabs.innerHTML = '';
    const allBtn = document.createElement('button'); allBtn.type='button'; allBtn.textContent='ทั้งหมด'; allBtn.dataset.source='__any__';
    allBtn.addEventListener('click', ()=>{ setCurrentSource('__any__'); });
    sourceTabs.appendChild(allBtn);
    opts.forEach(s => {
      const label = sourceLabelMap[s] || s;
      const b = document.createElement('button'); b.type='button'; b.textContent = label; b.dataset.source = s;
      b.addEventListener('click', ()=>{ setCurrentSource(s); });
      sourceTabs.appendChild(b);
    });
  }
  if (sourceFilter) sourceFilter.addEventListener('change', ()=> setCurrentSource(sourceFilter.value));
}

function setCurrentSource(src){
  currentSource = src || '__any__';
  // update active tab styles
  if (sourceTabs) {
    Array.from(sourceTabs.children).forEach(btn => {
      if (btn.dataset && btn.dataset.source === currentSource) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }
  // update sourceFilter select to match
  if (sourceFilter) sourceFilter.value = currentSource;

  // set headers depending on source
  if (currentSource === '__any__') {
    // union view
    headers = Object.keys(headerMap).length ? Object.keys(headerMap) : headers;
  } else {
    headers = (sourceHeadersMap[currentSource] || []).slice();
  }

  // repopulate column select & filters for the active dataset
  populateColumnSelect();
  populateDateFilter();
  populateZoneFilter();

  // re-run search to render correct rows
  applySearch();
  // also update per-source tables (apply same filters)
  renderPerSourceTables();
}

function populateColumnSelect() {
  if (!columnSelect) return;
  // Clear existing except the Any option
  columnSelect.innerHTML = '';
  const any = document.createElement('option');
  any.value = '__any__';
  any.textContent = 'ทุกคอลัมน์';
  columnSelect.appendChild(any);
  headers.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h;
    columnSelect.appendChild(opt);
  });
}

function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function highlight(text, q){
  if (!q) return escapeHtml(text);
  try{
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re = new RegExp(esc, 'ig');
    return escapeHtml(text).replace(re, match => `<mark>${escapeHtml(match)}</mark>`);
  }catch(e){
    return escapeHtml(text);
  }
}

// Render a cell's HTML with query highlighting and special emphasis for the word 'Must'
function renderCell(text, q, headerName){
  const raw = text == null ? '' : String(text);
  // escape first
  let out = escapeHtml(raw);
  // apply query highlight if provided
  if (q) {
    try{
      const esc = q.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&');
      const re = new RegExp(esc, 'ig');
      out = out.replace(re, match => `<mark>${escapeHtml(match)}</mark>`);
    }catch(e){ /* ignore */ }
  }
  // emphasize the word 'Must' (case-insensitive) for specific columns
  // apply for recommendation and place columns
  const key = headerName && headerMap && headerMap[headerName] ? headerMap[headerName] : (headerName || '');
  if (key === 'recommend' || key === 'place' || /แนะนำ|สถานที่/.test(headerName)){
    out = out.replace(/\b(Must)\b/ig, (m, p1) => `<span class="must">${p1}</span>`);
    out = out.replace(/\b(Try)\b/ig, (m, p1) => `<span class="try">${p1}</span>`);
  }
  return out;
}

// Determine if a row contains 'Must' or 'Try' (case-insensitive) in any of its fields.
// Returns a CSS class name to apply to the row: 'row-must' | 'row-try' | ''
function getRowEmphasis(row){
  if (!row) return '';
  let hasTry = false;
  for (const k of Object.keys(row)){
    if (k === '_norm' || k === '_source') continue;
    const v = String(row[k] ?? '');
    if (/\bMust\b/i.test(v)) return 'row-must';
    if (/\bTry\b/i.test(v)) hasTry = true;
  }
  return hasTry ? 'row-try' : '';
}

// Note: file upload / "use included" UI removed — app always loads Book1.csv on page load

queryInput.addEventListener('input', () => applySearch());
if (wholeWord) wholeWord.addEventListener('change', () => applySearch());
if (dateFilter) dateFilter.addEventListener('change', () => applySearch());
if (zoneFilter) zoneFilter.addEventListener('change', () => applySearch());
if (placeFilter) placeFilter.addEventListener('input', () => applySearch());

// On load, attempt to fetch Book1.csv silently
window.addEventListener('load', () => {
  // Load and merge the main itinerary CSV and any extras
  fetchAndParseAll(dataFiles);
});

// wire additional controls
const clearBtn = document.getElementById('clear');
if (clearBtn) clearBtn.addEventListener('click', ()=>{
  queryInput.value = '';
  if (wholeWord) wholeWord.checked = false;
  if (columnSelect) columnSelect.value = '__any__';
  if (dateFilter) dateFilter.value = '__any__';
  if (zoneFilter) zoneFilter.value = '__any__';
  if (placeFilter) placeFilter.value = '';
  if (document.getElementById('perSourceTables')) renderPerSourceTables();
  else renderTable(data);
});
// inline clear for query field (improves UX)
const clearQueryBtn = document.getElementById('clearQuery');
if (clearQueryBtn) clearQueryBtn.addEventListener('click', ()=>{
  queryInput.value = '';
  applySearch();
  queryInput.focus();
});
if (columnSelect) columnSelect.addEventListener('change', ()=> applySearch());
