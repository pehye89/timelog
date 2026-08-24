    function handleDragStart(e, index) {
        draggedRowIndex = index;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index);
    }
    function handleDragOver(e, rowEl) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        rowEl.classList.add('drag-over');
    }
    function handleDragLeave(rowEl) {
        rowEl.classList.remove('drag-over');
    }
    function handleDrop(e, targetIndex, rowEl) {
        e.preventDefault();
        rowEl.classList.remove('drag-over');
        if (draggedRowIndex === null || draggedRowIndex === targetIndex) return;
        const movedId = timelineJobOrder[draggedRowIndex];
        timelineJobOrder.splice(draggedRowIndex, 1);
        timelineJobOrder.splice(targetIndex, 0, movedId);
        draggedRowIndex = null;
        renderHistory();
    }

    function renderGridTimeline(history) {
        const rowsContainer = document.getElementById('ganttRows'); rowsContainer.innerHTML = '';
        const headerTicks = document.getElementById('ganttHeaderTicks'); headerTicks.innerHTML = '';
        
        const interval = parseInt(appSettings.roundSetting || '10', 10);
        const wStart = timeToMins(appSettings.workStart); const wEnd = timeToMins(appSettings.workEnd); 
        const lStartMins = timeToMins(appSettings.lunchStart); const lEndMins = timeToMins(appSettings.lunchEnd);
        if(wEnd <= wStart) return;

        const totalIntervals = Math.floor((wEnd - wStart) / interval);

        let ticksHtml = '';
        for(let m = wStart; m < wEnd; m += 60) ticksHtml += `<div class="tick" style="flex: ${60/interval};">${String(Math.floor(m/60)).padStart(2,'0')}</div>`;
        headerTicks.innerHTML = ticksHtml;

        const selectedDate = document.getElementById('hiddenDateInput').value;
        let displayJobs = getVisiblePresetsForDate(selectedDate);

        const hideUnexecuted = document.getElementById('hideUnexecutedTimeline')?.checked;
        if (hideUnexecuted) {
            displayJobs = displayJobs.filter(job => history.some(h => h.jobId === job.id));
        }

        const getFirstLogTime = (jobId) => {
            const jobLogs = history.filter(h => h.jobId === jobId);
            if (!jobLogs.length) return '99:99';
            return jobLogs.map(l => l.startTime).sort()[0];
        };

        const defaultSortedJobs = [...displayJobs].sort((a, b) => {
            const tA = getFirstLogTime(a.id); const tB = getFirstLogTime(b.id);
            if (tA !== tB) return tA.localeCompare(tB);
            if ((a.opsCode || '') !== (b.opsCode || '')) return (a.opsCode || '').localeCompare(b.opsCode || '');
            if ((a.taskCode || '') !== (b.taskCode || '')) return (a.taskCode || '').localeCompare(b.taskCode || '');
            return (a.opsName || '').localeCompare(b.opsName || '');
        });

        if (timelineJobOrder.length === 0 || timelineJobOrder.length !== defaultSortedJobs.length) {
            timelineJobOrder = defaultSortedJobs.map(j => j.id);
        } else {
            const currentIds = defaultSortedJobs.map(j => j.id);
            timelineJobOrder = timelineJobOrder.filter(id => currentIds.includes(id));
            currentIds.forEach(id => { if (!timelineJobOrder.includes(id)) timelineJobOrder.push(id); });
        }

        const sortedDisplayJobs = timelineJobOrder.map(id => defaultSortedJobs.find(j => j.id === id)).filter(Boolean);

        sortedDisplayJobs.forEach((job, index) => {
            const myLogs = history.filter(h => h.jobId === job.id);
            let cellsHtml = '';

            const filledFlags = [];
            const lunchFlags = [];
            for (let i = 0; i < totalIntervals; i++) {
                const cellMins = wStart + (i * interval);
                const filled = myLogs.some(l => timeToMins(l.startTime) <= cellMins && timeToMins(l.endTime) > cellMins);
                filledFlags.push(filled);
                const isLunchCell = cellMins >= lStartMins && cellMins < lEndMins;
                lunchFlags.push(isLunchCell && !filled);
            }

            for(let i=0; i<totalIntervals; i++) {
                const cellMins = wStart + (i * interval);
                const isMyFilled = filledFlags[i];
                const isAnyFilled = history.some(l => timeToMins(l.startTime) <= cellMins && timeToMins(l.endTime) > cellMins);
                const isLunchCell = lunchFlags[i];
                
                let cellClass = '';
                if (isMyFilled) {
                    cellClass = 'filled';
                    const prevFilled = i > 0 && filledFlags[i - 1];
                    const nextFilled = i < totalIntervals - 1 && filledFlags[i + 1];
                    if (!prevFilled && !nextFilled) cellClass += ' run-single';
                    else if (!prevFilled && nextFilled) cellClass += ' run-start run-attach-right';
                    else if (prevFilled && nextFilled) cellClass += ' run-mid run-attach-right';
                    else cellClass += ' run-end';
                }
                else if (isLunchCell) {
                    cellClass = 'lunch-time';
                    const prevLunch = i > 0 && lunchFlags[i - 1];
                    const nextLunch = i < totalIntervals - 1 && lunchFlags[i + 1];
                    if (!prevLunch && !nextLunch) cellClass += ' run-single';
                    else if (!prevLunch && nextLunch) cellClass += ' run-start run-attach-right';
                    else if (prevLunch && nextLunch) cellClass += ' run-mid run-attach-right';
                    else cellClass += ' run-end';
                }
                else if (isAnyFilled) cellClass = 'disabled-cell';

                cellsHtml += `<div class="time-cell ${cellClass}" data-job="${job.id}" data-time="${cellMins}" onclick="handleCellClick(event, ${job.id}, ${cellMins}, ${isMyFilled})" onmousedown="startPaint(event, ${job.id}, ${cellMins}, ${isAnyFilled || isLunchCell})" onmouseenter="hoverPaint(${job.id}, ${cellMins})"></div>`;
            }
            
            const truncName = truncate(job.opsName, 16);
            rowsContainer.innerHTML += `
                <div class="timeline-row" style="--job-color: ${job.color || '#334155'};" 
                     ondragover="handleDragOver(event, this)" 
                     ondragleave="handleDragLeave(this)" 
                     ondrop="handleDrop(event, ${index}, this)">
                    <div class="timeline-row-handle" draggable="true" ondragstart="handleDragStart(event, ${index})" title="드래그하여 순서 변경">⋮</div>
                    <div class="timeline-label" title="${escapeHtml(job.opsCode)} ${escapeHtml(job.opsName)}">
                        <div class="timeline-label-code">${escapeHtml(job.opsCode)}</div>
                        <div class="timeline-label-name">${escapeHtml(truncName)}</div>
                    </div>
                    <div class="timeline-grid">${cellsHtml}</div>
                </div>`;
        });

        updateLiveTimelineCells();
    }

    // Highlights, with a blinking CSS animation, the grid cells covering the time span of a
    // currently-running timer session (from its start time to "now"). This is a lightweight DOM
    // update (no full re-render) so it can run every second without disrupting the grid. Adjacent
    // live cells are merged into one continuous block (same run-start/mid/end/single +
    // run-attach-right treatment used for filled/lunch-time cells), instead of showing as separate
    // small squares.
    //
    // To keep every live cell blinking in perfect lockstep (rather than drifting out of phase, or
    // jumping/speeding up when their phase gets nudged mid-cycle), every currently-live cell is
    // force-restarted together each time this runs: remove the class, read a layout property to
    // force the browser to actually apply that removal (otherwise a same-frame remove+re-add can be
    // silently skipped), then re-add it. Since this restart happens every 1000ms and the CSS
    // animation's own duration is also 1000ms (see below), each restart lands exactly where the
    // previous cycle was already finishing — so there's no visible stutter, just a continuous,
    // steady, perfectly-synced blink.
    function updateLiveTimelineCells() {
        const grid = document.getElementById('ganttRows');
        if (!grid) return;
        const previouslyLive = grid.querySelectorAll('.time-cell.live-cell');
        previouslyLive.forEach(c => {
            c.classList.remove('live-cell', 'run-start', 'run-mid', 'run-end', 'run-single', 'run-attach-right');
        });
        if (previouslyLive.length) void grid.offsetWidth; // force reflow so the removal actually registers

        if (!currentJob || !startTime) return;

        const selectedDate = document.getElementById('hiddenDateInput').value;
        const sessionStart = new Date(startTime);
        if (dateToIso(sessionStart) !== selectedDate) return;

        const interval = parseInt(appSettings.roundSetting || '10', 10);
        const startMins = timeToMins(dateToHHMM(sessionStart));
        const elapsedMins = Math.floor((new Date() - sessionStart) / 60000);
        const effectiveEndMins = startMins + elapsedMins;

        const cells = Array.from(grid.querySelectorAll(`.time-cell[data-job="${currentJob.id}"]`));
        const liveFlags = cells.map(cell => {
            const cellMins = parseInt(cell.dataset.time, 10);
            return cellMins <= effectiveEndMins && cellMins + interval > startMins;
        });

        cells.forEach((cell, i) => {
            if (!liveFlags[i]) return;
            cell.classList.add('live-cell');
            const prevLive = i > 0 && liveFlags[i - 1];
            const nextLive = i < cells.length - 1 && liveFlags[i + 1];
            if (!prevLive && !nextLive) cell.classList.add('run-single');
            else if (!prevLive && nextLive) cell.classList.add('run-start', 'run-attach-right');
            else if (prevLive && nextLive) cell.classList.add('run-mid', 'run-attach-right');
            else cell.classList.add('run-end');
        });
    }

    // Clicking a filled cell deletes just that interval slice from the underlying log entry —
    // trimming the start/end, or splitting the entry in two if the clicked slice is in the middle.
    function handleCellClick(e, jobId, cellMins, isFilled) {
        if (!isFilled) return;
        deleteTimeBlock(jobId, cellMins);
    }

    function deleteTimeBlock(jobId, blockStartMins) {
        const dateStr = document.getElementById('hiddenDateInput').value;
        const interval = parseInt(appSettings.roundSetting || '10', 10);
        const blockEndMins = blockStartMins + interval;

        const history = getHistory();
        const idx = history.findIndex(h => h.jobId === jobId && h.date === dateStr &&
            timeToMins(h.startTime) <= blockStartMins && timeToMins(h.endTime) > blockStartMins);
        if (idx === -1) return;

        const entry = history[idx];
        if (entry.bullets && entry.bullets.length > 0) {
            if (!confirm('이 시간에 작성된 메모가 있습니다. 그래도 삭제하시겠습니까?')) return;
        }
        const entryStart = timeToMins(entry.startTime);
        const entryEnd = timeToMins(entry.endTime);

        const minsToTimeStr = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
        const minsToDateObj = (mins) => new Date(`${dateStr}T${minsToTimeStr(mins)}:00`);

        if (entryStart === blockStartMins && entryEnd === blockEndMins) {
            // The block IS the whole entry — remove it entirely.
            history.splice(idx, 1);
        } else if (entryStart === blockStartMins) {
            // Trim from the front.
            const newStart = minsToDateObj(blockEndMins);
            const endObj = new Date(entry.endTimeObj || minsToDateObj(entryEnd));
            entry.startTime = minsToTimeStr(blockEndMins);
            entry.startTimeObj = newStart.toISOString();
            entry.durationMs = endObj - newStart;
        } else if (entryEnd === blockEndMins) {
            // Trim from the back.
            const newEnd = minsToDateObj(blockStartMins);
            const startObj = new Date(entry.startTimeObj || minsToDateObj(entryStart));
            entry.endTime = minsToTimeStr(blockStartMins);
            entry.endTimeObj = newEnd.toISOString();
            entry.durationMs = newEnd - startObj;
        } else {
            // The block is in the middle — split into two entries, both keeping a copy of the notes.
            const startObj = new Date(entry.startTimeObj || minsToDateObj(entryStart));
            const firstEnd = minsToDateObj(blockStartMins);
            const secondStart = minsToDateObj(blockEndMins);
            const originalEnd = new Date(entry.endTimeObj || minsToDateObj(entryEnd));

            entry.endTime = minsToTimeStr(blockStartMins);
            entry.endTimeObj = firstEnd.toISOString();
            entry.durationMs = firstEnd - startObj;

            const secondPiece = createHistoryObject(
                { id: entry.jobId, opsCode: entry.opsCode, opsName: entry.opsName, taskCode: entry.taskCode, taskName: entry.taskName },
                secondStart, originalEnd, [...(entry.bullets || [])]
            );
            history.splice(idx + 1, 0, secondPiece);
        }

        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
        renderAll();
    }

    function startPaint(e, jobId, mins, isDisabled) {
        if(e.button !== 0 || isDisabled) return;
        paintState = { isPainting: true, jobId: jobId, startMins: mins, currentMins: mins }; updatePaintVisuals();
    }
    
    function hoverPaint(jobId, mins) {
        if(!paintState.isPainting || paintState.jobId !== jobId) return;
        paintState.currentMins = mins; updatePaintVisuals();
    }
    
    function updatePaintVisuals() {
        if(!paintState.isPainting) return;
        const minTime = Math.min(paintState.startMins, paintState.currentMins); const maxTime = Math.max(paintState.startMins, paintState.currentMins);
        
        document.querySelectorAll('.time-cell').forEach(cell => {
            cell.classList.remove('painting');
            if(parseInt(cell.dataset.job) === paintState.jobId) {
                const t = parseInt(cell.dataset.time);
                if(t >= minTime && t <= maxTime) cell.classList.add('painting');
            }
        });
    }
    
    function endPaint(forceCancel = false) {
        if(!paintState.isPainting) return;
        const state = { ...paintState }; paintState.isPainting = false;
        document.querySelectorAll('.time-cell').forEach(c => c.classList.remove('painting'));
        if(forceCancel === true || (typeof forceCancel === 'object' && forceCancel.type === 'mouseleave')) return;

        const interval = parseInt(appSettings.roundSetting || '10', 10);
        const sMins = Math.min(state.startMins, state.currentMins); const eMins = Math.max(state.startMins, state.currentMins) + interval;
        
        const h1 = String(Math.floor(sMins/60)).padStart(2,'0'); const m1 = String(sMins%60).padStart(2,'0');
        const h2 = String(Math.floor(eMins/60)).padStart(2,'0'); const m2 = String(eMins%60).padStart(2,'0');

        openModal('manualAddModal');
        const select = document.getElementById('manualAddJob');
        select.innerHTML = getPresets().map(p => `<option value="${p.id}">[${escapeHtml(p.opsCode)}] ${escapeHtml(p.opsName)}</option>`).join('');
        if(select.querySelector(`option[value="${state.jobId}"]`)) select.value = state.jobId;
        
        document.getElementById('manualAddDate').value = document.getElementById('hiddenDateInput').value;
        document.getElementById('manualAddStart').value = `${h1}:${m1}`;
        document.getElementById('manualAddEnd').value = `${h2}:${m2}`;
        manualAddBulletEditor.setBullets([]);
    }
