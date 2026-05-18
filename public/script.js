document.addEventListener('DOMContentLoaded', async () => {
    // --- Auth Check ---
    try {
        const res = await fetch('/api/me');
        const data = await res.json();
        
        if (!data.loggedIn) {
            window.location.href = 'login.html';
            return;
        }
        
        // Update Header UI
        document.getElementById('student-id-display').textContent = data.studentId;
        document.getElementById('user-badge').style.display = 'inline';
        const btnLogout = document.getElementById('btn-logout');
        btnLogout.style.display = 'inline-block';
        
        btnLogout.addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = 'login.html';
        });
    } catch (e) {
        console.error("Auth check failed", e);
    }

    // --- Navigation ---
    const navPlanner = document.getElementById('nav-planner');
    const navConcurrency = document.getElementById('nav-concurrency');
    const secPlanner = document.getElementById('section-planner');
    const secConcurrency = document.getElementById('section-concurrency');

    navPlanner.addEventListener('click', () => {
        navPlanner.classList.add('active');
        navConcurrency.classList.remove('active');
        secPlanner.classList.remove('hidden-section');
        secPlanner.classList.add('active-section');
        secConcurrency.classList.remove('active-section');
        secConcurrency.classList.add('hidden-section');
    });

    navConcurrency.addEventListener('click', () => {
        navConcurrency.classList.add('active');
        navPlanner.classList.remove('active');
        secConcurrency.classList.remove('hidden-section');
        secConcurrency.classList.add('active-section');
        secPlanner.classList.remove('active-section');
        secPlanner.classList.add('hidden-section');
    });

    // --- Course Data Loading ---
    const courseListDiv = document.getElementById('course-list');
    let courseSemesterMap = {};
    let maxSemesterIndex = -1;

    function getCompletedCourses() {
        const checkboxes = document.querySelectorAll('.course-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    function updateCourseLocks() {
        const checkboxes = Array.from(document.querySelectorAll('.course-checkbox'));
        if (!checkboxes.length || maxSemesterIndex < 0) return;

        const currentSemester = [...Array(maxSemesterIndex + 1).keys()].find(semIndex => {
            return checkboxes.some(cb => courseSemesterMap[cb.value] === semIndex && !cb.checked);
        });

        checkboxes.forEach(checkbox => {
            const wrapper = checkbox.closest('.checkbox-wrapper');
            const semesterIndex = courseSemesterMap[checkbox.value];
            const isLocked = currentSemester !== undefined && semesterIndex > currentSemester;

            if (isLocked && checkbox.checked) {
                checkbox.checked = false;
            }

            checkbox.disabled = isLocked;
            wrapper.classList.toggle('locked', isLocked);
            wrapper.title = isLocked
                ? `Complete Semester ${currentSemester + 1} before marking this course.`
                : '';
        });
    }
    
    fetch('/api/courses')
        .then(response => response.json())
        .then(courses => {
            courseListDiv.innerHTML = '';
            for (const [id, details] of Object.entries(courses)) {
                const wrapper = document.createElement('label');
                wrapper.className = 'checkbox-wrapper';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = id;
                checkbox.className = 'course-checkbox';
                checkbox.addEventListener('change', updateCourseLocks);
                
                const text = document.createTextNode(` ${id} - ${details.name}`);
                
                wrapper.appendChild(checkbox);
                wrapper.appendChild(text);
                courseListDiv.appendChild(wrapper);
            }

            return fetch('/api/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: [] })
            });
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) return;

            data.semesters.forEach((sem, semIndex) => {
                sem.courses.forEach(course => {
                    courseSemesterMap[course.id] = semIndex;
                });
                maxSemesterIndex = Math.max(maxSemesterIndex, semIndex);
            });

            updateCourseLocks();
        })
        .catch(err => {
            courseListDiv.innerHTML = '<div class="alert error">Failed to load courses. Is the server running?</div>';
        });

    // --- Planner Actions ---
    const btnGenerate = document.getElementById('btn-generate');
    const btnCycle = document.getElementById('btn-cycle');
    const semContainer = document.getElementById('semester-container');
    const cycleAlert = document.getElementById('cycle-alert');

    function hideAlert() {
        cycleAlert.classList.add('hidden');
        cycleAlert.className = 'alert hidden';
        cycleAlert.textContent = '';
    }

    function showAlert(msg, isError = true) {
        cycleAlert.textContent = msg;
        cycleAlert.className = `alert ${isError ? 'error' : 'success'}`;
        cycleAlert.classList.remove('hidden');
    }

    btnGenerate.addEventListener('click', () => {
        hideAlert();
        
        // Get completed courses
        const completed = getCompletedCourses();
        
        // Add loading state
        const originalText = btnGenerate.innerHTML;
        btnGenerate.innerHTML = 'Generating...';
        btnGenerate.disabled = true;

        fetch('/api/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed })
        })
        .then(response => response.json())
        .then(data => {
            btnGenerate.innerHTML = originalText;
            btnGenerate.disabled = false;
            
            if (data.success) {
                renderSemesters(data.semesters);
            } else {
                showAlert(`Error: ${data.error}`);
            }
        })
        .catch(err => {
            btnGenerate.innerHTML = originalText;
            btnGenerate.disabled = false;
            showAlert('Failed to connect to the server.');
        });
    });

    btnCycle.addEventListener('click', () => {
        hideAlert();
        fetch('/api/cycle_demo', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (!data.success) {
                    showAlert(`✅ Cycle Detected Successfully: ${data.error}`, false);
                    semContainer.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon" style="color: var(--danger)">⚠️</div>
                            <p>Registration Blocked! The system successfully prevented generating a schedule with an impossible prerequisite loop.</p>
                        </div>
                    `;
                }
            });
    });

    function renderSemesters(semesters) {
        semContainer.innerHTML = '';
        
        if (semesters.length === 0) {
            semContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎉</div>
                    <p>You have completed all requirements! Nothing left to schedule.</p>
                </div>
            `;
            return;
        }

        let semCount = 1;
        semesters.forEach(sem => {
            if (sem.courses.length === 0) return; // Skip empty semesters
            
            const card = document.createElement('div');
            card.className = 'semester-card fade-in';
            
            let coursesHtml = sem.courses.map(c => `
                <div class="course-badge">
                    <div class="course-id">${c.id}</div>
                    <div class="course-name">${c.name}</div>
                </div>
            `).join('');

            card.innerHTML = `
                <div class="semester-header">
                    <h3>Semester ${semCount}</h3>
                    <div class="credit-badge">${sem.credits} / 15 Credits</div>
                </div>
                <div class="course-items">
                    ${coursesHtml}
                </div>
            `;
            
            semContainer.appendChild(card);
            semCount++;
        });
    }

    // --- Concurrency Actions ---
    const btnUnsafe = document.getElementById('btn-unsafe');
    const btnSafe = document.getElementById('btn-safe');
    const resultsPanel = document.getElementById('concurrency-results');

    function runConcurrencyDemo(safe) {
        resultsPanel.classList.add('hidden');
        resultsPanel.className = 'results-panel hidden';
        
        const btn = safe ? btnSafe : btnUnsafe;
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Running...';
        btn.disabled = true;
        
        // Disable both buttons during run
        btnUnsafe.disabled = true;
        btnSafe.disabled = true;

        fetch('/api/register_demo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ safe: safe, students: 50, course: 'CS409' })
        })
        .then(response => response.json())
        .then(data => {
            // Restore buttons
            btn.innerHTML = originalText;
            btnUnsafe.disabled = false;
            btnSafe.disabled = false;
            
            renderConcurrencyResults(data);
        });
    }

    function renderConcurrencyResults(data) {
        resultsPanel.innerHTML = `
            <div class="result-stat">
                <span>Initial Seats:</span>
                <span>${data.initial_seats}</span>
            </div>
            <div class="result-stat">
                <span>Students Attempting to Register:</span>
                <span>${data.students_tried}</span>
            </div>
            <div class="result-stat">
                <span>Successful Registrations:</span>
                <span style="color: ${data.is_race_condition ? 'var(--danger)' : 'var(--success)'}; font-weight: bold;">
                    ${data.success_count}
                </span>
            </div>
            <div class="result-stat">
                <span>Seats Remaining:</span>
                <span style="color: ${data.final_seats < 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: bold;">
                    ${data.final_seats}
                </span>
            </div>
            <div class="result-stat">
                <span>System Status:</span>
                <span style="color: ${data.is_race_condition ? 'var(--danger)' : 'var(--success)'}">
                    ${data.is_race_condition ? '❌ RACE CONDITION DETECTED (Data Corrupted)' : '✅ PROPERLY SYNCHRONIZED (Data Safe)'}
                </span>
            </div>
        `;
        
        resultsPanel.classList.remove('hidden');
        if (data.is_race_condition) {
            resultsPanel.classList.add('danger');
        } else {
            resultsPanel.classList.add('success');
        }
    }

    btnUnsafe.addEventListener('click', () => runConcurrencyDemo(false));
    btnSafe.addEventListener('click', () => runConcurrencyDemo(true));
});
