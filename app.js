/* =============================================
   VEREINSBUDGET – APP.JS  v4
   Fixes: Logik, PDF, Freigabe, Rollen, Session
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
// Fix 8 & 10: Session in sessionStorage (bleibt bei F5), Daten in localStorage
function saveState() {
  const { currentUser, ...toSave } = state;
  localStorage.setItem('vereinsbudget_v4', JSON.stringify(toSave));
  if (currentUser) sessionStorage.setItem('vb_session', JSON.stringify(currentUser));
}
function loadState() {
  const raw = localStorage.getItem('vereinsbudget_v4');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
    } catch(e) {}
  }
  // Session wiederherstellen (Fix 8)
  const sess = sessionStorage.getItem('vb_session');
  if (sess) {
    try {
      const su = JSON.parse(sess);
      // Frischer User-Datensatz aus state.users laden
      const fresh = state.users.find(u => u.id === su.id);
      state.currentUser = fresh || null;
    } catch(e) { state.currentUser = null; }
  }
  ensureAllYears();
}
function ensureAllYears() {
  state.years.forEach(y => ensureYearData(y));
}
function ensureYearData(year) {
  if (!state.data[year]) state.data[year] = { referate:[], buchungssaetze:[], freigaben:{}, validierungen:{}, timestamps:[], abgeschlossen:null };
  const d = state.data[year];
  if (!d.timestamps)    d.timestamps    = [];
  if (!d.validierungen) d.validierungen = {};
  if (!d.freigaben)     d.freigaben     = {};
}
function getYearData(year) {
  ensureYearData(year || state.activeYear);
  return state.data[year || state.activeYear];
}

// ─── UTILS ────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('de-AT', { style:'currency', currency:'EUR' }).format(n || 0);
}
// Fix 2: fmtDiff nur mit ASCII-Zeichen für PDF
function fmtDiff(n) {
  const abs = fmt(Math.abs(n));
  return (n >= 0 ? '+' : '-') + abs;
}
function fmtDiffHtml(n) {
  // Für HTML darf das schöne Minuszeichen bleiben
  return (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
}

// Fix 1: Abweichungsklasse TYPABHÄNGIG
// Einnahmen: Ist > Budget → grün (mehr eingenommen), Ist < Budget → rot
// Ausgaben:  Ist < Budget → grün (weniger ausgegeben), Ist > Budget → rot
function abwClass(ist, budget, typ) {
  const diff = (ist||0) - (budget||0);
  if (diff === 0) return '';
  if (typ === 'einnahme') return diff > 0 ? 'abweichung-pos' : 'abweichung-neg';
  else                    return diff < 0 ? 'abweichung-pos' : 'abweichung-neg';
}
function abwPct(ist, budget) {
  if (!budget) return '-';
  return (((ist - budget) / budget) * 100).toFixed(1) + ' %';
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function fmtDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('de-AT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function showToast(msg, duration=2800) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), duration);
}

// ─── ROLLEN ───────────────────────────────────
function getRoleLabel(role) {
  return { admin:'Administrator', freigeber:'Freigeber', validierer:'Validierer', schreiber:'Schreiber', leser:'Leser' }[role] || role;
}
function getRoleBadgeClass(role) {
  return { admin:'badge-danger', freigeber:'badge-success', validierer:'badge-gold', schreiber:'badge-blue', leser:'badge-neutral' }[role] || 'badge-neutral';
}
function avatarColor(role) {
  return { admin:'#991b1b', freigeber:'#1e6b2e', validierer:'#8b6914', schreiber:'#1d4ed8', leser:'#4a5c4d' }[role] || '#4a5c4d';
}
function canWrite()     { return state.currentUser && ['admin','freigeber','validierer','schreiber'].includes(state.currentUser.role); }
function canValidate()  { return state.currentUser && ['admin','freigeber','validierer'].includes(state.currentUser.role); }
function canFreigeben() { return state.currentUser && ['admin','freigeber'].includes(state.currentUser.role); }
function isAdmin()      { return state.currentUser && state.currentUser.role === 'admin'; }
function isFreigeber()  { return state.currentUser && ['admin','freigeber'].includes(state.currentUser.role); }
function isBudgetFreigegeben() {
  const d = getYearData();
  return !!(d.freigaben && d.freigaben['__gesamt__']);
}
function isBudgetAbgeschlossen() {
  return !!(getYearData().abgeschlossen);
}

// ─── AUTH ──────────────────────────────────────
// Fix 9: Anmeldung mit Name ODER E-Mail
function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const user = state.users.find(u =>
    (u.name === username || u.email === username) &&
    u.password === password && u.active !== false
  );
  if (!user) {
    document.getElementById('loginError').classList.remove('hidden');
    return;
  }
  state.currentUser = user;
  sessionStorage.setItem('vb_session', JSON.stringify(user));
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initApp();
}
function doLogout() {
  state.currentUser = null;
  sessionStorage.removeItem('vb_session');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').classList.add('hidden');
}
document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });

// ─── INIT ──────────────────────────────────────
function initApp() {
  const u = state.currentUser;
  document.getElementById('userNameDisplay').textContent = u.name;
  document.getElementById('userRoleDisplay').textContent = getRoleLabel(u.role);
  document.getElementById('userAvatar').textContent = u.name[0].toUpperCase();
  document.getElementById('userAvatar').style.background = avatarColor(u.role);
  // Fix 7: Einstellungen nur für Admin
  document.getElementById('navBenutzer').style.display    = isAdmin() ? '' : 'none';
  document.getElementById('navEinstellungen').style.display = isAdmin() ? '' : 'none';
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
  sel.innerHTML = state.years.map(y => `<option value="${y}" ${y==state.activeYear?'selected':''}>${y}</option>`).join('');
}
function changeYear(y) {
  state.activeYear = parseInt(y);
  ensureYearData(state.activeYear);
  updateClubDisplay(); saveState(); navigate(currentPage);
}

// ─── NAVIGATION ───────────────────────────────
let currentPage = 'dashboard';
let chartInstances = {};
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page===page));
  const pageEl = document.getElementById('page-'+page);
  if (pageEl) pageEl.classList.add('active');
  const titles = { dashboard:'Dashboard', referate:'Referate', budget:'Budgetplanung',
    istWerte:'Ist-Werte', auswertung:'Auswertung', benutzer:'Benutzerverwaltung', einstellungen:'Einstellungen' };
  document.getElementById('topbarTitle').textContent = titles[page]||page;
  if (page==='dashboard')     renderDashboard();
  if (page==='referate')      renderReferate();
  if (page==='budget')        renderBudgetPageInit();
  if (page==='istWerte')      renderIstPageInit();
  if (page==='auswertung')    renderAuswertungInit();
  if (page==='benutzer')      renderBenutzer();
  if (page==='einstellungen') renderEinstellungen();
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

// ─── CHARTS ───────────────────────────────────
function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}
const C = { greenDark:'#1a5c2a', greenMid:'#2e7d3a', greenLight:'#c8e6cc', gold:'#8b6914', goldLight:'#c49a28', goldPale:'#f5e9c0', danger:'#991b1b', text2:'#4a5c4d', border:'#dde5de' };
function baseChartOpts() {
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ labels:{ font:{family:'DM Sans',size:12}, color:C.text2 } },
              tooltip:{ callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } } },
    scales:{
      x:{ grid:{color:C.border}, ticks:{font:{family:'DM Sans',size:11},color:C.text2} },
      y:{ grid:{color:C.border}, ticks:{font:{family:'DM Sans',size:11},color:C.text2, callback:v=>'€'+v.toLocaleString('de-AT')} }
    }
  };
}

// ─── DASHBOARD ─────────────────────────────────
function renderDashboard() {
  const d   = getYearData();
  const bs  = d.buchungssaetze||[];

  // Fix 1: Saldo = Einnahmen − Ausgaben (Ausgaben NEGATIV subtrahiert)
  const budgetEin = bs.filter(b=>b.typ==='einnahme').reduce((s,b)=>s+(b.budget||0),0);
  const budgetAus = bs.filter(b=>b.typ==='ausgabe' ).reduce((s,b)=>s+(b.budget||0),0);
  const istEin    = bs.filter(b=>b.typ==='einnahme').reduce((s,b)=>s+(b.ist||0),0);
  const istAus    = bs.filter(b=>b.typ==='ausgabe' ).reduce((s,b)=>s+(b.ist||0),0);
  const saldo    = budgetEin - budgetAus;   // Einnahmen MINUS Ausgaben
  const istSaldo = istEin    - istAus;

  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi-card green"><div class="kpi-label">Budget Einnahmen</div><div class="kpi-value">${fmt(budgetEin)}</div><div class="kpi-sub">Plan ${state.activeYear}</div></div>
    <div class="kpi-card gold"><div class="kpi-label">Budget Ausgaben</div><div class="kpi-value">${fmt(budgetAus)}</div><div class="kpi-sub">Plan ${state.activeYear}</div></div>
    <div class="kpi-card ${saldo>=0?'green':'danger'}"><div class="kpi-label">Geplanter Saldo</div><div class="kpi-value ${saldo>=0?'positive':'negative'}">${fmt(saldo)}</div><div class="kpi-sub">Einnahmen − Ausgaben</div></div>
    <div class="kpi-card ${istSaldo>=0?'green':'danger'}"><div class="kpi-label">Ist-Saldo</div><div class="kpi-value ${istSaldo>=0?'positive':'negative'}">${fmt(istSaldo)}</div><div class="kpi-sub">Tatsächlich bisher</div></div>
    <div class="kpi-card neutral"><div class="kpi-label">Referate</div><div class="kpi-value">${(d.referate||[]).length}</div><div class="kpi-sub">angelegt</div></div>
    <div class="kpi-card neutral"><div class="kpi-label">Buchungssätze</div><div class="kpi-value">${bs.length}</div><div class="kpi-sub">gesamt</div></div>`;

  // Overlapping-Chart: Budget (breiter, dunkel) HINTER Ist (schmäler, hell)
  destroyChart('chartOverall');
  const ctxO = document.getElementById('chartOverall').getContext('2d');
  chartInstances['chartOverall'] = new Chart(ctxO, {
    type:'bar',
    data:{
      labels:['Einnahmen','Ausgaben','Saldo'],
      datasets:[
        { label:'Budget (Plan)', data:[budgetEin,budgetAus,saldo],
          backgroundColor:['rgba(26,92,42,0.85)','rgba(26,92,42,0.85)', saldo>=0?'rgba(26,92,42,0.85)':'rgba(153,27,27,0.85)'],
          borderRadius:5, barPercentage:0.7, order:2 },
        { label:'Ist (tatsächlich)', data:[istEin,istAus,istSaldo],
          backgroundColor:['rgba(196,154,40,0.8)','rgba(196,154,40,0.8)', istSaldo>=0?'rgba(196,154,40,0.8)':'rgba(220,80,80,0.8)'],
          borderRadius:5, barPercentage:0.42, order:1 }
      ]
    }, options:baseChartOpts()
  });

  const referate = d.referate||[];
  const pieData = referate.map(r=>({ name:r.name, val:bs.filter(b=>b.referatId===r.id&&b.typ==='ausgabe').reduce((s,b)=>s+(b.budget||0),0) })).filter(x=>x.val>0);
  destroyChart('chartPie');
  const ctxP = document.getElementById('chartPie').getContext('2d');
  chartInstances['chartPie'] = new Chart(ctxP, {
    type:'doughnut',
    data:{ labels:pieData.map(x=>x.name), datasets:[{ data:pieData.map(x=>x.val), backgroundColor:['#1a5c2a','#2e7d3a','#3a9048','#4ea85a','#68bb72','#8b6914','#c49a28','#e8c84a'], borderWidth:2, borderColor:'#fff' }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ font:{family:'DM Sans',size:11},color:C.text2,boxWidth:12 } } } }
  });

  const rLabels   = referate.map(r=>r.name);
  const rBudgEin  = referate.map(r=>bs.filter(b=>b.referatId===r.id&&b.typ==='einnahme').reduce((s,b)=>s+(b.budget||0),0));
  const rBudgAus  = referate.map(r=>bs.filter(b=>b.referatId===r.id&&b.typ==='ausgabe' ).reduce((s,b)=>s+(b.budget||0),0));
  const rIstEin   = referate.map(r=>bs.filter(b=>b.referatId===r.id&&b.typ==='einnahme').reduce((s,b)=>s+(b.ist||0),0));
  const rIstAus   = referate.map(r=>bs.filter(b=>b.referatId===r.id&&b.typ==='ausgabe' ).reduce((s,b)=>s+(b.ist||0),0));
  destroyChart('chartReferate');
  const ctxR = document.getElementById('chartReferate').getContext('2d');
  chartInstances['chartReferate'] = new Chart(ctxR, {
    type:'bar',
    data:{ labels:rLabels, datasets:[
      { label:'Budget Einnahmen', data:rBudgEin, backgroundColor:'rgba(26,92,42,0.85)',  borderRadius:4, barPercentage:0.7,  order:2 },
      { label:'Ist Einnahmen',    data:rIstEin,  backgroundColor:'rgba(46,125,58,0.45)', borderRadius:4, barPercentage:0.42, order:1 },
      { label:'Budget Ausgaben',  data:rBudgAus, backgroundColor:'rgba(139,105,20,0.85)',borderRadius:4, barPercentage:0.7,  order:2 },
      { label:'Ist Ausgaben',     data:rIstAus,  backgroundColor:'rgba(196,154,40,0.5)', borderRadius:4, barPercentage:0.42, order:1 }
    ]}, options:baseChartOpts()
  });
}

// ─── REFERATE ──────────────────────────────────
function renderReferate() {
  const d=getYearData(), bs=d.buchungssaetze||[], el=document.getElementById('referateList');
  if (!(d.referate||[]).length) {
    el.innerHTML=`<div class="card" style="text-align:center;padding:2.5rem;color:var(--text-3)">
      <p>Noch keine Referate angelegt.</p>
      ${canWrite()?`<button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="openReferatModal()">Erstes Referat anlegen</button>`:''}
    </div>`; return;
  }
  el.innerHTML=(d.referate||[]).map(r=>{
    const rBs=bs.filter(b=>b.referatId===r.id);
    const budEin=rBs.filter(b=>b.typ==='einnahme').reduce((s,b)=>s+(b.budget||0),0);
    const budAus=rBs.filter(b=>b.typ==='ausgabe' ).reduce((s,b)=>s+(b.budget||0),0);
    const saldo=budEin-budAus;
    const frei=!!(d.freigaben||{})[r.id];
    return `<div class="referat-card">
      <div class="referat-card-header" onclick="toggleReferatCard('rc-${r.id}')">
        <div>
          <div class="referat-name">${r.name}${frei?'<span class="freigabe-badge" style="margin-left:.5rem">✓ Freigegeben</span>':''}</div>
          <div class="referat-meta">${state.clubName} · ${rBs.length} Buchungssätze</div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem">
          ${canWrite()&&!frei?`<button class="icon-btn" title="Buchungssatz hinzufügen" onclick="event.stopPropagation();openBuchungModal('${r.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M12 5v14M5 12h14"/></svg></button>
          <button class="icon-btn" onclick="event.stopPropagation();openReferatModal('${r.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`:''}
          ${isAdmin()?`<button class="icon-btn danger" onclick="event.stopPropagation();deleteReferat('${r.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg></button>`:''}
          <svg class="chevron" id="chev-${r.id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="referat-card-body hidden" id="rc-${r.id}">
        <div class="referat-stats">
          <div class="referat-stat"><div class="referat-stat-label">Budget Einnahmen</div><div class="referat-stat-value" style="color:var(--success)">${fmt(budEin)}</div></div>
          <div class="referat-stat"><div class="referat-stat-label">Budget Ausgaben</div><div class="referat-stat-value" style="color:var(--gold)">${fmt(budAus)}</div></div>
          <div class="referat-stat"><div class="referat-stat-label">Saldo</div><div class="referat-stat-value" style="color:${saldo>=0?'var(--success)':'var(--danger)'}">${fmt(saldo)}</div></div>
        </div>
        ${rBs.filter(b=>b.typ==='einnahme').length?`<div class="buchung-section"><div class="buchung-section-title">Einnahmen</div>${rBs.filter(b=>b.typ==='einnahme').map(b=>buchungRow(b,r.id,frei)).join('')}</div>`:''}
        ${rBs.filter(b=>b.typ==='ausgabe').length?`<div class="buchung-section"><div class="buchung-section-title">Ausgaben</div>${rBs.filter(b=>b.typ==='ausgabe').map(b=>buchungRow(b,r.id,frei)).join('')}</div>`:''}
        ${!rBs.length?`<p style="color:var(--text-3);font-size:.82rem;padding:.5rem">Noch keine Buchungssätze.${canWrite()&&!frei?`<button class="btn btn-sm btn-primary" style="margin-left:.5rem" onclick="openBuchungModal('${r.id}')">Hinzufügen</button>`:''}</p>`:''}
      </div>
    </div>`;
  }).join('');
}
function buchungRow(b,referatId,gesperrt) {
  return `<div class="buchung-row">
    <div class="status-dot ${b.typ}"></div>
    <div class="buchung-name">${b.bezeichnung}${b.kategorie?`<span style="margin-left:.4rem;font-size:.72rem;color:var(--text-3)">${b.kategorie}</span>`:''}</div>
    <div class="buchung-amount">${fmt(b.budget)}</div>
    ${canWrite()&&!gesperrt?`
    <button class="icon-btn" onclick="openBuchungModal('${referatId}','${b.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
    <button class="icon-btn danger" onclick="deleteBuchung('${b.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg></button>`:''}
  </div>`;
}
function toggleReferatCard(id) {
  document.getElementById(id)?.classList.toggle('hidden');
  document.getElementById('chev-'+id.replace('rc-',''))?.classList.toggle('open');
}

// ─── REFERAT / BUCHUNG MODALS ──────────────────
function openReferatModal(id) {
  const d=getYearData(), r=id?d.referate.find(x=>x.id===id):null;
  document.getElementById('modalTitle').textContent = r?'Referat bearbeiten':'Referat anlegen';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">Name *</label><input type="text" id="mRN" class="form-input" value="${r?r.name:''}" placeholder="z. B. Jugendreferat"/></div>
    <div class="form-group"><label class="form-label">Beschreibung</label><input type="text" id="mRD" class="form-input" value="${r?r.desc||'':''}" placeholder="Optional"/></div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeAllModals()">Abbrechen</button><button class="btn btn-primary" onclick="saveReferat('${id||''}')">Speichern</button></div>`;
  openModal(); setTimeout(()=>document.getElementById('mRN').focus(),100);
}
function saveReferat(id) {
  const name=document.getElementById('mRN').value.trim();
  if (!name) { showToast('Name erforderlich.'); return; }
  const d=getYearData();
  if (id) { const r=d.referate.find(x=>x.id===id); if(r){r.name=name;r.desc=document.getElementById('mRD').value.trim();} }
  else d.referate.push({id:uid(),name,desc:document.getElementById('mRD').value.trim()});
  saveState(); closeAllModals(); renderReferate(); showToast(id?'Referat aktualisiert.':'Referat angelegt.');
}
function deleteReferat(id) {
  if (!confirm('Referat und alle Buchungssätze löschen?')) return;
  const d=getYearData();
  d.referate=d.referate.filter(r=>r.id!==id);
  d.buchungssaetze=d.buchungssaetze.filter(b=>b.referatId!==id);
  saveState(); renderReferate(); showToast('Referat gelöscht.');
}
function openBuchungModal(referatId,buchungId) {
  const d=getYearData(), b=buchungId?d.buchungssaetze.find(x=>x.id===buchungId):null;
  document.getElementById('modalTitle').textContent = b?'Buchungssatz bearbeiten':'Buchungssatz anlegen';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">Bezeichnung *</label><input type="text" id="mBN" class="form-input" value="${b?b.bezeichnung:''}" placeholder="z. B. Mitgliedsbeiträge"/></div>
    <div class="form-group"><label class="form-label">Typ *</label>
      <select id="mBT" class="form-select"><option value="einnahme" ${b&&b.typ==='einnahme'?'selected':''}>Einnahme</option><option value="ausgabe" ${!b||b.typ==='ausgabe'?'selected':''}>Ausgabe</option></select></div>
    <div class="form-group"><label class="form-label">Budgetierter Betrag (€) *</label><input type="number" id="mBB" class="form-input" value="${b?b.budget||'':''}" placeholder="0,00" min="0" step="0.01"/></div>
    <div class="form-group"><label class="form-label">Kategorie / Kostenstelle</label><input type="text" id="mBK" class="form-input" value="${b?b.kategorie||'':''}" placeholder="Optional"/></div>
    <div class="form-group"><label class="form-label">Notiz</label><input type="text" id="mBNot" class="form-input" value="${b?b.notiz||'':''}" placeholder="Optional"/></div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeAllModals()">Abbrechen</button><button class="btn btn-primary" onclick="saveBuchung('${referatId}','${buchungId||''}')">Speichern</button></div>`;
  openModal(); setTimeout(()=>document.getElementById('mBN').focus(),100);
}
function saveBuchung(referatId,buchungId) {
  const bezeichnung=document.getElementById('mBN').value.trim();
  if (!bezeichnung) { showToast('Bezeichnung erforderlich.'); return; }
  const budget=parseFloat(document.getElementById('mBB').value)||0;
  const d=getYearData();
  if (buchungId) {
    const b=d.buchungssaetze.find(x=>x.id===buchungId);
    if(b){b.bezeichnung=bezeichnung;b.typ=document.getElementById('mBT').value;b.budget=budget;b.kategorie=document.getElementById('mBK').value.trim();b.notiz=document.getElementById('mBNot').value.trim();}
  } else {
    d.buchungssaetze.push({id:uid(),referatId,bezeichnung,typ:document.getElementById('mBT').value,budget,ist:0,istGesperrt:false,kategorie:document.getElementById('mBK').value.trim(),notiz:document.getElementById('mBNot').value.trim()});
  }
  saveState(); closeAllModals(); renderReferate(); showToast(buchungId?'Buchungssatz aktualisiert.':'Buchungssatz angelegt.');
}
function deleteBuchung(id) {
  if (!confirm('Buchungssatz löschen?')) return;
  const d=getYearData(); d.buchungssaetze=d.buchungssaetze.filter(b=>b.id!==id);
  saveState(); renderReferate(); showToast('Buchungssatz gelöscht.');
}

// ─── BUDGET PAGE ───────────────────────────────
function renderBudgetPageInit() {
  const d=getYearData(), sel=document.getElementById('budgetReferatSelect');
  sel.innerHTML=`<option value="all">Gesamtverein</option>`+(d.referate||[]).map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  renderBudgetPage();
}

// Fix 3: Infobox mit Verlauf; Fix 4: Freigeber = 1 Schritt; Fix 5: Aufhebung Referat → Gesamtbudget prüfen; Fix 6: Abschluss
function renderBudgetPage() {
  const d=getYearData(), val=document.getElementById('budgetReferatSelect').value;
  const referate=val==='all'?(d.referate||[]):(d.referate||[]).filter(r=>r.id===val);
  const el=document.getElementById('budgetContent');
  const budgetGesperrt=isBudgetFreigegeben()||isBudgetAbgeschlossen();
  const abgeschlossen=isBudgetAbgeschlossen();

  let html='';

  // ── Fix 3: Prozess-Infobox ─────────────────
  const allTs=(d.timestamps||[]).filter(t=>['validierung','freigabe_referat','aufhebung_referat','freigabe_budget','aufhebung_budget','abschluss'].includes(t.type));
  if (allTs.length) {
    html+=`<div class="card" style="margin-bottom:1.25rem;border-left:4px solid var(--green-mid)">
      <div class="card-title" style="margin-bottom:.75rem">📋 Freigabe- & Validierungsverlauf ${state.activeYear}</div>
      <div style="display:flex;flex-direction:column;gap:.4rem">
      ${allTs.map(t=>{
        const typ={validierung:'✓ Validiert',freigabe_referat:'🔓 Referat freigegeben',aufhebung_referat:'↩ Referat Freigabe aufgehoben',freigabe_budget:'✅ Gesamtbudget freigegeben',aufhebung_budget:'↩ Gesamtbudget Freigabe aufgehoben',abschluss:'🏁 Jahr abgeschlossen'}[t.type]||t.type;
        const ref=t.referatId?(d.referate||[]).find(r=>r.id===t.referatId):null;
        return `<div style="display:flex;gap:.75rem;align-items:flex-start;font-size:.8rem;padding:.4rem .6rem;border-radius:6px;background:var(--bg)">
          <span style="font-weight:600;min-width:200px">${typ}${ref?' – '+ref.name:''}</span>
          <span style="color:var(--text-2)">${t.user}</span>
          <span style="color:var(--text-3)">${fmtDateTime(t.at)}</span>
          ${t.bemerkung?`<span style="color:var(--gold);font-style:italic">"${t.bemerkung}"</span>`:''}
        </div>`;
      }).join('')}
      </div>
    </div>`;
  }

  if (abgeschlossen) {
    html+=`<div class="freigabe-banner" style="background:var(--gold-pale);border-color:var(--gold);color:var(--gold)">
      🏁 Dieses Jahr wurde abgeschlossen. Keine Änderungen mehr möglich.
    </div>`;
  } else if (budgetGesperrt) {
    html+=`<div class="freigabe-banner">✅ Gesamtbudget ${state.activeYear} freigegeben – schreibgeschützt.</div>`;
  }

  referate.forEach(r=>{
    const rBs=(d.buchungssaetze||[]).filter(b=>b.referatId===r.id);
    const totEin=rBs.filter(b=>b.typ==='einnahme').reduce((s,b)=>s+(b.budget||0),0);
    const totAus=rBs.filter(b=>b.typ==='ausgabe' ).reduce((s,b)=>s+(b.budget||0),0);
    const rFrei =!!(d.freigaben||{})[r.id];
    const rVal  =!!(d.validierungen||{})[r.id];
    const writeable=canWrite()&&!rFrei&&!budgetGesperrt;
    const tsVal =(d.timestamps||[]).filter(t=>t.type==='validierung'&&t.referatId===r.id).slice(-1)[0];
    const tsFrei=(d.timestamps||[]).filter(t=>t.type==='freigabe_referat'&&t.referatId===r.id).slice(-1)[0];

    html+=`<div class="section-card">
      <div class="section-card-header">
        <span class="section-card-title">${state.clubName} – ${r.name}
          ${rVal&&!rFrei?`<span class="badge badge-gold" style="margin-left:.5rem">✓ Validiert</span>`:''}
          ${rFrei?`<span class="freigabe-badge" style="margin-left:.4rem">✓ Freigegeben</span>`:''}
        </span>
        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
          <span class="badge badge-success">Ein. ${fmt(totEin)}</span>
          <span class="badge badge-gold">Aus. ${fmt(totAus)}</span>
          <span style="font-size:.8rem;font-weight:600;color:${totEin-totAus>=0?'var(--success)':'var(--danger)'}">Saldo: ${fmt(totEin-totAus)}</span>
          ${writeable?`<button class="btn btn-sm btn-primary" onclick="openBuchungModal('${r.id}')">+ Buchungssatz</button>`:''}
          ${/* Fix 4: Validierer nur validieren, Freigeber direkt freigeben */
            canValidate()&&!isFreigeber()&&!rVal&&!rFrei&&!budgetGesperrt?`<button class="btn btn-sm btn-outline" onclick="validierenReferat('${r.id}')">✓ Validieren</button>`:''}
          ${isFreigeber()&&!rFrei&&!budgetGesperrt?`<button class="btn btn-sm btn-primary" onclick="freigebenReferatDirekt('${r.id}')">✓ Freigeben</button>`:''}
          ${canFreigeben()&&rVal&&!rFrei&&!isFreigeber()&&!budgetGesperrt?`<button class="btn btn-sm btn-primary" onclick="freigebenReferat('${r.id}')">✓ Freigeben</button>`:''}
          ${isAdmin()&&(rFrei||rVal)?`<button class="btn btn-sm btn-danger" onclick="aufhebenReferat('${r.id}')">Aufheben</button>`:''}
        </div>
      </div>
      ${tsVal||tsFrei?`<div style="padding:.55rem 1.25rem;background:var(--bg);border-bottom:1px solid var(--border);font-size:.74rem;color:var(--text-3);display:flex;gap:1.25rem;flex-wrap:wrap">
        ${tsVal?`<span>✓ Validiert: <strong>${tsVal.user}</strong> · ${fmtDateTime(tsVal.at)}${tsVal.bemerkung?' · "'+tsVal.bemerkung+'"':''}</span>`:''}
        ${tsFrei?`<span>🔓 Freigegeben: <strong>${tsFrei.user}</strong> · ${fmtDateTime(tsFrei.at)}${tsFrei.bemerkung?' · "'+tsFrei.bemerkung+'"':''}</span>`:''}
      </div>`:''}
      <div class="table-wrap"><table>
        <thead><tr><th>Bezeichnung</th><th>Kategorie</th><th>Typ</th><th style="text-align:right">Budget</th>${writeable?'<th></th>':''}</tr></thead>
        <tbody>
          ${rBs.length?rBs.map(b=>`<tr>
            <td>${b.bezeichnung}${b.notiz?`<span style="display:block;font-size:.72rem;color:var(--text-3)">${b.notiz}</span>`:''}</td>
            <td>${b.kategorie||'—'}</td>
            <td><span class="badge ${b.typ==='einnahme'?'badge-success':'badge-gold'}">${b.typ==='einnahme'?'Einnahme':'Ausgabe'}</span></td>
            <td class="td-mono" style="text-align:right">${fmt(b.budget)}</td>
            ${writeable?`<td><div class="td-actions">
              <button class="icon-btn" onclick="openBuchungModal('${r.id}','${b.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="icon-btn danger" onclick="deleteBuchung('${b.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg></button>
            </div></td>`:''}
          </tr>`).join(''):`<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:1.5rem">Noch keine Buchungssätze.</td></tr>`}
          <tr class="total-row"><td colspan="3"><strong>Saldo ${r.name}</strong></td><td class="td-mono" style="text-align:right"><strong>${fmt(totEin-totAus)}</strong></td>${writeable?'<td></td>':''}</tr>
        </tbody>
      </table></div>
    </div>`;
  });

  if (val==='all'&&referate.length) {
    const allBs=d.buchungssaetze||[];
    const gEin=allBs.filter(b=>b.typ==='einnahme').reduce((s,b)=>s+(b.budget||0),0);
    const gAus=allBs.filter(b=>b.typ==='ausgabe' ).reduce((s,b)=>s+(b.budget||0),0);
    const tsBudget  =(d.timestamps||[]).filter(t=>t.type==='freigabe_budget').slice(-1)[0];
    const tsAbschl  =(d.timestamps||[]).filter(t=>t.type==='abschluss').slice(-1)[0];
    html+=`<div class="card" style="margin-top:1rem;border-left:4px solid var(--green-dark)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
        <strong style="color:var(--green-dark)">${state.clubName} – Gesamtbudget ${state.activeYear}</strong>
        <div style="display:flex;gap:1rem;font-family:'DM Mono',monospace;font-size:.9rem">
          <span style="color:var(--success)">+ ${fmt(gEin)}</span>
          <span style="color:var(--gold)">− ${fmt(gAus)}</span>
          <strong style="color:${gEin-gAus>=0?'var(--success)':'var(--danger)'}">${fmt(gEin-gAus)}</strong>
        </div>
      </div>
      ${tsBudget?`<div style="font-size:.74rem;color:var(--text-3);margin-top:.5rem">✅ Freigegeben: <strong>${tsBudget.user}</strong> · ${fmtDateTime(tsBudget.at)}${tsBudget.bemerkung?' · "'+tsBudget.bemerkung+'"':''}</div>`:''}
      ${tsAbschl?`<div style="font-size:.74rem;color:var(--gold);margin-top:.25rem">🏁 Abgeschlossen: <strong>${tsAbschl.user}</strong> · ${fmtDateTime(tsAbschl.at)}${tsAbschl.bemerkung?' · "'+tsAbschl.bemerkung+'"':''}</div>`:''}
      <div style="margin-top:1rem;display:flex;gap:.6rem;flex-wrap:wrap">
        ${isFreigeber()&&!budgetGesperrt?`<button class="btn btn-primary" onclick="freigebenGesamtbudget()">✅ Gesamtbudget freigeben</button>`:''}
        ${isFreigeber()&&budgetGesperrt&&!abgeschlossen?`<button class="btn btn-primary" style="background:var(--gold)" onclick="abschliessenJahr()">🏁 Jahr abschließen</button>`:''}
        ${isAdmin()&&(budgetGesperrt||abgeschlossen)?`<button class="btn btn-danger" onclick="widerrufenGesamtbudget()">↩ Freigabe widerrufen</button>`:''}
      </div>
    </div>`;
  }
  el.innerHTML=html||`<div class="card" style="text-align:center;padding:2rem;color:var(--text-3)">Kein Referat ausgewählt.</div>`;
}

// ─── ZEITSTEMPEL POPUP ─────────────────────────
function openBemerkungModal(title, onConfirm, extraHtml='') {
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=`
    ${extraHtml}
    <div class="form-group"><label class="form-label">Bemerkung (optional)</label>
    <textarea id="mBem" class="form-input" rows="3" placeholder="Optionale Notiz …" style="resize:vertical"></textarea></div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeAllModals()">Abbrechen</button>
    <button class="btn btn-primary" id="mBemOK">Bestätigen</button></div>`;
  openModal();
  document.getElementById('mBemOK').onclick=()=>{
    const bem=document.getElementById('mBem').value.trim();
    const extra={};
    if (document.getElementById('mCheckGesamt')) extra.aufhebenGesamt=document.getElementById('mCheckGesamt').checked;
    closeAllModals(); onConfirm(bem,extra);
  };
}
function addTimestamp(type,extra,bemerkung) {
  const d=getYearData(); if(!d.timestamps)d.timestamps=[];
  d.timestamps.push({type,bemerkung:bemerkung||'',user:state.currentUser.name,at:new Date().toISOString(),year:state.activeYear,...extra});
}

// Fix 4: Validierer → nur Validierung; Freigeber → direkt Freigabe (1 Schritt)
function validierenReferat(referatId) {
  openBemerkungModal('Referat validieren', bem=>{
    const d=getYearData(); if(!d.validierungen)d.validierungen={};
    d.validierungen[referatId]={by:state.currentUser.name,at:new Date().toISOString()};
    addTimestamp('validierung',{referatId},bem); saveState(); renderBudgetPage(); showToast('Referat validiert.');
  });
}
// Freigeber: 1 Schritt (Validierung + Freigabe in einem)
function freigebenReferatDirekt(referatId) {
  openBemerkungModal('Referat validieren & freigeben (1 Schritt)', bem=>{
    const d=getYearData();
    if(!d.validierungen)d.validierungen={};
    if(!d.freigaben)d.freigaben={};
    d.validierungen[referatId]={by:state.currentUser.name,at:new Date().toISOString()};
    d.freigaben[referatId]={by:state.currentUser.name,at:new Date().toISOString()};
    addTimestamp('validierung',{referatId},bem);
    addTimestamp('freigabe_referat',{referatId},bem);
    saveState(); renderBudgetPage(); showToast('Referat validiert und freigegeben.');
  });
}
function freigebenReferat(referatId) {
  openBemerkungModal('Referat freigeben', bem=>{
    const d=getYearData(); if(!d.freigaben)d.freigaben={};
    d.freigaben[referatId]={by:state.currentUser.name,at:new Date().toISOString()};
    addTimestamp('freigabe_referat',{referatId},bem); saveState(); renderBudgetPage(); showToast('Referat freigegeben.');
  });
}

// Fix 5: Aufheben Referat → Checkbox für Gesamtbudget-Aufhebung
function aufhebenReferat(referatId) {
  const gesamtFrei=isBudgetFreigegeben();
  const checkHtml=gesamtFrei?`<div class="form-group" style="background:var(--warning-bg);border-radius:6px;padding:.75rem;border:1px solid rgba(146,64,14,.2)">
    <label style="display:flex;align-items:center;gap:.6rem;cursor:pointer;font-size:.85rem">
      <input type="checkbox" id="mCheckGesamt" checked style="width:16px;height:16px"/>
      <span>Gesamtbudget ebenfalls aufheben (empfohlen)</span>
    </label>
  </div>`:'';
  openBemerkungModal('Freigabe / Validierung aufheben',async(bem,extra)=>{
    const d=getYearData();
    if(d.freigaben)delete d.freigaben[referatId];
    if(d.validierungen)delete d.validierungen[referatId];
    addTimestamp('aufhebung_referat',{referatId},bem);
    // Fix 5: Gesamtbudget ebenfalls aufheben wenn Checkbox gesetzt
    if(extra.aufhebenGesamt){
      if(d.freigaben)delete d.freigaben['__gesamt__'];
      d.abgeschlossen=null;
      addTimestamp('aufhebung_budget',{},bem+' (automatisch durch Referat-Aufhebung)');
    }
    saveState(); renderBudgetPage(); showToast('Aufhebung durchgeführt.');
  },checkHtml);
}

function freigebenGesamtbudget() {
  openBemerkungModal('Gesamtbudget freigeben', bem=>{
    const d=getYearData(); if(!d.freigaben)d.freigaben={};
    d.freigaben['__gesamt__']={by:state.currentUser.name,at:new Date().toISOString()};
    addTimestamp('freigabe_budget',{},bem); saveState(); renderBudgetPage(); showToast('Gesamtbudget freigegeben.');
  });
}
function widerrufenGesamtbudget() {
  openBemerkungModal('Gesamtbudget-Freigabe widerrufen (Admin)', bem=>{
    const d=getYearData(); if(d.freigaben)delete d.freigaben['__gesamt__'];
    d.abgeschlossen=null;
    addTimestamp('aufhebung_budget',{},bem); saveState(); renderBudgetPage(); showToast('Freigabe widerrufen.');
  });
}

// Fix 6: Jahresabschluss durch Freigeber
function abschliessenJahr() {
  openBemerkungModal('Jahr '+state.activeYear+' abschließen', bem=>{
    const d=getYearData();
    d.abgeschlossen={by:state.currentUser.name,at:new Date().toISOString()};
    addTimestamp('abschluss',{},bem); saveState(); renderBudgetPage(); showToast('Jahr abgeschlossen.');
  });
}

// ─── IST-WERTE ─────────────────────────────────
function renderIstPageInit() {
  const d=getYearData(), sel=document.getElementById('istReferatSelect');
  sel.innerHTML=`<option value="all">Gesamtverein</option>`+(d.referate||[]).map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  renderIstPage();
}
function renderIstPage() {
  const d=getYearData(), val=document.getElementById('istReferatSelect').value;
  const referate=val==='all'?(d.referate||[]):(d.referate||[]).filter(r=>r.id===val);
  const el=document.getElementById('istContent');
  const userCanWrite=canWrite();
  let html='';
  referate.forEach(r=>{
    const rBs=(d.buchungssaetze||[]).filter(b=>b.referatId===r.id);
    html+=`<div class="section-card" style="margin-bottom:1.25rem">
      <div class="section-card-header">
        <span class="section-card-title">${state.clubName} – ${r.name}: Ist-Werte</span>
        <span style="font-size:.74rem;color:var(--text-3)">Gespeicherte Ist-Werte werden gesperrt${isAdmin()?' (Admin: Entsperren möglich)':''}</span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Bezeichnung</th><th>Typ</th><th style="text-align:right">Budget</th><th style="text-align:right">Ist-Wert</th><th style="text-align:right">Abweichung</th><th>Status</th></tr></thead>
        <tbody>
          ${rBs.length?rBs.map(b=>{
            // Fix 1: Abweichungsfarbe typabhängig
            const abw=(b.ist||0)-(b.budget||0);
            const abwP=b.budget?((abw/b.budget)*100):0;
            const cls=abwClass(b.ist,b.budget,b.typ);
            const gesperrt=b.istGesperrt===true;
            const tsIst=(d.timestamps||[]).filter(t=>t.type==='ist_gespeichert'&&t.buchungId===b.id).slice(-1)[0];
            const tsAuf=(d.timestamps||[]).filter(t=>t.type==='ist_aufgehoben'&&t.buchungId===b.id).slice(-1)[0];
            return `<tr>
              <td><strong>${b.bezeichnung}</strong>
                ${tsIst?`<div style="font-size:.7rem;color:var(--text-3)">Gespeichert: ${tsIst.user} · ${fmtDateTime(tsIst.at)}${tsIst.bemerkung?' · "'+tsIst.bemerkung+'"':''}</div>`:''}
                ${tsAuf?`<div style="font-size:.7rem;color:var(--warning)">Entsperrt: ${tsAuf.user} · ${fmtDateTime(tsAuf.at)}</div>`:''}
              </td>
              <td><span class="badge ${b.typ==='einnahme'?'badge-success':'badge-gold'}">${b.typ==='einnahme'?'Einnahme':'Ausgabe'}</span></td>
              <td class="td-mono" style="text-align:right">${fmt(b.budget)}</td>
              <td class="td-mono" style="text-align:right">
                ${userCanWrite&&!gesperrt?`<div style="display:flex;gap:.4rem;justify-content:flex-end;align-items:center">
                  <input type="number" id="ist-${b.id}" class="form-input" style="width:110px;padding:.35rem .5rem;font-family:'DM Mono',monospace;font-size:.82rem;text-align:right" value="${b.ist||''}" placeholder="0,00" step="0.01" min="0"/>
                  <button class="btn btn-sm btn-primary" onclick="speichernIst('${b.id}')">Speichern</button>
                </div>`:`<span>${fmt(b.ist)}</span>`}
              </td>
              <td class="td-mono ${cls}" style="text-align:right">${b.ist!=null&&b.ist!==''?fmtDiffHtml(abw)+' ('+abwP.toFixed(1)+' %)':'—'}</td>
              <td>${gesperrt?`<span class="badge badge-success">Gesperrt</span>${isAdmin()?`<button class="btn btn-sm btn-danger" style="margin-left:.4rem" onclick="entsperrenIst('${b.id}')">Entsperren</button>`:''}`:`<span class="badge badge-neutral">Offen</span>`}</td>
            </tr>`;
          }).join(''):`<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:1.5rem">Keine Buchungssätze.</td></tr>`}
        </tbody>
      </table></div>
    </div>`;
  });
  el.innerHTML=html||`<div class="card" style="text-align:center;padding:2rem;color:var(--text-3)">Kein Referat ausgewählt.</div>`;
}
function speichernIst(buchungId) {
  const input=document.getElementById('ist-'+buchungId);
  if (!input) return;
  const value=parseFloat(input.value)||0;
  openBemerkungModal('Ist-Wert speichern & sperren',bem=>{
    const d=getYearData(); const b=d.buchungssaetze.find(x=>x.id===buchungId);
    if(b){b.ist=value;b.istGesperrt=true;addTimestamp('ist_gespeichert',{buchungId},bem);}
    saveState(); renderIstPage(); showToast('Ist-Wert gespeichert und gesperrt.');
  });
}
function entsperrenIst(buchungId) {
  openBemerkungModal('Ist-Wert entsperren (Admin)',bem=>{
    const d=getYearData(); const b=d.buchungssaetze.find(x=>x.id===buchungId);
    if(b){b.istGesperrt=false;addTimestamp('ist_aufgehoben',{buchungId},bem);}
    saveState(); renderIstPage(); showToast('Ist-Wert entsperrt.');
  });
}

// ─── AUSWERTUNG ────────────────────────────────
function renderAuswertungInit() {
  const d=getYearData(), sel=document.getElementById('auswertungSelect');
  sel.innerHTML=`<option value="all">Gesamtverein</option>`+(d.referate||[]).map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  renderAuswertung();
}
function renderAuswertung() {
  const d=getYearData(), val=document.getElementById('auswertungSelect').value;
  const referate=val==='all'?(d.referate||[]):(d.referate||[]).filter(r=>r.id===val);
  const allBs=d.buchungssaetze||[], el=document.getElementById('auswertungContent');
  document.getElementById('auswertungChartTitle').textContent='Budget vs. Ist – '+(val==='all'?'Gesamtverein':referate[0]?.name);

  let html=`<div class="section-card" style="margin-bottom:1.25rem">
    <div class="section-card-header"><span class="section-card-title">${val==='all'?state.clubName+' – Gesamtübersicht':state.clubName+' – '+(referate[0]?.name||'')} ${state.activeYear}</span></div>
    <div class="table-wrap"><table class="soll-ist-table"><thead><tr>
      <th>Referat</th><th>Bezeichnung</th><th>Typ</th>
      <th style="text-align:right">Budget</th><th style="text-align:right">Ist</th>
      <th style="text-align:right">Abweichung</th><th style="text-align:right">%</th>
    </tr></thead><tbody>`;

  let gBudgEin=0,gBudgAus=0,gIstEin=0,gIstAus=0;
  referate.forEach(r=>{
    allBs.filter(b=>b.referatId===r.id).forEach(b=>{
      // Fix 1: typabhängige Farbe
      const abw=(b.ist||0)-(b.budget||0);
      const abwP=b.budget?((abw/b.budget)*100):0;
      const cls=abwClass(b.ist,b.budget,b.typ);
      if(b.typ==='einnahme'){gBudgEin+=b.budget||0;gIstEin+=b.ist||0;}
      else{gBudgAus+=b.budget||0;gIstAus+=b.ist||0;}
      html+=`<tr>
        <td style="white-space:nowrap">${r.name}</td><td>${b.bezeichnung}</td>
        <td><span class="badge ${b.typ==='einnahme'?'badge-success':'badge-gold'}">${b.typ==='einnahme'?'Einnahme':'Ausgabe'}</span></td>
        <td class="td-mono" style="text-align:right">${fmt(b.budget)}</td>
        <td class="td-mono" style="text-align:right">${fmt(b.ist)}</td>
        <td class="td-mono ${cls}" style="text-align:right">${fmtDiffHtml(abw)}</td>
        <td class="td-mono ${cls}" style="text-align:right">${abwP.toFixed(1)} %</td>
      </tr>`;
    });
  });
  const gSaldoBudget=gBudgEin-gBudgAus, gSaldoIst=gIstEin-gIstAus;
  html+=`<tr class="total-row"><td colspan="3"><strong>Gesamt Saldo</strong></td>
    <td class="td-mono" style="text-align:right"><strong>${fmt(gSaldoBudget)}</strong></td>
    <td class="td-mono" style="text-align:right"><strong>${fmt(gSaldoIst)}</strong></td>
    <td class="td-mono" style="text-align:right"><strong>${fmtDiffHtml(gSaldoIst-gSaldoBudget)}</strong></td>
    <td class="td-mono" style="text-align:right"><strong>${abwPct(gSaldoIst,gSaldoBudget)}</strong></td>
  </tr></tbody></table></div></div>`;
  el.innerHTML=html;

  destroyChart('chartAuswertung');
  const ctxA=document.getElementById('chartAuswertung').getContext('2d');
  if (val==='all') {
    chartInstances['chartAuswertung']=new Chart(ctxA,{type:'bar',
      data:{labels:['Einnahmen','Ausgaben','Saldo'],datasets:[
        {label:'Budget',data:[gBudgEin,gBudgAus,gSaldoBudget],backgroundColor:['rgba(26,92,42,0.85)','rgba(26,92,42,0.85)',gSaldoBudget>=0?'rgba(26,92,42,0.85)':'rgba(153,27,27,0.85)'],borderRadius:4,barPercentage:0.7,order:2},
        {label:'Ist',   data:[gIstEin,gIstAus,gSaldoIst],     backgroundColor:['rgba(196,154,40,0.8)','rgba(196,154,40,0.8)',gSaldoIst>=0?'rgba(196,154,40,0.8)':'rgba(220,80,80,0.8)'],  borderRadius:4,barPercentage:0.42,order:1}
      ]},options:baseChartOpts()
    });
  } else {
    const rBs=allBs.filter(b=>b.referatId===val);
    chartInstances['chartAuswertung']=new Chart(ctxA,{type:'bar',
      data:{labels:rBs.map(b=>b.bezeichnung.substring(0,20)),datasets:[
        {label:'Budget',data:rBs.map(b=>b.budget||0),backgroundColor:'rgba(26,92,42,0.85)',borderRadius:4,barPercentage:0.7,order:2},
        {label:'Ist',   data:rBs.map(b=>b.ist||0),   backgroundColor:'rgba(196,154,40,0.8)',borderRadius:4,barPercentage:0.42,order:1}
      ]},options:baseChartOpts()
    });
  }
  const ausData=referate.map(r=>({name:r.name,val:allBs.filter(b=>b.referatId===r.id&&b.typ==='ausgabe').reduce((s,b)=>s+(b.ist||b.budget||0),0)})).filter(x=>x.val>0);
  destroyChart('chartAuswertungPie');
  document.getElementById('auswertungPieWrap').style.display=ausData.length?'':'none';
  if (ausData.length) {
    const ctxAP=document.getElementById('chartAuswertungPie').getContext('2d');
    chartInstances['chartAuswertungPie']=new Chart(ctxAP,{type:'doughnut',
      data:{labels:ausData.map(x=>x.name),datasets:[{data:ausData.map(x=>x.val),backgroundColor:['#1a5c2a','#2e7d3a','#4ea85a','#8b6914','#c49a28','#e8c84a','#68bb72','#3a8f48'],borderWidth:2,borderColor:'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{family:'DM Sans',size:11},color:C.text2}}}}
    });
  }
}

// ─── BENUTZER ──────────────────────────────────
function renderBenutzer() {
  document.getElementById('benutzerList').innerHTML=state.users.map(u=>`
    <div class="benutzer-card">
      <div class="benutzer-avatar" style="background:${avatarColor(u.role)}">${u.name[0].toUpperCase()}</div>
      <div class="benutzer-info">
        <div class="benutzer-name">${u.name}${u.id===state.currentUser.id?'<span class="badge badge-neutral" style="margin-left:.3rem">Ich</span>':''}</div>
        <div class="benutzer-email">${u.email||'—'}</div>
        <div style="font-size:.72rem;color:var(--text-3);margin-top:.1rem">Passwort: <code style="background:var(--bg);padding:.1rem .35rem;border-radius:3px">${u.password}</code></div>
      </div>
      <span class="badge ${getRoleBadgeClass(u.role)}">${getRoleLabel(u.role)}</span>
      <div class="benutzer-actions">
        <button class="icon-btn" onclick="openBenutzerModal('${u.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        ${u.id!==state.currentUser.id?`<button class="icon-btn danger" onclick="deleteBenutzer('${u.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg></button>`:''}
      </div>
    </div>`).join('');
}
function openBenutzerModal(id) {
  const u=id?state.users.find(x=>x.id===id):null;
  document.getElementById('modalTitle').textContent=u?'Benutzer bearbeiten':'Benutzer anlegen';
  document.getElementById('modalBody').innerHTML=`
    <div class="form-group"><label class="form-label">Name *</label><input type="text" id="mUN" class="form-input" value="${u?u.name:''}" placeholder="Vollständiger Name"/></div>
    <div class="form-group"><label class="form-label">E-Mail * <span style="font-size:.7rem;color:var(--text-3)">(Anmeldung mit Name ODER E-Mail möglich)</span></label>
      <input type="email" id="mUE" class="form-input" value="${u?u.email:''}" placeholder="email@verein.at"/></div>
    <div class="form-group"><label class="form-label">Rolle *</label>
      <select id="mUR" class="form-select">
        <option value="leser"      ${u?.role==='leser'?'selected':''}>🔵 Leser – nur Ansicht</option>
        <option value="schreiber"  ${u?.role==='schreiber'?'selected':''}>🟡 Schreiber – Buchungssätze & Ist-Werte eingeben</option>
        <option value="validierer" ${u?.role==='validierer'?'selected':''}>🟠 Validierer – Buchungssätze & Ist-Werte validieren</option>
        <option value="freigeber"  ${u?.role==='freigeber'?'selected':''}>🟢 Freigeber – Direktfreigabe & Jahresabschluss</option>
        <option value="admin"      ${u?.role==='admin'?'selected':''}>🔴 Administrator – alle Rechte</option>
      </select></div>
    <div class="form-group"><label class="form-label">${u?'Passwort (aktuell angezeigt – änderbar)':'Passwort *'}</label>
      <input type="text" id="mUP" class="form-input" value="${u?u.password:''}" placeholder="${u?'Neues Passwort eingeben':'Passwort festlegen'}"/>
      <span style="font-size:.7rem;color:var(--text-3)">Klartext-Anzeige (lokale Verwaltung ohne Server)</span></div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeAllModals()">Abbrechen</button><button class="btn btn-primary" onclick="saveBenutzer('${id||''}')">Speichern</button></div>`;
  openModal();
}
function saveBenutzer(id) {
  const name=document.getElementById('mUN').value.trim(), email=document.getElementById('mUE').value.trim();
  const role=document.getElementById('mUR').value, pw=document.getElementById('mUP').value;
  if (!name)  { showToast('Name erforderlich.'); return; }
  if (!email) { showToast('E-Mail erforderlich.'); return; }
  if (!id&&!pw) { showToast('Passwort erforderlich.'); return; }
  if (id) { const u=state.users.find(x=>x.id===id); if(u){u.name=name;u.email=email;u.role=role;if(pw)u.password=pw;} }
  else state.users.push({id:uid(),name,email,role,password:pw,active:true});
  saveState(); closeAllModals(); renderBenutzer(); showToast(id?'Benutzer aktualisiert.':'Benutzer angelegt.');
}
function deleteBenutzer(id) {
  if (!confirm('Benutzer löschen?')) return;
  state.users=state.users.filter(u=>u.id!==id);
  saveState(); renderBenutzer(); showToast('Benutzer gelöscht.');
}

// ─── EINSTELLUNGEN ─────────────────────────────
function renderEinstellungen() {
  document.getElementById('settingsClubName').value=state.clubName;
  if (state.logo) {
    document.getElementById('logoPreview').src=state.logo;
    document.getElementById('logoPreview').classList.remove('hidden');
    document.getElementById('logoUploadPlaceholder').classList.add('hidden');
  }
  renderYearList();
}
function saveSettings() {
  const name=document.getElementById('settingsClubName').value.trim();
  if (!name) { showToast('Vereinsname erforderlich.'); return; }
  state.clubName=name; saveState(); updateClubDisplay(); showToast('Einstellungen gespeichert.');
}
function handleLogoUpload(input) {
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{ state.logo=e.target.result; document.getElementById('logoPreview').src=state.logo; document.getElementById('logoPreview').classList.remove('hidden'); document.getElementById('logoUploadPlaceholder').classList.add('hidden'); saveState(); updateClubDisplay(); showToast('Logo gespeichert.'); };
  reader.readAsDataURL(file);
}
function renderYearList() {
  document.getElementById('yearList').innerHTML=state.years.map(y=>`
    <div class="year-item ${y==state.activeYear?'active-year':''}">
      <span>${y}${y==state.activeYear?' (aktiv)':''}</span>
      ${y!=state.activeYear?`<button class="icon-btn danger" onclick="removeYear(${y})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`:''}
    </div>`).join('');
}
function addYear() {
  const y=parseInt(document.getElementById('newYearInput').value);
  if (!y||y<2020||y>2040){showToast('Gültiges Jahr (2020-2040).'); return;}
  if (state.years.includes(y)){showToast('Bereits vorhanden.'); return;}
  state.years.push(y); state.years.sort(); ensureYearData(y);
  saveState(); renderYearList(); populateYearSelect(); document.getElementById('newYearInput').value=''; showToast('Jahr '+y+' hinzugefügt.');
}
function removeYear(y) {
  if (!confirm('Jahr '+y+' und alle Daten löschen?')) return;
  state.years=state.years.filter(x=>x!==y); delete state.data[y];
  saveState(); renderYearList(); populateYearSelect(); showToast('Jahr '+y+' entfernt.');
}

// ─── EXPORT / IMPORT ───────────────────────────
function exportJSON() {
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=`vereinsbudget_${state.clubName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url); showToast('Daten exportiert.');
}
function importJSON(input) {
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const imp=JSON.parse(e.target.result);
      if (!imp.users||!imp.data) throw new Error('Ungültiges Format');
      if (!confirm('Alle aktuellen Daten werden überschrieben. Fortfahren?')) return;
      const cu=state.currentUser;
      state={...state,...imp,currentUser:cu};
      ensureAllYears(); saveState();
      showToast('Daten importiert. Seite wird neu geladen …');
      setTimeout(()=>location.reload(),1200);
    } catch(e){showToast('Fehler beim Import: '+e.message);}
  };
  reader.readAsText(file); input.value='';
}

// ─── PDF EXPORT ────────────────────────────────
// Fix 2: Querformat, korrekte Zahlen (keine &amp; / HTML-Entities),
//        Logos proportional, Zeitstempel, Jahresabschluss
async function exportPDF() {
  // Sicherstellen dass Dashboard-Charts gerendert wurden
  if (!chartInstances['chartOverall']) renderDashboard();
  showToast('PDF wird erstellt …', 12000);
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const W=297, H=210, M=14;
  let yPos=0;
  const d=getYearData(), allBs=d.buchungssaetze||[], referate=d.referate||[];

  // Hilfsfunktion: Logo proportional einpassen in Box (lw x lh) – Fix 2
  function addLogoProprtional(x,y,maxW,maxH) {
    if (!state.logo) return;
    try {
      const img=new Image(); img.src=state.logo;
      const nw=img.naturalWidth||100, nh=img.naturalHeight||100;
      const ratio=nw/nh;
      let w=maxW, h=maxW/ratio;
      if (h>maxH){h=maxH;w=maxH*ratio;}
      const ox=x+(maxW-w)/2, oy=y+(maxH-h)/2;
      doc.addImage(state.logo,'PNG',ox,oy,w,h,'','NONE');
    } catch(e){}
  }

  function pdfHeader() {
    doc.setFillColor(26,92,42); doc.rect(0,0,W,16,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text(state.clubName,M,10);
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.text('Finanzplanung '+state.activeYear,M,15);
    addLogoProprtional(W-30,1,28,14);
  }
  function pdfFooter(pageNum) {
    const total=doc.getNumberOfPages();
    doc.setFillColor(26,92,42); doc.rect(0,H-10,W,10,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont('helvetica','normal');
    doc.text(state.clubName,M,H-4);
    doc.text('Erstellt: '+new Date().toLocaleString('de-AT'),W/2,H-4,{align:'center'});
    doc.text('Seite '+pageNum+' / '+total,W-M,H-4,{align:'right'});
  }

  // ── DECKBLATT ──────────────────────────────
  pdfHeader();
  doc.setTextColor(26,92,42); doc.setFontSize(26); doc.setFont('helvetica','bold');
  doc.text('Budgetbericht',W/2,60,{align:'center'});
  doc.setFontSize(16); doc.setFont('helvetica','normal'); doc.setTextColor(74,92,77);
  doc.text(state.clubName,W/2,74,{align:'center'});
  doc.setFontSize(12);
  doc.text('Planungsjahr: '+state.activeYear,W/2,85,{align:'center'});
  doc.setFontSize(9); doc.setTextColor(122,140,125);
  doc.text('Erstellt am: '+new Date().toLocaleString('de-AT'),W/2,93,{align:'center'});
  doc.text('Erstellt von: '+(state.currentUser?.name||'-'),W/2,100,{align:'center'});
  addLogoProprtional(W/2-30,110,60,50);

  // Freigabe + Abschluss auf Deckblatt – Fix 2: kein HTML
  const tsBudg=(d.timestamps||[]).filter(t=>t.type==='freigabe_budget').slice(-1)[0];
  const tsAbschl=(d.timestamps||[]).filter(t=>t.type==='abschluss').slice(-1)[0];
  let yDeck=165;
  if (tsBudg) {
    doc.setFillColor(232,245,234); doc.rect(M,yDeck-6,W-2*M,12,'F');
    doc.setTextColor(26,92,42); doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text('Budget freigegeben',M+3,yDeck);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(74,92,77);
    // Fix 2: kein Unicode-Sonderzeichen
    doc.text(tsBudg.user+' / '+fmtDateTime(tsBudg.at)+(tsBudg.bemerkung?' / "'+tsBudg.bemerkung+'"':''),M+3,yDeck+5);
    yDeck+=15;
  }
  if (tsAbschl) {
    doc.setFillColor(253,244,230); doc.rect(M,yDeck-6,W-2*M,12,'F');
    doc.setTextColor(139,105,20); doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text('Jahr abgeschlossen',M+3,yDeck);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(74,92,77);
    doc.text(tsAbschl.user+' / '+fmtDateTime(tsAbschl.at)+(tsAbschl.bemerkung?' / "'+tsAbschl.bemerkung+'"':''),M+3,yDeck+5);
  }
  pdfFooter(1);

  // ── SEITE PRO REFERAT ─────────────────────
  for (const r of referate) {
    doc.addPage(); pdfHeader(); pdfFooter(doc.getNumberOfPages()); yPos=24;
    doc.setTextColor(26,92,42); doc.setFontSize(12); doc.setFont('helvetica','bold');
    doc.text(state.clubName+' - '+r.name,M,yPos); yPos+=5;

    const tsV =(d.timestamps||[]).filter(t=>t.type==='validierung'&&t.referatId===r.id).slice(-1)[0];
    const tsF =(d.timestamps||[]).filter(t=>t.type==='freigabe_referat'&&t.referatId===r.id).slice(-1)[0];
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(122,140,125);
    if (tsV) { doc.text('Validiert: '+tsV.user+' / '+fmtDateTime(tsV.at)+(tsV.bemerkung?' / "'+tsV.bemerkung+'"':''),M,yPos); yPos+=4.5; }
    if (tsF) { doc.text('Freigegeben: '+tsF.user+' / '+fmtDateTime(tsF.at)+(tsF.bemerkung?' / "'+tsF.bemerkung+'"':''),M,yPos); yPos+=4.5; }
    yPos+=1;

    const rBs=allBs.filter(b=>b.referatId===r.id);
    if (!rBs.length) { doc.setFontSize(9);doc.setTextColor(122,140,125);doc.text('Keine Buchungssaetze vorhanden.',M,yPos);continue; }

    // Spalten
    const C2={bez:M,kat:92,typ:132,bud:168,ist:204,abw:242,pct:278};
    doc.setFillColor(26,92,42); doc.rect(M,yPos,W-2*M,7,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(7.5); doc.setFont('helvetica','bold');
    doc.text('Bezeichnung',C2.bez+2,yPos+5); doc.text('Kategorie',C2.kat+2,yPos+5);
    doc.text('Typ',C2.typ+2,yPos+5); doc.text('Budget',C2.bud,yPos+5,{align:'right'});
    doc.text('Ist-Wert',C2.ist,yPos+5,{align:'right'}); doc.text('Abweichung',C2.abw,yPos+5,{align:'right'});
    doc.text('%',C2.pct,yPos+5,{align:'right'}); yPos+=7;

    let budEin=0,budAus=0,istEin=0,istAus=0;
    rBs.forEach((b,i)=>{
      if (yPos>H-20){doc.addPage();pdfHeader();pdfFooter(doc.getNumberOfPages());yPos=24;}
      doc.setFillColor(i%2===0?247:255,i%2===0?248:255,i%2===0?246:255);
      doc.rect(M,yPos,W-2*M,7,'F');
      doc.setTextColor(26,31,27); doc.setFontSize(7.5); doc.setFont('helvetica','normal');
      const abw=(b.ist||0)-(b.budget||0);
      const abwP=b.budget?((abw/b.budget)*100):0;
      // Fix 2: saubere Strings ohne HTML-Entities
      const typStr=b.typ==='einnahme'?'Einnahme':'Ausgabe';
      doc.text((b.bezeichnung||'').substring(0,32),C2.bez+2,yPos+5);
      doc.text((b.kategorie||'-').substring(0,18),C2.kat+2,yPos+5);
      doc.text(typStr,C2.typ+2,yPos+5);
      doc.text(fmt(b.budget||0),C2.bud,yPos+5,{align:'right'});
      doc.text(fmt(b.ist||0),C2.ist,yPos+5,{align:'right'});
      // Fix 1+2: Farbe typabhängig, reines ASCII
      const positiv=(b.typ==='einnahme')?(abw>=0):(abw<=0);
      if(positiv)doc.setTextColor(30,107,46);else doc.setTextColor(153,27,27);
      doc.text(fmtDiff(abw),C2.abw,yPos+5,{align:'right'});
      doc.text(abwP.toFixed(1)+' %',C2.pct,yPos+5,{align:'right'});
      if(b.typ==='einnahme'){budEin+=b.budget||0;istEin+=b.ist||0;}
      else{budAus+=b.budget||0;istAus+=b.ist||0;}
      const tsI=(d.timestamps||[]).filter(t=>t.type==='ist_gespeichert'&&t.buchungId===b.id).slice(-1)[0];
      if (tsI) { doc.setTextColor(160,160,160);doc.setFontSize(6.2);doc.text('Ist gespeichert: '+tsI.user+' / '+fmtDateTime(tsI.at),C2.bez+2,yPos+9.5);yPos+=4; }
      yPos+=7;
    });
    // Summenzeile
    if (yPos>H-16){doc.addPage();pdfHeader();pdfFooter(doc.getNumberOfPages());yPos=24;}
    doc.setFillColor(200,230,204); doc.rect(M,yPos,W-2*M,8,'F');
    doc.setTextColor(26,92,42); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
    doc.text('Saldo '+r.name,C2.bez+2,yPos+5.5);
    doc.text(fmt(budEin-budAus),C2.bud,yPos+5.5,{align:'right'});
    doc.text(fmt(istEin-istAus),C2.ist,yPos+5.5,{align:'right'});
    const sAbw=(istEin-istAus)-(budEin-budAus);
    if(sAbw>=0)doc.setTextColor(30,107,46);else doc.setTextColor(153,27,27);
    doc.text(fmtDiff(sAbw),C2.abw,yPos+5.5,{align:'right'});
    yPos+=16;
  }

  // ── GESAMTÜBERSICHT ────────────────────────
  doc.addPage(); pdfHeader(); pdfFooter(doc.getNumberOfPages()); yPos=24;
  doc.setTextColor(26,92,42); doc.setFontSize(12); doc.setFont('helvetica','bold');
  doc.text(state.clubName+' - Gesamtuebersicht '+state.activeYear,M,yPos); yPos+=8;
  const C3={ref:M,bez:58,typ:118,bud:158,ist:195,abw:232,pct:272};
  doc.setFillColor(26,92,42); doc.rect(M,yPos,W-2*M,7,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(7.5); doc.setFont('helvetica','bold');
  doc.text('Referat',C3.ref+2,yPos+5); doc.text('Bezeichnung',C3.bez+2,yPos+5);
  doc.text('Typ',C3.typ+2,yPos+5); doc.text('Budget',C3.bud,yPos+5,{align:'right'});
  doc.text('Ist',C3.ist,yPos+5,{align:'right'}); doc.text('Abweichung',C3.abw,yPos+5,{align:'right'});
  doc.text('%',C3.pct,yPos+5,{align:'right'}); yPos+=7;

  let gBEin=0,gBAus=0,gIEin=0,gIAus=0,row=0;
  referate.forEach(r=>{
    allBs.filter(b=>b.referatId===r.id).forEach(b=>{
      if(yPos>H-16){doc.addPage();pdfHeader();pdfFooter(doc.getNumberOfPages());yPos=24;}
      doc.setFillColor(row%2===0?247:255,row%2===0?248:255,row%2===0?246:255);
      doc.rect(M,yPos,W-2*M,7,'F');
      doc.setTextColor(26,31,27); doc.setFontSize(7.5); doc.setFont('helvetica','normal');
      const abw=(b.ist||0)-(b.budget||0);
      const abwP=b.budget?((abw/b.budget)*100):0;
      doc.text(r.name.substring(0,18),C3.ref+2,yPos+5);
      doc.text((b.bezeichnung||'').substring(0,28),C3.bez+2,yPos+5);
      doc.text(b.typ==='einnahme'?'Einnahme':'Ausgabe',C3.typ+2,yPos+5);
      doc.text(fmt(b.budget||0),C3.bud,yPos+5,{align:'right'});
      doc.text(fmt(b.ist||0),C3.ist,yPos+5,{align:'right'});
      const positiv=(b.typ==='einnahme')?(abw>=0):(abw<=0);
      if(positiv)doc.setTextColor(30,107,46);else doc.setTextColor(153,27,27);
      doc.text(fmtDiff(abw),C3.abw,yPos+5,{align:'right'});
      doc.text(abwP.toFixed(1)+' %',C3.pct,yPos+5,{align:'right'});
      if(b.typ==='einnahme'){gBEin+=b.budget||0;gIEin+=b.ist||0;}else{gBAus+=b.budget||0;gIAus+=b.ist||0;}
      yPos+=7; row++;
    });
  });
  if(yPos>H-16){doc.addPage();pdfHeader();pdfFooter(doc.getNumberOfPages());yPos=24;}
  doc.setFillColor(200,230,204); doc.rect(M,yPos,W-2*M,8,'F');
  doc.setTextColor(26,92,42); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
  doc.text('GESAMTSALDO',C3.ref+2,yPos+5.5);
  doc.text(fmt(gBEin-gBAus),C3.bud,yPos+5.5,{align:'right'});
  doc.text(fmt(gIEin-gIAus),C3.ist,yPos+5.5,{align:'right'});
  const gAbw=(gIEin-gIAus)-(gBEin-gBAus);
  if(gAbw>=0)doc.setTextColor(30,107,46);else doc.setTextColor(153,27,27);
  doc.text(fmtDiff(gAbw),C3.abw,yPos+5.5,{align:'right'}); yPos+=16;

  // ── DIAGRAMME – Fix 2: proportional, kein Verzerren ──
  const chartsToPrint=[
    {id:'chartOverall',  label:'Budget vs. Ist - Gesamtverein'},
    {id:'chartReferate', label:'Soll-Ist-Vergleich je Referat'},
    {id:'chartPie',      label:'Kostenverteilung Ausgaben je Referat'}
  ];
  for (const ci of chartsToPrint) {
    const canvas=document.getElementById(ci.id); if(!canvas) continue;
    doc.addPage(); pdfHeader(); pdfFooter(doc.getNumberOfPages());
    doc.setTextColor(26,92,42); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(ci.label,M,24);
    try {
      const cvW=canvas.width, cvH=canvas.height;
      if (!cvW||!cvH) continue;
      const ratio=cvH/cvW;
      const maxW=W-2*M, maxH=H-46;
      let imgW=maxW, imgH=imgW*ratio;
      if(imgH>maxH){imgH=maxH;imgW=imgH/ratio;}
      const imgX=M+(maxW-imgW)/2;
      const imgData=canvas.toDataURL('image/png',1.0);
      doc.addImage(imgData,'PNG',imgX,30,imgW,imgH,'','NONE');
    } catch(e){}
  }

  doc.save('Budget_'+state.clubName.replace(/\s+/g,'_')+'_'+state.activeYear+'.pdf');
  showToast('PDF gespeichert.');
}

// ─── MODAL HELPERS ─────────────────────────────
function openModal()  { document.getElementById('modalOverlay').classList.remove('hidden'); }
function closeAllModals() { document.getElementById('modalOverlay').classList.add('hidden'); }
function closeModal(e) { if(e.target===document.getElementById('modalOverlay')) closeAllModals(); }
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeAllModals(); });

// ─── BOOT ──────────────────────────────────────
// Fix 8: State laden, dann Session prüfen – kein automatischer Logout bei F5
loadState();
if (state.currentUser) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initApp();
} else {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}
