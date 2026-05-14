// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDKkVRT_2El3mT-9SjZPow9c0vtVMDjgPM",
    authDomain: "hubestudos-1ce06.firebaseapp.com",
    databaseURL: "https://hubestudos-1ce06-default-rtdb.firebaseio.com",
    projectId: "hubestudos-1ce06",
    storageBucket: "hubestudos-1ce06.firebasestorage.app",
    messagingSenderId: "951170319139",
    appId: "1:951170319139:web:5088d18ff383eebb934296"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let timerInterval;
let isRunning = false;
let lastTickTime = 0; 
let chartInstance = null;
let currentPalavraObj = null;

let ankiStudyQueue = [];
let currentAnkiCard = null;

const CYCLE_PHASES = [
    { name: "Teoria (50min)", ms: 50 * 60 * 1000, isStudy: true },
    { name: "Pausa (10min)", ms: 10 * 60 * 1000, isStudy: false },
    { name: "Questões (30min)", ms: 30 * 60 * 1000, isStudy: true }
];

const REVIEW_INTERVALS = [1, 7, 15, 30, 60];

let appData = {
    history: {}, streak: 0, lastStudyDate: null, recordDay: 0, recordWeek: 0, dailyGoalSeconds: 14400, 
    savedSubjects: ["Direito Administrativo", "Controle Externo", "AFO", "Lei Orgânica", "Regimento Interno", "Português", "Prova Discursiva"],
    schedule: [
        { time: "14:00 - 15:30", days: ["", "", "", "", "", "", ""] },
        { time: "15:30 - 17:00", days: ["", "", "", "", "", "", ""] }
    ],
    cycleState: { date: "", subjectIndex: 0, phaseIndex: 0, msRemaining: CYCLE_PHASES[0].ms },
    reviews: [], flashcards: [], timerMode: 'pomodoro', stopwatchMs: 0 
};

let todaysSubjects = [];
let currentEditingRevId = null;

const elements = {
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
    
    // Elementos IA & Flashcards
    btnRefreshWord: document.getElementById('btn-refresh-word'),
    btnSaveFlashcard: document.getElementById('btn-save-flashcard'),
    btnNavConectivos: document.getElementById('btn-nav-conectivos'),
    btnCloseConectivos: document.getElementById('btn-close-conectivos'),
    modalConectivos: document.getElementById('conectivos-modal'),
    btnManageFlashcards: document.getElementById('btn-manage-flashcards'),
    modalManageFlashcards: document.getElementById('manage-flashcards-modal'),
    btnCloseManageFc: document.getElementById('btn-close-manage-fc'),
    allFlashcardsList: document.getElementById('all-flashcards-list')
};

async function init() {
    await loadData(); 
    checkStreak();
    calculateRecords();
    renderSubjectBank(); 
    renderSchedule();    
    setupNavigation();
    initChart();
    initManualReviews(); 
    
    carregarVocabularioDiario(false); 
    setupFlashcardsEConectivos(); 
    initAnkiSession();
    
    if (localStorage.getItem('theme') === 'light') document.body.classList.remove('dark-mode');

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

    loadTimerState();
    updateUI();
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
    if (parsedSaved.timerMode) appData.timerMode = parsedSaved.timerMode;
    if (parsedSaved.stopwatchMs !== undefined) appData.stopwatchMs = parsedSaved.stopwatchMs;
}

async function loadData() {
    const localData = localStorage.getItem('studyAppData');
    if (localData) {
        try { mergeData(JSON.parse(localData)); } catch(e) {}
    }
    
    if (!appData.reviews) appData.reviews = [];
    if (!appData.flashcards) appData.flashcards = [];
    if (!appData.timerMode) appData.timerMode = 'pomodoro';
    const today = getTodayDate();
    if (!appData.history[today]) appData.history[today] = { time: 0, sessions: 0 };
}

function saveData() {
    localStorage.setItem('studyAppData', JSON.stringify(appData));
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

// ----------------- INTEGRAÇÃO GOOGLE CALENDAR ----------------- //
function createGoogleCalendarLink(rev) {
    const nextDateStr = rev.nextReview.replace(/-/g, ''); 
    const text = encodeURIComponent(`Revisão: ${rev.name}`);
    const details = encodeURIComponent(`Matéria: ${rev.subject}\nObservações: ${rev.notes || 'Nenhuma'}\n\nLembrete gerado pelo MeusEstudos.com`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${nextDateStr}T110000Z/${nextDateStr}T120000Z&details=${details}`;
}

function updateReviewSubjects() {
    if(elements.selectManualRevSubject) { elements.selectManualRevSubject.innerHTML = '<option value="">Selecione a matéria...</option>'; appData.savedSubjects.forEach(subj => elements.selectManualRevSubject.appendChild(new Option(subj, subj))); }
    if(elements.filterReviewSubject) { const currentFilter = elements.filterReviewSubject.value; elements.filterReviewSubject.innerHTML = '<option value="all">Todas as Matérias</option>'; appData.savedSubjects.forEach(subj => elements.filterReviewSubject.appendChild(new Option(subj, subj))); elements.filterReviewSubject.value = currentFilter || 'all'; }
    if(elements.editRevSubject) { elements.editRevSubject.innerHTML = ''; appData.savedSubjects.forEach(subj => elements.editRevSubject.appendChild(new Option(subj, subj))); }
}

function initManualReviews() {
    if (!elements.btnOpenManualRev) return;
    updateReviewSubjects();

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
    } catch(e) { console.error("Erro no updateUI:", e); }
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

if(elements.btnToggle) elements.btnToggle.addEventListener('click', () => { if (isRunning) pauseTimer(); else startTimer(); });
if(elements.btnReset) elements.btnReset.addEventListener('click', resetTimer);
if(elements.btnSkipPhase) elements.btnSkipPhase.addEventListener('click', skipPhase);
if(elements.btnSkipBlock) elements.btnSkipBlock.addEventListener('click', skipBlock);
if(elements.btnTimerMode) elements.btnTimerMode.addEventListener('click', () => { pauseTimer(); appData.timerMode = appData.timerMode === 'pomodoro' ? 'stopwatch' : 'pomodoro'; saveData(); updateTimerDisplay(); });

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

if(elements.themeToggle) elements.themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    if (chartInstance) updateChartData();
});
if(elements.macFullscreenBtn) elements.macFullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(e => console.log(e)); else document.exitFullscreen();
});
if(elements.focusToggle) elements.focusToggle.addEventListener('click', () => document.body.classList.toggle('focus-active'));

function renderSubjectBank() {
    if(!elements.subjectBank) return; elements.subjectBank.innerHTML = '';
    appData.savedSubjects.forEach((subject, index) => {
        const pill = document.createElement('div'); pill.className = 'subject-pill'; pill.draggable = true;
        pill.innerHTML = `<span>${subject}</span><span class="delete-subject" title="Remover matéria">&times;</span>`;
        pill.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', subject); setTimeout(() => pill.classList.add('dragging'), 0); });
        pill.addEventListener('dragend', () => pill.classList.remove('dragging'));
        pill.querySelector('.delete-subject').addEventListener('click', () => { appData.savedSubjects.splice(index, 1); saveData(); renderSubjectBank(); updateReviewSubjects(); });
        elements.subjectBank.appendChild(pill);
    });
}

if(elements.btnAddSubject) elements.btnAddSubject.addEventListener('click', () => {
    if(!elements.newSubjectInput) return; const val = elements.newSubjectInput.value.trim();
    if (val && !appData.savedSubjects.includes(val)) { appData.savedSubjects.push(val); elements.newSubjectInput.value = ''; saveData(); renderSubjectBank(); updateReviewSubjects(); }
});
if(elements.newSubjectInput) elements.newSubjectInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') elements.btnAddSubject.click(); });

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

if(elements.btnAddCycle) elements.btnAddCycle.addEventListener('click', () => { appData.schedule.push({ time: "00:00 - 00:00", days: ["", "", "", "", "", "", ""] }); saveData(); renderSchedule(); });

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

const btnPrintSchedule = document.getElementById('btn-print-schedule');
if (btnPrintSchedule) btnPrintSchedule.addEventListener('click', () => window.print());

init();

// --- 🧠 INTEGRAÇÃO IA: PALAVRA DO DIA BLINDADA CONTRA REPETIÇÃO ---
async function carregarVocabularioDiario(forceRefresh = false) {
    let API_KEY = localStorage.getItem('gemini_api_key');
    const hoje = getTodayDate();
    const palavraSalva = localStorage.getItem('palavra_concurso');
    const dataSalva = localStorage.getItem('data_palavra');

    const vocabContent = document.getElementById('vocab-content');
    const vocabLoading = document.getElementById('vocab-loading');

    const renderizarPalavra = (dados) => {
        if(!vocabContent || !vocabLoading) return;
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
        
        vocabLoading.style.display = 'none';
        vocabContent.style.display = 'flex';
    };

    if (!forceRefresh && palavraSalva && dataSalva === hoje) {
        try {
            renderizarPalavra(JSON.parse(palavraSalva));
            return;
        } catch(e) {} 
    }

    if (!API_KEY) {
        API_KEY = prompt("Segurança ativada! 🛡️\n\nCole sua NOVA chave de API do Gemini aqui.");
        if (API_KEY && API_KEY.trim() !== "") {
            localStorage.setItem('gemini_api_key', API_KEY.trim());
        } else {
            console.warn("Chave ausente. Carregando palavra offline.");
            renderizarPalavra({ palavra: "Desídia", significado: "Disposição para evitar esforço físico ou moral; indolência, negligência.", sinonimos: ["Omissão", "Inércia"], aplicacao: "A impunidade é corolário da desídia estatal na estruturação de forças de segurança." });
            return;
        }
    }

    // Reset interface para loading
    if (forceRefresh && vocabContent && vocabLoading) {
        vocabContent.style.display = 'none';
        vocabLoading.style.display = 'block';
        vocabLoading.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" style="animation: spin 1s linear infinite; margin-bottom: 8px; color: var(--text-muted);"><path fill="currentColor" d="M12 2v4c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 21.52 2 16H0c0 6.63 5.37 12 12 12s12-5.37 12-12S18.63 2 12 2z"/></svg><br>Gerando nova palavra...`;
    }

    // Memória de curto prazo para impedir o Gemini de repetir palavras
    let historicoPalavras = JSON.parse(localStorage.getItem('historico_palavras') || '[]');
    if (currentPalavraObj && !historicoPalavras.includes(currentPalavraObj.palavra)) {
        historicoPalavras.push(currentPalavraObj.palavra);
    }
    // Mantém só as últimas 10 na memória para não sobrecarregar
    if (historicoPalavras.length > 10) historicoPalavras.shift();
    localStorage.setItem('historico_palavras', JSON.stringify(historicoPalavras));

    try {
        const promptText = `Atue como um avaliador rigoroso de redação de concursos (foco em tribunais e carreiras policiais). 
        Semente de aleatoriedade para garantir ineditismo: ${Math.random()}.
        Forneça UMA palavra de vocabulário avançado e formal útil para uma dissertação. 
        REGRAS CRUCIAIS:
        1. A palavra DEVE ser inédita.
        2. É EXPRESSAMENTE PROIBIDO retornar qualquer uma destas palavras que já estudei: ${historicoPalavras.join(', ')}. Escolha um termo totalmente novo!
        O retorno deve ser EXATAMENTE E APENAS um objeto JSON neste formato, sem marcações markdown ou texto extra: {"palavra": "Exemplo", "significado": "Significado", "sinonimos": ["SinônimoA", "SinônimoB"], "aplicacao": "Frase de exemplo"}`;

        // AQUI ESTAVA O ERRO! CORRIGIDO PARA O MODELO QUE FUNCIONA NA SUA CONTA
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: {
                    temperature: 1.1, // Aumenta a criatividade da IA para não repetir
                    topP: 0.95
                }
            })
        });

        if (!response.ok) {
            if(response.status === 403 || response.status === 400) localStorage.removeItem('gemini_api_key');
            throw new Error(`Erro na API (${response.status})`);
        }

        const data = await response.json();
        const respostaTexto = data.candidates[0].content.parts[0].text;
        const jsonLimpo = respostaTexto.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const palavraObj = JSON.parse(jsonLimpo);
        localStorage.setItem('palavra_concurso', JSON.stringify(palavraObj));
        localStorage.setItem('data_palavra', hoje);

        // Salva a nova palavra gerada no histórico para ela não se repetir em breve
        if (!historicoPalavras.includes(palavraObj.palavra)) {
            historicoPalavras.push(palavraObj.palavra);
            if (historicoPalavras.length > 10) historicoPalavras.shift();
            localStorage.setItem('historico_palavras', JSON.stringify(historicoPalavras));
        }

        renderizarPalavra(palavraObj);
    } catch (error) {
        console.error("Erro ao buscar palavra via IA:", error);
        // Plano B com uma palavra diferente para você saber que caiu aqui
        renderizarPalavra({ palavra: "Anacrônico", significado: "Que não está de acordo com a sua época; obsoleto, ultrapassado.", sinonimos: ["Obsoleto", "Antiquado"], aplicacao: "O sistema penitenciário brasileiro revela-se anacrônico diante das demandas atuais." });
    }
}

// --- CONTROLE DE CONECTIVOS E FLASHCARDS (ANKI) ---
function setupFlashcardsEConectivos() {
    // 1. Modal Conectivos (Agora aberto pela Nav Bar)
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

    // 2. Atualizar Palavra 
    if(elements.btnRefreshWord) {
        elements.btnRefreshWord.addEventListener('click', () => {
            carregarVocabularioDiario(true);
        });
    }

    // 3. Salvar Flashcard para o Baralho
    if(elements.btnSaveFlashcard) {
        elements.btnSaveFlashcard.addEventListener('click', () => {
            if(currentPalavraObj) {
                const jaExiste = appData.flashcards.some(f => f.palavra === currentPalavraObj.palavra);
                if(jaExiste) {
                    alert(`A palavra "${currentPalavraObj.palavra}" já está no seu baralho!`);
                } else {
                    // Inicialização padrão algoritmo Anki
                    const newCard = {
                        id: 'fc_' + Date.now(),
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
                    initAnkiSession(); // Atualiza a fila se estiver na aba
                    renderGerenciadorFlashcards();
                    alert(`"${currentPalavraObj.palavra}" adicionada ao baralho de Flashcards!`);
                }
            }
        });
    }
    
    // 4. Modal de Gerenciar Baralho
    if(elements.btnManageFlashcards) {
        elements.btnManageFlashcards.addEventListener('click', () => {
            renderGerenciadorFlashcards();
            elements.modalManageFlashcards.classList.add('active');
        });
    }
    if(elements.btnCloseManageFc) {
        elements.btnCloseManageFc.addEventListener('click', () => {
            elements.modalManageFlashcards.classList.remove('active');
        });
    }
}

// --- LÓGICA DO ALGORITMO ANKI (REPETIÇÃO ESPAÇADA) ---
function initAnkiSession() {
    const today = getTodayDate();
    // Filtra os cards que estão agendados para hoje ou dias anteriores
    ankiStudyQueue = appData.flashcards.filter(f => f.nextReview <= today);
    
    if (ankiStudyQueue.length > 0) {
        document.getElementById('anki-study-session').style.display = 'flex';
        document.getElementById('anki-done-msg').style.display = 'none';
        loadNextAnkiCard();
    } else {
        document.getElementById('anki-study-session').style.display = 'none';
        document.getElementById('anki-done-msg').style.display = 'block';
    }
}

function loadNextAnkiCard() {
    if (ankiStudyQueue.length === 0) {
        initAnkiSession(); // Recarrega para exibir a tela de sucesso
        return;
    }
    
    currentAnkiCard = ankiStudyQueue[0];
    
    // Reset da Interface
    document.getElementById('anki-card').classList.remove('is-flipped');
    document.getElementById('btn-anki-show').style.display = 'block';
    document.getElementById('anki-controls').style.display = 'none';
    
    document.getElementById('anki-status').textContent = `REVISÕES PENDENTES: ${ankiStudyQueue.length}`;
    
    // Front do Card
    document.getElementById('anki-word').textContent = currentAnkiCard.palavra;
    
    // Back do Card
    document.getElementById('anki-word-back').textContent = currentAnkiCard.palavra;
    document.getElementById('anki-meaning').textContent = currentAnkiCard.significado;
    document.getElementById('anki-example').textContent = `"${currentAnkiCard.aplicacao}"`;
    
    const synContainer = document.getElementById('anki-synonyms');
    synContainer.innerHTML = '';
    currentAnkiCard.sinonimos.forEach(syn => {
        const span = document.createElement('span');
        span.style.cssText = "font-size: 0.8rem; background: var(--border-color); color: var(--text-main); padding: 4px 10px; border-radius: 12px; font-weight: 500;";
        span.textContent = syn;
        synContainer.appendChild(span);
    });
    
    // Calcula as previsões de dias para os botões do Anki
    const ival = currentAnkiCard.interval || 0;
    const e = currentAnkiCard.ease || 2.5;
    
    const iHard = ival === 0 ? 1 : Math.ceil(ival * 1.2);
    const iGood = ival === 0 ? 1 : Math.ceil(ival * 2.5);
    const iEasy = ival === 0 ? 4 : Math.ceil(ival * e * 1.3);
    
    document.getElementById('anki-time-2').textContent = `${iHard} d`;
    document.getElementById('anki-time-3').textContent = `${iGood} d`;
    document.getElementById('anki-time-4').textContent = `${iEasy} d`;
}

// Lógica de Giro e Botões do Anki
document.getElementById('anki-card-container').addEventListener('click', () => {
    if (!currentAnkiCard) return;
    document.getElementById('anki-card').classList.add('is-flipped');
    document.getElementById('btn-anki-show').style.display = 'none';
    document.getElementById('anki-controls').style.display = 'flex';
});

document.getElementById('btn-anki-show').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('anki-card-container').click();
});

document.querySelectorAll('.btn-anki-rate').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rating = parseInt(btn.getAttribute('data-rate'));
        
        let ival = currentAnkiCard.interval || 0;
        let ease = currentAnkiCard.ease || 2.5;
        
        if (rating === 1) { // Errei
            ival = 0;
            ease = Math.max(1.3, ease - 0.2);
        } else if (rating === 2) { // Difícil
            ival = ival === 0 ? 1 : Math.ceil(ival * 1.2);
            ease = Math.max(1.3, ease - 0.15);
        } else if (rating === 3) { // Bom
            ival = ival === 0 ? 1 : Math.ceil(ival * 2.5);
        } else if (rating === 4) { // Fácil
            ival = ival === 0 ? 4 : Math.ceil(ival * ease * 1.3);
            ease += 0.15;
        }
        
        currentAnkiCard.interval = ival;
        currentAnkiCard.ease = ease;
        
        // Define a próxima data
        const nextDate = new Date();
        if (rating === 1) {
            // Se errou, revisa hoje de novo no final da fila
            currentAnkiCard.nextReview = getTodayDate();
            ankiStudyQueue.push(ankiStudyQueue.shift()); 
        } else {
            nextDate.setDate(nextDate.getDate() + ival);
            currentAnkiCard.nextReview = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
            ankiStudyQueue.shift(); // Remove da fila de hoje
        }
        
        // Salva na base de dados
        const idx = appData.flashcards.findIndex(f => f.id === currentAnkiCard.id);
        if (idx !== -1) appData.flashcards[idx] = currentAnkiCard;
        saveData();
        
        // Vai para a próxima carta
        loadNextAnkiCard();
    });
});

// Gerenciador de Flashcards (Para ver, editar ou deletar cartas antigas)
function renderGerenciadorFlashcards() {
    if(!elements.allFlashcardsList) return;
    elements.allFlashcardsList.innerHTML = '';
    
    const fcList = appData.flashcards || [];
    document.getElementById('fc-stat-total').textContent = fcList.length;

    if(fcList.length === 0) {
        elements.allFlashcardsList.innerHTML = `<div style="grid-column: 1 / -1; padding: 3rem; text-align: center; color: var(--text-muted);">Você ainda não possui flashcards salvos no baralho.</div>`;
        return;
    }

    fcList.forEach((card, index) => {
        const div = document.createElement('div');
        div.className = 'error-card';
        div.style.padding = '1rem';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: var(--text-main);">${card.palavra}</h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Próxima revisão: <strong>${formatDateBR(card.nextReview)}</strong></p>
                </div>
                <button class="icon-btn-small btn-del-fc" data-id="${card.id}" title="Apagar carta" style="color: var(--danger-color);"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg></button>
            </div>
        `;
        div.querySelector('.btn-del-fc').addEventListener('click', () => {
            if(confirm(`Tem certeza que deseja apagar a carta "${card.palavra}"?`)) {
                appData.flashcards = appData.flashcards.filter(f => f.id !== card.id);
                saveData();
                renderGerenciadorFlashcards();
                initAnkiSession();
            }
        });
        elements.allFlashcardsList.appendChild(div);
    });
}
