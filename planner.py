import json

class CycleDetectedError(Exception):
    pass

class CoursePlanner:
    def __init__(self, config_path):
        self.config_path = config_path
        self.courses = {}
        self.graph = {}
        self.completed_courses = set()
        
    def load_courses(self):
        with open(self.config_path, 'r') as f:
            self.courses = json.load(f)
            
    def set_completed_courses(self, completed_list):
        self.completed_courses = set(completed_list)
        
    def build_graph(self):
        # We build a graph where edges are prerequisite -> course
        # i.e., A -> B means A must be taken before B.
        self.graph = {course_id: [] for course_id in self.courses}
        
        for course_id, details in self.courses.items():
            for prereq in details.get("prereqs", []):
                if prereq not in self.graph:
                    self.graph[prereq] = []
                self.graph[prereq].append(course_id)

    def topological_sort(self, include_completed=False):
        """
        DFS-based Topological Sort (Decrease and Conquer).
        Returns a valid sequence of remaining courses.
        Raises CycleDetectedError if the configuration is impossible.
        """
        visited = set()
        rec_stack = set()
        stack = []
        
        def dfs(node):
            visited.add(node)
            rec_stack.add(node)
            
            for neighbor in self.graph.get(node, []):
                if neighbor not in visited:
                    dfs(neighbor)
                elif neighbor in rec_stack:
                    raise CycleDetectedError(f"Cycle detected involving courses: {node} and {neighbor}")
                    
            rec_stack.remove(node)
            stack.append(node)
            
        for course in self.courses:
            if course not in visited:
                dfs(course)
                
        # The stack currently contains nodes in reverse topological order
        # Reverse it to get the correct order (prerequisites first)
        topological_order = stack[::-1]
        
        if include_completed:
            return topological_order
        
        # Filter out already completed courses
        remaining_courses = [c for c in topological_order if c not in self.completed_courses]
        return remaining_courses

    def generate_semester_layout(self, sorted_courses, max_credits=15):
        """
        Groups courses into semesters based on credit limits and prerequisites.
        Requires that courses are passed in a valid topological order.
        """
        semesters = []
        current_semester = []
        current_credits = 0
        
        # We need to ensure that we don't take a course in the same semester as its prereq
        # A simple way to do this is to keep track of what we're taking "this" semester
        
        # Keep the original full-plan semester positions, then hide completed courses.
        completion_time = {}
        
        for course in sorted_courses:
            credits = self.courses[course]["credits"]
            prereqs = self.courses[course]["prereqs"]
            
            # Find the earliest semester we can take this course
            earliest_possible_sem = 0
            for p in prereqs:
                if p in completion_time:
                    earliest_possible_sem = max(earliest_possible_sem, completion_time[p] + 1)
                else:
                    # If a prerequisite is somehow not scheduled yet, we can't schedule this course
                    # But since we iterate in topological order, this shouldn't happen.
                    pass
            
            # We want to place the course in `earliest_possible_sem` or later, depending on credits
            target_sem = earliest_possible_sem
            
            while True:
                # Ensure we have enough semesters created
                while len(semesters) <= target_sem:
                    semesters.append({"courses": [], "credits": 0})
                
                # Check if it fits in the target semester
                planned_credits = semesters[target_sem].get("planned_credits", 0)
                if planned_credits + credits <= max_credits:
                    semesters[target_sem]["planned_credits"] = planned_credits + credits
                    if course not in self.completed_courses:
                        semesters[target_sem]["courses"].append(course)
                        semesters[target_sem]["credits"] += credits
                    completion_time[course] = target_sem
                    break
                else:
                    target_sem += 1
                    
        return semesters
