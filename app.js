// ==========================================================================
// 1. INITIAL STATE & PERSISTENCE
// ==========================================================================

const DEFAULT_STATE = {
  currentYear: 2025,
  currentUser: null,
  users: [
    { id: 'u1', name: 'Administrator', username: 'admin', email: 'admin@verein.at', role: 'admin', password: 'admin123', active: true }
  ],
  years: {
    2025: {
      gesperrt: false,
      freigegeben: false,
      freigabeHistorie: [],
      referate: [
        { id: 'r1', name: 'Obmann', gesperrt: false, freigabeHistorie: [] },
        { id: 'r2', name: 'Jugend', gesperrt: false, freigabeHistorie: [] }
      ],
      buchungssaetze: [
        { id: 'b1', referatId: 'r1', bezeichnung: 'Förderungen', typ: 'einnahme', budget: 1500, ist: 1750, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b2', referatId: 'r1', bezeichnung: 'Fußballturnier', typ: 'ausgabe', budget: 1000, ist: 800, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b3', referatId: 'r1', bezeichnung: 'Fußballturnier', typ: 'einnahme', budget: 200, ist: 100, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b4', referatId: 'r1', bezeichnung: 'Ausgaben Zeitschriften', typ: 'ausgabe', budget: 500, ist: 500, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b5', referatId: 'r1', bezeichnung: 'Fortbildung (Funktionäre)', typ: 'ausgabe', budget: 2000, ist: 1500, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b6', referatId: 'r1', bezeichnung: 'Fortbildungen (Funktionäre)', typ: 'einnahme', budget: 1000, ist: 800, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b7', referatId: 'r1', bezeichnung: 'Konzertwertung', typ: 'einnahme', budget: 10000, ist: 9000, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b8', referatId: 'r1', bezeichnung: 'Konzertwertung', typ: 'ausgabe', budget: 5000, ist: 6000, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b9', referatId: 'r2', bezeichnung: 'Leistungsabzeichen', typ: 'ausgabe', budget: 1000, ist: 1000, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b10', referatId: 'r2', bezeichnung: 'Leistungsabzeichen', typ: 'einnahme', budget: 1000, ist: 1000, fixiert: false, fixiertVon: null, fixiertAm: null }
      ]
    }
  }
};

let state = JSON.parse(localStorage.getItem('bmv_budget_state'));
if (!state) {
  state = DEFAULT_STATE;
  localStorage.setItem('bmv_budget_state', JSON.stringify(state));
}

function saveState() {
  localStorage.setItem('bmv_budget_state', JSON.stringify(state));
}

// ==========================================================================
// 2. UTILS & COLOR LOGIC (BUDGET-INVERSION AUSGABEN BEHOBEN)
// ==========================================================================

function uid() {
  return 'id_' + Math.random().toString(36).substr(2, 9);
}

function parseNum(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let clean = val.toString().replace(/[^0-9,\-]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function fmt(num) {
  return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(num || 0);
}

function fmtPercent(num) {
  if (isNaN(num) || !isFinite(num)) return '0,0 %';
  return new Intl.NumberFormat('de-AT', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(num);
}

function getYearData() {
  if (!state.years[state.currentYear]) {
    state.years[state.currentYear] = { gesperrt: false, freigegeben: false, freigabeHistorie: [], referate: [], buchungssaetze: [] };
  }
  return state.years[state.currentYear];
}

function getCurrentTimestamp() {
  return new Date().toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getAbweichungProps(typ, budget, ist) {
  const b = parseNum(budget);
  const i = parseNum(ist);
  const diff = i - b;
  
  let prozent = b !== 0 ? diff / b : 0;
  let isGuenstig = typ === 'einnahme' ? diff >= 0 : diff <= 0;
  let sign = diff > 0 ? '+' : '';
  
  return {
    wert: diff,
    prozent: prozent,
    className: diff === 0 ? 'text-muted' : (isGuenstig ? 'text-success fw-bold' : 'text-danger fw-bold'),
    formatted: `${sign}${fmt(diff)} (${sign}${fmtPercent(prozent)})`
  };
}

// ==========================================================================
// 3. ROLES & AUTHENTICATION (LOGIN VIA BENUTZERNAME ODER EMAIL)
// ==========================================================================

function isAdmin() { return state.currentUser?.role === 'admin'; }
function isPruefer() { return ['admin', 'pruefer'].includes(state.currentUser?.role); }
function canWrite() { return ['admin', 'pruefer', 'schreiber'].includes(state.currentUser?.role); }

function checkLogin(loginInput, password) {
  if (!loginInput || !password) return false;
  
  const searchKey = loginInput.toLowerCase().trim();
  
  // Ultimatives Sicherheitsnetz: admin/admin123 greift immer, falls der Speicher korrupt ist
  if (searchKey === 'admin' && password === 'admin123') {
    let adminUser = state.users.find(u => u.username === 'admin');
    if (!adminUser) {
      adminUser = { id: 'u1', name: 'Administrator', username: 'admin', email: 'admin@verein.at', role: 'admin', password: 'admin123', active: true };
      state.users.push(adminUser);
    }
    state.currentUser = adminUser;
    saveState();
    return true;
  }
  
  // Regelfall für alle Benutzer & E-Mails
  const user = state.users.find(usr => 
    usr.active !== false && 
    usr.password === password && 
    ((usr.username && usr.username.toLowerCase() === searchKey) || 
     (usr.email && usr.email.toLowerCase() === searchKey))
  );
  
  if (user) {
    state.currentUser = user;
    saveState();
    return true;
  }
  return false;
}

// ==========================================================================
// 4. NAVIGATION & SEITEN-SCHALTUNG
// ==========================================================================

function navigate(pageId) {
  if (!state.currentUser && pageId !== 'login') {
    navigate('login');
    return;
  }
  
  document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
  
  const targetPage = document.getElementById(`page-${pageId}`) || document.getElementById(pageId);
  if (targetPage) targetPage.style.display = 'block';
  
  const targetLink = document.querySelector(`.sidebar-menu a[data-page="${pageId}"]`);
  if (targetLink) targetLink.classList.add('active');
  
  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'referate') renderReferate();
  if (pageId === 'budgetplanung') renderBudgetplanung();
  if (pageId === 'istwerte') renderIstwerte();
  if (pageId === 'benutzer') renderBenutzer();
}

// ==========================================================================
// 5. CORE RENDERING LOGICS
// ==========================================================================

function renderDashboard() {
  const d = getYearData();
  const bs = d.buchungssaetze || [];

  const bEin = bs.filter(b => b.typ === 'einnahme').reduce((s, b) => s + parseNum(b.budget), 0);
  const bAus = bs.filter(b => b.typ === 'ausgabe').reduce((s, b) => s + parseNum(b.budget), 0);
  const iEin = bs.filter(b => b.typ === 'einnahme').reduce((s, b) => s + parseNum(b.ist), 0);
  const iAus = bs.filter(b => b.typ === 'ausgabe').reduce((s, b) => s + parseNum(b.ist), 0);

  const budgetGridEin = document.getElementById('dash-budget-ein');
  const budgetGridAus = document.getElementById('dash-budget-aus');
  const budgetGridSaldo = document.getElementById('dash-saldo');
  const istGridEin = document.getElementById('dash-ist-ein');
  const istGridAus = document.getElementById('dash-ist-aus');
  const istGridSaldo = document.getElementById('dash-ist-saldo');

  if (budgetGridEin) budgetGridEin.innerText = fmt(bEin);
  if (budgetGridAus) budgetGridAus.innerText = fmt(bAus);
  if (budgetGridSaldo) budgetGridSaldo.innerText = fmt(bEin - bAus);
  if (istGridEin) istGridEin.innerText = fmt(iEin);
  if (istGridAus) istGridAus.innerText = fmt(iAus);
  if (istGridSaldo) istGridSaldo.innerText = fmt(iEin - iAus);
}

function renderReferate() {
  const d = getYearData();
  const container = document.getElementById('referate-list');
  if (!container) return;
  container.innerHTML = '';

  d.referate.forEach(r => {
    let historieHtml = r.freigabeHistorie && r.freigabeHistorie.length > 0 
      ? `<div class="historie-box mt-2 p-2 bg-light rounded" style="font-size:0.85em"><strong>Freigabe-Historie:</strong><br>${r.freigabeHistorie.map(h => `• ${h}`).join('<br>')}</div>` 
      : '<span class="text-muted d-block mt-2" style="font-size:0.85em">Keine Freigabehistorie vorhanden</span>';

    const card = document.createElement('div');
    card.className = 'card mb-3';
    card.innerHTML = `
      <div class="card-body d-flex justify-content-between align-items-center">
        <div>
          <h5 class="card-title mb-1">${r.name}</h5>
          <p class="mb-0">Status: ${r.gesperrt ? '<span class="badge bg-danger">🔒 Freigegeben & Fixiert</span>' : '<span class="badge bg-success">✏️ In Bearbeitung</span>'}</p>
          ${historieHtml}
        </div>
        ${isAdmin() ? `
          <button class="btn btn-sm ${r.gesperrt ? 'btn-outline-warning' : 'btn-danger'}" onclick="toggleReferatSperre('${r.id}')">
            ${r.gesperrt ? 'Entsperren' : 'Freigeben & Sperren'}
          </button>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

function toggleReferatSperre(id) {
  if (!isAdmin()) return;
  const d = getYearData();
  const r = d.referate.find(ref => ref.id === id);
  if (r) {
    r.gesperrt = !r.gesperrt;
    if (!r.freigabeHistorie) r.freigabeHistorie = [];
    
    const aktion = r.gesperrt ? 'FIXIERT & FREIGEGEBEN' : 'WIEDER ENTSPERRT';
    r.freigabeHistorie.push(`${getCurrentTimestamp()} von ${state.currentUser.name} (${aktion})`);
    
    saveState();
    renderReferate();
  }
}

function renderBudgetplanung() { /* Budgetplanungs-Tabellengenerierung */ }

// ==========================================================================
// 6. IST-WERTE ERFASSUNG MIT VALIDIERUNG UND FIXIERUNG (4-AUGEN-PRINZIP)
// ==========================================================================

function renderIstwerte() {
  const d = getYearData();
  const tbody = document.getElementById('istwerte-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  d.buchungssaetze.forEach(b => {
    const props = getAbweichungProps(b.typ, b.budget, b.ist);
    const darfEditieren = canWrite() && !b.fixiert && !d.gesperrt;
    
    let aktionsButton = '';
    if (b.fixiert) {
      aktionsButton = `<span class="badge bg-dark text-wrap">🔒 Fixiert am ${b.fixiertAm} von ${b.fixiertVon}</span>`;
      if (isAdmin()) {
        aktionsButton += `<button class="btn btn-xs btn-outline-danger ms-2" style="font-size:0.75rem; padding:1px 5px;" onclick="unfixiereWert('${b.id}')">Aufheben</button>`;
      }
    } else if (isPruefer() && !d.gesperrt) {
      aktionsButton = `<button class="btn btn-sm btn-success py-0" onclick="fixiereWert('${b.id}')">✓ Fixieren</button>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${b.bezeichnung}</strong></td>
      <td><span class="badge ${b.typ === 'einnahme' ? 'bg-success' : 'bg-warning text-dark'}">${b.typ.toUpperCase()}</span></td>
      <td class="text-end fw-bold">${fmt(b.budget)}</td>
      <td>
        <input type="text" class="form-control form-control-sm text-end fw-bold" 
               value="${b.ist}" 
               ${darfEditieren ? '' : 'disabled'} 
               onchange="updateIstWert('${b.id}', this.value)" />
      </td>
      <td class="text-end ${props.className}">${props.formatted}</td>
      <td>${aktionsButton}</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateIstWert(id, value) {
  const d = getYearData();
  const b = d.buchungssaetze.find(item => item.id === id);
  if (!b || b.fixiert || d.gesperrt) return;

  let cleanValue = value.replace(',', '.').trim();
  let numericValue = parseFloat(cleanValue);

  if (isNaN(numericValue) || numericValue < 0) {
    alert("Ungültiger Wert! Bitte tragen Sie eine positive Zahl ein.");
    renderIstwerte();
    return;
  }

  b.ist = numericValue;
  saveState();
  renderIstwerte();
}

function fixiereWert(id) {
  if (!isPruefer()) return;
  const d = getYearData();
  const b = d.
