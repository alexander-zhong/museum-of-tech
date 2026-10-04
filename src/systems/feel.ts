// Shared game-feel state: FOV kick that any system can add to,
// decayed and applied by the PlayerController each frame.
export const feel = {
  fovKick: 0,
  fovZoom: 0, // negative while scoped (AWP right-click)
  // fed by PlayerController each frame; read by the third-person avatar
  avatarMoving: false,
  avatarSpeed: 0,
};

// set by PlayerController; lets UI buttons re-enter pointer lock and
// lets the combat system move the player on respawn
export const session = {
  lock: () => {},
  teleport: (_x: number, _z: number) => {},
};

export function addFovKick(amount: number) {
  feel.fovKick = Math.min(6, feel.fovKick + amount);
}
