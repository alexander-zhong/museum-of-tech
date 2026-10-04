// Shared game-feel state: FOV kick that any system can add to,
// decayed and applied by the PlayerController each frame.
export const feel = {
  fovKick: 0,
};

export function addFovKick(amount: number) {
  feel.fovKick = Math.min(6, feel.fovKick + amount);
}
