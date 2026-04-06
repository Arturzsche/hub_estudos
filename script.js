let timerInterval;
let msElapsed = 0; 
let secondsElapsed = 0;
let isRunning = false;
let lastTickTime = 0; 
let chartInstance = null;

let appData = {
    history: {}, 
    streak: 0,
    lastStudyDate: null,
    recordDay: 0,
    recordWeek: 0,
    dailyGoalSeconds: 14400, 
    // Nova Estrutura para o Cronograma e Banco de Matérias
    savedSubjects: [
        "Direito Administrativo", "Controle Externo", "AFO", "Lei Orgânica", "Regimento Interno", "Português", "Prova Discursiva"
    ],
    schedule: [
        { time: "14:00 - 15:30", days: ["", "", "", "", "", "", ""] },
        { time: "15:30 - 17:00", days: ["", "", "", "", "", "", ""] }
    ]
};

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
    
    // Elementos do Cronograma (Drag & Drop)
    scheduleTableBody: document.querySelector('#schedule-table tbody'),
    subjectBank: document.getElementById('subject-bank'),
    newSubjectInput: document.getElementById('new-subject-input'),
    btnAddSubject: document.getElementById('btn-add-subject')
};

function init() {
    loadData();
    checkStreak();
    calculateRecords();
    updateUI();
    renderSubjectBank(); // Renderiza os blocos para arrastar
    renderSchedule();    // Renderiza a tabela de drop
    setupNavigation();
    initChart();
    setupClearModal();
    
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
        appData.history = parsedSaved.history || {};
        appData.streak = parsedSaved.streak || 0;
        appData.lastStudyDate = parsedSaved.lastStudyDate || null;
        appData.recordDay = parsedSaved.recordDay || 0;
        appData.recordWeek = parsedSaved.recordWeek || 0;
        appData.dailyGoalSeconds = parsedSaved.dailyGoalSeconds || 14400; 
        
        // Migração ou carregamento da Tabela
        if (parsedSaved.schedule) appData.schedule = parsedSaved.schedule;
        
        // Migração ou carregamento do Banco de Matérias
        if (parsedSaved.savedSubjects) {
            appData.savedSubjects = parsedSaved.savedSubjects;
        } else if (parsedSaved.tasks) {
            // Se existia a lista de tasks antiga, migra para o banco
            appData.savedSubjects = parsedSaved.tasks.map(t => t.name);
        }
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
    msElapsed = parseInt(localStorage.getItem('currentSessionMs')) || 0;
    secondsElapsed = Math.floor(msElapsed / 1000);
    
    const wasRunning = localStorage.getItem('isTimerRunning') === 'true';
    const lastTick = parseInt(localStorage.getItem('lastTick')) || Date.now();

    if (wasRunning) {
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
    if (isRunning) return;
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
            } else {
                appData.streak = 1;
            }
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

    calculateRecords();
    saveData();
    updateUI();
}

function resetTimer() {
    pauseTimer();
    msElapsed = 0;
    secondsElapsed = 0;
    
    localStorage.setItem('currentSessionMs', '0');
    localStorage.setItem('isTimerRunning', 'false');
    
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

// --- LÓGICA DO BANCO DE MATÉRIAS ---
function renderSubjectBank() {
    elements.subjectBank.innerHTML = '';
    appData.savedSubjects.forEach((subject, index) => {
        const pill = document.createElement('div');
        pill.className = 'subject-pill';
        pill.draggable = true;
        pill.innerHTML = `<span>${subject}</span><span class="delete-subject" title="Remover matéria">&times;</span>`;
        
        // Inicia o arrasto (salva o nome da matéria)
        pill.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', subject);
            setTimeout(() => pill.classList.add('dragging'), 0);
        });

        // Termina o arrasto
        pill.addEventListener('dragend', () => {
            pill.classList.remove('dragging');
        });

        // Deletar a matéria do banco
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

// --- LÓGICA DO CRONOGRAMA ---
function renderSchedule() {
    elements.scheduleTableBody.innerHTML = '';
    
    appData.schedule.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        
        // 1. Célula de Horário (Editável)
        const tdTime = document.createElement('td');
        tdTime.contentEditable = true;
        tdTime.textContent = row.time;
        tdTime.addEventListener('blur', (e) => {
            appData.schedule[rowIndex].time = e.target.textContent;
            saveData();
        });
        tr.appendChild(tdTime);

        // 2. Células dos Dias (Drop Zones e Editáveis)
        row.days.forEach((dayContent, dayIndex) => {
            const tdDay = document.createElement('td');
            tdDay.className = 'drop-zone';
            tdDay.contentEditable = true;
            tdDay.textContent = dayContent;

            // Salva se digitar manualmente
            tdDay.addEventListener('blur', (e) => {
                appData.schedule[rowIndex].days[dayIndex] = e.target.textContent;
                saveData();
            });

            // Permitir Drop (Arrastar por cima)
            tdDay.addEventListener('dragover', (e) => {
                e.preventDefault(); // Necessário para liberar o Drop
                tdDay.classList.add('drag-over');
            });

            tdDay.addEventListener('dragleave', () => {
                tdDay.classList.remove('drag-over');
            });

            // Ação de Soltar (Drop)
            tdDay.addEventListener('drop', (e) => {
                e.preventDefault();
                tdDay.classList.remove('drag-over');
                const data = e.dataTransfer.getData('text/plain');
                if (data) {
                    tdDay.textContent = data; // Atualiza a tela
                    appData.schedule[rowIndex].days[dayIndex] = data; // Salva nos dados
                    saveData();
                }
            });

            // Duplo clique para limpar a célula rápido
            tdDay.addEventListener('dblclick', () => {
                tdDay.textContent = '';
                appData.schedule[rowIndex].days[dayIndex] = '';
                saveData();
            });

            tr.appendChild(tdDay);
        });

        elements.scheduleTableBody.appendChild(tr);
    });
}

// --- ATALHOS DE TECLADO ---
document.addEventListener('keydown', (e) => {
    // Ignora se estiver digitando em inputs, blocos ou na tabela
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
            localStorage.setItem('currentSessionMs', msElapsed.toString());
            localStorage.setItem('lastTick', Date.now().toString());
        }
    }
});

// Integração com Teclas Físicas de Mídia
if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
        if (!isRunning) startTimer();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
        if (isRunning) pauseTimer();
    });
}

init();