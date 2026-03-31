let timerInterval;
let msElapsed = 0; 
let secondsElapsed = 0;
let isRunning = false;
let lastTickTime = 0; 
let chartInstance = null;

let examInterval;
let examSecondsRemaining = 3600;
let isExamRunning = false;
let selectedExamDuration = 3600;

let appData = {
    history: {}, 
    streak: 0,
    lastStudyDate: null,
    recordDay: 0,
    recordWeek: 0,
    dailyGoalSeconds: 14400, 
    tasks: [
        { id: 1, name: "Direito Administrativo", completed: false },
        { id: 2, name: "Controle Externo", completed: false },
        { id: 3, name: "Administração Financeira e Orçamentária", completed: false },
        { id: 4, name: "Lei Orgânica", completed: false },
        { id: 5, name: "Regimento Interno", completed: false },
        { id: 6, name: "Português", completed: false },
        { id: 7, name: "Prova Discursiva", completed: false }
    ],
    quickNotes: "",
    reviews: [] 
};

const stateEmojis = { 'tired': '😴', 'normal': '😐', 'focused': '🔥' };

const elements = {
    timeMain: document.getElementById('time-main'),
    timeMs: document.getElementById('time-ms'),
    btnToggle: document.getElementById('btn-toggle'),
    iconPlay: document.getElementById('icon-play'),
    iconPause: document.getElementById('icon-pause'),
    btnReset: document.getElementById('btn-reset'),
    totalTimeDisplay: document.getElementById('total-time-display'),
    sessionsDisplay: document.getElementById('sessions-display'),
    streakDisplay: document.getElementById('streak-display'),
    recordDayDisplay: document.getElementById('record-day-display'),
    recordWeekDisplay: document.getElementById('record-week-display'),
    totalAccumulated: document.getElementById('total-accumulated'),
    taskList: document.getElementById('task-list'),
    themeToggle: document.getElementById('theme-toggle'),
    focusToggle: document.getElementById('focus-toggle'), 
    dailyProgressFill: document.getElementById('daily-progress-fill'),
    dailyPercentage: document.getElementById('daily-percentage'),
    heatmapGrid: document.getElementById('heatmap-grid'),
    macFullscreenBtn: document.getElementById('mac-fullscreen-btn'),
    btnOpenClear: document.getElementById('btn-open-clear'),
    modalClear: document.getElementById('clear-modal'),
    btnClearToday: document.getElementById('btn-clear-today'),
    btnClearAll: document.getElementById('btn-clear-all'),
    btnCancelClear: document.getElementById('btn-cancel-clear'),
    quickNotes: document.getElementById('quick-notes'),
    reviewInput: document.getElementById('review-input'),
    btnAddReview: document.getElementById('btn-add-review'),
    reviewListToday: document.getElementById('review-list-today'),
    reviewListUpcoming: document.getElementById('review-list-upcoming'),
    stateBtns: document.querySelectorAll('.state-btn'),
    todayStateIcon: document.getElementById('today-state-icon'),
    examPresets: document.querySelectorAll('.exam-preset'),
    btnStartExam: document.getElementById('btn-start-exam'),
    btnGiveUpExam: document.getElementById('btn-give-up-exam'),
    examSetup: document.getElementById('exam-setup'),
    examRunning: document.getElementById('exam-running'),
    examTimeDisplay: document.getElementById('exam-time-display'),
    examWarningText: document.getElementById('exam-warning-text')
};

function init() {
    loadData();
    checkStreak();
    calculateRecords();
    updateUI();
    renderTasks();
    setupNavigation();
    initChart();
    setupClearModal();
    setupReviewSystem(); 
    setupMentalState();
    setupExamMode();
    
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.remove('dark-mode');
    }
    loadTimerState();
}

function getTodayDate() {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    today.setMinutes(today.getMinutes() - offset);
    return today.toISOString().split('T')[0];
}

function formatHoursText(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
}

function formatTime(totalSeconds) {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function updateTimerDisplay() {
    const totalSeconds = Math.floor(msElapsed / 1000);
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    const ms = String(Math.floor((msElapsed % 1000) / 10)).padStart(2, '0');
    elements.timeMain.textContent = `${h}:${m}:${s}`;
    elements.timeMs.textContent = `.${ms}`;
}

function updateToggleBtn() {
    if (isRunning) {
        elements.iconPlay.style.display = 'none';
        elements.iconPause.style.display = 'block';
    } else {
        elements.iconPlay.style.display = 'block';
        elements.iconPause.style.display = 'none';
    }
}

function loadData() {
    const saved = localStorage.getItem('studyAppData');
    if (saved) {
        const parsedSaved = JSON.parse(saved);
        if (parsedSaved.tasks) appData.tasks = parsedSaved.tasks;
        appData.history = parsedSaved.history || {};
        appData.streak = parsedSaved.streak || 0;
        appData.lastStudyDate = parsedSaved.lastStudyDate || null;
        appData.recordDay = parsedSaved.recordDay || 0;
        appData.recordWeek = parsedSaved.recordWeek || 0;
        appData.dailyGoalSeconds = parsedSaved.dailyGoalSeconds || 14400; 
        appData.quickNotes = parsedSaved.quickNotes || "";
        appData.reviews = parsedSaved.reviews || [];
    }
    
    const today = getTodayDate();
    if (!appData.history[today]) {
        appData.history[today] = { time: 0, sessions: 0, state: 'normal' };
    } else if (!appData.history[today].state) {
        appData.history[today].state = 'normal';
    }
}

function saveData() { localStorage.setItem('studyAppData', JSON.stringify(appData)); }

function checkStreak() {
    const today = getTodayDate();
    const lastDateStr = appData.lastStudyDate;
    if (!lastDateStr) return;
    const todayDate = new Date(today);
    const lastDate = new Date(lastDateStr);
    const diffDays = Math.round(Math.abs(todayDate - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) { appData.streak = 0; saveData(); }
}

function calculateRecords() {
    let maxDay = 0;
    let totalAcumulado = 0;
    for (const date in appData.history) {
        const time = appData.history[date].time;
        totalAcumulado += time;
        if (time > maxDay) maxDay = time;
    }
    appData.recordDay = maxDay;

    let maxWeek = 0;
    const dates = Object.keys(appData.history).sort();
    for (let i = 0; i < dates.length; i++) {
        let currentWeekTime = 0;
        let start = new Date(dates[i]);
        for (let j = 0; j < 7; j++) {
            let checkDate = new Date(start);
            checkDate.setDate(checkDate.getDate() + j);
            let checkDateStr = checkDate.toISOString().split('T')[0];
            if (appData.history[checkDateStr]) currentWeekTime += appData.history[checkDateStr].time;
        }
        if (currentWeekTime > maxWeek) maxWeek = currentWeekTime;
    }
    appData.recordWeek = maxWeek;
}

function renderHeatmap() {
    elements.heatmapGrid.innerHTML = '';
    const today = new Date();
    for(let i = 29; i >= 0; i--) {
        let d = new Date(today);
        d.setDate(today.getDate() - i);
        let dateStr = d.toISOString().split('T')[0];
        let time = appData.history[dateStr] ? appData.history[dateStr].time : 0;
        let state = appData.history[dateStr] ? appData.history[dateStr].state : null;
        
        let cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        if (time === 0) cell.classList.add('level-0');
        else if (time < 3600) cell.classList.add('level-1');
        else if (time < 10800) cell.classList.add('level-2');
        else cell.classList.add('level-3');

        const dateBR = d.toLocaleDateString('pt-BR');
        let tooltipText = `${dateBR}: ${formatHoursText(time)}`;
        if (state && time > 0) tooltipText += ` (${stateEmojis[state]})`;
        cell.setAttribute('title', tooltipText);
        elements.heatmapGrid.appendChild(cell);
    }
}

function updateUI() {
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

    if (todayData.state && stateEmojis[todayData.state]) {
        elements.todayStateIcon.textContent = stateEmojis[todayData.state];
    }
    if (chartInstance) updateChartData();
    renderHeatmap(); 
}

function loadTimerState() {
    msElapsed = parseInt(localStorage.getItem('currentSessionMs')) || 0;
    secondsElapsed = Math.floor(msElapsed / 1000);
    const wasRunning = localStorage.getItem('isTimerRunning') === 'true';
    const lastTick = parseInt(localStorage.getItem('lastTick')) || Date.now();

    if (wasRunning && !isExamRunning) {
        const missedMs = Date.now() - lastTick;
        const missedSeconds = Math.floor(missedMs / 1000);
        if (missedSeconds > 0 && missedSeconds < 43200) { 
            msElapsed += missedMs;
            secondsElapsed = Math.floor(msElapsed / 1000);
            const today = getTodayDate();
            appData.history[today].time += missedSeconds;
            saveData();
        }
        startTimer(); 
    } else {
        updateTimerDisplay();
    }
    updateToggleBtn();
}

function startTimer() {
    if (isRunning || isExamRunning) return;
    isRunning = true;
    updateToggleBtn();
    
    const today = getTodayDate();
    if (msElapsed === 0 && localStorage.getItem('isTimerRunning') !== 'true') {
        appData.history[today].sessions++;
        if (appData.lastStudyDate !== today) {
            if (appData.lastStudyDate) {
                const lastDate = new Date(appData.lastStudyDate);
                const currDate = new Date(today);
                const diff = Math.round((currDate - lastDate) / (1000 * 60 * 60 * 24));
                if (diff <= 1) appData.streak++;
                else appData.streak = 1;
            } else { appData.streak = 1; }
            appData.lastStudyDate = today;
            saveData(); 
        }
    }

    localStorage.setItem('isTimerRunning', 'true');
    lastTickTime = Date.now();

    timerInterval = setInterval(() => {
        const now = Date.now();
        const delta = now - lastTickTime;
        lastTickTime = now;
        msElapsed += delta;
        updateTimerDisplay();

        const newSecondsElapsed = Math.floor(msElapsed / 1000);
        if (newSecondsElapsed > secondsElapsed) {
            const diff = newSecondsElapsed - secondsElapsed;
            secondsElapsed = newSecondsElapsed;
            appData.history[today].time += diff;
            localStorage.setItem('currentSessionMs', msElapsed.toString());
            localStorage.setItem('lastTick', now.toString());
            if (secondsElapsed % 5 === 0) saveData(); 
            if (secondsElapsed % 60 === 0) calculateRecords();
            updateUI();
        }
    }, 16);
}

function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);
    updateToggleBtn();
    localStorage.setItem('isTimerRunning', 'false');
    localStorage.setItem('currentSessionMs', msElapsed.toString());
    localStorage.setItem('lastTick', Date.now().toString());
    calculateRecords(); saveData(); updateUI();
}

function resetTimer() {
    pauseTimer();
    msElapsed = 0; secondsElapsed = 0;
    localStorage.setItem('currentSessionMs', '0');
    localStorage.setItem('isTimerRunning', 'false');
    updateTimerDisplay();
}

elements.btnToggle.addEventListener('click', () => { if (isRunning) pauseTimer(); else startTimer(); });
elements.btnReset.addEventListener('click', resetTimer);
elements.focusToggle.addEventListener('click', () => { document.body.classList.toggle('focus-active'); });

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isExamRunning) { alert("Termine ou abandone o Simulado antes de sair desta tela!"); return; }
            navButtons.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            localStorage.setItem('activeView', targetId);
        });
    });
    const savedView = localStorage.getItem('activeView') || 'dashboard';
    const btnToClick = document.querySelector(`.nav-btn[data-target="${savedView}"]`);
    if (btnToClick) btnToClick.click();
}

function setupClearModal() {
    elements.btnOpenClear.addEventListener('click', () => elements.modalClear.classList.add('active'));
    elements.btnCancelClear.addEventListener('click', () => elements.modalClear.classList.remove('active'));
    elements.btnClearToday.addEventListener('click', () => {
        const today = getTodayDate();
        if (appData.history[today]) {
            appData.history[today] = { time: 0, sessions: 0, state: 'normal' };
            saveData(); calculateRecords(); updateUI(); resetTimer(); 
        }
        elements.modalClear.classList.remove('active');
    });
    elements.btnClearAll.addEventListener('click', () => {
        appData.history = {}; appData.streak = 0; appData.lastStudyDate = null; appData.recordDay = 0; appData.recordWeek = 0;
        appData.history[getTodayDate()] = { time: 0, sessions: 0, state: 'normal' };
        saveData(); calculateRecords(); updateUI(); resetTimer(); 
        elements.modalClear.classList.remove('active');
    });
}

function setupMentalState() {
    const today = getTodayDate();
    const currentState = appData.history[today].state || 'normal';
    elements.stateBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-state') === currentState) btn.classList.add('active');
    });
    elements.stateBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newState = e.currentTarget.getAttribute('data-state');
            elements.stateBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            appData.history[getTodayDate()].state = newState;
            saveData(); updateUI();
        });
    });
}

function setupExamMode() {
    elements.examPresets.forEach(btn => {
        btn.addEventListener('click', (e) => {
            elements.examPresets.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            selectedExamDuration = parseInt(e.target.getAttribute('data-time'));
        });
    });

    elements.btnStartExam.addEventListener('click', () => {
        if (isRunning) pauseTimer(); 
        isExamRunning = true;
        examSecondsRemaining = selectedExamDuration;
        elements.examSetup.style.display = 'none';
        elements.examRunning.style.display = 'flex';
        document.body.classList.add('exam-active');
        updateExamDisplay();

        examInterval = setInterval(() => {
            examSecondsRemaining--;
            const today = getTodayDate();
            appData.history[today].time++;
            if (examSecondsRemaining % 10 === 0) saveData(); 
            updateExamDisplay();

            if (examSecondsRemaining === 600) {
                elements.examTimeDisplay.classList.add('exam-time-warning');
                document.getElementById('exam-warning-text').textContent = "Atenção: Faltam 10 minutos";
                document.getElementById('exam-warning-text').style.color = "var(--danger-color)";
            }
            if (examSecondsRemaining <= 0) endExam(true);
        }, 1000);
    });

    elements.btnGiveUpExam.addEventListener('click', () => {
        if (confirm("Tem certeza que deseja abandonar a simulação? O tempo decorrido foi salvo.")) endExam(false);
    });
}

function updateExamDisplay() { elements.examTimeDisplay.textContent = formatTime(examSecondsRemaining); }
function endExam(completed) {
    clearInterval(examInterval);
    isExamRunning = false;
    document.body.classList.remove('exam-active');
    elements.examSetup.style.display = 'block';
    elements.examRunning.style.display = 'none';
    elements.examTimeDisplay.classList.remove('exam-time-warning');
    document.getElementById('exam-warning-text').textContent = "Foco Total Ativo";
    document.getElementById('exam-warning-text').style.color = "var(--text-muted)";
    calculateRecords(); saveData(); updateUI();
    if (completed) setTimeout(() => alert("Tempo esgotado! Simulação Concluída."), 500);
}

function setupReviewSystem() {
    elements.quickNotes.value = appData.quickNotes;
    elements.quickNotes.addEventListener('input', (e) => { appData.quickNotes = e.target.value; saveData(); });
    elements.btnAddReview.addEventListener('click', () => {
        const text = elements.reviewInput.value.trim();
        if (text) {
            const dateObj = new Date();
            dateObj.setDate(dateObj.getDate() + 1);
            const nextDate = dateObj.toISOString().split('T')[0];
            appData.reviews.push({ id: Date.now(), text: text, nextDate: nextDate, level: 1 });
            elements.reviewInput.value = ''; saveData(); renderReviews();
        }
    });
    elements.reviewInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') elements.btnAddReview.click(); });
    renderReviews();
}

function renderReviews() {
    elements.reviewListToday.innerHTML = ''; elements.reviewListUpcoming.innerHTML = '';
    const today = getTodayDate();
    let hasToday = false, hasUpcoming = false;
    appData.reviews = appData.reviews.filter(r => r.level <= 3);
    const sortedReviews = [...appData.reviews].sort((a, b) => a.nextDate.localeCompare(b.nextDate));

    sortedReviews.forEach(review => {
        const isTodayOrPast = review.nextDate <= today;
        const li = document.createElement('li'); li.className = 'task-item';
        let levelText = review.level === 1 ? "1 Dia" : review.level === 2 ? "7 Dias" : "30 Dias";
        
        li.innerHTML = `
            <div style="display:flex; align-items:center; width:100%;">
                <span class="badge">${levelText}</span><span style="flex:1;">${review.text}</span>
            </div>
            <button class="icon-btn-small" style="color: ${isTodayOrPast ? 'var(--text-main)' : 'var(--danger-color)'}">
                <svg viewBox="0 0 24 24" width="18" height="18">
                    ${isTodayOrPast ? '<path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>' : '<path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>'}
                </svg>
            </button>
        `;
        li.querySelector('button').addEventListener('click', () => {
            if (isTodayOrPast) {
                const dateObj = new Date();
                if (review.level === 1) { review.level = 2; dateObj.setDate(dateObj.getDate() + 7); }
                else if (review.level === 2) { review.level = 3; dateObj.setDate(dateObj.getDate() + 30); }
                else { review.level = 4; }
                review.nextDate = dateObj.toISOString().split('T')[0];
            } else {
                appData.reviews = appData.reviews.filter(r => r.id !== review.id);
            }
            saveData(); renderReviews();
        });

        if (isTodayOrPast) { elements.reviewListToday.appendChild(li); hasToday = true; } 
        else {
            const [y, m, d] = review.nextDate.split('-');
            li.querySelector('.badge').textContent = `${d}/${m}`;
            elements.reviewListUpcoming.appendChild(li); hasUpcoming = true;
        }
    });

    if (!hasToday) elements.reviewListToday.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; padding: 1rem 0;">Nenhuma revisão pendente.</p>';
    if (!hasUpcoming) elements.reviewListUpcoming.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; padding: 1rem 0;">Sem revisões programadas.</p>';
}

function getChartData() {
    const labels = [], data = [], today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase());
        data.push(appData.history[dateStr] ? appData.history[dateStr].time / 3600 : 0);
    }
    return { labels, data };
}

function initChart() {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: getChartData().labels, datasets: [{ data: getChartData().data, backgroundColor: getComputedStyle(document.body).getPropertyValue('--accent-color').trim(), borderRadius: 4, barThickness: 45 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(150, 150, 150, 0.1)', borderColor: 'transparent' } }, x: { grid: { display: false } } } }
    });
}
function updateChartData() { chartInstance.data.datasets[0].data = getChartData().data; chartInstance.data.datasets[0].backgroundColor = getComputedStyle(document.body).getPropertyValue('--accent-color').trim(); chartInstance.update(); }

elements.themeToggle.addEventListener('click', () => { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); if (chartInstance) updateChartData(); });
elements.macFullscreenBtn.addEventListener('click', () => { !document.fullscreenElement ? document.documentElement.requestFullscreen() : document.exitFullscreen(); });

document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;
    if (document.getElementById('timer').classList.contains('active')) {
        if (e.code === 'Space' && !isExamRunning) { e.preventDefault(); isRunning ? pauseTimer() : startTimer(); }
        if (e.code === 'Delete' && !isExamRunning) resetTimer();
        if (e.code === 'Enter') { e.preventDefault(); if (!isExamRunning) document.body.classList.toggle('focus-active'); }
        if (e.code === 'Escape') { if (!isExamRunning) document.body.classList.remove('focus-active'); }
    }
});

window.addEventListener('beforeunload', (e) => { if (isRunning) pauseTimer(); if (isExamRunning) { e.preventDefault(); e.returnValue = ''; } saveData(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { saveData(); if (isRunning) { localStorage.setItem('currentSessionMs', msElapsed.toString()); localStorage.setItem('lastTick', Date.now().toString()); } } });

init();