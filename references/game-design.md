# Pixel Idle Farm Game Design

## Product Shape

Working title: Sunrise Sprout Farm.

Audience: players who want a calm browser game that can be checked for 30 seconds, left alone, and revisited later. The game should feel useful immediately without tutorials, but it needs enough optimization depth for repeated sessions.

Platform: desktop and mobile browser. Default implementation should be a single static web app with no backend.

Core promise: every return to the farm creates one useful decision: harvest now, fulfill an order, buy an upgrade, unlock a new crop, or let automation continue.

## MVP Scope

- 12 farm plots in a 4x3 grid.
- 5 crops: wheat, carrot, tomato, strawberry, pumpkin.
- 3 resources: coins, XP, storage capacity.
- 1 market order board with 3 rotating orders.
- 5 upgrades: more plots, faster growth, better sell price, bigger storage, auto-harvest helper.
- Offline progress capped at 8 hours for MVP balance.
- localStorage save/load with manual reset for testing.

## Asset Gameplay Requirement

The project has generated terrain, animal/building, UI icon, and original character sheets. Production must turn these into gameplay and not leave them as unused files.

Read `references/asset-gameplay-integration.md` before building the next playable version. The minimum next milestone is:

- Terrain tiles affect placement, growth, access, or clearing rewards.
- Animals produce eggs, milk, wool, or honey through timestamp timers.
- Buildings unlock animals, storage, orders, or map utility.
- Miri Rowan's walking and farm-action sheets are tied to visible player actions.
- Orders consume at least one animal product after animals are unlocked.

For a broader interaction roadmap, read `references/gameplay-interactions-roadmap.md`. It defines tool modes, tile inspection, obstacle clearing, animal product loops, mixed orders, character animation hooks, and the recommended build order.

## Core Loop

1. Buy or select seed.
2. Plant crop on empty plot.
3. Wait for growth timer.
4. Harvest crop into storage.
5. Sell directly or fulfill market order.
6. Spend coins on upgrades.
7. Unlock new crop or automation.
8. Leave and return for offline progress.

The first session should produce a harvest in under 20 seconds. The second upgrade should be reachable in under 3 minutes. A new crop should unlock in under 8 minutes.

## Progression Table

| Tier | Unlock | Purpose |
|---|---|---|
| 1 | Wheat, 6 plots | Fast feedback and first coins |
| 2 | Carrot, order board | Introduce order optimization |
| 3 | Tomato, storage upgrade | Force storage planning |
| 4 | Strawberry, auto-harvest | Convert active play into idle play |
| 5 | Pumpkin, weather event | Longer offline target |
| 6 | Chicken coop, eggs | Add animal product orders |
| 7 | Barn, cow/sheep | Add longer idle product timers |
| 8 | Bee box, honey aura | Add map adjacency bonuses |

## Crop Baseline

| Crop | Grow seconds | Seed cost | Harvest | Direct sell | XP |
|---|---:|---:|---:|---:|---:|
| wheat | 15 | 1 | 2 | 1 | 1 |
| carrot | 45 | 4 | 3 | 3 | 3 |
| tomato | 120 | 12 | 4 | 8 | 8 |
| strawberry | 300 | 30 | 5 | 22 | 18 |
| pumpkin | 900 | 85 | 3 | 80 | 55 |

Direct sell is intentionally weaker than orders. Orders should pay 1.35x to 2.2x depending on specificity.

## Retention Mechanics

- Daily crate: gives seed bundles, not premium currency.
- Weather: rain speeds growth for 10 minutes; sunny day boosts sell prices.
- Helper bot: auto-harvests but does not auto-plant until upgraded.
- Order streak: fulfilling orders without trashing increases reward multiplier.
- Achievements: give permanent small boosts, never mandatory for normal progress.
- Map expansion: clear rocks/stumps/bushes to gain materials and unlock buildable land.
- Animal care: build homes, wait/feed, collect products, fulfill mixed crop/product orders.
- Tool interactions: hand, hoe, water, clear, build, and inspect modes make the same map support multiple decisions.

## UX Requirements

- Farm grid, resource bar, seed picker, order board, and upgrade button must be visible without page navigation on desktop.
- Mobile can use tabs, but planting and harvesting must stay one tap each after seed selection.
- Offline summary appears on return and lists harvested crops, full storage losses, and coins earned.
- All timers must show remaining time and ready state clearly.

## Anti-Patterns

- Do not make the first crop take minutes.
- Do not require clicking every plot forever after auto-harvest unlocks.
- Do not make offline progress invisible.
- Do not make the order board consume crops without confirmation.
- Do not hide important economy numbers behind hover-only UI.
