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
            .map(([key, value]) => {
                let formattedValue = value;

                // Handle Arrays (like chat history) -> Keep last 10
                if (Array.isArray(value)) {
                    if (value.length > 10) {
                        const dropped = value.length - 10;
                        formattedValue = `[...${dropped} older items...]\n` + value.slice(-10).map(v => JSON.stringify(v)).join('\n');
                    } else {
                        formattedValue = value.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join('\n');
                    }
                }
                // Handle Objects -> JSON stringify
                else if (typeof value === 'object' && value !== null) {
                    formattedValue = JSON.stringify(value);
                }

                // Truncate Long Strings
                const strValue = String(formattedValue);
                if (strValue.length > 2000) {
                    return `${key}: ${strValue.substring(0, 2000)}... [TRUNCATED ${strValue.length - 2000} chars]`;
                }

                return `${key}: ${strValue}`;
            })
            .join('\n');
    }
}

module.exports = PromptBuilder;
