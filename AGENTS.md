
## Character animation quality requirements

- Never simulate walking, running, attacking, taking damage, or dying solely by translating, rotating, scaling, or bobbing one flat character image.
- Character locomotion must use frame-based sprite animation, skeletal animation, or separately articulated body parts.
- Walking must visibly change limb poses.
- Attacks must include anticipation, active impact, and recovery phases.
- Damage must occur on the impact frame or through an active hitbox, not immediately when the attack input is pressed.
- Enemies must play hurt and death reactions.
- Keep the physics root and collider separate from visual animation.
- Do not describe whole-sprite bobbing as a completed character animation.
- When animation assets are missing, report the missing assets and build a replaceable animation pipeline instead of faking completion.
