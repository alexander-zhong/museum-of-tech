import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { session } from "../systems/feel";
import { lessons } from "./content";
import "./education.css";

function Transistor({ done }: { done: () => void }) {
  const [small, setSmall] = useState(false);
  const [signal, setSignal] = useState(2);
  const [tested, setTested] = useState(false);
  return <>
    <h2>Replace the hot, bulky switch</h2>
    <div className="lab-actions"><button onClick={() => { setSmall(false); setTested(true); }}>Vacuum tube circuit</button><button onClick={() => { setSmall(true); if (tested) done(); }}>Transistor circuit</button></div>
    <div className={`circuit-demo ${small ? "compact" : ""}`}>
      <div className="device-bank">{Array.from({ length: 8 }, (_, i) => <span className="switch-device" key={i} />)}</div>
      <div><strong>{small ? "SEMICONDUCTOR SWITCHES" : "HEATED VACUUM TUBES"}</strong><p>{small ? "Small solid-state devices • no heated filament" : "Large glass envelopes • heaters release waste heat"}</p></div>
    </div>
    <p className="lab-note">Qualitative comparison, not a scale model. Early transistors and modern chips differ enormously; both tubes and transistors can switch and amplify.</p>
    <h2>Amplify a tiny signal</h2>
    <label>Input signal: {signal} mV<input type="range" min="0" max="10" value={signal} onChange={(e) => { setSignal(Number(e.target.value)); if (small && tested) done(); }} /></label>
    <div className="signal-bars"><div>Input <meter min="0" max="100" value={signal} /> {signal} mV</div><div>Output <meter min="0" max="100" value={signal * 10} /> {signal * 10} mV</div></div>
    <p>This idealized amplifier has voltage gain 10: output = input × 10. Move the slider to see a weak signal control a stronger one. A separate power supply provides the extra energy; real amplifiers have noise and limits.</p>
  </>;
}
function Chip({ done }: { done: () => void }) {
  const [wires, setWires] = useState(0);
  const [integrated, setIntegrated] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [found, setFound] = useState(false);
  return <>
    <h2>First, wire it by hand</h2><p>Connect a model with 24 components. Each click adds one connection. Notice how quickly the wiring becomes crowded.</p>
    <div className={`chip-board ${integrated ? "integrated" : ""}`}>
      <svg viewBox="0 0 600 180" aria-label={integrated ? "Components integrated on a single chip" : `${wires} connections between discrete components`}>
        {Array.from({ length: wires }, (_, i) => <path key={i} d={`M ${35 + (i % 8) * 75} ${30 + Math.floor(i / 8) * 60} Q 300 ${i % 2 ? 210 : -40} ${35 + ((i + 3) % 8) * 75} ${30 + Math.floor(((i + 9) % 24) / 8) * 60}`} fill="none" stroke="#80ddbb" strokeWidth="2" />)}
        {Array.from({ length: 24 }, (_, i) => <rect key={i} x={20 + (i % 8) * 75} y={18 + Math.floor(i / 8) * 60} width="30" height="24" rx="3" fill="#254e52" stroke="#a1f0d4" />)}
      </svg>
      {integrated && <strong>ONE INTEGRATED CIRCUIT</strong>}
    </div>
    <div className="lab-actions"><button disabled={integrated || wires === 24} onClick={() => setWires(wires + 1)}>Connect component ({wires}/24)</button><button disabled={wires < 6 || integrated} onClick={() => { setIntegrated(true); done(); }}>Integrate {wires < 6 ? "(try 6 wires first)" : ""}</button><button onClick={() => { setWires(0); setIntegrated(false); }}>Reset circuit</button></div>
    <p aria-live="polite">{integrated ? "The connections did not disappear: they became patterned interconnects on the chip. Manufacturing replaces much of the manual assembly. This animation illustrates the idea; real components cannot be physically collapsed into silicon." : "Every external wire is another assembly step and a possible bad connection. Integration changes how the circuit is manufactured."}</p>
    <h2>A CPU on a chip: Intel 4004</h2><p>About 2,300 transistors, 1971. Explore a stylized die to find designer Federico Faggin’s initials.</p>
    <button onClick={() => setZoom(!zoom)}>{zoom ? "Zoom out" : "Zoom into the die"}</button>
    {zoom && <div className="die-art"><span>4004 · schematic illustration</span><button aria-label="Inspect FF initials" onClick={() => setFound(true)}>FF</button></div>}
    {found && <p role="status">Found: FF — Federico Faggin. His silicon-gate design work helped make the 4004 practical. The achievement also depended on Hoff, Mazor, Shima, and many colleagues.</p>}
  </>;
}
function Compiler({ done }: { done: () => void }) {
  const [source, setSource] = useState("ADD 2 3");
  const [code, setCode] = useState<number[] | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<number | null>(null);
  const [wire, setWire] = useState(false);
  function compile() {
    const match = /^(ADD|SUB)\s+(\d+)\s+(\d+)$/i.exec(source.trim());
    setResult(null);
    if (!match || Number(match[2]) > 255 || Number(match[3]) > 255) { setCode(null); setError("Syntax error: use ADD a b or SUB a b, with whole numbers from 0 to 255. Try ADD 2 3."); return; }
    setError(""); setCode([match[1].toUpperCase() === "ADD" ? 1 : 2, Number(match[2]), Number(match[3])]);
  }
  return <>
    <h2>Write → compile → execute</h2><p>Use our tiny teaching language: ADD a b or SUB a b. It compiles to a three-byte instruction for a fictional machine, not a historical computer.</p>
    <label>Source program<input value={source} maxLength={40} spellCheck={false} onChange={(e) => { setSource(e.target.value); setCode(null); setResult(null); setError(""); }} /></label>
    <div className="lab-actions"><button onClick={compile}>Compile</button><button disabled={!code} onClick={() => { if (code) { setResult(code[0] === 1 ? code[1] + code[2] : code[1] - code[2]); done(); } }}>Run machine code</button></div>
    <div className="machine-output" aria-live="polite">{error || (code ? <><code>{code.map((n) => n.toString(2).padStart(8, "0")).join("  ")}</code><p>Opcode {code[0]} ({code[0] === 1 ? "ADD" : "SUB"}) · first operand {code[1]} · second operand {code[2]}</p><p>{result === null ? "Compiled successfully. Run it to execute the instruction." : `CPU result: ${result}`}</p></> : "Machine code will appear here.")}</div>
    <p>Compilation and execution are separate steps. Change the source and compile again. Try an invalid command to see why a compiler needs grammar rules. Our model uses integer results, without eight-bit overflow.</p>
    <h2>Hold a nanosecond</h2><button onClick={() => setWire(!wire)}>{wire ? "Put down the wire" : "Pick up the nanosecond wire"}</button>
    {wire && <div className="nano-wire"><div /><p>≈ 30 cm: the distance light travels in a vacuum in one nanosecond (one billionth of a second). Hopper used short wires to make tiny time intervals tangible. Signals in actual cables travel more slowly. This is a time-and-distance analogy, not a compiler component.</p></div>}
  </>;
}
function Network({ done }: { done: () => void }) {
  const [login, setLogin] = useState("");
  const [phase, setPhase] = useState(0);
  const [message, setMessage] = useState("HELLO WORLD");
  const [sent, setSent] = useState<string[]>([]);
  const [arrived, setArrived] = useState<number[]>([]);
  const [blocked, setBlocked] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  function replay() {
    timers.current.forEach(clearTimeout); setPhase(1);
    timers.current = [setTimeout(() => setPhase(2), 700), setTimeout(() => setPhase(3), 1600)];
  }
  function send() {
    timers.current.forEach(clearTimeout);
    const parts = message.trim().match(/.{1,4}/gu) || [];
    setSent(parts); setArrived([]);
    const order = parts.map((_, i) => i).reverse();
    timers.current = order.map((id, i) => setTimeout(() => { setArrived((prev) => [...prev, id]); if (i === order.length - 1) done(); }, (i + 1) * 650));
  }
  const traveling = sent.length > 0 && arrived.length < sent.length;
  return <>
    <h2>Recreate the first message</h2><label>Type LOGIN<input value={login} maxLength={5} onChange={(e) => setLogin(e.target.value.toUpperCase())} /></label>
    <button disabled={login !== "LOGIN" || phase === 1 || phase === 2 || traveling} onClick={replay}>Transmit LOGIN</button>
    <div className="machine-output" aria-live="polite">{phase === 0 ? "UCLA → Stanford Research Institute · October 29, 1969" : phase === 1 ? "Received: L" : phase === 2 ? "Received: LO" : "Received: LO — the receiving system crashed before LOGIN completed. They successfully logged in later that night."}</div>
    <h2>Now send packets</h2><p>This teaching network shows the first four ARPANET sites, with illustrative routes rather than the exact 1969 topology. Split your message into four-character packets and watch them arrive out of order.</p>
    <div className="network-map"><svg viewBox="0 0 600 180" role="img" aria-label="Illustrative routes between UCLA, SRI, UCSB and Utah"><path d="M80 130 L80 35 L490 35 L490 130 L80 130 M80 130 L490 35" fill="none" stroke="#596a89" strokeWidth="3" /><path d="M80 130 L490 130" stroke={blocked ? "#f87575" : "#c4a1ff"} strokeDasharray={blocked ? "8 8" : "0"} strokeWidth="4" />{[[80,130,"UCLA"],[80,35,"UCSB"],[490,35,"UTAH"],[490,130,"SRI"]].map(([x,y,label]) => <g key={label}><circle cx={x} cy={y} r="14" fill="#c4a1ff" /><text x={Number(x)+22} y={Number(y)+5} fill="white" fontSize="17">{label}</text></g>)}{traveling && <circle r="7" fill="#88ffd2"><animateMotion dur="1.3s" repeatCount="indefinite" path={blocked ? "M80 130 L80 35 L490 35 L490 130" : "M80 130 L490 35 L490 130"} /></circle>}</svg></div>
    <label>Your message<input maxLength={32} value={message} disabled={traveling} onChange={(e) => setMessage(e.target.value)} /></label>
    <label className="lab-check"><input type="checkbox" checked={blocked} disabled={traveling} onChange={(e) => setBlocked(e.target.checked)} /> Block the direct link; use a longer route</label>
    <button disabled={!message.trim() || traveling || phase === 1 || phase === 2} onClick={send}>{traveling ? "Packets in flight…" : "Send packets"}</button>
    <div className="packet-list">{sent.map((part, i) => <span key={i} className={arrived.includes(i) ? "received" : ""}>#{i + 1} {part}<small>{arrived.includes(i) ? "arrived" : "in transit"}</small></span>)}</div>
    <div aria-live="polite"><p>Arrival order: {arrived.map((i) => `#${i + 1}`).join(" → ") || "waiting"}</p><p>Reconstructed: <strong>{sent.length && arrived.length === sent.length ? sent.join("") : "waiting for every packet"}</strong></p></div>
    <p>Sequence numbers let the receiver restore the original order. A working alternate route can keep delivery possible if a link fails. Real protocols also handle lost packets and congestion; this simulation assumes successful delivery.</p>
  </>;
}
export function LearningLab() {
  const id = useStore((s) => s.lesson);
  const [completed, setCompleted] = useState<string[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (id) panel.current?.focus(); }, [id]);
  if (!id) return null;
  const lesson = lessons.find((l) => l.id === id)!;
  const done = () => setCompleted((prev) => prev.includes(id) ? prev : [...prev, id]);
  const close = () => { useStore.getState().set({ lesson: null }); session.lock(); };
  return <div className="learning-overlay" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { e.stopPropagation();
      if (e.key === "Tab") {
        const items = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a, input:not(:disabled)');
        if (items?.length) {
          const first = items[0], last = items[items.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      if (e.key === "Escape") { useStore.getState().set({ lesson: null }); } }}>
    <div className="learning-panel" role="dialog" aria-modal="true" aria-labelledby="lesson-title" tabIndex={-1} ref={panel}>
      <header><div><p className="lab-eyebrow">THE EVOLUTION OF MODERN COMPUTING · {completed.length}/4 EXPLORED</p><h1 id="lesson-title">0{lessons.indexOf(lesson) + 1} / {lesson.name}</h1></div><button onClick={close}>Return to museum ×</button></header>
      <div className="lab-route">Transistor → Integrated circuit → Compiler → Network</div>
      <div className="lab-columns"><aside><span className="lab-date">{lesson.date}</span><h2>{lesson.question}</h2><p>{lesson.story}</p><h3>What changed?</h3><p>{lesson.principle}</p><a href={lesson.source} target="_blank" rel="noreferrer">Read the historical source ↗</a></aside>
      <main key={id}>{id === "eniac" ? <Transistor done={done} /> : id === "bombe" ? <Chip done={done} /> : id === "pong" ? <Compiler done={done} /> : <Network done={done} />}</main></div>
      <footer><strong>{completed.includes(id) ? "✓ Experiment explored" : "Try the experiment"}</strong><p>{lesson.bridge}</p>{id === "agc" && <p className="lab-payoff">The final exhibit is the device you’re using right now.</p>}</footer>
    </div>
  </div>;
}
