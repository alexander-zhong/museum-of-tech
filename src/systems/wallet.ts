// Demo Solana wallet: the full skin-economy UX (balance, mint, trade,
// instant confirmations) with zero real crypto. Swappable later for
// @solana/wallet-adapter on devnet — the interface is the contract.
import { useStore } from "../store";
import { SKINS } from "../world/Mascots";
import { sendTrade, netHandlers } from "./net";
import { sfxDing } from "./sfx";

const LS_KEY = "modt-wallet-v1";
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function randB58(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += B58[Math.floor(Math.random() * B58.length)];
  return s;
}

interface WalletState {
  address: string;
  sol: number;
  owned: string[];
}

function load(): WalletState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as WalletState;
  } catch {
    /* fresh wallet below */
  }
  return { address: randB58(44), sol: 10, owned: [] }; // 10 demo SOL airdrop
}

function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(wallet));
  } catch {
    /* private mode: wallet lives for the session only */
  }
}

export const wallet: WalletState = load();

function toast(msg: string) {
  useStore.getState().set({ walletMsg: msg, walletMsgAt: Date.now() });
}

function syncStore() {
  useStore.getState().set({ sol: wallet.sol, ownedSkins: [...wallet.owned] });
}

// Fake transaction: short "network" delay, then a signature-looking receipt.
function confirmTx(label: string, after: () => void) {
  toast(`${label} … submitting`);
  setTimeout(() => {
    after();
    save();
    syncStore();
    sfxDing();
    toast(`${label} ✓ confirmed in 0.4s · ${randB58(8)}…${randB58(4)}`);
  }, 450);
}

export function initWallet() {
  syncStore();
}

export function buySkin(id: string) {
  const skin = SKINS.find((k) => k.id === id);
  if (!skin || wallet.owned.includes(id)) return;
  if (wallet.sol < skin.price) {
    toast("insufficient demo SOL — use AIRDROP");
    return;
  }
  confirmTx(`MINT ${skin.name} (${skin.price} SOL)`, () => {
    wallet.sol -= skin.price;
    wallet.owned.push(id);
  });
}

export function airdrop() {
  confirmTx("AIRDROP 5 SOL", () => {
    wallet.sol += 5;
  });
}

export function tradeSkin(peerId: string, peerName: string, id: string) {
  const skin = SKINS.find((k) => k.id === id);
  if (!skin || !wallet.owned.includes(id)) return;
  confirmTx(`SEND ${skin.name} → ${peerName}`, () => {
    wallet.owned = wallet.owned.filter((k) => k !== id);
    const s = useStore.getState();
    if (s.character === id) s.set({ character: "gold" }); // can't wear what you sold
    try {
      sendTrade(peerId, { skin: id });
    } catch {
      /* peer gone; skin lost to the void, very blockchain */
    }
  });
}

netHandlers.onTrade = (from, t) => {
  const skin = SKINS.find((k) => k.id === t.skin);
  if (!skin || wallet.owned.includes(t.skin)) return;
  wallet.owned.push(t.skin);
  save();
  syncStore();
  sfxDing();
  toast(`RECEIVED ${skin.name} from ${from.slice(0, 4).toUpperCase()}`);
};
