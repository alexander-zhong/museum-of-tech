import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";

const VIDEO_ID = "yusP6sDpI20";
const PLAY_MS = 6000; // plays once per event, then the iframe unmounts

// On every elimination the jingle plays once for BOTH parties:
// the victim (on death) and the attacker (on kill).
export function DeathJingle() {
  const { dead, killAt } = useStore();
  const [playKey, setPlayKey] = useState(0);
  const wasDead = useRef(false);
  const lastKill = useRef(0);

  // victim: fire on the moment of death
  useEffect(() => {
    if (dead && !wasDead.current) setPlayKey(Date.now());
    wasDead.current = dead;
  }, [dead]);

  // attacker: fire on each new elimination
  useEffect(() => {
    if (killAt > 0 && killAt !== lastKill.current) {
      lastKill.current = killAt;
      setPlayKey(Date.now());
    }
  }, [killAt]);

  // unmount after one play-through
  useEffect(() => {
    if (!playKey) return;
    const t = setTimeout(() => setPlayKey(0), PLAY_MS);
    return () => clearTimeout(t);
  }, [playKey]);

  if (!playKey) return null;
  return (
    <iframe
      key={playKey}
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
  );
}
