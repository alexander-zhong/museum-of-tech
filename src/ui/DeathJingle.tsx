import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";

const VIDEO_ID = "yusP6sDpI20";
const PLAY_MS = 6000; // each instance plays once, then unmounts
const MAX_STACK = 10; // mercy cap on simultaneous instances

// Every elimination spawns its OWN player instance, so rapid kills
// stack and overlap instead of restarting one clip.
export function DeathJingle() {
  const { dead, killAt, botKillAt } = useStore();
  const [plays, setPlays] = useState<number[]>([]);
  const wasDead = useRef(false);
  const lastKill = useRef(0);
  const lastBot = useRef(0);
  const seq = useRef(0);

  const spawn = () => {
    seq.current += 1;
    const id = seq.current;
    setPlays((p) => [...p, id].slice(-MAX_STACK));
    setTimeout(() => {
      setPlays((p) => p.filter((n) => n !== id));
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

  // range bots count too
  useEffect(() => {
    if (botKillAt > 0 && botKillAt !== lastBot.current) {
      lastBot.current = botKillAt;
      spawn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botKillAt]);

  return (
    <>
      {plays.map((id) => (
        <iframe
          key={id}
          className="bhop-music-audio"
          title="Elimination jingle"
          src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&playsinline=1&rel=0`}
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
