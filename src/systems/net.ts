// P2P multiplayer via Trystero: peers meet through public relays,
// no server, no login. Everyone on the URL shares one room.
// Pure client-side WebRTC — deploys as a static site (Vercel-safe).
import { joinRoom, selfId } from "trystero";

export type NetState = {
  p: [number, number, number]; // head position
  yaw: number;
  char: string;
  mv: boolean; // moving (drives walk anim)
  hp: number; // 0 = down, waiting to respawn
  // The shot that put us down: [dirX, dirZ, force, seed]. Observers learn
  // about a death from this packet, not from the hit — only the victim ever
  // sees that — so the knockdown has to ride along with hp hitting zero.
  ko?: [number, number, number, number];
}

export type NetShot = {
  a: [number, number, number]; // muzzle
  b: [number, number, number]; // impact
}

// Damage is shooter-detected, victim-applied: whoever fires decides it
// connected, the target owns its own health. No server to referee.
export type NetHit = {
  d: number; // damage
  w: string; // weapon id
  hs: boolean; // headshot
  dx: number; // unit horizontal direction the bullet was travelling
  dz: number;
}

// Broadcast by the victim once its health hits zero, so the killer gets
// credit and everyone can print the same kill feed line.
export type NetFrag = {
  by: string; // killer peer id
  w: string;
  hs: boolean;
  char: string; // victim's otter, for the feed label
}

export const myId = selfId;

const room = joinRoom({ appId: "museum-of-dead-tech-sh2026" }, "main");

export const peers = new Map<string, { state: NetState; at: number }>();
export const shotQueue: NetShot[] = [];

// Filled in by systems/combat.ts; kept as a handler bag so net.ts stays
// a dumb transport and we avoid an import cycle.
export const netHandlers: {
  onHit: ((from: string, hit: NetHit) => void) | null;
  onFrag: ((victim: string, frag: NetFrag) => void) | null;
} = { onHit: null, onFrag: null };

const stateAction = room.makeAction<NetState>("state", {
  onMessage: (s, ctx) => {
    peers.set(ctx.peerId, { state: s, at: performance.now() });
  },
});
const shotAction = room.makeAction<NetShot>("shot", {
  onMessage: (s) => {
    if (shotQueue.length < 16) shotQueue.push(s);
  },
});
const hitAction = room.makeAction<NetHit>("hit", {
  onMessage: (h, ctx) => netHandlers.onHit?.(ctx.peerId, h),
});
const fragAction = room.makeAction<NetFrag>("frag", {
  onMessage: (f, ctx) => netHandlers.onFrag?.(ctx.peerId, f),
});

// All sends are fire-and-forget: a peer can drop mid-flight and we would
// rather lose the packet than surface an unhandled rejection mid-firefight.
const nop = () => {};
export const sendState = (s: NetState) => stateAction.send(s).catch(nop);
export const sendShot = (s: NetShot) => shotAction.send(s).catch(nop);
export const sendHit = (target: string, h: NetHit) =>
  hitAction.send(h, { target }).catch(nop);
export const sendFrag = (f: NetFrag) => fragAction.send(f).catch(nop);

room.onPeerLeave = (id) => {
  peers.delete(id);
};

// dev console access for debugging
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__net = { peers, myId };
}
