import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { LAYERS, PLACES, NOTE } from './content.js';

// ---------- params / embed ----------
const qs = new URLSearchParams(location.search);
const EMBED = qs.get('embed') === '1';
const SHOW_PANEL = qs.get('panel') !== '0';
const LOCK_LAYER = qs.get('lock') === '1';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 760px)').matches;
document.documentElement.classList.toggle('embed', EMBED);
document.documentElement.classList.toggle('no-panel', !SHOW_PANEL);

// Model coords (feet): x, y on plane, z up  ->  three: (x, z, -y)
const W = (x, y, z = 0) => new THREE.Vector3(x, z, -y);

// ---------- DOM ----------
const viewer = document.getElementById('viewer');
const panel = document.getElementById('panel');
const tabs = document.getElementById('tabs');
const btnUnder = document.getElementById('btn-under');
const btnRoof = document.getElementById('btn-roof');
const btnReset = document.getElementById('btn-reset');
const loading = document.getElementById('loading');

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = !MOBILE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewer.appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
viewer.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const SKY = new THREE.Color('#EEF0EA');
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 3200, 6500);

const camera = new THREE.PerspectiveCamera(35, 1, 5, 20000);
const controls = new OrbitControls(camera, labelRenderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 120;
controls.maxDistance = 4200;
controls.screenSpacePanning = false;

scene.add(new THREE.HemisphereLight('#fdfbf3', '#8a8466', 1.15));
const sun = new THREE.DirectionalLight('#fff3dc', 2.1);
sun.position.set(-900, 1400, 600);
sun.target.position.set(300, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -500, right: 900, top: 600, bottom: -700, near: 100, far: 4000 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// ---------- groups ----------
const groups = {
  ground: new THREE.Group(), site: new THREE.Group(), building: new THREE.Group(),
  overview: new THREE.Group(), energy: new THREE.Group(), water: new THREE.Group(), carbon: new THREE.Group()
};
Object.values(groups).forEach(g => scene.add(g));
const animators = [];       // functions(t, dt)
const groundMats = [];      // materials that fade when looking underground

// ---------- helpers ----------
const shapeFrom = pts => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); return s; };
function flatPoly(pts, color, h = 0, opts = {}) {
  const geo = new THREE.ShapeGeometry(shapeFrom(pts));
  geo.rotateX(-Math.PI / 2); // shape (x,y) -> (x,0,-y)
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, transparent: true, opacity: opts.opacity ?? 1, polygonOffset: true, polygonOffsetFactor: -1 - h, polygonOffsetUnits: -1 - h });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = h * 0.05;
  m.receiveShadow = true;
  if (opts.ground) groundMats.push(mat);
  return m;
}
const centroid = pts => { let x = 0, y = 0; pts.forEach(p => { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; };
function inPoly(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; }
function tube(points, radius, color, opts = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
  const geo = new THREE.TubeGeometry(curve, Math.max(24, points.length * 12), radius, 8, false);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .1, transparent: !!opts.opacity, opacity: opts.opacity ?? 1, emissive: opts.emissive || '#000', emissiveIntensity: opts.ei ?? 0 });
  const m = new THREE.Mesh(geo, mat); m.userData.curve = curve; return m;
}
// particles flowing along a curve
function flow(group, points, color, { count = 24, speed = 0.06, size = 3.2, closed = false, glow = 0.9 } = {}) {
  const curve = points.isCurve ? points : new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.2);
  const geo = new THREE.SphereGeometry(size, 10, 8);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: glow, roughness: .4 });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.frustumCulled = false;
  const m4 = new THREE.Matrix4(); const p = new THREE.Vector3();
  const offs = Array.from({ length: count }, (_, i) => i / count);
  const len = curve.getLength();
  const sp = speed * 600 / Math.max(len, 1);
  const update = t => {
    for (let i = 0; i < count; i++) {
      const u = (offs[i] + t * sp) % 1;
      curve.getPointAt(u, p);
      const s = REDUCED ? 1 : 0.6 + 0.4 * Math.sin(Math.PI * u);
      m4.makeScale(s, s, s).setPosition(p); inst.setMatrixAt(i, m4);
    }
    inst.instanceMatrix.needsUpdate = true;
  };
  update(0);
  animators.push(t => { if (group.visible && !REDUCED) update(t); });
  group.add(inst);
  return curve;
}
function marker(group, pos, num, color, stopIdx) {
  const el = document.createElement('button');
  el.className = 'hotspot'; el.style.setProperty('--c', color); el.textContent = num;
  el.setAttribute('aria-label', `Stop ${num}`);
  el.addEventListener('click', e => { e.stopPropagation(); selectStop(stopIdx); });
  const o = new CSS2DObject(el); o.position.copy(pos); group.add(o); return el;
}
function place(group, pos, text, main) {
  const el = document.createElement('div'); el.className = 'place' + (main ? ' main' : ''); el.textContent = text;
  const o = new CSS2DObject(el); o.position.copy(pos); group.add(o);
}

// ---------- data ----------
const site = await (await fetch('assets/data/site.json')).json();
const pvBig = site.pv.slice().sort((a, b) => b.length - a.length);
const lot = site.parkingShared;
const lotC = centroid(lot);
const P = {}; // named anchor points (model coords [x,y,z])
const pvC = centroid(site.pv.map(centroid));
P.pv = [pvC[0], pvC[1], 26];
P.wells = [lotC[0], lotC[1], -150];
P.road = [site.chateauRoad[1][0], site.chateauRoad[1][1], 4];
P.grid = [site.chateauRoad[2][0], site.chateauRoad[2][1], 30];
P.tankD = [468, -88, -10];
P.tankN = [512, -40, -10];
const bigBasin = site.basins.slice().sort((a, b) => polyArea(b) - polyArea(a))[0];
function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; s += x1 * y2 - x2 * y1; } return Math.abs(s / 2); }
const bb = centroid(bigBasin); P.basin = [bb[0], bb[1], 3];
P.lawn = [330, -520, 2];
P.leach = [470, -360, -6];
P.soil = [60, -640, -30];
P.pasture = [-600, -800, 3];
P.overlook = [site.overlook.c[0], site.overlook.c[1], 6];
P.trailhead = [site.trailhead[0], site.trailhead[1], 4];
P.musical = [site.musical[0], site.musical[1], 30];
P.loopW = (() => { const b = site.boardwalk; let m = b[0]; b.forEach(p => { if (p[0] < m[0]) m = p; }); return [m[0], m[1], 6]; })();
const at = a => Array.isArray(a) ? W(...a) : W(...P[a]);

// ---------- ground ----------
{
  const c = centroid(site.boundary);
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const cx = cv.getContext('2d');
  cx.fillStyle = '#B7BF8E'; cx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const g = 150 + Math.random() * 60 | 0; cx.fillStyle = `rgba(${g - 20},${g},${g - 70},${.25 + Math.random() * .3})`; const r = 1 + Math.random() * 3; cx.fillRect(Math.random() * 512, Math.random() * 512, r, r); }
  for (let i = 0; i < 60; i++) { cx.fillStyle = `rgba(${200 + Math.random() * 30 | 0},${190 + Math.random() * 20 | 0},150,.18)`; cx.beginPath(); cx.arc(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 60, 0, 6.3); cx.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(18, 18); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3400, 96), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, transparent: true }));
  disc.rotation.x = -Math.PI / 2; disc.position.set(c[0] + 300, -0.6, -c[1] + 200); disc.receiveShadow = true;
  groundMats.push(disc.material); groups.ground.add(disc);
  // roads and paving
  const road = tube(site.chateauRoad.map(p => W(p[0], p[1], 0.4)), 14, '#9C9A92'); road.scale.y = 0.04; road.position.y = 0.8; groups.site.add(road);
  groups.site.add(flatPoly(lot, '#BDB6AA', 2, { ground: true }));
  groups.site.add(flatPoly(site.parkingDropoff, '#BDB6AA', 2, { ground: true }));
  // prairie basins
  site.basins.forEach(b => groups.site.add(flatPoly(b, '#6FA7A0', 3, { ground: true })));
  // the Boardwalk (loop) + overlook
  const bw = tube(site.boardwalk.map(p => W(p[0], p[1], 3)), 4.5, '#9B7651');
  bw.castShadow = true; groups.site.add(bw);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(site.overlook.r, 4, 8, 48), new THREE.MeshStandardMaterial({ color: '#9B7651', roughness: .8 }));
  ring.rotation.x = Math.PI / 2; ring.position.copy(W(site.overlook.c[0], site.overlook.c[1], 3)); groups.site.add(ring);
  // context: maintenance & land stewardship building, Medora Musical
  const box = (x, y, w, d, h, rot, color) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: .9 })); m.position.copy(W(x, y, h / 2)); m.rotation.y = rot; m.castShadow = m.receiveShadow = true; groups.site.add(m); return m; };
  box(site.omBldg[0] - 12, site.omBldg[1] + 6, 64, 38, 16, 0.7, '#CFC6B4');
  box(site.musical[0], site.musical[1], 150, 90, 24, 0.3, '#C9C3B5');
}

// ---------- building ----------
const footprints = await (await fetch('assets/data/footprints.json')).json();
const beams = await (await fetch('assets/data/beams.json')).json();
const mats = {
  roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, side: THREE.DoubleSide }),
  fascia: new THREE.MeshStandardMaterial({ color: '#6E5A45', roughness: .8, side: THREE.DoubleSide }),
  body: new THREE.MeshStandardMaterial({ color: '#B9A386', roughness: .55, metalness: .05, side: THREE.DoubleSide }),
  floor: new THREE.MeshStandardMaterial({ color: '#CFCBC2', roughness: .9 })
};
const woodColor = new THREE.Color('#C98C4E'), bodyColor = new THREE.Color('#B9A386');
const roofParts = [];
{
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('assets/models/building.glb');
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const n = (o.name + ' ' + (o.parent?.name || '')).toLowerCase();
    if (n.includes('roof')) { o.material = mats.roof; roofParts.push(o); }
    else if (n.includes('fascia')) { o.material = mats.fascia; roofParts.push(o); }
    else { o.material = mats.body; o.geometry.deleteAttribute('color'); }
    o.geometry.computeVertexNormals();
    o.castShadow = true; o.receiveShadow = true;
  });
  groups.building.add(gltf.scene);
  footprints.forEach(fp => groups.building.add(flatPoly(fp, '#CFCBC2', 4)));
}
// ---------- OVERVIEW ----------
PLACES.forEach(p => place(groups.overview, at(p.at), p.name, p.main));

// ---------- ENERGY ----------
const E = groups.energy;
{
  // solar canopies (raised panels on posts)
  const panelMat = new THREE.MeshStandardMaterial({ color: '#1E2C52', roughness: .35, metalness: .4, emissive: '#22355f', emissiveIntensity: .25 });
  const postMat = new THREE.MeshStandardMaterial({ color: '#8C6A45', roughness: .8 });
  site.pv.forEach(poly => {
    const isSmall = polyArea(poly) < 3000;
    const h = isSmall ? 18 : 16;
    const geo = new THREE.ExtrudeGeometry(shapeFrom(poly), { depth: 1.2, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, panelMat); m.position.y = h; m.castShadow = true; groups.site.add(m);
    if (!isSmall) poly.forEach((p, i) => { if (i % 2) return; const post = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, h), postMat); post.position.copy(W(p[0], p[1], h / 2)); groups.site.add(post); });
  });
  // sunlight onto panels
  pvBig.slice(0, 5).forEach((poly, k) => {
    const c = centroid(poly);
    for (let j = 0; j < 3; j++) {
      const dx = (j - 1) * 18;
      flow(E, [W(c[0] - 260 + dx, c[1] + 160, 420), W(c[0] + dx * .3, c[1], 18)], '#FFC94D', { count: 5, speed: .09, size: 2.6, glow: 1.4 });
    }
  });
  // geothermal wells under the lot
  const wellPts = [];
  { const xs = lot.map(p => p[0]), ys = lot.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    for (let s = 34; s > 6; s -= 0.5) { wellPts.length = 0;
      for (let x = x0 + s / 2; x < x1; x += s) for (let y = y0 + s / 2; y < y1; y += s) if (inPoly(x, y, lot)) wellPts.push([x, y]);
      if (wellPts.length >= 216) break; }
    wellPts.length = Math.min(216, wellPts.length); }
  const lpos = [];
  wellPts.forEach(([x, y]) => { lpos.push(x, -2, -y, x, -300, -y); });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
  const wells = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#E4703F', transparent: true, opacity: .85 }));
  E.add(wells);
  wellPts.filter((_, i) => i % 9 === 0).forEach(([x, y], i) => {
    flow(E, [W(x - 2, y, -4), W(x - 2, y, -296), W(x + 2, y, -296), W(x + 2, y, -4)], i % 2 ? '#F28A4B' : '#5FA8D9', { count: 6, speed: .05, size: 3.2 });
  });
  // depth ruler
  [0, 100, 200, 300].forEach(d => { const el = document.createElement('div'); el.className = 'ruler'; el.textContent = d ? `${d} ft` : 'ground'; const o = new CSS2DObject(el); const p0 = wellPts.reduce((a, b) => (b[0] - b[1]) > (a[0] - a[1]) ? b : a); o.position.copy(W(p0[0] + 14, p0[1] - 14, -d)); E.add(o); });
  // header to plant, plant to west building (tunnel), radiant floor glow
  const plant = W(390, 70, -6);
  flow(E, [W(lotC[0], lotC[1], -6), W((lotC[0] + 470) / 2, (lotC[1] - 40) / 2, -8), W(470, -40, -8), plant], '#F28A4B', { count: 26, speed: .07 });
  flow(E, [plant, W(330, 40, -8), W(250, 40, -8), W(150, 90, -8)], '#F28A4B', { count: 18, speed: .07 });
  const pm = new THREE.Mesh(new THREE.BoxGeometry(46, 14, 30), new THREE.MeshStandardMaterial({ color: '#E4703F', emissive: '#E4703F', emissiveIntensity: .35 }));
  pm.position.copy(plant); E.add(pm);
  const glowMat = new THREE.MeshBasicMaterial({ color: '#FF9A5A', transparent: true, opacity: .35, depthWrite: false });
  footprints.forEach(fp => { const g = new THREE.ShapeGeometry(shapeFrom(fp)); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, glowMat); m.position.y = 1.5; E.add(m); });
  animators.push(t => { glowMat.opacity = REDUCED ? .3 : .22 + .14 * Math.sin(t * 1.6); });
  // power from canopies to building, grid line
  flow(E, [W(pvC[0], pvC[1], 12), W(pvC[0] - 140, pvC[1] + 120, 6), W(470, 20, 6), W(400, 60, 8)], '#FFC94D', { count: 22, speed: .08 });
  const g0 = site.chateauRoad[3], g1 = site.chateauRoad[2];
  const gridPts = [W(g0[0], g0[1], 32), W(g1[0], g1[1], 32), W(site.chateauRoad[1][0], site.chateauRoad[1][1], 30), W(lotC[0] + 60, lotC[1] + 40, 26), W(430, 40, 20)];
  const wire = tube(gridPts, 1.2, '#7B7F86'); E.add(wire);
  gridPts.slice(0, 4).forEach(p => { const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 32), new THREE.MeshStandardMaterial({ color: '#7a5d3e' })); pole.position.set(p.x, 16, p.z); E.add(pole); });
  flow(E, gridPts, '#FFFFFF', { count: 14, speed: .05, size: 2.6, glow: .6 });
}

// ---------- WATER ----------
const H2O = groups.water;
{
  const tankMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: .5, emissive: c, emissiveIntensity: .25 });
  const tankD = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 21, 24), tankMat('#3B9BD6')); tankD.rotation.z = Math.PI / 2; tankD.rotation.y = 0.5; tankD.position.copy(at('tankD')); H2O.add(tankD);
  const tankN = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 54, 24), tankMat('#7C6FD0')); tankN.rotation.z = Math.PI / 2; tankN.rotation.y = 0.5; tankN.position.copy(at('tankN')); H2O.add(tankN);
  const mbr = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 22), tankMat('#4FB3A9')); mbr.position.copy(W(395, 30, -6)); H2O.add(mbr);
  // supply pipeline along Chateau Road to domestic tank, then into building
  const r = site.chateauRoad;
  flow(H2O, [W(r[4][0], r[4][1], -6), W(r[3][0], r[3][1], -6), W(r[2][0], r[2][1], -6), W(r[1][0], r[1][1], -6), W(r[0][0], r[0][1], -6), W(620, -100, -8), at('tankD')], '#3B9BD6', { count: 40, speed: .06 });
  flow(H2O, [at('tankD'), W(430, -40, -6), W(330, 60, 2), W(200, 90, 4)], '#3B9BD6', { count: 18, speed: .06 });
  // wastewater to treatment, treated to recycled tank, back in to toilets, surplus to leach field
  flow(H2O, [W(150, 110, 2), W(300, 40, -6), W(395, 30, -6)], '#9A8A6A', { count: 16, speed: .05 });
  flow(H2O, [W(395, 30, -6), W(470, -10, -8), at('tankN')], '#4FB3A9', { count: 12, speed: .06 });
  flow(H2O, [at('tankN'), W(440, 20, -2), W(320, 120, 3), W(180, 140, 4)], '#7C6FD0', { count: 18, speed: .06 });
  flow(H2O, [at('tankN'), W(520, -150, -6), W(500, -280, -6), at('leach')], '#7C6FD0', { count: 14, speed: .05 });
  // leach field trenches
  const lf = new THREE.Group();
  for (let i = 0; i < 7; i++) { const tr = new THREE.Mesh(new THREE.BoxGeometry(150, 2, 3), new THREE.MeshStandardMaterial({ color: '#7C6FD0', transparent: true, opacity: .8 })); tr.position.copy(W(470, -330 - i * 12, -6)); lf.add(tr); }
  lf.rotation.y = 0; H2O.add(lf);
  // seep down from leach field
  for (let i = 0; i < 5; i++) flow(H2O, [W(420 + i * 25, -350, -7), W(420 + i * 25 + 10, -365, -60)], '#7C6FD0', { count: 4, speed: .03, size: 2.2, glow: .5 });
  // rain on roof + site, roof runoff to basins
  const rainN = MOBILE ? 220 : 520;
  const rg = new THREE.BufferGeometry(); const rp = new Float32Array(rainN * 6);
  const area = { x0: -250, x1: 900, y0: -600, y1: 300 };
  const drops = Array.from({ length: rainN }, () => ({ x: area.x0 + Math.random() * (area.x1 - area.x0), y: area.y0 + Math.random() * (area.y1 - area.y0), z: Math.random() * 380 }));
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#5AA9D6', transparent: true, opacity: .55 }));
  rain.frustumCulled = false; H2O.add(rain);
  let lastT = 0;
  const drawRain = (dt) => { drops.forEach((d, i) => { d.z -= dt * 260; if (d.z < 0) d.z += 380; const k = i * 6; rp[k] = d.x; rp[k + 1] = d.z; rp[k + 2] = -d.y; rp[k + 3] = d.x - 2; rp[k + 4] = d.z + 9; rp[k + 5] = -d.y; }); rg.attributes.position.needsUpdate = true; };
  drawRain(0);
  animators.push(t => { const dt = Math.min(.05, t - lastT); lastT = t; if (H2O.visible && !REDUCED) drawRain(dt); });
  // runoff paths from roof edges to basins
  site.basins.forEach((b, i) => {
    const c = centroid(b);
    const start = [Math.min(Math.max(c[0], 20), 560), Math.min(Math.max(c[1], -30), 210)];
    flow(H2O, [W(start[0], start[1], 30), W((start[0] + c[0]) / 2, (start[1] + c[1]) / 2, 6), W(c[0], c[1], 1.5)], '#5AA9D6', { count: 8, speed: .05, size: 2.6 });
  });
  // basins glow
  const bm = new THREE.MeshBasicMaterial({ color: '#4FC0E8', transparent: true, opacity: .45, depthWrite: false });
  site.basins.forEach(b => { const g = new THREE.ShapeGeometry(shapeFrom(b)); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, bm); m.position.y = .5; H2O.add(m); });
  animators.push(t => { bm.opacity = REDUCED ? .45 : .35 + .15 * Math.sin(t * 1.2); });
}

// ---------- CARBON ----------
const C = groups.carbon;
{
  // glulam beam grid (mass timber) shown under the roof
  const beamMat = new THREE.MeshStandardMaterial({ color: '#D08A45', emissive: '#B8692C', emissiveIntensity: .35, roughness: .6 });
  beams.forEach(b => { if (b.length < 3) return; const pts = b.map(p => new THREE.Vector3(p[0], p[1], p[2])); const curve = new THREE.CatmullRomCurve3(pts); const m = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, 1.6, 6, false), beamMat); m.castShadow = true; C.add(m); });
  [[20, 0], [140, 80]].forEach(() => {});

  // CO2 drifting down into prairie and roots storing it below
  const prairie = [];
  let guard = 0;
  const xs = site.boundary.map(p => p[0]), ys = site.boundary.map(p => p[1]);
  while (prairie.length < (MOBILE ? 160 : 320) && guard++ < 20000) {
    const x = Math.min(...xs) + Math.random() * (Math.max(...xs) - Math.min(...xs));
    const y = Math.min(...ys) + Math.random() * (Math.max(...ys) - Math.min(...ys));
    if (!inPoly(x, y, site.boundary)) continue;
    if (inPoly(x, y, lot) || inPoly(x, y, site.parkingDropoff) || inPoly(x, y, site.roofPlan)) continue;
    if (x > -20 && x < 620 && y > -70 && y < 230) continue;
    prairie.push([x, y]);
  }
  const rootPos = [];
  prairie.forEach(([x, y]) => { const d = 8 + Math.random() * 14; for (let k = 0; k < 3; k++) { const a = Math.random() * 6.28, r = 2 + Math.random() * 4; rootPos.push(x, -0.5, -y, x + Math.cos(a) * r, -d, -y + Math.sin(a) * r); } });
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rootPos, 3));
  C.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#5E8A3A', transparent: true, opacity: .9 })));
  prairie.filter((_, i) => i % 4 === 0).forEach(([x, y]) => flow(C, [W(x + 30, y + 20, 160), W(x, y, 2), W(x + 1, y, -14)], '#5C7F8F', { count: 3, speed: .025, size: 3.6, glow: .5 }));
  // roof prairie: carbon into the roof
  for (let i = 0; i < (MOBILE ? 10 : 22); i++) { const x = 30 + Math.random() * 520, y = -10 + Math.random() * 210; flow(C, [W(x + 25, y + 15, 200), W(x, y, 42)], '#5C7F8F', { count: 3, speed: .025, size: 3.6, glow: .5 }); }
  // soil core baseline: a few cores in the prairie
  prairie.filter((_, i) => i % 20 === 0).slice(0, 12).forEach(([x, y]) => { const core = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 22, 10), new THREE.MeshStandardMaterial({ color: '#6B4E2E', emissive: '#6B4E2E', emissiveIntensity: .2 })); core.position.copy(W(x, y, -11)); C.add(core); });
  // grazing paddocks hint: fence lines in the west pasture
  const fp = []; for (let i = 0; i < 4; i++) { const x = -820 + i * 120; fp.push(x, 1.5, 700, x, 1.5, 980); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  C.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: '#6B5A3E' })));
}

// ---------- hotspots per layer ----------
const hotspotEls = { energy: [], water: [], carbon: [] };
['energy', 'water', 'carbon'].forEach(k => LAYERS[k].stops.forEach((s, i) => { hotspotEls[k].push(marker(groups[k], at(s.at), i + 1, LAYERS[k].color, i)); }));

// ---------- state ----------
let layer = 'overview', stop = -1, under = false, roofOff = false;
const HOME = { target: W(360, -90, 0), pos: W(1020, -900, 640) };
const fly = { active: false };
function flyTo(target, pos, dur = 1.2) {
  fly.t0 = performance.now(); fly.dur = dur * 1000; fly.fromT = controls.target.clone(); fly.fromP = camera.position.clone(); fly.toT = target.clone(); fly.toP = pos.clone(); fly.active = !REDUCED;
  if (REDUCED) { controls.target.copy(target); camera.position.copy(pos); }
}
function viewFor(s) {
  const t = at(s.at); const v = s.view || { dist: 600, tilt: 1 };
  const dir = new THREE.Vector3().subVectors(HOME.pos, HOME.target).setY(0).normalize();
  const elev = Math.max(0.25, Math.min(1.35, v.tilt)) * 0.75;
  const pos = t.clone().add(dir.multiplyScalar(Math.cos(elev) * v.dist)).add(new THREE.Vector3(0, Math.sin(elev) * v.dist, 0));
  if (pos.y < 40) pos.y = 40;
  return { t, pos };
}
function setUnder(v) {
  under = v; btnUnder.setAttribute('aria-pressed', v);
  groundMats.forEach(m => { m.opacity = v ? 0.28 : 1; m.depthWrite = !v; });
  controls.maxPolarAngle = v ? Math.PI * 0.62 : Math.PI * 0.49;
}
function setRoof(off) { roofOff = off; btnRoof.setAttribute('aria-pressed', off); roofParts.forEach(m => m.visible = !off); }
function setWood(on) { mats.body.color.copy(on ? woodColor : bodyColor); }

function setLayer(k, opts = {}) {
  layer = k; stop = -1;
  ['overview', 'energy', 'water', 'carbon'].forEach(n => { groups[n].visible = n === k; groups[n].traverse(o => { if (o.isCSS2DObject) { o.visible = n === k; o.element.style.display = n === k ? '' : 'none'; } }); });
  [...tabs.querySelectorAll('button')].forEach(b => b.setAttribute('aria-selected', b.dataset.layer === k));
  document.documentElement.style.setProperty('--layer', LAYERS[k].color || '#1B4633');
  setUnder(k === 'energy' || k === 'water' || k === 'carbon' ? opts.under ?? false : false);
  setRoof(false); setWood(k === 'carbon');
  renderPanel();
  if (!opts.noFly) flyTo(HOME.target, HOME.pos);
  if (!EMBED && !opts.noHash) history.replaceState(null, '', `#${k}`);
}
function selectStop(i) {
  const L = LAYERS[layer]; if (!L.stops[i]) return;
  stop = i; const s = L.stops[i];
  setUnder(!!s.underground);
  setRoof(s.roof === false);
  setWood(layer === 'carbon');
  hotspotEls[layer].forEach((el, j) => el.classList.toggle('active', j === i));
  const v = viewFor(s); flyTo(v.t, v.pos);
  renderPanel();
  if (!EMBED) history.replaceState(null, '', `#${layer}/${i + 1}`);
}

// ---------- panel ----------
function renderPanel() {
  const L = LAYERS[layer];
  const stats = L.stats.length ? `<div class="stats">${L.stats.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('')}</div>${L.statNote ? `<p class="statnote">${L.statNote}</p>` : ''}` : '';
  let body = '';
  if (layer === 'overview') {
    body = `<div class="pick">${['energy', 'water', 'carbon'].map(k => `<button data-go="${k}" style="--c:${LAYERS[k].color}"><b>${LAYERS[k].label}</b><span>${LAYERS[k].stops.length} stops</span></button>`).join('')}</div>`;
  } else {
    body = `<ol class="stops">${L.stops.map((s, i) => `<li class="${i === stop ? 'open' : ''}"><button data-stop="${i}" aria-expanded="${i === stop}"><i>${i + 1}</i>${s.title}</button>${i === stop ? `<div class="detail"><p>${s.text}</p><div class="nav">${i > 0 ? `<button data-stop="${i - 1}">‹ Back</button>` : '<span></span>'}${i < L.stops.length - 1 ? `<button data-stop="${i + 1}" class="next">Next ›</button>` : `<button data-go="overview" class="next">All systems</button>`}</div></div>` : ''}</li>`).join('')}</ol>`;
  }
  panel.querySelector('.panel-body').innerHTML = `<div class="eyebrow">Theodore Roosevelt Presidential Library</div><h2>${L.title}</h2><p class="intro">${L.intro}</p>${stats}${body}<p class="note">${NOTE}</p>`;
  panel.querySelectorAll('[data-stop]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.stop; if (i === stop && b.closest('li') && !b.classList.contains('next')) { stop = -1; renderPanel(); hotspotEls[layer].forEach(el => el.classList.remove('active')); return; } selectStop(i); }));
  panel.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => setLayer(b.dataset.go)));
  const open = panel.querySelector('li.open'); if (open) open.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
}

// ---------- controls ----------
tabs.innerHTML = ['overview', 'energy', 'water', 'carbon'].map(k => `<button role="tab" data-layer="${k}" style="--c:${LAYERS[k].color || '#1B4633'}">${LAYERS[k].label}</button>`).join('');
tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => setLayer(b.dataset.layer)));
if (LOCK_LAYER) tabs.hidden = true;
btnUnder.addEventListener('click', () => setUnder(!under));
btnRoof.addEventListener('click', () => setRoof(!roofOff));
btnReset.addEventListener('click', () => flyTo(HOME.target, HOME.pos));
panel.querySelector('.panel-toggle')?.addEventListener('click', () => panel.classList.toggle('collapsed'));

// ---------- resize / loop ----------
function resize() {
  const w = viewer.clientWidth, h = viewer.clientHeight;
  renderer.setSize(w, h, false); labelRenderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewer); resize();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  if (fly.active) {
    const u = Math.min(1, (performance.now() - fly.t0) / fly.dur), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    controls.target.lerpVectors(fly.fromT, fly.toT, e); camera.position.lerpVectors(fly.fromP, fly.toP, e);
    if (u >= 1) fly.active = false;
  }
  animators.forEach(f => f(t));
  controls.update();
  renderer.render(scene, camera); labelRenderer.render(scene, camera);
});

// ---------- start ----------
camera.position.copy(HOME.pos); controls.target.copy(HOME.target);
const fromHash = location.hash.slice(1).split('/');
const startLayer = qs.get('layer') || fromHash[0];
const startStop = +(qs.get('stop') || fromHash[1] || 0);
setLayer(LAYERS[startLayer] ? startLayer : 'overview', { noFly: true, noHash: true });
if (startStop && LAYERS[layer].stops[startStop - 1]) selectStop(startStop - 1);
loading.classList.add('done');
window.__ready = true;
