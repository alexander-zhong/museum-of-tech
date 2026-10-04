// P2P multiplayer via Trystero: peers meet through public relays,
// no server, no login. Everyone on the URL shares one room.
// Pure client-side WebRTC — deploys as a static site (Vercel-safe).
import { joinRoom, selfId } from "trystero";

export type NetState = {
  p: [number, number, number]; // head position
  yaw: number;
  char: string;
  mv: boolean; // moving (drives walk anim)
}

export type NetShot = {
  a: [number, number, number]; // muzzle
  b: [number, number, number]; // impact
}

export const myId = selfId;

const room = joinRoom({ appId: "museum-of-dead-tech-sh2026" }, "main");

export const peers = new Map<string, { state: NetState; at: number }>();
export const shotQueue: NetShot[] = [];

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

export const sendState = (s: NetState) => stateAction.send(s);
export const sendShot = (s: NetShot) => shotAction.send(s);

room.onPeerLeave = (id) => {
  peers.delete(id);
};
