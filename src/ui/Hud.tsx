import { useStore } from "../store";
import { session } from "../systems/feel";
import { WEAPONS, weaponById } from "../systems/weapons";
import { CHARACTERS } from "../world/Mascots";
import { BhopMusic } from "./BhopMusic";

export function Hud() {
  const {
    lesson,
    locked,
    started,
    prompt,
    subtitle,
    roomTitle,
    hitAt,
    buyMenu,
    weapon,
    armed,
    character,
    set,
  } = useStore();

  return (
    <div className="hud">
      {!locked && started && !buyMenu && !lesson && (
        <div className="pause-menu">
          <div className="pause-box">
            <p className="pause-q">Back to the menu?</p>
            <div className="pause-actions">
              <button
                className="pause-btn primary"
                onClick={() => session.lock()}
              >
                NO, RESUME
              </button>
              <button
                className="pause-btn"
                onClick={() => set({ started: false })}
              >
                YES, MAIN MENU
              </button>
            </div>
            <p className="pause-hint">or click anywhere to jump back in</p>
          </div>
        </div>
      )}
      {!locked && !started && (
        <div className="start-screen">
          <div className="start-inner">
            <p className="start-kicker">STORMHACKS 2026 PRESENTS</p>
            <h1 className="start-title">
              MUSEUM OF
              <br />
              <span className="accent">DEAD TECH</span>
            </h1>
            <p className="start-tag">
              Recreate the breakthroughs that built your computer.
              <br />
              Transistor → Chip → Compiler → Network.
            </p>
            <div className="char-select">
              <p className="char-label">CHOOSE YOUR OTTER</p>
              <div className="char-row">
                {CHARACTERS.map((ch) => (
                  <button
                    key={ch.id}
                    className={`char-btn${ch.id === character ? " selected" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      set({ character: ch.id });
                    }}
                  >
                    <span
                      className="char-swatch"
                      style={{ background: ch.swatch }}
                    />
                    {ch.name}
                  </button>
                ))}
              </div>
              <p className="char-note">press V in-game to see yourself</p>
            </div>
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
          {armed && (
            <div className="weapon-label">
              {weaponById(weapon).name}
              <span className="weapon-hint"> · B buy menu</span>
            </div>
          )}
          {buyMenu && (
            <div className="buy-menu">
              <div className="buy-title">BUY MENU · press 1–5 or click</div>
              {WEAPONS.map((w, i) => (
                <div
                  key={w.id}
                  className={`buy-row${w.id === weapon ? " owned" : ""}`}
                  onClick={() => {
                    set({ weapon: w.id, buyMenu: false });
                    session.lock();
                  }}
                >
                  <span className="buy-key">{i + 1}</span>
                  <span className="buy-name">{w.name}</span>
                  <span className="buy-tag">{w.tag}</span>
                  <span className="buy-price">${w.price.toLocaleString()}</span>
                </div>
              ))}
              <div className="buy-footer">FUNDS: $16,000 · B to close</div>
            </div>
          )}
        </>
      )}

      <BhopMusic />

      {subtitle && (
        <div className="subtitle">
          <span className="subtitle-speaker">TOUR GUIDE</span> {subtitle}
        </div>
      )}
    </div>
  );
}
