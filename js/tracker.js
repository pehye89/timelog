    function updateVisualDate(d) {
        const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
        document.getElementById('visualDateText').innerText = `${yyyy}.${mm}.${dd} ${DAYS_EN[d.getDay()]}`;
        document.getElementById('hiddenDateInput').value = `${yyyy}-${mm}-${dd}`;
        document.getElementById('todayBtnTracker').classList.toggle('is-today', `${yyyy}-${mm}-${dd}` === getTodayIso());
    }
    function changeDate(offset) {
        const inputVal = document.getElementById('hiddenDateInput').value; if(!inputVal) return;
        let d = new Date(inputVal); do { d.setDate(d.getDate() + offset); } while (d.getDay() === 0 || d.getDay() === 6);
        updateVisualDate(d); renderAll();
    }
    function handleDateChange(val) {
        if(!val) return; const d = new Date(val);
        if(d.getDay() === 0 || d.getDay() === 6) { alert("주말은 건너뜁니다."); changeDate(d.getDay() === 6 ? 2 : 1); return; }
        updateVisualDate(d); renderAll();
    }
    function goToToday() {
        let d = new Date(); if(d.getDay() === 0) d.setDate(d.getDate() + 1); if(d.getDay() === 6) d.setDate(d.getDate() + 2);
        updateVisualDate(d); renderAll();
    }

    function renderTodoList() {
        const listEl = document.getElementById('jobPresetList'); listEl.innerHTML = '';
        const selectedDate = document.getElementById('hiddenDateInput').value;
        const visiblePresets = sortJobsByStatusAndCode(getVisiblePresetsForDate(selectedDate));
        document.getElementById('emptyJobMsg').style.display = visiblePresets.length === 0 ? 'block' : 'none';

        visiblePresets.forEach(job => {
            const isActive = currentJob && currentJob.id === job.id;
            listEl.innerHTML += `
                <div class="todo-item ${isActive ? 'active' : ''}">
                    <div class="todo-item-body">
                        <div class="todo-title" title="${escapeHtml(job.opsName)}">${escapeHtml(job.opsName)}</div>
                        <div class="todo-meta">${renderOpTaskMeta(job.opsCode, job.taskName, job.taskCode)}</div>
                    </div>
                    <button class="play-btn" onclick="togglePlay(${job.id})">
                        ${isActive ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'}
                    </button>
                </div>`;
        });
    }

    function roundDateToNearest(dateObj, intervalMins) { 
        if (intervalMins <= 1) return new Date(dateObj); 
        const ms = 1000 * 60 * intervalMins; 
        return new Date(Math.round(dateObj.getTime() / ms) * ms); 
    }
    
    function togglePlay(id) {
        if (currentJob && currentJob.id === id) return stopAndSaveTimer();
        if (currentJob) stopAndSaveTimer(true);
        const job = getPresets().find(p => p.id === id); startTimer(job);
    }
    
    function autoSaveSessionBullets(bullets) {
        const activeRaw = localStorage.getItem(STORAGE_KEY_ACTIVE);
        if (!activeRaw) return;
        try {
            const active = JSON.parse(activeRaw);
            active.bullets = bullets;
            localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(active));
        } catch(e) {}
    }

    function startTimer(job) {
        currentJob = job; startTime = new Date();
        localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify({ startTime: startTime.toISOString(), job, bullets: sessionBulletEditor.getBullets() }));
        updateTimerUI(true); renderTodoList();
        updateLiveTimelineCells();
        timerInterval = setInterval(() => {
            document.getElementById('timerDisplay').innerText = formatTimeMs(new Date() - new Date(startTime));
            updateLiveTimelineCells();
        }, 1000);
    }
    
    function stopAndSaveTimer(resetBullets = true) {
        if (!currentJob || !startTime) return;
        clearInterval(timerInterval);
        
        let endObj = new Date(); let startObj = new Date(startTime);
        const roundMins = parseInt(appSettings.roundSetting || '10', 10);
        startObj = roundDateToNearest(startObj, roundMins); endObj = roundDateToNearest(endObj, roundMins);
        if (endObj <= startObj) endObj = new Date(startObj.getTime() + (roundMins > 1 ? roundMins * 60000 : 60000));

        const bulletsArr = sessionBulletEditor.getBullets();
        const success = insertLogWithLunchCheck(currentJob, startObj, endObj, bulletsArr);
        if(!success) alert("선택된 시간에 타 운영 기록이 있거나 점심시간에 포함되어 제외되었습니다.");

        localStorage.removeItem(STORAGE_KEY_ACTIVE);
        currentJob = null; startTime = null; document.getElementById('timerDisplay').innerText = "00:00:00";
        if (resetBullets) sessionBulletEditor.setBullets([]);
        updateTimerUI(false); renderAll();
    }
    
    function updateTimerUI(isRunning) {
        const badge = document.getElementById('timerBadge');
        badge.className = isRunning ? 'status-badge active' : 'status-badge';
        document.getElementById('timerBadgeText').innerText = isRunning ? '기록 중' : '대기 중';
        document.getElementById('stopBtn').disabled = !isRunning;
        document.getElementById('activeJobTitle').innerText = isRunning ? `[${currentJob.opsCode || ''}] ${currentJob.opsName || ''}`.trim() : '선택된 운영 없음';
    }
    
    function checkActiveTimer() {
        const active = localStorage.getItem(STORAGE_KEY_ACTIVE);
        if (active) {
            const data = JSON.parse(active); startTime = new Date(data.startTime); currentJob = data.job;
            let restoredBullets = [];
            if (Array.isArray(data.bullets)) restoredBullets = data.bullets;
            else if (typeof data.bullets === 'string') restoredBullets = splitPastedTextIntoBullets(data.bullets);
            sessionBulletEditor.setBullets(restoredBullets);
            updateTimerUI(true); renderTodoList();
            updateLiveTimelineCells();
            timerInterval = setInterval(() => {
                document.getElementById('timerDisplay').innerText = formatTimeMs(new Date() - new Date(startTime));
                updateLiveTimelineCells();
            }, 1000);
        }
    }
    function formatTimeMs(ms) { const s = Math.floor(ms / 1000); return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
