import { create } from "zustand";

export type RoomId =
  | "entry"
  | "corridor"
  | "eniac"
  | "bombe"
  | "pong"
  | "agc"
  | "cs"
  | null;

interface MuseumState {
  locked: boolean;
  room: RoomId;
  roomTitle: string | null;
  prompt: string | null;
  subtitle: string | null;
  mode: "walk" | "pong";
  view: "first" | "third";
  hitAt: number; // timestamp of last confirmed target hit (drives HUD hitmarker)
  set: (p: Partial<MuseumState>) => void;
}

export const useStore = create<MuseumState>((set) => ({
  locked: false,
  room: null,
  roomTitle: null,
  prompt: null,
  subtitle: null,
  mode: "walk",
  view: "first",
  hitAt: 0,
  set: (p) => set(p),
}));
