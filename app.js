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
// 2. UTILS & COLOR LOGIC
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
// 3. ROLES & AUTHENTICATION
// ==========================================================================

function isAdmin() { return state.currentUser?.role === 'admin'; }
function isPruefer() { return ['admin', 'pruefer'].includes(state.currentUser?.role); }
function canWrite() { return ['admin', 'pruefer', 'schreiber'].includes(state.currentUser?.role); }

function checkLogin(loginInput, password) {
  if (!loginInput || !password) return false;
  const searchKey = loginInput.toLowerCase().trim();
  
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
// 4. NAVIGATION
// ==========================================================================

function navigate(pageId) {
  const loginScreen = document.getElementById('loginScreen') || document.getElementById('page-login');
  const appScreen = document.getElementById('app');

  if (!state.currentUser && pageId !== 'login') {
    if (loginScreen) loginScreen.classList.remove('app-hidden', 'hidden');
    if (appScreen) appScreen.classList.add('hidden');
    return;
  }
  
  if (pageId === 'login') {
    if (loginScreen) loginScreen.classList.remove('app-hidden', 'hidden');
    if (appScreen) appScreen.classList.add('hidden');
  } else {
    if (pageId === 'benutzer' && !isAdmin()) {
      alert('Rechte für diese Funktion nicht vorhanden');
      navigate('dashboard');
      return;
    }

    if (loginScreen) loginScreen.classList.add('app-hidden', 'hidden');
    if (appScreen) appScreen.classList.remove('app-hidden', 'hidden');
    
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    
    const targetPage = document.getElementById(`page-${pageId}`) || document.getElementById(pageId);
    if (targetPage) targetPage.style.display = 'block';
    
    const targetLink = document.querySelector(`.sidebar-menu a[data-page="${pageId}"]`);
    if (targetLink) targetLink.classList.add('active');
    
    if (pageId === 'dashboard') renderDashboard();
    if (pageId === 'referate') renderReferate();
    if (pageId === 'istwerte') renderIstwerte();
    if (pageId === 'benutzer') renderBenutzer();
  }
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

// ==========================================================================
// 6. IST-WERTE ERFASSUNG
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
  const b = d.buchungssaetze.find(item => item.id === id);
  if (b) {
    b.fixiert = true;
    b.fixiertVon = state.currentUser.name;
    b.fixiertAm = getCurrentTimestamp();
    saveState();
    renderIstwerte();
  }
}

function unfixiereWert(id) {
  if (!isAdmin()) return;
  const d = getYearData();
  const b = d.buchungssaetze.find(item => item.id === id);
  if (b) {
    b.fixiert = false;
    b.fixiertVon = null;
    b.fixiertAm = null;
    saveState();
    renderIstwerte();
  }
}

// ==========================================================================
// 7. BENUTZERVERWALTUNG
// ==========================================================================

function renderBenutzer() {
  if (!isAdmin()) {
    alert('Rechte für diese Funktion nicht vorhanden');
    navigate('dashboard');
    return;
  }
  
  const tbody = document.getElementById('benutzer-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const table = tbody.closest('table');
  if (table && table.querySelector('thead tr') && !table.querySelector('.th-password')) {
    const th = document.createElement('th');
    th.className = 'th-password';
    th.innerText = 'Passwort';
    const headerRow = table.querySelector('thead tr');
    headerRow.insertBefore(th, headerRow.lastElementChild);
  }

  state.users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${u.name}</strong></td>
      <td><code>${u.username}</code></td>
      <td>${u.email || '-'}</td>
      <td><span class="badge bg-secondary">${u.role.toUpperCase()}</span></td>
      <td><strong><code>${u.password}</code></strong></td>
      <td>${u.active !== false ? '<span class="badge bg-success">Aktiv</span>' : '<span class="badge bg-danger">Inaktiv</span>'}</td>
      <td>
        ${u.id !== 'u1' ? `
          <button class="btn btn-sm btn-outline-warning" onclick="toggleUserActive('${u.id}')">${u.active !== false ? 'Deaktivieren' : 'Aktivieren'}</button>
        ` : '<span class="text-muted">Haupt-Admin</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleUserActive(id) {
  if (!isAdmin()) return;
  const u = state.users.find(usr => usr.id === id);
  if (u) {
    u.active = u.active === false ? true : false;
    saveState();
    renderBenutzer();
  }
}

function handleCreateUser(event) {
  if (event) event.preventDefault();
  if (!isAdmin()) return;
  
  const nameInput = document.getElementById('user-new-name') || document.querySelector('[name="name"]');
  const userInput = document.getElementById('user-new-username') || document.querySelector('[name="username"]');
  const emailInput = document.getElementById('user-new-email') || document.querySelector('[name="email"]');
  const roleSelect = document.getElementById('user-new-role') || document.querySelector('[name="role"]');
  const passInput = document.getElementById('user-new-password') || document.querySelector('[name="password"]');

  if (!nameInput || !userInput || !passInput) return;

  const usernameClean = userInput.value.trim().toLowerCase();
  const emailClean = emailInput ? emailInput.value.trim().toLowerCase() : '';

  if (!usernameClean || !passInput.value) {
    alert('Bitte füllen Sie mindestens Benutzernamen und Passwort aus!');
    return;
  }

  const existiert = state.users.some(u => u.username.toLowerCase() === usernameClean || (emailClean && u.email && u.email.toLowerCase() === emailClean));
  if (existiert) {
    alert('Fehler: Ein Benutzer mit diesem Benutzernamen oder dieser E-Mail-Adresse ist bereits vorhanden!');
    return;
  }

  const newUser = {
    id: uid(),
    name: nameInput.value.trim(),
    username: usernameClean,
    email: emailClean,
    role: roleSelect ? roleSelect.value : 'schreiber',
    password: passInput.value,
    active: true
  };

  state.users.push(newUser);
  saveState();
  
  nameInput.value = ''; userInput.value = ''; passInput.value = '';
  if (emailInput) emailInput.value = '';

  alert(`Der Benutzer "${newUser.name}" wurde erfolgreich hinzugefügt!`);
  renderBenutzer();
}

// ==========================================================================
// 8. INITIALISIERUNG & GLOBAL LOGIN
// ==========================================================================

window.doLogin = function(event) {
  if (event) event.preventDefault();
  
  const uInput = document.getElementById('login-username') || document.getElementById('login_username') || document.querySelector('input[type="text"]') || document.querySelector('[name="username"]');
  const pInput = document.getElementById('login-password') || document.getElementById('login_password') || document.querySelector('input[type="password"]') || document.querySelector('[name="password"]');
  const errorMsg = document.getElementById('login-error-msg') || document.getElementById('login_error_msg') || document.querySelector('.error-message') || document.querySelector('.alert-danger');
  
  if (!uInput || !pInput) return;

  if (checkLogin(uInput.value, pInput.value)) {
    if (errorMsg) errorMsg.style.display = 'none';
    navigate('dashboard');
    
    const profName = document.getElementById('user-profile-name') || document.getElementById('userNameDisplay');
    if (profName) profName.innerText = state.currentUser.name;
  } else {
    if (errorMsg) errorMsg.style.display = 'block';
    alert('Anmeldedaten falsch oder Benutzer inaktiv.');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form') || document.getElementById('login_form') || document.querySelector('form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      window.doLogin(e);
    });
  }

  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.addEventListener('click', (e) => {
      const page = link.getAttribute('data-page');
      if (page) {
        e.preventDefault();
        navigate(page);
      }
    });
  });

  const createUserBtn = document.getElementById('btn-save-new-user') || document.getElementById('save_user_btn');
  if (createUserBtn) {
    createUserBtn.addEventListener('click', handleCreateUser);
  }

  const logoutBtn = document.getElementById('btn-logout') || document.getElementById('logout_btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      state.currentUser = null;
      saveState();
      window.location.reload(); 
    });
  }

  if (state.currentUser) {
    const profName = document.getElementById('user-profile-name') || document.getElementById('userNameDisplay');
    if (profName) profName.innerText = state.currentUser.name;
    navigate('dashboard');
  } else {
    navigate('login');
  }
});
