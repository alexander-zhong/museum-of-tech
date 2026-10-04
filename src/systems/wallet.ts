// Skin wallet with two backends behind one interface:
//   devnet — a burner Keypair generated in the browser (localStorage, no
//            Phantom, no real funds) doing REAL transactions on Solana
//            devnet: airdrops, purchase receipts and trade receipts as
//            memo transactions, signatures viewable on the explorer.
//   demo   — pure local simulation, used automatically when the chain or
//            the venue wifi refuses to cooperate. The game never blocks.
import { Buffer } from "buffer";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useStore } from "../store";
import { SKINS } from "../world/Mascots";
import { sendTrade, netHandlers } from "./net";
import { sfxDing } from "./sfx";

// web3.js expects a Node Buffer global in a few code paths
(globalThis as unknown as Record<string, unknown>).Buffer ??= Buffer;

const LS_WALLET = "modt-wallet-v2";
const LS_KEY = "modt-burner-key";
const RPC = "https://api.devnet.solana.com";
const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
// receipts go to the museum "treasury" (any stable address works for memos)
const TREASURY = new PublicKey("11111111111111111111111111111112");
const PRICE_LAMPORTS = 10000; // per displayed "SOL" of skin price — cheap on purpose

interface WalletState {
  sol: number; // demo balance; in devnet mode this mirrors real balance
  owned: string[];
}

function loadState(): WalletState {
  try {
    const raw = localStorage.getItem(LS_WALLET);
    if (raw) return JSON.parse(raw) as WalletState;
  } catch {
    /* fresh below */
  }
  return { sol: 10, owned: [] };
}

export const wallet: WalletState = loadState();
let mode: "demo" | "devnet" = "demo";
let conn: Connection | null = null;
let kp: Keypair | null = null;

function save() {
  try {
    localStorage.setItem(LS_WALLET, JSON.stringify(wallet));
  } catch {
    /* session-only */
  }
}

function toast(msg: string) {
  useStore.getState().set({ walletMsg: msg, walletMsgAt: Date.now() });
}

function syncStore() {
  useStore.getState().set({
    sol: wallet.sol,
    ownedSkins: [...wallet.owned],
    walletMode: mode,
  });
}

function loadOrCreateKeypair(): Keypair {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
  } catch {
    /* generate below */
  }
  const fresh = Keypair.generate();
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...fresh.secretKey]));
  } catch {
    /* session-only burner */
  }
  return fresh;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

async function refreshBalance() {
  if (!conn || !kp) return;
  const lamports = await withTimeout(conn.getBalance(kp.publicKey), 5000);
  wallet.sol = lamports / LAMPORTS_PER_SOL;
  syncStore();
}

export async function initWallet() {
  syncStore(); // demo values immediately; upgrade to devnet if it answers
  try {
    kp = loadOrCreateKeypair();
    conn = new Connection(RPC, "confirmed");
    await refreshBalance();
    mode = "devnet";
    syncStore();
    console.log(
      `[wallet] devnet burner: ${kp.publicKey.toBase58()} — https://explorer.solana.com/address/${kp.publicKey.toBase58()}?cluster=devnet`,
    );
  } catch {
    mode = "demo";
    conn = null;
    syncStore();
  }
}

export function walletAddress(): string | null {
  return kp ? kp.publicKey.toBase58() : null;
}

async function memoTx(memo: string, lamports: number): Promise<string> {
  if (!conn || !kp) throw new Error("no chain");
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: kp.publicKey,
      toPubkey: TREASURY,
      lamports,
    }),
    new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM,
      data: Buffer.from(memo, "utf8"),
    }),
  );
  const sig = await withTimeout(
    conn.sendTransaction(tx, [kp]),
    12000,
  );
  await withTimeout(conn.confirmTransaction(sig, "confirmed"), 15000);
  return sig;
}

function explorer(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

// ---------- public actions (shared interface, mode-aware guts) ----------

export async function airdrop() {
  if (mode === "devnet" && conn && kp) {
    toast("AIRDROP 1 SOL … requesting from devnet faucet");
    try {
      const sig = await withTimeout(
        conn.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL),
        12000,
      );
      await withTimeout(conn.confirmTransaction(sig, "confirmed"), 20000);
      await refreshBalance();
      sfxDing();
      toast(`AIRDROP ✓ on devnet · ${sig.slice(0, 10)}…`);
      console.log(`[wallet] airdrop: ${explorer(sig)}`);
      return;
    } catch {
      toast("faucet rate-limited — demo credit instead");
    }
  }
  wallet.sol += 5;
  save();
  syncStore();
  sfxDing();
  toast("AIRDROP 5 SOL ✓ (demo)");
}

export async function buySkin(id: string) {
  const skin = SKINS.find((k) => k.id === id);
  if (!skin || wallet.owned.includes(id)) return;

  if (mode === "devnet" && conn && kp) {
    const cost = skin.price * PRICE_LAMPORTS;
    toast(`MINT ${skin.name} … sending devnet tx`);
    try {
      const sig = await memoTx(`modt:mint:${id}`, cost);
      wallet.owned.push(id);
      save();
      await refreshBalance();
      sfxDing();
      toast(`MINT ${skin.name} ✓ on devnet · ${sig.slice(0, 10)}…`);
      console.log(`[wallet] mint ${id}: ${explorer(sig)}`);
      return;
    } catch {
      toast("devnet tx failed (balance? airdrop first) — try again");
      return;
    }
  }

  // demo mode
  if (wallet.sol < skin.price) {
    toast("insufficient demo SOL — use AIRDROP");
    return;
  }
  setTimeout(() => {
    wallet.sol -= skin.price;
    wallet.owned.push(id);
    save();
    syncStore();
    sfxDing();
    toast(`MINT ${skin.name} ✓ (demo) · confirmed in 0.4s`);
  }, 450);
}

export async function tradeSkin(peerId: string, peerName: string, id: string) {
  const skin = SKINS.find((k) => k.id === id);
  if (!skin || !wallet.owned.includes(id)) return;

  const finishLocal = () => {
    wallet.owned = wallet.owned.filter((k) => k !== id);
    const s = useStore.getState();
    if (s.character === id) s.set({ character: "gold" });
    save();
    syncStore();
    try {
      sendTrade(peerId, { skin: id });
    } catch {
      /* peer gone */
    }
  };

  if (mode === "devnet" && conn && kp) {
    toast(`SEND ${skin.name} → ${peerName} … devnet tx`);
    try {
      const sig = await memoTx(`modt:trade:${id}:${peerId}`, 5000);
      finishLocal();
      sfxDing();
      toast(`SENT ${skin.name} ✓ on devnet · ${sig.slice(0, 10)}…`);
      console.log(`[wallet] trade ${id}: ${explorer(sig)}`);
      return;
    } catch {
      toast("devnet tx failed — trade cancelled");
      return;
    }
  }

  setTimeout(() => {
    finishLocal();
    sfxDing();
    toast(`SENT ${skin.name} → ${peerName} ✓ (demo)`);
  }, 450);
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
