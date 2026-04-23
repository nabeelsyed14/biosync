/**
 * Gamification System
 * Handles XP, Leveling, and Badge Unlocks
 */
class GamificationSystem {
    constructor() {
        this.xp = 0;
        this.level = 1;
        this.xpForNextLevel = 100;
        
        // Define Badges
        this.badges = {
            'first_log': { name: 'First Logger', icon: 'fa-shield', unlocked: false },
            'streaker': { name: 'Activity Streaker', icon: 'fa-fire', unlocked: false },
            'zen': { name: 'Zen Master', icon: 'fa-leaf', unlocked: false }
        };

        this.listeners = [];
    }

    subscribe(callback) {
        this.listeners.push(callback);
        this.notify();
    }

    notify() {
        for(let cb of this.listeners) {
            cb({
                xp: this.xp,
                level: this.level,
                xpNext: this.xpForNextLevel,
                badges: this.badges
            });
        }
    }

    awardXP(amount, reason) {
        this.xp += amount;
        
        window.utils.showXPToast(amount, reason);
        
        this.checkLevelUp();
        this.notify();
    }

    checkLevelUp() {
        if (this.xp >= this.xpForNextLevel) {
            this.level++;
            // Calculate remaining xp and set new threshold
            this.xp = this.xp - this.xpForNextLevel;
            this.xpForNextLevel = Math.floor(this.xpForNextLevel * 1.5);
            
            window.utils.showXPToast(0, `Level Up! Now Level ${this.level}`);
        }
    }

    unlockBadge(badgeId) {
        if(this.badges[badgeId] && !this.badges[badgeId].unlocked) {
            this.badges[badgeId].unlocked = true;
            window.utils.showXPToast(50, `Badge Unlocked: ${this.badges[badgeId].name}`);
            this.awardXP(50, 'Badge Bonus'); // Base award handles notification
            
            // Broadcast a DOM event so specific UI components can catch it
            const event = new CustomEvent('badgeUnlocked', { detail: badgeId });
            document.dispatchEvent(event);
        }
    }
}

// Attach universally
window.gamification = new GamificationSystem();
