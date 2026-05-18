from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import json
from planner import CoursePlanner, CycleDetectedError
from registration import RegistrationSystem, simulate_concurrent_registration

app = Flask(__name__)
app.secret_key = 'super_secret_hackathon_key'
CONFIG_FILE = "courses.json"

@app.route('/')
def index():
    if 'student_id' not in session:
        return redirect(url_for('login'))
    return render_template('index.html', student_id=session['student_id'])

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        student_id = request.form.get('student_id')
        if student_id:
            session['student_id'] = student_id
            return redirect(url_for('index'))
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('student_id', None)
    return redirect(url_for('login'))

@app.route('/api/courses', methods=['GET'])
def get_courses():
    try:
        with open(CONFIG_FILE, 'r') as f:
            courses = json.load(f)
        return jsonify(courses)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/plan', methods=['POST'])
def generate_plan():
    data = request.json
    completed = data.get('completed', [])
    
    planner = CoursePlanner(CONFIG_FILE)
    try:
        planner.load_courses()
        planner.set_completed_courses(completed)
        planner.build_graph()
        sorted_courses = planner.topological_sort()
        semesters = planner.generate_semester_layout(sorted_courses, max_credits=15)
        
        # map courses to their details for the frontend
        sem_data = []
        for sem in semesters:
            sem_courses = []
            for c in sem['courses']:
                c_details = planner.courses[c].copy()
                c_details['id'] = c
                sem_courses.append(c_details)
            sem_data.append({
                'credits': sem['credits'],
                'courses': sem_courses
            })
            
        return jsonify({
            'success': True,
            'semesters': sem_data
        })
    except CycleDetectedError as e:
        return jsonify({'success': False, 'error': str(e)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/cycle_demo', methods=['POST'])
def cycle_demo():
    planner = CoursePlanner(CONFIG_FILE)
    planner.load_courses()
    # Inject cycle
    planner.courses["CS101"]["prereqs"].append("CS102")
    planner.build_graph()
    
    try:
        planner.topological_sort()
        return jsonify({'success': True, 'message': 'Sort completed (should not happen)'})
    except CycleDetectedError as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/register_demo', methods=['POST'])
def register_demo():
    data = request.json
    safe = data.get('safe', False)
    students = int(data.get('students', 50))
    target = data.get('course', 'CS409')
    
    reg_system = RegistrationSystem(CONFIG_FILE)
    
    if target not in reg_system.initial_db:
        return jsonify({'error': 'Course not found'}), 404
        
    initial_seats = reg_system.initial_db[target]['seats']
    
    simulate_concurrent_registration(reg_system, target, students, safe=safe)
    
    final_seats = reg_system.db[target]['seats']
    success_count = len(reg_system.successful_registrations)
    
    is_race_condition = final_seats < 0 or success_count > initial_seats
    
    return jsonify({
        'initial_seats': initial_seats,
        'final_seats': final_seats,
        'success_count': success_count,
        'students_tried': students,
        'is_race_condition': is_race_condition,
        'safe_mode': safe
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
