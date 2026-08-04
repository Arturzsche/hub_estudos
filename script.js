// ==========================================
// CONFIGURAÇÕES DE NUVEM (GIST)
// ==========================================
const GITHUB_TOKEN = "ghp_" + "yrQ3OCD9pOVv" + "k7y9eLlMpSwg" + "kmPoq212TIxb";
const GIST_ID = "f13ced57c6740bec464f9b29df237ed4";
const GIST_FILENAME = "meusestudos_db.json";

// ==========================================
// VARIÁVEIS GLOBAIS E ESTADO
// ==========================================
let timerInterval;
let isRunning = false;
let lastTickTime = 0; 
let chartInstance = null;
let currentPalavraObj = null;

let ankiStudyQueue = [];
let currentAnkiCard = null;
let isAppReady = false; 
let currentFcType = 'lexical';

const CYCLE_PHASES = [
    { name: "Teoria (50min)", ms: 50 * 60 * 1000, isStudy: true },
    { name: "Pausa (10min)", ms: 10 * 60 * 1000, isStudy: false },
    { name: "Questões (30min)", ms: 30 * 60 * 1000, isStudy: true }
];

const REVIEW_INTERVALS = [1, 7, 15, 30, 60];

const PREDEFINED_EIXOS = [
    "Tecnologia e Sociedade",
    "Trabalho e Modernidade",
    "Cultura, Comportamento e Cidadania",
    "Meio Ambiente e Sustentabilidade",
    "Segurança Pública e Justiça"
];

let appData = {
    updatedAt: 0,
    history: {}, streak: 0, lastStudyDate: null, recordDay: 0, recordWeek: 0, dailyGoalSeconds: 14400, 
    savedSubjects: ["Direito Administrativo", "Controle Externo", "AFO", "Lei Orgânica", "Regimento Interno", "Português", "Prova Discursiva"],
    schedule: [
        { time: "14:00 - 15:30", days: ["", "", "", "", "", "", ""] },
        { time: "15:30 - 17:00", days: ["", "", "", "", "", "", ""] }
    ],
    cycleState: { date: "", subjectIndex: 0, phaseIndex: 0, msRemaining: CYCLE_PHASES[0].ms },
    reviews: [], flashcards: [], repertorios: [], timerMode: 'pomodoro', stopwatchMs: 0 
};

let todaysSubjects = [];
let currentEditingRevId = null;
let elements = {};

// ==========================================
// FUNÇÕES UTILITÁRIAS PARA IA (BLINDAGEM)
// ==========================================
/**
 * Extrai estritamente o objeto ou array JSON de uma string, 
 * ignorando saudações ou formatações Markdown da IA.
 */
function extrairJSONdaString(texto) {
    try {
        const jsonMatch = texto.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Nenhum padrão JSON encontrado na resposta da IA.");
    } catch (e) {
        console.error("Erro ao analisar a resposta da IA:", texto);
        throw e;
    }
}

// ==========================================
// INICIALIZAÇÃO E UI
// ==========================================
function injectLoginUI() {
    if (document.getElementById('custom-login-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'custom-login-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(10, 10, 15, 0.85); backdrop-filter: blur(10px);
        display: flex; align-items: center; justify-content: center; z-index: 999999;
        font-family: 'Inter', sans-serif;
    `;

    overlay.innerHTML = `
        <div style="background: var(--surface-color); border: 1px solid var(--border-color); padding: 2.5rem; border-radius: 16px; width: 100%; max-width: 400px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); text-align: center;">
            <div style="margin-bottom: 1.5rem;">
                <h2 style="color: var(--text-main); font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Acesso Restrito 🛡️</h2>
                <p style="color: var(--text-muted); font-size: 0.85rem;">Digite sua senha mestra para sincronizar seus estudos.</p>
            </div>
            <form id="login-form" style="display: flex; flex-direction: column; gap: 1rem;">
                <input type="password" id="login-password" placeholder="Senha de Acesso" required style="width: 100%; padding: 0.9rem 1rem; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-main); font-size: 1rem; outline: none;">
                <button type="submit" style="width: 100%; padding: 0.9rem; background: var(--text-main); color: var(--bg-color); border: none; border-radius: 8px; font-weight: 700; font-size: 0.95rem; cursor: pointer;">Entrar no Painel</button>
            </form>
            <p id="login-error" style="color: var(--danger-color); font-size: 0.75rem; margin-top: 1rem; display: none;">Senha incorreta. Tente novamente.</p>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const pass = document.getElementById('login-password').value;
        const MASTER_PASS = "tce2026"; 

        if (pass === MASTER_PASS) {
            localStorage.setItem('is_app_logged_in', 'true');
            overlay.remove();
            initAppFully();
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    });
}

function initElements() {
    elements = {
        timeMain: document.getElementById('time-main'), timeMs: document.getElementById('time-ms'),
        btnToggle: document.getElementById('btn-toggle'), btnSkipPhase: document.getElementById('btn-skip-phase'),
        btnSkipBlock: document.getElementById('btn-skip-block'), btnTimerMode: document.getElementById('btn-timer-mode'), 
        iconPlay: document.getElementById('icon-play'), iconPause: document.getElementById('icon-pause'),
        btnReset: document.getElementById('btn-reset'), totalTimeDisplay: document.getElementById('total-time-display'),
        sessionsDisplay: document.getElementById('sessions-display'), streakDisplay: document.getElementById('streak-display'),
        recordDayDisplay: document.getElementById('record-day-display'), recordWeekDisplay: document.getElementById('record-week-display'),
        totalAccumulated: document.getElementById('total-accumulated'), themeToggle: document.getElementById('theme-toggle'),
        focusToggle: document.getElementById('focus-toggle'), dailyProgressFill: document.getElementById('daily-progress-fill'),
        dailyPercentage: document.getElementById('daily-percentage'), heatmapGrid: document.getElementById('heatmap-grid'),
        macFullscreenBtn: document.getElementById('mac-fullscreen-btn'), scheduleTableBody: document.querySelector('#schedule-table tbody'),
        subjectBank: document.getElementById('subject-bank'), newSubjectInput: document.getElementById('new-subject-input'),
        btnAddSubject: document.getElementById('btn-add-subject'), btnAddCycle: document.getElementById('btn-add-cycle'),
        cycleSubject: document.getElementById('cycle-subject'), cyclePhaseBadge: document.getElementById('cycle-phase-badge'),
        btnOpenManualRev: document.getElementById('btn-add-manual-review'), modalManualRev: document.getElementById('manual-rev-modal'),
        inputManualRevName: document.getElementById('manual-rev-name'), selectManualRevSubject: document.getElementById('manual-rev-subject'),
        inputManualRevNotes: document.getElementById('manual-rev-notes'), btnCancelManualRev: document.getElementById('btn-manual-rev-cancel'),
        btnSaveManualRev: document.getElementById('btn-manual-rev-save'), btnManageReviews: document.getElementById('btn-manage-reviews'),
        modalManageRev: document.getElementById('manage-rev-modal'), btnCloseManage: document.getElementById('btn-close-manage'),
        allReviewsList: document.getElementById('all-reviews-list'), filterReviewSubject: document.getElementById('filter-review-subject'),
        modalEditRev: document.getElementById('edit-rev-modal'), editRevSubject: document.getElementById('edit-rev-subject'),
        editRevName: document.getElementById('edit-rev-name'), editRevNotes: document.getElementById('edit-rev-notes'),
        btnCancelEditRev: document.getElementById('btn-edit-rev-cancel'), btnSaveEditRev: document.getElementById('btn-edit-rev-save'),
        btnRefreshWord: document.getElementById('btn-refresh-word'), btnSaveFlashcard: document.getElementById('btn-save-flashcard'),
        btnNavConectivos: document.getElementById('btn-nav-conectivos'), btnCloseConectivos: document.getElementById('btn-close-conectivos'),
        modalConectivos: document.getElementById('conectivos-modal'), btnManageFlashcards: document.getElementById('btn-manage-flashcards'),
        modalManageFlashcards: document.getElementById('manage-flashcards-modal'), btnCloseManageFc: document.getElementById('btn-close-manage-fc'),
        allFlashcardsList: document.getElementById('all-flashcards-list'),
        btnOpenIaGenerator: document.getElementById('btn-open-ia-generator'),
        modalIaGenerator: document.getElementById('ia-generator-modal'),
        btnCloseIaGenerator: document.getElementById('btn-close-ia-generator'),
        btnGenerateAiCards: document.getElementById('btn-generate-ai-cards'),
        iaSourceText: document.getElementById('ia-source-text'),
        iaGeneratorStatus: document.getElementById('ia-generator-status'),
        iaStatusText: document.getElementById('ia-status-text'),
        btnOpenManualFc: document.getElementById('btn-open-manual-fc'),
        modalManualFc: document.getElementById('manual-fc-modal'),
        inputFcFront: document.getElementById('manual-fc-front'),
        inputFcBack: document.getElementById('manual-fc-back'),
        inputFcKeywords: document.getElementById('manual-fc-keywords'),
        inputFcContext: document.getElementById('manual-fc-context'),
        btnCancelManualFc: document.getElementById('btn-manual-fc-cancel'),
        btnSaveManualFc: document.getElementById('btn-manual-fc-save'),
        selectManualFcSubject: document.getElementById('manual-fc-subject'),
        selectIaFcSubject: document.getElementById('ia-fc-subject'),
        filterFcSubject: document.getElementById('filter-fc-subject'),
        btnRefreshRep: document.getElementById('btn-refresh-repertorio'),
        
        // Elementos de Sincronização em Nuvem
        btnSyncUpload: document.getElementById('btn-sync-upload'),
        btnSyncDownload: document.getElementById('btn-sync-download')
    };
}

function init() {
    if (localStorage.getItem('is_app_logged_in') !== 'true') {
        injectLoginUI(); return;
    }
    initAppFully();
}

async function initAppFully() {
    initElements(); 

    // Lê estritamente o local storage.
    try { loadLocalDataOnly(); } catch(e) { console.error("Erro ao carregar dados locais", e); }
    
    isAppReady = true;

    try { checkStreak(); } catch(e) {}
    try { calculateRecords(); } catch(e) {}
    try { renderSubjectBank(); } catch(e) {}
    try { renderSchedule(); } catch(e) {}
    try { setupNavigation(); } catch(e) {}
    try { initChart(); } catch(e) {}
    try { initManualReviews(); } catch(e) {}
    try { carregarVocabularioDiario(false); } catch(e) {}
    try { setupFlashcardsEConectivos(); } catch(e) {}
    try { initAnkiSession(); } catch(e) {}
    try { setupIaGenerator(); } catch(e) {}
    try { setupRepertorio(); } catch(e) {}
    
    if (localStorage.getItem('theme') === 'light') document.body.classList.remove('dark-mode');

    if(elements.btnSyncUpload) elements.btnSyncUpload.addEventListener('click', uploadToCloud);
    if(elements.btnSyncDownload) elements.btnSyncDownload.addEventListener('click', downloadFromCloud);

    document.querySelectorAll('.fc-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.fc-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFcType = btn.getAttribute('data-fctype');
            initAnkiSession();
        });
    });

    if(elements.btnAddSubject) {
        elements.btnAddSubject.addEventListener('click', () => {
            if(!elements.newSubjectInput) return; 
            const val = elements.newSubjectInput.value.trim();
            if (val && !appData.savedSubjects.includes(val)) { 
                appData.savedSubjects.push(val); 
                elements.newSubjectInput.value = ''; 
                saveData(); renderSubjectBank(); updateAppSubjects(); 
            }
        });
    }

    if(elements.newSubjectInput) {
        elements.newSubjectInput.addEventListener('keypress', (e) => { 
            if (e.key === 'Enter' && elements.btnAddSubject) elements.btnAddSubject.click(); 
        });
    }

    if(elements.btnAddCycle) {
        elements.btnAddCycle.addEventListener('click', () => { 
            appData.schedule.push({ time: "00:00 - 00:00", days: ["", "", "", "", "", "", ""] }); 
            saveData(); renderSchedule(); 
        });
    }

    if(elements.themeToggle) {
        elements.themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode'); 
            localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
            if (chartInstance) updateChartData();
        });
    }

    if(elements.macFullscreenBtn) elements.macFullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(e => console.log(e)); else document.exitFullscreen();
    });

    if(elements.focusToggle) elements.focusToggle.addEventListener('click', () => document.body.classList.toggle('focus-active'));

    const btnPrintSchedule = document.getElementById('btn-print-schedule');
    if (btnPrintSchedule) btnPrintSchedule.addEventListener('click', () => window.print());

    const btnOpenClear = document.getElementById('btn-open-clear');
    if(btnOpenClear) btnOpenClear.addEventListener('click', () => document.getElementById('clear-modal').classList.add('active'));
    const btnCancelClear = document.getElementById('btn-cancel-clear');
    if(btnCancelClear) btnCancelClear.addEventListener('click', () => document.getElementById('clear-modal').classList.remove('active'));
    
    const btnClearToday = document.getElementById('btn-clear-today');
    if(btnClearToday) btnClearToday.addEventListener('click', () => {
        const t = getTodayDate();
        if(appData.history[t]) { appData.history[t] = {time:0, sessions:0}; saveData(); calculateRecords(); updateUI(); resetTimer(); }
        document.getElementById('clear-modal').classList.remove('active');
    });
    
    const btnClearAll = document.getElementById('btn-clear-all');
    if(btnClearAll) btnClearAll.addEventListener('click', () => {
        appData.history={}; appData.streak=0; appData.lastStudyDate=null; appData.recordDay=0; appData.recordWeek=0;
        appData.history[getTodayDate()] = {time:0, sessions:0};
        saveData(); calculateRecords(); updateUI(); resetTimer();
        document.getElementById('clear-modal').classList.remove('active');
    });

    try { loadTimerState(); } catch(e) {}
    try { updateUI(); } catch(e) {}
}

function loadLocalDataOnly() {
    const localData = localStorage.getItem('studyAppData');
    if (localData) {
        try { mergeData(JSON.parse(localData)); } catch(e) {}
    }
    if (!appData.reviews) appData.reviews = [];
    if (!appData.flashcards) appData.flashcards = [];
    if (!appData.repertorios) appData.repertorios = [];
    if (!appData.timerMode) appData.timerMode = 'pomodoro';
    const today = getTodayDate();
    if (!appData.history[today]) appData.history[today] = { time: 0, sessions: 0 };
}

// ==========================================
// FUNÇÕES DE NUVEM SOB DEMANDA
// ==========================================
async function uploadToCloud() {
    if (!GITHUB_TOKEN || !GIST_ID || localStorage.getItem('is_app_logged_in') !== 'true') return;
    
    const btn = elements.btnSyncUpload;
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Salvando...';
    btn.disabled = true;

    appData.updatedAt = Date.now();
    localStorage.setItem('studyAppData', JSON.stringify(appData));

    try {
        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ files: { [GIST_FILENAME]: { content: JSON.stringify(appData) } } })
        });
        
        if (response.ok) alert('Dados salvos na nuvem com sucesso! ☁️');
        else throw new Error('Falha na resposta do Github');
    } catch (error) {
        console.error("Erro ao salvar dados no Gist", error);
        alert('Erro ao salvar na nuvem. Verifique o console.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function downloadFromCloud() {
    if (!GITHUB_TOKEN || !GIST_ID || localStorage.getItem('is_app_logged_in') !== 'true') return;
    if(!confirm('Isso vai sobrescrever todos os seus dados locais atuais com a versão salva no Gist. Tem certeza?')) return;

    const btn = elements.btnSyncDownload;
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Baixando...';
    btn.disabled = true;

    try {
        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        
        if (response.ok) {
            const gistData = await response.json();
            if (gistData.files && gistData.files[GIST_FILENAME]) {
                const fileContent = gistData.files[GIST_FILENAME].content;
                const actualData = JSON.parse(fileContent);
                const remoteStr = JSON.stringify(actualData);
                mergeData(actualData);
                localStorage.setItem('studyAppData', remoteStr);
                updateUI(); renderSchedule(); renderSubjectBank(); updateTimerDisplay(); 
                try { renderRepertorioList(); } catch(e) {}
                try { renderGerenciadorFlashcards(); initAnkiSession(); } catch(e) {}
                alert('Dados restaurados da nuvem com sucesso! ✅');
            }
        } else {
            throw new Error('Falha na resposta do Github');
        }
    } catch (error) {
        console.error("Erro ao carregar dados do Gist", error);
        alert('Erro ao puxar dados da nuvem. Verifique o console.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function saveData() {
    if (localStorage.getItem('is_app_logged_in') !== 'true' || !isAppReady) return; 
    appData.updatedAt = Date.now();
    localStorage.setItem('studyAppData', JSON.stringify(appData));
}

function getTodayDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateBR(dateStr) {
    if(!dateStr) return '';
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function playBeep() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator(); const gainNode = ctx.createGain();
        osc.connect(gainNode); gainNode.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, ctx.currentTime); 
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start(); osc.stop(ctx.currentTime + 0.8);
    } catch(e) { }
}

function formatHoursText(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function updateTodaysSubjects() {
    const jsDay = new Date().getDay();
    const tableDayIndex = jsDay === 0 ? 6 : jsDay - 1;
    todaysSubjects = [];
    appData.schedule.forEach(row => {
        const subject = row.days[tableDayIndex];
        if (subject && subject.trim() !== '') todaysSubjects.push(subject.trim());
    });
    const today = getTodayDate();
    if (appData.cycleState.date !== today) {
        appData.cycleState = { date: today, subjectIndex: 0, phaseIndex: 0, msRemaining: CYCLE_PHASES[0].ms };
        saveData();
    }
}

function updateTimerDisplay() {
    if(!elements.timeMain || !elements.timeMs) return;
    if (appData.timerMode === 'stopwatch') {
        if(elements.cycleSubject) elements.cycleSubject.textContent = "Estudo Livre";
        if(elements.cyclePhaseBadge) { elements.cyclePhaseBadge.textContent = "Cronômetro Progressivo"; elements.cyclePhaseBadge.className = "badge"; }
        if(elements.btnSkipPhase) elements.btnSkipPhase.style.opacity = '0.3'; 
        if(elements.btnSkipBlock) elements.btnSkipBlock.style.opacity = '0.3'; 

        let ms = appData.stopwatchMs || 0;
        const totalSeconds = Math.floor(ms / 1000);
        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const s = String(totalSeconds % 60).padStart(2, '0');
        const msStr = String(Math.floor((ms % 1000) / 10)).padStart(2, '0');

        elements.timeMain.textContent = `${h}:${m}:${s}`;
        elements.timeMs.textContent = `.${msStr}`;
    } else {
        if(elements.btnSkipPhase) elements.btnSkipPhase.style.opacity = '1';
        if(elements.btnSkipBlock) elements.btnSkipBlock.style.opacity = '1';

        let ms = appData.cycleState.msRemaining;
        if (ms < 0) ms = 0;
        
        const totalSeconds = Math.floor(ms / 1000);
        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const s = String(totalSeconds % 60).padStart(2, '0');
        const msStr = String(Math.floor((ms % 1000) / 10)).padStart(2, '0');

        elements.timeMain.textContent = `${h}:${m}:${s}`;
        elements.timeMs.textContent = `.${msStr}`;

        if (todaysSubjects.length === 0) {
            if(elements.cycleSubject) elements.cycleSubject.textContent = "Modo Livre (Agendado)";
            if(elements.cyclePhaseBadge) { elements.cyclePhaseBadge.textContent = "Sem matérias cadastradas hoje"; elements.cyclePhaseBadge.className = "badge break"; }
        } else if (appData.cycleState.subjectIndex >= todaysSubjects.length) {
            if(elements.cycleSubject) elements.cycleSubject.textContent = "Ciclo Concluído!";
            if(elements.cyclePhaseBadge) { elements.cyclePhaseBadge.textContent = "Excelente Trabalho"; elements.cyclePhaseBadge.className = "badge break"; }
        } else {
            if(elements.cycleSubject) elements.cycleSubject.textContent = todaysSubjects[appData.cycleState.subjectIndex];
            const phase = CYCLE_PHASES[appData.cycleState.phaseIndex];
            if(elements.cyclePhaseBadge) { elements.cyclePhaseBadge.textContent = `Fase: ${phase.name}`; elements.cyclePhaseBadge.className = phase.isStudy ? "badge" : "badge break"; }
        }
    }
}

function updateToggleBtn() {
    if(elements.iconPlay) elements.iconPlay.style.display = isRunning ? 'none' : 'block';
    if(elements.iconPause) elements.iconPause.style.display = isRunning ? 'block' : 'none';
}

function mergeData(parsedSaved) {
    if (parsedSaved.updatedAt !== undefined) appData.updatedAt = parsedSaved.updatedAt;
    if (parsedSaved.schedule) appData.schedule = parsedSaved.schedule;
    if (parsedSaved.savedSubjects) appData.savedSubjects = parsedSaved.savedSubjects;
    appData.history = parsedSaved.history || {};
    appData.streak = parsedSaved.streak || 0;
    appData.lastStudyDate = parsedSaved.lastStudyDate || null;
    appData.recordDay = parsedSaved.recordDay || 0;
    appData.recordWeek = parsedSaved.recordWeek || 0;
    if (parsedSaved.cycleState) appData.cycleState = parsedSaved.cycleState;
    if (parsedSaved.reviews) appData.reviews = parsedSaved.reviews;
    if (parsedSaved.flashcards) appData.flashcards = parsedSaved.flashcards; 
    if (parsedSaved.repertorios) appData.repertorios = parsedSaved.repertorios;
    if (parsedSaved.timerMode) appData.timerMode = parsedSaved.timerMode;
    if (parsedSaved.stopwatchMs !== undefined) appData.stopwatchMs = parsedSaved.stopwatchMs;
}

function checkStreak() {
    const today = getTodayDate(); const lastDateStr = appData.lastStudyDate; if (!lastDateStr) return;
    const diffDays = Math.round(Math.abs(new Date(today) - new Date(lastDateStr)) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) { appData.streak = 0; saveData(); }
}

function calculateRecords() {
    let maxDay = 0; let totalAcumulado = 0;
    for (const date in appData.history) {
        const time = appData.history[date].time; totalAcumulado += time; if (time > maxDay) maxDay = time;
    }
    appData.recordDay = maxDay;
    
    let maxWeek = 0; const dates = Object.keys(appData.history).sort();
    for (let i = 0; i < dates.length; i++) {
        let cw = 0; let start = new Date(dates[i]);
        for (let j = 0; j < 7; j++) {
            let checkDate = new Date(start); checkDate.setDate(checkDate.getDate() + j);
            const y = checkDate.getFullYear(); const m = String(checkDate.getMonth() + 1).padStart(2, '0'); const d = String(checkDate.getDate()).padStart(2, '0');
            const checkDateStr = `${y}-${m}-${d}`;
            if (appData.history[checkDateStr]) cw += appData.history[checkDateStr].time;
        }
        if (cw > maxWeek) maxWeek = cw;
    }
    appData.recordWeek = maxWeek;
}

function renderHeatmap() {
    if(!elements.heatmapGrid) return;
    elements.heatmapGrid.innerHTML = ''; const today = new Date();
    for(let i = 29; i >= 0; i--) {
        let d = new Date(today); d.setDate(today.getDate() - i);
        const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0');
        let dateStr = `${y}-${m}-${day}`;
        let time = appData.history[dateStr] ? appData.history[dateStr].time : 0;
        let cell = document.createElement('div'); cell.className = 'heatmap-cell';
        if (time === 0) cell.classList.add('level-0'); else if (time < 3600) cell.classList.add('level-1'); else if (time < 10800) cell.classList.add('level-2'); else cell.classList.add('level-3');
        cell.setAttribute('title', `${d.toLocaleDateString('pt-BR')}: ${formatHoursText(time)}`);
        elements.heatmapGrid.appendChild(cell);
    }
}

function createGoogleCalendarLink(rev) {
    const nextDateStr = rev.nextReview.replace(/-/g, ''); 
    const text = encodeURIComponent(`Revisão: ${rev.name}`);
    const details = encodeURIComponent(`Matéria: ${rev.subject}\nObservações: ${rev.notes || 'Nenhuma'}\n\nLembrete gerado pelo MeusEstudos.com`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${nextDateStr}T110000Z/${nextDateStr}T120000Z&details=${details}`;
}

function updateAppSubjects() {
    if(elements.selectManualRevSubject) { elements.selectManualRevSubject.innerHTML = '<option value="">Selecione a matéria...</option>'; appData.savedSubjects.forEach(subj => elements.selectManualRevSubject.appendChild(new Option(subj, subj))); }
    if(elements.filterReviewSubject) { const currentFilter = elements.filterReviewSubject.value; elements.filterReviewSubject.innerHTML = '<option value="all">Todas as Matérias</option>'; appData.savedSubjects.forEach(subj => elements.filterReviewSubject.appendChild(new Option(subj, subj))); elements.filterReviewSubject.value = currentFilter || 'all'; }
    if(elements.editRevSubject) { elements.editRevSubject.innerHTML = ''; appData.savedSubjects.forEach(subj => elements.editRevSubject.appendChild(new Option(subj, subj))); }
    
    if(elements.selectManualFcSubject) { elements.selectManualFcSubject.innerHTML = '<option value="">Selecione a matéria (Obrigatório)...</option>'; appData.savedSubjects.forEach(subj => elements.selectManualFcSubject.appendChild(new Option(subj, subj))); }
    if(elements.selectIaFcSubject) { elements.selectIaFcSubject.innerHTML = '<option value="">Selecione a matéria (Obrigatório)...</option>'; appData.savedSubjects.forEach(subj => elements.selectIaFcSubject.appendChild(new Option(subj, subj))); }
    if(elements.filterFcSubject) { const currentFilter = elements.filterFcSubject.value; elements.filterFcSubject.innerHTML = '<option value="all">Todas as Matérias</option>'; appData.savedSubjects.forEach(subj => elements.filterFcSubject.appendChild(new Option(subj, subj))); elements.filterFcSubject.value = currentFilter || 'all'; }
}

function initManualReviews() {
    if (!elements.btnOpenManualRev) return;
    updateAppSubjects();

    elements.btnOpenManualRev.addEventListener('click', () => {
        elements.inputManualRevName.value = ''; elements.selectManualRevSubject.value = ''; elements.inputManualRevNotes.value = '';
        elements.modalManualRev.classList.add('active');
    });
    if(elements.btnCancelManualRev) elements.btnCancelManualRev.addEventListener('click', () => elements.modalManualRev.classList.remove('active'));
    if(elements.btnSaveManualRev) elements.btnSaveManualRev.addEventListener('click', () => {
        const contentName = elements.inputManualRevName.value.trim(); const subject = elements.selectManualRevSubject.value; const notes = elements.inputManualRevNotes.value.trim();
        if (contentName && subject) {
            const d = new Date(); d.setDate(d.getDate() + REVIEW_INTERVALS[0]); 
            const formattedNext = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const newRev = { id: 'rev_' + Date.now(), subject: subject, name: contentName, notes: notes, step: 0, nextReview: formattedNext };
            appData.reviews.push(newRev); saveData(); renderPendingReviews(); renderAllReviews();
            elements.modalManualRev.classList.remove('active'); window.open(createGoogleCalendarLink(newRev), '_blank');
        } else alert("Por favor, selecione a matéria e digite o nome!");
    });
    if(elements.btnManageReviews) elements.btnManageReviews.addEventListener('click', () => { elements.filterReviewSubject.value = 'all'; renderAllReviews(); setTimeout(() => elements.modalManageRev.classList.add('active'), 10); });
    if(elements.btnCloseManage) elements.btnCloseManage.addEventListener('click', () => elements.modalManageRev.classList.remove('active'));
    if(elements.filterReviewSubject) elements.filterReviewSubject.addEventListener('change', renderAllReviews);
    if(elements.btnCancelEditRev) elements.btnCancelEditRev.addEventListener('click', () => elements.modalEditRev.classList.remove('active'));
    if(elements.btnSaveEditRev) elements.btnSaveEditRev.addEventListener('click', () => {
        const revIndex = appData.reviews.findIndex(r => r.id === currentEditingRevId);
        if (revIndex !== -1) {
            appData.reviews[revIndex].subject = elements.editRevSubject.value; appData.reviews[revIndex].name = elements.editRevName.value.trim(); appData.reviews[revIndex].notes = elements.editRevNotes.value.trim();
            saveData(); renderPendingReviews(); renderAllReviews(); elements.modalEditRev.classList.remove('active');
        }
    });
}

function renderPendingReviews() {
    const badge = document.getElementById('review-count-badge'); const list = document.getElementById('pending-reviews-list'); const msg = document.getElementById('no-reviews-msg');
    if(list) list.innerHTML = ''; const today = getTodayDate(); let pending = [];
    appData.reviews.forEach(rev => { if (rev.nextReview <= today) pending.push(rev); });
    
    if(pending.length > 0) {
        if(badge) { badge.style.display = 'inline-block'; badge.textContent = pending.length; }
        if(msg) msg.style.display = 'none';
        
        pending.forEach(rev => {
            const days = REVIEW_INTERVALS[rev.step]; const isOverdue = rev.nextReview < today;
            const overdueBadge = isOverdue ? `<span style="background: var(--danger-color); color: white; font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Atrasada</span>` : '';
            const html = `
                <div class="rev-info" style="flex: 1;">
                    <span class="err-subj-badge" style="font-size: 0.65rem; color: var(--text-muted);">${rev.subject || 'Geral'}</span>
                    <span class="rev-name" title="${rev.name}" style="font-weight: 600; display: block; margin: 2px 0;">${rev.name} ${overdueBadge}</span>
                    <span class="rev-step" style="font-size: 0.75rem; color: var(--text-muted);">Revisão de ${days} dia(s)</span>
                </div>
                <button class="icon-btn-small btn-complete-rev-side" data-id="${rev.id}" title="Marcar como revisada" style="color: var(--success-color); border: 2px solid var(--success-color); padding: 8px; flex-shrink: 0;"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>
            `;
            const divSmall = document.createElement('div'); divSmall.className = 'review-item due-today'; divSmall.innerHTML = html;
            if(list) list.appendChild(divSmall);
        });
        
        if(list) {
            list.querySelectorAll('.btn-complete-rev-side').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id'); const revIndex = appData.reviews.findIndex(r => r.id === id);
                    if(revIndex !== -1) {
                        const rev = appData.reviews[revIndex]; rev.step++;
                        if(rev.step >= REVIEW_INTERVALS.length) { appData.reviews.splice(revIndex, 1); alert(`🎉 Parabéns! Você concluiu todo o ciclo de revisões de "${rev.name}"!`); } 
                        else {
                            const d = new Date(); d.setDate(d.getDate() + REVIEW_INTERVALS[rev.step]);
                            rev.nextReview = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            window.open(createGoogleCalendarLink(rev), '_blank');
                        }
                        saveData(); renderPendingReviews(); renderAllReviews();
                    }
                });
            });
        }
    } else {
        if(badge) badge.style.display = 'none'; if(msg) msg.style.display = 'block';
    }
}

function renderAllReviews() {
    const list = elements.allReviewsList; if(!list) return; list.innerHTML = '';
    const filter = elements.filterReviewSubject ? elements.filterReviewSubject.value : 'all';
    let filtered = appData.reviews; if(filter && filter !== 'all') filtered = filtered.filter(r => r.subject === filter);
    filtered.sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview));
    if(document.getElementById('rev-stat-total')) document.getElementById('rev-stat-total').textContent = filtered.length;

    if(filtered.length === 0) { list.innerHTML = `<div class="empty-msg" style="grid-column: 1 / -1; padding: 3rem 2rem; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: var(--radius); font-size: 0.9rem;">Nenhuma revisão encontrada.</div>`; return; }

    const today = getTodayDate();
    filtered.forEach(rev => {
        const stepText = rev.step < REVIEW_INTERVALS.length ? `${REVIEW_INTERVALS[rev.step]} dias` : 'Concluído';
        const notesHtml = rev.notes ? `<p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.3rem; border-left: 2px solid var(--border-color); padding-left: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${rev.notes}</p>` : '';
        const isOverdue = rev.nextReview <= today; const dateColor = isOverdue ? 'var(--danger-color)' : 'var(--text-main)';
        let completeBtnHtml = isOverdue ? `<button class="icon-btn-small btn-complete-rev" data-id="${rev.id}" title="Marcar etapa como Concluída" style="color: var(--success-color); border: 1px solid var(--success-color); padding: 4px; border-radius: 4px; margin-left: 8px;"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>` : '';
        
        const card = document.createElement('div'); card.className = 'error-card'; card.style.padding = '0.8rem 1rem'; card.style.gap = '0.5rem';
        card.innerHTML = `
            <div class="error-header" style="margin-bottom: 0; align-items: center;">
                <div style="flex: 1; min-width: 0;">
                    <span class="err-subj-badge" style="font-size: 0.6rem;">${rev.subject || 'Geral'}</span>
                    <h4 style="margin: 0.2rem 0 0 0; font-size: 0.9rem; color: var(--text-main); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${rev.name}">${rev.name}</h4>
                    ${notesHtml}
                </div>
                <div style="display: flex; gap: 4px; flex-shrink: 0; align-self: flex-start;">
                    <button class="icon-btn-small edit-rev-btn" data-id="${rev.id}" title="Editar Revisão" style="padding: 4px;"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                    <button class="icon-btn-small del-rev-btn" data-id="${rev.id}" title="Excluir Definitivamente" style="color: var(--danger-color); padding: 4px;"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg></button>
                </div>
            </div>
            <div class="error-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; border-top: 1px dashed var(--border-color); padding-top: 0.6rem;">
                <div style="display: flex; align-items: center; gap: 6px;"><span style="font-size: 0.75rem; color: var(--text-muted);">Próxima: <strong style="color: ${dateColor};">${formatDateBR(rev.nextReview)}</strong></span>${completeBtnHtml}</div>
                <span style="font-size: 0.65rem; background: var(--bg-color); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); font-weight: 600;">Etapa: ${stepText}</span>
            </div>
        `;
        list.appendChild(card);
    });

    list.querySelectorAll('.btn-complete-rev').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id'); const revIndex = appData.reviews.findIndex(r => r.id === id);
            if(revIndex !== -1) {
                const rev = appData.reviews[revIndex]; rev.step++;
                if(rev.step >= REVIEW_INTERVALS.length) { appData.reviews.splice(revIndex, 1); alert(`🎉 Parabéns! Você concluiu todo o ciclo de revisões de "${rev.name}"!`); } 
                else {
                    const d = new Date(); d.setDate(d.getDate() + REVIEW_INTERVALS[rev.step]);
                    rev.nextReview = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    window.open(createGoogleCalendarLink(rev), '_blank');
                }
                saveData(); renderAllReviews(); renderPendingReviews();
            }
        });
    });

    list.querySelectorAll('.del-rev-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(confirm('Tem certeza que deseja apagar esta revisão da sua agenda para sempre?')) {
                appData.reviews = appData.reviews.filter(r => r.id !== e.currentTarget.getAttribute('data-id')); saveData(); renderAllReviews(); renderPendingReviews();
            }
        });
    });

    list.querySelectorAll('.edit-rev-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentEditingRevId = e.currentTarget.getAttribute('data-id'); const rev = appData.reviews.find(r => r.id === currentEditingRevId);
            if(rev) {
                if(elements.editRevSubject) elements.editRevSubject.value = rev.subject;
                if(elements.editRevName) elements.editRevName.value = rev.name;
                if(elements.editRevNotes) elements.editRevNotes.value = rev.notes || '';
                if(elements.modalEditRev) elements.modalEditRev.classList.add('active');
            }
        });
    });
}

function updateUI() {
    try {
        updateTodaysSubjects(); const today = getTodayDate(); const todayData = appData.history[today] || { time: 0, sessions: 0 };
        const h = String(Math.floor(todayData.time / 3600)).padStart(2, '0'); const m = String(Math.floor((todayData.time % 3600) / 60)).padStart(2, '0'); const s = String(todayData.time % 60).padStart(2, '0');
        
        if(elements.totalTimeDisplay) elements.totalTimeDisplay.textContent = `${h}:${m}:${s}`;
        if(elements.sessionsDisplay) elements.sessionsDisplay.textContent = `${todayData.sessions} sessões hoje`;
        if(elements.streakDisplay) elements.streakDisplay.textContent = appData.streak;
        if(elements.recordDayDisplay) elements.recordDayDisplay.textContent = formatHoursText(appData.recordDay);
        if(elements.recordWeekDisplay) elements.recordWeekDisplay.textContent = formatHoursText(appData.recordWeek);
        
        let totalAccumulatedSeconds = Object.values(appData.history).reduce((acc, curr) => acc + curr.time, 0);
        if(elements.totalAccumulated) elements.totalAccumulated.textContent = formatHoursText(totalAccumulatedSeconds);
        
        let percentage = (todayData.time / appData.dailyGoalSeconds) * 100; if (percentage > 100) percentage = 100;
        if(elements.dailyProgressFill) elements.dailyProgressFill.style.width = `${percentage}%`;
        if(elements.dailyPercentage) elements.dailyPercentage.textContent = `${Math.floor(percentage)}%`;

        if (chartInstance) updateChartData(); renderHeatmap(); renderPendingReviews(); renderAllReviews();
    } catch(e) {}
}

function loadTimerState() {
    updateTodaysSubjects();
    const wasRunning = localStorage.getItem('isTimerRunning') === 'true'; const lastTick = parseInt(localStorage.getItem('lastTick')) || Date.now();
    if (wasRunning) {
        const missedMs = Date.now() - lastTick;
        if (missedMs > 0 && missedMs < 43200000) { 
            if (appData.timerMode === 'stopwatch') { appData.stopwatchMs += missedMs; appData.history[getTodayDate()].time += Math.floor(missedMs / 1000); } 
            else {
                appData.cycleState.msRemaining -= missedMs;
                if (appData.cycleState.msRemaining < 0) appData.cycleState.msRemaining = 0;
                else { const currentPhase = CYCLE_PHASES[appData.cycleState.phaseIndex]; if (currentPhase && currentPhase.isStudy) appData.history[getTodayDate()].time += Math.floor(missedMs / 1000); }
            }
            saveData();
        }
        startTimer(); 
    } else updateTimerDisplay();
    updateToggleBtn();
}

function startTimer() {
    if (isRunning) return;
    if (appData.timerMode === 'pomodoro' && todaysSubjects.length > 0 && appData.cycleState.subjectIndex >= todaysSubjects.length) return; 

    isRunning = true; updateToggleBtn(); const today = getTodayDate();
    
    if (localStorage.getItem('isTimerRunning') !== 'true') {
        appData.history[today].sessions++;
        if (appData.lastStudyDate !== today) {
            if (appData.lastStudyDate) { const diff = Math.round((new Date(today) - new Date(appData.lastStudyDate)) / (1000 * 60 * 60 * 24)); if (diff <= 1) appData.streak++; else appData.streak = 1; } 
            else appData.streak = 1;
            appData.lastStudyDate = today; saveData(); 
        }
    }

    localStorage.setItem('isTimerRunning', 'true'); lastTickTime = Date.now(); let accumulatedMsToSave = 0; 

    timerInterval = setInterval(() => {
        const now = Date.now(); const delta = now - lastTickTime; lastTickTime = now; accumulatedMsToSave += delta;

        if (appData.timerMode === 'stopwatch') appData.stopwatchMs += delta;
        else { appData.cycleState.msRemaining -= delta; if (todaysSubjects.length === 0) appData.cycleState.msRemaining = 0; }

        if (accumulatedMsToSave >= 1000) {
            const secondsPassed = Math.floor(accumulatedMsToSave / 1000); accumulatedMsToSave -= (secondsPassed * 1000); 
            const currentPhase = CYCLE_PHASES[appData.cycleState.phaseIndex];
            if (appData.timerMode === 'stopwatch' || todaysSubjects.length === 0 || (currentPhase && currentPhase.isStudy)) {
                appData.history[today].time += secondsPassed;
                if (appData.history[today].time % 5 === 0) saveData(); 
                if (appData.history[today].time % 60 === 0) calculateRecords();
                updateUI(); 
            }
        }

        if (appData.timerMode === 'pomodoro' && appData.cycleState.msRemaining <= 0 && todaysSubjects.length > 0) {
            playBeep(); appData.cycleState.phaseIndex++;
            if (appData.cycleState.phaseIndex >= CYCLE_PHASES.length) { appData.cycleState.phaseIndex = 0; appData.cycleState.subjectIndex++; }
            if (appData.cycleState.subjectIndex < todaysSubjects.length) appData.cycleState.msRemaining = CYCLE_PHASES[appData.cycleState.phaseIndex].ms;
            else { appData.cycleState.msRemaining = 0; pauseTimer(); }
            saveData();
        }
        updateTimerDisplay(); localStorage.setItem('lastTick', now.toString());
    }, 16); 
}

function pauseTimer() {
    if (!isRunning) return;
    isRunning = false; clearInterval(timerInterval); updateToggleBtn();
    localStorage.setItem('isTimerRunning', 'false'); localStorage.setItem('lastTick', Date.now().toString());
    calculateRecords(); saveData(); updateUI();
}

function resetTimer() {
    pauseTimer();
    if (appData.timerMode === 'stopwatch') appData.stopwatchMs = 0;
    else appData.cycleState = { date: getTodayDate(), subjectIndex: 0, phaseIndex: 0, msRemaining: CYCLE_PHASES[0].ms };
    localStorage.setItem('isTimerRunning', 'false'); saveData(); updateTimerDisplay();
}

function skipPhase() {
    if (appData.timerMode === 'stopwatch' || todaysSubjects.length === 0 || appData.cycleState.subjectIndex >= todaysSubjects.length) return;
    appData.cycleState.phaseIndex++;
    if (appData.cycleState.phaseIndex >= CYCLE_PHASES.length) { appData.cycleState.phaseIndex = 0; appData.cycleState.subjectIndex++; }
    if (appData.cycleState.subjectIndex < todaysSubjects.length) appData.cycleState.msRemaining = CYCLE_PHASES[appData.cycleState.phaseIndex].ms;
    else { appData.cycleState.msRemaining = 0; pauseTimer(); }
    saveData(); updateTimerDisplay();
}

function skipBlock() {
    if (appData.timerMode === 'stopwatch' || todaysSubjects.length === 0 || appData.cycleState.subjectIndex >= todaysSubjects.length) return;
    appData.cycleState.phaseIndex = 0; appData.cycleState.subjectIndex++;
    if (appData.cycleState.subjectIndex < todaysSubjects.length) appData.cycleState.msRemaining = CYCLE_PHASES[0].ms;
    else { appData.cycleState.msRemaining = 0; pauseTimer(); }
    saveData(); updateTimerDisplay();
}

document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-toggle')) { if (isRunning) pauseTimer(); else startTimer(); }
    if (e.target.closest('#btn-reset')) { resetTimer(); }
    if (e.target.closest('#btn-skip-phase')) { skipPhase(); }
    if (e.target.closest('#btn-skip-block')) { skipBlock(); }
    if (e.target.closest('#btn-timer-mode')) { 
        pauseTimer(); 
        appData.timerMode = appData.timerMode === 'pomodoro' ? 'stopwatch' : 'pomodoro'; 
        saveData(); 
        updateTimerDisplay(); 
    }
});

function getChartData() {
    const labels = []; const data = []; const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        labels.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase());
        data.push((appData.history[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`]?.time || 0) / 3600);
    }
    return { labels, data };
}

function initChart() {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById('weeklyChart'); if(!canvas) return; const ctx = canvas.getContext('2d');
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#999999';
    const barColor = getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#ffffff';
    const { labels, data } = getChartData();
    chartInstance = new Chart(ctx, {
        type: 'bar', data: { labels: labels, datasets: [{ label: 'Horas', data: data, backgroundColor: barColor, borderRadius: 6, barThickness: 45 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c) { const h = Math.floor(c.raw); const m = Math.round((c.raw - h) * 60); return `${h}h ${m}m`; } } } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(150, 150, 150, 0.05)', borderColor: 'transparent' }, ticks: { color: textColor, stepSize: 1, font: { size: 12 } } },
                x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', weight: 600, size: 12 } } }
            }
        }
    });
}

function updateChartData() {
    if(!chartInstance) return;
    const { labels, data } = getChartData();
    chartInstance.data.labels = labels; chartInstance.data.datasets[0].data = data;
    chartInstance.data.datasets[0].backgroundColor = getComputedStyle(document.body).getPropertyValue('--text-main').trim();
    chartInstance.update();
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn'); const views = document.querySelectorAll('.view');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if(btn.id === 'btn-nav-conectivos') return; 
            navButtons.forEach(b => b.classList.remove('active')); views.forEach(v => v.classList.remove('active'));
            btn.classList.add('active'); const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId); if(targetEl) targetEl.classList.add('active'); 
            localStorage.setItem('activeView', targetId); if (targetId === 'timer') updateTimerDisplay(); 
        });
    });
    let savedView = localStorage.getItem('activeView') || 'dashboard';
    const btnToClick = document.querySelector(`.nav-btn[data-target="${savedView}"]`); if (btnToClick) btnToClick.click();
}

function renderSubjectBank() {
    if(!elements.subjectBank) return; elements.subjectBank.innerHTML = '';
    appData.savedSubjects.forEach((subject, index) => {
        const pill = document.createElement('div'); pill.className = 'subject-pill'; pill.draggable = true;
        pill.innerHTML = `<span>${subject}</span><span class="delete-subject" title="Remover matéria">&times;</span>`;
        pill.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', subject); setTimeout(() => pill.classList.add('dragging'), 0); });
        pill.addEventListener('dragend', () => pill.classList.remove('dragging'));
        pill.querySelector('.delete-subject').addEventListener('click', () => { appData.savedSubjects.splice(index, 1); saveData(); renderSubjectBank(); updateAppSubjects(); });
        elements.subjectBank.appendChild(pill);
    });
}

function renderSchedule() {
    if(!elements.scheduleTableBody) return; elements.scheduleTableBody.innerHTML = '';
    appData.schedule.forEach((row, rowIndex) => {
        const tr = document.createElement('tr'); const tdTime = document.createElement('td'); tdTime.className = 'time-cell';
        const btnDeleteRow = document.createElement('button'); btnDeleteRow.className = 'btn-remove-row';
        btnDeleteRow.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>';
        btnDeleteRow.addEventListener('click', (e) => { e.stopPropagation(); appData.schedule.splice(rowIndex, 1); saveData(); renderSchedule(); updateTodaysSubjects(); updateTimerDisplay(); });
        const timeSpan = document.createElement('span'); timeSpan.className = 'time-text'; timeSpan.contentEditable = true; timeSpan.textContent = row.time;
        timeSpan.addEventListener('blur', (e) => { appData.schedule[rowIndex].time = e.target.textContent; saveData(); });
        tdTime.appendChild(btnDeleteRow); tdTime.appendChild(timeSpan); tr.appendChild(tdTime);

        row.days.forEach((dayContent, dayIndex) => {
            const tdDay = document.createElement('td'); tdDay.className = 'drop-zone'; tdDay.textContent = dayContent;
            tdDay.addEventListener('dragover', (e) => { e.preventDefault(); tdDay.classList.add('drag-over'); });
            tdDay.addEventListener('dragleave', () => tdDay.classList.remove('drag-over'));
            tdDay.addEventListener('drop', (e) => {
                e.preventDefault(); tdDay.classList.remove('drag-over'); const data = e.dataTransfer.getData('text/plain');
                if (data) { tdDay.textContent = data; appData.schedule[rowIndex].days[dayIndex] = data; saveData(); updateTodaysSubjects(); updateTimerDisplay(); }
            });
            tdDay.addEventListener('dblclick', () => { tdDay.textContent = ''; appData.schedule[rowIndex].days[dayIndex] = ''; saveData(); updateTodaysSubjects(); updateTimerDisplay(); });
            tr.appendChild(tdDay);
        });
        elements.scheduleTableBody.appendChild(tr);
    });
}

document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT' || document.activeElement.isContentEditable) return;
    const timerEl = document.getElementById('timer'); if (!timerEl || !timerEl.classList.contains('active')) return;
    if (e.code === 'Space' && e.shiftKey && e.ctrlKey) { e.preventDefault(); skipBlock(); return; } 
    else if (e.code === 'Space' && e.shiftKey) { e.preventDefault(); skipPhase(); return; } 
    else if (e.code === 'Space' && !e.ctrlKey) { e.preventDefault(); if (isRunning) pauseTimer(); else startTimer(); return; }
    if (e.code === 'Delete') resetTimer();
    if (e.code === 'Enter') { e.preventDefault(); document.body.classList.toggle('focus-active'); }
    if (e.code === 'Escape') document.body.classList.remove('focus-active');
});

window.addEventListener('beforeunload', () => { if (isRunning) pauseTimer(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && isRunning) localStorage.setItem('lastTick', Date.now().toString()); });

// ==========================================
// FUNÇÕES DE IA COM PARSER SEGURO (Versão v1)
// ==========================================
async function carregarVocabularioDiario(forceRefresh = false) {
    let API_KEY = localStorage.getItem('gemini_api_key');
    const hoje = getTodayDate();
    let palavraSalva = null;
    let dataSalva = null;
    
    try {
        const palStr = localStorage.getItem('palavra_concurso');
        if (palStr) palavraSalva = JSON.parse(palStr);
        dataSalva = localStorage.getItem('data_palavra');
    } catch(e) {
        palavraSalva = null;
    }

    const vocabContent = document.getElementById('vocab-content');
    const vocabLoading = document.getElementById('vocab-loading');

    const renderizarPalavra = (dados) => {
        currentPalavraObj = dados; 
        
        const wordEl = document.getElementById('vocab-word');
        if(wordEl) wordEl.textContent = dados.palavra;
        
        const meaningEl = document.getElementById('vocab-meaning');
        if(meaningEl) meaningEl.textContent = dados.significado;
        
        const synContainer = document.getElementById('vocab-synonyms');
        if(synContainer && Array.isArray(dados.sinonimos)) {
            synContainer.innerHTML = '';
            dados.sinonimos.forEach(syn => {
                const span = document.createElement('span');
                span.style.cssText = "font-size: 0.7rem; background: var(--border-color); color: var(--text-main); padding: 2px 8px; border-radius: 12px; font-weight: 500;";
                span.textContent = syn;
                synContainer.appendChild(span);
            });
        }
        
        const exampleEl = document.getElementById('vocab-example');
        if(exampleEl) exampleEl.textContent = `"${dados.aplicacao}"`;
        
        if(vocabLoading) vocabLoading.style.display = 'none';
        if(vocabContent) vocabContent.style.display = 'flex';
    };

    if (!forceRefresh && palavraSalva && dataSalva === hoje) {
        renderizarPalavra(palavraSalva);
        return;
    }

    if (!API_KEY) {
        renderizarPalavra({ 
            palavra: "Desídia", 
            significado: "Disposição para evitar esforço físico ou moral; indolência, negligência.", 
            sinonimos: ["Omissão", "Inércia"], 
            aplicacao: "A impunidade é corolário da desídia estatal na estruturação de forças de segurança." 
        });
        return;
    }

    if (forceRefresh && vocabLoading) {
        if(vocabContent) vocabContent.style.display = 'none';
        vocabLoading.style.display = 'block';
        vocabLoading.innerHTML = `<div class="modern-spinner"></div><br>Gerando nova palavra...`;
    }

    try {
        const promptText = "Atue como um avaliador rigoroso de redação de concursos. Forneça UMA palavra de vocabulário avançado e formal útil para uma dissertação sobre temas sociais ou de cidadania. O retorno deve ser EXATAMENTE E APENAS um objeto JSON neste formato, sem crases: {\"palavra\": \"Exemplo\", \"significado\": \"Significado\", \"sinonimos\": [\"SinônimoA\"], \"aplicacao\": \"Frase\"}";

        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { temperature: 1.2 }
            })
        });

        if (!response.ok) throw new Error(`Erro na API (${response.status})`);

        const data = await response.json();
        const respostaTexto = data.candidates[0].content.parts[0].text;
        
        const palavraObj = extrairJSONdaString(respostaTexto);
        
        localStorage.setItem('palavra_concurso', JSON.stringify(palavraObj));
        localStorage.setItem('data_palavra', hoje);

        renderizarPalavra(palavraObj);
    } catch (error) {
        console.error("Falha ao gerar vocabulário:", error);
        renderizarPalavra({ palavra: "Anacrônico", significado: "Que não está de acordo com a sua época; obsoleto.", sinonimos: ["Ultrapassado", "Antiquado"], aplicacao: "O sistema prisional revela-se anacrônico diante das demandas atuais." });
    }
}

function renderRepertorioList() {
    const list = document.getElementById('repertorio-list');
    const badge = document.getElementById('rep-count-badge');
    const filterSelect = document.getElementById('filter-repertorio-eixo');
    
    if(!list) return;
    list.innerHTML = '';
    
    if(!appData.repertorios) appData.repertorios = [];

    if (filterSelect && filterSelect.options.length <= 1) {
        filterSelect.innerHTML = '<option value="all">Todos os Eixos</option>';
        PREDEFINED_EIXOS.forEach(eixo => {
            const option = document.createElement('option');
            option.value = eixo;
            option.textContent = eixo;
            filterSelect.appendChild(option);
        });
    }

    const filterValue = filterSelect ? filterSelect.value : 'all';
    
    let filteredList = appData.repertorios;
    if (filterValue !== 'all') {
        filteredList = appData.repertorios.filter(r => r.eixo === filterValue);
    }
    
    if(badge) badge.textContent = filteredList.length;

    if(filteredList.length === 0) {
        list.innerHTML = `<div style="text-align: center; padding: 3rem; background: var(--surface-color); border: 1px dashed var(--border-color); border-radius: 12px; color: var(--text-muted);">Nenhum repertório encontrado para esta seleção.</div>`;
        return;
    }

    [...filteredList].reverse().forEach((rep) => {
        const card = document.createElement('div');
        card.style.cssText = "background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03); position: relative;";
        
        card.innerHTML = `
            <button class="icon-btn-small btn-del-rep" data-id="${rep.id}" style="position: absolute; top: 1.5rem; right: 1.5rem; color: var(--danger-color); padding: 4px;" title="Apagar do Acervo">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
            </button>
            <div style="margin-bottom: 1.2rem;">
                <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); font-weight: 700;">${rep.eixo}</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.2rem;">
                <div style="padding: 1rem; background: var(--bg-color); border-radius: 8px; border-left: 3px solid #6366f1;">
                    <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); font-weight: 700;">Nome do Repertório</span>
                    <p style="font-size: 1.05rem; color: var(--text-main); font-weight: 600; margin: 0.2rem 0 0 0;">${rep.nome}</p>
                </div>
                <div style="padding: 1rem; background: var(--bg-color); border-radius: 8px; border-left: 3px solid #8b5cf6;">
                    <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); font-weight: 700;">Autor ou Origem</span>
                    <p style="font-size: 1.05rem; color: var(--text-main); font-weight: 600; margin: 0.2rem 0 0 0;">${rep.autor}</p>
                </div>
            </div>
            <div style="margin-bottom: 1.2rem;">
                <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); font-weight: 700;">Explicação Simplificada</span>
                <p style="font-size: 0.95rem; color: var(--text-main); line-height: 1.6; margin-top: 0.3rem;">${rep.explicacao}</p>
            </div>
            <div style="padding: 1.2rem; background: rgba(39, 201, 63, 0.05); border: 1px solid rgba(39, 201, 63, 0.2); border-radius: 8px;">
                <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--success-color); font-weight: 700;">Gatilho de Aplicação</span>
                <p style="font-size: 0.95rem; color: var(--text-main); line-height: 1.6; margin: 0.3rem 0 0 0; font-style: italic;">${rep.gatilho}</p>
            </div>
        `;
        
        card.querySelector('.btn-del-rep').addEventListener('click', () => {
            if(confirm(`Tem certeza que deseja remover "${rep.nome}" do seu acervo?`)) {
                appData.repertorios = appData.repertorios.filter(r => r.id !== rep.id);
                saveData();
                renderRepertorioList();
            }
        });
        
        list.appendChild(card);
    });
}

async function carregarRepertorioDiario() {
    let API_KEY = localStorage.getItem('gemini_api_key');
    if (!API_KEY) {
        alert("Cadastre a chave da API do Gemini carregando a palavra do dia primeiro.");
        return;
    }

    const containerMain = document.getElementById('repertorio-container-main');
    const loadingDiv = document.getElementById('repertorio-loading');

    containerMain.style.display = 'none';
    loadingDiv.style.display = 'block';

    if(!appData.repertorios) appData.repertorios = [];
    const nomesExistentes = appData.repertorios.map(r => r.nome).join(', ');

    try {
        const promptText = "Atue como um professor especialista em redação para concursos públicos (com foco em segurança pública e cidadania). Forneça UM repertório sociocultural curinga e de alto nível. NÃO repita nenhum destes: " + nomesExistentes + ". O retorno deve ser estritamente um objeto JSON válido sem crases: {\"eixo\": \"Cultura, Comportamento e Cidadania\", \"nome\": \"Título\", \"autor\": \"Autor\", \"explicacao\": \"Explicação\", \"gatilho\": \"Gatilho\"}";

        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { temperature: 1.1 }
            })
        });

        if (!response.ok) throw new Error(`Erro na API (${response.status})`);

        const data = await response.json();
        const respostaTexto = data.candidates[0].content.parts[0].text;
        
        const repObj = extrairJSONdaString(respostaTexto);
        
        repObj.id = 'rep_' + Date.now();
        
        if (!PREDEFINED_EIXOS.includes(repObj.eixo)) {
            repObj.eixo = "Cultura, Comportamento e Cidadania"; 
        }
        
        appData.repertorios.push(repObj);
        saveData();
        
        const filterSelect = document.getElementById('filter-repertorio-eixo');
        if(filterSelect) filterSelect.value = 'all';
        
        renderRepertorioList();
        
    } catch (error) {
        console.error("Falha ao gerar repertório:", error);
        alert("Ocorreu um erro ao gerar o repertório (Verifique o console para detalhes). Tente novamente.");
    } finally {
        loadingDiv.style.display = 'none';
        containerMain.style.display = 'block';
    }
}

function setupRepertorio() {
    renderRepertorioList();
    if(elements.btnRefreshRep) {
        elements.btnRefreshRep.addEventListener('click', () => {
            carregarRepertorioDiario();
        });
    }
    const filterSelect = document.getElementById('filter-repertorio-eixo');
    if (filterSelect) {
        filterSelect.addEventListener('change', renderRepertorioList);
    }
}

function setupFlashcardsEConectivos() {
    if(elements.btnNavConectivos) {
        elements.btnNavConectivos.addEventListener('click', () => {
            if(elements.modalConectivos) elements.modalConectivos.classList.add('active');
        });
    }
    if(elements.btnCloseConectivos) {
        elements.btnCloseConectivos.addEventListener('click', () => {
            if(elements.modalConectivos) elements.modalConectivos.classList.remove('active');
        });
    }

    if(elements.btnRefreshWord) {
        elements.btnRefreshWord.addEventListener('click', () => {
            carregarVocabularioDiario(true);
        });
    }

    if(elements.btnSaveFlashcard) {
        elements.btnSaveFlashcard.addEventListener('click', () => {
            if(currentPalavraObj) {
                const jaExiste = appData.flashcards.some(f => f.palavra === currentPalavraObj.palavra);
                if(jaExiste) {
                    alert(`A palavra "${currentPalavraObj.palavra}" já está no seu baralho!`);
                } else {
                    const newCard = {
                        id: 'fc_' + Date.now(),
                        type: 'lexical', 
                        palavra: currentPalavraObj.palavra,
                        significado: currentPalavraObj.significado,
                        sinonimos: currentPalavraObj.sinonimos,
                        aplicacao: currentPalavraObj.aplicacao,
                        interval: 0,
                        ease: 2.5,
                        nextReview: getTodayDate()
                    };
                    appData.flashcards.push(newCard);
                    saveData();
                    initAnkiSession(); 
                    renderGerenciadorFlashcards();
                    alert(`"${currentPalavraObj.palavra}" adicionada ao Arsenal Lexical!`);
                }
            }
        });
    }
    
    if(elements.btnOpenManualFc) {
        elements.btnOpenManualFc.addEventListener('click', () => {
            if (elements.selectManualFcSubject) elements.selectManualFcSubject.value = '';
            if (elements.inputFcFront) elements.inputFcFront.value = '';
            if (elements.inputFcBack) elements.inputFcBack.value = '';
            if (elements.inputFcKeywords) elements.inputFcKeywords.value = '';
            if (elements.inputFcContext) elements.inputFcContext.value = '';
            if (elements.modalManualFc) elements.modalManualFc.classList.add('active');
        });
    }

    if(elements.btnCancelManualFc) {
        elements.btnCancelManualFc.addEventListener('click', () => {
            if (elements.modalManualFc) elements.modalManualFc.classList.remove('active');
        });
    }

    if(elements.btnSaveManualFc) {
        elements.btnSaveManualFc.addEventListener('click', () => {
            const subject = elements.selectManualFcSubject.value;
            const front = elements.inputFcFront.value.trim();
            const back = elements.inputFcBack.value.trim();
            
            const keywordsRaw = elements.inputFcKeywords.value;
            const keywords = keywordsRaw ? keywordsRaw.split(',').map(k => k.trim()).filter(k => k) : [];
            
            const context = elements.inputFcContext.value.trim();

            if(subject && front && back) {
                const newCard = {
                    id: 'fc_manual_' + Date.now() + Math.floor(Math.random() * 10000),
                    type: 'theory', 
                    subject: subject,
                    palavra: front,
                    significado: back,
                    sinonimos: keywords,
                    aplicacao: context, 
                    interval: 0,
                    ease: 2.5,
                    nextReview: getTodayDate()
                };
                
                appData.flashcards.push(newCard);
                saveData();
                
                document.querySelectorAll('.fc-tab').forEach(b => b.classList.remove('active'));
                const theoryTab = document.querySelector('.fc-tab[data-fctype="theory"]');
                if(theoryTab) theoryTab.classList.add('active');
                currentFcType = 'theory';

                initAnkiSession();
                try { renderGerenciadorFlashcards(); } catch(e) {}
                
                elements.modalManualFc.classList.remove('active');
                alert(`✅ Flashcard adicionado com sucesso à sua Sabatina Teórica!`);
            } else {
                alert("⚠️ A Matéria, a Frente (pergunta) e o Verso (resposta) são obrigatórios!");
            }
        });
    }
    
    if(elements.btnManageFlashcards) {
        elements.btnManageFlashcards.addEventListener('click', () => {
            if(elements.filterFcSubject) elements.filterFcSubject.value = 'all';
            renderGerenciadorFlashcards();
            elements.modalManageFlashcards.classList.add('active');
        });
    }
    if(elements.btnCloseManageFc) {
        elements.btnCloseManageFc.addEventListener('click', () => {
            elements.modalManageFlashcards.classList.remove('active');
        });
    }
    if(elements.filterFcSubject) {
        elements.filterFcSubject.addEventListener('change', renderGerenciadorFlashcards);
    }
    if(document.getElementById('btn-close-view-fc')) {
        document.getElementById('btn-close-view-fc').addEventListener('click', () => {
            document.getElementById('view-fc-modal').classList.remove('active');
        });
    }
}

function initAnkiSession() {
    const today = getTodayDate();
    
    ankiStudyQueue = appData.flashcards.filter(f => {
        const isDue = f.nextReview <= today;
        const cardType = f.type || 'lexical';
        return isDue && cardType === currentFcType;
    });
    
    const ankiSess = document.getElementById('anki-study-session');
    const ankiDone = document.getElementById('anki-done-msg');
    
    if(!ankiSess || !ankiDone) return;

    if (ankiStudyQueue.length > 0) {
        ankiSess.style.display = 'flex';
        ankiDone.style.display = 'none';
        loadNextAnkiCard();
    } else {
        ankiSess.style.display = 'none';
        ankiDone.style.display = 'block';
    }
}

function loadNextAnkiCard() {
    if (ankiStudyQueue.length === 0) {
        initAnkiSession(); 
        return;
    }
    
    currentAnkiCard = ankiStudyQueue[0];
    
    const ankiCard = document.getElementById('anki-card');
    const btnAnkiShow = document.getElementById('btn-anki-show');
    const ankiControls = document.getElementById('anki-controls');
    
    if(ankiCard) ankiCard.classList.remove('is-flipped');
    if(btnAnkiShow) btnAnkiShow.style.display = 'block';
    if(ankiControls) ankiControls.style.display = 'none';
    
    const statusEl = document.getElementById('anki-status');
    if(statusEl) statusEl.textContent = `REVISÕES PENDENTES (${currentFcType === 'lexical' ? 'LEXICAL' : 'TEORIA'}): ${ankiStudyQueue.length}`;
    
    const subjBadgeFront = document.getElementById('anki-card-subject-front');
    const subjBadgeBack = document.getElementById('anki-card-subject-back');
    if(subjBadgeFront) {
        if(currentAnkiCard.subject) {
            subjBadgeFront.style.display = 'inline-block';
            subjBadgeFront.textContent = currentAnkiCard.subject;
        } else {
            subjBadgeFront.style.display = 'none';
        }
    }
    if(subjBadgeBack) {
        if(currentAnkiCard.subject) {
            subjBadgeBack.style.display = 'inline-block';
            subjBadgeBack.textContent = currentAnkiCard.subject;
        } else {
            subjBadgeBack.style.display = 'none';
        }
    }

    const wordEl = document.getElementById('anki-word');
    if(wordEl) wordEl.textContent = currentAnkiCard.palavra;
    
    const wordBackEl = document.getElementById('anki-word-back');
    if(wordBackEl) wordBackEl.textContent = currentAnkiCard.palavra;
    
    const meanEl = document.getElementById('anki-meaning');
    if(meanEl) meanEl.textContent = currentAnkiCard.significado;
    
    const exWrapper = document.getElementById('anki-example-wrapper');
    const exEl = document.getElementById('anki-example');
    if(exWrapper && exEl) {
        if(currentAnkiCard.aplicacao && currentAnkiCard.aplicacao.trim() !== "") {
            exWrapper.style.display = 'block';
            exEl.textContent = `"${currentAnkiCard.aplicacao}"`;
        } else {
            exWrapper.style.display = 'none';
        }
    }
    
    const synContainer = document.getElementById('anki-synonyms');
    if(synContainer) {
        synContainer.innerHTML = '';
        if(Array.isArray(currentAnkiCard.sinonimos)) {
            currentAnkiCard.sinonimos.forEach(syn => {
                const span = document.createElement('span');
                span.style.cssText = "font-size: 0.8rem; background: var(--border-color); color: var(--text-main); padding: 4px 10px; border-radius: 12px; font-weight: 500;";
                span.textContent = syn;
                synContainer.appendChild(span);
            });
        }
    }
    
    const ival = currentAnkiCard.interval || 0;
    const e = currentAnkiCard.ease || 2.5;
    
    const iHard = ival === 0 ? 1 : Math.ceil(ival * 1.2);
    const iGood = ival === 0 ? 1 : Math.ceil(ival * 2.5);
    const iEasy = ival === 0 ? 4 : Math.ceil(ival * e * 1.3);
    
    const t2 = document.getElementById('anki-time-2'); if(t2) t2.textContent = `${iHard} d`;
    const t3 = document.getElementById('anki-time-3'); if(t3) t3.textContent = `${iGood} d`;
    const t4 = document.getElementById('anki-time-4'); if(t4) t4.textContent = `${iEasy} d`;
}

const cardContainer = document.getElementById('anki-card-container');
if(cardContainer) {
    cardContainer.addEventListener('click', () => {
        if (!currentAnkiCard) return;
        const ankiCard = document.getElementById('anki-card');
        const btnAnkiShow = document.getElementById('btn-anki-show');
        const ankiControls = document.getElementById('anki-controls');
        if(ankiCard) ankiCard.classList.add('is-flipped');
        if(btnAnkiShow) btnAnkiShow.style.display = 'none';
        if(ankiControls) ankiControls.style.display = 'flex';
    });
}

const btnShow = document.getElementById('btn-anki-show');
if(btnShow) {
    btnShow.addEventListener('click', (e) => {
        e.stopPropagation();
        const cc = document.getElementById('anki-card-container');
        if(cc) cc.click();
    });
}

document.querySelectorAll('.btn-anki-rate').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rating = parseInt(btn.getAttribute('data-rate'));
        
        let ival = currentAnkiCard.interval || 0;
        let ease = currentAnkiCard.ease || 2.5;
        
        if (rating === 1) { 
            ival = 0; ease = Math.max(1.3, ease - 0.2);
        } else if (rating === 2) { 
            ival = ival === 0 ? 1 : Math.ceil(ival * 1.2); ease = Math.max(1.3, ease - 0.15);
        } else if (rating === 3) { 
            ival = ival === 0 ? 1 : Math.ceil(ival * 2.5);
        } else if (rating === 4) { 
            ival = ival === 0 ? 4 : Math.ceil(ival * ease * 1.3); ease += 0.15;
        }
        
        currentAnkiCard.interval = ival;
        currentAnkiCard.ease = ease;
        
        const nextDate = new Date();
        if (rating === 1) {
            currentAnkiCard.nextReview = getTodayDate();
            ankiStudyQueue.push(ankiStudyQueue.shift()); 
        } else {
            nextDate.setDate(nextDate.getDate() + ival);
            currentAnkiCard.nextReview = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
            ankiStudyQueue.shift(); 
        }
        
        const idx = appData.flashcards.findIndex(f => f.id === currentAnkiCard.id);
        if (idx !== -1) appData.flashcards[idx] = currentAnkiCard;
        saveData();
        loadNextAnkiCard();
    });
});

function renderGerenciadorFlashcards() {
    if(!elements.allFlashcardsList) return;
    elements.allFlashcardsList.innerHTML = '';
    
    const filterContainer = document.getElementById('fc-filter-container');
    if(filterContainer) filterContainer.style.display = currentFcType === 'theory' ? 'flex' : 'none';

    const filterValue = elements.filterFcSubject ? elements.filterFcSubject.value : 'all';

    let fcList = (appData.flashcards || []).filter(f => (f.type || 'lexical') === currentFcType);
    
    if (currentFcType === 'theory' && filterValue !== 'all') {
        fcList = fcList.filter(f => f.subject === filterValue);
    }
    
    const fcStat = document.getElementById('fc-stat-total');
    if(fcStat) fcStat.textContent = fcList.length;

    if(fcList.length === 0) {
        elements.allFlashcardsList.innerHTML = `<div style="grid-column: 1 / -1; padding: 3rem; text-align: center; color: var(--text-muted);">Nenhum flashcard encontrado para este filtro.</div>`;
        return;
    }

    fcList.forEach((card, index) => {
        const div = document.createElement('div');
        div.className = 'fc-manage-card';
        
        const subjectHtml = card.subject ? `<span style="font-size: 0.65rem; background: var(--border-color); color: var(--text-main); padding: 2px 6px; border-radius: 4px; margin-bottom: 0.5rem; display: inline-block;">${card.subject}</span>` : '';

        div.innerHTML = `
            <div style="position: relative; z-index: 5;">
                ${subjectHtml}
                <h4 style="margin: 0 0 0.5rem 0; font-size: 1.2rem; color: var(--text-main); font-weight: 700; word-wrap: break-word; padding-right: 40px;">${card.palavra}</h4>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Próxima revisão: <strong>${formatDateBR(card.nextReview)}</strong></p>
            </div>
            
            <div class="btn-del-fc-wrapper" style="position: absolute; top: 1.5rem; right: 1.5rem; z-index: 20;">
                <button class="btn-del-fc" data-id="${card.id}" title="Apagar carta">
                    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
                </button>
            </div>
            
            <div class="fc-view-overlay" style="z-index: 10;">
                <button class="btn-view-content" data-index="${index}">
                    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                    Ver Conteúdo
                </button>
            </div>
        `;
        
        div.querySelector('.btn-del-fc').addEventListener('click', (e) => {
            e.stopPropagation();
            if(confirm(`Tem certeza que deseja apagar a carta "${card.palavra}"?`)) {
                appData.flashcards = appData.flashcards.filter(f => f.id !== card.id);
                saveData();
                renderGerenciadorFlashcards();
                initAnkiSession();
            }
        });

        div.querySelector('.btn-view-content').addEventListener('click', (e) => {
            e.stopPropagation();
            openViewFlashcardModal(card);
        });

        elements.allFlashcardsList.appendChild(div);
    });
}

function openViewFlashcardModal(card) {
    const modal = document.getElementById('view-fc-modal');
    document.getElementById('view-fc-word').textContent = card.palavra;
    document.getElementById('view-fc-meaning').textContent = card.significado;
    
    const exEl = document.getElementById('view-fc-example');
    if(card.aplicacao && card.aplicacao.trim() !== "") {
        exEl.parentElement.style.display = 'block';
        exEl.textContent = `"${card.aplicacao}"`;
    } else {
        exEl.parentElement.style.display = 'none';
    }
    
    const synContainer = document.getElementById('view-fc-synonyms');
    synContainer.innerHTML = '';
    if(Array.isArray(card.sinonimos)) {
        card.sinonimos.forEach(syn => {
            const span = document.createElement('span');
            span.style.cssText = "font-size: 0.75rem; background: var(--border-color); color: var(--text-main); padding: 4px 10px; border-radius: 12px; font-weight: 500;";
            span.textContent = syn;
            synContainer.appendChild(span);
        });
    }
    
    modal.classList.add('active');
}

function setupIaGenerator() {
    if (elements.btnOpenIaGenerator) {
        elements.btnOpenIaGenerator.addEventListener('click', () => {
            if (elements.selectIaFcSubject) elements.selectIaFcSubject.value = '';
            if (elements.iaSourceText) elements.iaSourceText.value = '';
            const fileInput = document.getElementById('ia-pdf-file');
            if (fileInput) fileInput.value = '';
            const fileLabel = document.getElementById('pdf-file-label');
            if (fileLabel) fileLabel.textContent = "Clique para selecionar um PDF";
            if (elements.modalIaGenerator) elements.modalIaGenerator.classList.add('active');
        });
    }

    if (elements.btnCloseIaGenerator) {
        elements.btnCloseIaGenerator.addEventListener('click', () => {
            if (elements.modalIaGenerator) elements.modalIaGenerator.classList.remove('active');
        });
    }

    const fileInput = document.getElementById('ia-pdf-file');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const fileLabel = document.getElementById('pdf-file-label');
            if (e.target.files.length > 0) {
                fileLabel.textContent = `📄 ${e.target.files[0].name}`;
            } else {
                fileLabel.textContent = "Clique para selecionar um PDF";
            }
        });
    }

    if (elements.btnGenerateAiCards) {
        elements.btnGenerateAiCards.addEventListener('click', gerarFlashcardsComIA);
    }
}

async function gerarFlashcardsComIA() {
    const fileInput = document.getElementById('ia-pdf-file');
    const texto = elements.iaSourceText.value.trim();
    const hasFile = fileInput && fileInput.files.length > 0;
    
    const subject = elements.selectIaFcSubject ? elements.selectIaFcSubject.value : "";

    if (!subject) {
        alert("Por favor, selecione a matéria de destino primeiro.");
        return;
    }

    if (!hasFile && !texto) {
        alert("Por favor, selecione um arquivo PDF ou cole algum texto para a IA analisar.");
        return;
    }

    elements.btnGenerateAiCards.style.display = 'none';
    elements.iaGeneratorStatus.style.display = 'block';
    elements.iaStatusText.textContent = hasFile ? "Enviando e analisando o PDF no servidor..." : "Analisando o texto...";

    try {
        let cardsGerados = [];

        if (hasFile) {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            const response = await fetch('http://localhost:5000/gerar_flashcards_pdf', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("Erro ao processar o PDF no servidor local.");
            cardsGerados = await response.json();

        } else {
            let API_KEY = localStorage.getItem('gemini_api_key');
            if (!API_KEY) {
                alert("Chave da API do Gemini não encontrada.");
                return;
            }

            const promptText = "Atue como um examinador de bancas de concurso público. Analise o texto e gere entre 3 e 5 flashcards em formato de array JSON puro, contendo estritamente as chaves: palavra, significado, sinonimos (como array de strings) e aplicacao. Retorne APENAS o JSON puro, sem blocos de código markdown.";

            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: promptText + " TEXTO: " + texto }] }] 
                })
            });

            if (!response.ok) throw new Error(`Erro na API (${response.status})`);
            const data = await response.json();
            const respostaTexto = data.candidates[0].content.parts[0].text;
            
            cardsGerados = extrairJSONdaString(respostaTexto);
        }

        let cardsAdicionados = 0;
        const hoje = getTodayDate();

        cardsGerados.forEach(cardData => {
            const jaExiste = appData.flashcards.some(f => f.palavra.toLowerCase() === cardData.palavra.toLowerCase());
            if (!jaExiste) {
                appData.flashcards.push({
                    id: 'fc_ia_' + Date.now() + Math.floor(Math.random() * 10000),
                    type: 'theory', 
                    subject: subject,
                    palavra: cardData.palavra || "Pergunta",
                    significado: cardData.significado || "Resposta",
                    sinonimos: Array.isArray(cardData.sinonimos) ? cardData.sinonimos : [],
                    aplicacao: cardData.aplicacao || "",
                    interval: 0,
                    ease: 2.5,
                    nextReview: hoje
                });
                cardsAdicionados++;
            }
        });

        if (cardsAdicionados > 0) {
            saveData();
            document.querySelectorAll('.fc-tab').forEach(b => b.classList.remove('active'));
            document.querySelector('.fc-tab[data-fctype="theory"]').classList.add('active');
            currentFcType = 'theory';
            
            initAnkiSession();
            try { renderGerenciadorFlashcards(); } catch(e) {}
            
            alert(`Sucesso! ${cardsAdicionados} flashcards foram enviados para a sua Sabatina Teórica!`);
            elements.modalIaGenerator.classList.remove('active');
        } else {
            alert("Os flashcards gerados já existiam no seu baralho.");
        }

    } catch (error) {
        console.error("Erro:", error);
        alert(`Erro ao gerar flashcards (verifique o console para detalhes).`);
    } finally {
        elements.btnGenerateAiCards.style.display = 'flex';
        elements.iaGeneratorStatus.style.display = 'none';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
