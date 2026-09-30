    // Render Timer Log History in Clean Timeline Style
    function renderHistory() {
        const selectedDate = document.getElementById('hiddenDateInput').value;
        const dayHistory = getHistory().filter(item => item.date === selectedDate);
        renderGridTimeline(dayHistory);

        const container = document.getElementById('historyContainer');
        if(!container) return;
        container.innerHTML = '';

        if (dayHistory.length === 0) {
            container.innerHTML = `<div class="empty-state empty-state--compact">작성된 타임로그가 없습니다.</div>`;
            return;
        }

        const presetsMap = {};
        getPresets().forEach(p => { presetsMap[p.id] = p; });

        const grouped = {};
        dayHistory.forEach(item => {
            if (!grouped[item.jobId]) {
                grouped[item.jobId] = {
                    jobId: item.jobId,
                    opsCode: item.opsCode,
                    opsName: item.opsName,
                    taskCode: item.taskCode,
                    taskName: item.taskName,
                    logs: []
                };
            }
            grouped[item.jobId].logs.push(item);
        });

        Object.values(grouped).forEach(group => {
            group.logs.sort((a, b) => a.startTime.localeCompare(b.startTime));
            const totalMs = group.logs.reduce((sum, l) => sum + (l.durationMs || 0), 0);
            const job = presetsMap[group.jobId];
            const datesRowHtml = (job && job.status !== 'admin')
                ? `<div class="job-panel-dates"><strong>시작</strong> ${job.startDate || '-'}<span class="sep">·</span><strong>완료</strong> ${job.endDate || '-'}</div>`
                : '';

            let treeHtml = '<div class="log-tree">';
            group.logs.forEach(row => {
                const bulletsHtml = (row.bullets && row.bullets.length > 0)
                    ? buildDotLines(row.bullets)
                    : '';
                const durationStr = formatDuration(row.durationMs);

                treeHtml += `
                    <div class="log-tree-node">
                        <div class="log-node-main">
                            <span class="log-node-time" onclick="openEditLogTime(${row.id})" title="클릭하여 시간 수정">${row.startTime}-${row.endTime}</span>
                            <span class="log-node-duration">${durationStr}</span>
                            <div class="editable-content log-node-content" onclick="makeEditable(${row.id}, this)">${bulletsHtml}</div>
                        </div>
                        <button class="btn-text log-node-delete" onclick="deleteHistory(${row.id})">삭제</button>
                    </div>`;
            });
            treeHtml += '</div>';

            container.innerHTML += `
                <div class="log-card">
                    <div class="flex-between log-card-head">
                        <div class="job-panel-info">
                            <div class="log-card-title truncate-line">${escapeHtml(group.opsName)}</div>
                            <div class="truncate-line">
                                ${renderOpTaskMeta(group.opsCode, group.taskName, group.taskCode)}
                            </div>
                            ${datesRowHtml}
                        </div>
                        <div class="log-card-total">
                            ${formatDuration(totalMs)}
                        </div>
                    </div>
                    ${treeHtml}
                </div>`;
        });
    }

    function saveEditableBullets(id, bullets) {
        const history = getHistory(); const idx = history.findIndex(h => h.id === id);
        if(idx > -1) { history[idx].bullets = bullets; localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history)); }
    }

    function makeEditable(id, cell) {
        if (cell.querySelector('.bullet-editor')) return;
        const item = getHistory().find(h => h.id === id); if (!item) return;

        cell.innerHTML = '';
        cell.onclick = (e) => e.stopPropagation();

        const editor = createBulletEditor(cell, {
            initialBullets: item.bullets || [],
            onChange: (bullets) => saveEditableBullets(id, bullets)
        });

        cell.addEventListener('focusout', () => {
            setTimeout(() => {
                if (!cell.contains(document.activeElement)) renderAll();
            }, 0);
        });

        editor.focus();
    }

    // ---- Inline time-range editing for a timelog entry ----
    function openEditLogTime(id) {
        const item = getHistory().find(h => h.id === id); if (!item) return;
        document.getElementById('editLogTimeId').value = id;
        document.getElementById('editLogTimeDateLabel').innerText = item.date;
        document.getElementById('editLogTimeStart').value = item.startTime;
        document.getElementById('editLogTimeEnd').value = item.endTime;
        updateEditLogTimeDuration();
        openModal('editLogTimeModal');
    }

    function updateEditLogTimeDuration() {
        const s = document.getElementById('editLogTimeStart').value;
        const e = document.getElementById('editLogTimeEnd').value;
        const el = document.getElementById('editLogTimeDurationText');
        if (!s || !e) { el.innerText = '-'; el.classList.remove('text-error'); return; }
        const diff = timeToMins(e) - timeToMins(s);
        if (diff <= 0) {
            el.innerText = '종료 시간은 시작 시간보다 늦어야 합니다';
            el.classList.add('text-error');
            return;
        }
        el.classList.remove('text-error');
        el.innerText = `총 ${diff}분`;
    }

    function deleteFromEditLogTimeModal() {
        const id = parseInt(document.getElementById('editLogTimeId').value, 10);
        if (!id) return;
        if (!confirm('해당 기록을 삭제할까요?')) return;
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(getHistory().filter(i => i.id !== id)));
        closeModal('editLogTimeModal');
        renderAll();
    }

    function saveEditLogTime() {
        const id = parseInt(document.getElementById('editLogTimeId').value, 10);
        const s = document.getElementById('editLogTimeStart').value;
        const e = document.getElementById('editLogTimeEnd').value;
        if (!s || !e) return alert('시간을 입력해주세요.');
        if (timeToMins(e) <= timeToMins(s)) return alert('종료 시간은 시작 시간보다 늦어야 합니다.');

        let history = getHistory();
        const idx = history.findIndex(h => h.id === id);
        if (idx === -1) return;
        const item = history[idx];

        let newS = new Date(`${item.date}T${s}:00`).getTime();
        let newE = new Date(`${item.date}T${e}:00`).getTime();

        // Merge with any other record of the SAME operation that now overlaps or touches
        // (gap <= 1 min) the edited time range, combining their time span and bullets.
        let mergedBullets = item.bullets || [];
        let mergedAny = true;
        while (mergedAny) {
            mergedAny = false;
            for (let i = 0; i < history.length; i++) {
                const h = history[i];
                if (h.id === id || h.date !== item.date || h.jobId !== item.jobId) continue;
                const hS = new Date(h.startTimeObj || `${h.date}T${h.startTime}:00`).getTime();
                const hE = new Date(h.endTimeObj || `${h.date}T${h.endTime}:00`).getTime();
                if (Math.max(newS, hS) <= Math.min(newE, hE) + 60000) {
                    newS = Math.min(newS, hS);
                    newE = Math.max(newE, hE);
                    if (h.bullets && h.bullets.length) mergedBullets = [...mergedBullets, ...h.bullets];
                    history.splice(i, 1);
                    mergedAny = true;
                    break;
                }
            }
        }

        // A different operation's record can still legitimately conflict — warn but allow.
        const hasCrossJobConflict = history.some(h => h.id !== id && h.date === item.date && h.jobId !== item.jobId &&
            !(newE <= new Date(h.startTimeObj || `${h.date}T${h.startTime}:00`).getTime() ||
              newS >= new Date(h.endTimeObj || `${h.date}T${h.endTime}:00`).getTime()));
        if (hasCrossJobConflict && !confirm('선택한 시간대가 다른 운영의 기록과 겹칩니다. 계속 저장하시겠습니까?')) return;

        const finalIdx = history.findIndex(h => h.id === id);
        const sObj = new Date(newS); const eObj = new Date(newE);
        history[finalIdx].startTime = sObj.toTimeString().substring(0, 5);
        history[finalIdx].endTime = eObj.toTimeString().substring(0, 5);
        history[finalIdx].startTimeObj = sObj.toISOString();
        history[finalIdx].endTimeObj = eObj.toISOString();
        history[finalIdx].durationMs = newE - newS;
        history[finalIdx].bullets = mergedBullets;

        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
        closeModal('editLogTimeModal');
        renderAll();
    }


    // ---- 시간로그: 선택한 날짜의 기록을 운영별로 묶어 표로 조회 (셀마다 호버 복사) ----
    const TIMELOG_TABLE_COLUMNS = [
        { key: 'taskCode', label: '작업번호', cls: 'col-code' },
        { key: 'taskName', label: '작업명', cls: 'col-name' },
        { key: 'opsCode', label: '운영번호', cls: 'col-code' },
        { key: 'opsName', label: '운영명', cls: 'col-name' },
        { key: 'minutes', label: '총 시간 (분)', cls: 'col-num', copyable: false },
        { key: 'endDate', label: '완료일자', cls: 'col-date', copyable: false },
        { key: 'memo', label: '메모', cls: 'col-memo', sortable: false }
    ];

    function buildTimeLogTableRows(dateStr) {
        const dayHistory = getHistory()
            .filter(h => h.date === dateStr)
            .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        const presetsMap = {};
        getPresets().forEach(p => { presetsMap[p.id] = p; });

        // 운영별로 합산 — 행 순서는 그날 처음 기록을 시작한 시각 순
        const byJob = new Map();
        dayHistory.forEach(h => {
            if (!byJob.has(h.jobId)) {
                const job = presetsMap[h.jobId] || h; // 운영 정보는 최신 값 우선, 없으면 기록 당시 값
                byJob.set(h.jobId, { taskCode: job.taskCode || '', taskName: job.taskName || '', opsCode: job.opsCode || '', opsName: job.opsName || '', endDate: (presetsMap[h.jobId] && presetsMap[h.jobId].endDate) || '', ms: 0, bullets: [] });
            }
            const row = byJob.get(h.jobId);
            row.ms += h.durationMs || 0;
            if (Array.isArray(h.bullets)) row.bullets.push(...h.bullets);
        });
        return [...byJob.values()].map(r => ({
            taskCode: r.taskCode, taskName: r.taskName, opsCode: r.opsCode, opsName: r.opsName,
            minutes: String(Math.round(r.ms / 60000)),
            endDate: r.endDate,
            memo: formatMemoPlainText(r.bullets)
        }));
    }

    function openTimeLogTable() {
        renderTimeLogTable();
        openModal('timeLogTableModal');
    }

    // 칼럼명 클릭 정렬: 오름차순 → 내림차순 → 기본(운영번호 오름차순)으로 순환. 탭과 팝업이 같은 정렬을 공유한다.
    let timelogTableSort = { key: null, dir: 'asc' };

    function sortTimeLogRows(rows) {
        const { dir } = timelogTableSort;
        // 사용자가 고른 정렬이 없으면 기본값: 운영번호 오름차순 (정렬 표시는 띄우지 않음)
        const key = timelogTableSort.key || 'opsCode';
        const num = key === 'minutes';
        const sorted = [...rows].sort((a, b) => {
            const va = a[key] || '', vb = b[key] || '';
            if (!va !== !vb) return va ? -1 : 1; // 빈 값은 방향과 관계없이 항상 아래로
            return num ? Number(va) - Number(vb) : va.localeCompare(vb, 'ko', { numeric: true });
        });
        if (dir === 'desc') {
            const filled = sorted.filter(r => r[key]).reverse();
            return filled.concat(sorted.filter(r => !r[key]));
        }
        return sorted;
    }

    function toggleTimeLogSort(key) {
        if (timelogTableSort.key !== key) timelogTableSort = { key, dir: 'asc' };
        else if (timelogTableSort.dir === 'asc') timelogTableSort.dir = 'desc';
        else timelogTableSort = { key: null, dir: 'asc' };
        renderTimelogTab();
        if (document.getElementById('timeLogTableModal').classList.contains('open')) renderTimeLogTable();
    }

    // 팝업(타이머 탭)과 시간로그 탭이 함께 쓰는 표 렌더러. 요약 문구에 쓸 총 분을 반환한다.
    function renderTimeLogTableInto(container, dateStr) {
        const rows = sortTimeLogRows(buildTimeLogTableRows(dateStr));
        const totalMins = rows.reduce((sum, r) => sum + Number(r.minutes), 0);
        container.innerHTML = '';
        if (!rows.length) {
            container.innerHTML = '<div class="empty-state empty-state--compact">이 날짜에 기록된 시간이 없습니다.</div>';
            return { rows, totalMins };
        }

        const table = document.createElement('table');
        table.className = 'timelog-table';
        const thead = table.createTHead().insertRow();
        TIMELOG_TABLE_COLUMNS.forEach(col => {
            const th = document.createElement('th');
            th.className = col.cls;
            th.textContent = col.label;
            if (col.sortable !== false) {
                th.classList.add('sortable');
                th.title = '클릭해서 정렬';
                // 사용자가 직접 정렬한 칼럼에만 ▲/▼ 표시
                if (timelogTableSort.key === col.key) {
                    const mark = document.createElement('span');
                    mark.className = 'th-sort-mark active';
                    mark.textContent = timelogTableSort.dir === 'asc' ? '▲' : '▼';
                    th.appendChild(mark);
                }
                th.onclick = () => toggleTimeLogSort(col.key);
            }
            thead.appendChild(th);
        });
        const tbody = table.createTBody();
        rows.forEach(row => {
            const tr = tbody.insertRow();
            TIMELOG_TABLE_COLUMNS.forEach(col => {
                const td = tr.insertCell();
                td.className = col.cls;
                const value = row[col.key];
                const text = document.createElement('div');
                text.className = 'timelog-cell-text';
                text.textContent = value || '-';
                td.appendChild(text);
                if (value && col.copyable !== false) td.appendChild(createCellCopyButton(value));
                else td.classList.add('no-copy');
            });
        });
        container.appendChild(table);
        return { rows, totalMins };
    }

    function renderTimeLogTable() {
        const dateStr = document.getElementById('hiddenDateInput').value;
        const { rows, totalMins } = renderTimeLogTableInto(document.getElementById('timeLogTableContainer'), dateStr);
        document.getElementById('timeLogTableSub').textContent = `${dateStr.replace(/-/g, '.')} · 총 ${totalMins}분`;
        document.getElementById('timeLogTableCopyAllBtn').disabled = rows.length === 0;
    }

    const COPY_ICON_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    const CHECK_ICON_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

    function createCellCopyButton(value) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cell-copy-btn';
        btn.title = '복사';
        btn.innerHTML = COPY_ICON_SVG;
        btn.onclick = (e) => {
            e.stopPropagation();
            copyTextToClipboard(value).then(() => {
                btn.innerHTML = CHECK_ICON_SVG;
                btn.classList.add('copied');
                setTimeout(() => { btn.innerHTML = COPY_ICON_SVG; btn.classList.remove('copied'); }, 1200);
                showToast('복사되었습니다');
            }).catch(() => showToast('복사하지 못했습니다'));
        };
        return btn;
    }

    // 표 전체를 탭 구분(TSV)으로 복사 — 엑셀·구글 시트에 붙여넣으면 칸이 그대로 나뉜다.
    // 여러 줄 메모는 큰따옴표로 감싸 한 칸 안에 들어가도록 한다.
    function copyTimeLogTable(dateStr) {
        const rows = sortTimeLogRows(buildTimeLogTableRows(dateStr || document.getElementById('hiddenDateInput').value));
        if (!rows.length) return;
        const cell = v => /[\t\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        const lines = [TIMELOG_TABLE_COLUMNS.map(c => c.label).join('\t')]
            .concat(rows.map(r => TIMELOG_TABLE_COLUMNS.map(c => cell(r[c.key] || '')).join('\t')));
        copyTextToClipboard(lines.join('\n'))
            .then(() => showToast('표 전체를 복사했습니다'))
            .catch(() => showToast('복사하지 못했습니다'));
    }
