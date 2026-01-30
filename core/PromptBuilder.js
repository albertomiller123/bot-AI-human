class PromptBuilder {
    constructor(identity) {
        this.identity = identity || "You are an AI Gamer. Style: Toxic but Pro.";
        this.state = {};
        this.memory = "";
        this.goal = "";
        this.tools = "";
    }

    setState(state) {
        this.state = state;
        return this;
    }

    setMemory(memory) {
        this.memory = memory;
        return this;
    }

    setGoal(goal) {
        this.goal = goal;
        return this;
    }

    setTools(tools) {
        this.tools = tools;
        return this;
    }

    build() {
        let prompt = `<identity>\n${this.identity}\n</identity>\n\n`;

        if (Object.keys(this.state).length > 0) {
            prompt += `<current_state>\n${this._formatState(this.state)}\n</current_state>\n\n`;
        }

        if (this.state.memories && Array.isArray(this.state.memories)) {
            const memoryString = this.state.memories
                .slice(0, 5) // Critical Optimization: Limit to 5
                .map(m => `- ${m.text} (${Math.round(m.score * 100)}%)`)
                .join('\n');
            prompt += `<context_memory>\n${memoryString}\n</context_memory>\n\n`;
        } else if (this.memory) {
            prompt += `<context_memory>\n${this.memory}\n</context_memory>\n\n`;
        }

        if (this.goal) {
            prompt += `<goal>\n${this.goal}\n</goal>\n\n`;
        }

        if (this.tools) {
            prompt += `<available_tools>\n${this.tools}\n</available_tools>\n\n`;
        }

        return prompt;
    }

    _formatState(state) {
        return Object.entries(state)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
    }
}

module.exports = PromptBuilder;
