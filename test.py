from planner import CoursePlanner, CycleDetectedError
from registration import RegistrationSystem, simulate_concurrent_registration

def test_planner():
    planner = CoursePlanner("courses.json")
    planner.load_courses()
    planner.build_graph()
    order = planner.topological_sort()
    print("Topological order:", order)
    
    sems = planner.generate_semester_layout(order, max_credits=15)
    print("Semesters:", sems)

def test_registration():
    reg = RegistrationSystem("courses.json")
    print("Unsafe:")
    simulate_concurrent_registration(reg, "CS409", 50, safe=False)
    print("Safe:")
    reg.reset()
    simulate_concurrent_registration(reg, "CS409", 50, safe=True)

if __name__ == '__main__':
    test_planner()
    test_registration()
