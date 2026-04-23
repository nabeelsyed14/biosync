/**
 * SyncEngine — Stub (No Simulated Data)
 * Real data comes from Health Connect via the Capgo Health plugin.
 * This file is kept to prevent undefined errors from other modules.
 */
class SyncEngine {
    constructor() {
        this.data = { steps: 0, sleep: 0, heartRate: 0 };
        this.listeners = [];
    }

    subscribe(callback) {
        this.listeners.push(callback);
        // Do NOT dispatch initial fake data
    }

    notifyListeners() {
        for (let cb of this.listeners) cb(this.data);
    }

    update(newData) {
        Object.assign(this.data, newData);
        this.notifyListeners();
    }
}

window.bioSyncEngine = new SyncEngine();
