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

        // FIX: Global fail counter to prevent infinite correction loops
        this.globalFailCount = 0;
        this.MAX_GLOBAL_FAILS = 5; // Abort task after 5 total corrections fail
    }

    get isBusy() { return this.state !== 'idle'; }

    addTask(plan, username, isUrgent = false) {
        if (isUrgent) {
            console.log(`[TaskManager] ⚡ Urgent/Reflex task received! Clearing queue...`);
            this.taskQueue = []; // Clear pending strategies
            this.shouldStop = true; // Stop current strategy

            // Insert at front
            this.taskQueue.push({ plan, username });

            // If idle or effectively stopped, process immediately
            if (!this.isBusy || this.shouldStop) {
                // slight delay to allow active loop to break
                setTimeout(() => this._processQueue(), 100);
            }
        } else {
            this.taskQueue.push({ plan, username });
            this._processQueue();
        }
    }

    async _processQueue() {
        if (this.isBusy && !this.shouldStop) return; // Busy and not stopping
        if (this.taskQueue.length === 0) return;

        const taskItem = this.taskQueue.shift();
        const { plan, username } = taskItem;
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

                        // Fix Memory Leak: Cap failed attempts at 50
                        if (this.failedAttempts.length > 50) {
                            this.failedAttempts.shift();
                        }

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
                                if (repairPlan.steps.length > 0) {
                                    // FIX: Increment global counter and check limit
                                    this.globalFailCount++;

                                    if (this.globalFailCount >= this.MAX_GLOBAL_FAILS) {
                                        console.error(`[TaskManager] Task failed after ${this.MAX_GLOBAL_FAILS} correction attempts. Aborting.`);
                                        this.shouldStop = true;
                                        this.botCore.say("Loi qua nhieu, huy nhiem vu.");
                                        break;
                                    }

                                    this.activeTask.steps.splice(this.currentStepIndex, 0, ...repairPlan.steps);

                                    // Decrement index so next loop iteration executes the first new step
                                    this.currentStepIndex--;
                                    success = true; // Pretend success to continue loop
                                } else {
                                    console.warn("[TaskManager] AI returned empty repair plan.");
                                    attempts++; // Consider this a failed attempt still
                                }
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
                console.log(`[TaskManager] Starting persistent task: ${step.action}. Queue will process next items only if not blocked.`);
                this.startPersistentTaskMonitoring(step.action);
                // CRITICAL FIX: Removed blocking while-loop.
                // The task is "technically" done in terms of setup, but the background interval keeps it running.
                // We break here to allow the TaskManager to return to idle (or handle next queue items if designed for parallel).
                // For now, we assume single-threaded task execution, so this task remains "active" until stopCurrentTask is called.
                // However, blocking the thread prevents inputs.
                // Approach: We finish this *step* loop, but keeping the bot "busy" is handled by the overall state being 'busy' until explicitly stopped?
                // Actually, for "follow", we normally just want to set it and forget it until a stop command.

                // If we treat this as "Task Complete" (so state goes IDLE), users can issue new commands.
                // The persistent interval will keep running. A new task will execute in parallel (or override if it conflicts).
                break;
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

        // Legacy to Snake_Case Action Mapping (for backward compatibility)
        const actionMap = {
            'sayMessage': 'send_chat',
            'findAndCollect': 'gather_resource',
            'attackTarget': 'attack_target',
            'equipBestWeapon': 'equip_weapon',
            'equipBestArmor': 'equip_armor',
            'equipBestTool': 'equip_tool',
            'goToPosition': 'move_to',
            'craftItem': 'craft_item',
            'followPlayer': 'follow_player',
            'rememberLocation': 'remember_location',
            'listKnownLocations': 'list_locations',
            'stopActions': 'stop_and_wait',
            'eatUntilFull': 'eat_food',
            'placeBlockAt': 'place_block',
            'giveItemToPlayer': 'give_item',
            'flattenArea': 'flatten_area'
        };
        if (actionMap[step.action]) {
            console.log(`[TaskManager] Mapping legacy action '${step.action}' -> '${actionMap[step.action]}'`);
            step.action = actionMap[step.action];
        }

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

        // Release locks
        if (this.activeTask) {
            const lockSource = this.activeTask.type || 'strategy';
            this.botCore.actionLock?.release(lockSource);
        }

        this.activeTask = null;
        this.state = 'idle';
        // FIX: Reset global fail counter for next task
        this.globalFailCount = 0;

        if (!this.shouldStop && this.taskQueue.length > 0) this._processQueue();
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