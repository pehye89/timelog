    function openModal(id) { document.getElementById(id).classList.add('open'); }
    function closeModal(id) { document.getElementById(id).classList.remove('open'); }

    function saveManualAddModal() {
        const jobId = parseInt(document.getElementById('manualAddJob').value, 10); const date = document.getElementById('manualAddDate').value;
        const start = document.getElementById('manualAddStart').value; const end = document.getElementById('manualAddEnd').value;
        
        if(!jobId || !date || !start || !end) return alert('모든 항목을 입력해주세요.');
        if(start >= end) return alert('종료 시간은 시작 시간보다 늦어야 합니다.');

        const job = getPresets().find(p => p.id === jobId); if(!job) return;

        const sObj = new Date(`${date}T${start}:00`); const eObj = new Date(`${date}T${end}:00`);
        const bullets = manualAddBulletEditor.getBullets();
        
        const success = insertLogWithLunchCheck(job, sObj, eObj, bullets);
        if(!success) alert("선택된 시간에 타 운영 기록이 있거나 점심시간에 포함되어 제외되었습니다.");
        
        closeModal('manualAddModal'); renderAll();
    }
