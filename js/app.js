    document.addEventListener("DOMContentLoaded", () => {
        initData(); goToToday(); loadSettings();
        sessionBulletEditor = createBulletEditor(document.getElementById('sessionBullets'), {
            placeholder: '작업 내용을 메모하세요 (종료 시 자동 저장)',
            onChange: autoSaveSessionBullets
        });
        manualAddBulletEditor = createBulletEditor(document.getElementById('manualAddBullets'), {});
        renderAll(); checkActiveTimer();
        document.addEventListener('mouseup', endPaint);
    });

    function switchTab(tab) { 
        ['Tracker', 'Management', 'Weekly'].forEach(t => { 
            document.getElementById(`tab${t}View`).classList.add('hidden'); 
            document.getElementById(`tabBtn${t}`).classList.remove('active'); 
        }); 
        document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}View`).classList.remove('hidden'); 
        document.getElementById(`tabBtn${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active'); 
        if(tab === 'weekly') { currentWeekDate = new Date(document.getElementById('hiddenDateInput').value); }
        renderAll(); 
    }

    function renderAll() { renderTodoList(); renderHistory(); renderManagement(); renderWeekly(); }
