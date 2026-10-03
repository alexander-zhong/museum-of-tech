import { create } from "zustand";

export type RoomId =
  | "entry"
  | "corridor"
  | "eniac"
  | "bombe"
  | "pong"
  | "agc"
  | null;

interface MuseumState {
  locked: boolean;
  room: RoomId;
  roomTitle: string | null;
  prompt: string | null;
  subtitle: string | null;
  mode: "walk" | "pong";
  set: (p: Partial<MuseumState>) => void;
}

export const useStore = create<MuseumState>((set) => ({
  locked: false,
  room: null,
  roomTitle: null,
  prompt: null,
  subtitle: null,
  mode: "walk",
  set: (p) => set(p),
}));
