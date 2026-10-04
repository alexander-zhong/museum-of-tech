// Player-vs-player damage. There is no server, so the model is:
// the shooter decides the shot connected, the victim owns its own health
// and announces its own death. Cheating is possible; this is a museum.
import { useStore, type FeedLine } from "../store";
import {
  myId,
  netHandlers,
  peers,
  sendFrag,
  sendHit,
  type NetHit,
} from "./net";
import { weaponById } from "./weapons";
import { sfxDeath, sfxHeadshot, sfxHit, sfxHurt, sfxKill } from "./sfx";
import { session } from "./feel";
import { pointBlocked } from "../world/layout";
import { CHARACTERS } from "../world/Mascots";
import { say } from "./narration";

export const MAX_HP = 100;
const RESPAWN_MS = 3000;
const FEED_MS = 7000;
const FEED_MAX = 5;

// Arena respawn points, spread so you don't come back on top of your killer.
// (Deaths only happen in the arena; the museum is a safe lobby.)
const SPAWNS: [number, number][] = [
  [73, -13],
  [107, -13],
  [73, -47],
  [107, -47],
  [90, -24],
  [90, -36],
  [78, -33],
  [102, -27],
];

let deadUntil = 0;
let feedSeq = 0;

export function labelFor(char: string, id: string): string {
  const name = CHARACTERS.find((c) => c.id === char)?.name ?? "OTTER";
  return `${name}-${id.slice(0, 3).toUpperCase()}`;
}

export function myLabel(): string {
  return labelFor(useStore.getState().character, myId);
}

export function peerLabel(id: string): string {
  if (id === myId) return myLabel();
  return labelFor(peers.get(id)?.state.char ?? "gold", id);
}

function pushFeed(line: Omit<FeedLine, "n" | "at">) {
  const s = useStore.getState();
  const entry: FeedLine = { ...line, n: ++feedSeq, at: performance.now() };
  s.set({ feed: [...s.feed, entry].slice(-FEED_MAX) });
}

// Distance falloff: pistols and SMGs get polite across the museum,
// the sniper and the knife do not negotiate.
function falloff(dist: number, sniper?: boolean, knife?: boolean): number {
  if (sniper || knife) return 1;
  if (dist <= 18) return 1;
  return Math.max(0.6, 1 - (dist - 18) * 0.015);
}

/**
 * Called by the shooter when its bullet raycast landed on a remote player.
 * Sends the damage and gives the shooter instant local feedback (hitmarker
 * + sound); their health bar only moves when they report the new value.
 */
export function damagePlayer(
  peerId: string,
  weaponId: string,
  headshot: boolean,
  dist: number,
) {
  const victim = peers.get(peerId);
  if (!victim || victim.state.hp <= 0) return;
  // PvP only inside the arena. The victim re-checks its own room in onHit,
  // so the shooter only gates on itself (a laggy position packet shouldn't
  // eat a legitimate hit).
  if (useStore.getState().room !== "dm") return;
  const def = weaponById(weaponId);
  const dmg = Math.max(
    1,
    Math.round(
      def.damage * (headshot ? def.hsMult : 1) * falloff(dist, def.sniper, def.knife),
    ),
  );

  sendHit(peerId, { d: dmg, w: def.id, hs: headshot });

  // No local prediction of their health: their next state packet (~85ms)
  // is the only thing that moves their bar. Predicting it meant a lethal
  // shot blanked their model before they had agreed they were dead.
  if (headshot) sfxHeadshot();
  else sfxHit();
  useStore.getState().set({ hitAt: performance.now() });
}

function die(killer: string, hit: NetHit) {
  const s = useStore.getState();
  deadUntil = performance.now() + RESPAWN_MS;
  s.set({
    hp: 0,
    dead: true,
    deaths: s.deaths + 1,
    respawnIn: Math.ceil(RESPAWN_MS / 1000),
    buyMenu: false,
    deathBy: peerLabel(killer),
  });
  sfxDeath();
  pushFeed({
    killer: peerLabel(killer),
    victim: myLabel(),
    weapon: hit.w,
    hs: hit.hs,
  });
  try {
    sendFrag({ by: killer, w: hit.w, hs: hit.hs, char: s.character });
  } catch {
    /* nobody left to tell */
  }
  say("pvp-death");
}

function pickSpawn(): [number, number] {
  const open = SPAWNS.filter(([x, z]) => !pointBlocked(x, z));
  const pool = open.length ? open : SPAWNS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function respawn() {
  const [x, z] = pickSpawn();
  session.teleport(x, z);
  useStore.getState().set({ hp: MAX_HP, dead: false, respawnIn: 0, deathBy: null });
}

/** Full reset — used when leaving to the main menu. */
export function resetCombat() {
  deadUntil = 0;
  useStore.getState().set({
    hp: MAX_HP,
    dead: false,
    respawnIn: 0,
    kills: 0,
    deaths: 0,
    feed: [],
    killName: null,
    deathBy: null,
    killAt: 0,
    hurtAt: 0,
  });
}

/** Drives the respawn timer and expires kill-feed lines. Called each frame. */
export function combatTick() {
  const s = useStore.getState();
  const now = performance.now();

  if (s.dead) {
    const left = Math.max(0, Math.ceil((deadUntil - now) / 1000));
    if (left !== s.respawnIn) s.set({ respawnIn: left });
    if (now >= deadUntil) respawn();
  }

  if (s.feed.length > 0 && now - s.feed[0].at > FEED_MS) {
    s.set({ feed: s.feed.filter((f) => now - f.at <= FEED_MS) });
  }
}

netHandlers.onHit = (from, hit) => {
  const s = useStore.getState();
  // presence is broadcast even while paused or unfocused, so a paused player
  // is still standing in the world — and still shootable. Only the main menu
  // (never entered / left the game) is out of play.
  if (!s.started || s.dead || s.hp <= 0) return;
  if (s.room !== "dm") return; // the museum lobby is a no-damage zone
  const hp = Math.max(0, s.hp - Math.max(0, Math.min(500, hit.d)));
  if (hp > 0) {
    s.set({ hp, hurtAt: performance.now() });
    sfxHurt();
    return;
  }
  die(from, hit);
};

netHandlers.onFrag = (victim, frag) => {
  pushFeed({
    killer: peerLabel(frag.by),
    victim: labelFor(frag.char, victim),
    weapon: frag.w,
    hs: frag.hs,
  });
  if (frag.by !== myId) return;
  const s = useStore.getState();
  const firstBlood = s.kills === 0;
  s.set({
    kills: s.kills + 1,
    killAt: performance.now(),
    killName: labelFor(frag.char, victim),
  });
  sfxKill();
  if (firstBlood) say("pvp-first-kill");
};
