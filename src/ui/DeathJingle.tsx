import { useEffect, useRef } from "react";
import { useStore } from "../store";

const VIDEO_ID = "yusP6sDpI20";
const PLAY_MS = 6000; // each voice plays this long, then pauses
const POOL = 3; // pre-mounted players; kills round-robin across them
const TARGET_JINGLE_CHANCE = 0.05;

function command(frame: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  frame?.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func, args }),
    "*",
  );
}

// Every elimination retriggers the next player in a fixed pool, so rapid
// kills overlap (up to POOL voices) without spawning new YouTube embeds —
// mounting a fresh player per kill melted the tab under a spree.
export function DeathJingle() {
  const { dead, killAt, botKillAt } = useStore();
  const frames = useRef<(HTMLIFrameElement | null)[]>([]);
  const timers = useRef<(ReturnType<typeof setTimeout> | null)[]>([]);
  const next = useRef(0);
  const wasDead = useRef(false);
  const lastKill = useRef(0);
  const lastBot = useRef(0);

  const spawn = () => {
    if (useStore.getState().cinema) return; // movie mode: keep the mix clean
    const slot = next.current % POOL;
    next.current += 1;
    const frame = frames.current[slot];
    command(frame, "seekTo", [0, true]);
    command(frame, "playVideo");
    const t = timers.current[slot];
    if (t) clearTimeout(t);
    timers.current[slot] = setTimeout(() => {
      command(frames.current[slot], "pauseVideo");
    }, PLAY_MS);
  };

  // victim: fire on the moment of death
  useEffect(() => {
    if (dead && !wasDead.current) spawn();
    wasDead.current = dead;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dead]);

  // attacker: fire on each new elimination
  useEffect(() => {
    if (killAt > 0 && killAt !== lastKill.current) {
      lastKill.current = killAt;
      spawn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [killAt]);

  // Range targets have a 5% chance; player eliminations always trigger above.
  useEffect(() => {
    if (botKillAt > 0 && botKillAt !== lastBot.current) {
      lastBot.current = botKillAt;
      if (Math.random() < TARGET_JINGLE_CHANCE) spawn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botKillAt]);

  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <iframe
          key={i}
          ref={(f) => {
            frames.current[i] = f;
          }}
          className="bhop-music-audio"
          title={`Elimination jingle ${i + 1}`}
          src={`https://www.youtube.com/embed/${VIDEO_ID}?enablejsapi=1&playsinline=1&rel=0`}
          width="200"
          height="200"
          allow="autoplay; encrypted-media"
          referrerPolicy="strict-origin-when-cross-origin"
          tabIndex={-1}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
