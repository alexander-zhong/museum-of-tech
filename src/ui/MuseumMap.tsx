import { lessons } from "../education/content";
import { useStore } from "../store";
import { ROOMS, WALLS } from "../world/layout";

// The same room and wall coordinates used for movement drive this top-down map.
const scale = 7;
const mapX = (x: number) => 120 + x * scale;
const mapY = (z: number) => 24 + (2 - z) * scale;

export function MuseumMap() {
  const room = useStore((s) => s.room);
  const started = useStore((s) => s.started);
  const locked = useStore((s) => s.locked);
  const lesson = useStore((s) => s.lesson);
  const [x, z] = useStore((s) => s.playerPosition);

  if (!started || !locked || lesson || room === "dm" || room === "cs") return null;

  return (
    <aside className="museum-map" aria-label="Museum minimap and suggested room order">
      <div className="museum-map-heading">MUSEUM MAP <span>START → 1 → 2 → 3 → 4</span></div>
      <svg viewBox="0 0 240 308" role="img" aria-label="Top-down museum map. Transistor upper left, chip upper right, compiler lower left, network lower right, Counter-Strike at the far end.">
        <rect x={mapX(-13)} y={mapY(2)} width={26 * scale} height={28 * scale} className="map-floor" />
        <rect x={mapX(-5)} y={mapY(-26)} width={10 * scale} height={12 * scale} className="map-floor" />
        {ROOMS.filter((r) => lessons.some((l) => l.id === r.id)).map((r) => {
          const lessonDef = lessons.find((l) => l.id === r.id)!;
          return <rect key={r.id} x={mapX(r.minX) + 2} y={mapY(r.maxZ) + 2} width={(r.maxX - r.minX) * scale - 4} height={(r.maxZ - r.minZ) * scale - 4} fill={room === r.id ? `${lessonDef.color}44` : "#182c38"} stroke={lessonDef.color} strokeWidth={room === r.id ? 2.5 : 1} />;
        })}
        <path d={`M ${mapX(0)} ${mapY(0)} L ${mapX(0)} ${mapY(-9.5)} L ${mapX(-6)} ${mapY(-9.5)} M ${mapX(0)} ${mapY(-9.5)} L ${mapX(6)} ${mapY(-9.5)} M ${mapX(0)} ${mapY(-9.5)} L ${mapX(0)} ${mapY(-20.5)} L ${mapX(-6)} ${mapY(-20.5)} M ${mapX(0)} ${mapY(-20.5)} L ${mapX(6)} ${mapY(-20.5)}`} className="map-route" />
        {WALLS.map((w, i) => <rect key={i} x={mapX(w.x - w.w / 2)} y={mapY(w.z + w.d / 2)} width={w.w * scale} height={w.d * scale} className="map-wall" />)}
        {lessons.map((l, i) => {
          const r = ROOMS.find((roomDef) => roomDef.id === l.id)!;
          return <g key={l.id}>
            <circle cx={mapX((r.minX + r.maxX) / 2)} cy={mapY((r.minZ + r.maxZ) / 2) - 8} r="10" fill={l.color} />
            <text x={mapX((r.minX + r.maxX) / 2)} y={mapY((r.minZ + r.maxZ) / 2) - 4} className="map-number">{i + 1}</text>
            <text x={mapX((r.minX + r.maxX) / 2)} y={mapY((r.minZ + r.maxZ) / 2) + 12} className="map-label">{l.name === "Integrated circuit" ? "CHIP" : l.name.toUpperCase()}</text>
          </g>;
        })}
        <text x="120" y={mapY(-32)} className="map-label">CS ROOM</text>
        <text x="120" y={mapY(0)} className="map-label">START</text>
        <circle cx={mapX(x)} cy={mapY(z)} r="6" className="map-player-halo" />
        <circle cx={mapX(x)} cy={mapY(z)} r="3" className="map-player" />
      </svg>
      <p className="museum-map-legend">Blue dot: you · Follow the numbered rooms</p>
    </aside>
  );
}
