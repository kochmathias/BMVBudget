const DEFAULT_STATE = { currentYear: 2025, currentUser: null, users: [{id: 'u1', name: 'Admin', username: 'admin', role: 'admin', password: 'admin123', active: true}], years: { 2025: { referate: [], buchungssaetze: [] } } };
let state = JSON.parse(localStorage.getItem('bmv_budget_state')) || DEFAULT_STATE;

function navigate(pageId) {
    if (!state.currentUser && pageId !== 'login') pageId = 'login';
    
    document.getElementById('loginScreen').classList.toggle('hidden', pageId !== 'login');
    document.getElementById('app').classList.toggle('hidden', pageId === 'login');
    
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById('page-' + pageId);
    if(target) target.classList.remove('hidden');
    
    if (pageId === 'dashboard') renderDashboard();
}

function renderDashboard() {
    const dash = document.getElementById('dash-budget-ein');
    if (!dash) return;
    dash.innerText = "Daten geladen..."; 
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('login-username').value;
        const p = document.getElementById('login-password').value;
        if (u === 'admin' && p === 'admin123') {
            state.currentUser = state.users[0];
            localStorage.setItem('bmv_budget_state', JSON.stringify(state));
            navigate('dashboard');
        } else {
            alert('Falsche Daten');
        }
    });

    document.querySelectorAll('.sidebar-menu a[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigate(link.dataset.page);
        });
    });

    if (state.currentUser) navigate('dashboard');
});
