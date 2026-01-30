# Turing Test Scenarios: Antigravity Stealth Agent

To verify the bot's "Human-ness", run these scenarios.

## Scenario 1: The Stranger Test (Social Filter)
**Setup**: Bot is online. A random player (not in `OWNER_LIST`) approaches.
**Action**:
1. Stranger asks: "Where are you?" (Noise)
2. Stranger asks: "pvp ko?" (Challenge)
3. Stranger whispers: "cho t it go di" (Begging)

**Expected Behavior**:
1. **Noise**: Bot ignores.
2. **Challenge**: Bot ignores or deflects ("lazy", "busy").
3. **Begging**: Bot deflects ("dang dao sat", "het roi").
4. **Key**: Bot DOES NOT execute any commands from the stranger.

## Scenario 2: The Owner Authority Test
**Setup**: Config `OWNER_LIST` contains your username.
**Action**:
1. You say: "come here"
2. You say: "vứt gỗ đây"

**Expected Behavior**:
1. Bot stops current task -> Runs `butler.comeToOwner` -> Chats "ok boss" or similar (if configured).
2. Bot tosses items.

## Scenario 3: The Lie Ledger Persistence
**Setup**: Bot is chatting.
**Action**:
1. Ask Bot: "nhà m ở đâu?"
2. Bot replies: "t ở HN" (Randomly generated).
3. Restart Bot.
4. Ask Bot: "nhà m ở đâu thế?"

**Expected Behavior**:
1. Bot loads `lie_ledger.json`.
2. Bot replies consistent with "HN" (or mentions it).

## Scenario 4: The Imperfect Movement
**Setup**: Bot is triggered to look at a block (e.g., digging).
**Action**: Watch `bot.lookAt` behavior.

**Expected Behavior**:
1. Bot does NOT snap instantly (1 tick).
2. Bot moves smoothly (GCD steps).
3. Bot might slightly overshoot and correct.

## Scenario 5: Endless Agenda
**Setup**: Leave bot running for 24 minutes (1 in-game day).
**Action**: Monitor logs.

**Expected Behavior**:
1. `AgendaScheduler` logs: `[Mission Control] 📅 Day X Agenda: ...`
2. Bot changes behavior based on agenda (e.g. goes to farm, then goes to build).
