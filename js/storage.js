    function initData() { 
        if (!localStorage.getItem(STORAGE_KEY_PRESETS)) localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(defaultPresets)); 
        purgeExpiredDeletedPresets();
    }

    function purgeExpiredDeletedPresets() {
        const presets = getPresets();
        const now = Date.now();
        const limitMs = DELETED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
        const remaining = presets.filter(p => {
            if (p.status !== 'deleted' || !p.deletedAt) return true;
            return (now - new Date(p.deletedAt).getTime()) < limitMs;
        });
        if (remaining.length !== presets.length) {
            const removedIds = presets.filter(p => !remaining.includes(p)).map(p => p.id);
            localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(remaining));
            if (removedIds.length) {
                const h = getHistory().filter(x => !removedIds.includes(x.jobId));
                localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(h));
            }
        }
    }

    function getPresets() { return JSON.parse(localStorage.getItem(STORAGE_KEY_PRESETS)) || []; }
    function getHistory() { return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)) || []; }

    function createHistoryObject(job, sObj, eObj, bullets) {
        const st = sObj.toTimeString().substring(0, 5); const en = eObj.toTimeString().substring(0, 5);
        return {
            id: Date.now() + Math.floor(Math.random() * 1000), 
            jobId: job.id, opsCode: job.opsCode, opsName: job.opsName, taskCode: job.taskCode, taskName: job.taskName,
            bullets: bullets, date: sObj.toISOString().split('T')[0],
            startTimeObj: sObj.toISOString(), endTimeObj: eObj.toISOString(),
            startTime: st, endTime: en, durationMs: eObj - sObj
        };
    }

    function insertLogWithLunchCheck(job, sObj, eObj, bullets) {
        const dateStr = sObj.toISOString().split('T')[0];
        let history = getHistory();

        let newS = sObj.getTime();
        let newE = eObj.getTime();

        // Keep merging with any touching/overlapping same-operation entry, and re-check after each
        // merge — the newly combined range may now also reach a further entry (e.g. filling the gap
        // between two existing blocks should collapse all three into one, not just the nearer one).
        let mergedBullets = [];
        let mergedWithExisting = false;
        let mergedAny = true;
        while (mergedAny) {
            mergedAny = false;
            for (let i = 0; i < history.length; i++) {
                const l = history[i];
                if (l.date !== dateStr || l.jobId !== job.id) continue;
                const lS = new Date(l.startTimeObj || `${l.date}T${l.startTime}:00`).getTime();
                const lE = new Date(l.endTimeObj || `${l.date}T${l.endTime}:00`).getTime();

                if (Math.max(newS, lS) <= Math.min(newE, lE) + 60000) {
                    newS = Math.min(newS, lS);
                    newE = Math.max(newE, lE);
                    if (l.bullets && l.bullets.length) mergedBullets = [...mergedBullets, ...l.bullets];
                    history.splice(i, 1);
                    mergedWithExisting = true;
                    mergedAny = true;
                    break;
                }
            }
        }

        if (mergedWithExisting) {
            if (bullets && bullets.length > 0) mergedBullets = [...mergedBullets, ...bullets];
            history.unshift(createHistoryObject(job, new Date(newS), new Date(newE), mergedBullets));
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
            return true;
        }

        const lStart = new Date(sObj); const [lh, lm] = appSettings.lunchStart.split(':').map(Number); lStart.setHours(lh, lm, 0, 0);
        const lEnd = new Date(sObj); const [leh, lem] = appSettings.lunchEnd.split(':').map(Number); lEnd.setHours(leh, lem, 0, 0);

        let intervals = [{ s: newS, e: newE }];
        let blockedRanges = [];
        if (lEnd > lStart) blockedRanges.push({ s: lStart.getTime(), e: lEnd.getTime() });

        const otherLogs = history.filter(h => h.date === dateStr && h.jobId !== job.id);
        otherLogs.forEach(l => {
            const s = new Date(l.startTimeObj || `${l.date}T${l.startTime}:00`).getTime();
            const e = new Date(l.endTimeObj || `${l.date}T${l.endTime}:00`).getTime();
            blockedRanges.push({ s, e });
        });

        blockedRanges.forEach(b => {
            let newIntervals = [];
            intervals.forEach(inv => {
                if (inv.e <= b.s || inv.s >= b.e) {
                    newIntervals.push(inv);
                } else {
                    if (inv.s < b.s) newIntervals.push({ s: inv.s, e: b.s });
                    if (inv.e > b.e) newIntervals.push({ s: b.e, e: inv.e });
                }
            });
            intervals = newIntervals;
        });

        if (intervals.length === 0) return false;

        intervals.sort((a, b) => a.s - b.s).forEach(inv => {
            const s = new Date(inv.s);
            const e = new Date(inv.e);
            history.unshift(createHistoryObject(job, s, e, bullets));
        });

        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
        return true;
    }

    function deleteHistory(id) { if(confirm('해당 기록을 삭제할까요?')) { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(getHistory().filter(i => i.id !== id))); renderAll(); } }
