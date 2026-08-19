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
                const durationStr = formatDurationByUnit(row.durationMs, 'timer');

                treeHtml += `
                    <div class="log-tree-node">
                        <div class="log-node-main">
                            <span class="log-node-time">${row.startTime}-${row.endTime}</span>
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
                            ${formatDurationByUnit(totalMs, 'timer')}
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
