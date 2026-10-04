// P2P skin marketplace: every client broadcasts its own sell listings;
// buying sends a direct request and the seller settles it (decrement
// inventory, ship the skin over the trade channel, credit the SOL).
// Demo-grade trust model — there is no escrow, it's a hackathon.
import { useStore } from "../store";
import { SKINS } from "../world/Mascots";
import { myId, netHandlers, peers, sendMpBuy, sendMpList, sendTrade } from "./net";
import { marketCredit, marketDebit, marketTake, qty } from "./wallet";
import { sfxDing } from "./sfx";

export interface Listing {
  skin: string;
  price: number;
}

export const myListings: Listing[] = [];
export const remoteListings = new Map<
  string,
  { items: Listing[]; at: number }
>();

const STALE_MS = 10000;

function bump() {
  const s = useStore.getState();
  s.set({ marketAt: s.marketAt + 1 });
}

function toast(msg: string) {
  useStore.getState().set({ walletMsg: msg, walletMsgAt: Date.now() });
}

export function listSkin(skin: string, price: number) {
  if (qty(skin) <= 0) return;
  if (myListings.some((l) => l.skin === skin)) return;
  myListings.push({ skin, price });
  bump();
  broadcast();
}

export function unlistSkin(skin: string) {
  const i = myListings.findIndex((l) => l.skin === skin);
  if (i >= 0) {
    myListings.splice(i, 1);
    bump();
    broadcast();
  }
}

function broadcast() {
  try {
    sendMpList({ items: myListings });
  } catch {
    /* no peers */
  }
}

export function buyListing(sellerId: string, l: Listing) {
  const skin = SKINS.find((k) => k.id === l.skin);
  if (!skin) return;
  if (!marketDebit(l.price)) {
    toast("insufficient SOL for that listing");
    return;
  }
  sendMpBuy(sellerId, { skin: l.skin, price: l.price });
  toast(`BUY ${skin.name} … waiting for seller`);
}

netHandlers.onMpList = (from, list) => {
  remoteListings.set(from, { items: list.items, at: performance.now() });
  bump();
};

netHandlers.onMpBuy = (from, buy) => {
  const i = myListings.findIndex((l) => l.skin === buy.skin);
  const skin = SKINS.find((k) => k.id === buy.skin);
  if (i < 0 || !skin || !marketTake(buy.skin)) return; // listing already gone
  myListings.splice(i, 1);
  marketCredit(buy.price);
  sendTrade(from, { skin: buy.skin });
  sfxDing();
  toast(`SOLD ${skin.name} on the market ✓ +${buy.price} SOL`);
  bump();
  broadcast();
};

// keep listings fresh + prune the dead
setInterval(() => {
  broadcast();
  const now = performance.now();
  let changed = false;
  for (const [id, entry] of remoteListings) {
    if (now - entry.at > STALE_MS || !peers.has(id)) {
      remoteListings.delete(id);
      changed = true;
    }
  }
  if (changed) bump();
}, 3000);

export { myId as marketSelfId };
