const API_URL = ""; // same-origin: Flask가 정적+API 함께 서빙

let puzzleNumber = null;
let nextChangeAt = null;
let guesses = [];
let hintsUsed = {};
let sortBySimilarity = true;
let solved = false;
let latestWord = null;

const HINT_THRESHOLDS = { 1: 50, 2: 100, 3: 200, 4: 400, 5: 500 };

const guessInput = document.getElementById("guess-input");
const guessBtn = document.getElementById("guess-btn");
const guessesDiv = document.getElementById("guesses");
const puzzleNumberSpan = document.getElementById("puzzle-number");
const timerSpan = document.getElementById("timer");
const errorMsg = document.getElementById("error-msg");
const successMsg = document.getElementById("success-msg");
const sortToggle = document.getElementById("sort-toggle");
const hintBtn = document.getElementById("hint-btn");
const hintsArea = document.getElementById("hints-area");
const hintResults = document.getElementById("hint-results");
const shareBtn = document.getElementById("share-btn");
const registerArea = document.getElementById("register-area");
const nameInput = document.getElementById("name-input");
const registerBtn = document.getElementById("register-btn");
const leaderboardContent = document.getElementById("leaderboard-content");

// --- Init ---
async function init() {
    loadTheme();
    await loadPuzzle();
    loadState();
    renderGuesses();
    updateHintButtons();
    startTimer();
    bindEvents();
    loadLeaderboard();
    loadLunch();
    loadFeedback();
}

async function loadPuzzle() {
    try {
        const resp = await fetch(`${API_URL}/api/puzzle`);
        const data = await resp.json();
        puzzleNumber = data.puzzle_number;
        nextChangeAt = new Date(data.next_change_at);
        puzzleNumberSpan.textContent = `퍼즐 #${puzzleNumber}`;
        // 10등/1000등 기준 유사도 표시
        const rankInfo = document.getElementById("rank-info");
        const parts = [];
        if (data.rank10_similarity != null) {
            parts.push(`10등 단어의 유사도는 <span class="sim-value">${data.rank10_similarity.toFixed(2)}</span> 입니다`);
        }
        if (data.rank1000_similarity != null) {
            parts.push(`1000등 단어의 유사도는 <span class="sim-value">${data.rank1000_similarity.toFixed(2)}</span> 입니다`);
        }
        rankInfo.innerHTML = parts.map(p => `<span>${p}</span>`).join("");
    } catch (e) {
        showError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    }
}

function loadState() {
    if (puzzleNumber === null) return;
    const saved = localStorage.getItem(`onmantle_guesses_${puzzleNumber}`);
    if (saved) {
        guesses = JSON.parse(saved);
        solved = guesses.some(g => g.is_correct);
    }
    const savedHints = localStorage.getItem(`onmantle_hints_${puzzleNumber}`);
    if (savedHints) {
        hintsUsed = JSON.parse(savedHints);
        renderHintResults();
    }
    if (solved) showSuccess();
}

function saveState() {
    if (puzzleNumber === null) return;
    localStorage.setItem(`onmantle_guesses_${puzzleNumber}`, JSON.stringify(guesses));
    localStorage.setItem(`onmantle_hints_${puzzleNumber}`, JSON.stringify(hintsUsed));
}

// --- Guess ---
async function submitGuess() {
    const word = guessInput.value.trim();
    if (!word || solved) return;
    if (guesses.some(g => g.word === word)) {
        showError(`"${word}"는 이미 추측한 단어입니다.`);
        guessInput.value = "";
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
    }
    hideError();
    guessInput.value = "";
    guessBtn.disabled = true;
    try {
        const resp = await fetch(`${API_URL}/api/guess`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ word }),
        });
        const data = await resp.json();
        if (!resp.ok) {
            showError(`"${word}"는 없는 단어입니다.`);
            return;
        }
        latestWord = data.word;
        guesses.push({
            num: guesses.length + 1,
            word: data.word,
            similarity: data.similarity,
            rank: data.rank || null,
            is_correct: data.is_correct,
        });
        if (data.is_correct) {
            solved = true;
            showSuccess();
        }
        saveState();
        renderGuesses();
        updateHintButtons();
    } catch (e) {
        showError("서버 연결 오류");
    } finally {
        guessBtn.disabled = false;
        guessInput.focus();
    }
}

// --- Render ---
function renderGuesses() {
    const sorted = [...guesses];
    if (sortBySimilarity) sorted.sort((a, b) => b.similarity - a.similarity);
    guessesDiv.innerHTML = sorted.map(g => {
        const simPercent = Math.max(0, (g.similarity + 100) / 200 * 100);
        const barClass = g.similarity >= 0 ? "positive" : "negative";
        const correctClass = g.is_correct ? " correct" : "";
        const latestClass = g.word === latestWord ? " latest" : "";
        const simClass = g.rank ? "ranked" : g.similarity < 0 ? "negative" : "";
        let rankText = "";
        let rankColorClass = "";
        if (g.rank) {
            rankText = `${g.rank}위`;
            if (g.rank === 1) rankColorClass = "rank-gold";
            else if (g.rank <= 10) rankColorClass = "rank-deep";
            else if (g.rank <= 100) rankColorClass = "rank-mid";
            else rankColorClass = "rank-light";
        } else {
            rankText = "1000+";
            rankColorClass = "rank-out";
        }
        return `<div class="guess-row${correctClass}${latestClass}">
            <span class="col-num">${g.num}</span>
            <span class="col-word">${g.word}</span>
            <span class="col-sim ${simClass}">${g.similarity.toFixed(2)}</span>
            <span class="col-rank ${rankColorClass}">${rankText}</span>
            <span class="col-bar"><div class="sim-bar ${barClass}" style="width: ${simPercent}%"></div></span>
        </div>`;
    }).join("");
    // 추측 횟수 표시
    document.getElementById("guess-count").textContent = guesses.length > 0 ? `${guesses.length}번째 추측` : "";
    // 현재 추측 블럭
    const latestBlock = document.getElementById("latest-guess");
    const latest = guesses.length > 0 ? guesses[guesses.length - 1] : null;
    if (latest) {
        let rankText, rankColorClass;
        if (latest.rank) {
            rankText = `${latest.rank}위`;
            if (latest.rank === 1) rankColorClass = "rank-gold";
            else if (latest.rank <= 10) rankColorClass = "rank-deep";
            else if (latest.rank <= 100) rankColorClass = "rank-mid";
            else rankColorClass = "rank-light";
        } else {
            rankText = "1000+";
            rankColorClass = "rank-out";
        }
        const simClass = latest.rank ? "ranked" : latest.similarity < 0 ? "negative" : "";
        latestBlock.innerHTML = `<div class="guess-row latest">
            <span class="col-num">${latest.num}</span>
            <span class="col-word">${latest.word}</span>
            <span class="col-sim ${simClass}">${latest.similarity.toFixed(2)}</span>
            <span class="col-rank ${rankColorClass}">${rankText}</span>
            <span class="col-bar"><div class="sim-bar ${latest.similarity >= 0 ? "positive" : "negative"}" style="width: ${Math.max(0, (latest.similarity + 100) / 200 * 100)}%"></div></span>
        </div>`;
        latestBlock.classList.remove("hidden");
    } else {
        latestBlock.classList.add("hidden");
    }
    // 10개 이상이면 스크롤 버튼 표시
    const showScroll = guesses.length >= 10;
    document.getElementById("scroll-down-wrap").classList.toggle("hidden", !showScroll);
    document.getElementById("scroll-up-wrap").classList.toggle("hidden", !showScroll);
}

// --- Hints ---
async function requestHint(level) {
    if (hintsUsed[level]) return;
    const threshold = HINT_THRESHOLDS[level] || 0;
    if (guesses.length < threshold) {
        showError(`힌트 ${level}은 ${threshold}회 추측 후 해금됩니다 (현재 ${guesses.length}회)`);
        return;
    }
    try {
        const resp = await fetch(`${API_URL}/api/hint?level=${level}`);
        const data = await resp.json();
        if (!resp.ok) { showError(data.error || "힌트 오류"); return; }
        hintsUsed[level] = data;
        saveState();
        renderHintResults();
        const btn = document.querySelector(`.hint-level[data-level="${level}"]`);
        if (btn) btn.classList.add("used");
    } catch (e) { showError("힌트 요청 실패"); }
}

function renderHintResults() {
    const levels = Object.keys(hintsUsed).sort();
    hintResults.innerHTML = levels.map(l => {
        const h = hintsUsed[l];
        return `<div class="hint-result-item">${h.hint_type}: <strong>${h.hint_value}</strong></div>`;
    }).join("");
    levels.forEach(l => {
        const btn = document.querySelector(`.hint-level[data-level="${l}"]`);
        if (btn) btn.classList.add("used");
    });
}

function updateHintButtons() {
    document.querySelectorAll(".hint-level").forEach(btn => {
        const level = parseInt(btn.dataset.level);
        const threshold = HINT_THRESHOLDS[level] || 0;
        if (hintsUsed[level]) {
            btn.classList.add("used");
            btn.classList.remove("locked", "unlocked");
            btn.disabled = false;
        } else if (guesses.length >= threshold) {
            btn.classList.add("unlocked");
            btn.classList.remove("locked");
            btn.disabled = false;
        } else {
            btn.disabled = true;
            btn.classList.add("locked");
            btn.classList.remove("unlocked");
            btn.title = `${threshold - guesses.length}회 더 추측하면 해금`;
        }
    });
}

// --- Leaderboard ---
async function loadLeaderboard() {
    if (puzzleNumber === null) return;
    try {
        const resp = await fetch(`${API_URL}/api/scores/${puzzleNumber}`);
        const data = await resp.json();
        renderLeaderboard(data.scores);
    } catch (e) {
        // 무시
    }
}

function renderLeaderboard(scores) {
    if (!scores || scores.length === 0) {
        leaderboardContent.innerHTML = '<p class="leaderboard-empty">단어를 맞추어 순위를 남겨보세요!</p>';
        return;
    }
    leaderboardContent.innerHTML = scores.map((s, i) => {
        const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
        const solvedDate = new Date(s.solved_at);
        const timeStr = `${solvedDate.getHours().toString().padStart(2,"0")}시 ${solvedDate.getMinutes().toString().padStart(2,"0")}분 ${solvedDate.getSeconds().toString().padStart(2,"0")}초`;
        const hintText = s.hints_used > 0 ? ` (힌트${s.hints_used})` : "";
        return `<div class="lb-row">
            <span class="lb-rank ${rankClass}">${i + 1}</span>
            <span class="lb-name">${escapeHtml(s.name)}</span>
            <span class="lb-detail">${s.guess_count}회${hintText}<span class="lb-time">${timeStr}</span></span>
        </div>`;
    }).join("");
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// --- Register Score ---
async function registerScore() {
    const name = nameInput.value.trim();
    if (!name) { showError("이름을 입력해주세요"); return; }
    if (name.length > 20) { showError("이름은 20자 이하로 입력해주세요"); return; }

    try {
        const resp = await fetch(`${API_URL}/api/scores`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name,
                puzzle_number: puzzleNumber,
                guess_count: guesses.length,
                hints_used: Object.keys(hintsUsed).length,
                solved_at: new Date().toISOString(),
            }),
        });
        if (resp.ok) {
            registerArea.classList.add("hidden");
            loadLeaderboard();
        } else {
            const data = await resp.json();
            showError(data.error || "등록 실패");
        }
    } catch (e) {
        showError("서버 연결 오류");
    }
}

// --- Share ---
function shareResult() {
    const hintCount = Object.keys(hintsUsed).length;
    let text = `온맨틀 #${puzzleNumber} — ${guesses.length}번 만에 맞춤!`;
    if (hintCount > 0) text += ` (힌트 ${hintCount}회 사용)`;
    text += "\nhttps://onmantle.cityzen.kr";
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showError("결과가 클립보드에 복사되었습니다!");
            setTimeout(hideError, 2000);
        });
    }
}

// --- Timer ---
function startTimer() {
    setInterval(updateTimer, 1000);
    updateTimer();
}

function updateTimer() {
    if (!nextChangeAt) return;
    const diff = nextChangeAt - new Date();
    if (diff <= 0) {
        timerSpan.textContent = "새 퍼즐 로딩...";
        setTimeout(() => location.reload(), 2000);
        return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    timerSpan.textContent = `다음 교체: ${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
}

// --- UI Helpers ---
function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.remove("hidden"); }
function hideError() { errorMsg.classList.add("hidden"); }

function showSuccess() {
    const hintCount = Object.keys(hintsUsed).length;
    let msg = `정답! ${guesses.length}번 만에 맞추셨습니다!`;
    if (hintCount > 0) msg += ` (힌트 ${hintCount}회)`;
    successMsg.textContent = msg;
    successMsg.classList.remove("hidden");
    shareBtn.classList.remove("hidden");
    guessInput.disabled = true;
    guessBtn.disabled = true;
    // 이름 등록 표시 (이미 등록했으면 숨김)
    const registered = localStorage.getItem(`onmantle_registered_${puzzleNumber}`);
    if (!registered) {
        registerArea.classList.remove("hidden");
    }
}

// --- Reset ---
function resetGame() {
    if (puzzleNumber === null) return;
    localStorage.removeItem(`onmantle_guesses_${puzzleNumber}`);
    localStorage.removeItem(`onmantle_hints_${puzzleNumber}`);
    localStorage.removeItem(`onmantle_registered_${puzzleNumber}`);
    guesses = [];
    hintsUsed = {};
    solved = false;
    guessInput.disabled = false;
    guessBtn.disabled = false;
    successMsg.classList.add("hidden");
    shareBtn.classList.add("hidden");
    registerArea.classList.add("hidden");
    hideError();
    renderGuesses();
    updateHintButtons();
    hintResults.innerHTML = "";
    guessInput.focus();
}

// --- Events ---
function bindEvents() {
    guessBtn.addEventListener("click", submitGuess);
    guessInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submitGuess(); });
    sortToggle.addEventListener("click", () => {
        sortBySimilarity = !sortBySimilarity;
        sortToggle.textContent = sortBySimilarity ? "유사도순" : "시간순";
        renderGuesses();
    });
    hintBtn.addEventListener("click", () => hintsArea.classList.toggle("hidden"));
    document.querySelectorAll(".hint-level").forEach(btn => {
        btn.addEventListener("click", () => requestHint(parseInt(btn.dataset.level)));
    });
    shareBtn.addEventListener("click", shareResult);
    document.getElementById("reset-btn").addEventListener("click", resetGame);
    registerBtn.addEventListener("click", registerScore);
    nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") registerScore(); });
    document.getElementById("scroll-top-btn").addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
    document.getElementById("scroll-bottom-btn").addEventListener("click", () => {
        document.getElementById("scroll-up-wrap").scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("lunch-submit-btn").addEventListener("click", submitLunch);
    document.getElementById("lunch-menu").addEventListener("keydown", (e) => { if (e.key === "Enter") submitLunch(); });
    document.getElementById("feedback-submit-btn").addEventListener("click", submitFeedback);
    document.getElementById("dark-toggle").addEventListener("click", toggleDark);
}

// --- 다크 모드 ---
function toggleDark() {
    const body = document.body;
    const btn = document.getElementById("dark-toggle");
    if (body.dataset.theme === "dark") {
        body.removeAttribute("data-theme");
        btn.textContent = "🌙";
        localStorage.setItem("onmantle_theme", "light");
    } else {
        body.dataset.theme = "dark";
        btn.textContent = "☀️";
        localStorage.setItem("onmantle_theme", "dark");
    }
}

function loadTheme() {
    const saved = localStorage.getItem("onmantle_theme");
    if (saved === "dark") {
        document.body.dataset.theme = "dark";
        document.getElementById("dark-toggle").textContent = "☀️";
    }
}

// --- 점메추 ---
const lunchContent = document.getElementById("lunch-content");
const todayStr = new Date().toISOString().slice(0, 10);
const likedKey = `onmantle_liked_lunches_${todayStr}`;
// 이전 날짜의 좋아요 기록 정리
Object.keys(localStorage).forEach(k => {
    if (k.startsWith("onmantle_liked_lunches_") && k !== likedKey) localStorage.removeItem(k);
});
const likedSet = new Set(JSON.parse(localStorage.getItem(likedKey) || "[]"));

async function loadLunch() {
    try {
        const resp = await fetch(`${API_URL}/api/lunch`);
        const data = await resp.json();
        renderLunch(data.picks);
    } catch (e) { /* 무시 */ }
}

function renderLunch(picks) {
    if (!picks || picks.length === 0) {
        lunchContent.innerHTML = '<p class="leaderboard-empty">오늘의 점심을 추천해주세요!</p>';
        return;
    }
    lunchContent.innerHTML = picks.map((p, i) => {
        const liked = likedSet.has(p.id) ? " liked" : "";
        return `<div class="lunch-row">
            <span class="lunch-rank">${i + 1}</span>
            <div class="lunch-info">
                <div class="lunch-menu">${escapeHtml(p.menu)}</div>
                <div class="lunch-nick">${escapeHtml(p.nickname)}</div>
            </div>
            <button class="like-btn${liked}" data-id="${p.id}" onclick="likeLunch(${p.id}, this)">
                ♥ ${p.likes}
            </button>
        </div>`;
    }).join("");
}

async function submitLunch() {
    const nick = document.getElementById("lunch-nick").value.trim();
    const menu = document.getElementById("lunch-menu").value.trim();
    if (!nick || !menu) { showError("닉네임과 메뉴를 입력해주세요"); return; }
    try {
        const resp = await fetch(`${API_URL}/api/lunch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nickname: nick, menu }),
        });
        if (resp.ok) {
            document.getElementById("lunch-menu").value = "";
            loadLunch();
        } else {
            const data = await resp.json();
            showError(data.error || "등록 실패");
        }
    } catch (e) { showError("서버 연결 오류"); }
}

async function likeLunch(id, btn) {
    if (likedSet.has(id)) return;
    try {
        const resp = await fetch(`${API_URL}/api/lunch/${id}/like`, { method: "POST" });
        if (resp.ok) {
            const data = await resp.json();
            likedSet.add(id);
            localStorage.setItem(likedKey, JSON.stringify([...likedSet]));
            btn.classList.add("liked");
            btn.innerHTML = `♥ ${data.likes}`;
            loadLunch();
        }
    } catch (e) { /* 무시 */ }
}

// --- 피드백 (로컬스토리지) ---
const feedbackList = document.getElementById("feedback-list");

function loadFeedback() {
    const items = JSON.parse(localStorage.getItem("onmantle_feedback") || "[]");
    renderFeedback(items);
}

function renderFeedback(items) {
    if (!items.length) {
        feedbackList.innerHTML = "";
        return;
    }
    feedbackList.innerHTML = items.slice().reverse().map(f => {
        const d = new Date(f.time);
        const timeStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
        return `<div class="feedback-item">
            <span class="fb-nick">${escapeHtml(f.nick)}</span>
            <span class="fb-text">${escapeHtml(f.text)}</span>
            <span class="fb-time">${timeStr}</span>
        </div>`;
    }).join("");
}

function submitFeedback() {
    const nick = document.getElementById("fb-nick").value.trim() || "익명";
    const text = document.getElementById("fb-text").value.trim();
    if (!text) { showError("피드백 내용을 입력해주세요"); return; }
    const items = JSON.parse(localStorage.getItem("onmantle_feedback") || "[]");
    items.push({ nick, text, time: new Date().toISOString() });
    localStorage.setItem("onmantle_feedback", JSON.stringify(items));
    document.getElementById("fb-text").value = "";
    renderFeedback(items);
}

// --- Start ---
init();
