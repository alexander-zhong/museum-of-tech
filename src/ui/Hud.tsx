import { useStore } from "../store";
import { session } from "../systems/feel";
import { WEAPONS, weaponById } from "../systems/weapons";
import { MAX_HP, resetCombat } from "../systems/combat";
import { CHARACTERS, SKINS } from "../world/Mascots";
import { airdrop, buySkin, initWallet, tradeSkin } from "../systems/wallet";
import { peers } from "../systems/net";
import { peerLabel } from "../systems/combat";
import { useEffect } from "react";
import { BhopMusic } from "./BhopMusic";
import { DeathJingle } from "./DeathJingle";
import { MuseumMap } from "./MuseumMap";

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
    sol,
    ownedSkins,
    walletMsg,
    walletMsgAt,
    walletMode,
    set,
  } = useStore();

  const hpFrac = Math.max(0, Math.min(1, hp / MAX_HP));

  useEffect(() => {
    initWallet();
  }, []);

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
              <div className="skin-shop">
                <p className="char-label">
                  SKINS · {sol.toFixed(1)} SOL
                  <button className="airdrop-btn" onClick={() => airdrop()}>
                    AIRDROP
                  </button>
                </p>
                <div className="char-row">
                  {SKINS.map((k) => {
                    const owned = ownedSkins.includes(k.id);
                    const equipped = character === k.id;
                    return (
                      <button
                        key={k.id}
                        className={`char-btn skin-btn${equipped ? " selected" : ""}${owned ? " owned-skin" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (owned) set({ character: k.id });
                          else buySkin(k.id);
                        }}
                      >
                        <span className="char-swatch" style={{ background: k.swatch }} />
                        {k.name}
                        <span className="skin-price">
                          {equipped ? "EQUIPPED" : owned ? "OWNED" : `${k.price} SOL`}
                        </span>
                        {owned && peers.size > 0 && (
                          <span
                            className="skin-send"
                            onClick={(e) => {
                              e.stopPropagation();
                              const pid = [...peers.keys()][0];
                              tradeSkin(pid, peerLabel(pid), k.id);
                            }}
                          >
                            SEND → {peerLabel([...peers.keys()][0])}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="char-note">
                  {walletMode === "devnet"
                    ? "burner wallet · live on Solana devnet"
                    : "demo wallet · devnet connects when the chain answers"}
                </p>
              </div>
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
