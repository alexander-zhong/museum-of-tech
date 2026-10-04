import { useStore } from "../store";

export function Hud() {
  const { locked, prompt, subtitle, roomTitle, hitAt } = useStore();

  return (
    <div className="hud">
      {!locked && (
        <div className="start-screen">
          <div className="start-inner">
            <p className="start-kicker">STORMHACKS 2026 PRESENTS</p>
            <h1 className="start-title">
              MUSEUM OF
              <br />
              <span className="accent">DEAD TECH</span>
            </h1>
            <p className="start-tag">
              You were born to build great things.
              <br />
              They built these first.
            </p>
            <p className="start-cta">CLICK TO ENTER</p>
            <p className="start-controls">
              WASD move · SPACE jump (hold it to bhop) · SHIFT sprint · E interact · V camera · ESC release
            </p>
          </div>
        </div>
      )}

      {locked && (
        <>
          <div className="crosshair" />
          {hitAt > 0 && (
            <div key={hitAt} className="hitmarker">
              <span /><span /><span /><span />
            </div>
          )}
          {prompt && <div className="prompt">{prompt}</div>}
          {roomTitle && <div className="room-title">{roomTitle}</div>}
          <div id="speedo" className="speedo" />{/* driven imperatively by PlayerController */}
        </>
      )}

      {subtitle && (
        <div className="subtitle">
          <span className="subtitle-speaker">TOUR GUIDE</span> {subtitle}
        </div>
      )}
    </div>
  );
}
