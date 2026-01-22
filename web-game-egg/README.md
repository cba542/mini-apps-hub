# Goose Egg Bounce Shooter (Web)

A lightweight browser game prototype where five fixed goose points charge up and fire bouncing eggs at rising monsters. The game is turn-based: monsters advance while charging, and they stop moving during aiming and egg flight.

## How to Run
- Open `index.html` in a modern browser.

## Controls
- Click **Start Game**.
- Hold the mouse button on the canvas to aim (dashed guide appears).
- Drag to adjust direction, release to fire.
- Only one firing point is active at a time; it must fully charge before firing.

## Gameplay Rules
- 3 waves per run, 5–15 monsters per wave.
- Monsters move upward while charging.
- Monsters stop during aiming and while eggs are in flight.
- Eggs bounce up to a configurable number of times.
- If any monster reaches the goose line, the game ends.

## Tuning Sliders
- Monster speed
- Charge speed multiplier
- Bounce count
- Collision damage
- Monster HP range

## Project Files
- `index.html` - UI and layout
- `style.css` - Visual style
- `script.js` - Game logic

## Notes
- No external dependencies; pure HTML/CSS/JS.
- This is a prototype focused on core gameplay flow.
