    document.addEventListener("DOMContentLoaded", () => {
        initData(); goToToday(); loadSettings();
        sessionBulletEditor = createBulletEditor(document.getElementById('sessionBullets'), {
            placeholder: '지금 하는 일을 기록하세요',
            onChange: autoSaveSessionBullets
        });
        manualAddBulletEditor = createBulletEditor(document.getElementById('manualAddBullets'), {
            placeholder: '무엇을 했는지 입력하세요'
        });
        restoreTrackerFilterCheckboxes();
        renderAll(); checkActiveTimer();
        refreshMgmtSortIndicator(); refreshTrackerFilterIndicator();
        document.addEventListener('mouseup', endPaint);
        document.addEventListener('mouseup', () => endErase());
        runAppOpenAutoBackup();
        startDriveScheduledBackupWatcher();
        setInterval(updateNowLine, 30000);
        window.addEventListener('resize', updateNowLine);
    });

    function switchTab(tab) { 
        ['Tracker', 'Management', 'Timelog', 'Weekly'].forEach(t => { 
            document.getElementById(`tab${t}View`).classList.add('hidden'); 
            document.getElementById(`tabBtn${t}`).classList.remove('active'); 
        }); 
        document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}View`).classList.remove('hidden'); 
        document.getElementById(`tabBtn${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active'); 
        if(tab === 'weekly') { currentWeekDate = new Date(document.getElementById('hiddenDateInput').value); }
        // 시간로그 탭은 타이머 탭에서 보던 날짜로 열린다 (주간보고 탭과 같은 방식)
        if(tab === 'timelog') { setTimelogDate(new Date(`${document.getElementById('hiddenDateInput').value}T00:00:00`)); }
        renderAll(); 
    }

    function renderAll() { renderTodoList(); renderHistory(); renderManagement(); renderTimelogTab(); renderWeekly(); }
