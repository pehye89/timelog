    function switchMgmtTab(status) {
        mgmtStatusTab = status; mgmtCurrentPage = 1;
        document.getElementById('mgmtTabActive').classList.toggle('active', status === 'active');
        document.getElementById('mgmtTabCompleted').classList.toggle('active', status === 'completed');
        document.getElementById('mgmtTitle').innerText = status === 'active' ? '진행 중인 운영' : '완료된 운영';
        renderManagement();
    }
    
    function changeMgmtPage(page) { mgmtCurrentPage = page; renderManagement(); }
    
    function toggleStatus(id) {
        const p = getPresets(); const i = p.findIndex(x => x.id === id);
        if(i > -1) { 
            const newStatus = p[i].status === 'completed' ? 'active' : 'completed';
            p[i].status = newStatus;
            if (newStatus === 'completed' && !p[i].endDate) {
                p[i].endDate = getTodayIso();
            }
            localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(p)); 
            const filtered = p.filter(x => x.status === mgmtStatusTab);
            const totalPages = Math.ceil(filtered.length / MGMT_ITEMS_PER_PAGE) || 1;
            if (mgmtCurrentPage > totalPages) mgmtCurrentPage = totalPages;
            renderAll(); 
        }
    }

    function deleteJobFromEditModal() {
        const id = parseInt(document.getElementById('editJobId').value, 10);
        if (!id) return;
        if(confirm('삭제된 운영의 기록들도 함께 삭제됩니다. 정말 삭제하시겠습니까?')) {
            const p = getPresets().filter(x => x.id !== id);
            localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(p));
            const h = getHistory().filter(x => x.jobId !== id);
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(h));
            closeModal('editJobModal');
            renderAll();
        }
    }

    function toggleHistoryExpand(id) { jobCollapseState[id] = !jobCollapseState[id]; renderManagement(); }
    function toggleAllManagement(expand) { getPresets().filter(p => p.status === mgmtStatusTab).forEach(job => jobCollapseState[job.id] = expand); renderManagement(); }

    function renderManagement() {
        if(document.getElementById('tabManagementView').classList.contains('hidden')) return;

        const allPresets = getPresets(); const c = document.getElementById('jobManagementContainer'); c.innerHTML = '';
        const allHistory = getHistory();
        const filteredJobs = allPresets.filter(p => p.status === mgmtStatusTab);
        const totalPages = Math.ceil(filteredJobs.length / MGMT_ITEMS_PER_PAGE) || 1;
        if(mgmtCurrentPage > totalPages) mgmtCurrentPage = totalPages;
        const pageJobs = filteredJobs.slice((mgmtCurrentPage - 1) * MGMT_ITEMS_PER_PAGE, mgmtCurrentPage * MGMT_ITEMS_PER_PAGE);

        if(pageJobs.length === 0) c.innerHTML = '<div class="empty-state">해당하는 항목이 없습니다.</div>';

        pageJobs.forEach(job => {
            const isDone = job.status === 'completed'; const expanded = !!jobCollapseState[job.id];
            const logs = allHistory.filter(h => h.jobId === job.id); const jobColor = job.color || '#334155';
            
            let logsHtml = '';
            if(expanded) {
                if(logs.length === 0) {
                    logsHtml = '<div class="log-detail-empty">기록된 업무가 없습니다.</div>';
                } else {
                    const datesGroup = {};
                    logs.forEach(l => {
                        if(!datesGroup[l.date]) datesGroup[l.date] = { ms: 0, bullets: [] };
                        datesGroup[l.date].ms += l.durationMs;
                        if(l.bullets) datesGroup[l.date].bullets.push(...l.bullets);
                    });
                    const sortedDates = Object.keys(datesGroup).sort((a, b) => a.localeCompare(b));

                    logsHtml = '<table class="log-detail-table">';
                    sortedDates.forEach(dateStr => {
                        const dg = datesGroup[dateStr];
                        logsHtml += `<tr><td class="col-date">${dateStr}</td><td class="col-duration">${formatDurationByUnit(dg.ms, 'mgmt')}</td><td class="col-content">${buildDotLines(dg.bullets)}</td></tr>`;
                    });
                    logsHtml += '</table>';
                }
            }

            c.innerHTML += `
                <div class="job-panel ${isDone ? 'is-done' : ''}">
                    <div class="flex-between job-panel-head">
                        <div class="job-panel-main">
                            <button class="btn-text icon-btn-circle" onclick="toggleHistoryExpand(${job.id})">
                                ${expanded ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>'}
                            </button>
                            
                            <span class="color-dot" style="--job-color: ${jobColor};"></span>

                            <div class="job-panel-info">
                                <div class="job-panel-title">${escapeHtml(job.opsName)}</div>
                                <div class="truncate-line">
                                    ${renderOpTaskMeta(job.opsCode, job.taskName, job.taskCode)}
                                </div>
                                <div class="job-panel-dates">
                                    <strong>시작</strong> ${job.startDate || '-'}
                                    <span class="sep">·</span>
                                    <strong>완료</strong> ${job.endDate || '-'}
                                </div>
                            </div>
                        </div>
                        <div class="job-panel-actions">
                            <button class="btn-ghost btn-ghost--sm" onclick="openEditJob(${job.id})">수정</button>
                            <button class="status-toggle-btn status-toggle-btn--sm ${isDone ? 'completed' : 'active'}" onclick="toggleStatus(${job.id})">${isDone ? '완료' : '진행중'}</button>
                        </div>
                    </div>
                    <div class="job-panel-body ${expanded ? '' : 'is-collapsed'}">${logsHtml}</div>
                </div>`;
        });

        const paginationContainer = document.getElementById('jobManagementPagination'); paginationContainer.innerHTML = '';
        if(totalPages > 1) { for(let i = 1; i <= totalPages; i++) { paginationContainer.innerHTML += `<button class="page-btn ${i === mgmtCurrentPage ? 'active' : ''}" onclick="changeMgmtPage(${i})">${i}</button>`; } }
    }

    function saveNewJob() {
        const presets = getPresets();
        presets.push({ 
            id: Date.now(), status: 'active', color: getRandomColor(), isCustomColor: false,
            opsCode: document.getElementById('newOpsCode').value.trim(), 
            opsName: document.getElementById('newOpsName').value.trim(), 
            taskCode: document.getElementById('newTaskCode').value.trim(), 
            taskName: document.getElementById('newTaskName').value.trim(), 
            startDate: document.getElementById('hiddenDateInput').value || getTodayIso(), endDate: '' 
        });
        localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets)); closeModal('addJobModal'); 
        ['newOpsCode', 'newOpsName', 'newTaskCode', 'newTaskName'].forEach(id => document.getElementById(id).value = '');
        renderAll();
    }
    
    function setCustomJobColor(val) {
        tempSelectedColor = val;
        isTempCustomColor = true;
        document.getElementById('editJobColorText').innerText = val;
        renderEditJobPaletteSwatches();
    }

    function selectJobPaletteColor(val) {
        tempSelectedColor = val;
        isTempCustomColor = false;
        document.getElementById('editJobColorPicker').value = val;
        document.getElementById('editJobColorText').innerText = val;
        renderEditJobPaletteSwatches();
    }

    function renderEditJobPaletteSwatches() {
        const swatchesContainer = document.getElementById('editJobPaletteSwatches');
        if (!swatchesContainer) return;
        swatchesContainer.innerHTML = appSettings.palette.map(col => {
            const isSel = tempSelectedColor === col && !isTempCustomColor;
            return `<span onclick="selectJobPaletteColor('${col}')" class="color-swatch ${isSel ? 'selected' : ''}" style="--job-color: ${col};"></span>`;
        }).join('');
    }

    function openEditJob(id) {
        const job = getPresets().find(p => p.id === id); if(!job) return;
        document.getElementById('editJobId').value = job.id; 
        document.getElementById('editOpsCode').value = job.opsCode || '';
        document.getElementById('editOpsName').value = job.opsName || ''; 
        document.getElementById('editTaskCode').value = job.taskCode || '';
        document.getElementById('editTaskName').value = job.taskName || ''; 
        document.getElementById('editJobStartDate').value = job.startDate || '';
        document.getElementById('editJobEndDate').value = job.endDate || '';
        
        tempSelectedColor = job.color || appSettings.palette[0];
        isTempCustomColor = !!job.isCustomColor;
        document.getElementById('editJobColorPicker').value = tempSelectedColor;
        document.getElementById('editJobColorText').innerText = tempSelectedColor;
        renderEditJobPaletteSwatches();

        openModal('editJobModal');
    }
    
    function saveEditJob() {
        const id = parseInt(document.getElementById('editJobId').value, 10);
        const presets = getPresets(); const idx = presets.findIndex(p => p.id === id);
        if (idx > -1) {
            presets[idx].opsCode = document.getElementById('editOpsCode').value.trim(); presets[idx].opsName = document.getElementById('editOpsName').value.trim();
            presets[idx].taskCode = document.getElementById('editTaskCode').value.trim(); presets[idx].taskName = document.getElementById('editTaskName').value.trim();
            presets[idx].startDate = document.getElementById('editJobStartDate').value; presets[idx].endDate = document.getElementById('editJobEndDate').value;
            presets[idx].color = tempSelectedColor;
            presets[idx].isCustomColor = isTempCustomColor;

            localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
            
            const history = getHistory(); let historyChanged = false;
            history.forEach(h => { if (h.jobId === id) { h.opsCode = presets[idx].opsCode; h.opsName = presets[idx].opsName; h.taskCode = presets[idx].taskCode; h.taskName = presets[idx].taskName; historyChanged = true; } });
            if(historyChanged) localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
            
            closeModal('editJobModal'); renderAll();
        }
    }
