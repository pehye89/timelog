    function switchMgmtTab(status) {
        mgmtStatusTab = status; mgmtCurrentPage = 1;
        const tabs = { all: 'mgmtTabAll', active: 'mgmtTabActive', completed: 'mgmtTabCompleted', suspended: 'mgmtTabSuspended', admin: 'mgmtTabAdmin', deleted: 'mgmtTabDeleted' };
        Object.entries(tabs).forEach(([key, id]) => document.getElementById(id).classList.toggle('active', status === key));
        document.getElementById('mgmtBulkBtns').classList.toggle('hidden', status === 'deleted');
        renderManagement();
    }

    // ---- Manual sort-order picker (icon button next to the search box) ----
    function toggleMgmtSortMenu(e) {
        if (e) e.stopPropagation();
        renderMgmtSortOptions();
        updateMgmtSortDirectionButtons();
        document.getElementById('mgmtSortPopover').classList.toggle('open');
    }

    function renderMgmtSortOptions() { renderSortOptionButtons('mgmtSortOptions', MGMT_SORT_OPTIONS, mgmtSortOrder, setMgmtSortOrder); }
    function updateMgmtSortDirectionButtons() { updateSortDirButton('mgmtSortDirBtn', mgmtSortDirection); }

    // 기본값 = 운영번호 내림차순. 아이콘은 사용자가 기본값과 다른 정렬을 골랐을 때만 강조된다.
    function refreshMgmtSortIndicator() {
        const hasCustomSort = mgmtSortOrder !== 'default' || mgmtSortDirection !== MGMT_SORT_OPTIONS.default.defaultDir;
        document.getElementById('mgmtSortToggle').classList.toggle('has-filter', hasCustomSort);
    }

    function setMgmtSortOrder(key) {
        mgmtSortOrder = key;
        // "기본값"을 고르면 정렬 방향도 기본 방향으로 함께 되돌린다.
        if (MGMT_SORT_OPTIONS[key]?.defaultDir) {
            mgmtSortDirection = MGMT_SORT_OPTIONS[key].defaultDir;
            updateMgmtSortDirectionButtons();
        }
        renderMgmtSortOptions();
        refreshMgmtSortIndicator();
        saveSortSettings();
        renderManagement();
    }

    function toggleMgmtSortDirection() {
        setMgmtSortDirection(mgmtSortDirection === 'asc' ? 'desc' : 'asc');
    }

    function setMgmtSortDirection(dir) {
        mgmtSortDirection = dir;
        updateMgmtSortDirectionButtons();
        refreshMgmtSortIndicator();
        saveSortSettings();
        renderManagement();
    }

    closeOnOutsideClick('mgmtSortFilterWrap', 'mgmtSortPopover');

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

    closeOnOutsideClick('mgmtSearchFilterWrap', 'mgmtDateFilterPopover');

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

    // 진행중 / 완료 / 중단: click opens a small dropdown with the other available states, then
    // shows a toast once applied.
    function openStatusQuickMenu(e, jobId) {
        e.stopPropagation();
        const job = getPresets().find(p => p.id === jobId);
        if (!job) return;
        const menu = document.getElementById('quickCompleteMenu');
        menu.innerHTML = '';

        const transitionLabels = { active: '진행중으로 변경', completed: '완료로 변경', suspended: '중단으로 변경' };
        Object.keys(transitionLabels).filter(s => s !== job.status).forEach(s => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'quick-complete-item';
            btn.textContent = transitionLabels[s];
            btn.onclick = () => setJobStatus(jobId, s);
            menu.appendChild(btn);
        });

        // 메뉴는 position:fixed라 화면 좌표를 그대로 쓴다 (scrollY를 더하면 스크롤 시 어긋남)
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
            savePresets(p);
            renderAll();
            const toastMsgs = { active: '진행중으로 변경되었습니다', completed: '완료되었습니다', suspended: '중단으로 변경되었습니다' };
            showToast(toastMsgs[newStatus] || '변경되었습니다');
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
                savePresets(p);
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
            savePresets(p);
            renderAll();
        }
    }

    function permanentlyDeleteJob(id) {
        if (!confirm('영구 삭제하면 되돌릴 수 없습니다. 해당 운영과 관련 기록을 완전히 삭제할까요?')) return;
        const p = getPresets().filter(x => x.id !== id);
        savePresets(p);
        const h = getHistory().filter(x => x.jobId !== id);
        saveHistory(h);
        renderAll();
    }

    function toggleHistoryExpand(id) { jobCollapseState[id] = !jobCollapseState[id]; renderManagement(); }
    function toggleAllManagement(expand) {
        getPresets()
            .filter(p => mgmtStatusTab === 'all' ? p.status !== 'deleted' : p.status === mgmtStatusTab)
            .forEach(job => jobCollapseState[job.id] = expand);
        renderManagement();
    }

    function daysRemaining(deletedAt) {
        const elapsedMs = Date.now() - new Date(deletedAt).getTime();
        const remaining = DELETED_RETENTION_DAYS - Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
        return Math.max(remaining, 0);
    }

    function renderManagement() {
        if(document.getElementById('tabManagementView').classList.contains('hidden')) return;

        const f = filters.management;
        const allPresets = getPresets(); const c = document.getElementById('jobManagementContainer');
        const allHistory = getHistory();
        const filteredJobs = sortJobsForManagement(
            allPresets
                .filter(p => mgmtStatusTab === 'all' ? p.status !== 'deleted' : p.status === mgmtStatusTab)
                .filter(p => matchesSearch(p, f.search)),
            mgmtSortOrder,
            mgmtSortDirection
        );
        const totalPages = Math.ceil(filteredJobs.length / MGMT_ITEMS_PER_PAGE) || 1;
        if(mgmtCurrentPage > totalPages) mgmtCurrentPage = totalPages;
        const pageJobs = filteredJobs.slice((mgmtCurrentPage - 1) * MGMT_ITEMS_PER_PAGE, mgmtCurrentPage * MGMT_ITEMS_PER_PAGE);

        c.innerHTML = pageJobs.length ? pageJobs.map(job => {
            const isDone = job.status === 'completed';
            const isAdmin = job.status === 'admin';
            const isDeleted = job.status === 'deleted';
            const expanded = !!jobCollapseState[job.id];
            const jobLogs = allHistory.filter(h => h.jobId === job.id);
            const allTimeMs = jobLogs.reduce((acc, h) => acc + (h.durationMs || 0), 0);
            // 기간 필터는 펼쳤을 때 보이는 날짜별 기록에만 적용된다
            const logsHtml = expanded ? buildDailyLogTable(jobLogs.filter(l => inDateRange(l.date, f.dateFrom, f.dateTo)), d => d) : '';
            const jobColor = job.color || '#334155';
            const isCompact = isDone || isDeleted || job.status === 'suspended';

            const deletedBadge = isDeleted ? `<div class="job-panel-dates"><span class="badge-deleted">삭제됨 · ${daysRemaining(job.deletedAt)}일 후 완전 삭제</span></div>` : '';
            // 시작 · 완료 · 누적 소요를 작은 회색 한 줄로 합침 (관리업무·휴지통은 표시 안 함)
            const metaLineHtml = (isAdmin || isDeleted) ? '' : `<div class="job-panel-dates">${formatPeriod(getEffectiveStartDate(job, allHistory), job.endDate)}<span class="sep">·</span>누적 ${formatDuration(allTimeMs)}</div>`;

            let actionsHtml;
            if (isDeleted) {
                actionsHtml = `
                    <button class="btn-ghost btn-ghost--sm" onclick="restoreJob(${job.id})">복구</button>
                    <button class="btn-danger-ghost" onclick="permanentlyDeleteJob(${job.id})">영구 삭제</button>`;
            } else if (isAdmin) {
                actionsHtml = `<button class="btn-ghost btn-ghost--sm" onclick="openEditJob(${job.id})">수정</button>`;
            } else {
                const curLabel = STATUS_QUICK_LABELS[job.status] || '진행중';
                actionsHtml = `
                    <button class="btn-ghost btn-ghost--sm" onclick="openEditJob(${job.id})">수정</button>
                    <button class="status-toggle-btn status-toggle-btn--sm ${job.status}" onclick="openStatusQuickMenu(event, ${job.id})">${curLabel}<span class="status-toggle-caret">▾</span></button>`;
            }

            return `
                <div class="job-panel ${isCompact ? 'is-compact' : ''} ${isDone ? 'is-done' : ''} ${isDeleted ? 'is-deleted' : ''}">
                    <div class="flex-between job-panel-head">
                        <div class="job-panel-main">
                            <button class="btn-text icon-btn-circle" onclick="toggleHistoryExpand(${job.id})">${chevronSvg(expanded)}</button>
                            <span class="color-dot" style="--job-color: ${jobColor};"></span>
                            <div class="job-panel-info">
                                <div class="job-panel-title">${escapeHtml(job.opsName)}</div>
                                <div class="truncate-line">${renderOpTaskMeta(job.opsCode, job.taskName, job.taskCode)}</div>
                                ${deletedBadge}${metaLineHtml}
                            </div>
                        </div>
                        <div class="job-panel-actions">
                            ${actionsHtml}
                        </div>
                    </div>
                    <div class="job-panel-body ${expanded ? '' : 'is-collapsed'}">${logsHtml}</div>
                </div>`;
        }).join('') : '<div class="empty-state">해당하는 항목이 없습니다.</div>';

        renderPagination(document.getElementById('jobManagementPagination'), totalPages, mgmtCurrentPage, 'changeMgmtPage');
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
            erpBizz: document.getElementById('newErpBizz').value.trim(),   // ERP 「업무」 칸 (비우면 기본값 '운영')
            startDate: isAdmin ? '' : (document.getElementById('hiddenDateInput').value || getTodayIso()), endDate: '' 
        });
        savePresets(presets); closeModal('addJobModal'); 
        ['newOpsCode', 'newOpsName', 'newTaskCode', 'newTaskName', 'newErpBizz'].forEach(id => document.getElementById(id).value = '');
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
        document.getElementById('editErpBizz').value = job.erpBizz || '';
        // 화면에 보인 시작일을 기억해 두고, 저장할 때 바뀐 경우에만 직접 지정한 것으로 본다
        const startEl = document.getElementById('editJobStartDate');
        startEl.value = startEl.dataset.shown = getEffectiveStartDate(job) || '';
        document.getElementById('editJobEndDate').value = job.endDate || '';
        document.getElementById('editJobStatus').value = ['admin', 'completed', 'suspended'].includes(job.status) ? job.status : 'active';
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
            presets[idx].erpBizz = document.getElementById('editErpBizz').value.trim();
            const newStatus = document.getElementById('editJobStatus').value;
            presets[idx].status = newStatus;
            if (newStatus === 'admin') {
                presets[idx].startDate = ''; presets[idx].endDate = '';
            } else {
                const startEl = document.getElementById('editJobStartDate');
                if (startEl.value !== (startEl.dataset.shown || '')) {
                    // 직접 바꾼 경우에만 수동 지정으로 고정 (비우면 다시 첫 기록일 자동)
                    presets[idx].startDate = startEl.value; presets[idx].startDateManual = !!startEl.value;
                }
                presets[idx].endDate = document.getElementById('editJobEndDate').value;
                if (newStatus === 'completed' && !presets[idx].endDate) presets[idx].endDate = getTodayIso();
            }
            presets[idx].color = tempSelectedColor;
            presets[idx].isCustomColor = isTempCustomColor;

            savePresets(presets);
            
            // 기록에 함께 저장된 운영 정보도 새 값으로 맞춘다
            const history = getHistory();
            const { opsCode, opsName, taskCode, taskName } = presets[idx];
            const mine = history.filter(h => h.jobId === id);
            mine.forEach(h => Object.assign(h, { opsCode, opsName, taskCode, taskName }));
            if (mine.length) saveHistory(history);
            
            closeModal('editJobModal'); renderAll();
        }
    }
