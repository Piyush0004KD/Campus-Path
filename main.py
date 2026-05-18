import sys
import json
from planner import CoursePlanner, CycleDetectedError
from registration import RegistrationSystem, simulate_concurrent_registration

CONFIG_FILE = "courses.json"

def display_sequence(courses, db):
    print("\n--- Valid Course Sequence ---")
    for i, course_id in enumerate(courses, 1):
        name = db[course_id]['name']
        print(f"{i}. {course_id} - {name}")

def print_menu():
    print("\n" + "="*55)
    print("CampusPath: Smart Course Prerequisite Planner")
    print("="*55)
    print("1. Show Valid Course Sequence (Topological Sort)")
    print("2. Generate Semester Layout (Default: 15 cr/sem)")
    print("3. Personalized Plan (Input Completed Courses)")
    print("4. Test Cycle Detection (Inject a Cycle manually)")
    print("5. Run Concurrency Demo (Race Condition vs. Safe)")
    print("6. Exit")
    print("="*55)

def main():
    planner = CoursePlanner(CONFIG_FILE)
    try:
        planner.load_courses()
    except FileNotFoundError:
        print(f"Error: {CONFIG_FILE} not found!")
        sys.exit(1)
        
    while True:
        print_menu()
        choice = input("Enter your choice (1-6): ").strip()
        
        if choice == '1':
            planner.set_completed_courses([])
            planner.build_graph()
            try:
                sorted_courses = planner.topological_sort()
                display_sequence(sorted_courses, planner.courses)
            except CycleDetectedError as e:
                print(f"\n[!] ERROR: {e}")
                
        elif choice == '2':
            planner.set_completed_courses([])
            planner.build_graph()
            try:
                sorted_courses = planner.topological_sort()
                semesters = planner.generate_semester_layout(sorted_courses, max_credits=15)
                
                print("\n--- Semester-by-Semester Layout ---")
                for i, sem in enumerate(semesters, 1):
                    print(f"\nSemester {i} (Total Credits: {sem['credits']}):")
                    for c in sem['courses']:
                        name = planner.courses[c]['name']
                        credits = planner.courses[c]['credits']
                        print(f"  - {c}: {name} ({credits} credits)")
            except CycleDetectedError as e:
                print(f"\n[!] ERROR: {e}")
                
        elif choice == '3':
            completed = input("Enter completed course IDs separated by comma (e.g. CS101,MATH101): ").strip()
            completed_list = [c.strip() for c in completed.split(",") if c.strip()]
            
            planner.set_completed_courses(completed_list)
            planner.build_graph()
            try:
                sorted_courses = planner.topological_sort()
                print("\n--- Remaining Courses Sequence ---")
                if not sorted_courses:
                    print("You have completed all courses or the remaining courses list is empty.")
                else:
                    display_sequence(sorted_courses, planner.courses)
                    
                # Bonus: show semester layout for remaining
                semesters = planner.generate_semester_layout(sorted_courses, max_credits=15)
                print("\n--- Remaining Semester Layout ---")
                for i, sem in enumerate(semesters, 1):
                    # Only print non-empty semesters (some might be empty if prereqs push things back)
                    if sem['courses']:
                        print(f"\nSemester {i} (Total Credits: {sem['credits']}):")
                        for c in sem['courses']:
                            name = planner.courses[c]['name']
                            credits = planner.courses[c]['credits']
                            print(f"  - {c}: {name} ({credits} credits)")
                            
            except CycleDetectedError as e:
                print(f"\n[!] ERROR: {e}")
                
        elif choice == '4':
            print("\nInjecting a cyclic dependency: CS101 -> CS102 -> CS101")
            # Create a temporary cyclic planner
            cyclic_planner = CoursePlanner(CONFIG_FILE)
            cyclic_planner.load_courses()
            # Inject cycle
            cyclic_planner.courses["CS101"]["prereqs"].append("CS102")
            cyclic_planner.build_graph()
            
            try:
                print("Running Topological Sort...")
                cyclic_planner.topological_sort()
                print("Sort completed successfully (This shouldn't happen with a cycle!)")
            except CycleDetectedError as e:
                print(f"\n[✓] Cycle Detection Working!\nException caught: {e}")
                
        elif choice == '5':
            reg_system = RegistrationSystem(CONFIG_FILE)
            
            # Use CS409 as target, it has 10 seats originally. Let's send 50 students.
            target = "CS409"
            students = 50
            
            print("\n--- Test 1: UNSAFE (No Synchronization) ---")
            reg_system.reset()
            simulate_concurrent_registration(reg_system, target, students, safe=False)
            
            print("\n" + "-"*40)
            
            print("\n--- Test 2: SAFE (With Mutex Lock) ---")
            reg_system.reset()
            simulate_concurrent_registration(reg_system, target, students, safe=True)
            
        elif choice == '6':
            print("Exiting CampusPath Planner. Goodbye!")
            sys.exit(0)
            
        else:
            print("Invalid choice. Please enter a number between 1 and 6.")

if __name__ == "__main__":
    main()
