# Technical Spec: Stealth Agent Architecture

## 1. Executive Summary
The Stealth Agent is an upgrade to the existing Antigravity bot, focusing on *social deception* and *imperfect simulation*. It introduces a "Lie Ledger" to maintain narrative consistency and a "Selective Attention" system to mimic human social hierarchy.

## 2. Core Modules (New)

### 2.1 Social Brain v2 (`core/social/`)
- **`LieLedger.js`**:
  - Purpose: Tracks fabricated facts per player.
  - Storage: `data/social/lie_ledger.json`
  - Schema:
    ```json
    {
      "Player_Username": {
        "facts_told": ["I'm from Hanoi", "My dog's name is Rex"],
        "relationship_score": 0.5,
        "role": "stranger" // or "trusted", "owner"
      }
    }
    ```
- **`SocialFilter.js`**:
  - Middleware for `chat` events.
  - Logic:
    - If `sender` == `Owner` → `execute_command`.
    - If `sender` in `Trusted` → `chat_response` (High Priority).
    - If `mentioned` or `whispered` → `chat_response`.
    - Else → `ignore` OR `deflect` (10% chance to say "busy", "lag").

### 2.2 Humanized Input (`core/humanizer/`)
- **`GCDRotation.js`**:
  - Replaces `bot.lookAt`.
  - Implements mouse sensitivity logic (GCD - Greatest Common Divisor).
  - Adds "Overshoot" and "Correction" (aim past target, then snap back).
- **`ChatTypos.js`**:
  - Inject typos based on keyboard adjacency (press 's' instead of 'a').
  - Correct typos in subsequent messages ("helol" -> "*hello").

### 2.3 Mission Control (`behaviors/strategy/`)
- **`AgendaScheduler.js`**:
  - Replaces static goals.
  - Generates a "Daily Plan" based on in-game days.
  - Example: "Day 5: Focus on Wheat Farming. Avoid combat."

## 3. Database Design
- **`social_graph.json`**: Interaction history.
- **`lie_ledger.json`**: Narrative constraints.

## 4. Acceptance Criteria
- Bot ignores random players asking for math homework.
- Bot responds to Owner immediately.
- Bot maintains consistent backstory (Name, Age, Location) across 500 interactions.
- Movement looks natural (not locking onto heads instantly).
