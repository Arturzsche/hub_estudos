let timerInterval;
let secondsElapsed = 0;
let isRunning = false;
let chartInstance = null;

let appData = {
    history: {}, 
    streak: 0,
    lastStudyDate: null,
    recordDay: 0,
    recordWeek: 0,
    dailyGoalSeconds: 14400, // NOVO: Meta Diária de 4 horas (4 * 60 * 60)
    tasks: [
        { id: 1, name: "Direito Administrativo", completed: false },
        { id: 2, name: "Controle Externo", completed: false },
        { id: 3, name: "Administração Financeira e Orçamentária", completed: false },
        { id: 4, name: "Lei Orgânica", completed: false },
        { id: 5, name: "Regimento Interno", completed: false },
        { id: 6, name: "Português", completed: false },
        { id: 7, name: "Prova Discursiva", completed: false }
    ]
};

const elements = {
    timeDisplay: document.getElementById('time-display'),
    btnStart: document.getElementById('btn-start'),
    btnPause: document.getElementById('btn-pause'),
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
    dailyProgressFill: document.getElementById('daily-progress-fill'), // NOVO
    dailyPercentage: document.getElementById('daily-percentage'),       // NOVO
    heatmapGrid: document.getElementById('heatmap-grid')                // NOVO
};

function init() {
    loadData();
    checkStreak();
    calculateRecords();
    updateUI();
    renderTasks();
    setupNavigation();
    initChart();
    
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

function formatTime(totalSeconds) {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function formatHoursText(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
}

function loadData() {
    const saved = localStorage.getItem('studyAppData');
    if (saved) {
        const parsedSaved = JSON.parse(saved);
        if (parsedSaved.tasks) {
            appData.tasks = parsedSaved.tasks;
        }
        appData.history = parsedSaved.history || {};
        appData.streak = parsedSaved.streak || 0;
        appData.lastStudyDate = parsedSaved.lastStudyDate || null;
        appData.recordDay = parsedSaved.recordDay || 0;
        appData.recordWeek = parsedSaved.recordWeek || 0;
        appData.dailyGoalSeconds = parsedSaved.dailyGoalSeconds || 14400; 
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
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
        appData.streak = 0; 
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

// NOVO: Função para renderizar o Heatmap de 30 dias
function renderHeatmap() {
    elements.heatmapGrid.innerHTML = '';
    const today = new Date();
    
    // Mostra os últimos 30 dias
    for(let i = 29; i >= 0; i--) {
        let d = new Date(today);
        d.setDate(today.getDate() - i);
        let dateStr = d.toISOString().split('T')[0];
        let time = appData.history[dateStr] ? appData.history[dateStr].time : 0;
        
        let cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        
        // Define o nível de cor baseado no tempo estudado (Gamificação)
        if (time === 0) {
            cell.classList.add('level-0');
        } else if (time < 3600) { // Menos de 1h
            cell.classList.add('level-1');
        } else if (time < 10800) { // Menos de 3h
            cell.classList.add('level-2');
        } else { // 3h ou mais
            cell.classList.add('level-3');
        }

        // Formata data brasileira para o tooltip
        const dateBR = d.toLocaleDateString('pt-BR');
        cell.setAttribute('title', `${dateBR}: ${formatHoursText(time)}`);
        
        elements.heatmapGrid.appendChild(cell);
    }
}

function updateUI() {
    const today = getTodayDate();
    const todayData = appData.history[today];

    elements.totalTimeDisplay.textContent = formatTime(todayData.time);
    elements.sessionsDisplay.textContent = `${todayData.sessions} sessões hoje`;
    
    elements.streakDisplay.textContent = appData.streak;
    elements.recordDayDisplay.textContent = formatHoursText(appData.recordDay);
    elements.recordWeekDisplay.textContent = formatHoursText(appData.recordWeek);
    
    let totalAccumulatedSeconds = Object.values(appData.history).reduce((acc, curr) => acc + curr.time, 0);
    elements.totalAccumulated.textContent = formatHoursText(totalAccumulatedSeconds);
    
    // NOVO: Atualiza Barra de Progresso Diário
    let percentage = (todayData.time / appData.dailyGoalSeconds) * 100;
    if (percentage > 100) percentage = 100;
    elements.dailyProgressFill.style.width = `${percentage}%`;
    elements.dailyPercentage.textContent = `${Math.floor(percentage)}%`;

    if (chartInstance) updateChartData();
    renderHeatmap(); // NOVO: Atualiza heatmap
}

function loadTimerState() {
    secondsElapsed = parseInt(localStorage.getItem('currentSessionSeconds')) || 0;
    const wasRunning = localStorage.getItem('isTimerRunning') === 'true';
    const lastTick = parseInt(localStorage.getItem('lastTick')) || Date.now();

    if (wasRunning) {
        const missedSeconds = Math.floor((Date.now() - lastTick) / 1000);
        
        if (missedSeconds > 0 && missedSeconds < 43200) { 
            secondsElapsed += missedSeconds;
            const today = getTodayDate();
            appData.history[today].time += missedSeconds;
            saveData();
        }
        startTimer(); 
    } else {
        elements.timeDisplay.textContent = formatTime(secondsElapsed);
        if (secondsElapsed > 0) {
            elements.btnStart.textContent = "Retomar";
        }
    }
}

function startTimer() {
    if (isRunning) return;
    isRunning = true;
    
    const today = getTodayDate();
    
    if (secondsElapsed === 0 && localStorage.getItem('isTimerRunning') !== 'true') {
        appData.history[today].sessions++;
        
        if (appData.lastStudyDate !== today) {
            if (appData.lastStudyDate) {
                const lastDate = new Date(appData.lastStudyDate);
                const currDate = new Date(today);
                const diff = (currDate - lastDate) / (1000 * 60 * 60 * 24);
                if (diff <= 1) appData.streak++;
                else appData.streak = 1;
            } else {
                appData.streak = 1;
            }
            appData.lastStudyDate = today;
        }
    }

    localStorage.setItem('isTimerRunning', 'true');

    timerInterval = setInterval(() => {
        secondsElapsed++;
        appData.history[today].time++;
        elements.timeDisplay.textContent = formatTime(secondsElapsed);
        
        localStorage.setItem('currentSessionSeconds', secondsElapsed);
        localStorage.setItem('lastTick', Date.now().toString());
        saveData(); 

        if (secondsElapsed % 60 === 0) calculateRecords();
        updateUI();
    }, 1000);
    
    elements.btnStart.textContent = "Retomar";
}

function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);
    
    localStorage.setItem('isTimerRunning', 'false');
    localStorage.setItem('currentSessionSeconds', secondsElapsed);
    localStorage.setItem('lastTick', Date.now().toString());

    calculateRecords();
    saveData();
    updateUI();
}

function resetTimer() {
    pauseTimer();
    secondsElapsed = 0;
    
    localStorage.setItem('currentSessionSeconds', '0');
    localStorage.setItem('isTimerRunning', 'false');
    
    elements.timeDisplay.textContent = formatTime(secondsElapsed);
    elements.btnStart.textContent = "Iniciar Sessão";
}

elements.btnStart.addEventListener('click', startTimer);
elements.btnPause.addEventListener('click', pauseTimer);
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
        data: {
            labels: labels,
            datasets: [{
                label: 'Horas',
                data: data,
                backgroundColor: barColor,
                borderRadius: 4,
                barThickness: 45 // BARRAS MAIS LARGAS
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const hours = Math.floor(context.raw);
                            const minutes = Math.round((context.raw - hours) * 60);
                            return `${hours}h ${minutes}m`;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: 'rgba(150, 150, 150, 0.1)', borderColor: 'transparent' },
                    ticks: { color: textColor, stepSize: 1, font: { size: 13 } } // FONTES MAIORES
                },
                x: { 
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Inter', weight: 600, size: 13 } } // FONTES MAIORES
                }
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
    if (btnToClick) {
        btnToClick.click();
    }
}

elements.themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (chartInstance) updateChartData();
});

elements.focusToggle.addEventListener('click', () => {
    document.body.classList.add('focus-active');
});

function renderTasks() {
    elements.taskList.innerHTML = '';
    appData.tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        li.innerHTML = `
            <input type="checkbox" id="task-${task.id}" ${task.completed ? 'checked' : ''}>
            <label for="task-${task.id}">${task.name}</label>
        `;
        
        li.querySelector('input').addEventListener('change', (e) => {
            task.completed = e.target.checked;
            li.classList.toggle('completed', task.completed);
            saveData();
        });
        
        elements.taskList.appendChild(li);
    });
}

// --- ATALHOS DE TECLADO ---
document.addEventListener('keydown', (e) => {
    const isTimerActive = document.getElementById('timer').classList.contains('active');
    if (!isTimerActive) return;

    if (e.code === 'Space') {
        e.preventDefault(); 
        if (isRunning) pauseTimer();
        else startTimer();
    }
    if (e.code === 'Delete') {
        resetTimer();
    }
    if (e.code === 'Enter' || e.code === 'Escape') {
        if (document.body.classList.contains('focus-active')) {
            document.body.classList.remove('focus-active');
        }
    }
});

init();