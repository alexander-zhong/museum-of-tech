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

// ---- deathmatch arena: a separate map far east of the museum ----
// The lobby (museum) is a no-damage zone; PvP only runs in here.
export interface CoverBlock extends Wall {
  h: number;
}

export const ARENA = { minX: 70, maxX: 110, minZ: -50, maxZ: -10 };

export const ARENA_WALLS: Wall[] = [
  { x: 90, z: -10, w: 40.3, d: T },
  { x: 90, z: -50, w: 40.3, d: T },
  { x: 70, z: -30, w: T, d: 40.3 },
  { x: 110, z: -30, w: T, d: 40.3 },
];

export const ARENA_COVER: CoverBlock[] = [
  { x: 90, z: -30, w: 4, d: 4, h: 2.6 }, // center block
  { x: 80, z: -20, w: 2.4, d: 2.4, h: 1.5 },
  { x: 100, z: -20, w: 2.4, d: 2.4, h: 1.5 },
  { x: 80, z: -40, w: 2.4, d: 2.4, h: 1.5 },
  { x: 100, z: -40, w: 2.4, d: 2.4, h: 1.5 },
  { x: 74, z: -30, w: 1.6, d: 6, h: 2.2 }, // side screens
  { x: 106, z: -30, w: 1.6, d: 6, h: 2.2 },
  { x: 90, z: -17, w: 6, d: 1.4, h: 1.2 }, // low rails
  { x: 90, z: -43, w: 6, d: 1.4, h: 1.2 },
];

// Walk-in teleporters: museum CS room <-> arena.
export const PORTALS = [
  { x: 4.3, z: -32, r: 1.1, tx: 90, tz: -16 }, // CS room -> arena
  { x: 90, z: -11.5, r: 1.1, tx: 2.6, tz: -32 }, // arena -> museum
];

const R = 0.4; // player radius

// Non-wall obstacles (columns, exhibits, set dressing).
const OBSTACLES: Wall[] = [
  { x: 2.6, z: -2.2, w: 1.1, d: 0.9 }, // Sparky
  // entry columns
  { x: -4, z: -3.3, w: 0.8, d: 0.8 },
  { x: 4, z: -3.3, w: 0.8, d: 0.8 },
  { x: -9, z: -0.5, w: 0.8, d: 0.8 },
  { x: 9, z: -0.5, w: 0.8, d: 0.8 },
  // exhibit centerpieces
  { x: -12.3, z: -9.5, w: 0.8, d: 4.3 }, // ENIAC panel
  { x: 12.3, z: -9.5, w: 1.0, d: 4.3 }, // Bombe cabinet
  { x: -12.15, z: -20.5, w: 1.2, d: 4.3 }, // Pong cabinet
  { x: 12.3, z: -20.5, w: 1.0, d: 4.3 }, // AGC console
  // Educational display plinths
  { x: -8.5, z: -14.05, w: 2.1, d: 1.7 },
  { x: 8.5, z: -4.95, w: 2.1, d: 1.7 },
  { x: -8.5, z: -25.05, w: 2.1, d: 1.7 },
  { x: 8.5, z: -15.95, w: 2.1, d: 1.7 },
  // CS room: bench + crates
  { x: 1.8, z: -28.2, w: 1.7, d: 0.7 },
  { x: -4, z: -27.5, w: 1.0, d: 1.0 },
  { x: -4.2, z: -32, w: 1.0, d: 1.0 },
  { x: 4.2, z: -29.5, w: 0.9, d: 0.9 },
];
const SOLIDS = [...WALLS, ...OBSTACLES, ...ARENA_WALLS, ...ARENA_COVER];

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

// Is this point inside any solid (for third-person camera boom)?
export function pointBlocked(px: number, pz: number, pad = 0.25): boolean {
  for (const w of SOLIDS) {
    if (
      px > w.x - w.w / 2 - pad &&
      px < w.x + w.w / 2 + pad &&
      pz > w.z - w.d / 2 - pad &&
      pz < w.z + w.d / 2 + pad
    ) {
      return true;
    }
  }
  return false;
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
  { id: "eniac", title: "01 · TRANSISTOR · 1947", minX: -13, maxX: -3, minZ: -15, maxZ: -4 },
  { id: "bombe", title: "02 · INTEGRATED CIRCUIT · 1958–1971", minX: 3, maxX: 13, minZ: -15, maxZ: -4 },
  { id: "pong", title: "03 · COMPILER · 1952 ONWARD", minX: -13, maxX: -3, minZ: -26, maxZ: -15 },
  { id: "agc", title: "04 · NETWORK · 1969", minX: 3, maxX: 13, minZ: -26, maxZ: -15 },
  { id: "cs", title: "COUNTER-STRIKE · 1999 · MADE AT SFU", minX: -5, maxX: 5, minZ: -38, maxZ: -26 },
  { id: "corridor", title: "", minX: -3, maxX: 3, minZ: -26, maxZ: -4 },
  { id: "dm", title: "DEATHMATCH ARENA", minX: 70, maxX: 110, minZ: -50, maxZ: -10 },
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
