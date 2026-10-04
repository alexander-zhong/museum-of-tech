import { useEffect, useState } from "react";
import { useStore } from "../store";

const HOLD_MS = 3000;
const VIDEO_ID = "ZjPB3a2t1vk";

// Hold Space for three seconds; releasing it stops playback and resets the timer.
export function BhopMusic() {
  const [playing, setPlaying] = useState(false);
  const { locked, mode } = useStore();

  useEffect(() => {
    if (!locked || mode !== "walk") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let held = false;
    let triggered = false;

    const cancelHold = () => {
      held = false;
      triggered = false;
      setPlaying(false);
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || held || triggered) return;
      event.preventDefault();
      held = true;
      timer = setTimeout(() => {
        timer = null;
        triggered = true;
        setPlaying(true);
      }, HOLD_MS);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") cancelHold();
    };
    const visibility = () => {
      if (document.hidden) cancelHold();
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", cancelHold);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelHold();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", cancelHold);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [locked, mode]);

  if (!playing || !locked || mode !== "walk") return null;

  return (
    <iframe
      className="bhop-music-audio"
      title="Bhop background music"
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
