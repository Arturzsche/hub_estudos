let timerInterval;
let isRunning = false;
let lastTickTime = 0; 
let chartInstance = null;

const CYCLE_PHASES = [
    { name: "Teoria (50min)", ms: 50 * 60 * 1000, isStudy: true },
    { name: "Pausa (10min)", ms: 10 * 60 * 1000, isStudy: false },
    { name: "Questões (30min)", ms: 30 * 60 * 1000, isStudy: true }
];

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
    mappedPdfs: []
};

let todaysSubjects = [];

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
    
    scheduleTableBody: document.querySelector('#schedule-table tbody'),
    subjectBank: document.getElementById('subject-bank'),
    newSubjectInput: document.getElementById('new-subject-input'),
    btnAddSubject: document.getElementById('btn-add-subject'),
    
    btnAddCycle: document.getElementById('btn-add-cycle'),
    
    cycleSubject: document.getElementById('cycle-subject'),
    cyclePhaseBadge: document.getElementById('cycle-phase-badge')
};

function init() {
    loadData();
    checkStreak();
    calculateRecords();
    
    renderSubjectBank(); 
    renderSchedule();    
    setupNavigation();
    initChart();
    setupClearModal();
    renderPdfTable();
    
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.remove('dark-mode');
    }

    loadTimerState();
    updateUI();
}

function getTodayDate() {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    today.setMinutes(today.getMinutes() - offset);
    return today.toISOString().split('T')[0];
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
        if (subject && subject.trim() !== '') {
            todaysSubjects.push(subject.trim());
        }
    });

    const today = getTodayDate();
    if (appData.cycleState.date !== today) {
        appData.cycleState = {
            date: today,
            subjectIndex: 0,
            phaseIndex: 0,
            msRemaining: CYCLE_PHASES[0].ms
        };
        saveData();
    }
}

function updateTimerDisplay() {
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
        elements.cycleSubject.textContent = "Modo Livre";
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
        if (parsedSaved.schedule) appData.schedule = parsedSaved.schedule;
        if (parsedSaved.savedSubjects) appData.savedSubjects = parsedSaved.savedSubjects;
        
        appData.history = parsedSaved.history || {};
        appData.streak = parsedSaved.streak || 0;
        appData.lastStudyDate = parsedSaved.lastStudyDate || null;
        appData.recordDay = parsedSaved.recordDay || 0;
        appData.recordWeek = parsedSaved.recordWeek || 0;
        appData.dailyGoalSeconds = parsedSaved.dailyGoalSeconds || 14400; 
        
        if (parsedSaved.cycleState) appData.cycleState = parsedSaved.cycleState;
        if (parsedSaved.mappedPdfs) appData.mappedPdfs = parsedSaved.mappedPdfs;
    }
    
    const today = getTodayDate();
    if (!appData.history[today]) {
        appData.history[today] = { time: 0, sessions: 0 };
    }
}

function saveData() {
    localStorage.setItem('studyAppData', JSON.stringify(appData));
}

function checkStreak() {
    const today = getTodayDate();
    const lastDateStr = appData.lastStudyDate;
    if (!lastDateStr) return;

    const todayDate = new Date(today);
    const lastDate = new Date(lastDateStr);
    const diffTime = Math.abs(todayDate - lastDate);
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
        appData.streak = 0; 
        saveData(); 
    }
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
            if (appData.history[checkDateStr]) {
                currentWeekTime += appData.history[checkDateStr].time;
            }
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
        
        let cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        
        if (time === 0) cell.classList.add('level-0');
        else if (time < 3600) cell.classList.add('level-1');
        else if (time < 10800) cell.classList.add('level-2');
        else cell.classList.add('level-3');

        const dateBR = d.toLocaleDateString('pt-BR');
        cell.setAttribute('title', `${dateBR}: ${formatHoursText(time)}`);
        
        elements.heatmapGrid.appendChild(cell);
    }
}

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
}

function loadTimerState() {
    updateTodaysSubjects();
    
    const wasRunning = localStorage.getItem('isTimerRunning') === 'true';
    const lastTick = parseInt(localStorage.getItem('lastTick')) || Date.now();

    if (wasRunning) {
        const missedMs = Date.now() - lastTick;
        if (missedMs > 0 && missedMs < 43200000) { 
            appData.cycleState.msRemaining -= missedMs;
            
            if (appData.cycleState.msRemaining < 0) {
                appData.cycleState.msRemaining = 0;
            } else {
                const missedSeconds = Math.floor(missedMs / 1000);
                const currentPhase = CYCLE_PHASES[appData.cycleState.phaseIndex];
                if (currentPhase && currentPhase.isStudy) {
                    const today = getTodayDate();
                    appData.history[today].time += missedSeconds;
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
    
    if (todaysSubjects.length > 0 && appData.cycleState.subjectIndex >= todaysSubjects.length) {
        return; 
    }

    isRunning = true;
    updateToggleBtn();
    
    const today = getTodayDate();
    
    if (localStorage.getItem('isTimerRunning') !== 'true') {
        appData.history[today].sessions++;
        
        if (appData.lastStudyDate !== today) {
            if (appData.lastStudyDate) {
                const lastDate = new Date(appData.lastStudyDate);
                const currDate = new Date(today);
                const diff = Math.round((currDate - lastDate) / (1000 * 60 * 60 * 24));
                if (diff <= 1) appData.streak++;
                else appData.streak = 1;
            } else {
                appData.streak = 1;
            }
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
        
        appData.cycleState.msRemaining -= delta;
        accumulatedMsToSave += delta;

        if (todaysSubjects.length === 0) {
            appData.cycleState.msRemaining = 0; 
        }

        if (accumulatedMsToSave >= 1000) {
            const secondsPassed = Math.floor(accumulatedMsToSave / 1000);
            accumulatedMsToSave -= (secondsPassed * 1000); 
            
            const currentPhase = CYCLE_PHASES[appData.cycleState.phaseIndex];
            if (todaysSubjects.length === 0 || (currentPhase && currentPhase.isStudy)) {
                appData.history[today].time += secondsPassed;
                if (appData.history[today].time % 5 === 0) saveData(); 
                if (appData.history[today].time % 60 === 0) calculateRecords();
                updateUI(); 
            }
        }

        if (appData.cycleState.msRemaining <= 0 && todaysSubjects.length > 0) {
            playBeep(); 
            
            appData.cycleState.phaseIndex++;
            
            if (appData.cycleState.phaseIndex >= CYCLE_PHASES.length) {
                appData.cycleState.phaseIndex = 0;
                appData.cycleState.subjectIndex++;
            }
            
            if (appData.cycleState.subjectIndex < todaysSubjects.length) {
                appData.cycleState.msRemaining = CYCLE_PHASES[appData.cycleState.phaseIndex].ms;
            } else {
                appData.cycleState.msRemaining = 0;
                pauseTimer(); 
            }
            saveData();
        }

        updateTimerDisplay(); 
        localStorage.setItem('lastTick', now.toString());
        
    }, 16); 
}

function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);
    updateToggleBtn();
    
    localStorage.setItem('isTimerRunning', 'false');
    localStorage.setItem('lastTick', Date.now().toString());

    calculateRecords();
    saveData();
    updateUI();
}

function resetTimer() {
    pauseTimer();
    
    const today = getTodayDate();
    appData.cycleState = {
        date: today,
        subjectIndex: 0,
        phaseIndex: 0,
        msRemaining: CYCLE_PHASES[0].ms
    };
    
    localStorage.setItem('isTimerRunning', 'false');
    saveData();
    updateTimerDisplay();
}

elements.btnToggle.addEventListener('click', () => {
    if (isRunning) pauseTimer();
    else startTimer();
});
elements.btnReset.addEventListener('click', resetTimer);

function getChartData() {
    const labels = [];
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' });
        labels.push(dayName.toUpperCase());
        const seconds = appData.history[dateStr] ? appData.history[dateStr].time : 0;
        data.push(seconds / 3600);
    }
    return { labels, data };
}

function initChart() {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    const { labels, data } = getChartData();
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || '#999999';
    const barColor = getComputedStyle(document.body).getPropertyValue('--accent-color').trim() || '#ffffff';

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Horas', data: data, backgroundColor: barColor, borderRadius: 4, barThickness: 45 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(context) { const hours = Math.floor(context.raw); const minutes = Math.round((context.raw - hours) * 60); return `${hours}h ${minutes}m`; } } } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(150, 150, 150, 0.1)', borderColor: 'transparent' }, ticks: { color: textColor, stepSize: 1, font: { size: 13 } } },
                x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', weight: 600, size: 13 } } }
            }
        }
    });
}

function updateChartData() {
    const { labels, data } = getChartData();
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    const barColor = getComputedStyle(document.body).getPropertyValue('--accent-color').trim();
    chartInstance.data.datasets[0].backgroundColor = barColor;
    chartInstance.update();
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            localStorage.setItem('activeView', targetId);
            
            if (targetId === 'timer') updateTimerDisplay(); 
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
            appData.history[today] = { time: 0, sessions: 0 };
            saveData(); calculateRecords(); updateUI(); resetTimer(); 
        }
        elements.modalClear.classList.remove('active');
    });

    elements.btnClearAll.addEventListener('click', () => {
        appData.history = {}; appData.streak = 0; appData.lastStudyDate = null; appData.recordDay = 0; appData.recordWeek = 0;
        const today = getTodayDate();
        appData.history[today] = { time: 0, sessions: 0 };
        saveData(); calculateRecords(); updateUI(); resetTimer(); 
        elements.modalClear.classList.remove('active');
    });
}

elements.themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (chartInstance) updateChartData();
});

elements.macFullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Erro ao tentar modo tela cheia: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
});

elements.focusToggle.addEventListener('click', () => {
    document.body.classList.toggle('focus-active');
});

function renderSubjectBank() {
    elements.subjectBank.innerHTML = '';
    appData.savedSubjects.forEach((subject, index) => {
        const pill = document.createElement('div');
        pill.className = 'subject-pill';
        pill.draggable = true;
        pill.innerHTML = `<span>${subject}</span><span class="delete-subject" title="Remover matéria">&times;</span>`;
        
        pill.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', subject);
            setTimeout(() => pill.classList.add('dragging'), 0);
        });

        pill.addEventListener('dragend', () => {
            pill.classList.remove('dragging');
        });

        pill.querySelector('.delete-subject').addEventListener('click', () => {
            appData.savedSubjects.splice(index, 1);
            saveData();
            renderSubjectBank();
        });

        elements.subjectBank.appendChild(pill);
    });
}

elements.btnAddSubject.addEventListener('click', () => {
    const val = elements.newSubjectInput.value.trim();
    if (val && !appData.savedSubjects.includes(val)) {
        appData.savedSubjects.push(val);
        elements.newSubjectInput.value = '';
        saveData();
        renderSubjectBank();
    }
});

elements.newSubjectInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') elements.btnAddSubject.click();
});

function renderSchedule() {
    elements.scheduleTableBody.innerHTML = '';
    
    appData.schedule.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        
        const tdTime = document.createElement('td');
        tdTime.className = 'time-cell';
        
        const btnDeleteRow = document.createElement('button');
        btnDeleteRow.className = 'btn-remove-row';
        btnDeleteRow.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>';
        btnDeleteRow.title = "Remover este ciclo";
        
        btnDeleteRow.addEventListener('click', (e) => {
            e.stopPropagation();
            appData.schedule.splice(rowIndex, 1);
            saveData();
            renderSchedule();
            updateTodaysSubjects();
            updateTimerDisplay();
        });
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'time-text';
        timeSpan.contentEditable = true;
        timeSpan.textContent = row.time;
        timeSpan.addEventListener('blur', (e) => {
            appData.schedule[rowIndex].time = e.target.textContent;
            saveData();
        });
        
        tdTime.appendChild(btnDeleteRow);
        tdTime.appendChild(timeSpan);
        tr.appendChild(tdTime);

        row.days.forEach((dayContent, dayIndex) => {
            const tdDay = document.createElement('td');
            tdDay.className = 'drop-zone';
            tdDay.textContent = dayContent;

            tdDay.addEventListener('dragover', (e) => {
                e.preventDefault(); 
                tdDay.classList.add('drag-over');
            });

            tdDay.addEventListener('dragleave', () => {
                tdDay.classList.remove('drag-over');
            });

            tdDay.addEventListener('drop', (e) => {
                e.preventDefault();
                tdDay.classList.remove('drag-over');
                const data = e.dataTransfer.getData('text/plain');
                if (data) {
                    tdDay.textContent = data; 
                    appData.schedule[rowIndex].days[dayIndex] = data; 
                    saveData();
                    updateTodaysSubjects(); 
                    updateTimerDisplay();
                }
            });

            tdDay.addEventListener('dblclick', () => {
                tdDay.textContent = '';
                appData.schedule[rowIndex].days[dayIndex] = '';
                saveData();
                updateTodaysSubjects();
                updateTimerDisplay();
            });

            tr.appendChild(tdDay);
        });

        elements.scheduleTableBody.appendChild(tr);
    });
}

elements.btnAddCycle.addEventListener('click', () => {
    appData.schedule.push({ time: "00:00 - 00:00", days: ["", "", "", "", "", "", ""] });
    saveData();
    renderSchedule();
});

document.addEventListener('keydown', (e) => {
    const isTyping = document.activeElement.tagName === 'INPUT' || document.activeElement.isContentEditable;
    if (isTyping) return;

    if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault(); 
        if (isRunning) pauseTimer();
        else startTimer();
        return; 
    }

    const isTimerActive = document.getElementById('timer').classList.contains('active');
    if (!isTimerActive) return;

    if (e.code === 'Space' && !e.ctrlKey) {
        e.preventDefault(); 
        if (isRunning) pauseTimer();
        else startTimer();
    }
    
    if (e.code === 'Delete') {
        resetTimer();
    }
    
    if (e.code === 'Enter') {
        e.preventDefault(); 
        document.body.classList.toggle('focus-active'); 
    }
    
    if (e.code === 'Escape') {
        document.body.classList.remove('focus-active'); 
    }
});

window.addEventListener('beforeunload', () => {
    if (isRunning) pauseTimer();
    saveData();
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        saveData();
        if (isRunning) {
            localStorage.setItem('lastTick', Date.now().toString());
        }
    }
});

if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
        if (!isRunning) startTimer();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
        if (isRunning) pauseTimer();
    });
}

const btnStartMapping = document.getElementById('btn-start-mapping');
const pdfCountDisplay = document.getElementById('pdf-count');
const mappingStatus = document.getElementById('mapping-status');
const pdfTableBody = document.getElementById('pdf-table-body');
const searchInput = document.getElementById('search-pdf'); 

function renderPdfTable() {
    pdfTableBody.innerHTML = '';
    const countSpan = document.getElementById('pdf-count');
    if(countSpan) countSpan.textContent = appData.mappedPdfs.length;

    appData.mappedPdfs.forEach(file => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: left; padding-left: 1rem;">
                <a href="http://127.0.0.1:5000/abrir?caminho=${encodeURIComponent(file.path)}" target="_blank" style="color: var(--text-main); font-weight: 500; text-decoration: none; display: flex; align-items: center; gap: 8px;">
                    <svg viewBox="0 0 24 24" width="18" height="18" style="color: #e53935;"><path fill="currentColor" d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
                    ${file.name}
                </a>
            </td>
            <td style="font-size: 0.8rem; color: var(--text-muted); text-align: left; padding-left: 1rem;">${file.path}</td>
        `;
        pdfTableBody.appendChild(tr); 
    });
}

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = pdfTableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
});

btnStartMapping.addEventListener('click', () => {
    appData.mappedPdfs = [];
    saveData();
    renderPdfTable();
    
    let tempCount = 0;
    searchInput.value = ''; 
    mappingStatus.textContent = "Iniciando servidor local e buscando arquivos...";
    btnStartMapping.disabled = true;

    const eventSource = new EventSource('http://127.0.0.1:5000/mapear');

    eventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        if (data.status === "processing") {
            tempCount++;
            pdfCountDisplay.textContent = tempCount;
            mappingStatus.textContent = `Varrendo: ${data.file.path}`;

            appData.mappedPdfs.unshift({
                name: data.file.name,
                path: data.file.path
            });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align: left; padding-left: 1rem;">
                    <a href="http://127.0.0.1:5000/abrir?caminho=${encodeURIComponent(data.file.path)}" target="_blank" style="color: var(--text-main); font-weight: 500; text-decoration: none; display: flex; align-items: center; gap: 8px;">
                        <svg viewBox="0 0 24 24" width="18" height="18" style="color: #e53935;"><path fill="currentColor" d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
                        ${data.file.name}
                    </a>
                </td>
                <td style="font-size: 0.8rem; color: var(--text-muted); text-align: left; padding-left: 1rem;">${data.file.path}</td>
            `;
            pdfTableBody.prepend(tr); 
        } 
        else if (data.status === "done") {
            saveData();
            mappingStatus.textContent = "Mapeamento concluído e salvo localmente!";
            btnStartMapping.disabled = false;
            eventSource.close(); 
        }
    };

    eventSource.onerror = function() {
        mappingStatus.textContent = "Erro de conexão. Certifique-se de que o script Python está rodando na porta 5000.";
        btnStartMapping.disabled = false;
        eventSource.close();
    };
});

init();