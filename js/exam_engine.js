/**
 * Exam Engine
 * Core logic for the exam functionality.
 * Expects 'allQuestions' and 'examConfig' to be defined globally.
 */

// Application State
const appState = {
    currentQuestionIndex: 0,
    selectedAnswers: [],
    timer: null,
    timeLeft: 0,
    totalTime: 0,
    quizDuration: 0,
    questionStartTime: 0,
    timePerQuestion: [],
    questions: [], // Active working set of questions
    quizStarted: false
};

document.addEventListener('DOMContentLoaded', function () {
    initExam();
    initEventListeners();
});

function initExam() {
    // Set Title from Config
    if (typeof examConfig !== 'undefined' && examConfig.title) {
        document.title = examConfig.title;
        const titleEl = document.getElementById('examTitle');
        if (titleEl) titleEl.textContent = examConfig.title;
    }
}

function initEventListeners() {
    // Start Buttons
    document.getElementById("start-btn")?.addEventListener("click", startQuiz);
    document.getElementById("quick-test-btn")?.addEventListener("click", startQuickTest);

    // Navigation
    document.getElementById("submit-btn")?.addEventListener("click", submitAnswer);
    document.getElementById("next-btn")?.addEventListener("click", nextQuestion);
    document.getElementById("restart-btn")?.addEventListener("click", restartQuiz);

    // Time Mode Selection
    const timeModeSelector = document.getElementById('time-mode-selector');
    if (timeModeSelector) {
        timeModeSelector.addEventListener('click', function (e) {
            const clickedButton = e.target.closest('.option-btn');
            if (!clickedButton) return;

            timeModeSelector.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('active'));
            clickedButton.classList.add('active');

            const durationContainer = document.getElementById('duration-input-container');
            if (clickedButton.dataset.mode === 'unlimited') {
                durationContainer.style.display = 'none';
            } else {
                durationContainer.style.display = 'block';
            }
        });
    }

    // Scroll to Top
    window.addEventListener('scroll', () => {
        const btn = document.getElementById("back-to-top");
        if (btn) btn.classList.toggle('visible', window.pageYOffset > 300);
    });

    document.getElementById("back-to-top")?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// --- Quiz Logic ---

function startQuiz() {
    // Get Settings
    const activeModeBtn = document.querySelector('#time-mode-selector .option-btn.active');
    const timeMode = activeModeBtn ? activeModeBtn.dataset.mode : 'limited';

    if (timeMode === 'limited') {
        const durationInput = parseInt(document.getElementById("custom-duration").value) || 10;
        appState.quizDuration = durationInput * 60;
    } else {
        appState.quizDuration = null;
    }

    const questionCountInput = document.getElementById("question-count").value;
    const shuffle = document.getElementById("shuffle-questions").checked;

    // Validate Questions
    if (typeof allQuestions === 'undefined' || !allQuestions.length) {
        Swal.fire({ title: 'خطأ', text: 'لا يوجد أسئلة محملة!', icon: 'error' });
        return;
    }

    // Prepare Questions
    if (questionCountInput === "all") {
        appState.questions = [...allQuestions];
        if (shuffle) shuffleArray(appState.questions);
    } else {
        appState.questions = getRandomQuestions(parseInt(questionCountInput), shuffle);
    }

    // Reset State
    appState.selectedAnswers = [];
    appState.timePerQuestion = [];
    appState.totalTime = 0;
    appState.currentQuestionIndex = 0;
    appState.quizStarted = true;

    // UI Updates
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("question-container").style.display = "block";
    document.getElementById("result-section").style.display = "none";

    loadQuestion();
    startTimer();
    window.scrollTo(0, 0);
}

function startQuickTest() {
    if (typeof allQuestions === 'undefined') return;

    appState.quizDuration = 5 * 60;
    appState.selectedAnswers = [];
    appState.timePerQuestion = [];
    appState.totalTime = 0;
    appState.currentQuestionIndex = 0;
    appState.quizStarted = true;
    appState.questions = getRandomQuestions(5, true);

    document.getElementById("start-screen").style.display = "none";
    document.getElementById("question-container").style.display = "block";
    loadQuestion();
    startTimer();
}

function loadQuestion() {
    if (!appState.questions[appState.currentQuestionIndex]) {
        finishQuiz();
        return;
    }

    const question = appState.questions[appState.currentQuestionIndex];
    appState.questionStartTime = new Date().getTime();

    // Update Progress
    const progressPercent = ((appState.currentQuestionIndex) / appState.questions.length) * 100;
    document.getElementById("progress-bar").style.width = `${progressPercent}%`;
    document.getElementById("progress-text").textContent = `السؤال ${appState.currentQuestionIndex + 1} من ${appState.questions.length}`;

    // Render Question
    const container = document.getElementById("question-display");

    let optionsHTML = question.options.map((option, index) => {
        const isSelected = isOptionSelected(index);
        return `
            <li onclick="selectOption(${index})" id="option-${index}" 
                class="${isSelected ? 'selected' : ''}">
                ${option}
            </li>
        `;
    }).join('');

    container.innerHTML = `
        ${question.image ? `<div class="question-image"><img src="${question.image}" alt="صورة توضيحية"></div>` : ''}
        <div class="question-text">${question.text}</div>
        <ul class="options">${optionsHTML}</ul>
        
        <!-- Inline Explanation Container (Hidden by default) -->
        <div id="inline-explanation" class="explanation-box" style="display:none;">
            <h4><i class="fas fa-lightbulb" style="color:#f39c12;"></i> الشرح:</h4>
            <div class="explanation-content">${question.explanation}</div>
        </div>
    `;

    // Reset Buttons and State
    document.getElementById("submit-btn").style.display = "inline-flex";
    document.getElementById("next-btn").style.display = "none";

    // Check if Explain button exists, if not inject it
    let explainBtn = document.getElementById("explain-btn");
    if (!explainBtn) {
        const btnContainer = document.getElementById("submit-btn").parentNode;
        explainBtn = document.createElement("button");
        explainBtn.id = "explain-btn";
        explainBtn.className = "btn btn-info";
        explainBtn.innerHTML = '<i class="fas fa-book-open"></i> عرض الشرح';
        explainBtn.style.display = "none";

        // Insert before Next button if possible
        const nextBtn = document.getElementById("next-btn");
        btnContainer.insertBefore(explainBtn, nextBtn);
    }
    explainBtn.style.display = "none"; // Ensure hidden on new question
    explainBtn.onclick = showInlineExplanation;
}

function showInlineExplanation() {
    const el = document.getElementById("inline-explanation");
    if (el) {
        el.style.display = "block";
        el.classList.add("fade-in");
        document.getElementById("explain-btn").style.display = "none"; // Hide button after showing
    }
}

function selectOption(index) {
    if (!appState.quizStarted) return;
    if (document.getElementById(`option-${index}`).style.pointerEvents === 'none') return;

    // Check if submitted based on submit button visibility
    // If submit button is hidden, it means we already answered
    if (document.getElementById("submit-btn").style.display === "none") return;

    const question = appState.questions[appState.currentQuestionIndex];
    const isMulti = question.type === "multi";

    if (isMulti) {
        if (!appState.selectedAnswers[appState.currentQuestionIndex]) {
            appState.selectedAnswers[appState.currentQuestionIndex] = [];
        }

        const currentSelected = appState.selectedAnswers[appState.currentQuestionIndex];
        const existingIndex = currentSelected.indexOf(index);

        if (existingIndex > -1) {
            currentSelected.splice(existingIndex, 1);
            document.getElementById(`option-${index}`).classList.remove('selected');
        } else {
            currentSelected.push(index);
            document.getElementById(`option-${index}`).classList.add('selected');
        }
    } else {
        // Single Choice
        appState.selectedAnswers[appState.currentQuestionIndex] = index;
        document.querySelectorAll('.options li').forEach(li => li.classList.remove('selected'));
        document.getElementById(`option-${index}`).classList.add('selected');
    }
}

function submitAnswer() {
    const question = appState.questions[appState.currentQuestionIndex];

    // Record Time
    const endTime = new Date().getTime();
    const timeSpent = Math.floor((endTime - appState.questionStartTime) / 1000);
    question.timeSpent = timeSpent;
    appState.timePerQuestion.push(timeSpent);
    appState.totalTime += timeSpent;

    // Check Answers
    const options = document.querySelectorAll(".options li");
    const userAnswers = appState.selectedAnswers[appState.currentQuestionIndex];

    options.forEach((option, index) => {
        option.style.pointerEvents = "none"; // Disable clicks

        const isCorrect = question.correct.includes(index);
        const isSelected = Array.isArray(userAnswers) ? userAnswers.includes(index) : userAnswers === index;

        if (isCorrect) {
            option.classList.add("correct");
            option.innerHTML += ` <i class="fas fa-check correct-mark"></i>`;
        } else if (isSelected) {
            option.classList.add("incorrect");
        }
    });

    document.getElementById("submit-btn").style.display = "none";

    // Show Explain Button
    const explainBtn = document.getElementById("explain-btn");
    if (explainBtn) explainBtn.style.display = "inline-flex";

    document.getElementById("next-btn").style.display = "inline-flex";
}

function nextQuestion() {
    appState.currentQuestionIndex++;
    if (appState.currentQuestionIndex < appState.questions.length) {
        loadQuestion();
    } else {
        finishQuiz();
    }
}

function finishQuiz() {
    clearInterval(appState.timer);
    appState.quizStarted = false;

    document.getElementById("question-container").style.display = "none";
    document.getElementById("result-section").style.display = "block";

    displayResults();
    if (document.getElementById("timer")) document.getElementById("timer").innerHTML = "";
}

function displayResults() {
    let correctCount = 0;
    const resultsContainer = document.getElementById("results-detail");
    resultsContainer.innerHTML = "";

    appState.questions.forEach((q, idx) => {
        let isCorrect = false;
        const userAnswer = appState.selectedAnswers[idx];

        if (q.type === "multi") {
            isCorrect = arraysEqual(userAnswer, q.correct);
        } else {
            isCorrect = userAnswer === q.correct[0];
        }

        if (isCorrect) correctCount++;

        // Render Review Card
        const card = document.createElement('div');
        card.className = `question-review ${isCorrect ? 'correct' : 'incorrect'}`;
        card.style.cssText = `
            background: white; 
            padding: 1.5rem; 
            margin-bottom: 1rem; 
            border-radius: 8px; 
            border-right: 5px solid ${isCorrect ? '#2ecc71' : '#e74c3c'};
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            text-align: right;
        `;

        card.innerHTML = `
            <h3>السؤال ${idx + 1}: ${q.text}</h3>
            <p><strong>الإجابة:</strong> ${isCorrect ? '<span style="color:var(--success-color)">صحيحة</span>' : '<span style="color:var(--danger-color)">خاطئة</span>'}</p>
            <div style="background:#f8f9fa; padding:1rem; margin-top:1rem; border-radius:5px;">
                <strong>الشرح:</strong><br>
                ${q.explanation}
            </div>
        `;
        resultsContainer.appendChild(card);
    });

    // Score
    const percent = Math.round((correctCount / appState.questions.length) * 100);
    document.getElementById("score-display").textContent = `%${percent} (${correctCount}/${appState.questions.length})`;

    // Chart
    renderChart(correctCount, appState.questions.length - correctCount);
}

// --- Helpers ---

function startTimer() {
    if (appState.quizDuration === null) {
        if (document.getElementById("timer")) document.getElementById("timer").innerHTML = '∞';
        return;
    }

    appState.timeLeft = appState.quizDuration;
    updateTimerDisplay();

    appState.timer = setInterval(() => {
        appState.timeLeft--;
        updateTimerDisplay();

        if (appState.timeLeft <= 0) {
            clearInterval(appState.timer);
            finishQuiz();
            Swal.fire('انتهى الوقت!');
        }
    }, 1000);
}

function updateTimerDisplay() {
    const el = document.getElementById("timer");
    if (!el) return;
    const mins = Math.floor(appState.timeLeft / 60);
    const secs = appState.timeLeft % 60;
    el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

    if (appState.timeLeft < 60) el.style.color = 'var(--danger-color)';
}

function getRandomQuestions(count, shuffle) {
    const src = [...allQuestions];
    if (shuffle) shuffleArray(src);
    return src.slice(0, count);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function isOptionSelected(index) {
    const ans = appState.selectedAnswers[appState.currentQuestionIndex];
    if (Array.isArray(ans)) return ans.includes(index);
    return ans === index;
}

function arraysEqual(a, b) {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    const sA = [...a].sort();
    const sB = [...b].sort();
    return sA.every((v, i) => v === sB[i]);
}

function restartQuiz() {
    Swal.fire({
        title: 'إعادة الاختبار؟',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'نعم',
        cancelButtonText: 'لا'
    }).then((res) => {
        if (res.isConfirmed) {
            document.getElementById("result-section").style.display = "none";
            document.getElementById("start-screen").style.display = "block";
        }
    });
}

function renderChart(correct, incorrect) {
    const ctx = document.getElementById('results-chart');
    if (!ctx) return;

    if (window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['إجابات صحيحة', 'إجابات خاطئة'],
            datasets: [{
                data: [correct, incorrect],
                backgroundColor: ['#2ecc71', '#e74c3c'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}
