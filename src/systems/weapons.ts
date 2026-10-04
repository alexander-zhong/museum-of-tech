export interface WeaponDef {
  id: string;
  name: string;
  price: number; // classic CS energy; money is infinite and fake
  tag: string;
  auto: boolean;
  fireMs: number;
  kick: number; // FOV kick per shot
  recoil: number; // viewmodel recoil scale
  sparks: number;
  speedMult: number; // knife makes you faster; AWP makes you honest
  damage: number; // to other players, body shot (100 HP pool)
  hsMult: number; // headshot multiplier
  range: number; // metres before the bullet stops caring
  sniper?: boolean;
  knife?: boolean;
}

export const WEAPONS: WeaponDef[] = [
  {
    id: "knife",
    name: "LEGACY KNIFE",
    price: 0,
    tag: "run faster. museum approved.",
    auto: false,
    fireMs: 350,
    kick: 0.4,
    recoil: 0.5,
    sparks: 4,
    speedMult: 1.12,
    damage: 55,
    hsMult: 2,
    range: 2.4,
    knife: true,
  },
  {
    id: "pistol",
    name: "USB-S",
    price: 200,
    tag: "semi-auto. polite.",
    auto: false,
    fireMs: 180,
    kick: 0.8,
    recoil: 0.7,
    sparks: 6,
    speedMult: 1.05,
    damage: 26,
    hsMult: 3.2,
    range: 45,
  },
  {
    id: "smg",
    name: "MP-404",
    price: 1500,
    tag: "spray. the targets were not found.",
    auto: true,
    fireMs: 85,
    kick: 0.55,
    recoil: 0.5,
    sparks: 5,
    speedMult: 1.03,
    damage: 19,
    hsMult: 2.8,
    range: 45,
  },
  {
    id: "rifle",
    name: "AK-1977",
    price: 2700,
    tag: "the classic.",
    auto: true,
    fireMs: 140,
    kick: 1.5,
    recoil: 1,
    sparks: 10,
    speedMult: 1.0,
    damage: 34,
    hsMult: 4,
    range: 45,
  },
  {
    id: "awp",
    name: "DIAL-UP",
    price: 4750,
    tag: "one shot. long reload. you know why.",
    auto: false,
    fireMs: 1400,
    kick: 4,
    recoil: 2.2,
    sparks: 18,
    speedMult: 0.92,
    damage: 115,
    hsMult: 1.4,
    range: 45,
    sniper: true,
  },
];

export function weaponById(id: string): WeaponDef {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[1];
}
