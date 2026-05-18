const fs = require('fs');

// A simple Async Mutex to simulate thread locking in Node's event loop
class AsyncMutex {
    constructor() {
        this.locked = false;
        this.queue = [];
    }

    async acquire() {
        return new Promise(resolve => {
            if (!this.locked) {
                this.locked = true;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    release() {
        if (this.queue.length > 0) {
            const resolve = this.queue.shift();
            resolve();
        } else {
            this.locked = false;
        }
    }
}

class RegistrationSystem {
    constructor(coursesFile) {
        const data = fs.readFileSync(coursesFile, 'utf-8');
        const coursesDb = JSON.parse(data);
        
        this.initialDb = JSON.parse(JSON.stringify(coursesDb));
        this.db = JSON.parse(JSON.stringify(coursesDb));
        
        this.courseLocks = {};
        for (const course in coursesDb) {
            this.courseLocks[course] = new AsyncMutex();
        }
        
        this.successfulRegistrations = [];
    }

    reset() {
        this.db = JSON.parse(JSON.stringify(this.initialDb));
        this.successfulRegistrations = [];
    }

    // A helper to simulate DB latency / CPU time that causes async race conditions
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async registerUnsafe(studentId, courseId) {
        const seats = this.db[courseId].seats;
        
        // Simulating async gap where other event loop ticks can interleave
        await this.delay(Math.random() * 5 + 1);
        
        if (seats > 0) {
            await this.delay(Math.random() * 5 + 1);
            this.db[courseId].seats = seats - 1;
            this.successfulRegistrations.push(studentId);
            return true;
        }
        return false;
    }

    async registerSafe(studentId, courseId) {
        const lock = this.courseLocks[courseId];
        await lock.acquire(); // Atomic lock check
        
        try {
            const seats = this.db[courseId].seats;
            
            await this.delay(Math.random() * 5 + 1);
            
            if (seats > 0) {
                await this.delay(Math.random() * 5 + 1);
                this.db[courseId].seats = seats - 1;
                this.successfulRegistrations.push(studentId);
                return true;
            }
            return false;
        } finally {
            lock.release();
        }
    }
}

async function simulateConcurrentRegistration(system, courseId, numStudents, safe = false) {
    const promises = [];
    
    for (let i = 0; i < numStudents; i++) {
        const studentId = `Student_${i+1}`;
        if (safe) {
            promises.push(system.registerSafe(studentId, courseId));
        } else {
            promises.push(system.registerUnsafe(studentId, courseId));
        }
    }
    
    await Promise.all(promises);
}

module.exports = { RegistrationSystem, simulateConcurrentRegistration };
