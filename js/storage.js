    function initData() { 
        if (!localStorage.getItem(STORAGE_KEY_PRESETS)) savePresets(defaultPresets);
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
        if (remaining.length === presets.length) return;
        const removedIds = presets.filter(p => !remaining.includes(p)).map(p => p.id);
        savePresets(remaining);
        saveHistory(getHistory().filter(x => !removedIds.includes(x.jobId)));
    }

    function getPresets() { return JSON.parse(localStorage.getItem(STORAGE_KEY_PRESETS)) || []; }
    function getHistory() { return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)) || []; }
    function savePresets(presets) { localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets)); }
    function saveHistory(history) { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history)); }

    // 기록의 시작·끝 시각(ms). 예전 기록은 *Obj가 없을 수 있어 날짜+시각으로 대신 계산한다.
    function logStartMs(h) { return new Date(h.startTimeObj || `${h.date}T${h.startTime}:00`).getTime(); }
    function logEndMs(h) { return new Date(h.endTimeObj || `${h.date}T${h.endTime}:00`).getTime(); }

    function createHistoryObject(job, sObj, eObj, bullets) {
        return {
            id: Date.now() + Math.floor(Math.random() * 1000),
            jobId: job.id, opsCode: job.opsCode, opsName: job.opsName, taskCode: job.taskCode, taskName: job.taskName,
            // 날짜는 그 지역 기준 (toISOString()은 UTC라 한국 시간 오전 9시 전 기록이 전날로 들어갔음)
            bullets: bullets, date: dateToIso(sObj),
            startTimeObj: sObj.toISOString(), endTimeObj: eObj.toISOString(),
            startTime: dateToHHMM(sObj), endTime: dateToHHMM(eObj), durationMs: eObj - sObj
        };
    }

    // 같은 날 같은 운영의 기록 중 [s, e]와 겹치거나 1분 이내로 붙은 것을 모두 history에서 빼고,
    // 넓어진 구간과 그 기록들의 메모를 돌려준다. 합친 결과가 또 다른 기록에 닿을 수 있어 더 없을 때까지 반복한다.
    function absorbSameJobLogs(history, { date, jobId, exceptId }, s, e) {
        const bullets = [];
        for (let merged = true; merged;) {
            merged = false;
            const i = history.findIndex(h => h.id !== exceptId && h.date === date && h.jobId === jobId
                && Math.max(s, logStartMs(h)) <= Math.min(e, logEndMs(h)) + 60000);
            if (i === -1) break;
            const h = history[i];
            s = Math.min(s, logStartMs(h)); e = Math.max(e, logEndMs(h));
            if (h.bullets && h.bullets.length) bullets.push(...h.bullets);
            history.splice(i, 1);
            merged = true;
        }
        return { s, e, bullets };
    }

    // 새 기록을 넣는다. 같은 운영의 붙어 있는 기록과는 하나로 합치고,
    // 점심시간과 다른 운영의 기록이 있는 구간은 빼고 남은 조각만 저장한다. 남는 게 없으면 false.
    function insertLogWithLunchCheck(job, sObj, eObj, bullets) {
        const dateStr = dateToIso(sObj);
        const history = getHistory();
        const merged = absorbSameJobLogs(history, { date: dateStr, jobId: job.id }, sObj.getTime(), eObj.getTime());
        const allBullets = [...merged.bullets, ...(bullets || [])];

        const lStart = new Date(sObj); const [lh, lm] = appSettings.lunchStart.split(':').map(Number); lStart.setHours(lh, lm, 0, 0);
        const lEnd = new Date(sObj); const [leh, lem] = appSettings.lunchEnd.split(':').map(Number); lEnd.setHours(leh, lem, 0, 0);
        const blocked = history.filter(h => h.date === dateStr && h.jobId !== job.id).map(h => ({ s: logStartMs(h), e: logEndMs(h) }));
        if (lEnd > lStart) blocked.push({ s: lStart.getTime(), e: lEnd.getTime() });

        let pieces = [{ s: merged.s, e: merged.e }];
        blocked.forEach(b => {
            pieces = pieces.flatMap(p => {
                if (p.e <= b.s || p.s >= b.e) return [p];
                return [p.s < b.s && { s: p.s, e: b.s }, p.e > b.e && { s: b.e, e: p.e }].filter(Boolean);
            });
        });
        if (!pieces.length) return false;

        pieces.sort((a, b) => a.s - b.s).forEach(p => history.unshift(createHistoryObject(job, new Date(p.s), new Date(p.e), allBullets)));
        saveHistory(history);
        return true;
    }

    function deleteHistory(id) {
        if (!confirm('해당 기록을 삭제할까요?')) return;
        saveHistory(getHistory().filter(i => i.id !== id));
        renderAll();
    }
