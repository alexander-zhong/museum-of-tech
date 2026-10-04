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

/**
 * FBXLoader returns one geometry carrying every material as a "group".
 * GLTFExporter turns each group into a primitive but does NOT slice the
 * vertex data, so every primitive ends up referencing the whole buffer —
 * i.e. N complete copies of the model stacked on each other, one per
 * material, and only the last drawn is visible. Split the groups into real
 * separate meshes first so each one owns only its own triangles.
 */
function splitByGroups(mesh: THREE.Mesh): THREE.Mesh[] {
  const geo = mesh.geometry as THREE.BufferGeometry;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (geo.groups.length <= 1 || mats.length <= 1) return [mesh];

  return geo.groups.map((g) => {
    const sub = new THREE.BufferGeometry();
    for (const name of Object.keys(geo.attributes)) {
      const attr = geo.attributes[name] as THREE.BufferAttribute;
      let values: ArrayLike<number>;
      if (geo.index) {
        // gather the vertices this group's indices point at
        const out: number[] = [];
        for (let i = g.start; i < g.start + g.count; i++) {
          const v = geo.index.getX(i);
          for (let c = 0; c < attr.itemSize; c++)
            out.push(attr.array[v * attr.itemSize + c] as number);
        }
        values = out;
      } else {
        values = (attr.array as Float32Array).slice(
          g.start * attr.itemSize,
          (g.start + g.count) * attr.itemSize,
        );
      }
      sub.setAttribute(
        name,
        new THREE.BufferAttribute(
          values instanceof Float32Array ? values : new Float32Array(values),
          attr.itemSize,
          attr.normalized,
        ),
      );
    }
    const mat = mats[g.materialIndex ?? 0];
    const out = new THREE.Mesh(sub, mat);
    out.name = `${mesh.name || "part"}_${mat.name || g.materialIndex}`;
    out.position.copy(mesh.position);
    out.quaternion.copy(mesh.quaternion);
    out.scale.copy(mesh.scale);
    return out;
  });
}

function convert(file: string) {
  const buf = readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const group = new FBXLoader().parse(ab as ArrayBuffer, dirname(file) + "/");

  // FBXLoader builds MeshPhongMaterial, which glTF has no equivalent for —
  // the exporter warns and approximates. Convert to MeshStandardMaterial
  // ourselves so the conversion is explicit rather than guessed downstream.
  // split first, then walk the result
  const toSplit: THREE.Mesh[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (m.geometry as THREE.BufferGeometry).groups?.length > 1)
      toSplit.push(m);
  });
  let split = 0;
  for (const m of toSplit) {
    const parts = splitByGroups(m);
    if (parts.length <= 1) continue;
    split += parts.length;
    m.parent?.add(...parts);
    m.removeFromParent();
  }

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
        // Deliberately not 0.9: a metal has no diffuse colour and shows only
        // what it reflects, and this scene has no environment map — fully
        // metallic surfaces come out flat gray. Enough to catch a highlight
        // off the point lights, little enough to keep the base colour.
        metalness = 0.3;
        roughness = 0.4;
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
            (split ? `  split 1 grouped mesh into ${split} real meshes\n` : "") +
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
