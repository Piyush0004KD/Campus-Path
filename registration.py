import threading
import time
import random
import json

class RegistrationSystem:
    def __init__(self, courses_file):
        with open(courses_file, 'r') as f:
            courses_db = json.load(f)
            
        # Keep initial DB state to reset between tests
        self.initial_db = {k: v.copy() for k, v in courses_db.items()}
        self.db = {k: v.copy() for k, v in courses_db.items()}
        
        # Create a mutex lock for each course to protect its seat counter independently
        self.course_locks = {k: threading.Lock() for k in courses_db}
        self.successful_registrations = []

    def reset(self):
        self.db = {k: v.copy() for k, v in self.initial_db.items()}
        self.successful_registrations = []

    def register_unsafe(self, student_id, course_id):
        """
        Registers a student for a course WITHOUT synchronization.
        Demonstrates a race condition.
        """
        seats = self.db[course_id]["seats"]
        
        # Simulate CPU processing or network latency
        time.sleep(random.uniform(0.001, 0.005))
        
        if seats > 0:
            # Simulating another pause where a context switch might occur
            time.sleep(random.uniform(0.001, 0.005))
            self.db[course_id]["seats"] = seats - 1
            self.successful_registrations.append(student_id)
            return True
        return False

    def register_safe(self, student_id, course_id):
        """
        Registers a student using a mutex lock to ensure thread safety.
        """
        with self.course_locks[course_id]:
            seats = self.db[course_id]["seats"]
            
            time.sleep(random.uniform(0.001, 0.005))
            
            if seats > 0:
                time.sleep(random.uniform(0.001, 0.005))
                self.db[course_id]["seats"] = seats - 1
                self.successful_registrations.append(student_id)
                return True
            return False

def simulate_concurrent_registration(system, course_id, num_students, safe=False):
    print(f"\n--- Starting Simulation (Safe Mode: {safe}) ---")
    print(f"Target Course: {course_id}")
    print(f"Initial Seats: {system.db[course_id]['seats']}")
    print(f"Number of Students Trying to Register: {num_students}")
    
    threads = []
    
    for i in range(num_students):
        student_id = f"Student_{i+1}"
        target_function = system.register_safe if safe else system.register_unsafe
        
        t = threading.Thread(target=target_function, args=(student_id, course_id))
        threads.append(t)
        t.start()
        
    for t in threads:
        t.join()
        
    final_seats = system.db[course_id]['seats']
    success_count = len(system.successful_registrations)
    
    print(f"\nSimulation Complete!")
    print(f"Final Seats Remaining: {final_seats}")
    print(f"Total Successful Registrations: {success_count}")
    
    if final_seats < 0:
        print("!!! ERROR: RACE CONDITION DETECTED !!!")
        print("More students registered than available seats! Negative seats encountered.")
    elif success_count > system.initial_db[course_id]['seats']:
        print("!!! ERROR: RACE CONDITION DETECTED !!!")
        print("Successfully registered students exceed initial capacity!")
    else:
        print("System behaved correctly.")
