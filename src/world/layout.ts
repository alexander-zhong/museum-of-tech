import type { RoomId } from "../store";

// Floor plan (meters). Entry hall at z 2..-4 full width; corridor x -3..3
// running to z -26; two 10x10 rooms per side with 2.4 m door gaps.
export interface Wall {
  x: number; // center
  z: number;
  w: number; // size along x
  d: number; // size along z
}

const T = 0.3; // wall thickness
const H = 4; // wall height
export const WALL_HEIGHT = H;

export const WALLS: Wall[] = [
  // perimeter
  { x: 0, z: 2, w: 26 + T, d: T }, // north (entry)
  // south wall, split with a door gap (x -1.2..1.2) into the CS range
  { x: -7.175, z: -26, w: 11.95, d: T },
  { x: 7.175, z: -26, w: 11.95, d: T },
  // CS range room (x -5..5, z -26..-38)
  { x: -5, z: -32, w: T, d: 12 },
  { x: 5, z: -32, w: T, d: 12 },
  { x: 0, z: -38, w: 10 + T, d: T },
  { x: -13, z: -12, w: T, d: 28 }, // west
  { x: 13, z: -12, w: T, d: 28 }, // east
  // top of rooms (separates entry hall from rooms)
  { x: -8, z: -4, w: 10, d: T },
  { x: 8, z: -4, w: 10, d: T },
  // room dividers at z=-15
  { x: -8, z: -15, w: 10, d: T },
  { x: 8, z: -15, w: 10, d: T },
  // corridor west wall (x=-3) with door gaps at z=-9.5 and z=-20.5
  { x: -3, z: -6.15, w: T, d: 4.3 },
  { x: -3, z: -15, w: T, d: 8.6 },
  { x: -3, z: -23.85, w: T, d: 4.3 },
  // corridor east wall (x=3), same gaps
  { x: 3, z: -6.15, w: T, d: 4.3 },
  { x: 3, z: -15, w: T, d: 8.6 },
  { x: 3, z: -23.85, w: T, d: 4.3 },
];

const R = 0.4; // player radius

// Non-wall obstacles (pedestal, columns, exhibits, set dressing).
const OBSTACLES: Wall[] = [
  { x: 0, z: -1, w: 1.5, d: 1.5 }, // hologram pedestal
  // entry columns
  { x: -4, z: -3.3, w: 0.8, d: 0.8 },
  { x: 4, z: -3.3, w: 0.8, d: 0.8 },
  { x: -9, z: -0.5, w: 0.8, d: 0.8 },
  { x: 9, z: -0.5, w: 0.8, d: 0.8 },
  // exhibit centerpieces
  { x: -12.3, z: -9.5, w: 0.8, d: 5.4 }, // ENIAC panel
  { x: 12.3, z: -9.5, w: 1.0, d: 3.6 }, // Bombe cabinet
  { x: -12.15, z: -20.5, w: 1.2, d: 1.4 }, // Pong cabinet
  { x: 12.3, z: -20.5, w: 1.0, d: 2.2 }, // AGC console
  // ENIAC relay panels
  { x: -8, z: -4.6, w: 1.7, d: 0.5 },
  { x: -5.5, z: -4.6, w: 1.7, d: 0.5 },
  { x: -8, z: -14.4, w: 1.7, d: 0.5 },
  { x: -5.5, z: -14.4, w: 1.7, d: 0.5 },
  // dead arcade cabinets (Pong room)
  { x: -10, z: -17, w: 1.4, d: 1.4 },
  { x: -10, z: -24, w: 1.4, d: 1.4 },
  // CS room: bench + crates
  { x: 1.8, z: -28.2, w: 1.7, d: 0.7 },
  { x: -4, z: -27.5, w: 1.0, d: 1.0 },
  { x: -4.2, z: -36.8, w: 1.0, d: 1.0 },
  { x: 4.2, z: -33, w: 0.9, d: 0.9 },
];
const SOLIDS = [...WALLS, ...OBSTACLES];

// Slide the player out of any wall AABB (expanded by player radius).
export function collide(px: number, pz: number): [number, number] {
  for (const wall of SOLIDS) {
    const minX = wall.x - wall.w / 2 - R;
    const maxX = wall.x + wall.w / 2 + R;
    const minZ = wall.z - wall.d / 2 - R;
    const maxZ = wall.z + wall.d / 2 + R;
    if (px > minX && px < maxX && pz > minZ && pz < maxZ) {
      const pushLeft = px - minX;
      const pushRight = maxX - px;
      const pushUp = pz - minZ;
      const pushDown = maxZ - pz;
      const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (m === pushLeft) px = minX;
      else if (m === pushRight) px = maxX;
      else if (m === pushUp) pz = minZ;
      else pz = maxZ;
    }
  }
  return [px, pz];
}

interface RoomDef {
  id: Exclude<RoomId, null>;
  title: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const ROOMS: RoomDef[] = [
  { id: "entry", title: "MUSEUM OF DEAD TECH", minX: -13, maxX: 13, minZ: -4, maxZ: 2 },
  { id: "eniac", title: "ENIAC · 1945 · THE OG", minX: -13, maxX: -3, minZ: -15, maxZ: -4 },
  { id: "bombe", title: "THE BOMBE · 1940s · CODEBREAKER", minX: 3, maxX: 13, minZ: -15, maxZ: -4 },
  { id: "pong", title: "PONG · 1972 · GAME ONE", minX: -13, maxX: -3, minZ: -26, maxZ: -15 },
  { id: "agc", title: "APOLLO AGC · 1969 · MOON COMPUTER", minX: 3, maxX: 13, minZ: -26, maxZ: -15 },
  { id: "cs", title: "COUNTER-STRIKE · 1999 · MADE AT SFU", minX: -5, maxX: 5, minZ: -38, maxZ: -26 },
  { id: "corridor", title: "", minX: -3, maxX: 3, minZ: -26, maxZ: -4 },
];

export function roomAt(px: number, pz: number): RoomId {
  for (const r of ROOMS) {
    if (px >= r.minX && px <= r.maxX && pz >= r.minZ && pz <= r.maxZ) return r.id;
  }
  return null;
}

export function roomTitle(id: RoomId): string | null {
  const r = ROOMS.find((r) => r.id === id);
  return r && r.title ? r.title : null;
}
