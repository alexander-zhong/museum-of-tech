import { useRef, useState } from "react";
import { useStore } from "../store";
import { SKINS, RARITY_COLOR, rollSkin } from "../world/Mascots";
import {
  airdrop,
  buySkin,
  openCase,
  sellSkin,
  tradeSkin,
  CASE_PRICE,
} from "../systems/wallet";
import {
  myListings,
  remoteListings,
  listSkin,
  unlistSkin,
  buyListing,
} from "../systems/market";
import { peers } from "../systems/net";
import { peerLabel } from "../systems/combat";

type Tab = "shop" | "cases" | "inv" | "market";

const REEL_ITEM = 74; // px per reel cell, must match CSS
const WIN_INDEX = 34;

function skinOf(id: string) {
  return SKINS.find((k) => k.id === id);
}

export function SkinEconomy() {
  const { sol, inv, character, walletMode, marketAt, set } = useStore();
  const [tab, setTab] = useState<Tab>("shop");
  const [reel, setReel] = useState<string[] | null>(null);
  const [reelDone, setReelDone] = useState(false);
  const [spun, setSpun] = useState(false);
  const [drop, setDrop] = useState<string | null>(null);
  const rolling = useRef(false);
  void marketAt; // subscribed so listing changes re-render

  const startCase = async () => {
    if (rolling.current) return;
    rolling.current = true;
    const result = await openCase();
    if (!result) {
      rolling.current = false;
      return;
    }
    // build the reel strip with the real drop planted at the win slot
    const strip = Array.from({ length: 44 }, () => rollSkin().id);
    strip[WIN_INDEX] = result.id;
    setDrop(result.id);
    setReelDone(false);
    setSpun(false);
    setReel(strip);
    setTimeout(() => setSpun(true), 60);
    setTimeout(() => {
      setReelDone(true);
      rolling.current = false;
    }, 4600);
  };

  const ownedIds = Object.keys(inv).filter((id) => (inv[id] ?? 0) > 0);
  const market: { seller: string; name: string; skin: string; price: number }[] = [];
  for (const [pid, entry] of remoteListings) {
    for (const l of entry.items) {
      market.push({ seller: pid, name: peerLabel(pid), skin: l.skin, price: l.price });
    }
  }

  return (
    <div className="skin-shop">
      <p className="char-label">
        {sol.toFixed(1)} SOL
        <button className="airdrop-btn" onClick={() => airdrop()}>
          AIRDROP
        </button>
        <span className="wallet-mode">
          {walletMode === "devnet" ? "· devnet burner" : "· demo wallet"}
        </span>
      </p>

      <div className="econ-tabs">
        {(["shop", "cases", "inv", "market"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`econ-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "inv" ? "INVENTORY" : t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "shop" && (
        <div className="char-row">
          {SKINS.map((k) => {
            const owned = (inv[k.id] ?? 0) > 0;
            const equipped = character === k.id;
            return (
              <button
                key={k.id}
                className={`char-btn skin-btn${equipped ? " selected" : ""}`}
                style={{ borderBottomColor: RARITY_COLOR[k.rarity] }}
                onClick={() => (owned ? set({ character: k.id }) : buySkin(k.id))}
              >
                <span className="char-swatch" style={{ background: k.swatch }} />
                {k.name}
                <span className="skin-price">
                  {equipped ? "EQUIPPED" : owned ? "OWNED" : `${k.price} SOL`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {tab === "cases" && (
        <div className="case-panel">
          {!reel && (
            <button className="case-btn" onClick={startCase}>
              OPEN LEGACY CASE · {CASE_PRICE} SOL
            </button>
          )}
          {reel && (
            <div className="reel-window">
              <div className="reel-marker" />
              <div
                className="reel-strip"
                style={{
                  transform: spun
                    ? `translateX(${-(WIN_INDEX * REEL_ITEM - 150 + REEL_ITEM / 2)}px)`
                    : "translateX(0)",
                }}
              >
                {reel.map((id, i) => {
                  const k = skinOf(id);
                  return (
                    <div
                      key={i}
                      className="reel-cell"
                      style={{ borderBottomColor: RARITY_COLOR[k?.rarity ?? "common"] }}
                    >
                      <span className="char-swatch" style={{ background: k?.swatch }} />
                      <span className="reel-name">{k?.name}</span>
                    </div>
                  );
                })}
              </div>
              {reelDone && drop && (
                <div className="reel-result">
                  <span style={{ color: RARITY_COLOR[skinOf(drop)?.rarity ?? "common"] }}>
                    {skinOf(drop)?.name}
                  </span>
                  <button
                    className="econ-small"
                    onClick={() => {
                      setReel(null);
                      setDrop(null);
                    }}
                  >
                    CLAIM
                  </button>
                </div>
              )}
            </div>
          )}
          <p className="char-note">60% common · 28% rare · 9% epic · 3% legendary</p>
        </div>
      )}

      {tab === "inv" && (
        <div className="char-row econ-wrap">
          {ownedIds.length === 0 && <p className="char-note">no skins yet — open a case</p>}
          {ownedIds.map((id) => {
            const k = skinOf(id);
            if (!k) return null;
            const equipped = character === id;
            const listed = myListings.some((l) => l.skin === id);
            return (
              <div
                key={id}
                className={`char-btn skin-btn${equipped ? " selected" : ""}`}
                style={{ borderBottomColor: RARITY_COLOR[k.rarity] }}
              >
                <span className="char-swatch" style={{ background: k.swatch }} />
                {k.name}
                {(inv[id] ?? 0) > 1 && <span className="inv-qty">x{inv[id]}</span>}
                <span className="inv-actions">
                  {!equipped && (
                    <span className="econ-small" onClick={() => set({ character: id })}>
                      EQUIP
                    </span>
                  )}
                  <span className="econ-small" onClick={() => sellSkin(id)}>
                    SELL {(k.price / 2).toFixed(1)}
                  </span>
                  {listed ? (
                    <span className="econ-small" onClick={() => unlistSkin(id)}>
                      UNLIST
                    </span>
                  ) : (
                    <span className="econ-small" onClick={() => listSkin(id, k.price)}>
                      LIST {k.price}
                    </span>
                  )}
                  {peers.size > 0 && (
                    <span
                      className="econ-small"
                      onClick={() => {
                        const pid = [...peers.keys()][0];
                        tradeSkin(pid, peerLabel(pid), id);
                      }}
                    >
                      GIFT
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {tab === "market" && (
        <div className="market-list">
          {market.length === 0 && (
            <p className="char-note">
              no listings right now — other players' listings appear here live
            </p>
          )}
          {market.map((m, i) => {
            const k = skinOf(m.skin);
            if (!k) return null;
            return (
              <div key={`${m.seller}-${m.skin}-${i}`} className="market-row">
                <span className="char-swatch" style={{ background: k.swatch }} />
                <span className="mk-name" style={{ color: RARITY_COLOR[k.rarity] }}>
                  {k.name}
                </span>
                <span className="mk-seller">{m.name}</span>
                <span className="mk-price">{m.price} SOL</span>
                <button
                  className="econ-small"
                  onClick={() => buyListing(m.seller, { skin: m.skin, price: m.price })}
                >
                  BUY
                </button>
              </div>
            );
          })}
          {myListings.length > 0 && (
            <p className="char-note">
              your listings: {myListings.map((l) => `${skinOf(l.skin)?.name} (${l.price})`).join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
