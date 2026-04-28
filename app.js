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

  function formatGameDate(d) {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
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
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Course</th>
              <th scope="col">Tee off</th>
            </tr>
          </thead>
          <tbody>
            ${upcoming.map(g => `
              <tr>
                <td>${escapeHtml(formatGameDate(g._dt))}</td>
                <td>
                  ${cell(g.location)}
                  ${g.notes && g.notes.trim() ? `<span class="game-note">${escapeHtml(g.notes)}</span>` : ''}
                </td>
                <td>${cell(g.time)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const now = new Date();
    return upcoming.find(g => g._dt > now) || null;
  }

  // -------- Countdown --------
  function startCountdown(nextGame) {
    const card = $('#countdown-card');
    const value = $('#countdown');
    if (!nextGame) { card.hidden = true; return; }
    card.hidden = false;
    $('#next-course').textContent = nextGame.location || '—';
    $('#next-time').textContent = nextGame.time || 'tba';

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

  // -------- Photos & lightbox --------
  let currentPhotos = [];
  let currentIndex = 0;

  async function renderPhotos() {
    const grid = $('#photo-grid');
    const rows = await loadCSV('data/photos.csv');
    if (rows === null) { grid.innerHTML = `<p class="muted">Couldn't load photos.csv.</p>`; return; }
    if (!rows.length) {
      grid.innerHTML = `<p class="muted">No photos yet — add some to <code>images/photos/</code> and list them in <code>data/photos.csv</code>.</p>`;
      return;
    }

    // Annotate, then sort newest first by date (fall back to filename if no date)
    const photos = rows.map(p => ({
      ...p,
      _dt: parseGameDateTime(p.date, '') || new Date(0),
      _year: p.date ? p.date.slice(0, 4) : 'Undated',
    })).sort((a, b) => b._dt - a._dt);

    // Lightbox iterates the same order as displayed
    currentPhotos = photos;

    // Group by year, then by event within the year (preserving the sorted order)
    const byYear = new Map();
    photos.forEach((p, i) => {
      if (!byYear.has(p._year)) byYear.set(p._year, new Map());
      const eventKey = p.event && p.event.trim() ? p.event.trim() : 'Other';
      const events = byYear.get(p._year);
      if (!events.has(eventKey)) events.set(eventKey, []);
      events.get(eventKey).push({ ...p, _index: i });
    });

    const renderTile = p => `
      <button type="button" data-index="${p._index}" aria-label="${escapeHtml(p.caption || p.event || p.filename)}">
        <img src="images/photos/${encodeURIComponent(p.filename)}" alt="${escapeHtml(p.caption || p.event || '')}" loading="lazy">
        ${p.caption ? `<span class="caption">${escapeHtml(p.caption)}</span>` : ''}
      </button>
    `;

    const eventDate = items => {
      const d = items[0]._dt;
      if (!d || d.getTime() === 0) return '';
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    };

    grid.innerHTML = [...byYear.entries()].map(([year, events]) => `
      <section class="photo-year">
        <h3 class="photo-year-heading">${escapeHtml(year)}</h3>
        ${[...events.entries()].map(([eventName, items]) => `
          <div class="photo-event">
            <h4 class="photo-event-heading">
              <span class="photo-event-name">${escapeHtml(eventName)}</span>
              ${eventDate(items) ? `<span class="photo-event-date">${escapeHtml(eventDate(items))}</span>` : ''}
            </h4>
            <div class="photo-event-grid">${items.map(renderTile).join('')}</div>
          </div>
        `).join('')}
      </section>
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

  // -------- Winners --------
  async function renderWinners() {
    const list = $('#winners-list');
    const rows = await loadCSV('data/winners.csv');
    if (rows === null) { list.innerHTML = `<p class="muted">Couldn't load winners.csv.</p>`; return; }
    if (!rows.length) { list.innerHTML = `<p class="muted">No winners recorded yet.</p>`; return; }

    const items = rows
      .map(r => ({ ...r, _dt: parseGameDateTime(r.date, '') }))
      .filter(r => r._dt && r.winner)
      .sort((a, b) => b._dt - a._dt);

    list.innerHTML = items.map(r => `
      <article class="winner-item">
        <time datetime="${escapeHtml(r.date)}">${escapeHtml(formatShortDate(r._dt))}</time>
        <div class="winner-body">
          <div class="winner-name">${escapeHtml(r.winner)}${r.score ? ` <span class="winner-score">${escapeHtml(r.score)}</span>` : ''}</div>
          ${r.event ? `<div class="winner-event">${escapeHtml(r.event)}</div>` : ''}
          ${r.notes ? `<div class="winner-notes">${escapeHtml(r.notes)}</div>` : ''}
        </div>
      </article>
    `).join('');
  }

  // -------- News --------
  async function renderNews() {
    const list = $('#news-list');
    const rows = await loadCSV('data/news.csv');
    if (rows === null) { list.innerHTML = `<p class="muted">Couldn't load news.csv.</p>`; return; }
    if (!rows.length) {
      list.innerHTML = `<p class="muted">No news yet.</p>`;
      return;
    }
    const items = rows
      .map(r => ({ ...r, _dt: parseGameDateTime(r.date, '') }))
      .filter(r => r._dt && r.text)
      .sort((a, b) => b._dt - a._dt);

    list.innerHTML = items.map(r => `
      <article class="news-item">
        <time datetime="${escapeHtml(r.date)}">${escapeHtml(formatShortDate(r._dt))}</time>
        <div class="news-body">
          <p>${escapeHtml(r.text)}</p>
          ${r.author ? `<p class="news-author">— ${escapeHtml(r.author)}</p>` : ''}
        </div>
      </article>
    `).join('');
  }

  // -------- Tabs --------
  const TABS = ['home', 'games', 'winners', 'news', 'photos'];

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

  // -------- Footer quote --------
  const QUOTES = [
    { text: "Golf is a good walk spoiled.", who: "Mark Twain" },
    { text: "The most important shot in golf is the next one.", who: "Ben Hogan" },
    { text: "I have a tip that can take five strokes off anyone's golf game. It's called an eraser.", who: "Arnold Palmer" },
    { text: "Golf is deceptively simple and endlessly complicated.", who: "Arnold Palmer" },
    { text: "Don't play too much golf. Two rounds a day are plenty.", who: "Harry Vardon" },
    { text: "If you think it's hard to meet new people, try picking up the wrong golf ball.", who: "Jack Lemmon" },
    { text: "Real golfers don't cry when they line up their fourth putt.", who: "Karen Hurwitz" },
    { text: "Golf is a game whose aim is to hit a very small ball into an even smaller hole, with weapons singularly ill-designed for the purpose.", who: "Winston Churchill" },
    { text: "I'd give up golf if I didn't have so many sweaters.", who: "Bob Hope" },
    { text: "Why do golfers always wear two pairs of trousers? In case they get a hole in one.", who: "" },
    { text: "Golfer to caddy: 'I think I'm going to drown myself in the lake.' Caddy: 'Think you can keep your head down that long?'", who: "" },
    { text: "The only sure rule in golf is — he who has the fastest cart never has to play the bad lie.", who: "Mickey Mantle" },
    { text: "Golf is the closest game to the game we call life. You get bad breaks from good shots and good breaks from bad shots — but you have to play the ball where it lies.", who: "Bobby Jones" },
    { text: "I'm not saying my golf game went bad, but if I grew tomatoes they'd come up sliced.", who: "Miller Barber" },
  ];
  function showRandomQuote() {
    const el = $('#footer-quote');
    if (!el) return;
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    el.innerHTML = `<span class="quote-text">${escapeHtml(q.text)}</span>${q.who ? `<span class="attr">${escapeHtml(q.who)}</span>` : ''}`;
  }

  // -------- Boot --------
  document.addEventListener('DOMContentLoaded', async () => {
    wireLightbox();
    wireNav();
    showRandomQuote();
    const nextGame = await renderGames();
    startCountdown(nextGame);
    await renderWinners();
    await renderNews();
    await renderPhotos();
  });
})();
