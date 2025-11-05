// app.js — client-side CSV loader + search using PapaParse
let data = [];
let headers = [];
let headerMap = {}; // map original header -> normalized key (date/place/details/transport/recommend)
// Files to load and merge
const dataFiles = ['Book1.csv', 'places_extra.csv'];
// Synthetic source column header (Thai)
const SOURCE_COL = 'แหล่งข้อมูล';
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
  stats.classList.remove('hidden');
  // Thai: แถวทั้งหมด / แสดงผลที่ตรงกัน
  stats.textContent = `แถวทั้งหมด: ${rowsCount} — แสดงผลที่ตรงกัน: ${tbody.rows.length}`;
}

function renderTable(rows) {
  // Render header
  thead.innerHTML = '';
  tbody.innerHTML = '';
  if (!headers.length) return;
  const tr = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    // mark the source column so CSS can hide it on mobile
    if (h === SOURCE_COL) th.classList.add('col-source');
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  // Render rows
  rows.forEach(row => {
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const td = document.createElement('td');
      const cell = row[h] ?? '';
      if (h === SOURCE_COL) td.classList.add('col-source');
      td.innerHTML = highlight(cell, document.getElementById('query').value);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  showStats(data.length);
}

function applySearch() {
  const q = queryInput.value.trim();
  const isWhole = wholeWord.checked;
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
  renderTable(filtered);
}

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
  renderTable(data);
}

function detectHeaderKey(h){
  if (!h) return null;
  const s = String(h).toLowerCase();
  if (s.includes('วันที่') || s.includes('date') || s.includes('🗓')) return 'date';
  if (s.includes('สถานที่') || s.includes('place') || s.includes('สถาน')) return 'place';
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
  currentSource = '__any__';
  headers = unionHeaders.slice();

  populateColumnSelect();
  populateDateFilter();
  populateZoneFilter();
  populateSourceFilterAndTabs();
  // set default active source/tab and render accordingly
  setCurrentSource('__any__');
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
    const o = document.createElement('option'); o.value = s; o.textContent = s; sourceFilter.appendChild(o);
  });

  // build tabs if container present
  if (sourceTabs) {
    sourceTabs.innerHTML = '';
    const allBtn = document.createElement('button'); allBtn.type='button'; allBtn.textContent='ทั้งหมด'; allBtn.dataset.source='__any__';
    allBtn.addEventListener('click', ()=>{ setCurrentSource('__any__'); });
    sourceTabs.appendChild(allBtn);
    opts.forEach(s => {
      const b = document.createElement('button'); b.type='button'; b.textContent = s; b.dataset.source = s;
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

// Note: file upload / "use included" UI removed — app always loads Book1.csv on page load

queryInput.addEventListener('input', () => applySearch());
wholeWord.addEventListener('change', () => applySearch());
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
  wholeWord.checked = false;
  if (columnSelect) columnSelect.value = '__any__';
  if (dateFilter) dateFilter.value = '__any__';
  if (zoneFilter) zoneFilter.value = '__any__';
  if (placeFilter) placeFilter.value = '';
  renderTable(data);
});
if (columnSelect) columnSelect.addEventListener('change', ()=> applySearch());
