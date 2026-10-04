import { create } from "zustand";

export type RoomId =
  | "entry"
  | "corridor"
  | "eniac"
  | "bombe"
  | "pong"
  | "agc"
  | "cs"
  | "dm"
  | null;

export interface FeedLine {
  n: number; // unique, so React keys stay stable
  killer: string;
  victim: string;
  weapon: string;
  hs: boolean;
  at: number;
}

interface MuseumState {
  lesson: "eniac" | "bombe" | "pong" | "agc" | null;
  locked: boolean;
  started: boolean; // entered the game at least once this session
  room: RoomId;
  playerPosition: [number, number];
  roomTitle: string | null;
  prompt: string | null;
  subtitle: string | null;
  mode: "walk" | "pong";
  view: "first" | "third";
  weapon: string;
  character: string;
  buyMenu: boolean;
  armed: boolean; // picked up the replica in the CS room
  hitAt: number; // timestamp of last confirmed target hit (drives HUD hitmarker)
  // --- PvP ---
  hp: number;
  dead: boolean;
  respawnIn: number; // whole seconds left on the respawn timer
  kills: number;
  deaths: number;
  hurtAt: number; // last time we took damage (drives the red flash)
  killAt: number; // last time we eliminated someone (drives the banner)
  killName: string | null;
  deathBy: string | null;
  knock: [number, number, number, number] | null;
  feed: FeedLine[];
  set: (p: Partial<MuseumState>) => void;
}

export const useStore = create<MuseumState>()((set) => ({
  lesson: null,
  locked: false,
  started: false,
  room: null,
  playerPosition: [0, 0.5],
  roomTitle: null,
  prompt: null,
  subtitle: null,
  mode: "walk",
  view: "first",
  weapon: "pistol",
  character: "gold",
  buyMenu: false,
  armed: true, // everyone spawns carrying
  hitAt: 0,
  hp: 100,
  dead: false,
  respawnIn: 0,
  kills: 0,
  deaths: 0,
  hurtAt: 0,
  killAt: 0,
  killName: null,
  deathBy: null,
  knock: null,
  feed: [],
  set: (p) => set(p),
}));

// dev console access for debugging
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__store = useStore;
}
