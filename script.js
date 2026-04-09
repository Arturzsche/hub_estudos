let timerInterval;
let isRunning = false;
let lastTickTime = 0; 
let chartInstance = null;

const CYCLE_PHASES = [
    { name: "Teoria (50min)", ms: 50 * 60 * 1000, isStudy: true },
    { name: "Pausa (10min)", ms: 10 * 60 * 1000, isStudy: false },
    { name: "Questões (30min)", ms: 30 * 60 * 1000, isStudy: true }
];

let defaultFlashcards = [
    { id: 'def_1', subject: "Direito Administrativo", q: "Quais são os princípios expressos da Administração Pública (LIMPE)?", a: "Legalidade, Impessoalidade, Moralidade, Publicidade e Eficiência.", reps: 0, interval: 0, efactor: 2.5 },
    { id: 'def_2', subject: "Direito Administrativo", q: "Qual a diferença entre Administração Direta e Indireta?", a: "Direta: atua pelo próprio ente (União, Estados, Municípios). Indireta: criação de novas entidades (Autarquias, Fundações, EP, SEM).", reps: 0, interval: 0, efactor: 2.5 },
    { id: 'def_3', subject: "Direito Administrativo", q: "O que é Poder de Polícia?", a: "Prerrogativa de direito público que autoriza a Administração Pública a restringir o uso e o gozo da liberdade e da propriedade em favor do interesse da coletividade.", reps: 0, interval: 0, efactor: 2.5 },
    { id: 'def_4', subject: "Direito Administrativo", q: "O que caracteriza um Ato Administrativo Discricionário?", a: "A margem de liberdade (conveniência e oportunidade) conferida por lei ao administrador para escolher a melhor ação, dentro dos limites legais.", reps: 0, interval: 0, efactor: 2.5 },
    { id: 'def_5', subject: "Português", q: "Qual a regra geral de concordância verbal?", a: "O verbo concorda com o núcleo do sujeito em número e pessoa.", reps: 0, interval: 0, efactor: 2.5 },
    { id: 'def_6', subject: "Português", q: "O que é Próclise, Mesóclise e Ênclise?", a: "Posição do pronome oblíquo: Próclise (antes do verbo), Mesóclise (no meio do verbo) e Ênclise (depois do verbo).", reps: 0, interval: 0, efactor: 2.5 }
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
    mappedPdfs: [],
    flashcards: []
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
    cyclePhaseBadge: document.getElementById('cycle-phase-badge'),
    
    libraryContainer: document.getElementById('library-container')
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
    renderPdfLibrary();
    initFlashcards();
    
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

function formatSize(bytes) {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
        if (parsedSaved.flashcards) appData.flashcards = parsedSaved.flashcards;
    }
    
    if (!appData.flashcards || appData.flashcards.length === 0) {
        appData.flashcards = JSON.parse(JSON.stringify(defaultFlashcards));
    } else {
        appData.flashcards.forEach((fc, idx) => {
            if (!fc.id) fc.id = 'fc_' + Date.now() + '_' + idx;
        });
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
            updateFlashcardSubjects();
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
        updateFlashcardSubjects();
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
    const isTyping = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable;
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
const searchInput = document.getElementById('search-pdf'); 
const sortSelect = document.getElementById('sort-pdf'); 

function renderPdfLibrary() {
    if(!elements.libraryContainer) return;
    elements.libraryContainer.innerHTML = '';
    
    if(pdfCountDisplay) pdfCountDisplay.textContent = appData.mappedPdfs.length;

    const groupedPdfs = {};
    
    appData.mappedPdfs.forEach(file => {
        const parts = file.path.split(/[\\/]/);
        const folderName = parts.length > 1 ? parts[parts.length - 2] : "Arquivos Avulsos";
        
        if(!groupedPdfs[folderName]) {
            groupedPdfs[folderName] = [];
        }
        groupedPdfs[folderName].push(file);
    });

    const sortOption = sortSelect ? sortSelect.value : 'name-asc';

    for (const folder in groupedPdfs) {
        groupedPdfs[folder].sort((a, b) => {
            if (sortOption === 'name-asc') return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            if (sortOption === 'name-desc') return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
            if (sortOption === 'date-desc') return (b.mtime || 0) - (a.mtime || 0);
            if (sortOption === 'date-asc') return (a.mtime || 0) - (b.mtime || 0);
            if (sortOption === 'size-desc') return (b.size || 0) - (a.size || 0);
            if (sortOption === 'size-asc') return (a.size || 0) - (b.size || 0);
            return 0;
        });
    }

    const sortedFolders = Object.keys(groupedPdfs).sort((a, b) => a.localeCompare(b));

    for (const folder of sortedFolders) {
        const files = groupedPdfs[folder];
        const folderGroup = document.createElement('div');
        folderGroup.className = 'folder-group';
        
        const summary = document.createElement('div');
        summary.className = 'folder-summary';
        summary.innerHTML = `
            <div class="folder-header-left">
                <svg class="folder-icon" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                ${folder}
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <span class="folder-count">${files.length}</span>
                <svg class="folder-chevron" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
            </div>
        `;
        
        summary.addEventListener('click', () => {
            folderGroup.classList.toggle('open');
        });
        
        const wrapper = document.createElement('div');
        wrapper.className = 'folder-content-wrapper';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'folder-content';

        files.forEach(file => {
            const currentStatus = file.status || 'unread';
            
            const sizeBadge = file.size ? `<span class="size-badge">${formatSize(file.size)}</span>` : '';

            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <a class="file-link" href="http://127.0.0.1:5000/abrir?caminho=${encodeURIComponent(file.path)}" target="_blank">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
                    ${file.name}
                </a>
                <div class="file-actions">
                    ${sizeBadge}
                    <span class="file-path" title="${file.path}">${file.path}</span>
                    <div class="status-selectors">
                        <div class="status-dot status-red ${currentStatus === 'unread' ? 'active' : ''}" data-status="unread" data-path="${file.path}" title="Não Lida"></div>
                        <div class="status-dot status-orange ${currentStatus === 'started' ? 'active' : ''}" data-status="started" data-path="${file.path}" title="Iniciada"></div>
                        <div class="status-dot status-green ${currentStatus === 'completed' ? 'active' : ''}" data-status="completed" data-path="${file.path}" title="Concluída"></div>
                    </div>
                </div>
            `;
            contentDiv.appendChild(fileItem);
        });

        wrapper.appendChild(contentDiv);
        folderGroup.appendChild(summary);
        folderGroup.appendChild(wrapper);
        elements.libraryContainer.appendChild(folderGroup);
    }
}

if(sortSelect) {
    sortSelect.addEventListener('change', () => {
        renderPdfLibrary();
    });
}

if(elements.libraryContainer) {
    elements.libraryContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('status-dot')) {
            e.preventDefault();
            e.stopPropagation(); 
            
            const path = e.target.getAttribute('data-path');
            const newStatus = e.target.getAttribute('data-status');
            const fileIndex = appData.mappedPdfs.findIndex(f => f.path === path);
            
            if (fileIndex !== -1) {
                appData.mappedPdfs[fileIndex].status = newStatus;
                saveData();
                
                const selectorsContainer = e.target.parentElement;
                selectorsContainer.querySelectorAll('.status-dot').forEach(dot => {
                    dot.classList.remove('active');
                });
                e.target.classList.add('active');
            }
        }
    });
}

if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const folderGroups = elements.libraryContainer.querySelectorAll('.folder-group');
        
        folderGroups.forEach(group => {
            let hasMatch = false;
            const fileItems = group.querySelectorAll('.file-item');
            
            fileItems.forEach(item => {
                const text = item.textContent.toLowerCase();
                if(text.includes(term)) {
                    item.style.display = 'flex';
                    hasMatch = true;
                } else {
                    item.style.display = 'none';
                }
            });

            if(term === '') {
                group.style.display = 'block';
                group.classList.remove('open');
            } else if (hasMatch) {
                group.style.display = 'block';
                group.classList.add('open');
            } else {
                group.style.display = 'none';
            }
        });
    });
}

if(btnStartMapping) {
    btnStartMapping.addEventListener('click', () => {
        const existingPdfs = {};
        appData.mappedPdfs.forEach(pdf => {
            existingPdfs[pdf.path] = pdf.status || 'unread';
        });

        appData.mappedPdfs = [];
        saveData();
        renderPdfLibrary();
        
        let tempCount = 0;
        if(searchInput) searchInput.value = ''; 
        if(mappingStatus) mappingStatus.textContent = "Iniciando servidor local e buscando arquivos...";
        btnStartMapping.disabled = true;

        const eventSource = new EventSource('http://127.0.0.1:5000/mapear');

        eventSource.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            if (data.status === "processing") {
                tempCount++;
                if(pdfCountDisplay) pdfCountDisplay.textContent = tempCount;
                if(mappingStatus) mappingStatus.textContent = `Varrendo: ${data.file.path}`;

                const previousStatus = existingPdfs[data.file.path] || 'unread';

                appData.mappedPdfs.unshift({
                    name: data.file.name,
                    path: data.file.path,
                    size: data.file.size || 0,
                    mtime: data.file.mtime || 0,
                    status: previousStatus
                });
            } 
            else if (data.status === "done") {
                saveData();
                renderPdfLibrary();
                if(mappingStatus) mappingStatus.textContent = "Mapeamento concluído e salvo localmente!";
                btnStartMapping.disabled = false;
                eventSource.close(); 
            }
        };

        eventSource.onerror = function() {
            if(mappingStatus) mappingStatus.textContent = "Erro de conexão. Certifique-se de que o script Python está rodando na porta 5000.";
            btnStartMapping.disabled = false;
            eventSource.close();
        };
    });
}

// --- LÓGICA DOS FLASHCARDS ---
let currentFcDeck = [];
let currentFcIndex = 0;
let isFcFlipped = false;
let currentFcMode = 'study'; // 'study' ou 'manage'

const fcElements = {
    subjectSelect: document.getElementById('fc-subject-select'),
    progressFill: document.getElementById('fc-progress-fill'),
    progressText: document.getElementById('fc-progress-text'),
    card: document.getElementById('fc-card'),
    cardContainer: document.getElementById('fc-card-container'),
    questionText: document.getElementById('fc-question-text'),
    answerText: document.getElementById('fc-answer-text'),
    controlsFront: document.getElementById('fc-controls-front'),
    controlsBack: document.getElementById('fc-controls-back'),
    btnShow: document.getElementById('btn-fc-show'),
    rateBtns: document.querySelectorAll('.fc-rate-btn'),
    emptyState: document.getElementById('fc-empty-state'),
    
    studyView: document.getElementById('fc-study-view'),
    manageView: document.getElementById('fc-manage-view'),
    btnStudyMode: document.getElementById('btn-fc-study-mode'),
    btnManageMode: document.getElementById('btn-fc-manage-mode'),
    manageTbody: document.getElementById('fc-manage-tbody'),
    manageEmpty: document.getElementById('fc-manage-empty'),
    
    btnAdd: document.getElementById('btn-add-fc'),
    modalAdd: document.getElementById('fc-add-modal'),
    newSubject: document.getElementById('fc-new-subject'),
    newQ: document.getElementById('fc-new-q'),
    newA: document.getElementById('fc-new-a'),
    btnCancelAdd: document.getElementById('btn-fc-cancel-add'),
    btnSaveAdd: document.getElementById('btn-fc-save-add'),
    
    modalEdit: document.getElementById('fc-edit-modal'),
    editSubject: document.getElementById('fc-edit-subject'),
    editQ: document.getElementById('fc-edit-q'),
    editA: document.getElementById('fc-edit-a'),
    btnCancelEdit: document.getElementById('btn-fc-cancel-edit'),
    btnSaveEdit: document.getElementById('btn-fc-save-edit')
};

let currentEditId = null;

function getNextInterval(card, quality) {
    let reps = card.reps || 0;
    let interval = card.interval || 0;
    let efactor = card.efactor || 2.5;

    if (quality === 0) return 1; 

    if (reps === 0) {
        return quality === 1 ? 1 : 4; 
    } else if (reps === 1) {
        return quality === 1 ? 6 : 10;
    } else {
        let nextI = Math.round(interval * efactor);
        if (quality === 2) nextI = Math.round(nextI * 1.3);
        return nextI;
    }
}

function updateFlashcardSubjects() {
    if(!fcElements.subjectSelect) return;
    fcElements.subjectSelect.innerHTML = '';
    fcElements.newSubject.innerHTML = '';
    fcElements.editSubject.innerHTML = '';
    
    appData.savedSubjects.forEach(sub => {
        fcElements.subjectSelect.appendChild(new Option(sub, sub));
        fcElements.newSubject.appendChild(new Option(sub, sub));
        fcElements.editSubject.appendChild(new Option(sub, sub));
    });
    
    if (appData.savedSubjects.length > 0) {
        if(currentFcMode === 'study') loadDeck(appData.savedSubjects[0]);
        else renderManageView(appData.savedSubjects[0]);
    }
}

function switchFcMode(mode) {
    currentFcMode = mode;
    const subject = fcElements.subjectSelect.value;
    if(mode === 'study') {
        fcElements.btnStudyMode.classList.add('active');
        fcElements.btnManageMode.classList.remove('active');
        fcElements.studyView.style.display = 'block';
        fcElements.manageView.style.display = 'none';
        if(subject) loadDeck(subject);
    } else {
        fcElements.btnManageMode.classList.add('active');
        fcElements.btnStudyMode.classList.remove('active');
        fcElements.studyView.style.display = 'none';
        fcElements.manageView.style.display = 'block';
        if(subject) renderManageView(subject);
    }
}

function loadDeck(subjectName) {
    const today = getTodayDate();
    
    currentFcDeck = appData.flashcards.filter(card => {
        if (card.subject !== subjectName) return false;
        if (!card.nextReview) return true; 
        return card.nextReview <= today;
    });

    currentFcDeck.sort((a, b) => {
        if(!a.nextReview && b.nextReview) return -1;
        if(a.nextReview && !b.nextReview) return 1;
        if(a.nextReview < b.nextReview) return -1;
        if(a.nextReview > b.nextReview) return 1;
        return 0;
    });

    currentFcIndex = 0;
    isFcFlipped = false;
    
    if (currentFcDeck.length > 0) {
        fcElements.emptyState.style.display = 'none';
        fcElements.cardContainer.style.display = 'block';
        fcElements.controlsFront.style.display = 'flex';
        fcElements.controlsBack.style.display = 'none';
        renderCurrentCard();
    } else {
        const futureCards = appData.flashcards.filter(card => card.subject === subjectName);
        let msg = "Não há cartões criados para esta matéria.";
        if (futureCards.length > 0) {
            msg = `Todos os ${futureCards.length} cartões desta matéria estão em dia! Volte amanhã.`;
        }
        
        fcElements.emptyState.querySelector('p').textContent = msg;
        fcElements.emptyState.style.display = 'block';
        fcElements.cardContainer.style.display = 'none';
        fcElements.controlsFront.style.display = 'none';
        fcElements.controlsBack.style.display = 'none';
        fcElements.progressText.textContent = "0 / 0 Cartões";
        fcElements.progressFill.style.width = "0%";
    }
}

function renderCurrentCard() {
    if (currentFcIndex >= currentFcDeck.length) {
        fcElements.emptyState.querySelector('p').textContent = "Você finalizou todas as revisões pendentes desta matéria por hoje!";
        fcElements.emptyState.style.display = 'block';
        fcElements.cardContainer.style.display = 'none';
        fcElements.controlsFront.style.display = 'none';
        fcElements.controlsBack.style.display = 'none';
        return;
    }

    const card = currentFcDeck[currentFcIndex];
    fcElements.questionText.textContent = card.q;
    fcElements.answerText.textContent = card.a;
    
    fcElements.card.classList.remove('flipped');
    isFcFlipped = false;
    
    fcElements.controlsFront.style.display = 'flex';
    fcElements.controlsBack.style.display = 'none';

    const progress = ((currentFcIndex) / currentFcDeck.length) * 100;
    fcElements.progressFill.style.width = `${progress}%`;
    fcElements.progressText.textContent = `${currentFcIndex + 1} / ${currentFcDeck.length} Cartões`;
}

function rateCard(quality) {
    const card = currentFcDeck[currentFcIndex];
    const cardInDb = appData.flashcards.find(c => c.id === card.id);

    if(cardInDb) {
        let interval = getNextInterval(cardInDb, quality);

        if (quality === 0) {
            cardInDb.reps = 0;
        } else {
            cardInDb.reps = (cardInDb.reps || 0) + 1;
            let qValue = quality === 1 ? 4 : 5;
            cardInDb.efactor = (cardInDb.efactor || 2.5) + (0.1 - (5 - qValue) * (0.08 + (5 - qValue) * 0.02));
            if (cardInDb.efactor < 1.3) cardInDb.efactor = 1.3;
        }
        cardInDb.interval = interval;

        const d = new Date();
        d.setDate(d.getDate() + interval);
        cardInDb.nextReview = d.toISOString().split('T')[0];

        saveData();
    }

    currentFcIndex++;
    
    if (currentFcIndex >= currentFcDeck.length) {
        fcElements.progressFill.style.width = `100%`;
        setTimeout(renderCurrentCard, 300); 
    } else {
        renderCurrentCard();
    }
}

function renderManageView(subjectName) {
    fcElements.manageTbody.innerHTML = '';
    const cards = appData.flashcards.filter(c => c.subject === subjectName);
    
    if(cards.length === 0) {
        fcElements.manageTbody.parentElement.style.display = 'none';
        fcElements.manageEmpty.style.display = 'block';
    } else {
        fcElements.manageTbody.parentElement.style.display = 'table';
        fcElements.manageEmpty.style.display = 'none';
        
        cards.forEach(card => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align: left; padding-left: 1rem; color: var(--text-main); font-weight: 500;">${card.q}</td>
                <td style="text-align: left; padding-left: 1rem; color: var(--text-muted); font-size: 0.85rem;">${card.a}</td>
                <td style="text-align: center;">
                    <div style="display: flex; justify-content: center; gap: 0.5rem;">
                        <button class="fc-action-btn edit-btn" data-id="${card.id}" title="Editar">
                            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                        <button class="fc-action-btn delete delete-btn" data-id="${card.id}" title="Excluir">
                            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
                        </button>
                    </div>
                </td>
            `;
            fcElements.manageTbody.appendChild(tr);
        });

        fcElements.manageTbody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                appData.flashcards = appData.flashcards.filter(c => c.id !== id);
                saveData();
                renderManageView(fcElements.subjectSelect.value);
            });
        });

        fcElements.manageTbody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const card = appData.flashcards.find(c => c.id === id);
                if(card) {
                    currentEditId = id;
                    fcElements.editSubject.value = card.subject;
                    fcElements.editQ.value = card.q;
                    fcElements.editA.value = card.a;
                    fcElements.modalEdit.classList.add('active');
                }
            });
        });
    }
}

function initFlashcards() {
    if(!fcElements.subjectSelect) return;
    
    updateFlashcardSubjects();

    fcElements.btnStudyMode.addEventListener('click', () => switchFcMode('study'));
    fcElements.btnManageMode.addEventListener('click', () => switchFcMode('manage'));

    fcElements.subjectSelect.addEventListener('change', (e) => {
        if(currentFcMode === 'study') loadDeck(e.target.value);
        else renderManageView(e.target.value);
    });

    const flipCard = () => {
        if (!isFcFlipped && currentFcIndex < currentFcDeck.length) {
            fcElements.card.classList.add('flipped');
            isFcFlipped = true;
            fcElements.controlsFront.style.display = 'none';
            fcElements.controlsBack.style.display = 'flex';
            
            const card = currentFcDeck[currentFcIndex];
            document.getElementById('fc-hard-time').textContent = `(${getNextInterval(card, 0)}d)`;
            document.getElementById('fc-good-time').textContent = `(${getNextInterval(card, 1)}d)`;
            document.getElementById('fc-easy-time').textContent = `(${getNextInterval(card, 2)}d)`;
        }
    };

    fcElements.btnShow.addEventListener('click', flipCard);
    fcElements.cardContainer.addEventListener('click', flipCard);

    fcElements.rateBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const quality = parseInt(e.currentTarget.getAttribute('data-rating'));
            rateCard(quality);
        });
    });

    fcElements.btnAdd.addEventListener('click', () => {
        fcElements.newSubject.value = fcElements.subjectSelect.value;
        fcElements.modalAdd.classList.add('active');
    });

    fcElements.btnCancelAdd.addEventListener('click', () => {
        fcElements.modalAdd.classList.remove('active');
        fcElements.newQ.value = '';
        fcElements.newA.value = '';
    });

    fcElements.btnSaveAdd.addEventListener('click', () => {
        const sub = fcElements.newSubject.value;
        const q = fcElements.newQ.value.trim();
        const a = fcElements.newA.value.trim();

        if (q && a) {
            appData.flashcards.push({
                id: 'fc_' + Date.now(),
                subject: sub,
                q: q,
                a: a,
                reps: 0,
                interval: 0,
                efactor: 2.5
            });
            saveData();
            fcElements.modalAdd.classList.remove('active');
            fcElements.newQ.value = '';
            fcElements.newA.value = '';
            
            if (sub === fcElements.subjectSelect.value) {
                if(currentFcMode === 'study') loadDeck(sub);
                else renderManageView(sub);
            }
        }
    });

    fcElements.btnCancelEdit.addEventListener('click', () => {
        fcElements.modalEdit.classList.remove('active');
        currentEditId = null;
    });

    fcElements.btnSaveEdit.addEventListener('click', () => {
        if(currentEditId) {
            const cardIndex = appData.flashcards.findIndex(c => c.id === currentEditId);
            if(cardIndex !== -1) {
                appData.flashcards[cardIndex].subject = fcElements.editSubject.value;
                appData.flashcards[cardIndex].q = fcElements.editQ.value.trim();
                appData.flashcards[cardIndex].a = fcElements.editA.value.trim();
                saveData();
                
                fcElements.modalEdit.classList.remove('active');
                if(currentFcMode === 'study') loadDeck(fcElements.subjectSelect.value);
                else renderManageView(fcElements.subjectSelect.value);
            }
        }
    });
}

init();