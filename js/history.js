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
                            <div class="mt-xs truncate-line">
                                ${renderOpTaskMeta(group.opsCode, group.taskName, group.taskCode)}
                            </div>
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

        const history = getHistory(); const idx = history.findIndex(h => h.id === id);
        if (idx === -1) return;
        const item = history[idx];

        const hasConflict = history.some(h => h.id !== id && h.date === item.date &&
            !(timeToMins(e) <= timeToMins(h.startTime) || timeToMins(s) >= timeToMins(h.endTime)));
        if (hasConflict && !confirm('선택한 시간대가 다른 기록과 겹칩니다. 계속 저장하시겠습니까?')) return;

        const sObj = new Date(`${item.date}T${s}:00`);
        const eObj = new Date(`${item.date}T${e}:00`);
        item.startTime = s; item.endTime = e;
        item.startTimeObj = sObj.toISOString(); item.endTimeObj = eObj.toISOString();
        item.durationMs = eObj - sObj;

        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
        closeModal('editLogTimeModal');
        renderAll();
    }
