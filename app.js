/* ═══════════════════════════════════════════════════════════
   Party Planner — app.js
   ═══════════════════════════════════════════════════════════ */

// ── Auth ────────────────────────────────────────────────────
let currentUser = null; // set after login

function getAccounts() {
  return JSON.parse(localStorage.getItem('pp_accounts') || '{}');
}
function saveAccounts(a) {
  localStorage.setItem('pp_accounts', JSON.stringify(a));
}
function eventsKey(u) { return 'pp_events_' + u; }

function loginUser(username) {
  currentUser = username;
  localStorage.setItem('pp_session', username);
  state.events = JSON.parse(localStorage.getItem(eventsKey(username)) || '[]');
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('sidebar-username').textContent = username;
  document.getElementById('sidebar-avatar').textContent   = getInitials(username);
  renderDashboard();
}

function logoutUser() {
  currentUser = null;
  state.events = []; state.currentEventId = null;
  localStorage.removeItem('pp_session');
  stopSimulator();
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  // reset login form
  document.getElementById('login-form').reset();
  document.getElementById('login-error').textContent = '';
}

// ── State ──────────────────────────────────────────────────
const state = {
  events:         [],   // populated after login
  currentEventId: null,
  simRunning:     false,
  simFrame:       null,
  simTime:        0,
};

function saveState() {
  if (!currentUser) return;
  localStorage.setItem(eventsKey(currentUser), JSON.stringify(state.events));
}

function getCurrentEvent() {
  return state.events.find(e => e.id === state.currentEventId) || null;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getInitials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase() || '?';
}

// ── Category Config ─────────────────────────────────────────
const CAT = {
  birthday:    { icon:'🎂', label:'Birthday',    color:'#E11D48', bg:'#FFF1F2' },
  christmas:   { icon:'🎄', label:'Christmas',   color:'#15803D', bg:'#F0FDF4' },
  funeral:     { icon:'🕊️', label:'Funeral',     color:'#57534E', bg:'#F5F5F4' },
  halloween:   { icon:'🎃', label:'Halloween',   color:'#C2410C', bg:'#FFF7ED' },
  graduation:  { icon:'🎓', label:'Graduation',  color:'#1D4ED8', bg:'#EFF6FF' },
  wedding:     { icon:'💒', label:'Wedding',     color:'#A16207', bg:'#FEFCE8' },
  anniversary: { icon:'💖', label:'Anniversary', color:'#BE185D', bg:'#FDF2F8' },
  other:       { icon:'🎉', label:'Other',       color:'#7C3AED', bg:'#F5F3FF' },
};

// per-category scene settings for the canvas simulator
const SCENE = {
  birthday:    { wallTop:'#FECDD3', wallBot:'#FDA4AF', floor:'#F9A8D4', decos:['🎂','🎈','🎁','🪅','🎊'], particles:'confetti', textColor:'#E11D48' },
  christmas:   { wallTop:'#BBF7D0', wallBot:'#86EFAC', floor:'#4ADE80', decos:['🎄','⭐','🎁','🦌','❄️'], particles:'snow',     textColor:'#15803D' },
  funeral:     { wallTop:'#D6D3D1', wallBot:'#A8A29E', floor:'#78716C', decos:['🕊️','🌹','🕯️','💐'],      particles:'none',     textColor:'#44403C' },
  halloween:   { wallTop:'#1C1917', wallBot:'#292524', floor:'#44403C', decos:['🎃','👻','🦇','🕷️','🌙'], particles:'bats',     textColor:'#F97316' },
  graduation:  { wallTop:'#BFDBFE', wallBot:'#93C5FD', floor:'#60A5FA', decos:['🎓','📜','🏆','⭐','🎊'], particles:'confetti', textColor:'#1D4ED8' },
  wedding:     { wallTop:'#FEF9C3', wallBot:'#FEF08A', floor:'#FDE047', decos:['💒','💍','💐','🕊️','🎊'], particles:'petals',   textColor:'#A16207' },
  anniversary: { wallTop:'#FCE7F3', wallBot:'#FBCFE8', floor:'#F9A8D4', decos:['💖','🌹','🥂','💍','✨'], particles:'hearts',   textColor:'#BE185D' },
  other:       { wallTop:'#EDE9FE', wallBot:'#DDD6FE', floor:'#C4B5FD', decos:['🎉','🎈','✨','🌟','🎊'], particles:'confetti', textColor:'#7C3AED' },
};

// ── View Routing ────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name)?.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (name === 'dashboard') document.querySelector('.nav-btn[data-view="dashboard"]')?.classList.add('active');

  if (name === 'dashboard')     renderDashboard();
  if (name === 'event-detail')  renderEventDetail();
}

// ── Dashboard ───────────────────────────────────────────────
function renderDashboard() {
  const grid      = document.getElementById('events-grid');
  const empty     = document.getElementById('empty-state');
  const filter    = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';

  const filtered  = filter === 'all'
    ? state.events
    : state.events.filter(e => e.category === filter);

  if (!filtered.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = filtered.map(ev => {
    const c   = CAT[ev.category] || CAT.other;
    const dt  = ev.date ? new Date(ev.date + 'T00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : 'No date';
    const gc  = ev.guests?.length || 0;
    const ac  = ev.activities?.length || 0;
    return `
      <div class="event-card" data-id="${ev.id}" style="--cat-color:${c.color};--cat-bg:${c.bg}">
        <div class="card-header">
          <span class="cat-badge">${c.icon} ${c.label}</span>
          <button class="card-delete" data-id="${ev.id}" title="Delete">✕</button>
        </div>
        <div class="card-body">
          <h3 class="card-title">${escHtml(ev.name)}</h3>
          <p class="card-date">📅 ${dt}</p>
          ${ev.location ? `<p class="card-location">📍 ${escHtml(ev.location)}</p>` : ''}
          ${ev.theme    ? `<p class="card-theme">✨ ${escHtml(ev.theme)}</p>` : ''}
        </div>
        <div class="card-footer">
          <span class="card-stat">👥 ${gc} guest${gc !== 1 ? 's' : ''}</span>
          <span class="card-stat">📋 ${ac} activit${ac !== 1 ? 'ies' : 'y'}</span>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.event-card').forEach(card => {
    card.addEventListener('click', e => {
      if (!e.target.closest('.card-delete')) {
        state.currentEventId = card.dataset.id;
        showView('event-detail');
      }
    });
  });

  grid.querySelectorAll('.card-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteEvent(btn.dataset.id);
    });
  });
}

function deleteEvent(id) {
  if (!confirm('Delete this event? This cannot be undone.')) return;
  state.events = state.events.filter(e => e.id !== id);
  saveState();
  renderDashboard();
}

// ── Create / Edit Form ──────────────────────────────────────
function openCreateForm(editId = null) {
  stopSimulator();
  const form = document.getElementById('event-form');
  form.reset();
  document.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));

  if (editId) {
    const ev = state.events.find(e => e.id === editId);
    if (!ev) return;
    document.getElementById('create-title').textContent = 'Edit Event';
    document.getElementById('event-name').value        = ev.name        || '';
    document.getElementById('event-date').value        = ev.date        || '';
    document.getElementById('event-time').value        = ev.time        || '';
    document.getElementById('event-location').value   = ev.location    || '';
    document.getElementById('event-theme').value      = ev.theme       || '';
    document.getElementById('event-description').value = ev.description || '';
    const radio = document.querySelector(`input[name="category"][value="${ev.category}"]`);
    if (radio) { radio.checked = true; radio.closest('.category-option').classList.add('selected'); }
    form.dataset.editId = editId;
  } else {
    document.getElementById('create-title').textContent = 'Create New Event';
    const first = document.querySelector('input[name="category"]');
    if (first) { first.checked = true; first.closest('.category-option').classList.add('selected'); }
    delete form.dataset.editId;
  }
  showView('create');
}

function saveEvent(e) {
  e.preventDefault();
  const category = document.querySelector('input[name="category"]:checked')?.value || 'other';
  const name     = document.getElementById('event-name').value.trim();
  if (!name) return;

  const data = {
    name,
    category,
    date:        document.getElementById('event-date').value,
    time:        document.getElementById('event-time').value,
    location:    document.getElementById('event-location').value.trim(),
    theme:       document.getElementById('event-theme').value.trim(),
    description: document.getElementById('event-description').value.trim(),
  };

  const editId = document.getElementById('event-form').dataset.editId;
  if (editId) {
    const idx = state.events.findIndex(ev => ev.id === editId);
    if (idx !== -1) state.events[idx] = { ...state.events[idx], ...data };
  } else {
    state.events.unshift({ id: genId(), ...data, guests: [], activities: [], notes: [], createdAt: new Date().toISOString() });
  }

  saveState();
  if (editId) {
    showView('dashboard');          // editing: go straight back
  } else {
    playCutscene(category, () => showView('dashboard')); // new event: play cutscene first
  }
}

// ── Event Detail ────────────────────────────────────────────
function renderEventDetail() {
  const ev = getCurrentEvent();
  if (!ev) return showView('dashboard');

  const c  = CAT[ev.category] || CAT.other;
  const dt = ev.date ? new Date(ev.date + 'T00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) : '';
  const meta = [dt, ev.time, ev.location].filter(Boolean).join(' · ');

  document.getElementById('event-detail-title').textContent = `${c.icon} ${ev.name}`;
  document.getElementById('event-detail-meta').textContent  = meta;

  const view = document.getElementById('view-event-detail');
  view.style.setProperty('--cat-color', c.color);
  view.style.setProperty('--cat-bg', c.bg);

  switchTab('guests');
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.querySelector(`.tab-btn[data-tab="${name}"]`)?.classList.add('active');
  document.getElementById(`tab-${name}`)?.classList.remove('hidden');

  // stop sim if leaving that tab
  if (name !== 'simulator') stopSimulator();

  if (name === 'guests')     renderGuests();
  if (name === 'activities') renderActivities();
  if (name === 'notes')      renderNotes();
  if (name === 'simulator')  setupSimulator();
}

// ── Guests ──────────────────────────────────────────────────
function renderGuests() {
  const ev     = getCurrentEvent(); if (!ev) return;
  const guests = ev.guests || [];
  const yes = guests.filter(g => g.rsvp === 'yes').length;
  const no  = guests.filter(g => g.rsvp === 'no').length;
  const mb  = guests.filter(g => g.rsvp === 'maybe').length;
  const pd  = guests.filter(g => g.rsvp === 'pending').length;

  document.getElementById('guest-stats').innerHTML = `
    <div class="stat-chips">
      <span class="stat-chip total">👥 ${guests.length} Total</span>
      <span class="stat-chip yes">✅ ${yes} Coming</span>
      <span class="stat-chip no">❌ ${no} Not coming</span>
      <span class="stat-chip maybe">🤔 ${mb} Maybe</span>
      <span class="stat-chip pending">⏳ ${pd} Pending</span>
    </div>`;

  const list = document.getElementById('guest-list');
  if (!guests.length) {
    list.innerHTML = '<p class="empty-msg">No guests yet — add your first guest above!</p>';
    return;
  }

  list.innerHTML = guests.map(g => `
    <div class="guest-item">
      <div class="guest-avatar">${getInitials(g.name)}</div>
      <div class="guest-info">
        <span class="guest-name">${escHtml(g.name)}</span>
        ${g.contact ? `<span class="guest-contact">${escHtml(g.contact)}</span>` : ''}
      </div>
      <select class="rsvp-select" data-gid="${g.id}">
        <option value="pending" ${g.rsvp==='pending'?'selected':''}>⏳ Pending</option>
        <option value="yes"     ${g.rsvp==='yes'    ?'selected':''}>✅ Coming</option>
        <option value="no"      ${g.rsvp==='no'     ?'selected':''}>❌ Not Coming</option>
        <option value="maybe"   ${g.rsvp==='maybe'  ?'selected':''}>🤔 Maybe</option>
      </select>
      <button class="btn-icon btn-rm-guest" data-gid="${g.id}" title="Remove">🗑️</button>
    </div>`).join('');

  list.querySelectorAll('.rsvp-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const g = ev.guests.find(g => g.id === sel.dataset.gid);
      if (g) { g.rsvp = sel.value; saveState(); renderGuests(); }
    });
  });
  list.querySelectorAll('.btn-rm-guest').forEach(btn => {
    btn.addEventListener('click', () => {
      ev.guests = ev.guests.filter(g => g.id !== btn.dataset.gid);
      saveState(); renderGuests();
    });
  });
}

function addGuest() {
  const ev   = getCurrentEvent(); if (!ev) return;
  const name = document.getElementById('guest-name').value.trim();
  if (!name) { alert('Please enter a guest name.'); return; }
  ev.guests.push({
    id:      genId(),
    name,
    contact: document.getElementById('guest-contact').value.trim(),
    rsvp:    document.getElementById('guest-rsvp').value,
  });
  saveState();
  document.getElementById('add-guest-form').style.display = 'none';
  document.getElementById('guest-name').value    = '';
  document.getElementById('guest-contact').value = '';
  document.getElementById('guest-rsvp').value    = 'pending';
  renderGuests();
}

// ── Activities ──────────────────────────────────────────────
function renderActivities() {
  const ev   = getCurrentEvent(); if (!ev) return;
  const acts = [...(ev.activities || [])].sort((a, b) => (a.time||'').localeCompare(b.time||''));
  const list = document.getElementById('activity-list');

  if (!acts.length) {
    list.innerHTML = '<p class="empty-msg">No activities yet — build your schedule!</p>';
    return;
  }

  list.innerHTML = acts.map(a => `
    <div class="activity-accordion" data-aid="${a.id}">
      <button class="acc-header" aria-expanded="false">
        <span class="acc-time">${a.time || '--:--'}</span>
        <span class="acc-name">${escHtml(a.name)}</span>
        ${a.duration ? `<span class="acc-chip">⏱ ${a.duration} min</span>` : ''}
        <span class="acc-chevron">▾</span>
      </button>
      <div class="acc-body">
        <div class="acc-separator"></div>
        <p class="acc-desc${a.description ? '' : ' muted'}">${escHtml(a.description || 'No description added.')}</p>
        <div class="acc-foot">
          <button class="btn btn-danger btn-sm btn-rm-activity" data-aid="${a.id}">Delete</button>
        </div>
      </div>
    </div>`).join('');

  // Toggle open/close on header click
  list.querySelectorAll('.acc-header').forEach(header => {
    header.addEventListener('click', () => {
      const card = header.closest('.activity-accordion');
      const isOpen = card.classList.toggle('open');
      header.setAttribute('aria-expanded', isOpen);
    });
  });

  list.querySelectorAll('.btn-rm-activity').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      ev.activities = ev.activities.filter(a => a.id !== btn.dataset.aid);
      saveState(); renderActivities();
    });
  });
}

function addActivity() {
  const ev   = getCurrentEvent(); if (!ev) return;
  const name = document.getElementById('activity-name').value.trim();
  if (!name) { alert('Please enter an activity name.'); return; }
  ev.activities.push({
    id:          genId(),
    name,
    time:        document.getElementById('activity-time').value,
    duration:    parseInt(document.getElementById('activity-duration').value) || null,
    description: document.getElementById('activity-description').value.trim(),
  });
  saveState();
  document.getElementById('add-activity-form').style.display = 'none';
  document.getElementById('activity-name').value        = '';
  document.getElementById('activity-time').value        = '';
  document.getElementById('activity-duration').value    = '';
  document.getElementById('activity-description').value = '';
  renderActivities();
}

// ── Notes ───────────────────────────────────────────────────
function renderNotes() {
  const ev      = getCurrentEvent(); if (!ev) return;
  const showHid = document.getElementById('show-hidden-notes').checked;
  let   notes   = (ev.notes || []).filter(n => showHid || !n.hidden);
  notes = [...notes.filter(n => n.pinned), ...notes.filter(n => !n.pinned)];

  const grid = document.getElementById('notes-grid');
  if (!notes.length) {
    grid.innerHTML = '<p class="empty-msg">No notes yet — jot something down!</p>';
    return;
  }

  grid.innerHTML = notes.map(n => `
    <div class="note-card${n.pinned?' pinned':''}${n.hidden?' hidden-note':''}">
      <div class="note-header">
        <h4 class="note-title">${escHtml(n.title)}</h4>
        <div class="note-actions">
          ${n.pinned ? '<span title="Pinned">📌</span>' : ''}
          ${n.hidden ? '<span title="Hidden">🔒</span>' : ''}
          <button class="btn-icon btn-rm-note" data-nid="${n.id}" title="Delete">✕</button>
        </div>
      </div>
      <p class="note-content">${escHtml(n.content)}</p>
    </div>`).join('');

  grid.querySelectorAll('.btn-rm-note').forEach(btn => {
    btn.addEventListener('click', () => {
      ev.notes = ev.notes.filter(n => n.id !== btn.dataset.nid);
      saveState(); renderNotes();
    });
  });
}

function addNote() {
  const ev    = getCurrentEvent(); if (!ev) return;
  const title = document.getElementById('note-title').value.trim();
  if (!title) { alert('Please enter a note title.'); return; }
  ev.notes.push({
    id:      genId(),
    title,
    content: document.getElementById('note-content').value.trim(),
    pinned:  document.getElementById('note-pinned').checked,
    hidden:  document.getElementById('note-hidden').checked,
  });
  saveState();
  document.getElementById('add-note-form').style.display = 'none';
  document.getElementById('note-title').value   = '';
  document.getElementById('note-content').value = '';
  document.getElementById('note-pinned').checked = false;
  document.getElementById('note-hidden').checked = false;
  renderNotes();
}

// ── Cutscene ─────────────────────────────────────────────────
const CS_CONFIG = {
  birthday:    { bg:'#E11D48', bg2:'#FB7185', icon:'🎂', title:'Birthday Party Created!',    sub:'Time to celebrate! 🥳',              effect:'confetti' },
  christmas:   { bg:'#14532D', bg2:'#4ADE80', icon:'🎄', title:'Christmas Party Created!',   sub:'Ho ho ho! 🎅',                       effect:'snow'     },
  funeral:     { bg:'#1C1917', bg2:'#78716C', icon:'🕊️', title:'Memorial Created',            sub:'A moment to honour and remember.',   effect:'feathers' },
  halloween:   { bg:'#1C1917', bg2:'#C2410C', icon:'🎃', title:'Spooky Party Ready!',         sub:'BOO! 👻',                            effect:'bats'     },
  graduation:  { bg:'#1E3A8A', bg2:'#60A5FA', icon:'🎓', title:'Graduation Created!',         sub:'Congratulations, graduate! 🏆',      effect:'caps'     },
  wedding:     { bg:'#78350F', bg2:'#FDE68A', icon:'💒', title:'Wedding Created!',            sub:'Here comes the celebration! 💕',     effect:'petals'   },
  anniversary: { bg:'#831843', bg2:'#F9A8D4', icon:'💖', title:'Anniversary Created!',        sub:'Celebrating your love! 💕',          effect:'hearts'   },
  other:       { bg:'#3B0764', bg2:'#A78BFA', icon:'🎉', title:'Party Created!',             sub:"Let's get this started! 🕺",          effect:'confetti' },
};

// Per-particle for the cutscene canvas
class CsParticle {
  constructor(W, H, effect) {
    this.W = W; this.H = H; this.effect = effect;
    this.active = true;
    this.init(true);
  }

  init(scatter = false) {
    const { W, H, effect } = this;
    this.op  = 1;
    this.rot = Math.random() * Math.PI * 2;

    if (effect === 'confetti' || effect === 'caps') {
      this.x   = scatter ? Math.random() * W : Math.random() * W;
      this.y   = scatter ? Math.random() * H : H + 10;
      this.vx  = (Math.random() - 0.5) * 7;
      this.vy  = -(Math.random() * 10 + 5);
      this.grav = 0.22;
      this.rs  = (Math.random() - 0.5) * 0.2;
      this.sz  = effect === 'caps' ? 26 : (Math.random() * 9 + 5);
      this.hue = Math.random() * 360;
    } else if (effect === 'snow') {
      this.x   = scatter ? Math.random() * W : Math.random() * W;
      this.y   = scatter ? Math.random() * H : -12;
      this.vx  = (Math.random() - 0.5) * 0.9;
      this.vy  = Math.random() * 1.6 + 0.6;
      this.sz  = Math.random() * 6 + 3;
      this.grav = 0; this.rs = 0.02;
    } else if (effect === 'feathers') {
      this.x   = scatter ? Math.random() * W : Math.random() * W;
      this.y   = scatter ? Math.random() * H : -12;
      this.vx  = (Math.random() - 0.5) * 0.7;
      this.vy  = Math.random() * 0.9 + 0.3;
      this.sz  = Math.random() * 12 + 8;
      this.grav = 0; this.rs = (Math.random() - 0.5) * 0.025;
    } else if (effect === 'bats') {
      const fromLeft = Math.random() < 0.5;
      this.x   = scatter ? Math.random() * W : (fromLeft ? -40 : W + 40);
      this.y   = Math.random() * H * 0.75;
      this.vx  = fromLeft ? Math.random() * 4 + 2 : -(Math.random() * 4 + 2);
      this.vy  = (Math.random() - 0.5) * 2;
      this.sz  = Math.random() * 14 + 20;
      this.grav = 0; this.rs = 0;
    } else if (effect === 'petals') {
      this.x   = scatter ? Math.random() * W : Math.random() * W;
      this.y   = scatter ? Math.random() * H : -12;
      this.vx  = Math.sin(Math.random() * Math.PI * 2) * 1.3;
      this.vy  = Math.random() * 1.6 + 0.7;
      this.sz  = Math.random() * 8 + 16;
      this.grav = 0; this.rs = (Math.random() - 0.5) * 0.045;
    } else if (effect === 'hearts') {
      this.x   = scatter ? Math.random() * W : Math.random() * W;
      this.y   = scatter ? Math.random() * H : H + 12;
      this.vx  = (Math.random() - 0.5) * 2.2;
      this.vy  = -(Math.random() * 3 + 1.5);
      this.sz  = Math.random() * 14 + 18;
      this.grav = 0; this.rs = 0;
    }
  }

  update() {
    this.x  += this.vx;
    this.y  += this.vy;
    this.rot += (this.rs || 0);
    if (this.grav) this.vy += this.grav;

    // fade out as they leave
    const { effect, H, W } = this;
    if ((effect === 'confetti' || effect === 'caps') && this.y > H * 0.88) {
      this.op = Math.max(0, this.op - 0.045);
    }
    const offscreen =
      ((effect === 'confetti' || effect === 'caps' || effect === 'hearts') && this.y > H + 30) ||
      ((effect === 'snow' || effect === 'feathers' || effect === 'petals') && this.y > H + 30) ||
      (effect === 'bats' && (this.x < -60 || this.x > W + 60));
    if (offscreen) this.init(false);
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.op;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

    const { effect, sz } = this;

    if (effect === 'confetti') {
      ctx.fillStyle = `hsl(${this.hue},85%,63%)`;
      ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2);
    } else if (effect === 'snow') {
      // circle core
      ctx.beginPath(); ctx.arc(0, 0, sz / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
      // six arms
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(0, sz * 0.5); ctx.lineTo(0, sz * 1.4);
        ctx.stroke(); ctx.restore();
      }
    } else if (effect === 'feathers') {
      ctx.beginPath();
      ctx.ellipse(0, 0, sz / 4, sz / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(229,231,235,0.82)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.5; ctx.stroke();
    } else {
      // emoji
      const glyphs = { bats:'🦇', caps:'🎓', petals:'🌸', hearts:'❤️' };
      ctx.font      = `${sz}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(glyphs[effect] || '✨', 0, 0);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

let csFrame = null, csParticles = [];

function playCutscene(category, onDone) {
  const cfg     = CS_CONFIG[category] || CS_CONFIG.other;
  const overlay = document.getElementById('cutscene');
  const canvas  = document.getElementById('cutscene-canvas');
  const ctx     = canvas.getContext('2d');

  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  // Populate text
  overlay.querySelector('.cutscene-icon').textContent  = cfg.icon;
  overlay.querySelector('.cutscene-title').textContent = cfg.title;
  overlay.querySelector('.cutscene-sub').textContent   = cfg.sub;
  overlay.style.background = `linear-gradient(135deg, ${cfg.bg} 0%, ${cfg.bg2} 100%)`;

  // Spawn particles — more for celebratory, fewer for respectful events
  const count = cfg.effect === 'feathers' ? 22 : 55;
  csParticles = Array.from({ length: count }, () => new CsParticle(canvas.width, canvas.height, cfg.effect));

  // Show overlay
  overlay.style.display  = 'flex';
  overlay.style.opacity  = '0';
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const DURATION = 2900;
  let startTime  = null;
  let skipped    = false;

  function skip() {
    skipped = true;
    finish();
  }

  function finish() {
    if (csFrame) { cancelAnimationFrame(csFrame); csFrame = null; }
    overlay.style.transition = 'opacity 0.3s ease';
    overlay.style.opacity    = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('visible');
      overlay.style.opacity = '';
      if (onDone) onDone();
    }, 310);
  }

  // Wire skip button (one-shot)
  const skipBtn = document.getElementById('cutscene-skip');
  const onSkip  = () => { skipBtn.removeEventListener('click', onSkip); skip(); };
  skipBtn.addEventListener('click', onSkip);

  function tick(ts) {
    if (skipped) return;
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    csParticles.forEach(p => { p.update(); p.draw(ctx); });

    if (elapsed >= DURATION) {
      skipBtn.removeEventListener('click', onSkip);
      finish();
    } else {
      csFrame = requestAnimationFrame(tick);
    }
  }
  csFrame = requestAnimationFrame(tick);
}

// ── Simulator — top-down floor-plan (Google Maps style) ──────

// ── Venue themes (colours per event type) ───────────────────
const VENUE_THEME = {
  birthday:    { floor:'#FFF8EE', tile:'#FFEFD6', wall:'#9B6B4B', wallEdge:'#C4956A', table:'#C8956A', chair:'#F5CBA7', particle:'confetti' },
  christmas:   { floor:'#EDF7ED', tile:'#D6EDDB', wall:'#2D5016', wallEdge:'#4A7C28', table:'#6B4226', chair:'#A07040', particle:'snow'     },
  funeral:     { floor:'#F0F0F0', tile:'#E4E4E4', wall:'#505050', wallEdge:'#787878', table:'#909090', chair:'#C8C8C8', particle:'none'     },
  halloween:   { floor:'#140800', tile:'#200E00', wall:'#3D1A00', wallEdge:'#6B3000', table:'#4A2000', chair:'#3A1800', particle:'bats'     },
  graduation:  { floor:'#EFF6FF', tile:'#DBEAFE', wall:'#1E3A8A', wallEdge:'#2563EB', table:'#2563EB', chair:'#93C5FD', particle:'confetti' },
  wedding:     { floor:'#FFFDE7', tile:'#FFF9C4', wall:'#78350F', wallEdge:'#B45309', table:'#B8902A', chair:'#FDE68A', particle:'petals'   },
  anniversary: { floor:'#FDF2F8', tile:'#FCE7F3', wall:'#831843', wallEdge:'#BE185D', table:'#BE185D', chair:'#F9A8D4', particle:'hearts'   },
  other:       { floor:'#F5F3FF', tile:'#EDE9FE', wall:'#3B0764', wallEdge:'#6D28D9', table:'#7C3AED', chair:'#C4B5FD', particle:'confetti' },
};

// ── Venue layouts (normalised 0–1 coordinates) ───────────────
const VENUE_LAYOUT = {
  birthday: {
    zones:  [
      { x:.05, y:.05, w:.9,  h:.42, color:'rgba(255,182,193,.14)', label:'Dining Area' },
      { x:.22, y:.54, w:.56, h:.32, color:'rgba(255,105,180,.18)', label:'Dance Floor' },
    ],
    tables: [
      { type:'round', x:.22, y:.25, r:.085, seats:6 },
      { type:'round', x:.5,  y:.25, r:.085, seats:6 },
      { type:'round', x:.78, y:.25, r:.085, seats:6 },
      { type:'rect',  x:.5,  y:.91, w:.52,  h:.065, label:'Buffet Table' },
    ],
    special:[
      { x:.5,  y:.7,  emoji:'🎂', sz:26, label:'Cake' },
    ],
    decos:  [
      { x:.06, y:.06, emoji:'🎈' }, { x:.94, y:.06, emoji:'🎈' },
      { x:.06, y:.94, emoji:'🎈' }, { x:.94, y:.94, emoji:'🎈' },
      { x:.5,  y:.06, emoji:'🎊' },
    ],
    door: { side:'bottom', pos:.5 },
  },
  christmas: {
    zones:  [{ x:.04, y:.04, w:.92, h:.88, color:'rgba(167,220,167,.16)', label:'Dining Hall' }],
    tables: [
      { type:'rect', x:.5, y:.22, w:.72, h:.07, seats:8, label:'' },
      { type:'rect', x:.5, y:.5,  w:.72, h:.07, seats:8, label:'' },
      { type:'rect', x:.5, y:.78, w:.72, h:.07, seats:8, label:'' },
    ],
    special:[
      { x:.88, y:.15, emoji:'🎄', sz:30 },
      { x:.12, y:.85, emoji:'🎁', sz:22 },
      { x:.88, y:.85, emoji:'🎁', sz:22 },
    ],
    decos:  [
      { x:.12, y:.08, emoji:'❄️' }, { x:.5, y:.04, emoji:'⭐' }, { x:.88, y:.08, emoji:'❄️' },
    ],
    door: { side:'top', pos:.5 },
  },
  funeral: {
    zones:  [
      { x:.04, y:.04, w:.92, h:.54, color:'rgba(180,180,180,.12)', label:'Seating' },
      { x:.28, y:.64, w:.44, h:.28, color:'rgba(140,140,140,.12)', label:'Service Area' },
    ],
    tables: [
      { type:'rect', x:.5, y:.17, w:.74, h:.055, seats:0 },
      { type:'rect', x:.5, y:.31, w:.74, h:.055, seats:0 },
      { type:'rect', x:.5, y:.45, w:.74, h:.055, seats:0 },
    ],
    special:[
      { x:.5,  y:.76, emoji:'🕊️', sz:24, label:'Podium' },
      { x:.14, y:.76, emoji:'💐', sz:20 },
      { x:.86, y:.76, emoji:'💐', sz:20 },
    ],
    decos:  [
      { x:.12, y:.08, emoji:'🕯️' }, { x:.88, y:.08, emoji:'🕯️' },
    ],
    door: { side:'bottom', pos:.5 },
  },
  halloween: {
    zones:  [
      { x:.04, y:.04, w:.92, h:.88, color:'rgba(255,80,0,.05)', label:'' },
      { x:.24, y:.4,  w:.52, h:.36, color:'rgba(100,0,160,.1)', label:'Dance Floor' },
    ],
    tables: [
      { type:'round', x:.15, y:.2,  r:.08, seats:4 },
      { type:'round', x:.85, y:.2,  r:.08, seats:4 },
      { type:'round', x:.15, y:.72, r:.08, seats:4 },
      { type:'round', x:.85, y:.72, r:.08, seats:4 },
    ],
    special:[
      { x:.5, y:.58, emoji:'🎃', sz:30 },
      { x:.5, y:.05, emoji:'🕷️', sz:16 },
    ],
    decos:  [
      { x:.05, y:.05, emoji:'🦇' }, { x:.95, y:.05, emoji:'🦇' },
      { x:.05, y:.95, emoji:'👻' }, { x:.95, y:.95, emoji:'👻' },
    ],
    door: { side:'top', pos:.5 },
  },
  graduation: {
    zones:  [
      { x:.04, y:.04, w:.92, h:.28, color:'rgba(37,99,235,.15)', label:'Stage' },
      { x:.05, y:.36, w:.9,  h:.58, color:'rgba(219,234,254,.3)', label:'Seating' },
    ],
    tables: [
      { type:'rect', x:.5, y:.48, w:.74, h:.05, seats:0 },
      { type:'rect', x:.5, y:.59, w:.74, h:.05, seats:0 },
      { type:'rect', x:.5, y:.7,  w:.74, h:.05, seats:0 },
      { type:'rect', x:.5, y:.81, w:.74, h:.05, seats:0 },
    ],
    special:[
      { x:.5,  y:.16, emoji:'🎓', sz:26, label:'Podium' },
      { x:.15, y:.16, emoji:'🏆', sz:20 },
      { x:.85, y:.16, emoji:'🏆', sz:20 },
    ],
    decos:  [
      { x:.05, y:.05, emoji:'⭐' }, { x:.5, y:.05, emoji:'🎊' }, { x:.95, y:.05, emoji:'⭐' },
    ],
    door: { side:'bottom', pos:.5 },
  },
  wedding: {
    zones:  [
      { x:.04, y:.04, w:.92, h:.26, color:'rgba(212,175,55,.2)',  label:'Altar' },
      { x:.04, y:.34, w:.44, h:.6,  color:'rgba(255,248,180,.18)', label:'Bride Side' },
      { x:.52, y:.34, w:.44, h:.6,  color:'rgba(255,248,180,.18)', label:'Groom Side' },
    ],
    tables: [
      { type:'rect', x:.22, y:.47, w:.38, h:.048, seats:0 },
      { type:'rect', x:.22, y:.58, w:.38, h:.048, seats:0 },
      { type:'rect', x:.22, y:.69, w:.38, h:.048, seats:0 },
      { type:'rect', x:.22, y:.8,  w:.38, h:.048, seats:0 },
      { type:'rect', x:.78, y:.47, w:.38, h:.048, seats:0 },
      { type:'rect', x:.78, y:.58, w:.38, h:.048, seats:0 },
      { type:'rect', x:.78, y:.69, w:.38, h:.048, seats:0 },
      { type:'rect', x:.78, y:.8,  w:.38, h:.048, seats:0 },
    ],
    special:[
      { x:.5,  y:.14, emoji:'💒', sz:28 },
      { x:.14, y:.14, emoji:'💐', sz:20 },
      { x:.86, y:.14, emoji:'💐', sz:20 },
    ],
    decos:  [
      { x:.5, y:.42, emoji:'🌹' }, { x:.5, y:.57, emoji:'🌹' }, { x:.5, y:.72, emoji:'🌹' },
    ],
    door: { side:'bottom', pos:.5 },
  },
  anniversary: {
    zones:  [{ x:.06, y:.06, w:.88, h:.88, color:'rgba(236,72,153,.07)', label:'Dining' }],
    tables: [
      { type:'round', x:.26, y:.3,  r:.09, seats:2 },
      { type:'round', x:.74, y:.3,  r:.09, seats:2 },
      { type:'round', x:.26, y:.7,  r:.09, seats:2 },
      { type:'round', x:.74, y:.7,  r:.09, seats:2 },
      { type:'round', x:.5,  y:.5,  r:.10, seats:4 },
    ],
    special:[
      { x:.06, y:.5, emoji:'🕯️', sz:18 }, { x:.94, y:.5, emoji:'🕯️', sz:18 },
    ],
    decos:  [
      { x:.06, y:.06, emoji:'💖' }, { x:.94, y:.06, emoji:'💖' },
      { x:.06, y:.94, emoji:'🌹' }, { x:.94, y:.94, emoji:'🌹' },
      { x:.5,  y:.06, emoji:'💖' },
    ],
    door: { side:'bottom', pos:.5 },
  },
  other: {
    zones:  [
      { x:.04, y:.04, w:.92, h:.44, color:'rgba(109,40,217,.1)', label:'Dining Area' },
      { x:.18, y:.52, w:.64, h:.35, color:'rgba(167,139,250,.15)', label:'Dance Floor' },
    ],
    tables: [
      { type:'round', x:.2,  y:.23, r:.085, seats:6 },
      { type:'round', x:.5,  y:.23, r:.085, seats:6 },
      { type:'round', x:.8,  y:.23, r:.085, seats:6 },
      { type:'rect',  x:.87, y:.66, w:.22,  h:.26, label:'DJ Booth' },
      { type:'rect',  x:.5,  y:.92, w:.52,  h:.065, label:'Bar' },
    ],
    special:[{ x:.5, y:.69, emoji:'🎵', sz:22 }],
    decos:  [
      { x:.05, y:.05, emoji:'🎉' }, { x:.95, y:.05, emoji:'🎊' },
      { x:.05, y:.95, emoji:'🎈' }, { x:.95, y:.95, emoji:'🎈' },
    ],
    door: { side:'bottom', pos:.5 },
  },
};

// ── Top-down guest actor ─────────────────────────────────────
class Actor {
  constructor(name, ix, iy, iw, ih, obstacles) {
    this.name      = name;
    this.r         = 11;
    this.hue       = Math.random() * 360;
    this.obstacles = obstacles;
    // start somewhere walkable
    this._bounds   = { ix, iy, iw, ih };
    this.x  = ix + 0.1 * iw + Math.random() * iw * 0.8;
    this.y  = iy + 0.1 * ih + Math.random() * ih * 0.8;
    this.vx = (Math.random() - 0.5) * 0.9;
    this.vy = (Math.random() - 0.5) * 0.9;
  }

  update() {
    const { ix, iy, iw, ih } = this._bounds;
    let nx = this.x + this.vx;
    let ny = this.y + this.vy;

    // Wall bounce
    if (nx < ix + this.r || nx > ix + iw - this.r) { this.vx *= -1; nx = this.x; }
    if (ny < iy + this.r || ny > iy + ih - this.r) { this.vy *= -1; ny = this.y; }

    // Obstacle (table) repulsion
    for (const obs of this.obstacles) {
      const dx = nx - obs.x, dy = ny - obs.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      const minD = obs.r + this.r + 3;
      if (d < minD && d > 0) {
        this.vx += (dx / d) * 0.6;
        this.vy += (dy / d) * 0.6;
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (spd > 1.1) { this.vx = (this.vx / spd) * 1.1; this.vy = (this.vy / spd) * 1.1; }
        nx = this.x; ny = this.y;
      }
    }

    this.x = Math.max(ix + this.r, Math.min(ix + iw - this.r, nx));
    this.y = Math.max(iy + this.r, Math.min(iy + ih - this.r, ny));

    if (Math.random() < 0.007) {
      this.vx = (Math.random() - 0.5) * 0.9;
      this.vy = (Math.random() - 0.5) * 0.9;
    }
  }

  draw(ctx) {
    const { x, y, r } = this;
    // Drop shadow
    ctx.beginPath(); ctx.arc(x + 2.5, y + 3, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
    // Body
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${this.hue},62%,52%)`; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.8; ctx.stroke();
    // Initials
    ctx.fillStyle = 'white'; ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(getInitials(this.name), x, y);
  }
}

// ── Venue drawing helpers ────────────────────────────────────
function simShadow(ctx, fn) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur  = 6;
  ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
  fn();
  ctx.restore();
}

function drawVenueFloor(ctx, W, H, pad, theme) {
  const ix = pad, iy = pad, iw = W - pad * 2, ih = H - pad * 2;
  ctx.fillStyle = theme.floor;
  ctx.fillRect(ix, iy, iw, ih);
  // tile grid
  const ts = Math.max(20, Math.floor(iw / 14));
  ctx.strokeStyle = theme.tile; ctx.lineWidth = 0.6;
  for (let x = ix; x <= ix + iw; x += ts) {
    ctx.beginPath(); ctx.moveTo(x, iy); ctx.lineTo(x, iy + ih); ctx.stroke();
  }
  for (let y = iy; y <= iy + ih; y += ts) {
    ctx.beginPath(); ctx.moveTo(ix, y); ctx.lineTo(ix + iw, y); ctx.stroke();
  }
}

function drawVenueWalls(ctx, W, H, pad, theme, door) {
  const wallColor = theme.wall;
  // four wall slabs
  ctx.fillStyle = wallColor;
  [[0, 0, W, pad], [0, H - pad, W, pad], [0, 0, pad, H], [W - pad, 0, pad, H]]
    .forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));

  // cut door opening
  const dw = Math.max(30, W * 0.1);
  const { side, pos } = door;
  ctx.fillStyle = theme.floor;
  if (side === 'bottom') {
    ctx.fillRect(W * pos - dw / 2, H - pad, dw, pad);
    ctx.fillStyle = '#D0B898';
    ctx.fillRect(W * pos - dw / 2, H - pad, dw, 3);
    ctx.fillRect(W * pos - dw / 2, H - 3, dw, 3);
  } else if (side === 'top') {
    ctx.fillRect(W * pos - dw / 2, 0, dw, pad);
    ctx.fillStyle = '#D0B898';
    ctx.fillRect(W * pos - dw / 2, pad - 3, dw, 3);
    ctx.fillRect(W * pos - dw / 2, 0, dw, 3);
  }

  // inner wall edge (lighter line)
  ctx.strokeStyle = theme.wallEdge; ctx.lineWidth = 2;
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

  // baseboard shadow on floor
  const grad = ctx.createLinearGradient(pad, pad, pad + 12, pad);
  grad.addColorStop(0, 'rgba(0,0,0,0.1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(pad, pad, 12, H - pad * 2);
  const gradT = ctx.createLinearGradient(0, pad, 0, pad + 12);
  gradT.addColorStop(0, 'rgba(0,0,0,0.1)'); gradT.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradT; ctx.fillRect(pad, pad, W - pad * 2, 12);
}

function drawZoneArea(ctx, zone, ix, iy, iw, ih) {
  const x = ix + zone.x * iw, y = iy + zone.y * ih;
  const w = zone.w * iw,       h = zone.h * ih;
  ctx.fillStyle = zone.color;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1; ctx.stroke();
  if (zone.label) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.font = `bold ${Math.max(9, Math.floor(Math.min(w, h) * 0.13))}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(zone.label.toUpperCase(), x + w / 2, y + h / 2);
  }
}

function drawRoundTable(ctx, t, ix, iy, iw, ih, theme) {
  const cx = ix + t.x * iw, cy = iy + t.y * ih, r = t.r * Math.min(iw, ih);
  const seats = t.seats || 0;
  const cw = 12, ch = 8; // chair dimensions

  // chairs first (behind table)
  for (let i = 0; i < seats; i++) {
    const a   = (i / seats) * Math.PI * 2 - Math.PI / 2;
    const cx2 = cx + Math.cos(a) * (r + 9);
    const cy2 = cy + Math.sin(a) * (r + 9);
    ctx.save(); ctx.translate(cx2, cy2); ctx.rotate(a + Math.PI / 2);
    ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 3);
    ctx.fillStyle = theme.chair; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.restore();
  }

  // table shadow + surface
  simShadow(ctx, () => {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = theme.table; ctx.fill();
  });
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  // wood grain ring
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1; ctx.stroke();

  return { x: cx, y: cy, r: r + 9 }; // obstacle radius includes chairs
}

function drawRectTable(ctx, t, ix, iy, iw, ih, theme) {
  const tw = t.w * iw, th = t.h * ih;
  const tx = ix + t.x * iw - tw / 2, ty = iy + t.y * ih - th / 2;
  const cw = 13, ch = 8;

  // chairs on long sides (top & bottom)
  const n = Math.max(1, Math.round(tw / 32));
  for (let i = 0; i < n; i++) {
    const cx = tx + (i + 0.5) * (tw / n);
    // top
    ctx.save(); ctx.translate(cx, ty - 6);
    ctx.beginPath(); ctx.roundRect(-cw / 2, -ch, cw, ch, 3);
    ctx.fillStyle = theme.chair; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.restore();
    // bottom
    ctx.save(); ctx.translate(cx, ty + th + 6);
    ctx.beginPath(); ctx.roundRect(-cw / 2, 0, cw, ch, 3);
    ctx.fillStyle = theme.chair; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.restore();
  }

  simShadow(ctx, () => {
    ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 4);
    ctx.fillStyle = theme.table; ctx.fill();
  });
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 4); ctx.stroke();
  if (t.label) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.font = `bold ${Math.min(11, Math.floor(tw * 0.09))}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.label, tx + tw / 2, ty + th / 2);
  }

  const obstR = Math.max(tw, th) / 2 + 10;
  return { x: tx + tw / 2, y: ty + th / 2, r: obstR };
}

function drawSpecialItem(ctx, s, ix, iy, iw, ih) {
  const cx = ix + s.x * iw, cy = iy + s.y * ih, sz = s.sz || 24;
  // soft halo
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 0.9);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.arc(cx, cy, sz * 0.9, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
  ctx.font = `${sz}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(s.emoji, cx, cy);
  if (s.label) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(s.label, cx, cy + sz * 0.72);
  }
}

function drawDecoItem(ctx, d, ix, iy, iw, ih, t) {
  const cx = ix + d.x * iw, cy = iy + d.y * ih;
  const bob = Math.sin(t * 0.04 + d.x * 13) * 3;
  ctx.font = '17px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(d.emoji, cx, cy + bob);
}

// ── Simulator floating particles (top-down overlay) ──────────
class SimParticle {
  constructor(W, H, type) {
    this.W = W; this.H = H; this.type = type;
    this.reset(true);
  }
  reset(scatter = false) {
    this.x   = Math.random() * this.W;
    this.y   = scatter ? Math.random() * this.H : -15;
    this.vx  = (Math.random() - 0.5) * (this.type === 'bats' ? 2 : 0.8);
    this.vy  = this.type === 'bats' ? (Math.random() - 0.5) * 1.2 : Math.random() * 1.1 + 0.4;
    this.rot = Math.random() * Math.PI * 2;
    this.rs  = (Math.random() - 0.5) * 0.08;
    this.sz  = Math.random() * 5 + 4;
    this.hue = Math.random() * 360;
    this.op  = 0.55 + Math.random() * 0.3;
    if (this.type === 'bats') {
      const left = Math.random() < 0.5;
      this.x  = scatter ? this.x : (left ? -20 : this.W + 20);
      this.vx = left ? Math.random() * 2 + 1 : -(Math.random() * 2 + 1);
      this.vy = (Math.random() - 0.5) * 1.2;
      this.sz = Math.random() * 10 + 14;
    }
  }
  update() {
    this.x += this.vx; this.y += this.vy; this.rot += this.rs;
    const gone = this.type === 'bats'
      ? (this.x < -30 || this.x > this.W + 30)
      : this.y > this.H + 20;
    if (gone) this.reset(false);
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(this.rot);
    ctx.globalAlpha = this.op;
    const { type, sz } = this;
    if (type === 'confetti') {
      ctx.fillStyle = `hsl(${this.hue},80%,60%)`;
      ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2);
    } else if (type === 'snow') {
      ctx.beginPath(); ctx.arc(0, 0, sz / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fill();
    } else {
      const g = { hearts:'❤️', petals:'🌸', bats:'🦇' };
      ctx.font = `${sz}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g[type] || '✨', 0, 0);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
}

let actors = [], simParticles = [], simCanvas, simCtx;

function setupSimulator() {
  const ev  = getCurrentEvent(); if (!ev) return;
  const c   = CAT[ev.category]     || CAT.other;
  const th  = VENUE_THEME[ev.category]  || VENUE_THEME.other;
  const lay = VENUE_LAYOUT[ev.category] || VENUE_LAYOUT.other;
  const dt  = ev.date ? new Date(ev.date + 'T00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) : 'TBD';
  const acts   = [...(ev.activities || [])].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const guests = ev.guests || [];
  const coming = guests.filter(g => g.rsvp === 'yes').length;

  // ── Info panels
  document.getElementById('sim-summary').innerHTML = `
    <p><strong>${c.icon} ${escHtml(ev.name)}</strong></p>
    <p>📅 ${dt}${ev.time ? ' at ' + ev.time : ''}</p>
    ${ev.location ? `<p>📍 ${escHtml(ev.location)}</p>` : ''}
    ${ev.theme    ? `<p>✨ Theme: ${escHtml(ev.theme)}</p>` : ''}`;

  const bubbles = guests.slice(0, 14).map(g =>
    `<div class="sim-guest-bubble" title="${escHtml(g.name)}">${getInitials(g.name)}</div>`).join('');
  const extra = guests.length > 14
    ? `<div class="sim-guest-bubble more">+${guests.length - 14}</div>` : '';
  document.getElementById('sim-guests').innerHTML = `
    <div class="sim-guest-bubbles">${bubbles}${extra}</div>
    <p class="sim-stat">${guests.length} invited · ${coming} confirmed</p>`;

  document.getElementById('sim-timeline').innerHTML = !acts.length
    ? '<p class="empty-msg" style="padding:12px">No activities planned yet.</p>'
    : `<div class="timeline">${acts.map(a => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <span class="timeline-time">${a.time || '?'}</span>
          <span class="timeline-name">${escHtml(a.name)}</span>
          ${a.duration ? `<span class="timeline-dur">${a.duration}m</span>` : ''}
        </div>`).join('')}</div>`;

  // ── Canvas setup
  const wrap = document.querySelector('.simulator-scene-wrap');
  simCanvas  = document.getElementById('sim-canvas');
  simCanvas.width  = wrap.clientWidth || 640;
  simCanvas.height = Math.round(simCanvas.width * 0.6);
  simCtx = simCanvas.getContext('2d');

  const W = simCanvas.width, H = simCanvas.height;
  const pad = Math.round(Math.min(W, H) * 0.07); // wall thickness
  const ix = pad, iy = pad, iw = W - pad * 2, ih = H - pad * 2;

  // Build obstacle list from table positions (absolute px)
  const obstacles = [];
  for (const t of lay.tables) {
    if (t.type === 'round') {
      const r = t.r * Math.min(iw, ih);
      obstacles.push({ x: ix + t.x * iw, y: iy + t.y * ih, r: r + 12 });
    } else {
      const tw = t.w * iw, th = t.h * ih;
      const cx = ix + t.x * iw, cy = iy + t.y * ih;
      obstacles.push({ x: cx, y: cy, r: Math.max(tw, th) / 2 + 12 });
    }
  }

  // Create guest actors
  const gList = guests.length ? guests.slice(0, 16) : [{ name:'Alex' },{ name:'Sam' },{ name:'Jordan' }];
  actors = gList.map(g => new Actor(g.name, ix, iy, iw, ih, obstacles));

  // Create ambient particles
  simParticles = [];
  if (th.particle !== 'none') {
    const n = th.particle === 'bats' ? 10 : 20;
    for (let i = 0; i < n; i++) simParticles.push(new SimParticle(W, H, th.particle));
  }

  state.simTime = 0;
  drawFrame();
}

function drawFrame() {
  if (!simCanvas || !simCtx) return;
  const ev  = getCurrentEvent(); if (!ev) return;
  const c   = CAT[ev.category]          || CAT.other;
  const th  = VENUE_THEME[ev.category]  || VENUE_THEME.other;
  const lay = VENUE_LAYOUT[ev.category] || VENUE_LAYOUT.other;

  const W = simCanvas.width, H = simCanvas.height, ctx = simCtx;
  const pad = Math.round(Math.min(W, H) * 0.07);
  const ix = pad, iy = pad, iw = W - pad * 2, ih = H - pad * 2;
  const t = state.simTime;

  // ── 1. outer background (exterior)
  ctx.fillStyle = '#C8B49A'; ctx.fillRect(0, 0, W, H);

  // ── 2. floor tiles
  drawVenueFloor(ctx, W, H, pad, th);

  // ── 3. zone areas (dining, dance floor, stage…)
  for (const zone of lay.zones) drawZoneArea(ctx, zone, ix, iy, iw, ih);

  // ── 4. walls + door cutout
  drawVenueWalls(ctx, W, H, pad, th, lay.door);

  // ── 5. furniture (chairs drawn inside helper before table top)
  for (const tbl of lay.tables) {
    if (tbl.type === 'round') drawRoundTable(ctx, tbl, ix, iy, iw, ih, th);
    else                      drawRectTable(ctx, tbl, ix, iy, iw, ih, th);
  }

  // ── 6. special items (cake, podium, DJ…)
  for (const s of lay.special) drawSpecialItem(ctx, s, ix, iy, iw, ih);

  // ── 7. corner/edge decorations (animated bounce)
  for (const d of lay.decos) drawDecoItem(ctx, d, ix, iy, iw, ih, t);

  // ── 8. event name label (subtle, bottom-centre of room)
  ctx.font = `bold ${Math.max(11, Math.floor(iw * 0.028))}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillText(`${c.icon} ${ev.name}`, ix + iw / 2, iy + ih - 6);

  // ── 9. ambient particles (snow/confetti/hearts drifting across floor view)
  simParticles.forEach(p => { p.update(); p.draw(ctx); });

  // ── 10. actors (top-down, with shadow)
  actors.forEach(a => { a.update(); a.draw(ctx); });

  // ── 11. compass / scale indicator (Google Maps feel)
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.roundRect(W - pad - 36, iy + 6, 36, 18, 4); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('FLOOR PLAN', W - pad - 18, iy + 15);

  state.simTime++;
  if (state.simRunning) {
    state.simFrame = requestAnimationFrame(drawFrame);
  }
}

function toggleSimulator() {
  const btn = document.getElementById('btn-run-simulator');
  if (state.simRunning) {
    stopSimulator();
  } else {
    state.simRunning = true;
    btn.textContent = '⏸ Pause';
    drawFrame();
  }
}

function stopSimulator() {
  state.simRunning = false;
  if (state.simFrame) { cancelAnimationFrame(state.simFrame); state.simFrame = null; }
  const btn = document.getElementById('btn-run-simulator');
  if (btn) btn.textContent = '▶ Run Simulation';
}

// ── Toggle helpers ──────────────────────────────────────────
function toggleForm(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── Login form ──────────────────────────────────────────
  let loginMode = 'signin'; // 'signin' | 'signup'

  function setLoginMode(mode) {
    loginMode = mode;
    document.getElementById('tab-signin').classList.toggle('active', mode === 'signin');
    document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
    document.getElementById('confirm-group').style.display = mode === 'signup' ? 'block' : 'none';
    document.getElementById('login-submit').textContent    = mode === 'signup' ? 'Create Account' : 'Sign In';
    document.getElementById('login-error').textContent     = '';
  }

  document.getElementById('tab-signin').addEventListener('click', () => setLoginMode('signin'));
  document.getElementById('tab-signup').addEventListener('click', () => setLoginMode('signup'));

  document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const username  = document.getElementById('login-username').value.trim().toLowerCase();
    const password  = document.getElementById('login-password').value;
    const confirm   = document.getElementById('login-confirm').value;
    const errorEl   = document.getElementById('login-error');
    const accounts  = getAccounts();

    if (!username || username.length < 2) {
      errorEl.textContent = 'Username must be at least 2 characters.'; return;
    }
    if (!password || password.length < 4) {
      errorEl.textContent = 'Password must be at least 4 characters.'; return;
    }

    if (loginMode === 'signup') {
      if (accounts[username]) { errorEl.textContent = 'Username already taken — try signing in.'; return; }
      if (password !== confirm) { errorEl.textContent = 'Passwords do not match.'; return; }
      accounts[username] = password;
      saveAccounts(accounts);
      loginUser(username);
    } else {
      if (!accounts[username] || accounts[username] !== password) {
        errorEl.textContent = 'Incorrect username or password.'; return;
      }
      loginUser(username);
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', logoutUser);

  // ── Sidebar nav ─────────────────────────────────────────
  document.querySelector('.nav-btn[data-view="dashboard"]').addEventListener('click', () => {
    stopSimulator(); showView('dashboard');
  });
  document.getElementById('nav-create').addEventListener('click', () => openCreateForm());

  // Dashboard buttons
  document.getElementById('btn-create-event').addEventListener('click', () => openCreateForm());
  document.getElementById('empty-create-btn').addEventListener('click', () => openCreateForm());

  // Category filter
  document.getElementById('category-filter').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDashboard();
  });

  // Create form — category picker
  document.querySelectorAll('.category-option').forEach(label => {
    label.addEventListener('click', () => {
      document.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
      label.classList.add('selected');
    });
  });

  // Create form — save / cancel
  document.getElementById('event-form').addEventListener('submit', saveEvent);
  document.getElementById('cancel-create').addEventListener('click', () => { stopSimulator(); showView('dashboard'); });
  document.getElementById('back-from-create').addEventListener('click', () => { stopSimulator(); showView('dashboard'); });

  // Event detail — back / edit / delete
  document.getElementById('back-to-dashboard').addEventListener('click', () => { stopSimulator(); showView('dashboard'); });
  document.getElementById('btn-edit-event').addEventListener('click', () => openCreateForm(state.currentEventId));
  document.getElementById('btn-delete-event').addEventListener('click', () => {
    deleteEvent(state.currentEventId);
    showView('dashboard');
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Guests
  document.getElementById('btn-add-guest').addEventListener('click', () => toggleForm('add-guest-form'));
  document.getElementById('cancel-add-guest').addEventListener('click', () => { document.getElementById('add-guest-form').style.display = 'none'; });
  document.getElementById('save-guest').addEventListener('click', addGuest);

  // Activities
  document.getElementById('btn-add-activity').addEventListener('click', () => toggleForm('add-activity-form'));
  document.getElementById('cancel-add-activity').addEventListener('click', () => { document.getElementById('add-activity-form').style.display = 'none'; });
  document.getElementById('save-activity').addEventListener('click', addActivity);

  // Notes
  document.getElementById('btn-add-note').addEventListener('click', () => toggleForm('add-note-form'));
  document.getElementById('cancel-add-note').addEventListener('click', () => { document.getElementById('add-note-form').style.display = 'none'; });
  document.getElementById('save-note').addEventListener('click', addNote);
  document.getElementById('show-hidden-notes').addEventListener('change', renderNotes);

  // Simulator
  document.getElementById('btn-run-simulator').addEventListener('click', toggleSimulator);

  // ── Auto-resume saved session ───────────────────────────
  const saved = localStorage.getItem('pp_session');
  if (saved && getAccounts()[saved]) {
    loginUser(saved);
  }
});
