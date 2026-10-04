import { useStore } from "../store";
import { WEAPONS, weaponById } from "../systems/weapons";
import { MAX_HP, resetCombat } from "../systems/combat";
import { CHARACTERS, nameFor, swatchFor } from "../world/Mascots";
import { initWallet } from "../systems/wallet";
import { session } from "../systems/feel";
import { useEffect } from "react";
import { BhopMusic } from "./BhopMusic";
import { DeathJingle } from "./DeathJingle";
import { MuseumMap } from "./MuseumMap";
import { SkinEconomy } from "./SkinEconomy";
import "../systems/market";

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
    econMenu,
    weapon,
    armed,
    character,
    hp,
    dead,
    respawnIn,
    kills,
    deaths,
    hurtAt,
    killAt,
    killName,
    deathBy,
    feed,
    walletMsg,
    walletMsgAt,
    set,
  } = useStore();

  const hpFrac = Math.max(0, Math.min(1, hp / MAX_HP));
  const cinema = useStore((s) => s.cinema);

  useEffect(() => {
    initWallet();
  }, []);

  if (cinema) return null; // clean frames for the montage

  return (
    <div className="hud">
      {!locked && started && !buyMenu && !econMenu && !lesson && (
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
                onClick={() => {
                  resetCombat();
                  set({ started: false });
                }}
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
            <h1 className="start-title">
              OTTER
              <br />
              <span className="accent">ORIGINS</span>
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
              <button
                className="pause-btn main-shop-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  set({ econMenu: true });
                }}
              >
                SHOP
              </button>
            </div>
            <p className="start-cta">CLICK TO ENTER</p>
            <p className="start-controls">
              WASD move · SPACE jump (hold it to bhop) · SHIFT sprint · E interact · V camera · M market · ESC release
            </p>
          </div>
        </div>
      )}

      {locked && (
        <>
          <MuseumMap />
          {!dead && <div className="crosshair" />}
          {hurtAt > 0 && <div key={hurtAt} className="hurt-flash" />}
          <div className="vitals">
              <div className="hp-row">
                <span className="hp-num">{hp}</span>
                <div className="hp-track">
                  <div
                    className={`hp-fill${hpFrac <= 0.3 ? " low" : ""}`}
                    style={{ width: `${hpFrac * 100}%` }}
                  />
                </div>
              </div>
              <div className="kd">
                <span className="kd-k">{kills}</span> K
                <span className="kd-sep">/</span>
                <span className="kd-d">{deaths}</span> D
              </div>
          </div>
          {feed.length > 0 && (
            <div className="killfeed">
              {feed.map((f) => (
                <div key={f.n} className="killfeed-row">
                  <span className="kf-killer">{f.killer}</span>
                  <span className="kf-weapon">
                    {weaponById(f.weapon).name}
                    {f.hs ? " ⌖" : ""}
                  </span>
                  <span className="kf-victim">{f.victim}</span>
                </div>
              ))}
            </div>
          )}
          {killAt > 0 && !dead && (
            <div key={killAt} className="kill-banner">
              ELIMINATED {killName}
            </div>
          )}
          {dead && (
            <div className="death-overlay">
              <p className="death-title">YOU ARE A DEAD EXHIBIT</p>
              {deathBy && (
                <p className="death-by">
                  retired by <span>{deathBy}</span>
                </p>
              )}
              <p className="death-timer">RESPAWNING IN {respawnIn}</p>
            </div>
          )}
          {hitAt > 0 && (
            <div key={hitAt} className="hitmarker">
              <span /><span /><span /><span />
            </div>
          )}
          {prompt && <div className="prompt">{prompt}</div>}
          {roomTitle && <div className="room-title">{roomTitle}</div>}
          <div className="skin-chip">
            <span
              className="skin-chip-swatch"
              style={{ background: swatchFor(character) }}
            />
            {nameFor(character)}
            <span className="skin-chip-hint"> · V to view · M market</span>
          </div>
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

      {econMenu && (
        <div className="econ-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="econ-panel">
            <div className="econ-head">
              <span>OTTER MARKET</span>
              <button
                className="econ-small"
                onClick={() => {
                  set({ econMenu: false });
                  if (started) session.lock();
                }}
              >
                CLOSE
              </button>
            </div>
            <SkinEconomy />
          </div>
        </div>
      )}
      {walletMsg && Date.now() - walletMsgAt < 4000 && (
        <div key={walletMsgAt} className="wallet-toast">{walletMsg}</div>
      )}
      <BhopMusic />
      <DeathJingle />

      {subtitle && (
        <div className="subtitle">
          <span className="subtitle-speaker">TOUR GUIDE</span> {subtitle}
        </div>
      )}
    </div>
  );
}
