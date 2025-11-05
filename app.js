// app.js — client-side CSV loader + search using PapaParse
let data = [];
let headers = [];

const fileInput = document.getElementById('fileInput');
const useDefault = document.getElementById('useDefault');
const queryInput = document.getElementById('query');
const wholeWord = document.getElementById('wholeWord');
const thead = document.getElementById('thead');
const tbody = document.getElementById('tbody');
const stats = document.getElementById('stats');

function showStats(rowsCount) {
  stats.classList.remove('hidden');
  stats.textContent = `Rows: ${rowsCount} — Showing ${tbody.rows.length} matched rows`;
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
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  // Render rows
  rows.forEach(row => {
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const td = document.createElement('td');
      td.textContent = row[h] ?? '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  showStats(data.length);
}

function applySearch() {
  const q = queryInput.value.trim();
  if (!q) {
    renderTable(data);
    return;
  }
  const isWhole = wholeWord.checked;
  const qLower = q.toLowerCase();
  const filtered = data.filter(row => {
    return headers.some(h => {
      const v = (row[h] ?? '').toString();
      if (isWhole) return v.toLowerCase() === qLower;
      return v.toLowerCase().includes(qLower);
    });
  });
  renderTable(filtered);
}

function loadParsed(result) {
  // result.data is array of objects (if header) or arrays
  if (!result || !result.data) return;
  // PapaParse may include an extra empty row at end — filter
  const parsed = result.data.filter(r => Object.values(r).some(v => v !== null && v !== ''));
  if (!parsed.length) {
    alert('No rows parsed from CSV');
    return;
  }
  // If parsed rows are arrays, convert to objects using first row
  if (Array.isArray(parsed[0]) && result.meta && result.meta.fields === undefined) {
    // first row assumed to be header
    const headerRow = parsed[0];
    headers = headerRow;
    data = parsed.slice(1).map(arr => {
      const obj = {};
      headerRow.forEach((h, i) => obj[h] = arr[i] ?? '');
      return obj;
    });
  } else {
    headers = result.meta.fields || Object.keys(parsed[0]);
    data = parsed.map(r => r);
  }
  renderTable(data);
}

function parseCsvText(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  loadParsed(result);
}

function fetchAndParse(url) {
  fetch(url)
    .then(r => {
      if (!r.ok) throw new Error('Fetch failed: ' + r.status);
      return r.text();
    })
    .then(t => parseCsvText(t))
    .catch(err => alert('Could not load CSV: ' + err.message));
}

fileInput.addEventListener('change', (ev) => {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  Papa.parse(f, {
    header: true,
    skipEmptyLines: true,
    complete: (res) => loadParsed(res),
    error: (err) => alert('Parse error: ' + err.message)
  });
});

useDefault.addEventListener('click', () => {
  // Try to fetch docs/Book1.csv (relative path)
  fetchAndParse('Book1.csv');
});

queryInput.addEventListener('input', () => applySearch());
wholeWord.addEventListener('change', () => applySearch());

// On load, attempt to fetch Book1.csv silently
window.addEventListener('load', () => {
  fetch('Book1.csv', { method: 'HEAD' })
    .then(resp => {
      if (resp.ok) fetchAndParse('Book1.csv');
    })
    .catch(() => { /* ignore */ });
});
