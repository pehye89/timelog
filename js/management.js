    function switchMgmtTab(status) {
        mgmtStatusTab = status; mgmtCurrentPage = 1;
        document.getElementById('mgmtTabActive').classList.toggle('active', status === 'active');
        document.getElementById('mgmtTabCompleted').classList.toggle('active', status === 'completed');
        document.getElementById('mgmtTabAdmin').classList.toggle('active', status === 'admin');
        document.getElementById('mgmtTabDeleted').classList.toggle('active', status === 'deleted');
        document.getElementById('mgmtBulkBtns').classList.toggle('hidden', status === 'deleted');
        renderManagement();
    }

    function changeMgmtPage(page) { mgmtCurrentPage = page; renderManagement(); }

    // ---- Search & Period Filter (popover triggered by the calendar icon inside the search box) ----
    function updateMgmtSearch(val) { filters.management.search = val; mgmtCurrentPage = 1; renderManagement(); }
    function updateMgmtDateFrom(val) { filters.management.dateFrom = val; refreshMgmtDateFilterIndicator(); renderManagement(); }
    function updateMgmtDateTo(val) { filters.management.dateTo = val; refreshMgmtDateFilterIndicator(); renderManagement(); }

    function toggleMgmtDateFilter(e) {
        if (e) e.stopPropagation();
        document.getElementById('mgmtDateFilterPopover').classList.toggle('open');
    }

    function refreshMgmtDateFilterIndicator() {
        const hasFilter = !!(filters.management.dateFrom || filters.management.dateTo);
        document.getElementById('mgmtDateFilterToggle').classList.toggle('has-filter', hasFilter);
    }

    document.addEventListener('click', (e) => {
        const wrap = document.getElementById('mgmtSearchFilterWrap');
        const popover = document.getElementById('mgmtDateFilterPopover');
        if (!wrap || !popover || !popover.classList.contains('open')) return;
        if (!wrap.contains(e.target)) popover.classList.remove('open');
    });

    function clearMgmtFilter() {
        filters.management = { search: '', dateFrom: '', dateTo: '' };
        document.getElementById('mgmtSearchInput').value = '';
        document.getElementById('mgmtDateFrom').value = '';
        document.getElementById('mgmtDateTo').value = '';
        refreshMgmtDateFilterIndicator();
        document.getElementById('mgmtDateFilterPopover').classList.remove('open');
        mgmtCurrentPage = 1;
        renderManagement();
    }

    // 진행중 ↔ 완료: click opens a small dropdown with the single next action, then shows a toast
    // once applied. (No sub-category — just the two states.)
    function openStatusQuickMenu(e, jobId, isCurrentlyDone) {
        e.stopPropagation();
        const menu = document.getElementById('quickCompleteMenu');
        menu.innerHTML = '';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quick-complete-item';
        if (isCurrentlyDone) {
            btn.textContent = '진행중으로 변경';
            btn.onclick = () => setJobStatus(jobId, 'active');
        } else {
            btn.textContent = '완료';
            btn.onclick = () => setJobStatus(jobId, 'completed');
        }
        menu.appendChild(btn);

        // .quick-complete-menu uses position:fixed (viewport-relative), so the raw
        // getBoundingClientRect() values are used directly — adding window.scrollX/scrollY here
        // would double-count the scroll offset and push the menu away from the button whenever
        // the page is scrolled.
        const rect = e.currentTarget.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 6}px`;
        menu.style.left = `${rect.left}px`;
        menu.classList.remove('hidden');
    }

    function setJobStatus(jobId, newStatus) {
        const p = getPresets(); const idx = p.findIndex(x => x.id === jobId);
        if (idx > -1) {
            p[idx].status = newStatus;
            if (newStatus === 'completed' && !p[idx].endDate) p[idx].endDate = getTodayIso();
            localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(p));
            renderAll();
            showToast(newStatus === 'completed' ? '완료되었습니다' : '진행중으로 변경되었습니다');
        }
        document.getElementById('quickCompleteMenu').classList.add('hidden');
    }

    document.addEventListener('click', (e) => {
        const menu = document.getElementById('quickCompleteMenu');
        if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });

    // Soft delete: moves the preset into the "삭제된 운영" tab, kept for DELETED_RETENTION_DAYS days.
    function deleteJobFromEditModal() {
        const id = parseInt(document.getElementById('editJobId').value, 10);
        if (!id) return;
        if(confirm('해당 운영을 삭제할까요? 삭제된 운영은 ' + DELETED_RETENTION_DAYS + '일간 "삭제된 운영" 탭에 보관되며, 그 안에 복구할 수 있습니다.')) {
            const p = getPresets(); const idx = p.findIndex(x => x.id === id);
            if (idx > -1) {
                p[idx].previousStatus = p[idx].status;
                p[idx].status = 'deleted';
                p[idx].deletedAt = new Date().toISOString();
                localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(p));
            }
            closeModal('editJobModal');
            renderAll();
        }
    }

    function restoreJob(id) {
        const p = getPresets(); const idx = p.findIndex(x => x.id === id);
        if (idx > -1) {
            p[idx].status = p[idx].previousStatus || 'active';
            delete p[idx].deletedAt;
            delete p[idx].previousStatus;
            localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(p));
            renderAll();
        }
    }

    function permanentlyDeleteJob(id) {
        if (!confirm('영구 삭제하면 되돌릴 수 없습니다. 해당 운영과 관련 기록을 완전히 삭제할까요?')) return;
        const p = getPresets().filter(x => x.id !== id);
        localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(p));
        const h = getHistory().filter(x => x.jobId !== id);
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(h));
        renderAll();
    }

    function toggleHistoryExpand(id) { jobCollapseState[id] = !jobCollapseState[id]; renderManagement(); }
    function toggleAllManagement(expand) { getPresets().filter(p => p.status === mgmtStatusTab).forEach(job => jobCollapseState[job.id] = expand); renderManagement(); }

    function daysRemaining(deletedAt) {
        const elapsedMs = Date.now() - new Date(deletedAt).getTime();
        const remaining = DELETED_RETENTION_DAYS - Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
        return Math.max(remaining, 0);
    }

    function renderManagement() {
        if(document.getElementById('tabManagementView').classList.contains('hidden')) return;

        const f = filters.management;
        const allPresets = getPresets(); const c = document.getElementById('jobManagementContainer'); c.innerHTML = '';
        const allHistory = getHistory();
        const filteredJobs = sortJobsByStatusAndCode(
            allPresets
                .filter(p => p.status === mgmtStatusTab)
                .filter(p => matchesSearch(p, f.search))
        );
        const totalPages = Math.ceil(filteredJobs.length / MGMT_ITEMS_PER_PAGE) || 1;
        if(mgmtCurrentPage > totalPages) mgmtCurrentPage = totalPages;
        const pageJobs = filteredJobs.slice((mgmtCurrentPage - 1) * MGMT_ITEMS_PER_PAGE, mgmtCurrentPage * MGMT_ITEMS_PER_PAGE);

        if(pageJobs.length === 0) c.innerHTML = '<div class="empty-state">해당하는 항목이 없습니다.</div>';

        pageJobs.forEach(job => {
            const isDone = job.status === 'completed';
            const isAdmin = job.status === 'admin';
            const isDeleted = job.status === 'deleted';
            const expanded = !!jobCollapseState[job.id];
            let logs = allHistory.filter(h => h.jobId === job.id);
            if (f.dateFrom || f.dateTo) logs = logs.filter(l => inDateRange(l.date, f.dateFrom, f.dateTo));
            const jobColor = job.color || '#334155';

            let logsHtml = '';
            if(expanded) {
                if(logs.length === 0) {
                    logsHtml = '<div class="log-detail-empty">해당 조건에 기록된 업무가 없습니다.</div>';
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
                        logsHtml += `<tr><td class="col-date">${dateStr}</td><td class="col-duration">${formatDuration(dg.ms)}</td><td class="col-content">${buildDotLines(dg.bullets)}</td></tr>`;
                    });
                    logsHtml += '</table>';
                }
            }

            let datesRowHtml;
            if (isDeleted) {
                datesRowHtml = `<div class="job-panel-dates"><span class="badge-deleted">삭제됨 · ${daysRemaining(job.deletedAt)}일 후 완전 삭제</span></div>`;
            } else if (isAdmin) {
                datesRowHtml = '';
            } else {
                datesRowHtml = `
                    <div class="job-panel-dates">
                        <strong>시작</strong> ${job.startDate || '-'}
                        <span class="sep">·</span>
                        <strong>완료</strong> ${job.endDate || '-'}
                    </div>`;
            }

            let actionsHtml;
            if (isDeleted) {
                actionsHtml = `
                    <button class="btn-ghost btn-ghost--sm" onclick="restoreJob(${job.id})">복구</button>
                    <button class="btn-danger-ghost" onclick="permanentlyDeleteJob(${job.id})">영구 삭제</button>`;
            } else if (isAdmin) {
                actionsHtml = `<button class="btn-ghost btn-ghost--sm" onclick="openEditJob(${job.id})">수정</button>`;
            } else {
                actionsHtml = `
                    <button class="btn-ghost btn-ghost--sm" onclick="openEditJob(${job.id})">수정</button>
                    <button class="status-toggle-btn status-toggle-btn--sm ${isDone ? 'completed' : 'active'}" onclick="openStatusQuickMenu(event, ${job.id}, ${isDone})">${isDone ? '완료' : '진행중'}<span class="status-toggle-caret">▾</span></button>`;
            }

            c.innerHTML += `
                <div class="job-panel ${isDone ? 'is-done' : ''} ${isDeleted ? 'is-deleted' : ''}">
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
                                ${datesRowHtml}
                            </div>
                        </div>
                        <div class="job-panel-actions">
                            ${actionsHtml}
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
        const isAdmin = document.getElementById('newIsAdmin').checked;
        presets.push({ 
            id: Date.now(), status: isAdmin ? 'admin' : 'active', color: getRandomColor(), isCustomColor: false,
            opsCode: document.getElementById('newOpsCode').value.trim(), 
            opsName: document.getElementById('newOpsName').value.trim(), 
            taskCode: document.getElementById('newTaskCode').value.trim(), 
            taskName: document.getElementById('newTaskName').value.trim(), 
            startDate: isAdmin ? '' : (document.getElementById('hiddenDateInput').value || getTodayIso()), endDate: '' 
        });
        localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets)); closeModal('addJobModal'); 
        ['newOpsCode', 'newOpsName', 'newTaskCode', 'newTaskName'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('newIsAdmin').checked = false;
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

    function toggleEditJobDateFields() {
        const isAdmin = document.getElementById('editJobStatus').value === 'admin';
        document.getElementById('editJobDateFields').classList.toggle('hidden', isAdmin);
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
        document.getElementById('editJobStatus').value = (job.status === 'admin') ? 'admin' : (job.status === 'completed' ? 'completed' : 'active');
        toggleEditJobDateFields();
        
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
            const newStatus = document.getElementById('editJobStatus').value;
            presets[idx].status = newStatus;
            if (newStatus === 'admin') {
                presets[idx].startDate = ''; presets[idx].endDate = '';
            } else {
                presets[idx].startDate = document.getElementById('editJobStartDate').value; presets[idx].endDate = document.getElementById('editJobEndDate').value;
                if (newStatus === 'completed' && !presets[idx].endDate) presets[idx].endDate = getTodayIso();
            }
            presets[idx].color = tempSelectedColor;
            presets[idx].isCustomColor = isTempCustomColor;

            localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
            
            const history = getHistory(); let historyChanged = false;
            history.forEach(h => { if (h.jobId === id) { h.opsCode = presets[idx].opsCode; h.opsName = presets[idx].opsName; h.taskCode = presets[idx].taskCode; h.taskName = presets[idx].taskName; historyChanged = true; } });
            if(historyChanged) localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
            
            closeModal('editJobModal'); renderAll();
        }
    }
