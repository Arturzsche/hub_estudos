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

const CYCLE_PHASES = [
    { name: "Teoria (50min)", ms: 50 * 60 * 1000, isStudy: true },
    { name: "Pausa (10min)", ms: 10 * 60 * 1000, isStudy: false },
    { name: "Questões (30min)", ms: 30 * 60 * 1000, isStudy: true }
];

const REVIEW_INTERVALS = [1, 7, 15, 30, 60];

let appData = {
    history: {}, 
    streak: 0,
    lastStudyDate: null,
    recordDay: 0,
    recordWeek: 0,
    dailyGoalSeconds: 14400, 
    savedSubjects: ["Direito Administrativo", "Controle Externo", "AFO", "Lei Orgânica", "Regimento Interno", "Português", "Prova Discursiva"],
    schedule: [
        { time: "14:00 - 15:30", days: ["", "", "", "", "", "", ""] },
        { time: "15:30 - 17:00", days: ["", "", "", "", "", "", ""] }
    ],
    cycleState: {
        date: "",
        subjectIndex: 0,
        phaseIndex: 0,
        msRemaining: CYCLE_PHASES[0].ms
    },
    reviews: [],
    timerMode: 'pomodoro', 
    stopwatchMs: 0 
};

let todaysSubjects = [];
let currentEditingRevId = null;

const elements = {
    timeMain: document.getElementById('time-main'),
    timeMs: document.getElementById('time-ms'),
    btnToggle: document.getElementById('btn-toggle'),
    btnSkipPhase: document.getElementById('btn-skip-phase'),
    btnSkipBlock: document.getElementById('btn-skip-block'),
    btnTimerMode: document.getElementById('btn-timer-mode'), 
    iconPlay: document.getElementById('icon-play'),
    iconPause: document.getElementById('icon-pause'),
    btnReset: document.getElementById('btn-reset'),
    totalTimeDisplay: document.getElementById('total-time-display'),
    sessionsDisplay: document.getElementById('sessions-display'),
    streakDisplay: document.getElementById('streak-display'),
    recordDayDisplay: document.getElementById('record-day-display'),
    recordWeekDisplay: document.getElementById('record-week-display'),
    totalAccumulated: document.getElementById('total-accumulated'),
    themeToggle: document.getElementById('theme-toggle'),
    focusToggle: document.getElementById('focus-toggle'), 
    dailyProgressFill: document.getElementById('daily-progress-fill'),
    dailyPercentage: document.getElementById('daily-percentage'),
    heatmapGrid: document.getElementById('heatmap-grid'),
    macFullscreenBtn: document.getElementById('mac-fullscreen-btn'),
    
    scheduleTableBody: document.querySelector('#schedule-table tbody'),
    subjectBank: document.getElementById('subject-bank'),
    newSubjectInput: document.getElementById('new-subject-input'),
    btnAddSubject: document.getElementById('btn-add-subject'),
    btnAddCycle: document.getElementById('btn-add-cycle'),
    cycleSubject: document.getElementById('cycle-subject'),
    cyclePhaseBadge: document.getElementById('cycle-phase-badge'),
    
    btnOpenManualRev: document.getElementById('btn-add-manual-review'),
    modalManualRev: document.getElementById('manual-rev-modal'),
    inputManualRevName: document.getElementById('manual-rev-name'),
    selectManualRevSubject: document.getElementById('manual-rev-subject'),
    inputManualRevNotes: document.getElementById('manual-rev-notes'),
    btnCancelManualRev: document.getElementById('btn-manual-rev-cancel'),
    btnSaveManualRev: document.getElementById('btn-manual-rev-save'),
    
    btnManageReviews: document.getElementById('btn-manage-reviews'),
    modalManageRev: document.getElementById('manage-rev-modal'),
    btnCloseManage: document.getElementById('btn-close-manage'),
    allReviewsList: document.getElementById('all-reviews-list'),
    filterReviewSubject: document.getElementById('filter-review-subject'),
    
    modalEditRev: document.getElementById('edit-rev-modal'),
    editRevSubject: document.getElementById('edit-rev-subject'),
    editRevName: document.getElementById('edit-rev-name'),
    editRevNotes: document.getElementById('edit-rev-notes'),
    btnCancelEditRev: document.getElementById('btn-edit-rev-cancel'),
    btnSaveEditRev: document.getElementById('btn-edit-rev-save'),
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
    
    if (localStorage.getItem('theme') === 'light') document.body.classList.remove('dark-mode');

    document.getElementById('btn-open-clear').addEventListener('click', () => document.getElementById('clear-modal').classList.add('active'));
    document.getElementById('btn-cancel-clear').addEventListener('click', () => document.getElementById('clear-modal').classList.remove('active'));
    document.getElementById('btn-clear-today').addEventListener('click', () => {
        const t = getTodayDate();
        if(appData.history[t]) { appData.history[t] = {time:0, sessions:0}; saveData(); calculateRecords(); updateUI(); resetTimer(); }
        document.getElementById('clear-modal').classList.remove('active');
    });
    document.getElementById('btn-clear-all').addEventListener('click', () => {
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
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime); 
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
    } catch(e) { }
}

function formatHoursText(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
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
    if (appData.timerMode === 'stopwatch') {
        elements.cycleSubject.textContent = "Estudo Livre";
        elements.cyclePhaseBadge.textContent = "Cronômetro Progressivo";
        elements.cyclePhaseBadge.className = "badge";
        elements.btnSkipPhase.style.opacity = '0.3'; 
        elements.btnSkipBlock.style.opacity = '0.3'; 

        let ms = appData.stopwatchMs || 0;
        const totalSeconds = Math.floor(ms / 1000);
        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const s = String(totalSeconds % 60).padStart(2, '0');
        const msStr = String(Math.floor((ms % 1000) / 10)).padStart(2, '0');

        elements.timeMain.textContent = `${h}:${m}:${s}`;
        elements.timeMs.textContent = `.${msStr}`;

    } else {
        elements.btnSkipPhase.style.opacity = '1';
        elements.btnSkipBlock.style.opacity = '1';

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
            elements.cycleSubject.textContent = "Modo Livre (Agendado)";
            elements.cyclePhaseBadge.textContent = "Sem matérias cadastradas hoje";
            elements.cyclePhaseBadge.className = "badge break";
        } else if (appData.cycleState.subjectIndex >= todaysSubjects.length) {
            elements.cycleSubject.textContent = "Ciclo Concluído!";
            elements.cyclePhaseBadge.textContent = "Excelente Trabalho";
            elements.cyclePhaseBadge.className = "badge break";
        } else {
            elements.cycleSubject.textContent = todaysSubjects[appData.cycleState.subjectIndex];
            const phase = CYCLE_PHASES[appData.cycleState.phaseIndex];
            elements.cyclePhaseBadge.textContent = `Fase: ${phase.name}`;
            elements.cyclePhaseBadge.className = phase.isStudy ? "badge" : "badge break";
        }
    }
}

function updateToggleBtn() {
    elements.iconPlay.style.display = isRunning ? 'none' : 'block';
    elements.iconPause.style.display = isRunning ? 'block' : 'none';
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
    if (parsedSaved.timerMode) appData.timerMode = parsedSaved.timerMode;
    if (parsedSaved.stopwatchMs !== undefined) appData.stopwatchMs = parsedSaved.stopwatchMs;
}

async function loadData() {
    try {
        const snapshot = await database.ref('appData').once('value');
        if (snapshot.val()) {
            mergeData(snapshot.val());
            localStorage.setItem('studyAppData', JSON.stringify(appData)); 
        } else {
            const localData = localStorage.getItem('studyAppData');
            if (localData) { mergeData(JSON.parse(localData)); database.ref('appData').set(appData); }
        }
    } catch (error) {
        const localData = localStorage.getItem('studyAppData');
        if (localData) mergeData(JSON.parse(localData));
    }
    if (!appData.reviews) appData.reviews = [];
    if (!appData.timerMode) appData.timerMode = 'pomodoro';
    const today = getTodayDate();
    if (!appData.history[today]) appData.history[today] = { time: 0, sessions: 0 };
}

function saveData() {
    localStorage.setItem('studyAppData', JSON.stringify(appData));
    database.ref('appData').set(appData).catch(e => console.error(e));
}

function checkStreak() {
    const today = getTodayDate();
    const lastDateStr = appData.lastStudyDate;
    if (!lastDateStr) return;
    const diffDays = Math.round(Math.abs(new Date(today) - new Date(lastDateStr)) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) { appData.streak = 0; saveData(); }
}

function calculateRecords() {
    let maxDay = 0; let totalAcumulado = 0;
    for (const date in appData.history) {
        const time = appData.history[date].time;
        totalAcumulado += time;
        if (time > maxDay) maxDay = time;
    }
    appData.recordDay = maxDay;
    
    let maxWeek = 0;
    const dates = Object.keys(appData.history).sort();
    for (let i = 0; i < dates.length; i++) {
        let cw = 0; let start = new Date(dates[i]);
        for (let j = 0; j < 7; j++) {
            let checkDate = new Date(start); checkDate.setDate(checkDate.getDate() + j);
            
            const y = checkDate.getFullYear();
            const m = String(checkDate.getMonth() + 1).padStart(2, '0');
            const d = String(checkDate.getDate()).padStart(2, '0');
            const checkDateStr = `${y}-${m}-${d}`;
            
            if (appData.history[checkDateStr]) cw += appData.history[checkDateStr].time;
        }
        if (cw > maxWeek) maxWeek = cw;
    }
    appData.recordWeek = maxWeek;
}

function renderHeatmap() {
    elements.heatmapGrid.innerHTML = '';
    const today = new Date();
    for(let i = 29; i >= 0; i--) {
        let d = new Date(today); d.setDate(today.getDate() - i);
        
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        let dateStr = `${y}-${m}-${day}`;
        
        let time = appData.history[dateStr] ? appData.history[dateStr].time : 0;
        let cell = document.createElement('div'); cell.className = 'heatmap-cell';
        if (time === 0) cell.classList.add('level-0');
        else if (time < 3600) cell.classList.add('level-1');
        else if (time < 10800) cell.classList.add('level-2');
        else cell.classList.add('level-3');
        cell.setAttribute('title', `${d.toLocaleDateString('pt-BR')}: ${formatHoursText(time)}`);
        elements.heatmapGrid.appendChild(cell);
    }
}

// ----------------- INTEGRAÇÃO DIRETA COM O GOOGLE CALENDAR (AGENDAMENTO EM CASCATA) ----------------- //
function createGoogleCalendarLink(rev) {
    const nextDateStr = rev.nextReview.replace(/-/g, ''); 
    const text = encodeURIComponent(`Revisão: ${rev.name}`);
    const details = encodeURIComponent(`Matéria: ${rev.subject}\nObservações: ${rev.notes || 'Nenhuma'}\n\nLembrete gerado pelo MeusEstudos.com`);
    // Agenda o evento das 08:00h às 09:00h (Horário local do Brasil / UTC-3 = 11h UTC)
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${nextDateStr}T110000Z/${nextDateStr}T120000Z&details=${details}`;
}

function updateReviewSubjects() {
    if(elements.selectManualRevSubject) {
        elements.selectManualRevSubject.innerHTML = '<option value="">Selecione a matéria...</option>';
        appData.savedSubjects.forEach(subj => elements.selectManualRevSubject.appendChild(new Option(subj, subj)));
    }
    if(elements.filterReviewSubject) {
        const currentFilter = elements.filterReviewSubject.value;
        elements.filterReviewSubject.innerHTML = '<option value="all">Todas as Matérias</option>';
        appData.savedSubjects.forEach(subj => elements.filterReviewSubject.appendChild(new Option(subj, subj)));
        elements.filterReviewSubject.value = currentFilter || 'all';
    }
    if(elements.editRevSubject) {
        elements.editRevSubject.innerHTML = '';
        appData.savedSubjects.forEach(subj => elements.editRevSubject.appendChild(new Option(subj, subj)));
    }
}

function initManualReviews() {
    if (!elements.btnOpenManualRev) return;
    updateReviewSubjects();

    elements.btnOpenManualRev.addEventListener('click', () => {
        elements.inputManualRevName.value = ''; elements.selectManualRevSubject.value = ''; elements.inputManualRevNotes.value = '';
        elements.modalManualRev.classList.add('active');
    });
    
    elements.btnCancelManualRev.addEventListener('click', () => elements.modalManualRev.classList.remove('active'));
    
    // CRIAR NOVA REVISÃO E ABRIR O CALENDÁRIO
    elements.btnSaveManualRev.addEventListener('click', () => {
        const contentName = elements.inputManualRevName.value.trim();
        const subject = elements.selectManualRevSubject.value;
        const notes = elements.inputManualRevNotes.value.trim();
        
        if (contentName && subject) {
            const d = new Date(); d.setDate(d.getDate() + REVIEW_INTERVALS[0]); 
            
            const nextYear = d.getFullYear();
            const nextMonth = String(d.getMonth() + 1).padStart(2, '0');
            const nextDay = String(d.getDate()).padStart(2, '0');
            const formattedNext = `${nextYear}-${nextMonth}-${nextDay}`;
            
            const newRev = {
                id: 'rev_' + Date.now(), subject: subject, name: contentName, notes: notes, step: 0, nextReview: formattedNext
            };
            appData.reviews.push(newRev);
            
            saveData(); renderPendingReviews(); renderAllReviews();
            elements.modalManualRev.classList.remove('active');

            // Magia em cascata: Abre o calendário para agendar a 1ª revisão
            const gCalLink = createGoogleCalendarLink(newRev);
            window.open(gCalLink, '_blank');

        } else alert("Por favor, selecione a matéria e digite o nome!");
    });

    elements.btnManageReviews.addEventListener('click', () => {
        elements.filterReviewSubject.value = 'all'; 
        renderAllReviews(); 
        setTimeout(() => elements.modalManageRev.classList.add('active'), 10);
    });
    
    elements.btnCloseManage.addEventListener('click', () => elements.modalManageRev.classList.remove('active'));
    elements.filterReviewSubject.addEventListener('change', renderAllReviews);

    elements.btnCancelEditRev.addEventListener('click', () => elements.modalEditRev.classList.remove('active'));
    elements.btnSaveEditRev.addEventListener('click', () => {
        const revIndex = appData.reviews.findIndex(r => r.id === currentEditingRevId);
        if (revIndex !== -1) {
            appData.reviews[revIndex].subject = elements.editRevSubject.value;
            appData.reviews[revIndex].name = elements.editRevName.value.trim();
            appData.reviews[revIndex].notes = elements.editRevNotes.value.trim();
            saveData(); renderPendingReviews(); renderAllReviews();
            elements.modalEditRev.classList.remove('active');
        }
    });
}

// CONCLUIR REVISÃO E AGENDAR A PRÓXIMA (Tela Principal)
function renderPendingReviews() {
    const badge = document.getElementById('review-count-badge');
    const list = document.getElementById('pending-reviews-list');
    const msg = document.getElementById('no-reviews-msg');
    
    if(list) list.innerHTML = '';
    
    const today = getTodayDate();
    let pending = [];
    appData.reviews.forEach(rev => { if (rev.nextReview <= today) pending.push(rev); });
    
    if(pending.length > 0) {
        if(badge) { badge.style.display = 'inline-block'; badge.textContent = pending.length; }
        if(msg) msg.style.display = 'none';
        
        pending.forEach(rev => {
            const days = REVIEW_INTERVALS[rev.step];
            const isOverdue = rev.nextReview < today;
            const overdueBadge = isOverdue ? `<span style="background: var(--danger-color); color: white; font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Atrasada</span>` : '';
            
            const html = `
                <div class="rev-info" style="flex: 1;">
                    <span class="err-subj-badge" style="font-size: 0.65rem; color: var(--text-muted);">${rev.subject || 'Geral'}</span>
                    <span class="rev-name" title="${rev.name}" style="font-weight: 600; display: block; margin: 2px 0;">${rev.name} ${overdueBadge}</span>
                    <span class="rev-step" style="font-size: 0.75rem; color: var(--text-muted);">Revisão de ${days} dia(s)</span>
                </div>
                <button class="icon-btn-small btn-complete-rev-side" data-id="${rev.id}" title="Marcar como revisada" style="color: var(--success-color); border: 2px solid var(--success-color); padding: 8px; flex-shrink: 0;">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </button>
            `;
            
            const divSmall = document.createElement('div');
            divSmall.className = 'review-item due-today';
            divSmall.innerHTML = html;
            if(list) list.appendChild(divSmall);
        });
        
        if(list) {
            list.querySelectorAll('.btn-complete-rev-side').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    const revIndex = appData.reviews.findIndex(r => r.id === id);
                    if(revIndex !== -1) {
                        const rev = appData.reviews[revIndex];
                        rev.step++;
                        
                        if(rev.step >= REVIEW_INTERVALS.length) {
                            appData.reviews.splice(revIndex, 1);
                            alert(`🎉 Parabéns! Você concluiu todo o ciclo de revisões de "${rev.name}"! O assunto está consolidado.`);
                        } else {
                            const nextInterval = REVIEW_INTERVALS[rev.step];
                            const d = new Date(); d.setDate(d.getDate() + nextInterval);
                            
                            const nextYear = d.getFullYear();
                            const nextMonth = String(d.getMonth() + 1).padStart(2, '0');
                            const nextDay = String(d.getDate()).padStart(2, '0');
                            rev.nextReview = `${nextYear}-${nextMonth}-${nextDay}`;
                            
                            // Magia em cascata: Abre o calendário para agendar a próxima etapa!
                            const gCalLink = createGoogleCalendarLink(rev);
                            window.open(gCalLink, '_blank');
                        }
                        saveData(); renderPendingReviews(); renderAllReviews();
                    }
                });
            });
        }

    } else {
        if(badge) badge.style.display = 'none';
        if(msg) msg.style.display = 'block';
    }
}

// CONCLUIR REVISÃO E AGENDAR A PRÓXIMA (Gerenciador de Agenda)
function renderAllReviews() {
    const list = elements.allReviewsList;
    if(!list) return;
    list.innerHTML = '';
    
    const filter = elements.filterReviewSubject ? elements.filterReviewSubject.value : 'all';
    let filtered = appData.reviews;
    if(filter && filter !== 'all') filtered = filtered.filter(r => r.subject === filter);

    filtered.sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview));
    
    const statTotal = document.getElementById('rev-stat-total');
    if(statTotal) statTotal.textContent = filtered.length;

    if(filtered.length === 0) {
        list.innerHTML = `<div class="empty-msg" style="grid-column: 1 / -1; padding: 3rem 2rem; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: var(--radius); font-size: 0.9rem;">Nenhuma revisão encontrada.</div>`;
        return;
    }

    const today = getTodayDate();

    filtered.forEach(rev => {
        const stepText = rev.step < REVIEW_INTERVALS.length ? `${REVIEW_INTERVALS[rev.step]} dias` : 'Concluído';
        const notesHtml = rev.notes ? `<p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.3rem; border-left: 2px solid var(--border-color); padding-left: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${rev.notes}</p>` : '';
        const isOverdue = rev.nextReview <= today;
        const dateColor = isOverdue ? 'var(--danger-color)' : 'var(--text-main)';
        
        let completeBtnHtml = '';
        if (isOverdue) {
            completeBtnHtml = `
                <button class="icon-btn-small btn-complete-rev" data-id="${rev.id}" title="Marcar etapa como Concluída" style="color: var(--success-color); border: 1px solid var(--success-color); padding: 4px; border-radius: 4px; margin-left: 8px;">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </button>
            `;
        }
        
        const card = document.createElement('div');
        card.className = 'error-card'; 
        card.style.padding = '0.8rem 1rem'; 
        card.style.gap = '0.5rem';
        card.innerHTML = `
            <div class="error-header" style="margin-bottom: 0; align-items: center;">
                <div style="flex: 1; min-width: 0;">
                    <span class="err-subj-badge" style="font-size: 0.6rem;">${rev.subject || 'Geral'}</span>
                    <h4 style="margin: 0.2rem 0 0 0; font-size: 0.9rem; color: var(--text-main); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${rev.name}">${rev.name}</h4>
                    ${notesHtml}
                </div>
                <div style="display: flex; gap: 4px; flex-shrink: 0; align-self: flex-start;">
                    <button class="icon-btn-small edit-rev-btn" data-id="${rev.id}" title="Editar Revisão" style="padding: 4px;">
                        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button class="icon-btn-small del-rev-btn" data-id="${rev.id}" title="Excluir Definitivamente" style="color: var(--danger-color); padding: 4px;">
                        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
                    </button>
                </div>
            </div>
            <div class="error-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; border-top: 1px dashed var(--border-color); padding-top: 0.6rem;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Próxima: <strong style="color: ${dateColor};">${formatDateBR(rev.nextReview)}</strong></span>
                    ${completeBtnHtml}
                </div>
                <span style="font-size: 0.65rem; background: var(--bg-color); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); font-weight: 600;">Etapa: ${stepText}</span>
            </div>
        `;
        list.appendChild(card);
    });

    list.querySelectorAll('.btn-complete-rev').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const revIndex = appData.reviews.findIndex(r => r.id === id);
            if(revIndex !== -1) {
                const rev = appData.reviews[revIndex];
                rev.step++;
                
                if(rev.step >= REVIEW_INTERVALS.length) {
                    appData.reviews.splice(revIndex, 1);
                    alert(`🎉 Parabéns! Você concluiu todo o ciclo de revisões de "${rev.name}"!`);
                } else {
                    const nextInterval = REVIEW_INTERVALS[rev.step];
                    const d = new Date(); d.setDate(d.getDate() + nextInterval);
                    
                    const nextYear = d.getFullYear();
                    const nextMonth = String(d.getMonth() + 1).padStart(2, '0');
                    const nextDay = String(d.getDate()).padStart(2, '0');
                    rev.nextReview = `${nextYear}-${nextMonth}-${nextDay}`;

                    // Magia em cascata: Abre o calendário para agendar a próxima etapa!
                    const gCalLink = createGoogleCalendarLink(rev);
                    window.open(gCalLink, '_blank');
                }
                saveData(); renderAllReviews(); renderPendingReviews();
            }
        });
    });

    list.querySelectorAll('.del-rev-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(confirm('Tem certeza que deseja apagar esta revisão da sua agenda para sempre?')) {
                appData.reviews = appData.reviews.filter(r => r.id !== e.currentTarget.getAttribute('data-id'));
                saveData(); renderAllReviews(); renderPendingReviews();
            }
        });
    });

    list.querySelectorAll('.edit-rev-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentEditingRevId = e.currentTarget.getAttribute('data-id');
            const rev = appData.reviews.find(r => r.id === currentEditingRevId);
            if(rev) {
                elements.editRevSubject.value = rev.subject;
                elements.editRevName.value = rev.name;
                elements.editRevNotes.value = rev.notes || '';
                elements.modalEditRev.classList.add('active');
            }
        });
    });
}
// ------------------------------------------------------- //

function updateUI() {
    updateTodaysSubjects();

    const today = getTodayDate();
    const todayData = appData.history[today];

    const h = String(Math.floor(todayData.time / 3600)).padStart(2, '0');
    const m = String(Math.floor((todayData.time % 3600) / 60)).padStart(2, '0');
    const s = String(todayData.time % 60).padStart(2, '0');
    elements.totalTimeDisplay.textContent = `${h}:${m}:${s}`;
    
    elements.sessionsDisplay.textContent = `${todayData.sessions} sessões hoje`;
    elements.streakDisplay.textContent = appData.streak;
    elements.recordDayDisplay.textContent = formatHoursText(appData.recordDay);
    elements.recordWeekDisplay.textContent = formatHoursText(appData.recordWeek);
    
    let totalAccumulatedSeconds = Object.values(appData.history).reduce((acc, curr) => acc + curr.time, 0);
    elements.totalAccumulated.textContent = formatHoursText(totalAccumulatedSeconds);
    
    let percentage = (todayData.time / appData.dailyGoalSeconds) * 100;
    if (percentage > 100) percentage = 100;
    elements.dailyProgressFill.style.width = `${percentage}%`;
    elements.dailyPercentage.textContent = `${Math.floor(percentage)}%`;

    if (chartInstance) updateChartData();
    renderHeatmap(); 
    renderPendingReviews();
    renderAllReviews();
}

function loadTimerState() {
    updateTodaysSubjects();
    const wasRunning = localStorage.getItem('isTimerRunning') === 'true';
    const lastTick = parseInt(localStorage.getItem('lastTick')) || Date.now();

    if (wasRunning) {
        const missedMs = Date.now() - lastTick;
        if (missedMs > 0 && missedMs < 43200000) { 
            if (appData.timerMode === 'stopwatch') {
                appData.stopwatchMs += missedMs;
                const missedSeconds = Math.floor(missedMs / 1000);
                appData.history[getTodayDate()].time += missedSeconds;
            } else {
                appData.cycleState.msRemaining -= missedMs;
                if (appData.cycleState.msRemaining < 0) appData.cycleState.msRemaining = 0;
                else {
                    const missedSeconds = Math.floor(missedMs / 1000);
                    const currentPhase = CYCLE_PHASES[appData.cycleState.phaseIndex];
                    if (currentPhase && currentPhase.isStudy) appData.history[getTodayDate()].time += missedSeconds;
                }
            }
            saveData();
        }
        startTimer(); 
    } else {
        updateTimerDisplay();
    }
    updateToggleBtn();
}

function startTimer() {
    if (isRunning) return;
    if (appData.timerMode === 'pomodoro' && todaysSubjects.length > 0 && appData.cycleState.subjectIndex >= todaysSubjects.length) return; 

    isRunning = true; updateToggleBtn();
    const today = getTodayDate();
    
    if (localStorage.getItem('isTimerRunning') !== 'true') {
        appData.history[today].sessions++;
        if (appData.lastStudyDate !== today) {
            if (appData.lastStudyDate) {
                const diff = Math.round((new Date(today) - new Date(appData.lastStudyDate)) / (1000 * 60 * 60 * 24));
                if (diff <= 1) appData.streak++; else appData.streak = 1;
            } else appData.streak = 1;
            appData.lastStudyDate = today;
            saveData(); 
        }
    }

    localStorage.setItem('isTimerRunning', 'true');
    lastTickTime = Date.now();
    let accumulatedMsToSave = 0; 

    timerInterval = setInterval(() => {
        const now = Date.now();
        const delta = now - lastTickTime;
        lastTickTime = now;
        
        accumulatedMsToSave += delta;

        if (appData.timerMode === 'stopwatch') {
            appData.stopwatchMs += delta;
        } else {
            appData.cycleState.msRemaining -= delta;
            if (todaysSubjects.length === 0) appData.cycleState.msRemaining = 0;
        }

        if (accumulatedMsToSave >= 1000) {
            const secondsPassed = Math.floor(accumulatedMsToSave / 1000);
            accumulatedMsToSave -= (secondsPassed * 1000); 
            
            const currentPhase = CYCLE_PHASES[appData.cycleState.phaseIndex];
            if (appData.timerMode === 'stopwatch' || todaysSubjects.length === 0 || (currentPhase && currentPhase.isStudy)) {
                appData.history[today].time += secondsPassed;
                if (appData.history[today].time % 5 === 0) saveData(); 
                if (appData.history[today].time % 60 === 0) calculateRecords();
                updateUI(); 
            }
        }

        if (appData.timerMode === 'pomodoro' && appData.cycleState.msRemaining <= 0 && todaysSubjects.length > 0) {
            playBeep(); 
            appData.cycleState.phaseIndex++;
            if (appData.cycleState.phaseIndex >= CYCLE_PHASES.length) {
                appData.cycleState.phaseIndex = 0; appData.cycleState.subjectIndex++;
            }
            if (appData.cycleState.subjectIndex < todaysSubjects.length) {
                appData.cycleState.msRemaining = CYCLE_PHASES[appData.cycleState.phaseIndex].ms;
            } else {
                appData.cycleState.msRemaining = 0; pauseTimer(); 
            }
            saveData();
        }

        updateTimerDisplay(); 
        localStorage.setItem('lastTick', now.toString());
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
    if (appData.timerMode === 'stopwatch') {
        appData.stopwatchMs = 0;
    } else {
        appData.cycleState = { date: getTodayDate(), subjectIndex: 0, phaseIndex: 0, msRemaining: CYCLE_PHASES[0].ms };
    }
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

elements.btnToggle.addEventListener('click', () => { if (isRunning) pauseTimer(); else startTimer(); });
elements.btnReset.addEventListener('click', resetTimer);
if (elements.btnSkipPhase) elements.btnSkipPhase.addEventListener('click', skipPhase);
if (elements.btnSkipBlock) elements.btnSkipBlock.addEventListener('click', skipBlock);

if (elements.btnTimerMode) {
    elements.btnTimerMode.addEventListener('click', () => {
        pauseTimer();
        appData.timerMode = appData.timerMode === 'pomodoro' ? 'stopwatch' : 'pomodoro';
        saveData();
        updateTimerDisplay();
    });
}

function getChartData() {
    const labels = []; const data = []; const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        labels.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase());
        
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        
        const seconds = appData.history[dateStr] ? appData.history[dateStr].time : 0;
        data.push(seconds / 3600);
    }
    return { labels, data };
}

function initChart() {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#999999';
    const barColor = getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#ffffff';
    const { labels, data } = getChartData();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Horas', data: data, backgroundColor: barColor, borderRadius: 6, barThickness: 45 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(context) { const hours = Math.floor(context.raw); const minutes = Math.round((context.raw - hours) * 60); return `${hours}h ${minutes}m`; } } } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(150, 150, 150, 0.05)', borderColor: 'transparent' }, ticks: { color: textColor, stepSize: 1, font: { size: 12 } } },
                x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', weight: 600, size: 12 } } }
            }
        }
    });
}

function updateChartData() {
    const { labels, data } = getChartData();
    chartInstance.data.labels = labels; chartInstance.data.datasets[0].data = data;
    chartInstance.data.datasets[0].backgroundColor = getComputedStyle(document.body).getPropertyValue('--text-main').trim();
    chartInstance.update();
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active')); views.forEach(v => v.classList.remove('active'));
            btn.classList.add('active'); const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active'); localStorage.setItem('activeView', targetId);
            if (targetId === 'timer') updateTimerDisplay(); 
        });
    });
    let savedView = localStorage.getItem('activeView') || 'dashboard';
    if (savedView === 'library' || savedView === 'errors') savedView = 'dashboard';
    const btnToClick = document.querySelector(`.nav-btn[data-target="${savedView}"]`);
    if (btnToClick) btnToClick.click();
}

elements.themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    if (chartInstance) updateChartData();
});
elements.macFullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(e => console.log(e)); else document.exitFullscreen();
});
elements.focusToggle.addEventListener('click', () => document.body.classList.toggle('focus-active'));

function renderSubjectBank() {
    elements.subjectBank.innerHTML = '';
    appData.savedSubjects.forEach((subject, index) => {
        const pill = document.createElement('div'); pill.className = 'subject-pill'; pill.draggable = true;
        pill.innerHTML = `<span>${subject}</span><span class="delete-subject" title="Remover matéria">&times;</span>`;
        pill.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', subject); setTimeout(() => pill.classList.add('dragging'), 0); });
        pill.addEventListener('dragend', () => pill.classList.remove('dragging'));
        pill.querySelector('.delete-subject').addEventListener('click', () => { appData.savedSubjects.splice(index, 1); saveData(); renderSubjectBank(); updateReviewSubjects(); });
        elements.subjectBank.appendChild(pill);
    });
}

elements.btnAddSubject.addEventListener('click', () => {
    const val = elements.newSubjectInput.value.trim();
    if (val && !appData.savedSubjects.includes(val)) { appData.savedSubjects.push(val); elements.newSubjectInput.value = ''; saveData(); renderSubjectBank(); updateReviewSubjects(); }
});
elements.newSubjectInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') elements.btnAddSubject.click(); });

function renderSchedule() {
    elements.scheduleTableBody.innerHTML = '';
    appData.schedule.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        const tdTime = document.createElement('td'); tdTime.className = 'time-cell';
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
                e.preventDefault(); tdDay.classList.remove('drag-over');
                const data = e.dataTransfer.getData('text/plain');
                if (data) { tdDay.textContent = data; appData.schedule[rowIndex].days[dayIndex] = data; saveData(); updateTodaysSubjects(); updateTimerDisplay(); }
            });
            tdDay.addEventListener('dblclick', () => { tdDay.textContent = ''; appData.schedule[rowIndex].days[dayIndex] = ''; saveData(); updateTodaysSubjects(); updateTimerDisplay(); });
            tr.appendChild(tdDay);
        });
        elements.scheduleTableBody.appendChild(tr);
    });
}

elements.btnAddCycle.addEventListener('click', () => { appData.schedule.push({ time: "00:00 - 00:00", days: ["", "", "", "", "", "", ""] }); saveData(); renderSchedule(); });

document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT' || document.activeElement.isContentEditable) return;
    if (!document.getElementById('timer').classList.contains('active')) return;

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