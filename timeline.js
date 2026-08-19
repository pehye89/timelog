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

            for(let i=0; i<totalIntervals; i++) {
                const cellMins = wStart + (i * interval);
                const isMyFilled = myLogs.some(l => timeToMins(l.startTime) <= cellMins && timeToMins(l.endTime) > cellMins);
                const isAnyFilled = history.some(l => timeToMins(l.startTime) <= cellMins && timeToMins(l.endTime) > cellMins);
                const isLunch = cellMins >= lStartMins && cellMins < lEndMins; 
                
                let cellClass = '';
                if (isMyFilled) cellClass = 'filled';
                else if (isLunch) cellClass = 'lunch-time';
                else if (isAnyFilled) cellClass = 'disabled-cell';

                cellsHtml += `<div class="time-cell ${cellClass}" data-job="${job.id}" data-time="${cellMins}" onclick="handleCellClick(event, ${job.id}, ${cellMins}, ${isMyFilled})" onmousedown="startPaint(event, ${job.id}, ${cellMins}, ${isAnyFilled || isLunch})" onmouseenter="hoverPaint(${job.id}, ${cellMins})"></div>`;
            }
            
            const truncName = truncate(job.opsName, 10);
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
    }

    function handleCellClick(e, jobId, cellMins, isFilled) {
        if (!isFilled) return;
        const dateStr = document.getElementById('hiddenDateInput').value;
        const targetLog = getHistory().find(h => h.jobId === jobId && h.date === dateStr && timeToMins(h.startTime) <= cellMins && timeToMins(h.endTime) > cellMins);
        if (targetLog && confirm('선택한 시간에 활성화된 블럭을 삭제하시겠습니까?')) {
            deleteHistory(targetLog.id);
        }
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
