// task-manager.js (Phiên bản 7.0 - Clean Architecture)

class TaskManager {
    constructor(botCore) {
        this.botCore = botCore;
        this.taskQueue = [];
        this.activeTask = null;
        this.state = 'idle';
        this.currentStepIndex = 0;
        this.shouldStop = false;
        this.persistentActions = new Set(['follow_player', 'attack_target']);
        this.persistentTaskInterval = null;
        this.failedAttempts = []; // Track failed actions to prevent infinite loops
    }

    get isBusy() { return this.state !== 'idle'; }

    addTask(plan, username) {
        this.taskQueue.push({ plan, username });
        this._processQueue();
    }

    async _processQueue() {
        if (this.isBusy || this.taskQueue.length === 0) return;

        const { plan, username } = this.taskQueue.shift();
        this.activeTask = { ...plan, username };
        this.currentStepIndex = 0;
        this.shouldStop = false;
        this.state = 'busy';

        if (plan.steps.length > 0) console.log(`[TaskManager] ok bat dau lam: "${plan.complex_task}".`);

        while (this.currentStepIndex < this.activeTask.steps.length && !this.shouldStop) {
            const step = this.activeTask.steps[this.currentStepIndex];

            let success = false;
            let attempts = 0;
            // Cho phép retry tối đa 3 lần cho robust hơn
            while (attempts < 3 && !success && !this.shouldStop) {
                try {
                    await this._executeStep(step);
                    success = true;
                } catch (error) {
                    attempts++;
                    console.warn(`[TaskManager] Bước '${step.action}' thất bại lần ${attempts}: ${error.message}`);

                    if (attempts < 3) {
                        console.log(`[TaskManager] dm lag the nhi... thu lai phat nua (${attempts}/3)`);
                        await new Promise(resolve => setTimeout(resolve, 2000 * attempts)); // Backoff delay
                    } else {
                        // Record this failure to prevent AI from suggesting same action
                        this.failedAttempts.push({
                            action: step.action,
                            params: JSON.stringify(step.params || {}),
                            error: error.message,
                            timestamp: Date.now()
                        });

                        // Retry failed 3 times, let's ask AI for help
                        console.log(`[TaskManager] cay vcl, bi ket o cho '${step.action}'. de hoi thg @AI xem sao...`);
                        try {
                            // Get recent failures (last 60 seconds) to send to AI
                            const recentFailures = this.failedAttempts
                                .filter(f => Date.now() - f.timestamp < 60000)
                                .map(f => `${f.action}: ${f.error}`);

                            const context = {
                                ...this.botCore.buildContext(this.activeTask.username),
                                failed_attempts: recentFailures,
                                forbidden_actions: recentFailures.map(f => f.split(':')[0].trim())
                            };

                            const repairPlan = await this.botCore.aiLayer.createCorrectionPlan(
                                this.activeTask, step, error.message, context
                            );

                            if (repairPlan && repairPlan.steps.length > 0) {
                                console.log(`[TaskManager] ok ngon, thay cach fix roi: ${repairPlan.complex_task}`);

                                // Insert repair steps before the current failed step
                                this.activeTask.steps.splice(this.currentStepIndex, 0, ...repairPlan.steps);

                                // Decrement index so next loop iteration executes the first new step
                                this.currentStepIndex--;
                                success = true; // Pretend success to continue loop
                            } else {
                                throw new Error("AI chịu chết.");
                            }
                        } catch (aiError) {
                            this.shouldStop = true;
                            console.error(`[TaskManager] thoi bo me roi, ko sua duoc: ${aiError.message}`);
                        }
                    }
                }
            }

            if (!success) break;

            const isPersistent = step.is_persistent || this.persistentActions.has(step.action);
            if (isPersistent && !this.shouldStop) {
                this.startPersistentTaskMonitoring(step.action);
                while (!this.shouldStop) {
                    await new Promise(resolve => setTimeout(resolve, 250));
                }
            }

            if (!this.shouldStop) {
                this.currentStepIndex++;
            }
        }

        if (!this.shouldStop && this.activeTask) {
            console.log(`[TaskManager] xong roi nhe, ez game: "${this.activeTask.complex_task}"`);
        }

        this.cleanupAfterTask();
        if (!this.shouldStop && this.taskQueue.length > 0) this._processQueue();
    }

    async _executeStep(step) {
        if (!this.botCore.bot) throw new Error("Bot is not ready.");

        console.log(`[TaskManager] Executing step ${this.currentStepIndex + 1}/${this.activeTask.steps.length}: ${step.action} ${JSON.stringify(step.params || {})}`);

        // Legacy Mapping Removed - All actions should now be standard
        // if (step.action === 'flattenArea') step.action = 'flatten_area';

        // Dynamic Action Routing (3-Layer Architecture)
        // Priority: Coordinator (Tier 3) -> Behaviors (Tier 2) -> Primitives (Tier 1)

        const action = step.action;
        const params = step.params || {};

        // SMART PARAMS (Auto-Fill)
        // If critical params are missing, try to fill from context
        if (action === 'look_at_player' && !params.name) {
            const nearest = this.botCore.bot.nearestEntity(e => e.type === 'player');
            if (nearest) params.name = nearest.username;
        }

        if (action === 'remember_location' && !params.name) {
            params.name = `loc_${Date.now()}`;
        }

        // 1. Check Coordinator (Tier 3 - REMOVED/MERGED)
        // logic moved to behaviors

        // 2. Check Behaviors (Tier 2 - Player Actions)
        if (typeof this.botCore.behaviors[action] === 'function') {
            // Execute behavior and check standardized result
            const result = await this.botCore.behaviors[action](...Object.values(params));

            // Behaviors now return { success, message, data } - validate result
            if (result && typeof result === 'object' && 'success' in result) {
                if (!result.success) {
                    throw new Error(result.message || `Action ${action} failed`);
                }
                console.log(`[TaskManager] ${action}: ${result.message}`);
            }
            return;
        }

        // 3. Check Primitives (Tier 1 - Muscles)
        if (typeof this.botCore.primitives[action] === 'function') {
            await this.botCore.primitives[action](...Object.values(params));
            return;
        }

        throw new Error(`Unknown action: ${action} (Not found in Coordinator, Behaviors, or Primitives)`);
    }

    startPersistentTaskMonitoring(action) {
        // Xóa interval cũ nếu có
        if (this.persistentTaskInterval) clearInterval(this.persistentTaskInterval);
        const bot = this.botCore.bot;

        // Thiết lập một interval mới để kiểm tra trạng thái
        this.persistentTaskInterval = setInterval(() => {
            let stopConditionMet = false;

            if (action === 'attack_target') {
                const currentTarget = bot.pvp.target;
                if (!currentTarget || currentTarget.health === 0 || !currentTarget.isValid) {
                    console.log("[TaskManager] Mục tiêu đã bị tiêu diệt hoặc biến mất.");
                    stopConditionMet = true;
                }
            }

            if (action === 'follow_player') {
                // Giả sử GoalFollow sẽ tự dừng nếu mất mục tiêu,
                // ở đây chúng ta chỉ dựa vào lệnh !stop
            }

            // Nếu điều kiện dừng được đáp ứng hoặc có lệnh từ bên ngoài
            if (stopConditionMet || this.shouldStop) {
                this.stopCurrentTask();
            }
        }, 500); // Kiểm tra mỗi nửa giây
    }

    cleanupAfterTask() {
        if (this.persistentTaskInterval) {
            clearInterval(this.persistentTaskInterval);
            this.persistentTaskInterval = null;
        }
        this.activeTask = null;
        this.state = 'idle';
    }

    stopCurrentTask() {
        if (!this.isBusy && this.taskQueue.length === 0) {
            this.botCore.say("Không có nhiệm vụ nào để dừng.");
            return;
        }

        if (this.state !== 'idle') {
            this.botCore.say("Đã nhận lệnh dừng! Hủy tất cả nhiệm vụ.");
        }

        this.taskQueue = [];
        this.shouldStop = true;

        const bot = this.botCore.bot;
        if (bot) {
            bot.pathfinder.stop();
            if (bot.pvp && bot.pvp.target) bot.pvp.stop();
            if (bot.collectBlock && bot.collectBlock.isCollecting) bot.collectBlock.stop();
            bot.clearControlStates();
        }

        // Dọn dẹp ngay lập tức
        this.cleanupAfterTask();
    }
}

module.exports = TaskManager;