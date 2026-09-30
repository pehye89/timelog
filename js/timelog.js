    // ---- 시간로그 탭: 타이머 탭처럼 일자별로 넘기며 운영별 시간 표를 확인 (주말은 건너뜀) ----
    let timelogTabDate = '';

    function setTimelogDate(d) {
        timelogTabDate = dateToIso(d);
        document.getElementById('timelogDateInput').value = timelogTabDate;
        document.getElementById('timelogDateText').innerText = `${timelogTabDate.replace(/-/g, '.')} ${DAYS_EN[d.getDay()]}`;
        document.getElementById('todayBtnTimelog').classList.toggle('is-today', timelogTabDate === getTodayIso());
    }

    function skipWeekend(d, direction) {
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + direction);
        return d;
    }

    function changeTimelogDate(offset) {
        const d = new Date(`${timelogTabDate}T00:00:00`);
        d.setDate(d.getDate() + offset);
        setTimelogDate(skipWeekend(d, offset));
        renderTimelogTab();
    }

    function handleTimelogDateChange(val) {
        if (!val) return;
        const d = new Date(`${val}T00:00:00`);
        if (d.getDay() === 0 || d.getDay() === 6) alert('주말은 건너뜁니다.');
        setTimelogDate(skipWeekend(d, 1));
        renderTimelogTab();
    }

    function goToTimelogToday() {
        setTimelogDate(skipWeekend(new Date(), 1));
        renderTimelogTab();
    }

    function renderTimelogTab() {
        if (document.getElementById('tabTimelogView').classList.contains('hidden')) return;
        if (!timelogTabDate) setTimelogDate(skipWeekend(new Date(), 1));
        const { rows, totalMins } = renderTimeLogTableInto(document.getElementById('timelogTabContainer'), timelogTabDate);
        document.getElementById('timelogTabSub').textContent = rows.length ? `총 ${totalMins}분 · ${rows.length}개 운영` : '';
        document.getElementById('timelogTabCopyAllBtn').disabled = rows.length === 0;
    }
