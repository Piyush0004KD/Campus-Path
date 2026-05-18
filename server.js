const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { CoursePlanner, CycleDetectedError } = require('./planner');
const { RegistrationSystem, simulateConcurrentRegistration } = require('./registration');

const app = express();
const port = process.env.PORT || 3001;
const CONFIG_FILE = 'courses.json';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'super_secret_node_key',
    resave: false,
    saveUninitialized: false
}));

app.post('/api/login', (req, res) => {
    const studentId = req.body.student_id;
    if (studentId) {
        req.session.studentId = studentId;
        return res.json({ success: true });
    }
    res.status(400).json({ success: false, error: 'Student ID is required' });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/me', (req, res) => {
    if (req.session.studentId) {
        return res.json({ loggedIn: true, studentId: req.session.studentId });
    }
    res.json({ loggedIn: false });
});

app.get('/api/courses', (req, res) => {
    try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/plan', (req, res) => {
    const completed = req.body.completed || [];
    
    const planner = new CoursePlanner(CONFIG_FILE);
    try {
        planner.loadCourses();
        planner.setCompletedCourses(completed);
        planner.buildGraph();
        
        const sortedCourses = planner.topologicalSort(true);
        const semesters = planner.generateSemesterLayout(sortedCourses, 15);
        
        const semData = semesters.map(sem => {
            const semCourses = sem.courses.map(c => {
                return { ...planner.courses[c], id: c };
            });
            return {
                credits: sem.credits,
                courses: semCourses
            };
        });
        
        res.json({ success: true, semesters: semData });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/cycle_demo', (req, res) => {
    const planner = new CoursePlanner(CONFIG_FILE);
    try {
        planner.loadCourses();
        // Inject cycle manually for demo
        planner.courses["CS101"].prereqs.push("CS102");
        planner.buildGraph();
        
        planner.topologicalSort();
        res.json({ success: true, message: 'Sort completed (should not happen)' });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/register_demo', async (req, res) => {
    const safe = req.body.safe || false;
    const students = parseInt(req.body.students) || 50;
    const course = req.body.course || 'CS409';
    
    const regSystem = new RegistrationSystem(CONFIG_FILE);
    
    if (!regSystem.initialDb[course]) {
        return res.status(404).json({ error: 'Course not found' });
    }
    
    const initialSeats = regSystem.initialDb[course].seats;
    
    await simulateConcurrentRegistration(regSystem, course, students, safe);
    
    const finalSeats = regSystem.db[course].seats;
    const successCount = regSystem.successfulRegistrations.length;
    
    const isRaceCondition = finalSeats < 0 || successCount > initialSeats;
    
    res.json({
        initial_seats: initialSeats,
        final_seats: finalSeats,
        success_count: successCount,
        students_tried: students,
        is_race_condition: isRaceCondition,
        safe_mode: safe
    });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
