    function goToWeeklyToday() {
        currentWeekDate = new Date();
        renderWeekly();
    }

    function getWeekOfMonthStr(d) {
        const month = d.getMonth() + 1; const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
        const pastDays = d.getDate() - 1; const weekNum = Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
        return `${month}월 ${weekNum}주차`;
    }
    function changeWeek(offset) { currentWeekDate.setDate(currentWeekDate.getDate() + (offset * 7)); renderWeekly(); }

    function toggleWeeklyExpand(id) {
        jobCollapseState[`weekly_${id}`] = !jobCollapseState[`weekly_${id}`];
        renderWeekly();
    }

    function toggleAllWeekly(expand) {
        getPresets().forEach(job => jobCollapseState[`weekly_${job.id}`] = expand);
        renderWeekly();
    }

    // 주간보고 정렬: 관리업무 > 완료(해당 주 이전) > 완료(해당 주) > 진행중, 각 그룹 안에서는 운영번호 오름차순
    function sortJobsForWeekly(jobs, weekStartStr) {
        const rank = j => {
            if (j.status === 'admin') return 0;
            if (j.status === 'completed') return (j.endDate && j.endDate < weekStartStr) ? 1 : 2;
            return 3;
        };
        return [...jobs].sort((a, b) =>
            rank(a) - rank(b) || (a.opsCode || '').localeCompare(b.opsCode || '', undefined, { numeric: true }));
    }

    function renderWeeklySummary(weekHistory, referenceDateStr, weekStartStr) {
        const container = document.getElementById('weeklySummaryContainer');
        const emptyMsg = document.getElementById('weeklySummaryEmptyMsg');
        if (!container) return;

        const presetsMap = {};
        getPresets().forEach(p => { presetsMap[p.id] = p; });

        const totalsByJob = {};
        weekHistory.forEach(h => {
            if (!totalsByJob[h.jobId]) {
                const job = presetsMap[h.jobId] || {};
                totalsByJob[h.jobId] = {
                    ms: 0, endDate: job.endDate, opsCode: h.opsCode, opsName: h.opsName, taskCode: h.taskCode, taskName: h.taskName,
                    status: getStatusAsOfDate(job, referenceDateStr),
                    endedBeforeWeek: !!(job.endDate && job.endDate < weekStartStr)
                };
            }
            totalsByJob[h.jobId].ms += h.durationMs || 0;
        });

        const jobIds = Object.keys(totalsByJob);

        if (jobIds.length === 0) {
            container.innerHTML = '';
            if (emptyMsg) emptyMsg.style.display = 'block';
            return;
        }
        if (emptyMsg) emptyMsg.style.display = 'none';

        const sortedIds = sortJobsForWeekly(jobIds.map(id => ({ id, ...totalsByJob[id] })), weekStartStr).map(item => item.id);
        const grandTotalMs = sortedIds.reduce((sum, id) => sum + totalsByJob[id].ms, 0);

        let html = `
            <div class="flex-between summary-total-row">
                <span class="summary-total-label">총 합계</span>
                <span class="summary-total-value">${formatDuration(grandTotalMs)}</span>
            </div>
        `;

        html += sortedIds.map(id => {
            const item = totalsByJob[id];
            return `
                <div class="flex-between summary-row ${(item.endedBeforeWeek || item.status === 'admin') ? 'is-done' : ''}">
                    <div class="summary-row-info">
                        <div class="summary-row-title-wrap">
                            ${statusPillHtml(item.status)}
                            <div class="summary-row-title truncate-line">${escapeHtml(item.opsName)}</div>
                        </div>
                        <div class="summary-row-meta truncate-line">${renderOpTaskMeta(item.opsCode, item.taskName, item.taskCode)}</div>
                    </div>
                    <span class="summary-row-value">${formatDuration(item.ms)}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    function renderWeekly() {
        if(document.getElementById('tabWeeklyView').classList.contains('hidden')) return;
        const d = new Date(currentWeekDate); const day = d.getDay() || 7; d.setHours(0,0,0,0);
        const mon = new Date(d); mon.setDate(d.getDate() - day + 1); const sun = new Date(d); sun.setDate(d.getDate() - day + 7);
        
        document.getElementById('weeklyDateRangeText').innerText = getWeekOfMonthStr(d);

        const today = new Date(); today.setHours(0,0,0,0);
        document.getElementById('todayBtnWeekly').classList.toggle('is-today', today >= mon && today <= sun);

        const referenceDateStr = dateToIso(sun);
        const weekStartStr = dateToIso(mon);
        const presets = getPresets().filter(p => p.status !== 'deleted');
        const history = getHistory();
        const weekHistory = history.filter(h => h.date >= weekStartStr && h.date <= referenceDateStr);

        renderWeeklySummary(weekHistory, referenceDateStr, weekStartStr);

        const c = document.getElementById('weeklyContainer');
        const sortedPresets = sortJobsForWeekly(presets.map(p => ({ ...p, status: getStatusAsOfDate(p, referenceDateStr) })), weekStartStr);

        const dayLabel = (iso) => { const dt = isoToDate(iso); return `${String(dt.getDate()).padStart(2, '0')} ${DAYS_EN[dt.getDay()]}`; };
        // 그 주에 기록이 있는 운영만 보여준다
        const panels = sortedPresets.map(job => {
            const jobLogs = weekHistory.filter(h => h.jobId === job.id);
            const totalMs = jobLogs.reduce((acc, curr) => acc + (curr.durationMs || 0), 0);
            if (totalMs === 0) return '';

            const isExpanded = jobCollapseState[`weekly_${job.id}`] === true;
            const isDone = job.status === 'completed';
            const isAdmin = job.status === 'admin';
            // 주 시작 전에 이미 끝난 운영과 관리업무는 얇고 흐리게
            const isCompact = isAdmin || !!(job.endDate && job.endDate < weekStartStr);
            const allTimeMs = history.filter(h => h.jobId === job.id).reduce((acc, h) => acc + (h.durationMs || 0), 0);
            const metaLineHtml = isAdmin ? '' : `<div class="job-panel-dates">${formatPeriod(getEffectiveStartDate(job, history), job.endDate)}<span class="sep">·</span>누적 ${formatDuration(allTimeMs)}</div>`;

            return `
                <div class="job-panel ${isCompact ? 'is-compact is-done' : ''}">
                    <div class="flex-between job-panel-head">
                        <div class="job-panel-main">
                            <button class="btn-text icon-btn-circle" onclick="toggleWeeklyExpand(${job.id})">${chevronSvg(isExpanded)}</button>
                            <div class="job-panel-info job-panel-info--half">
                                <div class="job-panel-title job-panel-title--wrap">${escapeHtml(job.opsName)}</div>
                                <div class="truncate-line">${renderOpTaskMeta(job.opsCode, job.taskName, job.taskCode)}</div>
                                ${metaLineHtml}
                            </div>
                        </div>
                        <div class="job-panel-actions">
                            <span class="job-panel-total" title="이번 주 소요 시간">총 ${formatDuration(totalMs)}</span>
                            ${isAdmin ? '' : `<span class="status-toggle-btn status-toggle-btn--readonly ${isDone ? 'completed' : 'active'}">${isDone ? '완료' : '진행중'}</span>`}
                        </div>
                    </div>
                    <div class="job-panel-body ${isExpanded ? '' : 'is-collapsed'}">
                        ${buildDailyLogTable(jobLogs, dayLabel, 'log-detail-table--weekly')}
                    </div>
                </div>`;
        }).join('');

        c.innerHTML = panels || '<div class="empty-state">해당 조건에 기록된 운영이 없습니다.</div>';
    }
