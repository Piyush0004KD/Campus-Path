const fs = require('fs');

class CycleDetectedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CycleDetectedError';
    }
}

class CoursePlanner {
    constructor(configPath) {
        this.configPath = configPath;
        this.courses = {};
        this.graph = {};
        this.completedCourses = new Set();
    }

    loadCourses() {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        this.courses = JSON.parse(data);
    }

    setCompletedCourses(completedList) {
        this.completedCourses = new Set(completedList);
    }

    buildGraph() {
        this.graph = {};
        for (const course in this.courses) {
            this.graph[course] = [];
        }
        
        for (const [courseId, details] of Object.entries(this.courses)) {
            const prereqs = details.prereqs || [];
            for (const prereq of prereqs) {
                if (!this.graph[prereq]) {
                    this.graph[prereq] = [];
                }
                this.graph[prereq].push(courseId);
            }
        }
    }

    topologicalSort(includeCompleted = false) {
        const visited = new Set();
        const recStack = new Set();
        const stack = [];
        
        const dfs = (node) => {
            visited.add(node);
            recStack.add(node);
            
            const neighbors = this.graph[node] || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    dfs(neighbor);
                } else if (recStack.has(neighbor)) {
                    throw new CycleDetectedError(`Cycle detected involving courses: ${node} and ${neighbor}`);
                }
            }
            
            recStack.delete(node);
            stack.push(node);
        };
        
        for (const course in this.courses) {
            if (!visited.has(course)) {
                dfs(course);
            }
        }
        
        const topologicalOrder = stack.reverse();
        if (includeCompleted) {
            return topologicalOrder;
        }
        return topologicalOrder.filter(c => !this.completedCourses.has(c));
    }

    generateSemesterLayout(sortedCourses, maxCredits = 15) {
        const semesters = [];
        const completionTime = {};
        
        for (const course of sortedCourses) {
            const credits = this.courses[course].credits;
            const prereqs = this.courses[course].prereqs;
            
            let earliestPossibleSem = 0;
            for (const p of prereqs) {
                if (p in completionTime) {
                    earliestPossibleSem = Math.max(earliestPossibleSem, completionTime[p] + 1);
                }
            }
            
            let targetSem = earliestPossibleSem;
            
            while (true) {
                while (semesters.length <= targetSem) {
                    semesters.push({ courses: [], credits: 0 });
                }
                
                const plannedCredits = semesters[targetSem].plannedCredits || 0;
                if (plannedCredits + credits <= maxCredits) {
                    semesters[targetSem].plannedCredits = plannedCredits + credits;
                    if (!this.completedCourses.has(course)) {
                        semesters[targetSem].courses.push(course);
                        semesters[targetSem].credits += credits;
                    }
                    completionTime[course] = targetSem;
                    break;
                } else {
                    targetSem++;
                }
            }
        }
        
        return semesters;
    }
}

module.exports = { CoursePlanner, CycleDetectedError };
