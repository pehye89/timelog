    function updateVisualDate(d) {
        const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
        const newDateStr = `${yyyy}-${mm}-${dd}`;
        const prevDateStr = document.getElementById('hiddenDateInput').value;
        if (newDateStr !== prevDateStr) {
            // Manual timeline row order is scoped to the day it was set on — a fresh day starts
            // back at execution-based ordering.
            timelineOrderManuallySet = false;
            timelineJobOrder = [];
            trackerListPage = 1;
        }
        document.getElementById('visualDateText').innerText = `${yyyy}.${mm}.${dd} ${DAYS_EN[d.getDay()]}`;
        document.getElementById('hiddenDateInput').value = newDateStr;
        document.getElementById('todayBtnTracker').classList.toggle('is-today', newDateStr === getTodayIso());
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
        const includeCompleted = document.getElementById('trackerIncludeCompleted')?.checked;
        const includeSuspended = document.getElementById('trackerIncludeSuspended')?.checked;
        let visiblePresets = sortJobsForTracker(
            getVisiblePresetsForDate(selectedDate, includeCompleted, includeSuspended),
            trackerSortOrder, trackerSortDirection
        );

        // Completed items older than TRACKER_COMPLETED_VISIBLE_DAYS don't clutter the daily list —
        // for anything further back, use the 운영 관리 탭's 완료 목록 instead.
        const completedCutoffIso = dateToIso(new Date(Date.now() - TRACKER_COMPLETED_VISIBLE_DAYS * 24 * 60 * 60 * 1000));
        visiblePresets = visiblePresets.filter(p => p.status !== 'completed' || !p.endDate || p.endDate >= completedCutoffIso);

        document.getElementById('emptyJobMsg').style.display = visiblePresets.length === 0 ? 'block' : 'none';

        const totalPages = Math.ceil(visiblePresets.length / TRACKER_LIST_PAGE_SIZE) || 1;
        if (trackerListPage > totalPages) trackerListPage = totalPages;
        const pageItems = visiblePresets.slice((trackerListPage - 1) * TRACKER_LIST_PAGE_SIZE, trackerListPage * TRACKER_LIST_PAGE_SIZE);

        pageItems.forEach(job => {
            const isActive = currentJob && currentJob.id === job.id;
            const completedTag = (job.status === 'completed' || job.status === 'suspended') ? statusPillHtml(job.status) : '';
            listEl.innerHTML += `
                <div class="todo-item ${isActive ? 'active' : ''}">
                    <div class="todo-item-body">
                        <div class="todo-title-row">
                            ${completedTag}
                            <div class="todo-title" title="${escapeHtml(job.opsName)}">${escapeHtml(job.opsName)}</div>
                        </div>
                        <div class="todo-meta">${renderOpTaskMeta(job.opsCode, job.taskName, job.taskCode)}</div>
                    </div>
                    <button class="play-btn" onclick="togglePlay(${job.id})">
                        ${isActive ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'}
                    </button>
                </div>`;
        });

        const paginationEl = document.getElementById('jobPresetPagination');
        paginationEl.innerHTML = '';
        if (totalPages > 1) {
            for (let i = 1; i <= totalPages; i++) {
                paginationEl.innerHTML += `<button class="page-btn ${i === trackerListPage ? 'active' : ''}" onclick="changeTrackerListPage(${i})">${i}</button>`;
            }
        }
    }

    function changeTrackerListPage(page) { trackerListPage = page; renderTodoList(); }

    // ---- 운영목록 필터·정렬 팝오버 (완료/중단 포함 체크박스 + 정렬 기준) ----
    function toggleTrackerFilterMenu(e) {
        if (e) e.stopPropagation();
        renderTrackerSortOptions();
        updateTrackerSortDirectionButton();
        document.getElementById('trackerFilterPopover').classList.toggle('open');
    }

    function renderTrackerSortOptions() {
        const wrap = document.getElementById('trackerSortOptions');
        if (!wrap) return;
        wrap.innerHTML = '';
        Object.keys(TRACKER_SORT_OPTIONS).forEach(key => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sort-option-item' + (trackerSortOrder === key ? ' active' : '');
            btn.textContent = TRACKER_SORT_OPTIONS[key].label;
            btn.onclick = () => setTrackerSortOrder(key);
            wrap.appendChild(btn);
        });
    }

    function updateTrackerSortDirectionButton() {
        const btn = document.getElementById('trackerSortDirBtn');
        if (!btn) return;
        btn.classList.toggle('desc', trackerSortDirection === 'desc');
        btn.title = trackerSortDirection === 'asc' ? '오름차순 (클릭 시 내림차순)' : '내림차순 (클릭 시 오름차순)';
    }

    function refreshTrackerFilterIndicator() {
        const includeCompleted = document.getElementById('trackerIncludeCompleted')?.checked;
        const includeSuspended = document.getElementById('trackerIncludeSuspended')?.checked;
        const hasCustom = includeCompleted || includeSuspended || trackerSortOrder !== 'default' || trackerSortDirection !== TRACKER_SORT_OPTIONS.default.defaultDir;
        document.getElementById('trackerFilterToggle').classList.toggle('has-filter', hasCustom);
    }

    function updateTrackerFilter() {
        trackerListPage = 1;
        refreshTrackerFilterIndicator();
        saveSortSettings();
        renderAll();
    }

    // 저장된 표시 항목(완료/중단 포함) 체크 상태를 첫 렌더링 전에 체크박스에 복원한다.
    function restoreTrackerFilterCheckboxes() {
        try {
            const f = JSON.parse(localStorage.getItem(STORAGE_KEY_SORT) || '{}').trackerFilter;
            if (!f) return;
            document.getElementById('trackerIncludeCompleted').checked = f.completed === true;
            document.getElementById('trackerIncludeSuspended').checked = f.suspended === true;
        } catch (e) { /* 저장값이 깨졌으면 기본값(둘 다 꺼짐) 유지 */ }
    }

    function setTrackerSortOrder(key) {
        trackerSortOrder = key;
        // "기본값"을 고르면 정렬 방향도 기본 방향으로 함께 되돌린다.
        if (TRACKER_SORT_OPTIONS[key]?.defaultDir) {
            trackerSortDirection = TRACKER_SORT_OPTIONS[key].defaultDir;
            updateTrackerSortDirectionButton();
        }
        renderTrackerSortOptions();
        refreshTrackerFilterIndicator();
        saveSortSettings();
        timelineOrderManuallySet = false; // 정렬을 바꾸면 타임라인도 드래그 순서 대신 새 정렬을 따른다
        renderTodoList();
        renderHistory();
    }

    function toggleTrackerSortDirection() {
        setTrackerSortDirection(trackerSortDirection === 'asc' ? 'desc' : 'asc');
    }

    function setTrackerSortDirection(dir) {
        trackerSortDirection = dir;
        updateTrackerSortDirectionButton();
        refreshTrackerFilterIndicator();
        saveSortSettings();
        timelineOrderManuallySet = false; // 정렬을 바꾸면 타임라인도 드래그 순서 대신 새 정렬을 따른다
        renderTodoList();
        renderHistory();
    }

    document.addEventListener('click', (e) => {
        const wrap = document.getElementById('trackerFilterWrap');
        const popover = document.getElementById('trackerFilterPopover');
        if (!wrap || !popover || !popover.classList.contains('open')) return;
        // composedPath()는 클릭 시점의 경로라, 클릭 후 다시 그려져 DOM에서 빠진 옵션 버튼도 '팝오버 안' 클릭으로 인식한다.
        if (!e.composedPath().includes(wrap)) popover.classList.remove('open');
    });

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
        // Use a full renderHistory() (not just updateLiveTimelineCells()) here: if "미실행 숨기기" is on
        // and this job has no logged entries yet today, its timeline row won't exist in the DOM until
        // a real re-render happens — a live-cell class toggle alone has nothing to attach to.
        // renderHistory() rebuilds the grid now that currentJob/startTime are already set, so the row
        // (kept visible by the "currently running" exception in the hide-unexecuted filter) appears
        // immediately instead of only after some unrelated re-render.
        renderHistory();
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
            renderHistory();
            timerInterval = setInterval(() => {
                document.getElementById('timerDisplay').innerText = formatTimeMs(new Date() - new Date(startTime));
                updateLiveTimelineCells();
            }, 1000);
        }
    }
    function formatTimeMs(ms) { const s = Math.floor(ms / 1000); return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
