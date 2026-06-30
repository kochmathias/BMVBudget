/* =============================================
   VEREINSBUDGET – APP.JS  v3
   Angepasst: Alle 7 Änderungspunkte
   ============================================= */

// ─── STATE ────────────────────────────────────
let state = {
  clubName: 'Blasmusik Steiermark',
  logo: null,
  years: [2024, 2025, 2026, 2027],
  activeYear: 2025,
  data: {},
  users: [
    { id: 'u1', name: 'Administrator', email: 'admin@verein.at', role: 'admin', password: 'admin123', active: true }
  ],
  currentUser: null
};

// ─── PERSISTENCE ──────────────────────────────
function saveState() {
  const toSave = { ...state, currentUser: null };
  localStorage.setItem('vereinsbudget_v3', JSON.stringify(toSave));
}
function loadState() {
  const raw = localStorage.getItem('vereinsbudget_v3');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed, currentUser: null };
    } catch(e) {}
  }
  ensureYearData(state.activeYear);
}
function ensureYearData(year) {
  if (!state.data[year]) {
    state.data[year] = { referate: [], buchungssaetze: [], freigaben: {}, validierungen: {}, timestamps: [] };
  }
  if (!state.data[year].timestamps) state.data[year].timestamps = [];
  if (!state.data[year].validierungen) state.data[year].validierungen = {};
}
function getYearData(year) {
  ensureYearData(year || state.activeYear);
  return state.data[year || state.activeYear];
}

// ─── UTILS ────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(n || 0);
}
function fmtDiff(n) {
  const s = fmt(Math.abs(n));
  return n >= 0 ? '+' + s : '−' + s;
}
function abwPct(ist, budget) {
  if (!budget) return '—';
  return (((ist - budget) / budget) * 100).toFixed(1) + ' %';
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-AT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), duration);
}

// ─── ROLLEN ───────────────────────────────────
// Rollen: leser | schreiber | validierer | freigeber | admin
function getRoleLabel(role) {
  return {
    admin:       'Administrator',
    freigeber:   'Freigeber',
    validierer:  'Validierer',
    schreiber:   'Schreiber',
    leser:       'Leser'
  }[role] || role;
}
function getRoleBadgeClass(role) {
  return {
    admin:      'badge-danger',
    freigeber:  'badge-success',
    validierer: 'badge-gold',
    schreiber:  'badge-blue',
    leser:      'badge-neutral'
  }[role] || 'badge-neutral';
}
function avatarColor(role) {
  return {
    admin:      '#991b1b',
    freigeber:  '#1e6b2e',
    validierer: '#8b6914',
    schreiber:  '#1d4ed8',
    leser:      '#4a5c4d'
  }[role] || '#4a5c4d';
}

// Berechtigungsprüfungen
function canWrite()     { return state.currentUser && ['admin','freigeber','validierer','schreiber'].includes(state.currentUser.role); }
function canValidate()  { return state.currentUser && ['admin','freigeber','validierer'].includes(state.currentUser.role); }
function canFreigeben() { return state.currentUser && ['admin','freigeber'].includes(state.currentUser.role); }
function isAdmin()      { return state.currentUser && state.currentUser.role === 'admin'; }

function isBudgetFreigegeben() {
  const d = getYearData();
  return !!(d.freigaben && d.freigaben[state.activeYear]);
}
function isIstGesperrt(buchungId) {
  // Ist-Wert ist gesperrt sobald er gespeichert wurde (istGesperrt-Flag) – nur Admin kann aufheben
  const d = getYearData();
  const b = (d.buchungssaetze || []).find(x => x.id === buchungId);
  return b && b.istGesperrt === true;
}

// ─── AUTH ──────────────────────────────────────
function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  // Anmeldung mit Name ODER E-Mail
  const user = state.users.find(u =>
    (u.name === username || u.email === username) &&
    u.password === password &&
    u.active !== false
  );
  if (!user) {
    document.getElementById('loginError').classList.remove('hidden');
    return;
  }
  state.currentUser = user;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initApp();
}
function doLogout() {
  state.currentUser = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').classList.add('hidden');
}
document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

// ─── INIT ──────────────────────────────────────
function initApp() {
  const u = state.currentUser;
  document.getElementById('userNameDisplay').textContent = u.name;
  document.getElementById('userRoleDisplay').textContent = getRoleLabel(u.role);
  document.getElementById('userAvatar').textContent = u.name[0].toUpperCase();
  document.getElementById('userAvatar').style.background = avatarColor(u.role);
  document.getElementById('navBenutzer').style.display = isAdmin() ? '' : 'none';
  updateClubDisplay();
  populateYearSelect();
  navigate('dashboard');
}
function updateClubDisplay() {
  document.getElementById('sidebarClubName').textContent = state.clubName;
  document.getElementById('sidebarYear').textContent = state.activeYear;
  document.getElementById('dashboardTitle').textContent = state.clubName;
  document.getElementById('dashboardSub').textContent = `Finanzplanung ${state.activeYear}`;
  document.getElementById('loginClubName').textContent = state.clubName;
  document.title = state.clubName + ' – Budget';
  if (state.logo) {
    document.getElementById('sidebarLogo').src = state.logo;
    document.getElementById('sidebarLogo').classList.remove('hidden');
    document.getElementById('sidebarLogoMark').classList.add('hidden');
  } else {
    document.getElementById('sidebarLogo').classList.add('hidden');
    document.getElementById('sidebarLogoMark').classList.remove('hidden');
  }
}
function populateYearSelect() {
  const sel = document.getElementById('yearSelect');
  sel.innerHTML = state.years.map(y =>
    `<option value="${y}" ${y == state.activeYear ? 'selected' : ''}>${y}</option>`
  ).join('');
}
function changeYear(y) {
  state.activeYear = parseInt(y);
  ensureYearData(state.activeYear);
  updateClubDisplay();
  saveState();
  navigate(currentPage);
}

// ─── NAVIGATION ───────────────────────────────
let currentPage = 'dashboard';
let chartInstances = {};

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const titles = {
    dashboard: 'Dashboard', referate: 'Referate', budget: 'Budgetplanung',
    istWerte: 'Ist-Werte', auswertung: 'Auswertung',
    benutzer: 'Benutzerverwaltung', einstellungen: 'Einstellungen'
  };
  document.getElementById('topbarTitle').textContent = titles[page] || page;
  if (page === 'dashboard')    renderDashboard();
  if (page === 'referate')     renderReferate();
  if (page === 'budget')       renderBudgetPageInit();
  if (page === 'istWerte')     renderIstPageInit();
  if (page === 'auswertung')   renderAuswertungInit();
  if (page === 'benutzer')     renderBenutzer();
  if (page === 'einstellungen') renderEinstellungen();
  if (window.innerWidth < 768) closeSidebar();
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('hidden');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.add('hidden');
}

// ─── CHART HELPERS ─────────────────────────────
function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}
const C = {
  greenDark: '#1a5c2a', greenMid: '#2e7d3a', greenLight: '#c8e6cc',
  gold: '#8b6914', goldLight: '#c49a28', goldPale: '#f5e9c0',
  danger: '#991b1b', dangerLight: '#fecaca',
  text2: '#4a5c4d', border: '#dde5de'
};

// ─── DASHBOARD – Punkte 3: Overlapping Balken ──
function renderDashboard() {
  const d = getYearData();
  const bs = d.buchungssaetze || [];

  const budgetEin = bs.filter(b => b.typ==='einnahme').reduce((s,b) => s+(b.budget||0), 0);
  const budgetAus = bs.filter(b => b.typ==='ausgabe').reduce((s,b) => s+(b.budget||0), 0);
  const istEin    = bs.filter(b => b.typ==='einnahme').reduce((s,b) => s+(b.ist||0), 0);
  const istAus    = bs.filter(b => b.typ==='ausgabe').reduce((s,b) => s+(b.ist||0), 0);
  const saldo     = budgetEin - budgetAus;
  const istSaldo  = istEin - istAus;

  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi-card green">
      <div class="kpi-label">Budget Einnahmen</div>
      <div class="kpi-value">${fmt(budgetEin)}</div>
      <div class="kpi-sub">Plan ${state.activeYear}</div>
    </div>
    <div class="kpi-card gold">
      <div class="kpi-label">Budget Ausgaben</div>
      <div class="kpi-value">${fmt(budgetAus)}</div>
      <div class="kpi-sub">Plan ${state.activeYear}</div>
    </div>
    <div class="kpi-card ${saldo >= 0 ? 'green' : 'danger'}">
      <div class="kpi-label">Geplanter Saldo</div>
      <div class="kpi-value ${saldo >= 0 ? 'positive' : 'negative'}">${fmt(saldo)}</div>
      <div class="kpi-sub">Einnahmen − Ausgaben</div>
    </div>
    <div class="kpi-card ${istSaldo >= 0 ? 'green' : 'danger'}">
      <div class="kpi-label">Ist-Saldo</div>
      <div class="kpi-value ${istSaldo >= 0 ? 'positive' : 'negative'}">${fmt(istSaldo)}</div>
      <div class="kpi-sub">Tatsächlich bisher</div>
    </div>
    <div class="kpi-card neutral">
      <div class="kpi-label">Referate</div>
      <div class="kpi-value">${(d.referate||[]).length}</div>
      <div class="kpi-sub">angelegt</div>
    </div>
    <div class="kpi-card neutral">
      <div class="kpi-label">Buchungssätze</div>
      <div class="kpi-value">${bs.length}</div>
      <div class="kpi-sub">gesamt</div>
    </div>`;

  // ── Gesamtdiagramm: Budget ÜBEREINANDER über Ist (overlapping grouped)
  destroyChart('chartOverall');
  const ctxO = document.getElementById('chartOverall').getContext('2d');
  // Saldo-Farben dynamisch
  const saldoBudgetColor = saldo >= 0 ? 'rgba(46,125,58,0.85)' : 'rgba(153,27,27,0.85)';
  const saldoIstColor    = istSaldo >= 0 ? 'rgba(196,154,40,0.85)' : 'rgba(220,80,80,0.85)';
  chartInstances['chartOverall'] = new Chart(ctxO, {
    type: 'bar',
    data: {
      labels: ['Einnahmen', 'Ausgaben', 'Saldo'],
      datasets: [
        {
          label: 'Budget (Plan)',
          data: [budgetEin, budgetAus, saldo],
          backgroundColor: [
            'rgba(26,92,42,0.85)', 'rgba(26,92,42,0.85)', saldoBudgetColor
          ],
          borderColor: ['#1a5c2a','#1a5c2a', saldo>=0?'#1a5c2a':'#991b1b'],
          borderWidth: 2,
          borderRadius: 5,
          barPercentage: 0.7,
          categoryPercentage: 0.75,
          order: 2
        },
        {
          label: 'Ist (tatsächlich)',
          data: [istEin, istAus, istSaldo],
          backgroundColor: [
            'rgba(196,154,40,0.75)', 'rgba(196,154,40,0.75)', saldoIstColor
          ],
          borderColor: ['#c49a28','#c49a28', istSaldo>=0?'#c49a28':'#dc2626'],
          borderWidth: 2,
          borderRadius: 5,
          barPercentage: 0.42,
          categoryPercentage: 0.75,
          order: 1
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { font: { family:'DM Sans', size:12 }, color: C.text2 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: { grid: { color: C.border }, ticks: { font: { family:'DM Sans', size:11 }, color: C.text2 } },
        y: { grid: { color: C.border }, ticks: { font: { family:'DM Sans', size:11 }, color: C.text2, callback: v => '€' + v.toLocaleString('de-AT') } }
      }
    }
  });

  // ── Pie-Chart: Ausgaben je Referat
  const referate = d.referate || [];
  const pieData = referate.map(r => ({
    name: r.name,
    val: bs.filter(b => b.referatId===r.id && b.typ==='ausgabe').reduce((s,b) => s+(b.budget||0), 0)
  })).filter(x => x.val > 0);

  destroyChart('chartPie');
  const ctxP = document.getElementById('chartPie').getContext('2d');
  const greens = ['#1a5c2a','#2e7d3a','#3a9048','#4ea85a','#68bb72','#8b6914','#c49a28','#e8c84a'];
  chartInstances['chartPie'] = new Chart(ctxP, {
    type: 'doughnut',
    data: {
      labels: pieData.map(x => x.name),
      datasets: [{ data: pieData.map(x => x.val), backgroundColor: greens, borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: { family:'DM Sans', size:11 }, color: C.text2, boxWidth:12 } } }
    }
  });

  // ── Referate-Balken: overlapping Budget über Ist je Referat
  const refLabels   = referate.map(r => r.name);
  const rBudgetEin  = referate.map(r => bs.filter(b => b.referatId===r.id && b.typ==='einnahme').reduce((s,b)=>s+(b.budget||0),0));
  const rBudgetAus  = referate.map(r => bs.filter(b => b.referatId===r.id && b.typ==='ausgabe').reduce((s,b)=>s+(b.budget||0),0));
  const rIstEin     = referate.map(r => bs.filter(b => b.referatId===r.id && b.typ==='einnahme').reduce((s,b)=>s+(b.ist||0),0));
  const rIstAus     = referate.map(r => bs.filter(b => b.referatId===r.id && b.typ==='ausgabe').reduce((s,b)=>s+(b.ist||0),0));

  destroyChart('chartReferate');
  const ctxR = document.getElementById('chartReferate').getContext('2d');
  chartInstances['chartReferate'] = new Chart(ctxR, {
    type: 'bar',
    data: {
      labels: refLabels,
      datasets: [
        { label: 'Budget Einnahmen', data: rBudgetEin, backgroundColor: 'rgba(26,92,42,0.85)',  borderRadius:4, barPercentage:0.7, categoryPercentage:0.8, order:2 },
        { label: 'Ist Einnahmen',    data: rIstEin,    backgroundColor: 'rgba(46,125,58,0.45)', borderRadius:4, barPercentage:0.42, categoryPercentage:0.8, order:1 },
        { label: 'Budget Ausgaben',  data: rBudgetAus, backgroundColor: 'rgba(139,105,20,0.85)',borderRadius:4, barPercentage:0.7, categoryPercentage:0.8, order:2 },
        { label: 'Ist Ausgaben',     data: rIstAus,    backgroundColor: 'rgba(196,154,40,0.5)', borderRadius:4, barPercentage:0.42, categoryPercentage:0.8, order:1 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { font:{ family:'DM Sans', size:11 }, color: C.text2 } } },
      scales: {
        x: { grid:{ color: C.border }, ticks:{ font:{ family:'DM Sans', size:10 }, color: C.text2 } },
        y: { grid:{ color: C.border }, ticks:{ font:{ family:'DM Sans', size:11 }, color: C.text2, callback: v=>'€'+v.toLocaleString('de-AT') } }
      }
    }
  });
}

// ─── REFERATE ──────────────────────────────────
function renderReferate() {
  const d = getYearData();
  const referate = d.referate || [];
  const bs = d.buchungssaetze || [];
  const el = document.getElementById('referateList');

  if (!referate.length) {
    el.innerHTML = `<div class="card" style="text-align:center;padding:2.5rem;color:var(--text-3)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36" style="margin:0 auto .75rem;opacity:.4"><path d="M3 7h18M3 12h18M3 17h12"/></svg>
      <p>Noch keine Referate angelegt.</p>
      ${canWrite() ? `<button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="openReferatModal()">Erstes Referat anlegen</button>` : ''}
    </div>`;
    return;
  }

  el.innerHTML = referate.map(r => {
    const rBs = bs.filter(b => b.referatId === r.id);
    const budgetEin = rBs.filter(b => b.typ==='einnahme').reduce((s,b)=>s+(b.budget||0),0);
    const budgetAus = rBs.filter(b => b.typ==='ausgabe').reduce((s,b)=>s+(b.budget||0),0);
    const saldo = budgetEin - budgetAus;
    const freigegeben = !!(d.freigaben||{})[r.id];
    const einRows = rBs.filter(b => b.typ==='einnahme');
    const ausRows = rBs.filter(b => b.typ==='ausgabe');

    return `<div class="referat-card">
      <div class="referat-card-header" onclick="toggleReferatCard('rc-${r.id}')">
        <div>
          <div class="referat-name">${r.name}
            ${freigegeben ? '<span class="freigabe-badge" style="margin-left:.5rem">✓ Freigegeben</span>' : ''}
          </div>
          <div class="referat-meta">${state.clubName} · ${rBs.length} Buchungssätze</div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem">
          ${canWrite() && !freigegeben ? `
            <button class="icon-btn" title="Buchungssatz hinzufügen" onclick="event.stopPropagation();openBuchungModal('${r.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <button class="icon-btn" title="Referat bearbeiten" onclick="event.stopPropagation();openReferatModal('${r.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          ` : ''}
          ${isAdmin() ? `
            <button class="icon-btn danger" title="Referat löschen" onclick="event.stopPropagation();deleteReferat('${r.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          ` : ''}
          <svg class="chevron" id="chev-${r.id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="referat-card-body hidden" id="rc-${r.id}">
        <div class="referat-stats">
          <div class="referat-stat"><div class="referat-stat-label">Budget Einnahmen</div>
            <div class="referat-stat-value" style="color:var(--success)">${fmt(budgetEin)}</div></div>
          <div class="referat-stat"><div class="referat-stat-label">Budget Ausgaben</div>
            <div class="referat-stat-value" style="color:var(--gold)">${fmt(budgetAus)}</div></div>
          <div class="referat-stat"><div class="referat-stat-label">Saldo</div>
            <div class="referat-stat-value" style="color:${saldo>=0?'var(--success)':'var(--danger)'}">${fmt(saldo)}</div></div>
        </div>
        ${einRows.length ? `<div class="buchung-section"><div class="buchung-section-title">Einnahmen</div>${einRows.map(b => buchungRow(b, r.id, freigegeben)).join('')}</div>` : ''}
        ${ausRows.length ? `<div class="buchung-section"><div class="buchung-section-title">Ausgaben</div>${ausRows.map(b => buchungRow(b, r.id, freigegeben)).join('')}</div>` : ''}
        ${!rBs.length ? `<p style="color:var(--text-3);font-size:.82rem;padding:.5rem .25rem">Noch keine Buchungssätze.
          ${canWrite()&&!freigegeben?`<button class="btn btn-sm btn-primary" onclick="openBuchungModal('${r.id}')">Hinzufügen</button>`:''}</p>` : ''}
      </div>
    </div>`;
  }).join('');
}

function buchungRow(b, referatId, gesperrt) {
  return `<div class="buchung-row">
    <div class="status-dot ${b.typ}"></div>
    <div class="buchung-name">${b.bezeichnung}${b.kategorie?`<span style="margin-left:.5rem;font-size:.72rem;color:var(--text-3)">${b.kategorie}</span>`:''}
      ${b.validiert ? `<span class="badge badge-gold" style="margin-left:.4rem;font-size:.65rem">✓ Validiert</span>` : ''}
    </div>
    <div class="buchung-amount">${fmt(b.budget)}</div>
    ${canWrite()&&!gesperrt ? `
    <button class="icon-btn" title="Bearbeiten" onclick="openBuchungModal('${referatId}','${b.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>
    <button class="icon-btn danger" title="Löschen" onclick="deleteBuchung('${b.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
    </button>` : ''}
  </div>`;
}
function toggleReferatCard(id) {
  const body = document.getElementById(id);
  const chev = document.getElementById('chev-' + id.replace('rc-',''));
  if (body) body.classList.toggle('hidden');
  if (chev) chev.classList.toggle('open');
}

// ─── REFERAT MODAL ─────────────────────────────
function openReferatModal(id) {
  const d = getYearData();
  const r = id ? d.referate.find(x => x.id === id) : null;
  document.getElementById('modalTitle').textContent = r ? 'Referat bearbeiten' : 'Referat anlegen';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label class="form-label">Name des Referats *</label>
      <input type="text" id="mReferatName" class="form-input" value="${r?r.name:''}" placeholder="z. B. Jugendreferat" />
    </div>
    <div class="form-group">
      <label class="form-label">Beschreibung</label>
      <input type="text" id="mReferatDesc" class="form-input" value="${r?(r.desc||''):''}" placeholder="Optional" />
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeAllModals()">Abbrechen</button>
      <button class="btn btn-primary" onclick="saveReferat('${id||''}')">Speichern</button>
    </div>`;
  openModal();
  setTimeout(()=>document.getElementById('mReferatName').focus(),100);
}
function saveReferat(id) {
  const name = document.getElementById('mReferatName').value.trim();
  if (!name) { showToast('Bitte einen Namen eingeben.'); return; }
  const d = getYearData();
  if (id) {
    const r = d.referate.find(x => x.id===id);
    if (r) { r.name=name; r.desc=document.getElementById('mReferatDesc').value.trim(); }
  } else {
    d.referate.push({ id:uid(), name, desc:document.getElementById('mReferatDesc').value.trim() });
  }
  saveState(); closeAllModals(); renderReferate();
  showToast(id?'Referat aktualisiert.':'Referat angelegt.');
}
function deleteReferat(id) {
  if (!confirm('Referat und alle zugehörigen Buchungssätze wirklich löschen?')) return;
  const d = getYearData();
  d.referate = d.referate.filter(r=>r.id!==id);
  d.buchungssaetze = d.buchungssaetze.filter(b=>b.referatId!==id);
  saveState(); renderReferate(); showToast('Referat gelöscht.');
}

// ─── BUCHUNGSSATZ MODAL ────────────────────────
function openBuchungModal(referatId, buchungId) {
  const d = getYearData();
  const b = buchungId ? d.buchungssaetze.find(x=>x.id===buchungId) : null;
  document.getElementById('modalTitle').textContent = b ? 'Buchungssatz bearbeiten' : 'Buchungssatz anlegen';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label class="form-label">Bezeichnung *</label>
      <input type="text" id="mBName" class="form-input" value="${b?b.bezeichnung:''}" placeholder="z. B. Mitgliedsbeiträge" />
    </div>
    <div class="form-group">
      <label class="form-label">Typ *</label>
      <select id="mBTyp" class="form-select">
        <option value="einnahme" ${b&&b.typ==='einnahme'?'selected':''}>Einnahme</option>
        <option value="ausgabe" ${!b||b.typ==='ausgabe'?'selected':''}>Ausgabe</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Budgetierter Betrag (€) *</label>
      <input type="number" id="mBBudget" class="form-input" value="${b?(b.budget||''):''}" placeholder="0,00" min="0" step="0.01" />
    </div>
    <div class="form-group">
      <label class="form-label">Kategorie / Kostenstelle</label>
      <input type="text" id="mBKat" class="form-input" value="${b?(b.kategorie||''):''}" placeholder="Optional" />
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <input type="text" id="mBNotiz" class="form-input" value="${b?(b.notiz||''):''}" placeholder="Optional" />
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeAllModals()">Abbrechen</button>
      <button class="btn btn-primary" onclick="saveBuchung('${referatId}','${buchungId||''}')">Speichern</button>
    </div>`;
  openModal();
  setTimeout(()=>document.getElementById('mBName').focus(),100);
}
function saveBuchung(referatId, buchungId) {
  const bezeichnung = document.getElementById('mBName').value.trim();
  const budget = parseFloat(document.getElementById('mBBudget').value) || 0;
  if (!bezeichnung) { showToast('Bezeichnung erforderlich.'); return; }
  const d = getYearData();
  if (buchungId) {
    const b = d.buchungssaetze.find(x=>x.id===buchungId);
    if (b) {
      b.bezeichnung=bezeichnung; b.typ=document.getElementById('mBTyp').value;
      b.budget=budget; b.kategorie=document.getElementById('mBKat').value.trim();
      b.notiz=document.getElementById('mBNotiz').value.trim();
    }
  } else {
    d.buchungssaetze.push({
      id:uid(), referatId, bezeichnung,
      typ:document.getElementById('mBTyp').value,
      budget, ist:0, istGesperrt:false, validiert:false,
      kategorie:document.getElementById('mBKat').value.trim(),
      notiz:document.getElementById('mBNotiz').value.trim()
    });
  }
  saveState(); closeAllModals(); renderReferate();
  showToast(buchungId?'Buchungssatz aktualisiert.':'Buchungssatz angelegt.');
}
function deleteBuchung(id) {
  if (!confirm('Buchungssatz wirklich löschen?')) return;
  const d = getYearData();
  d.buchungssaetze = d.buchungssaetze.filter(b=>b.id!==id);
  saveState(); renderReferate(); showToast('Buchungssatz gelöscht.');
}

// ─── BUDGET PAGE ───────────────────────────────
function renderBudgetPageInit() {
  const d = getYearData();
  const sel = document.getElementById('budgetReferatSelect');
  sel.innerHTML = `<option value="all">Gesamtverein</option>` +
    (d.referate||[]).map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  renderBudgetPage();
}
function renderBudgetPage() {
  const d = getYearData();
  const val = document.getElementById('budgetReferatSelect').value;
  const referate = val==='all' ? (d.referate||[]) : (d.referate||[]).filter(r=>r.id===val);
  const el = document.getElementById('budgetContent');
  const gesperrt = isBudgetFreigegeben();

  let html = '';
  if (gesperrt) html += `<div class="freigabe-banner">✓ Das Budget für ${state.activeYear} wurde freigegeben und ist schreibgeschützt.</div>`;

  referate.forEach(r => {
    const rBs = (d.buchungssaetze||[]).filter(b=>b.referatId===r.id);
    const ein = rBs.filter(b=>b.typ==='einnahme');
    const aus = rBs.filter(b=>b.typ==='ausgabe');
    const totalEin = ein.reduce((s,b)=>s+(b.budget||0),0);
    const totalAus = aus.reduce((s,b)=>s+(b.budget||0),0);
    const rFreigegeben = !!(d.freigaben||{})[r.id];
    const rValidiert   = !!(d.validierungen||{})[r.id];
    const writeable = canWrite() && !rFreigegeben && !gesperrt;

    // Validierungs-Zeitstempel
    const tsVal = (d.timestamps||[]).filter(t=>t.type==='validierung'&&t.referatId===r.id).slice(-1)[0];
    const tsFrei = (d.timestamps||[]).filter(t=>t.type==='freigabe_referat'&&t.referatId===r.id).slice(-1)[0];

    html += `<div class="section-card">
      <div class="section-card-header">
        <span class="section-card-title">${state.clubName} – ${r.name}
          ${rValidiert?`<span class="badge badge-gold" style="margin-left:.5rem">✓ Validiert</span>`:''}
          ${rFreigegeben?`<span class="freigabe-badge" style="margin-left:.4rem">✓ Freigegeben</span>`:''}
        </span>
        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
          <span class="badge badge-success">Ein. ${fmt(totalEin)}</span>
          <span class="badge badge-gold">Aus. ${fmt(totalAus)}</span>
          ${writeable ? `<button class="btn btn-sm btn-primary" onclick="openBuchungModal('${r.id}')">+ Buchungssatz</button>` : ''}
          ${canValidate()&&!rValidiert&&!rFreigegeben&&!gesperrt ? `<button class="btn btn-sm btn-outline" onclick="validierenReferat('${r.id}')">✓ Validieren</button>` : ''}
          ${canFreigeben()&&rValidiert&&!rFreigegeben&&!gesperrt ? `<button class="btn btn-sm btn-primary" onclick="freigebenReferat('${r.id}')">✓ Freigeben</button>` : ''}
          ${isAdmin()&&(rFreigegeben||rValidiert) ? `<button class="btn btn-sm btn-danger" onclick="aufhebenReferat('${r.id}')">Aufheben</button>` : ''}
        </div>
      </div>
      ${tsVal||tsFrei ? `<div style="padding:.6rem 1.25rem;background:var(--bg);border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text-3);display:flex;gap:1.5rem;flex-wrap:wrap">
        ${tsVal?`<span>Validiert: <strong>${tsVal.user}</strong> · ${fmtDateTime(tsVal.at)}${tsVal.bemerkung?' · „'+tsVal.bemerkung+'"':''}</span>`:''}
        ${tsFrei?`<span>Freigegeben: <strong>${tsFrei.user}</strong> · ${fmtDateTime(tsFrei.at)}${tsFrei.bemerkung?' · „'+tsFrei.bemerkung+'"':''}</span>`:''}
      </div>` : ''}
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Bezeichnung</th><th>Kategorie</th><th>Typ</th>
            <th style="text-align:right">Budget</th>
            ${writeable?'<th></th>':''}
          </tr></thead>
          <tbody>
            ${rBs.length ? rBs.map(b=>`
            <tr>
              <td>${b.bezeichnung}${b.notiz?`<span style="display:block;font-size:.72rem;color:var(--text-3)">${b.notiz}</span>`:''}
                ${b.validiert?`<span class="badge badge-gold" style="font-size:.65rem">✓</span>`:''}
              </td>
              <td>${b.kategorie||'—'}</td>
              <td><span class="badge ${b.typ==='einnahme'?'badge-success':'badge-gold'}">${b.typ==='einnahme'?'Einnahme':'Ausgabe'}</span></td>
              <td class="td-mono" style="text-align:right">${fmt(b.budget)}</td>
              ${writeable?`<td><div class="td-actions">
                <button class="icon-btn" onclick="openBuchungModal('${r.id}','${b.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button class="icon-btn danger" onclick="deleteBuchung('${b.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg></button>
              </div></td>`:''}
            </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:1.5rem">Noch keine Buchungssätze.</td></tr>`}
            <tr class="total-row">
              <td colspan="3"><strong>Gesamt ${r.name}</strong></td>
              <td class="td-mono" style="text-align:right"><strong>${fmt(totalEin-totalAus)}</strong></td>
              ${writeable?'<td></td>':''}
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
  });

  if (val==='all' && referate.length) {
    const allBs = d.buchungssaetze||[];
    const gEin = allBs.filter(b=>b.typ==='einnahme').reduce((s,b)=>s+(b.budget||0),0);
    const gAus = allBs.filter(b=>b.typ==='ausgabe').reduce((s,b)=>s+(b.budget||0),0);
    const tsBudget = (d.timestamps||[]).filter(t=>t.type==='freigabe_budget'&&t.year===state.activeYear).slice(-1)[0];
    const tsAufhebung = (d.timestamps||[]).filter(t=>t.type==='aufhebung_budget'&&t.year===state.activeYear).slice(-1)[0];
    html += `<div class="card" style="margin-top:1rem;border-left:4px solid var(--green-dark)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
        <strong style="color:var(--green-dark)">${state.clubName} – Gesamtbudget ${state.activeYear}</strong>
        <div style="display:flex;gap:1rem;font-family:'DM Mono',monospace;font-size:.9rem">
          <span style="color:var(--success)">+ ${fmt(gEin)}</span>
          <span style="color:var(--gold)">− ${fmt(gAus)}</span>
          <strong style="color:${gEin-gAus>=0?'var(--success)':'var(--danger)'}">${fmt(gEin-gAus)}</strong>
        </div>
      </div>
      ${tsBudget?`<div style="font-size:.75rem;color:var(--text-3);margin-top:.5rem">
        Freigegeben: <strong>${tsBudget.user}</strong> · ${fmtDateTime(tsBudget.at)}${tsBudget.bemerkung?' · „'+tsBudget.bemerkung+'"':''}
      </div>`:''}
      ${tsAufhebung?`<div style="font-size:.75rem;color:var(--warning);margin-top:.25rem">
        Aufgehoben: <strong>${tsAufhebung.user}</strong> · ${fmtDateTime(tsAufhebung.at)}${tsAufhebung.bemerkung?' · „'+tsAufhebung.bemerkung+'"':''}
      </div>`:''}
      <div style="margin-top:1rem;display:flex;gap:.6rem;flex-wrap:wrap">
        ${canFreigeben()&&!gesperrt ? `<button class="btn btn-primary" onclick="freigebenGesamtbudget()">✓ Gesamtbudget freigeben</button>` : ''}
        ${isAdmin()&&gesperrt ? `<button class="btn btn-danger" onclick="widerrufenGesamtbudget()">Freigabe widerrufen</button>` : ''}
      </div>
    </div>`;
  }

  el.innerHTML = html || `<div class="card" style="text-align:center;padding:2rem;color:var(--text-3)">Kein Referat ausgewählt.</div>`;
}

// ─── VALIDIERUNG / FREIGABE mit Zeitstempel-Popup ─
function openBemerkungModal(title, onConfirm) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label class="form-label">Bemerkung (optional)</label>
      <textarea id="mBemerkung" class="form-input" rows="3" placeholder="Optionale Notiz zur Aktion …" style="resize:vertical"></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeAllModals()">Abbrechen</button>
      <button class="btn btn-primary" id="mBemerkungConfirm">Bestätigen</button>
    </div>`;
  openModal();
  document.getElementById('mBemerkungConfirm').onclick = () => {
    const bem = document.getElementById('mBemerkung').value.trim();
    closeAllModals();
    onConfirm(bem);
  };
}
function addTimestamp(type, extra, bemerkung) {
  const d = getYearData();
  if (!d.timestamps) d.timestamps = [];
  d.timestamps.push({
    type, bemerkung: bemerkung||'',
    user: state.currentUser.name,
    at: new Date().toISOString(),
    year: state.activeYear,
    ...extra
  });
}

function validierenReferat(referatId) {
  openBemerkungModal('Referat validieren', bem => {
    const d = getYearData();
    if (!d.validierungen) d.validierungen = {};
    d.validierungen[referatId] = { by: state.currentUser.name, at: new Date().toISOString() };
    addTimestamp('validierung', { referatId }, bem);
    saveState(); renderBudgetPage(); showToast('Referat validiert.');
  });
}
function freigebenReferat(referatId) {
  openBemerkungModal('Referat freigeben', bem => {
    const d = getYearData();
    if (!d.freigaben) d.freigaben = {};
    d.freigaben[referatId] = { by: state.currentUser.name, at: new Date().toISOString() };
    addTimestamp('freigabe_referat', { referatId }, bem);
    saveState(); renderBudgetPage(); showToast('Referat freigegeben.');
  });
}
function aufhebenReferat(referatId) {
  openBemerkungModal('Freigabe / Validierung aufheben', bem => {
    const d = getYearData();
    if (d.freigaben) delete d.freigaben[referatId];
    if (d.validierungen) delete d.validierungen[referatId];
    addTimestamp('aufhebung_referat', { referatId }, bem);
    saveState(); renderBudgetPage(); showToast('Aufhebung durchgeführt.');
  });
}
function freigebenGesamtbudget() {
  openBemerkungModal('Gesamtbudget freigeben', bem => {
    const d = getYearData();
    if (!d.freigaben) d.freigaben = {};
    d.freigaben[state.activeYear] = { by: state.currentUser.name, at: new Date().toISOString() };
    addTimestamp('freigabe_budget', {}, bem);
    saveState(); renderBudgetPage(); showToast('Gesamtbudget freigegeben.');
  });
}
function widerrufenGesamtbudget() {
  openBemerkungModal('Gesamtbudget-Freigabe widerrufen', bem => {
    const d = getYearData();
    if (d.freigaben) delete d.freigaben[state.activeYear];
    addTimestamp('aufhebung_budget', {}, bem);
    saveState(); renderBudgetPage(); showToast('Freigabe widerrufen.');
  });
}

// ─── IST-WERTE – Punkt 4: Sperren nach Speichern ─
function renderIstPageInit() {
  const d = getYearData();
  const sel = document.getElementById('istReferatSelect');
  sel.innerHTML = `<option value="all">Gesamtverein</option>` +
    (d.referate||[]).map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  renderIstPage();
}
function renderIstPage() {
  const d = getYearData();
  const val = document.getElementById('istReferatSelect').value;
  const referate = val==='all' ? (d.referate||[]) : (d.referate||[]).filter(r=>r.id===val);
  const el = document.getElementById('istContent');
  const userCanWrite = canWrite();

  let html = '';
  referate.forEach(r => {
    const rBs = (d.buchungssaetze||[]).filter(b=>b.referatId===r.id);
    html += `<div class="section-card" style="margin-bottom:1.25rem">
      <div class="section-card-header">
        <span class="section-card-title">${state.clubName} – ${r.name}: Ist-Werte</span>
        <span style="font-size:.75rem;color:var(--text-3)">Gespeicherte Ist-Werte sind gesperrt${isAdmin()?' (Admin kann aufheben)':''}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Bezeichnung</th><th>Typ</th>
            <th style="text-align:right">Budget</th>
            <th style="text-align:right">Ist-Wert</th>
            <th style="text-align:right">Abweichung</th>
            <th>Status</th>
          </tr></thead>
          <tbody>
            ${rBs.length ? rBs.map(b => {
              const abw = (b.ist||0) - (b.budget||0);
              const abwP = b.budget ? ((abw/b.budget)*100) : 0;
              const abwClass = Math.abs(abwP)<=5?'abweichung-pos':abwP>5?'abweichung-neg':'abweichung-warn';
              const gesperrt = b.istGesperrt === true;
              // Timestamp für diesen Buchungssatz
              const tsIst = (d.timestamps||[]).filter(t=>t.type==='ist_gespeichert'&&t.buchungId===b.id).slice(-1)[0];
              const tsAuf = (d.timestamps||[]).filter(t=>t.type==='ist_aufgehoben'&&t.buchungId===b.id).slice(-1)[0];
              return `<tr>
                <td>
                  <div><strong>${b.bezeichnung}</strong></div>
                  ${tsIst?`<div style="font-size:.7rem;color:var(--text-3)">Gespeichert: ${tsIst.user} · ${fmtDateTime(tsIst.at)}${tsIst.bemerkung?' · „'+tsIst.bemerkung+'"':''}</div>`:''}
                  ${tsAuf?`<div style="font-size:.7rem;color:var(--warning)">Entsperrt: ${tsAuf.user} · ${fmtDateTime(tsAuf.at)}${tsAuf.bemerkung?' · „'+tsAuf.bemerkung+'"':''}</div>`:''}
                </td>
                <td><span class="badge ${b.typ==='einnahme'?'badge-success':'badge-gold'}">${b.typ==='einnahme'?'Einnahme':'Ausgabe'}</span></td>
                <td class="td-mono" style="text-align:right">${fmt(b.budget)}</td>
                <td class="td-mono" style="text-align:right">
                  ${userCanWrite&&!gesperrt ? `
                    <div style="display:flex;gap:.4rem;justify-content:flex-end;align-items:center">
                      <input type="number" id="ist-${b.id}" class="form-input"
                        style="width:110px;padding:.35rem .5rem;font-family:'DM Mono',monospace;font-size:.82rem;text-align:right"
                        value="${b.ist||''}" placeholder="0,00" step="0.01" min="0" />
                      <button class="btn btn-sm btn-primary" onclick="speichernIst('${b.id}')">Speichern</button>
                    </div>` :
                    `<span>${fmt(b.ist)}</span>`
                  }
                </td>
                <td class="td-mono ${abwClass}" style="text-align:right">${b.ist!=null&&b.ist!==''?fmtDiff(abw)+' ('+abwP.toFixed(1)+' %)':'—'}</td>
                <td>
                  ${gesperrt ? `<span class="badge badge-success">Gesperrt</span>
                    ${isAdmin()?`<button class="btn btn-sm btn-danger" style="margin-left:.4rem" onclick="entsperrenIst('${b.id}')">Entsperren</button>`:''}` :
                    `<span class="badge badge-neutral">Offen</span>`}
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:1.5rem">Keine Buchungssätze vorhanden.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  });
  el.innerHTML = html || `<div class="card" style="text-align:center;padding:2rem;color:var(--text-3)">Kein Referat ausgewählt.</div>`;
}

function speichernIst(buchungId) {
  const input = document.getElementById('ist-' + buchungId);
  if (!input) return;
  const value = parseFloat(input.value) || 0;
  openBemerkungModal('Ist-Wert speichern & sperren', bem => {
    const d = getYearData();
    const b = d.buchungssaetze.find(x=>x.id===buchungId);
    if (b) {
      b.ist = value;
      b.istGesperrt = true;
      addTimestamp('ist_gespeichert', { buchungId }, bem);
    }
    saveState(); renderIstPage(); showToast('Ist-Wert gespeichert und gesperrt.');
  });
}
function entsperrenIst(buchungId) {
  openBemerkungModal('Ist-Wert entsperren (Admin)', bem => {
    const d = getYearData();
    const b = d.buchungssaetze.find(x=>x.id===buchungId);
    if (b) {
      b.istGesperrt = false;
      addTimestamp('ist_aufgehoben', { buchungId }, bem);
    }
    saveState(); renderIstPage(); showToast('Ist-Wert entsperrt.');
  });
}

// ─── AUSWERTUNG ────────────────────────────────
function renderAuswertungInit() {
  const d = getYearData();
  const sel = document.getElementById('auswertungSelect');
  sel.innerHTML = `<option value="all">Gesamtverein</option>` +
    (d.referate||[]).map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  renderAuswertung();
}
function renderAuswertung() {
  const d = getYearData();
  const val = document.getElementById('auswertungSelect').value;
  const referate = val==='all' ? (d.referate||[]) : (d.referate||[]).filter(r=>r.id===val);
  const allBs = d.buchungssaetze||[];
  const el = document.getElementById('auswertungContent');
  const title = val==='all'
    ? `${state.clubName} – Gesamtübersicht ${state.activeYear}`
    : `${state.clubName} – ${referate[0]?.name} ${state.activeYear}`;
  document.getElementById('auswertungChartTitle').textContent = 'Budget vs. Ist – ' + (val==='all'?'Gesamtverein':referate[0]?.name);

  let html = `<div class="section-card" style="margin-bottom:1.25rem">
    <div class="section-card-header"><span class="section-card-title">${title}</span></div>
    <div class="table-wrap">
      <table class="soll-ist-table">
        <thead><tr>
          <th>Referat</th><th>Bezeichnung</th><th>Typ</th>
          <th style="text-align:right">Budget</th>
          <th style="text-align:right">Ist</th>
          <th style="text-align:right">Abweichung</th>
          <th style="text-align:right">in %</th>
        </tr></thead><tbody>`;

  let gBudgetEin=0, gBudgetAus=0, gIstEin=0, gIstAus=0;
  referate.forEach(r => {
    const rBs = allBs.filter(b=>b.referatId===r.id);
    rBs.forEach(b => {
      const abw = (b.ist||0) - (b.budget||0);
      const abwP = b.budget ? ((abw/b.budget)*100) : 0;
      const cls = Math.abs(abwP)<=5?'abweichung-pos':abwP>5?'abweichung-neg':'abweichung-warn';
      if (b.typ==='einnahme') { gBudgetEin+=b.budget||0; gIstEin+=b.ist||0; }
      else { gBudgetAus+=b.budget||0; gIstAus+=b.ist||0; }
      html += `<tr>
        <td style="white-space:nowrap">${r.name}</td>
        <td>${b.bezeichnung}</td>
        <td><span class="badge ${b.typ==='einnahme'?'badge-success':'badge-gold'}">${b.typ==='einnahme'?'Einnahme':'Ausgabe'}</span></td>
        <td class="td-mono" style="text-align:right">${fmt(b.budget)}</td>
        <td class="td-mono" style="text-align:right">${fmt(b.ist)}</td>
        <td class="td-mono ${cls}" style="text-align:right">${fmtDiff(abw)}</td>
        <td class="td-mono ${cls}" style="text-align:right">${abwPct(b.ist,b.budget)}</td>
      </tr>`;
    });
  });

  const gSaldoBudget = gBudgetEin - gBudgetAus;
  const gSaldoIst = gIstEin - gIstAus;
  html += `<tr class="total-row">
    <td colspan="3"><strong>Gesamt</strong></td>
    <td class="td-mono" style="text-align:right"><strong>${fmt(gSaldoBudget)}</strong></td>
    <td class="td-mono" style="text-align:right"><strong>${fmt(gSaldoIst)}</strong></td>
    <td class="td-mono" style="text-align:right"><strong>${fmtDiff(gSaldoIst-gSaldoBudget)}</strong></td>
    <td class="td-mono" style="text-align:right"><strong>${abwPct(gSaldoIst,gSaldoBudget)}</strong></td>
  </tr></tbody></table></div></div>`;
  el.innerHTML = html;

  // Overlapping chart für Auswertung
  destroyChart('chartAuswertung');
  const ctxA = document.getElementById('chartAuswertung').getContext('2d');
  if (val==='all') {
    const saldoBudgetColor = gSaldoBudget>=0?'rgba(26,92,42,0.85)':'rgba(153,27,27,0.85)';
    const saldoIstColor    = gSaldoIst>=0?'rgba(196,154,40,0.85)':'rgba(220,80,80,0.85)';
    chartInstances['chartAuswertung'] = new Chart(ctxA, {
      type:'bar',
      data:{
        labels:['Einnahmen','Ausgaben','Saldo'],
        datasets:[
          { label:'Budget', data:[gBudgetEin,gBudgetAus,gSaldoBudget], backgroundColor:['rgba(26,92,42,0.85)','rgba(26,92,42,0.85)',saldoBudgetColor], borderRadius:4, barPercentage:0.7, order:2 },
          { label:'Ist',    data:[gIstEin,gIstAus,gSaldoIst],          backgroundColor:['rgba(196,154,40,0.7)','rgba(196,154,40,0.7)',saldoIstColor],   borderRadius:4, barPercentage:0.42, order:1 }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{ font:{family:'DM Sans',size:12}, color:C.text2 } },
          tooltip:{ callbacks:{ label: ctx=>` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } } },
        scales:{
          x:{ grid:{color:C.border}, ticks:{font:{family:'DM Sans',size:11},color:C.text2} },
          y:{ grid:{color:C.border}, ticks:{font:{family:'DM Sans',size:11},color:C.text2, callback:v=>'€'+v.toLocaleString('de-AT')} }
        }
      }
    });
  } else {
    const rBs = allBs.filter(b=>b.referatId===val);
    chartInstances['chartAuswertung'] = new Chart(ctxA, {
      type:'bar',
      data:{
        labels: rBs.map(b=>b.bezeichnung.substring(0,20)),
        datasets:[
          { label:'Budget', data:rBs.map(b=>b.budget||0), backgroundColor:'rgba(26,92,42,0.85)', borderRadius:4, barPercentage:0.7, order:2 },
          { label:'Ist',    data:rBs.map(b=>b.ist||0),    backgroundColor:'rgba(196,154,40,0.7)', borderRadius:4, barPercentage:0.42, order:1 }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{ font:{family:'DM Sans',size:12}, color:C.text2 } },
          tooltip:{ callbacks:{ label:ctx=>` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } } },
        scales:{
          x:{ grid:{color:C.border}, ticks:{font:{family:'DM Sans',size:11},color:C.text2} },
          y:{ grid:{color:C.border}, ticks:{font:{family:'DM Sans',size:11},color:C.text2, callback:v=>'€'+v.toLocaleString('de-AT')} }
        }
      }
    });
  }

  // Pie Ausgaben
  const ausData = referate.map(r=>({
    name:r.name,
    val:allBs.filter(b=>b.referatId===r.id&&b.typ==='ausgabe').reduce((s,b)=>s+(b.ist||b.budget||0),0)
  })).filter(x=>x.val>0);
  destroyChart('chartAuswertungPie');
  document.getElementById('auswertungPieWrap').style.display = ausData.length?'':'none';
  if (ausData.length) {
    const ctxAP = document.getElementById('chartAuswertungPie').getContext('2d');
    chartInstances['chartAuswertungPie'] = new Chart(ctxAP, {
      type:'doughnut',
      data:{ labels:ausData.map(x=>x.name), datasets:[{ data:ausData.map(x=>x.val), backgroundColor:['#1a5c2a','#2e7d3a','#4ea85a','#8b6914','#c49a28','#e8c84a','#68bb72','#3a8f48'], borderWidth:2, borderColor:'#fff' }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ font:{family:'DM Sans',size:11}, color:C.text2 } } } }
    });
  }
}

// ─── BENUTZER – Punkte 2, 2a ───────────────────
function renderBenutzer() {
  const el = document.getElementById('benutzerList');
  el.innerHTML = state.users.map(u => `
    <div class="benutzer-card">
      <div class="benutzer-avatar" style="background:${avatarColor(u.role)}">${u.name[0].toUpperCase()}</div>
      <div class="benutzer-info">
        <div class="benutzer-name">${u.name} ${u.id===state.currentUser.id?'<span class="badge badge-neutral" style="margin-left:.3rem">Ich</span>':''}</div>
        <div class="benutzer-email">${u.email||'—'}</div>
        <div style="font-size:.72rem;color:var(--text-3);margin-top:.15rem">Passwort: <code style="background:var(--bg);padding:.1rem .35rem;border-radius:3px;font-size:.72rem">${u.password}</code></div>
      </div>
      <span class="badge ${getRoleBadgeClass(u.role)}">${getRoleLabel(u.role)}</span>
      <div class="benutzer-actions">
        <button class="icon-btn" onclick="openBenutzerModal('${u.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        ${u.id!==state.currentUser.id?`
        <button class="icon-btn danger" onclick="deleteBenutzer('${u.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
        </button>`:''}
      </div>
    </div>`).join('');
}
function openBenutzerModal(id) {
  const u = id ? state.users.find(x=>x.id===id) : null;
  document.getElementById('modalTitle').textContent = u ? 'Benutzer bearbeiten' : 'Benutzer anlegen';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label class="form-label">Name *</label>
      <input type="text" id="mUName" class="form-input" value="${u?u.name:''}" placeholder="Vollständiger Name" />
    </div>
    <div class="form-group">
      <label class="form-label">E-Mail * <span style="font-size:.72rem;color:var(--text-3)">(Pflicht – für Anmeldung)</span></label>
      <input type="email" id="mUEmail" class="form-input" value="${u?u.email:''}" placeholder="email@verein.at" required />
    </div>
    <div class="form-group">
      <label class="form-label">Rolle *</label>
      <select id="mURole" class="form-select">
        <option value="leser"      ${u?.role==='leser'?'selected':''}>🔵 Leser – nur Daten einsehen</option>
        <option value="schreiber"  ${u?.role==='schreiber'?'selected':''}>🟡 Schreiber – Buchungssätze &amp; Ist-Werte</option>
        <option value="validierer" ${u?.role==='validierer'?'selected':''}>🟠 Validierer – Buchungssätze &amp; Ist-Werte validieren</option>
        <option value="freigeber"  ${u?.role==='freigeber'?'selected':''}>🟢 Freigeber – Validierung + Gesamtfreigabe</option>
        <option value="admin"      ${u?.role==='admin'?'selected':''}>🔴 Administrator – alle Rechte</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">${u?'Passwort ändern (leer = unverändert)':'Passwort *'}</label>
      <input type="text" id="mUPw" class="form-input" value="${u?u.password:''}" placeholder="${u?'Leer lassen für keine Änderung':'Passwort festlegen'}" />
      <span style="font-size:.72rem;color:var(--text-3)">Passwort ist im Klartextformat sichtbar (lokale Anwendung)</span>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeAllModals()">Abbrechen</button>
      <button class="btn btn-primary" onclick="saveBenutzer('${id||''}')">Speichern</button>
    </div>`;
  openModal();
}
function saveBenutzer(id) {
  const name  = document.getElementById('mUName').value.trim();
  const email = document.getElementById('mUEmail').value.trim();
  const role  = document.getElementById('mURole').value;
  const pw    = document.getElementById('mUPw').value;
  if (!name)  { showToast('Name erforderlich.'); return; }
  if (!email) { showToast('E-Mail erforderlich.'); return; }
  if (!id && !pw) { showToast('Passwort erforderlich.'); return; }
  if (id) {
    const u = state.users.find(x=>x.id===id);
    if (u) { u.name=name; u.email=email; u.role=role; if(pw) u.password=pw; }
  } else {
    state.users.push({ id:uid(), name, email, role, password:pw, active:true });
  }
  saveState(); closeAllModals(); renderBenutzer();
  showToast(id?'Benutzer aktualisiert.':'Benutzer angelegt.');
}
function deleteBenutzer(id) {
  if (!confirm('Benutzer wirklich löschen?')) return;
  state.users = state.users.filter(u=>u.id!==id);
  saveState(); renderBenutzer(); showToast('Benutzer gelöscht.');
}

// ─── EINSTELLUNGEN ─────────────────────────────
function renderEinstellungen() {
  document.getElementById('settingsClubName').value = state.clubName;
  if (state.logo) {
    document.getElementById('logoPreview').src = state.logo;
    document.getElementById('logoPreview').classList.remove('hidden');
    document.getElementById('logoUploadPlaceholder').classList.add('hidden');
  }
  renderYearList();
}
function saveSettings() {
  const name = document.getElementById('settingsClubName').value.trim();
  if (!name) { showToast('Vereinsname erforderlich.'); return; }
  state.clubName = name;
  saveState(); updateClubDisplay(); showToast('Einstellungen gespeichert.');
}
function handleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    state.logo = e.target.result;
    document.getElementById('logoPreview').src = state.logo;
    document.getElementById('logoPreview').classList.remove('hidden');
    document.getElementById('logoUploadPlaceholder').classList.add('hidden');
    saveState(); updateClubDisplay(); showToast('Logo gespeichert.');
  };
  reader.readAsDataURL(file);
}
function renderYearList() {
  document.getElementById('yearList').innerHTML = state.years.map(y=>`
    <div class="year-item ${y==state.activeYear?'active-year':''}">
      <span>${y}${y==state.activeYear?' (aktiv)':''}</span>
      ${y!=state.activeYear?`<button class="icon-btn danger" onclick="removeYear(${y})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`:''}
    </div>`).join('');
}
function addYear() {
  const y = parseInt(document.getElementById('newYearInput').value);
  if (!y||y<2020||y>2040) { showToast('Gültiges Jahr eingeben (2020–2040).'); return; }
  if (state.years.includes(y)) { showToast('Jahr bereits vorhanden.'); return; }
  state.years.push(y); state.years.sort(); ensureYearData(y);
  saveState(); renderYearList(); populateYearSelect();
  document.getElementById('newYearInput').value = '';
  showToast(`Jahr ${y} hinzugefügt.`);
}
function removeYear(y) {
  if (!confirm(`Jahr ${y} und alle zugehörigen Daten löschen?`)) return;
  state.years = state.years.filter(x=>x!==y);
  delete state.data[y];
  saveState(); renderYearList(); populateYearSelect(); showToast(`Jahr ${y} entfernt.`);
}

// ─── EXPORT / IMPORT ───────────────────────────
function exportJSON() {
  const blob = new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`vereinsbudget_${state.clubName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url); showToast('Daten exportiert.');
}
function importJSON(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.users||!imported.data) throw new Error('Ungültiges Format');
      if (!confirm('Alle aktuellen Daten werden überschrieben. Fortfahren?')) return;
      state = { ...state, ...imported, currentUser:null };
      saveState();
      document.getElementById('app').classList.add('hidden');
      document.getElementById('loginScreen').classList.remove('hidden');
      showToast('Daten importiert. Bitte erneut anmelden.');
    } catch(e) { showToast('Fehler beim Import: '+e.message); }
  };
  reader.readAsText(file); input.value='';
}

// ─── PDF EXPORT – Punkt 7: Querformat, korrekte Werte, Zeitstempel ─
async function exportPDF() {
  showToast('PDF wird erstellt …', 10000);
  const { jsPDF } = window.jspdf;
  // Querformat A4
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
  const W = 297, H = 210, M = 14;
  let y = 0;
  const d = getYearData();
  const allBs = d.buchungssaetze||[];
  const referate = d.referate||[];

  // ── Hilfsfunktionen ──────────────────────────
  function pdfHeader() {
    doc.setFillColor(26,92,42);
    doc.rect(0,0,W,16,'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text(state.clubName, M, 10);
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.text(`Finanzplanung ${state.activeYear}`, M, 15);
    // Logo oben rechts
    if (state.logo) {
      try { doc.addImage(state.logo,'PNG', W-30, 1, 14, 14,'','FAST'); } catch(e) {}
    }
  }
  function pdfFooter(pageNum) {
    const total = doc.getNumberOfPages();
    doc.setFillColor(26,92,42);
    doc.rect(0,H-10,W,10,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont('helvetica','normal');
    doc.text(state.clubName, M, H-4);
    doc.text(`Erstellt: ${new Date().toLocaleString('de-AT')}`, W/2, H-4, {align:'center'});
    doc.text(`Seite ${pageNum} / ${total}`, W-M, H-4, {align:'right'});
  }

  // ── DECKBLATT ───────────────────────────────
  pdfHeader();
  doc.setTextColor(26,92,42);
  doc.setFontSize(26); doc.setFont('helvetica','bold');
  doc.text('Budgetbericht', W/2, 70, {align:'center'});
  doc.setFontSize(16); doc.setFont('helvetica','normal');
  doc.setTextColor(74,92,77);
  doc.text(state.clubName, W/2, 84, {align:'center'});
  doc.setFontSize(12);
  doc.text(`Planungsjahr: ${state.activeYear}`, W/2, 96, {align:'center'});
  doc.setFontSize(9); doc.setTextColor(122,140,125);
  doc.text(`Erstellt am: ${new Date().toLocaleString('de-AT')}`, W/2, 106, {align:'center'});
  doc.text(`Erstellt von: ${state.currentUser?.name||'—'}`, W/2, 113, {align:'center'});

  if (state.logo) {
    try { doc.addImage(state.logo,'PNG', W/2-25, 120, 50, 50,'','FAST'); } catch(e) {}
  }

  // Freigabe-Zeitstempel auf Deckblatt
  const tsBudget = (d.timestamps||[]).filter(t=>t.type==='freigabe_budget'&&t.year===state.activeYear).slice(-1)[0];
  if (tsBudget) {
    y = 175;
    doc.setFillColor(232,245,234); doc.rect(M, y-6, W-2*M, 14, 'F');
    doc.setTextColor(26,92,42); doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text('✓ Budget freigegeben', M+3, y);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(74,92,77);
    doc.text(`${tsBudget.user}  ·  ${fmtDateTime(tsBudget.at)}${tsBudget.bemerkung?'  ·  „'+tsBudget.bemerkung+'"':''}`, M+3, y+5.5);
  }
  pdfFooter(1);

  // ── SEITE PRO REFERAT ──────────────────────
  for (const r of referate) {
    doc.addPage();
    pdfHeader(); pdfFooter(doc.getNumberOfPages());
    y = 24;

    doc.setTextColor(26,92,42); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text(`${state.clubName}  –  ${r.name}`, M, y); y += 6;

    // Validierungs- / Freigabe-Zeitstempel
    const tsVal  = (d.timestamps||[]).filter(t=>t.type==='validierung'&&t.referatId===r.id).slice(-1)[0];
    const tsFrei = (d.timestamps||[]).filter(t=>t.type==='freigabe_referat'&&t.referatId===r.id).slice(-1)[0];
    if (tsVal||tsFrei) {
      doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(122,140,125);
      if (tsVal)  doc.text(`Validiert: ${tsVal.user}  ·  ${fmtDateTime(tsVal.at)}${tsVal.bemerkung?' · „'+tsVal.bemerkung+'"':''}`,  M, y); y += 4.5;
      if (tsFrei) doc.text(`Freigegeben: ${tsFrei.user}  ·  ${fmtDateTime(tsFrei.at)}${tsFrei.bemerkung?' · „'+tsFrei.bemerkung+'"':''}`, M, y); y += 5;
    } else { y += 2; }

    const rBs = allBs.filter(b=>b.referatId===r.id);
    if (!rBs.length) {
      doc.setFontSize(9); doc.setTextColor(122,140,125);
      doc.text('Keine Buchungssätze vorhanden.', M, y);
      continue;
    }

    // Spalten: Bezeichnung | Kategorie | Typ | Budget | Ist | Abweichung | %
    const cols = { bez:M, kat:90, typ:130, bud:165, ist:200, abw:235, pct:272 };

    // Tabellenkopf
    doc.setFillColor(26,92,42); doc.rect(M, y, W-2*M, 7,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('Bezeichnung', cols.bez+2, y+5);
    doc.text('Kategorie',   cols.kat+2, y+5);
    doc.text('Typ',         cols.typ+2, y+5);
    doc.text('Budget',      cols.bud,   y+5, {align:'right'});
    doc.text('Ist-Wert',    cols.ist,   y+5, {align:'right'});
    doc.text('Abweichung',  cols.abw,   y+5, {align:'right'});
    doc.text('%',           cols.pct,   y+5, {align:'right'});
    y += 7;

    let budgetEin=0,budgetAus=0,istEin=0,istAus=0;
    rBs.forEach((b,i) => {
      if (y > H-18) { doc.addPage(); pdfHeader(); pdfFooter(doc.getNumberOfPages()); y=24; }
      doc.setFillColor(i%2===0?247:255, i%2===0?248:255, i%2===0?246:255);
      doc.rect(M, y, W-2*M, 7,'F');
      doc.setTextColor(26,31,27); doc.setFontSize(8); doc.setFont('helvetica','normal');
      const abw = (b.ist||0)-(b.budget||0);
      const abwP = b.budget ? ((abw/b.budget)*100) : 0;
      const typLabel = b.typ==='einnahme' ? 'Einnahme' : 'Ausgabe';
      doc.text((b.bezeichnung||'').substring(0,32),    cols.bez+2, y+5);
      doc.text((b.kategorie||'—').substring(0,18),     cols.kat+2, y+5);
      doc.text(typLabel,                               cols.typ+2, y+5);
      doc.text(fmt(b.budget||0),                       cols.bud,   y+5, {align:'right'});
      doc.text(fmt(b.ist||0),                          cols.ist,   y+5, {align:'right'});
      if (abw>=0) doc.setTextColor(30,107,46); else doc.setTextColor(153,27,27);
      doc.text(fmtDiff(abw),                           cols.abw,   y+5, {align:'right'});
      doc.text(abwP.toFixed(1)+' %',                   cols.pct,   y+5, {align:'right'});
      // Ist-Zeitstempel
      const tsIst = (d.timestamps||[]).filter(t=>t.type==='ist_gespeichert'&&t.buchungId===b.id).slice(-1)[0];
      if (tsIst) {
        doc.setTextColor(122,140,125); doc.setFontSize(6.5);
        doc.text(`Gespeichert: ${tsIst.user} · ${fmtDateTime(tsIst.at)}${tsIst.bemerkung?' · „'+tsIst.bemerkung+'"':''}`, cols.bez+2, y+10);
        y += 4;
      }
      if (b.typ==='einnahme') { budgetEin+=b.budget||0; istEin+=b.ist||0; }
      else { budgetAus+=b.budget||0; istAus+=b.ist||0; }
      y += 7;
    });

    // Summenzeile
    doc.setFillColor(200,230,204); doc.rect(M, y, W-2*M, 8,'F');
    doc.setTextColor(26,92,42); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
    doc.text('Saldo '+r.name,                    cols.bez+2, y+5.5);
    doc.text(fmt(budgetEin-budgetAus),            cols.bud,   y+5.5, {align:'right'});
    doc.text(fmt(istEin-istAus),                  cols.ist,   y+5.5, {align:'right'});
    const saldoAbw = (istEin-istAus)-(budgetEin-budgetAus);
    if (saldoAbw>=0) doc.setTextColor(30,107,46); else doc.setTextColor(153,27,27);
    doc.text(fmtDiff(saldoAbw),                   cols.abw,   y+5.5, {align:'right'});
    y += 16;
  }

  // ── GESAMTÜBERSICHT ─────────────────────────
  doc.addPage(); pdfHeader(); pdfFooter(doc.getNumberOfPages());
  y = 24;
  doc.setTextColor(26,92,42); doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text(`${state.clubName}  –  Gesamtübersicht ${state.activeYear}`, M, y); y += 8;

  // Gesamttabelle
  const cols2 = { ref:M, bez:58, typ:118, bud:158, ist:195, abw:232, pct:272 };
  doc.setFillColor(26,92,42); doc.rect(M, y, W-2*M, 7,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(7.5); doc.setFont('helvetica','bold');
  doc.text('Referat',     cols2.ref+2, y+5);
  doc.text('Bezeichnung', cols2.bez+2, y+5);
  doc.text('Typ',         cols2.typ+2, y+5);
  doc.text('Budget',      cols2.bud,   y+5, {align:'right'});
  doc.text('Ist',         cols2.ist,   y+5, {align:'right'});
  doc.text('Abweichung',  cols2.abw,   y+5, {align:'right'});
  doc.text('%',           cols2.pct,   y+5, {align:'right'});
  y += 7;

  let gBudgetEin=0,gBudgetAus=0,gIstEin=0,gIstAus=0;
  let row=0;
  referate.forEach(r => {
    allBs.filter(b=>b.referatId===r.id).forEach(b => {
      if (y > H-18) { doc.addPage(); pdfHeader(); pdfFooter(doc.getNumberOfPages()); y=24; }
      doc.setFillColor(row%2===0?247:255, row%2===0?248:255, row%2===0?246:255);
      doc.rect(M, y, W-2*M, 7,'F');
      doc.setTextColor(26,31,27); doc.setFontSize(7.5); doc.setFont('helvetica','normal');
      const abw = (b.ist||0)-(b.budget||0);
      const abwP = b.budget?((abw/b.budget)*100):0;
      doc.text(r.name.substring(0,18),         cols2.ref+2, y+5);
      doc.text((b.bezeichnung||'').substring(0,30), cols2.bez+2, y+5);
      doc.text(b.typ==='einnahme'?'Einnahme':'Ausgabe', cols2.typ+2, y+5);
      doc.text(fmt(b.budget||0),               cols2.bud,  y+5, {align:'right'});
      doc.text(fmt(b.ist||0),                  cols2.ist,  y+5, {align:'right'});
      if(abw>=0) doc.setTextColor(30,107,46); else doc.setTextColor(153,27,27);
      doc.text(fmtDiff(abw),                   cols2.abw,  y+5, {align:'right'});
      doc.text(abwP.toFixed(1)+' %',           cols2.pct,  y+5, {align:'right'});
      if(b.typ==='einnahme'){gBudgetEin+=b.budget||0;gIstEin+=b.ist||0;}
      else{gBudgetAus+=b.budget||0;gIstAus+=b.ist||0;}
      y+=7; row++;
    });
  });

  // Gesamtsaldo
  if (y > H-24) { doc.addPage(); pdfHeader(); pdfFooter(doc.getNumberOfPages()); y=24; }
  doc.setFillColor(200,230,204); doc.rect(M, y, W-2*M, 8,'F');
  doc.setTextColor(26,92,42); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
  doc.text('GESAMTSALDO', cols2.ref+2, y+5.5);
  doc.text(fmt(gBudgetEin-gBudgetAus), cols2.bud, y+5.5, {align:'right'});
  doc.text(fmt(gIstEin-gIstAus),       cols2.ist, y+5.5, {align:'right'});
  const gAbw = (gIstEin-gIstAus)-(gBudgetEin-gBudgetAus);
  if(gAbw>=0) doc.setTextColor(30,107,46); else doc.setTextColor(153,27,27);
  doc.text(fmtDiff(gAbw), cols2.abw, y+5.5, {align:'right'});
  y += 16;

  // ── DIAGRAMME auf eigene Seite ──────────────
  const chartIds = [
    { id:'chartOverall',  label:'Budget vs. Ist – Gesamtverein' },
    { id:'chartReferate', label:'Soll-Ist-Vergleich je Referat' },
    { id:'chartPie',      label:'Kostenverteilung Ausgaben' }
  ];
  for (const ci of chartIds) {
    const canvas = document.getElementById(ci.id);
    if (!canvas) continue;
    doc.addPage(); pdfHeader(); pdfFooter(doc.getNumberOfPages());
    doc.setTextColor(26,92,42); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(ci.label, M, 24);
    try {
      // Höhe proportional: canvas-Verhältnis beibehalten, max Breite = W-2*M, max Höhe = H-50
      const cvW = canvas.width, cvH = canvas.height;
      const ratio = cvH/cvW;
      const imgW = Math.min(W-2*M, 260);
      const imgH = Math.min(imgW * ratio, H-50);
      const imgData = canvas.toDataURL('image/png',1.0);
      doc.addImage(imgData,'PNG', M, 30, imgW, imgH,'','NONE');
    } catch(e) {}
  }

  doc.save(`Budget_${state.clubName.replace(/\s+/g,'_')}_${state.activeYear}.pdf`);
  showToast('PDF gespeichert.');
}

// ─── MODAL HELPERS ─────────────────────────────
function openModal() {
  document.getElementById('modalOverlay').classList.remove('hidden');
}
function closeAllModals() {
  document.getElementById('modalOverlay').classList.add('hidden');
}
function closeModal(e) {
  if (e.target===document.getElementById('modalOverlay')) closeAllModals();
}
document.addEventListener('keydown', e => { if(e.key==='Escape') closeAllModals(); });

// ─── BOOT ──────────────────────────────────────
loadState();
// Kein Auto-Login: immer Anmeldemaske zeigen (Punkt 1)
document.getElementById('loginScreen').classList.remove('hidden');
document.getElementById('app').classList.add('hidden');
