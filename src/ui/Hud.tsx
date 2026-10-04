import { useStore } from "../store";
import { WEAPONS, weaponById } from "../systems/weapons";

export function Hud() {
  const { locked, prompt, subtitle, roomTitle, hitAt, buyMenu, weapon, armed } =
    useStore();

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
          {armed && (
            <div className="weapon-label">
              {weaponById(weapon).name}
              <span className="weapon-hint"> · B buy menu</span>
            </div>
          )}
          {buyMenu && (
            <div className="buy-menu">
              <div className="buy-title">BUY MENU</div>
              {WEAPONS.map((w, i) => (
                <div
                  key={w.id}
                  className={`buy-row${w.id === weapon ? " owned" : ""}`}
                >
                  <span className="buy-key">{i + 1}</span>
                  <span className="buy-name">{w.name}</span>
                  <span className="buy-tag">{w.tag}</span>
                  <span className="buy-price">${w.price.toLocaleString()}</span>
                </div>
              ))}
              <div className="buy-footer">FUNDS: $16,000 · they respawn, don't worry</div>
            </div>
          )}
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
