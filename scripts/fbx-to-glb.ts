/**
 * FBX -> GLB, using the loader/exporter three-stdlib already ships.
 *
 *   npx tsx scripts/fbx-to-glb.ts                      # every .fbx source
 *   npx tsx scripts/fbx-to-glb.ts path/to/model.fbx    # just this one
 *
 * Reports the bounding box of each result: FBX from Blender is usually
 * authored in centimetres, so a gun often arrives ~100x too big and needs
 * scaling down wherever it gets mounted.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import * as THREE from "three";
import { FBXLoader, GLTFExporter } from "three-stdlib";

// Sources live outside public/ so they are not deployed; output goes in.
const SRC_DIRS = ["assets/models-src", "public/models"];
const OUT_DIR = "public/models";

function convert(file: string) {
  const buf = readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const group = new FBXLoader().parse(ab as ArrayBuffer, dirname(file) + "/");

  // FBXLoader builds MeshPhongMaterial, which glTF has no equivalent for —
  // the exporter warns and approximates. Convert to MeshStandardMaterial
  // ourselves so the conversion is explicit rather than guessed downstream.
  let meshes = 0;
  const materials: string[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const swapped = mats.map((mat) => {
      const phong = mat as THREE.MeshPhongMaterial;
      if (!(phong as THREE.Material & { isMeshPhongMaterial?: boolean }).isMeshPhongMaterial) {
        materials.push(`${mat.name || "unnamed"} (${mat.type}, left alone)`);
        return mat;
      }
      // Phong shininess maps to roughness cleanly. Metalness does not: these
      // exports tend to carry one flat specular value for every material, so
      // it tells us nothing. The material NAMES do, so use them and log it —
      // adjust here if a model names its materials differently.
      let roughness = Math.min(1, Math.sqrt(2 / ((phong.shininess ?? 30) + 2)));
      let metalness = 0.15;
      let why = "default";
      const name = phong.name ?? "";
      if (/wood|stock|grip|rubber|plastic|leather/i.test(name)) {
        metalness = 0;
        roughness = 0.75;
        why = "name";
      } else if (/metal|steel|iron|chrome|barrel|receiver/i.test(name)) {
        metalness = 0.9;
        roughness = 0.35;
        why = "name";
      }
      const std = new THREE.MeshStandardMaterial({
        name: phong.name,
        color: phong.color,
        emissive: phong.emissive,
        map: phong.map,
        normalMap: phong.normalMap,
        aoMap: phong.aoMap,
        transparent: phong.transparent,
        opacity: phong.opacity,
        side: phong.side,
        roughness,
        metalness,
      });
      materials.push(
        `${std.name || "unnamed"} #${std.color.getHexString()} rough ${roughness.toFixed(2)} metal ${metalness} (${why})`,
      );
      return std;
    });
    m.material = Array.isArray(m.material) ? swapped : swapped[0];
  });

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const out = join(OUT_DIR, basename(file).replace(/\.fbx$/i, "") + ".glb");

  return new Promise<void>((done, fail) => {
    new GLTFExporter().parse(
      group,
      (result) => {
        const glb = Buffer.from(result as ArrayBuffer);
        writeFileSync(out, glb);
        console.log(
          `${basename(file)} -> ${basename(out)}\n` +
            `  ${meshes} mesh(es), ${materials.length} material(s)\n` +
            materials.map((m) => `    - ${m}\n`).join("") +
            `  ${group.animations.length} animation(s)\n` +
            `  size ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} units\n` +
            `  ${(buf.length / 1024).toFixed(0)}K -> ${(glb.length / 1024).toFixed(0)}K`,
        );
        done();
      },
      (err) => fail(err),
      { binary: true, animations: group.animations },
    );
  });
}

const args = process.argv.slice(2);
const files = args.length
  ? args.map((a) => resolve(a))
  : SRC_DIRS.flatMap((dir) => {
      try {
        return readdirSync(dir)
          .filter((f) => /\.fbx$/i.test(f))
          .map((f) => join(dir, f));
      } catch {
        return [];
      }
    });

if (!files.length) {
  console.log(`no .fbx files found in ${SRC_DIRS.join(" or ")}`);
  process.exit(0);
}
for (const f of files) await convert(f);
