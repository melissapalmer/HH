/* Happy Hookers — site script
   Loads CSV data, renders the page, runs the countdown and lightbox.
   No build step, no dependencies. */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // -------- CSV parser (handles quoted fields with embedded commas / quotes) --------
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else { field += c; }
      } else if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else { field += c; }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }

    const cleaned = rows.filter(r => r.length && r.some(v => v.trim() !== ''));
    if (!cleaned.length) return [];
    const headers = cleaned[0].map(h => h.trim());
    return cleaned.slice(1).map(r => {
      const o = {};
      headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
      return o;
    });
  }

  async function loadCSV(path) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${path} → ${res.status}`);
      return parseCSV(await res.text());
    } catch (e) {
      console.error('CSV load failed:', e);
      return null;
    }
  }

  // -------- Date helpers --------
  const todayMidnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

  function parseGameDateTime(dateStr, timeStr) {
    // dateStr: YYYY-MM-DD ; timeStr: HH:MM (optional)
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    let h = 0, min = 0;
    if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) {
      [h, min] = timeStr.split(':').map(Number);
    }
    return new Date(y, (m || 1) - 1, d || 1, h, min);
  }

  function formatLongDate(d) {
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatShortDate(d) {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  // -------- Games --------
  async function renderGames() {
    const list = $('#games-list');
    const games = await loadCSV('data/games.csv');
    if (games === null) { list.innerHTML = `<p class="muted">Couldn't load games.csv. If you opened the file directly, run a local server (see README) — fetch needs http.</p>`; return null; }

    const today = todayMidnight();
    const upcoming = games
      .map(g => ({ ...g, _dt: parseGameDateTime(g.date, g.time) }))
      .filter(g => g._dt && g._dt >= today)
      .sort((a, b) => a._dt - b._dt);

    if (!upcoming.length) {
      list.innerHTML = `<p class="muted">No upcoming games yet — check back soon.</p>`;
      return null;
    }

    const cell = v => escapeHtml(v && v.trim() ? v : '—');
    list.innerHTML = `
      <div class="games-table-wrap">
        <table class="games-table">
          <thead>
            <tr><th scope="col">Date</th><th scope="col">Tee off</th><th scope="col">Location</th><th scope="col">Format</th><th scope="col" class="col-notes">Notes</th></tr>
          </thead>
          <tbody>
            ${upcoming.map(g => `
              <tr>
                <td><span class="date-full">${escapeHtml(formatShortDate(g._dt))}</span></td>
                <td>${cell(g.time)}</td>
                <td>${cell(g.location)}</td>
                <td>${cell(g.format)}</td>
                <td class="col-notes">${cell(g.notes)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    return upcoming[0];
  }

  // -------- Countdown --------
  function startCountdown(nextGame) {
    const card = $('#countdown-card');
    const value = $('#countdown');
    if (!nextGame) { card.hidden = true; return; }
    card.hidden = false;

    const tick = () => {
      const now = new Date();
      let diff = nextGame._dt - now;
      if (diff <= 0) {
        value.textContent = 'Tee off!';
        clearInterval(handle);
        return;
      }
      const d = Math.floor(diff / 86400000); diff -= d * 86400000;
      const h = Math.floor(diff / 3600000);  diff -= h * 3600000;
      const m = Math.floor(diff / 60000);
      const parts = [];
      if (d) parts.push(`${d} day${d === 1 ? '' : 's'}`);
      if (h || d) parts.push(`${h} hr`);
      parts.push(`${m} min`);
      value.textContent = parts.join(', ');
    };
    tick();
    const handle = setInterval(tick, 60_000);
  }

  // -------- Tee times --------
  async function renderTeeTimes(nextGame) {
    const formatBox = $('#tee-format');
    const groupsBox = $('#tee-groups');
    const teeRows = await loadCSV('data/tee-times.csv');
    if (teeRows === null) { groupsBox.innerHTML = `<p class="muted">Couldn't load tee-times.csv.</p>`; return; }

    if (!nextGame) {
      formatBox.innerHTML = '';
      groupsBox.innerHTML = `<p class="muted">No upcoming game scheduled — tee times will appear here.</p>`;
      return;
    }

    formatBox.innerHTML = `
      <h3>${formatLongDate(nextGame._dt)} — ${escapeHtml(nextGame.location || '')}</h3>
      ${nextGame.format ? `<p><strong>Format:</strong> ${escapeHtml(nextGame.format)}</p>` : ''}
      ${nextGame.notes ? `<p class="meta">${escapeHtml(nextGame.notes)}</p>` : ''}
    `;

    const groups = teeRows
      .filter(r => r.game_date === nextGame.date)
      .sort((a, b) => (a.tee_time || '').localeCompare(b.tee_time || ''));

    if (!groups.length) {
      groupsBox.innerHTML = `<p class="muted">Tee times haven't been published yet for this game.</p>`;
      return;
    }

    groupsBox.innerHTML = groups.map(g => {
      const players = ['player1', 'player2', 'player3', 'player4']
        .map(k => g[k]).filter(Boolean);
      return `
        <div class="tee-group">
          <div class="tee-time">${escapeHtml(g.tee_time || '')}</div>
          <ul>${players.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
        </div>
      `;
    }).join('');
  }

  // -------- Photos & lightbox --------
  let currentPhotos = [];
  let currentIndex = 0;

  async function renderPhotos() {
    const grid = $('#photo-grid');
    const photos = await loadCSV('data/photos.csv');
    if (photos === null) { grid.innerHTML = `<p class="muted">Couldn't load photos.csv.</p>`; return; }
    if (!photos.length) {
      grid.innerHTML = `<p class="muted">No photos yet — add some to <code>images/photos/</code> and list them in <code>data/photos.csv</code>.</p>`;
      return;
    }

    currentPhotos = photos;
    grid.innerHTML = photos.map((p, i) => `
      <button type="button" data-index="${i}" aria-label="${escapeHtml(p.caption || p.filename)}">
        <img src="images/photos/${encodeURIComponent(p.filename)}" alt="${escapeHtml(p.caption || '')}" loading="lazy">
        ${p.caption ? `<span class="caption">${escapeHtml(p.caption)}</span>` : ''}
      </button>
    `).join('');

    $$('#photo-grid button').forEach(btn => {
      btn.addEventListener('click', () => openLightbox(Number(btn.dataset.index)));
    });
  }

  function openLightbox(index) {
    if (!currentPhotos.length) return;
    currentIndex = (index + currentPhotos.length) % currentPhotos.length;
    const p = currentPhotos[currentIndex];
    $('#lightbox-img').src = `images/photos/${encodeURIComponent(p.filename)}`;
    $('#lightbox-img').alt = p.caption || '';
    $('#lightbox-caption').textContent = p.caption || '';
    $('#lightbox').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    $('#lightbox').hidden = true;
    document.body.style.overflow = '';
  }
  function step(delta) { openLightbox(currentIndex + delta); }

  function wireLightbox() {
    $('#lightbox-close').addEventListener('click', closeLightbox);
    $('#lightbox-prev').addEventListener('click', () => step(-1));
    $('#lightbox-next').addEventListener('click', () => step(1));
    $('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox(); });
    document.addEventListener('keydown', e => {
      if ($('#lightbox').hidden) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
  }

  // -------- Tabs --------
  const TABS = ['home', 'games', 'tee-times', 'photos'];

  function switchTab(name) {
    if (!TABS.includes(name)) name = 'home';
    $$('.tab-btn').forEach(b => {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.tab-content').forEach(p => p.classList.toggle('active', p.id === name));
    $('#nav-toggle').checked = false;
    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
    window.scrollTo({ top: 0 });
  }

  function wireNav() {
    $$('.tab-btn').forEach(b => {
      b.addEventListener('click', () => switchTab(b.dataset.tab));
    });
    $('.logo')?.addEventListener('click', e => { e.preventDefault(); switchTab('home'); });
    window.addEventListener('hashchange', () => switchTab(location.hash.slice(1)));
    const initial = location.hash.slice(1);
    if (TABS.includes(initial)) switchTab(initial);
  }

  // -------- Util --------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // -------- Boot --------
  document.addEventListener('DOMContentLoaded', async () => {
    wireLightbox();
    wireNav();
    const nextGame = await renderGames();
    startCountdown(nextGame);
    await renderTeeTimes(nextGame);
    await renderPhotos();
  });
})();
