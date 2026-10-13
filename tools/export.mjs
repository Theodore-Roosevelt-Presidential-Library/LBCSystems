import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, weld, simplify, flatten, join } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import fs from 'fs';
const [s, ang, mm, tx, tz, pcx, pcy] = JSON.parse(fs.readFileSync('cm/reg.json'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const doc = await io.read('cm/raw.glb');
const root = doc.getRoot();
const DROP = /^(L A N D|113_Mesh|solar panels|V post|table|chair|TRI brown|low poly seated)/;
for (const n of root.listNodes()) { const m = n.getMesh(); if (m && DROP.test(m.getName())) n.dispose(); }
// world = A * cm + b   (feet; three axes x, up, -y_model)
const a = ang * Math.PI / 180, c = Math.cos(a) / s, sn = Math.sin(a) / s;
// x = c*(X-tx) + sn*(Z-tz) + pcx ; y = mm*(-sn*(X-tx) + c*(Z-tz)) + pcy ; z = (Y-1.149)/s
// three: (x, z, -y)
const M = [
  c, 0, -mm * -sn, 0,
  0, 1 / s, 0, 0,
  sn, 0, -mm * c, 0,
  0, 0, 0, 1];
// translation
const tX = -c * tx - sn * tz + pcx;
const tY = -1.149 / s;
const tZ = -(mm * (sn * tx - c * tz) + pcy);
M[12] = tX; M[13] = tY; M[14] = tZ;
const scene = root.listScenes()[0];
const wrap = doc.createNode('campus').setMatrix(M);
for (const ch of scene.listChildren()) { scene.removeChild(ch); wrap.addChild(ch); }
scene.addChild(wrap);
await doc.transform(prune(), dedup(), weld({ tolerance: 0.0001 }), simplify({ simplifier: MeshoptSimplifier, ratio: 0.35, error: 0.0008 }), prune());
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write('cm/campus.glb', doc);
console.log('ok', fs.statSync('cm/campus.glb').size);
