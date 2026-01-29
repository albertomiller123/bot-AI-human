# Minecraft AI Bot

An AI-powered Minecraft bot built with Mineflayer and OpenAI.

## Features
- **Dual-Brain AI**: High-level planning + Low-level reflexes
- **Survival Mode**: Eating, fighting, hiding
- **Web Interface**: Monitor bot status and chat via browser
- **Smart Pathfinding**: Uses `mineflayer-pathfinder`

## Setup

1. **Install Node.js** (v18+)
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Configure**:
   - Rename `config.example.json` to `config.json` (if applicable)
   - Or edit `config.json` directly with your server details and API keys.

## Running

Start the bot:
```bash
npm start
```

Access the Web UI at: `http://localhost:3000`

## Structure
- `bot-core.js`: Main bot logic and initialization
- `ai-layer.js`: AI planning module
- `behaviors.js`: High-level scripted behaviors
- `primitives.js`: Low-level physical actions
- `memory-manager.js`: SQLite database handler
