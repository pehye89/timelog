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

    // ---- Search & Period Filter ----
    function updateWeeklySearch(val) { filters.weekly.search = val; renderWeekly(); }
    function updateWeeklyDateFrom(val) { filters.weekly.dateFrom = val; renderWeekly(); }
    function updateWeeklyDateTo(val) { filters.weekly.dateTo = val; renderWeekly(); }
    function clearWeeklyFilter() {
        filters.weekly = { search: '', dateFrom: '', dateTo: '' };
        document.getElementById('weeklySearchInput').value = '';
        document.getElementById('weeklyDateFrom').value = '';
        document.getElementById('weeklyDateTo').value = '';
        renderWeekly();
    }

    function renderWeeklySummary(weekHistory) {
        const container = document.getElementById('weeklySummaryContainer');
        const emptyMsg = document.getElementById('weeklySummaryEmptyMsg');
        if (!container) return;

        const totalsByJob = {};
        weekHistory.forEach(h => {
            if (!totalsByJob[h.jobId]) totalsByJob[h.jobId] = { ms: 0, opsCode: h.opsCode, opsName: h.opsName, taskCode: h.taskCode, taskName: h.taskName };
            totalsByJob[h.jobId].ms += h.durationMs || 0;
        });

        const jobIds = Object.keys(totalsByJob).filter(id => matchesSearch(totalsByJob[id], filters.weekly.search));

        if (jobIds.length === 0) {
            container.innerHTML = '';
            if (emptyMsg) emptyMsg.style.display = 'block';
            return;
        }
        if (emptyMsg) emptyMsg.style.display = 'none';

        const sortedIds = jobIds.sort((a, b) => totalsByJob[b].ms - totalsByJob[a].ms);
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
                <div class="flex-between summary-row">
                    <div class="summary-row-info">
                        <div class="summary-row-title truncate-line">${escapeHtml(item.opsName)}</div>
                        <div class="summary-row-meta truncate-line">${renderOpTaskMeta(item.opsCode, item.taskName, item.taskCode)}</div>
                    </div>
                    <span class="summary-row-value">${formatDuration(item.ms)}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    // Weekly Report Render with Optimized Layout
    function renderWeekly() {
        if(document.getElementById('tabWeeklyView').classList.contains('hidden')) return;
        const d = new Date(currentWeekDate); const day = d.getDay() || 7; d.setHours(0,0,0,0);
        const mon = new Date(d); mon.setDate(d.getDate() - day + 1); const sun = new Date(d); sun.setDate(d.getDate() - day + 7);
        
        document.getElementById('weeklyDateRangeText').innerText = getWeekOfMonthStr(d);
        
        const f = filters.weekly;
        const presets = getPresets().filter(p => p.status !== 'deleted');
        const history = getHistory();
        let weekHistory = history.filter(h => { const hd = new Date(h.date); return hd >= mon && hd <= sun; });
        if (f.dateFrom || f.dateTo) weekHistory = weekHistory.filter(h => inDateRange(h.date, f.dateFrom, f.dateTo));

        renderWeeklySummary(weekHistory);

        const c = document.getElementById('weeklyContainer'); c.innerHTML = '';

        const statusOrder = { active: 0, admin: 1, completed: 2 };
        const sortedPresets = [...presets]
            .filter(p => matchesSearch(p, f.search))
            .sort((a, b) => {
                const oa = statusOrder[a.status] ?? 3; const ob = statusOrder[b.status] ?? 3;
                if (oa !== ob) return oa - ob;
                return (a.opsCode || '').localeCompare(b.opsCode || '');
            });

        if(sortedPresets.length === 0) {
            return c.innerHTML = '<div class="empty-state">해당하는 운영이 없습니다.</div>';
        }

        let renderedCount = 0;

        sortedPresets.forEach(job => {
            const jobLogs = weekHistory.filter(h => h.jobId === job.id);
            const totalMs = jobLogs.reduce((acc, curr) => acc + (curr.durationMs || 0), 0);
            if (totalMs === 0) return;
            renderedCount++;

            const isExpanded = jobCollapseState[`weekly_${job.id}`] !== false;

            const datesGroup = {};
            jobLogs.forEach(l => {
                if(!datesGroup[l.date]) datesGroup[l.date] = { ms: 0, bullets: [] };
                datesGroup[l.date].ms += l.durationMs;
                if(l.bullets) datesGroup[l.date].bullets.push(...l.bullets);
            });

            const sortedDates = Object.keys(datesGroup).sort((a, b) => a.localeCompare(b));

            let datesTreeHtml = '';
            if (sortedDates.length > 0) {
                datesTreeHtml = '<table class="log-detail-table log-detail-table--weekly">';
                sortedDates.forEach(dateStr => {
                    const dateObj = new Date(dateStr); const dayStr = DAYS_EN[dateObj.getDay()];
                    const dayNum = String(dateObj.getDate()).padStart(2, '0');
                    const dg = datesGroup[dateStr];
                    datesTreeHtml += `<tr><td class="col-date">${dayNum} ${dayStr}</td><td class="col-duration">${formatDuration(dg.ms)}</td><td class="col-content">${buildDotLines(dg.bullets)}</td></tr>`;
                });
                datesTreeHtml += '</table>';
            } else {
                datesTreeHtml = '<div class="log-detail-empty">해당 조건에 기록된 업무가 없습니다.</div>';
            }

            const isDone = job.status === 'completed';
            const isAdmin = job.status === 'admin';

            let datesRowHtml;
            if (isAdmin) {
                datesRowHtml = `<div class="job-panel-dates"><span class="badge-admin">상시 진행</span></div>`;
            } else {
                datesRowHtml = `
                    <div class="job-panel-dates">
                        <strong>시작</strong> ${job.startDate || '-'}
                        <span class="sep">·</span>
                        <strong>완료</strong> ${job.endDate || '-'}
                    </div>`;
            }

            c.innerHTML += `
                <div class="job-panel">
                    <div class="flex-between job-panel-head">
                        <div class="job-panel-main">
                            <button class="btn-text icon-btn-circle" onclick="toggleWeeklyExpand(${job.id})">
                                ${isExpanded ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>'}
                            </button>

                            <div class="job-panel-info job-panel-info--half">
                                <div class="job-panel-title">${escapeHtml(job.opsName)}</div>
                                <div class="truncate-line">
                                    ${renderOpTaskMeta(job.opsCode, job.taskName, job.taskCode)}
                                </div>
                                ${datesRowHtml}
                            </div>
                        </div>
                        <div class="job-panel-actions">
                            <span class="job-panel-total">
                                총 ${formatDuration(totalMs)}
                            </span>
                            ${isAdmin ? '' : `<button class="status-toggle-btn ${isDone ? 'completed' : 'active'}" onclick="toggleStatus(${job.id})">${isDone ? '완료' : '진행중'}</button>`}
                        </div>
                    </div>

                    <div class="job-panel-body ${isExpanded ? '' : 'is-collapsed'}">
                        ${datesTreeHtml}
                    </div>
                </div>`;
        });

        if (renderedCount === 0) {
            c.innerHTML = '<div class="empty-state">해당 조건에 기록된 운영이 없습니다.</div>';
        }
    }
