// たこ焼きくるくる 本体。3D は Three.js（vendor/）。文言とデータは data.js、音は snd.js
import * as THREE from './vendor/three.module.js'

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)]
const STEP = 1 / 60, GAME_T = 60, NH = 8
const SP = 0.95, BR = 0.36                       // 穴の間隔と玉の半径（ワールド）
const RATE1 = 0.3, RATE2 = 0.34, RATE_HOLD = 0.2 // 焼ける速さ（1面目・2面目・焼き上がり後に焦げる速さ）
const W_LO = 0.62, W_HI = 0.82, EARLY = 0.5, BURN = 1.05, LATE_SLOW = 0.6  // 濃いめ〜焦げの間は少しゆっくり
const HEAT_COL = [0.82, 1.28, 1.28, 0.82], HEAT_ROW = [1.06, 0.94]
const CUST_Z = -2.75, FLOOR_Y = -1.3, BOAT_POS = new THREE.Vector3(0, 0.2, -1.5)
const SERVE = { sauce: 0.2, mayo: 0.4, nori: 0.55, dance: 0.7, slide: 1.0, hand: 1.3 }

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 } }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, k) => a + (b - a) * k
const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '')
const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3)
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k) }
const isTouch = () => matchMedia('(pointer:coarse)').matches
const T = k => TXT[S.lang][k] ?? TXT.ja[k]
const L = o => o[S.lang]
const tapWord = () => T(isTouch() ? 'tapT' : 'tapC')

// ---------- 状態
const S = {
  lang: 'ja', view: 'title', mode: 'demo', quiet: true, t: 0, left: GAME_T, ph: 'idle', pt: 0, seed: 1, r: Math.random,
  holes: [], boat: null, cur: null, nextC: null, lastCust: null, serve: null, combo: 0,
  st: null, lastBoat: null, result: null, rt: 0, shown: 0, tut: 0, bot: null, botCd: 0, br: rng(9), demoR: rng(7),
}
function newStats() { return { boats: 0, perfect: 0, ok: 0, burntServed: 0, char: 0, burntBall: 0, splat: 0, leftCust: 0, taps: 0, flips: 0, pflips: 0, maxCombo: 0 } }

// ---------- 焼き色（d: 0=生 → 1.05=炭）
const COL_STOPS = [[0, '#f6ecc4'], [0.4, '#f0dc9c'], [0.52, '#ecc878'], [0.6, '#e2a94e'], [0.66, '#d98b2e'], [0.76, '#cc7a2a'], [0.84, '#b0621f'], [0.92, '#7a3e16'], [0.99, '#3a1c0c'], [1.05, '#171010']].map(([d, c]) => [d, new THREE.Color(c)])
function batterCol(d, out = new THREE.Color()) {
  if (d <= 0) return out.copy(COL_STOPS[0][1])
  for (let i = 1; i < COL_STOPS.length; i++) if (d <= COL_STOPS[i][0]) { const [a, ca] = COL_STOPS[i - 1], [b, cb] = COL_STOPS[i]; return out.copy(ca).lerp(cb, (d - a) / (b - a)) }
  return out.copy(COL_STOPS.at(-1)[1])
}
const CHAR = new THREE.Color('#141010')
function ballCol(dSide, hold, out = new THREE.Color()) { batterCol(dSide, out); return out.lerp(CHAR, smooth(0.45, 1, hold) * 0.95) }
const hex = c => '#' + c.getHexString()

// ---------- 顔（Canvas。3D の顔・アイコン・結果画像で共用）
function drawFace(x, id, mood, size, full) {
  const s = size / 200; x.save(); x.scale(s, s); x.lineCap = 'round'; x.lineJoin = 'round'
  const c = id === 'boss' ? { skin: '#e3a878', hair: '#2a2a2a' } : CUSTOMERS[id]
  if (full) {
    x.fillStyle = '#3a2a4a'; x.fillRect(0, 0, 200, 200)
    x.fillStyle = mood === 'mad' ? '#f08a70' : c.skin; x.beginPath(); x.arc(100, 112, 74, 0, 7); x.fill()
    x.fillStyle = c.hair
    if (id === 'tetsu') { for (const sx of [-1, 1]) { x.beginPath(); x.ellipse(100 + sx * 70, 100, 14, 26, 0, 0, 7); x.fill() } }
    if (id === 'yuta') { x.fillStyle = '#2d6cc0'; x.beginPath(); x.arc(100, 92, 76, Math.PI, 0); x.fill(); x.fillRect(150, 84, 46, 12) }
    if (id === 'mike') { x.fillStyle = '#e8d28a'; x.fillRect(10, 52, 180, 12); x.beginPath(); x.ellipse(100, 50, 56, 26, 0, Math.PI, 0); x.fill(); x.fillStyle = '#2fa585'; x.fillRect(46, 44, 108, 9) }
    if (id === 'machiko') { x.fillStyle = c.hair; for (let i = 0; i < 9; i++) { const a = Math.PI + i / 8 * Math.PI; x.beginPath(); x.arc(100 + Math.cos(a) * 70, 100 + Math.sin(a) * 62, 22, 0, 7); x.fill() } }
    if (id === 'boss') { x.fillStyle = '#fff'; x.save(); x.translate(100, 66); x.rotate(-0.08); x.fillRect(-78, -10, 156, 20); x.restore(); x.fillStyle = '#d8352a'; x.beginPath(); x.arc(170, 60, 10, 0, 7); x.fill() }
  }
  const ink = '#24170f'; x.strokeStyle = ink; x.fillStyle = ink; x.lineWidth = 7
  const eye = (cx, cy) => { x.beginPath(); x.arc(cx, cy, 8, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + 3, cy - 3, 2.6, 0, 7); x.fill(); x.fillStyle = ink }
  const L = (pts) => { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.stroke() }
  if (id === 'boss') {
    L([62, 98, 86, 100]); eye(130, 102); L([60, 84, 88, 90]); L([112, 88, 142, 84])
    x.lineWidth = 9; x.beginPath(); x.moveTo(70, 132); x.quadraticCurveTo(100, 118, 130, 132); x.stroke()
    x.lineWidth = 7; x.beginPath(); x.moveTo(78, 150); x.quadraticCurveTo(100, 140, 122, 152); x.stroke()
    x.fillStyle = '#7fc8ff'; x.beginPath(); x.moveTo(160, 80); x.quadraticCurveTo(172, 100, 160, 106); x.quadraticCurveTo(150, 100, 160, 80); x.fill()
    x.restore(); return
  }
  // 目
  if (mood === 'wow') { x.fillStyle = '#ffcf3a'; for (const ex of [72, 128]) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 : 15; x.lineTo(ex + Math.cos(a) * r, 100 + Math.sin(a) * r) } x.closePath(); x.fill(); x.stroke() } x.fillStyle = ink }
  else if (mood === 'mad') { L([56, 82, 86, 94]); L([144, 82, 114, 94]); eye(74, 104); eye(126, 104) }
  else if (mood === 'cry') { L([60, 100, 84, 96]); L([116, 96, 140, 100]); x.fillStyle = '#6ac0ff'; for (const ex of [70, 130]) { x.beginPath(); x.ellipse(ex, 124, 8, 16, 0, 0, 7); x.fill() } x.fillStyle = ink }
  else if (mood === 'huh') { L([60, 100, 86, 100]); L([114, 100, 140, 100]); L([58, 84, 84, 80]) }
  else { eye(74, 100); eye(126, 100) }
  if (id === 'mike') { x.lineWidth = 5; x.strokeStyle = '#3a2a1a'; for (const ex of [74, 126]) { x.beginPath(); x.arc(ex, 100, 20, 0, 7); x.stroke() } L([94, 100, 106, 100]); x.strokeStyle = ink; x.lineWidth = 7 }
  // 口
  if (mood === 'wow') { x.fillStyle = '#7a1a1a'; x.beginPath(); x.moveTo(72, 128); x.quadraticCurveTo(100, 176, 128, 128); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#ff7a8a'; x.beginPath(); x.ellipse(100, 150, 12, 7, 0, 0, 7); x.fill() }
  else if (mood === 'mad') { x.fillStyle = '#7a1a1a'; x.beginPath(); x.ellipse(100, 148, 24, 16, 0, 0, 7); x.fill(); x.stroke(); x.fillStyle = '#fff'; x.fillRect(84, 136, 32, 7) }
  else if (mood === 'cry') { x.beginPath(); x.moveTo(78, 152); x.quadraticCurveTo(100, 128, 122, 152); x.stroke() }
  else if (mood === 'huh') { L([84, 146, 116, 142]); x.fillStyle = '#7fc8ff'; x.beginPath(); x.moveTo(150, 70); x.quadraticCurveTo(162, 90, 150, 96); x.quadraticCurveTo(140, 90, 150, 70); x.fill(); x.fillStyle = ink }
  else { x.beginPath(); x.arc(100, 128, 18, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke() }
  if (id === 'tetsu') { x.fillStyle = '#2a2a2a'; x.fillRect(88, 116, 24, 8) }
  if (id === 'machiko') { x.strokeStyle = '#d8203a'; x.lineWidth = 5; x.beginPath(); x.arc(100, mood === 'wow' || mood === 'mad' ? 146 : 128, 20, 0.2, Math.PI - 0.2); x.stroke(); x.fillStyle = '#ff8aa0'; for (const ex of [52, 148]) { x.globalAlpha = 0.5; x.beginPath(); x.ellipse(ex, 124, 12, 7, 0, 0, 7); x.fill() } x.globalAlpha = 1 }
  if (id === 'yuta') { x.fillStyle = '#f5e2b8'; x.save(); x.translate(100, 118); x.rotate(0.3); x.fillRect(-14, -5, 28, 10); x.restore() }
  x.restore()
}
const faceUrlCache = {}
function faceUrl(id, mood = 'normal') { const k = id + mood; if (!faceUrlCache[k]) { const c = document.createElement('canvas'); c.width = c.height = 128; drawFace(c.getContext('2d'), id, mood, 128, true); faceUrlCache[k] = c.toDataURL() } return faceUrlCache[k] }
function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath() }

// ---------- 3D
const renderer = new THREE.WebGLRenderer({ canvas: $('#world'), antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
const scene = new THREE.Scene()
scene.background = new THREE.Color('#16122a'); scene.fog = new THREE.Fog('#16122a', 11, 30)
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80)
scene.add(new THREE.HemisphereLight('#ffe2c0', '#3a2a50', 1.5))
const key = new THREE.DirectionalLight('#fff1dc', 1.6); key.position.set(1.5, 8, 5); scene.add(key)
const warm = new THREE.PointLight('#ff8a3a', 10, 8, 1.6); warm.position.set(0, 1.4, 0.4); scene.add(warm)

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
const lam = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o })
function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = scene) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m }
const R0 = rng(31)

// 地面・屋台
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), lam('#241c2c')); floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; scene.add(floor)
const woodTex = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#8a5a2e'; x.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(60,30,10,${0.1 + R0() * 0.2})`; x.lineWidth = 1 + R0() * 2; x.beginPath(); const y = R0() * h; x.moveTo(0, y); x.bezierCurveTo(w / 3, y + 4, w * 2 / 3, y - 4, w, y + 2); x.stroke() } })
const woodMat = lam('#ffffff', { map: woodTex })
box(5.6, 1.2, 3.0, woodMat, 0, -0.72, 0.1)                                  // 台
box(5.6, 0.12, 0.75, woodMat, 0, 0.11, -1.52)                               // 受け渡しの棚
box(5.8, 1.5, 0.2, lam('#b8352a'), 0, -0.55, -1.86)                          // 前板
const ironTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#3a3634'; x.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${R0() < 0.5 ? '0,0,0' : '120,100,80'},${0.05 + R0() * 0.1})`; x.fillRect(R0() * w, R0() * h, 2 + R0() * 3, 2 + R0() * 3) } })
const plate = box(4.15, 0.16, 2.2, new THREE.MeshStandardMaterial({ color: '#ffffff', map: ironTex, roughness: 0.55, metalness: 0.45 }), 0, -0.08, 0)
box(4.35, 0.08, 2.4, lam('#1e1a1a'), 0, -0.2, 0)
const holeTex = canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(64, 58, 4, 64, 64, 64); g.addColorStop(0, '#060404'); g.addColorStop(0.7, '#1a1412'); g.addColorStop(0.86, '#4a4440'); g.addColorStop(0.94, '#2a2422'); g.addColorStop(1, 'rgba(40,36,34,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h) })
const batterTex = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { const v = 200 + R0() * 55; x.fillStyle = `rgba(${v},${v * 0.92},${v * 0.8},0.6)`; x.beginPath(); x.arc(R0() * w, R0() * h, 1 + R0() * 4, 0, 7); x.fill() } })
// 柱・屋根・提灯・のれん
const postMat = lam('#5c3a1c')
for (const sx of [-1, 1]) box(0.16, 4.6, 0.16, postMat, sx * 2.85, 1.0, -1.9)
const awnTex = canvasTex(256, 64, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f6efe0' : '#d8352a'; x.fillRect(i * w / 8, 0, w / 8, h) } })
const awn = box(6.2, 0.08, 1.6, lam('#ffffff', { map: awnTex }), 0, 4.3, -2.6); awn.rotation.x = -0.25
const norenTex = canvasTex(1024, 256, (x, w, h) => { x.fillStyle = '#23306a'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < w; i += 6) x.fillRect(i, 0, 2, h); x.fillStyle = '#fff4dc'; x.font = `150px 'Dela Gothic One','Hiragino Sans',sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; const s = 'たこ焼き'; for (let i = 0; i < 4; i++) x.fillText(s[i], w * (i + 0.5) / 4, h * 0.55) })
const noren = new THREE.Group(); scene.add(noren); noren.position.set(0, 3.05, -1.95)
for (let i = 0; i < 4; i++) { const t = norenTex.clone(); t.needsUpdate = true; t.repeat.set(0.25, 1); t.offset.set(i * 0.25, 0); const m = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.66), lam('#ffffff', { map: t, side: THREE.DoubleSide })); m.position.set((i - 1.5) * 1.38, 0, 0); m.rotation.y = Math.PI; m.scale.x = -1; noren.add(m) }
const chTex = canvasTex(256, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#7a0e0e'); g.addColorStop(0.5, '#ff5a2a'); g.addColorStop(1, '#7a0e0e'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(60,0,0,.45)'; x.lineWidth = 3; for (let y = 12; y < h; y += 18) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke() } x.fillStyle = '#1a0a08'; x.fillRect(0, 0, w, 16); x.fillRect(0, h - 16, w, 16); x.fillStyle = '#ffe9b0'; x.font = `110px 'Dela Gothic One','Hiragino Sans',sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('蛸', w / 4, h / 2); x.fillText('蛸', w * 3 / 4, h / 2) })
const chochins = []
for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), new THREE.MeshBasicMaterial({ map: chTex })); m.scale.y = 1.3; m.position.set(sx * 2.85, 2.55, -1.6); scene.add(m); chochins.push(m) }
// 奥の屋台の灯り
const lampMat = new THREE.MeshBasicMaterial({ color: '#ffb35a' }), lampGeo = new THREE.SphereGeometry(0.16, 8, 6)
const STALL_COL = ['#c8383a', '#2f7fbf', '#e0a020', '#3f9b4a', '#b0408a']
for (let i = 0; i < 9; i++) {
  const x = -11 + i * 2.8 + (R0() - 0.5), z = -9 - R0() * 3
  const g = new THREE.Group(); g.position.set(x, FLOOR_Y, z); scene.add(g)
  box(2.2, 1.3, 1.2, lam('#3a2a20'), 0, 0.65, 0, g); const roof = box(2.5, 0.1, 1.5, lam(STALL_COL[i % 5]), 0, 2.4, 0.2, g); roof.rotation.x = 0.3
  for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(lampGeo, lampMat); l.position.set(-0.8 + k * 0.8, 2.1, 0.7); g.add(l) }
}
for (let i = 0; i < 26; i++) { const l = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff6a3a' : '#ffd27a' })); l.position.set(-12 + i, 3.6 + Math.sin(i * 0.7) * 0.25, -6.5); scene.add(l) }

// 穴（8個）
const ballGeoTop = new THREE.SphereGeometry(BR, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)
const diskGeo = new THREE.CylinderGeometry(BR * 1.1, BR * 0.98, 0.07, 22)
const takoGeo = new THREE.SphereGeometry(0.09, 8, 6), takoMat = lam('#b8324a')
const holePos = i => new THREE.Vector3((((i & 3)) - 1.5) * SP, 0, ((i >> 2) - 0.5) * SP)
const holes3 = []
for (let i = 0; i < NH; i++) {
  const p = holePos(i), g = new THREE.Group(); g.position.copy(p); scene.add(g)
  const hole = new THREE.Mesh(new THREE.CircleGeometry(BR * 1.18, 24), new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false })); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.004; g.add(hole)
  const disk = new THREE.Mesh(diskGeo, lam('#ffffff', { map: batterTex })); disk.position.y = 0.03; disk.visible = false; g.add(disk)
  const tako = new THREE.Mesh(takoGeo, takoMat); tako.scale.set(1.3, 0.7, 1); tako.position.y = 0.07; disk.add(tako)
  const ball = new THREE.Group(); ball.visible = false; g.add(ball)
  const spin = new THREE.Group(); ball.add(spin)
  const hA = new THREE.Mesh(ballGeoTop, lam('#ffffff', { map: batterTex })), hB = new THREE.Mesh(ballGeoTop, lam('#ffffff', { map: batterTex })); hB.rotation.x = Math.PI; spin.add(hA); spin.add(hB)
  const pourBlob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lam('#f6ecc4')); pourBlob.visible = false; g.add(pourBlob)
  holes3.push({ g, disk, tako, ball, spin, hA, hB, pourBlob })
}
// ピック
const pick = new THREE.Group(); scene.add(pick)
{ const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.004, 0.7, 6), new THREE.MeshStandardMaterial({ color: '#d8dce0', metalness: 0.8, roughness: 0.3 })); m.position.y = 0.35; pick.add(m)
  const hnd = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.45, 8), lam('#a8672a')); hnd.position.y = 0.92; pick.add(hnd) }
const PICK_HOME = new THREE.Vector3(2.35, 0.25, 0.9)
pick.position.copy(PICK_HOME); pick.rotation.z = 0.5
const pk = { tgt: PICK_HOME.clone(), twirl: 0, t: 9 }
// 舟皿
const boatG = new THREE.Group(); boatG.position.copy(BOAT_POS); scene.add(boatG)
const kyogiTex = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#e2c08c'; x.fillRect(0, 0, w, h); for (let i = 0; i < 50; i++) { x.strokeStyle = `rgba(150,100,50,${0.1 + R0() * 0.2})`; x.lineWidth = 1; x.beginPath(); const y = R0() * h; x.moveTo(0, y); x.lineTo(w, y + (R0() - 0.5) * 6); x.stroke() } })
const kyogi = lam('#ffffff', { map: kyogiTex })
box(1.34, 0.035, 0.66, kyogi, 0, 0, 0, boatG)
for (const sz of [-1, 1]) { const w = box(1.42, 0.13, 0.03, kyogi, 0, 0.06, sz * 0.34, boatG); w.rotation.x = sz * 0.35 }
for (const sx of [-1, 1]) { const w = box(0.03, 0.13, 0.7, kyogi, sx * 0.7, 0.06, 0, boatG); w.rotation.z = -sx * 0.35 }
const mini = [], sauceCaps = []
const miniGeo = new THREE.SphereGeometry(0.13, 14, 10), capGeo = new THREE.SphereGeometry(0.137, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42)
const slotPos = k => new THREE.Vector3(((k & 3) - 1.5) * 0.3, 0.14, ((k >> 2) - 0.5) * 0.29)
for (let k = 0; k < 8; k++) {
  const m = new THREE.Mesh(miniGeo, lam('#ffffff', { map: batterTex })); m.position.copy(slotPos(k)); m.visible = false; boatG.add(m); mini.push(m)
  const cp = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: '#4a2210', roughness: 0.25, metalness: 0.1 })); cp.visible = false; m.add(cp); sauceCaps.push(cp)
}
const mayoLines = []
for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.15, 6), lam('#fff8e0')); m.rotation.z = Math.PI / 2; m.rotation.y = (k % 2 ? 0.35 : -0.35); m.position.set(0, 0.29, -0.2 + k * 0.13); m.visible = false; boatG.add(m); mayoLines.push(m) }
const noriGeo = new THREE.BufferGeometry(); { const a = []; for (let i = 0; i < 90; i++) a.push((R0() - 0.5) * 1.15, 0.27 + R0() * 0.04, (R0() - 0.5) * 0.55); noriGeo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)) }
const nori = new THREE.Points(noriGeo, new THREE.PointsMaterial({ color: '#3f7a22', size: 0.035 })); nori.visible = false; boatG.add(nori)
const katsuo = []
const katsuoMat = new THREE.MeshLambertMaterial({ color: '#e9b49a', side: THREE.DoubleSide })
for (let k = 0; k < 12; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.08), katsuoMat); m.position.set(((k % 6) - 2.5) * 0.2, 0.31, (Math.floor(k / 6) - 0.5) * 0.24); m.visible = false; m.userData.ph = R0() * 6; boatG.add(m); katsuo.push(m) }
const flyer = new THREE.Mesh(new THREE.SphereGeometry(BR * 0.7, 14, 10), lam('#ffffff', { map: batterTex })); flyer.visible = false; scene.add(flyer)
// 湯気と煙（使い回し）
const puffTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64) })
const puffs = []
for (let i = 0; i < 46; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 })); m.visible = false; scene.add(m); puffs.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, dark: false, s0: 0.3 }) }
let puffI = 0
function puff(p, dark, s0 = 0.35, vy = 0.6) {
  const o = puffs[puffI++ % puffs.length]; o.m.visible = true; o.life = 0; o.max = dark ? 1.4 : 1.1; o.dark = dark; o.s0 = s0
  o.m.position.set(p.x + (S.r() - 0.5) * 0.2, p.y + 0.15, p.z + (S.r() - 0.5) * 0.2); o.vx = (S.r() - 0.5) * 0.15; o.vy = vy * (0.8 + S.r() * 0.4); o.vz = (S.r() - 0.5) * 0.1
  o.m.material.color.set(dark ? '#1a1414' : '#ffffff')
}
function updatePuffs(dt) {
  for (const o of puffs) {
    if (!o.m.visible) continue; o.life += dt; if (o.life >= o.max) { o.m.visible = false; continue }
    const k = o.life / o.max; o.m.position.x += o.vx * dt; o.m.position.y += o.vy * dt; o.m.position.z += o.vz * dt
    o.m.scale.setScalar(o.s0 + k * (o.dark ? 1.0 : 0.6)); o.m.material.opacity = (o.dark ? 0.85 : 0.45) * Math.sin(Math.PI * k)
  }
}

// お客さん
const custs = {}
const leopardTex = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#e0a840'; x.fillRect(0, 0, w, h); const r = rng(5); for (let i = 0; i < 26; i++) { const cx = r() * w, cy = r() * h; x.fillStyle = '#3a2210'; x.beginPath(); x.ellipse(cx, cy, 7, 5, r() * 3, 0, 7); x.fill(); x.fillStyle = '#b06a20'; x.beginPath(); x.ellipse(cx, cy, 3.5, 2.5, 0, 0, 7); x.fill() } })
const alohaTex = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#e85a8a'; x.fillRect(0, 0, w, h); const r = rng(8); for (let i = 0; i < 12; i++) { const cx = r() * w, cy = r() * h; x.fillStyle = '#fff4dc'; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; x.beginPath(); x.arc(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 4.5, 0, 7); x.fill() } x.fillStyle = '#f4c03e'; x.beginPath(); x.arc(cx, cy, 3, 0, 7); x.fill() } })
function makeCustomer(id) {
  const c = CUSTOMERS[id], g = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group()
  const skin = lam(c.skin), hair = lam(c.hair)
  const shirt = id === 'machiko' ? lam('#ffffff', { map: leopardTex }) : id === 'mike' ? lam('#ffffff', { map: alohaTex }) : lam(c.shirt)
  g.add(body)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.6, 14), shirt); torso.position.y = 0.2; body.add(torso)
  const arms = []
  for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * 0.52, 0.85, 0); box(0.17, 0.75, 0.18, shirt, 0, -0.34, 0, a); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), skin); hand.position.y = -0.74; a.add(hand); body.add(a); arms.push(a) }
  if (id === 'tetsu') { const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.5, 0.32, 14), lam('#c8302a')); hb.position.y = -0.2; body.add(hb); const tw = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 16), lam('#ffffff')); tw.rotation.x = Math.PI / 2 - 0.2; tw.position.set(0, 0.98, 0.03); body.add(tw) }
  if (id === 'mike') { box(0.22, 0.16, 0.08, lam('#1a1a1a'), 0.05, 0.6, 0.45, body); const ln = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10), lam('#555')); ln.rotation.x = Math.PI / 2; ln.position.set(0.05, 0.6, 0.5); body.add(ln) }
  head.position.y = 1.45; head.rotation.x = -0.28; body.add(head)
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.44, 20, 14), skin); head.add(skull)
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), skin); e.position.set(s * 0.43, 0, 0); head.add(e) }
  const fc = document.createElement('canvas'); fc.width = fc.height = 256
  const faceTex = new THREE.CanvasTexture(fc); faceTex.colorSpace = THREE.SRGBColorSpace
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.445, 24, 16, Math.PI / 2 - 0.95, 1.9, 0.6, 1.5), new THREE.MeshLambertMaterial({ map: faceTex, transparent: true, depthWrite: false })); head.add(face)
  const cap = (r, tl) => new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, tl), hair)
  if (id === 'tetsu') for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), hair); t.position.set(s * 0.4, 0.04, -0.1); head.add(t) }
  if (id === 'yuta') { const cg = new THREE.Group(); head.add(cg); const k = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 10, 0, Math.PI * 2, 0, 1.05), lam('#2d6cc0')); cg.add(k); box(0.42, 0.03, 0.34, lam('#2d6cc0'), 0, 0.2, -0.45, cg); cg.rotation.x = 0.15 }
  if (id === 'mike') { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.03, 24), lam('#e8d28a')); br.position.y = 0.26; head.add(br); const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.3, 18), lam('#e8d28a')); cr.position.y = 0.4; head.add(cr); const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.405, 0.405, 0.08, 18, 1, true), lam('#2fa585')); bd.position.y = 0.3; head.add(bd); const h2 = cap(0.45, 0.9); head.add(h2) }
  if (id === 'machiko') { for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, t = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), hair); t.position.set(Math.cos(a) * 0.34, 0.24 + (i % 2) * 0.08, Math.sin(a) * 0.3 - 0.06); head.add(t) } head.add(cap(0.45, 0.95)); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lam('#f4c03e')); e.position.set(s * 0.45, -0.18, 0); head.add(e) } }
  const kid = id === 'yuta', sc = kid ? 0.82 : 1
  g.scale.setScalar(sc); g.position.set(-7, kid ? -0.2 : 0, CUST_Z); g.visible = false; scene.add(g)
  const o = { id, g, body, head, arms, faceTex, skull, skinCol: new THREE.Color(c.skin), mood: '', baseY: g.position.y }
  setFace(o, 'normal')
  return o
}
function setFace(o, mood) {
  if (o.mood === mood) return; o.mood = mood
  const c = o.faceTex.image, x = c.getContext('2d'); x.clearRect(0, 0, 256, 256); x.save(); x.translate(128, 128); x.scale(1.25, 1.15); x.translate(-128, -128); x.translate(28, 14); drawFace(x, o.id, mood, 200, false); x.restore(); o.faceTex.needsUpdate = true
  o.skull.material.color.copy(o.skinCol).lerp(new THREE.Color('#ff5a4a'), mood === 'mad' ? 0.35 : 0)
}
for (const id of CUST_IDS) custs[id] = makeCustomer(id)

// ---------- 穴の状態
function resetHoles() {
  S.holes = []
  for (let i = 0; i < NH; i++) S.holes.push({ i, st: 'empty', t: 0, d: 0, d1: 0, d2: 0, hold: 0, q1: '', q2: '', heat: 1, tgt: 0.7, burntCounted: false, smokeT: 0 })
}
const baseHeat = i => HEAT_COL[i & 3] * HEAT_ROW[i >> 2]
const grade = d => d >= W_LO && d <= W_HI ? 'p' : d < W_LO ? 'e' : 'l'
function botTarget() { const b = BOTS[S.bot] || BOTS.normal; let u = 0, v = 0; while (u === 0) u = S.br(); v = S.br(); return b.mu + b.sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }

function setSt(h, st) { h.st = st; h.t = 0 }
// 穴をタップしたとき（プレイヤーもボットもここを通る）
function tapHole(i) {
  const h = S.holes[i]; if (!h) return null
  if (S.mode === 'play' && S.ph !== 'cook') return null
  if (S.mode === 'play') S.st.taps++
  const p = holePos(i)
  switch (h.st) {
    case 'empty':
      setSt(h, 'pour'); h.d = 0; h.charSide = null; h.heat = baseHeat(i) * (0.9 + S.r() * 0.2); sfx('pour'); pickTo(i, 0); tutStep(1); return 'pour'
    case 'side1': case 'side2': {
      pickTo(i, 1)
      if (h.d < EARLY) { setSt(h, 'splat'); h.charSide = null; stat('splat'); S.combo = 0; sfx('splat'); popAt(p, T('pSplat'), 'bad'); for (let k = 0; k < 4; k++) puff(p, false, 0.25, 0.3); return 'splat' }
      const q = grade(h.d); stat('flips'); if (q === 'p') { stat('pflips'); S.combo++; if (S.st) S.st.maxCombo = Math.max(S.st.maxCombo, S.combo) } else S.combo = 0
      popAt(p, q === 'p' ? (S.combo >= 3 ? fmt(T('pCombo'), { n: S.combo }) : T('pPerfect')) : q === 'e' ? T('pEarly') : T('pLate'), q === 'p' ? 'good' : '')
      sfx('spin'); if (q === 'p') sfx('perfect')
      if (h.st === 'side1') { h.q1 = q; h.d1 = h.d; setSt(h, 'flip1'); tutStep(2) } else { h.q2 = q; h.d2 = h.d; setSt(h, 'flip2'); tutStep(3) }
      h.d = 0; h.tgt = botTarget(); return 'flip:' + q
    }
    case 'done': {
      if (!boatOpen()) { popAt(p, T('pWait'), 'bad'); sfx('nope'); return 'wait' }
      const burnt = h.hold >= 1, kind = burnt ? 'burnt' : (h.q1 === 'p' && h.q2 === 'p') ? 'perfect' : 'ok'
      const b = { c1: hex(ballCol(h.d1, h.hold)), c2: hex(ballCol(h.d2, h.hold)), kind }
      S.boat.balls.push(b); S.boat.fly.push({ from: p.clone().setY(BR * 0.7), k: S.boat.balls.length - 1, t: 0, col: new THREE.Color(b.c1).lerp(new THREE.Color(b.c2), 0.5) })
      setSt(h, 'empty'); h.hold = 0; pickTo(i, 0); sfx('box'); tutStep(4)
      if (kind === 'perfect') popAt(p, T('pRound'), 'good')
      if (S.boat.balls.length >= S.boat.need && S.cur.st === 'wait') startServe()
      return 'box:' + kind
    }
    case 'char': case 'splat':
      setSt(h, 'scrape'); sfx('scrape'); pickTo(i, 0); popAt(p, T('pScrape'), 'bad'); return 'scrape'
  }
  return null
}
const stat = k => { if (S.mode === 'play' && S.st) S.st[k]++ }
const sfx = (n, v) => { if (!S.quiet) Snd.sfx(n, v) }
function pickTo(i, tw) { pk.tgt.copy(holePos(i)).add(new THREE.Vector3(0.05, 0.05, 0.05)); pk.twirl = tw; pk.t = 0 }

function updateHoles(dt) {
  let cooking = 0
  for (const h of S.holes) {
    h.t += dt; const p = holePos(h.i)
    if (h.st === 'pour' && h.t >= 0.3) setSt(h, 'side1'), h.tgt = botTarget()
    else if (h.st === 'side1' || h.st === 'side2') {
      h.d += (h.st === 'side1' ? RATE1 : RATE2) * h.heat * dt * (h.d > W_HI ? LATE_SLOW : 1); cooking++
      if (S.r() < dt * (1.6 - h.d)) puff(p, false, 0.25, 0.5)
      if (h.d >= BURN) { setSt(h, 'char'); h.charSide = h.st; stat('char'); S.combo = 0; sfx('burn'); popAt(p, T('pChar'), 'bad') }
    } else if (h.st === 'flip1' && h.t >= 0.3) setSt(h, 'side2')
    else if (h.st === 'flip2' && h.t >= 0.32) { setSt(h, 'done'); h.hold = 0; h.burntCounted = false; if (h.q1 === 'p' && h.q2 === 'p') sfx('round') }
    else if (h.st === 'done') {
      h.hold = Math.min(1.5, h.hold + RATE_HOLD * h.heat * dt * (h.hold >= 1 ? 0.5 : 1)); cooking += 0.4
      if (h.hold >= 1 && !h.burntCounted) { h.burntCounted = true; stat('burntBall'); sfx('burn') }
      if (h.hold >= 1.5) { setSt(h, 'char'); h.charSide = 'side2'; popAt(p, T('pChar'), 'bad') }  // 焦げ玉を放っておくと炭になる（もう出せない）
      if (h.hold > 0.7 && S.r() < dt * 6 * h.hold) puff(p, true, 0.3, 0.7)
    } else if (h.st === 'char') { if (S.r() < dt * 9) puff(p, true, 0.35, 0.8) }
    else if (h.st === 'splat' && h.t >= 1.1) setSt(h, 'empty')
    else if (h.st === 'scrape' && h.t >= 0.35) setSt(h, 'empty')
  }
  return cooking
}

// ---------- お客さんと舟
function pickCustomer() {
  const busy = [S.cur, S.leaving, S.nextC].filter(Boolean).map(c => c.id)
  const pool = CUST_IDS.filter(id => !busy.includes(id))
  const id = pool[Math.floor(S.r() * pool.length)]
  const n = CUSTOMERS[id].n
  return { id, n, st: 'line', t: 0, pat: 0, patMax: 5 + n * 1.5, x: 1.9, z: CUST_Z - 0.9, mood: 'normal', line: '', react: '' }
}
function newBoat(need) { return { balls: [], need, fly: [], appear: 0 } }
const boatOpen = () => !!(S.boat && !S.serve && S.cur && (S.cur.st === 'wait' || S.cur.st === 'walk') && S.boat.balls.length < S.boat.need)
function stepUp() {
  S.cur = S.nextC || pickCustomer(); S.cur.st = 'walk'; S.cur.t = 0; S.nextC = null; S.nextC = pickCustomer()
  if (S.boat) S.boat.need = S.cur.n; else S.boat = newBoat(S.cur.n)
}
function startServe() {
  const balls = S.boat.balls.splice(0, S.boat.need)
  S.serve = { t: 0, balls, cust: S.cur, extra: S.boat.balls.slice() }
  S.boat.balls = balls; stat('boats')
  const bad = balls.filter(b => b.kind === 'burnt').length, good = balls.filter(b => b.kind === 'perfect').length
  for (const b of balls) stat(b.kind === 'burnt' ? 'burntServed' : b.kind === 'perfect' ? 'perfect' : 'ok')
  const c = CUSTOMERS[S.cur.id]
  S.cur.react = bad ? 'burnt' : good / balls.length >= 0.75 ? 'perfect' : 'ok'
  S.cur.line = L(c[S.cur.react]); S.cur.st = 'served'
  if (S.mode === 'play') S.lastBoat = { balls: balls.map(b => ({ ...b })), cust: S.cur.id, react: S.cur.react }
  sfx('serve')
}
function updateCustomers(dt) {
  const c = S.cur
  if (c) {
    c.t += dt
    if (c.st === 'walk') { c.x = lerp(c.x, 0, Math.min(1, dt * 7)); c.z = lerp(c.z, CUST_Z, Math.min(1, dt * 7)); if (c.t > 0.7) { c.st = 'wait'; c.t = 0; c.pat = c.patMax; c.x = 0; c.z = CUST_Z; c.line = L(CUSTOMERS[c.id].order); voice(c, 'talk') } }
    else if (c.st === 'wait') {
      if (S.mode === 'demo' || S.ph === 'cook') c.pat -= dt
      c.mood = c.pat < c.patMax * 0.3 ? 'huh' : 'normal'
      if (!S.serve && S.boat.balls.length >= S.boat.need) startServe()
      else if (!S.serve && c.pat <= 0) { c.st = 'leave'; c.t = 0; c.mood = 'mad'; c.line = L(CUSTOMERS[c.id].leave); c.react = 'leave'; stat('leftCust'); S.combo = 0; voice(c, 'mad'); sfx('leave'); S.leaving = c; stepUp() }
    }
  }
  const lv = S.leaving
  if (lv) {
    lv.t += dt
    if (lv.st === 'react') { lv.x = lerp(lv.x, -1.75, Math.min(1, dt * 6)); if (lv.t > 1.35) { lv.st = 'leave'; lv.t = 0 } }
    else { lv.x -= dt * 8 * Math.min(1, lv.t * 2 + 0.3); if (lv.x < -8) S.leaving = null }
  }
  // 舟の盛り付けと受け渡し
  if (S.serve) {
    const sv = S.serve, t0 = sv.t; sv.t += dt
    if (t0 < SERVE.sauce && sv.t >= SERVE.sauce) sfx('sauce')
    if (t0 < SERVE.nori && sv.t >= SERVE.nori) sfx('sprinkle')
    if (sv.t >= SERVE.hand) {
      const cc = sv.cust; cc.st = 'react'; cc.t = 0
      cc.mood = cc.react === 'burnt' ? (cc.id === 'yuta' ? 'cry' : 'mad') : cc.react === 'perfect' ? 'wow' : 'huh'
      voice(cc, cc.react === 'burnt' ? (cc.id === 'yuta' ? 'cry' : 'mad') : cc.react === 'perfect' ? 'wow' : 'ok')
      if (cc.react === 'perfect') sfx('cheer')
      S.serve = null; S.leaving = cc; stepUp(); S.boat = newBoat(S.cur.n); S.boat.balls = sv.extra
    }
  }
  if (S.boat) { S.boat.appear += dt; for (const f of S.boat.fly) f.t += dt; S.boat.fly = S.boat.fly.filter(f => f.t < 0.3) }
  const n = S.nextC; if (n) { n.t += dt; n.x = lerp(n.x, 1.9, Math.min(1, dt * 4)); n.z = CUST_Z - 0.9 }
}
function voice(c, kind) { if (!S.quiet) Snd.voice(CUSTOMERS[c.id].pitch, kind) }

// ---------- ボット（台本どおりに遊ぶ。検証と分布の計測、タイトルのデモ用）
const BOTS = {
  good: { cd: 0.3, mu: 0.7, sd: 0.05, lapse: 0.4, cap: 6 },
  normal: { cd: 0.45, mu: 0.72, sd: 0.09, lapse: 0.8, cap: 5 },
  sloppy: { cd: 0.6, mu: 0.64, sd: 0.18, lapse: 1.2, cap: 8 },
  demo: { cd: 0.3, mu: 0.71, sd: 0.06, lapse: 0.4, cap: 6 },
}
function botStep(dt) {
  if (!S.bot || S.bot === 'idle') return
  const b = BOTS[S.bot]; S.botCd -= dt; if (S.botCd > 0) return
  const H = S.holes
  let best = null, bu = -1
  for (const h of H) if ((h.st === 'side1' || h.st === 'side2') && h.d >= h.tgt && h.d - h.tgt > bu) { bu = h.d - h.tgt; best = h }
  if (!best && boatOpen()) { for (const h of H) if (h.st === 'done' && h.hold > bu) { bu = h.hold; best = h } }
  const active = H.filter(h => h.st !== 'empty' && h.st !== 'char' && h.st !== 'splat' && h.st !== 'scrape').length
  if (!best && active < b.cap) best = H.find(h => h.st === 'empty')
  if (!best) best = H.find(h => h.st === 'char' || (h.st === 'splat' && h.t > 0.3))
  if (!best) return
  tapHole(best.i); S.botCd = b.cd * (1 + b.lapse * S.br())
}

// ---------- 遊びの流れ
function startGame(seed = (Math.random() * 1e9) | 0) {
  S.mode = 'play'; S.seed = seed; S.r = rng(seed); S.br = rng(seed ^ 0x5bd1e995); S.quiet = !!S.forceQuiet
  S.st = newStats(); S.leaving = null; S.bot = S.userBot || null; S.botCd = 0; S.t = 0; S.left = GAME_T; S.ph = 'ready'; S.pt = 0; S.combo = 0; S.lastBoat = null; S.result = null; S.serve = null; S.boat = null; S.cur = null; S.nextC = null; S.lastCust = null
  for (const id of CUST_IDS) { custs[id].g.visible = false; custs[id].g.position.x = -7 }
  resetHoles(); S.nextC = pickCustomer(); stepUp()
  go('vPlay'); body.classList.remove('party', 'gloom')
  try { S.tut = localStorage.getItem('tk.tut') === '1' ? 0 : 1 } catch (e) { S.tut = 1 }
  if (S.forceTut !== undefined) S.tut = S.forceTut
  showTut(); layout(); banner(T('ready')); if (!S.quiet) { Snd.setTrack('play'); Snd.ambient(true) }
}
function startDemo() {
  S.mode = 'demo'; S.quiet = true; S.r = S.demoR; S.br = rng(77); S.bot = S.userBot || 'demo'; S.st = null; S.leaving = null; S.serve = null; S.boat = null; S.cur = null; S.nextC = null; S.lastCust = null
  for (const id of CUST_IDS) { custs[id].g.visible = false; custs[id].g.position.x = -7 }
  resetHoles(); S.nextC = pickCustomer(); stepUp()
}
function update() {
  S.t += STEP
  if (S.view === 'result') { S.rt += STEP; resultTick(); return }
  if (S.mode === 'play') {
    S.pt += STEP
    if (S.ph === 'ready' && S.pt >= 1.0) { S.ph = 'cook'; S.pt = 0; banner(T('go'), 0.7); sfx('go') }
    if (S.ph === 'cook') {
      const before = Math.ceil(S.left); S.left = Math.max(0, S.left - STEP)
      if (Math.ceil(S.left) !== before && S.left <= 5 && S.left > 0) sfx('tick')
      if (S.left <= 0) { S.ph = 'end'; S.pt = 0; banner(T('timeUp')); sfx('whistle') }
    }
    if (S.ph === 'end' && S.pt >= 1.6) { finishGame(); return }
  }
  if (S.mode === 'demo' || S.ph === 'cook') botStep(STEP)
  const cooking = updateHoles(STEP)
  if (S.mode === 'demo' || S.ph !== 'ready') updateCustomers(STEP)
  updatePuffs(STEP)
  pk.t += STEP; S.cooking = cooking
  if (S.bannerT > 0) { S.bannerT -= STEP; if (S.bannerT <= 0) $('#banner').hidden = true }
}
function finishGame() {
  S.result = computeResult(S.st)
  S.view = 'result'; S.rt = 0; S.shown = 0
  Snd.ambient(false)
  go('vResult'); fillResult()
  if (!S.quiet) Snd.setTrack(null)
  startDemoKeep()
}
function startDemoKeep() { /* 結果の裏でも鉄板は動かさない（最後の状態のまま） */ }
function computeResult(st) {
  const served = st.perfect + st.ok + st.burntServed
  const round = served ? st.perfect / served : 0
  const burnt = st.char + st.burntBall
  const score = st.perfect * 10 + st.ok * 4 - st.burntServed * 6 - st.char * 4 - st.splat * 3 - st.leftCust * 10 + st.boats * 10
  let tier
  if (st.taps === 0) tier = SPECIAL.kenbutsu
  else if (burnt >= 5 && burnt >= st.perfect) tier = SPECIAL.sumi
  else if (st.splat >= 5 && st.splat >= st.perfect) tier = SPECIAL.becha
  else tier = TIERS.find(t => score >= t.min)
  return { ...st, served, round, burnt, score, tier: tier.id, tierObj: tier, last: S.lastBoat }
}

// ---------- 入力（タップした穴を選ぶ）
const ray = new THREE.Raycaster(), plane0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05), hitP = new THREE.Vector3(), ndc = new THREE.Vector2()
function holeAt(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera)
  if (!ray.ray.intersectPlane(plane0, hitP)) return -1
  let bi = -1, bd = 1e9
  for (let i = 0; i < NH; i++) { const p = holePos(i), d = Math.hypot(p.x - hitP.x, p.z - hitP.z); if (d < bd) { bd = d; bi = i } }
  return bd < SP * 0.62 ? bi : -1
}
function toScreen(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight } }
function onDown(e) {
  if (S.view !== 'play' || S.mode !== 'play') return
  e.preventDefault(); Snd.init()
  const i = holeAt(e.clientX, e.clientY); if (i >= 0) tapHole(i)
}

// ---------- 表示
const body = document.body
function go(id) {
  for (const v of $$('.view')) v.hidden = v.id !== id
  for (const d of $$('#fx .pop')) d.remove()
  S.view = { vTitle: 'title', vHow: 'how', vPlay: 'play', vResult: 'result' }[id]
  if (S.view === 'title' || S.view === 'how') { if (S.mode !== 'demo') startDemo(); Snd.setTrack('title'); Snd.ambient(false); body.classList.remove('party', 'gloom') }
  layout()
}
function banner(txt, dur = 0) { const b = $('#banner'); b.innerHTML = `<b>${txt}</b>`; b.hidden = false; S.bannerT = dur || 99 }
function popAt(p, txt, cls) {
  if (S.view !== 'play' || S.mode !== 'play' || S.noPops) return
  const s = toScreen(p.clone().setY(0.5)), d = document.createElement('div'); d.className = 'pop ' + (cls || ''); d.textContent = txt; d.style.left = s.x + 'px'; d.style.top = s.y + 'px'
  const fx = $('#fx'), old = fx.querySelectorAll('.pop'); if (old.length >= 3) old[0].remove(); fx.appendChild(d); setTimeout(() => d.remove(), 900)
}
function showTut() {
  const el = $('#tut'); if (!S.tut || S.mode !== 'play') { el.hidden = true; return }
  el.hidden = false; $('#tutTxt').textContent = fmt(T('tut' + S.tut), { tap: tapWord() })
}
function tutStep(n) {
  if (S.mode !== 'play' || !S.tut) return
  if (n === S.tut) { S.tut++; if (S.tut > 4) { S.tut = 0; try { localStorage.setItem('tk.tut', '1') } catch (e) {} } showTut() }
}
function applyLang() {
  document.documentElement.lang = S.lang
  for (const el of $$('[data-t]')) el.textContent = T(el.dataset.t)
  $('#langTxt').textContent = S.lang === 'ja' ? 'EN' : 'JA'
  const lb = $('#logoB'); lb.innerHTML = (S.lang === 'ja' ? 'くるくる' : 'SPIN').split('').map(ch => `<span>${ch}</span>`).join('')
  for (const k of [1, 2, 3, 4]) $('#how' + k).textContent = fmt(T(`how${k}T`), { tap: tapWord() })
  $('#saveTxt').textContent = canShare() ? T('share') : T('save')
  document.title = T('title')
  showTut(); orderKey = ''
  if (S.view === 'result' && S.result) fillResult(true)
}
let orderKey = ''
function updateOrder() {
  const el = $('#order'), lv = S.leaving
  let c = null, mode = ''
  if (S.view === 'play') {
    if (lv && (lv.st === 'react' || (lv.react === 'leave' && lv.t < 1.1)) && lv.x > -3) { c = lv; mode = 'react' }
    else if (S.cur && (S.cur.st === 'wait' || S.cur.st === 'served')) { c = S.cur; mode = 'order' }
  }
  if (!c) { el.hidden = true; return }
  const balls = S.serve ? S.serve.balls : S.boat ? S.boat.balls : [], n = balls.length, need = S.serve ? S.serve.balls.length : c.n
  const moodCls = mode === 'react' ? (c.react === 'perfect' ? 'mood-wow big' : c.react === 'ok' ? 'mood-huh' : 'mood-mad big') : ''
  const line = mode === 'react' ? c.line : L(CUSTOMERS[c.id].order)
  const k = [c.id, mode, c.st, line, n, need, moodCls, S.lang, balls.map(b => b.kind[0]).join('')].join('|')
  if (k !== orderKey) {
    orderKey = k
    const dots = mode === 'order' ? `<div class="cnt"><div class="dots">${Array.from({ length: need }, (_, j) => `<i class="${j < n ? (balls[j].kind === 'burnt' ? 'bad' : 'on') : ''}"></i>`).join('')}</div>${c.st === 'wait' ? '<div class="pat" id="pat"><b id="patB"></b></div>' : ''}</div>` : ''
    el.className = 'order ' + moodCls
    el.innerHTML = `<small>${L(CUSTOMERS[c.id].name)}</small>${line}${dots}`
  }
  el.hidden = false
  const cu = custs[c.id], hp = new THREE.Vector3(); cu.head.getWorldPosition(hp); hp.y += 0.62 * cu.g.scale.y
  const s = toScreen(hp), W = innerWidth, side = W > innerHeight && innerHeight <= 560
  el.classList.toggle('side', side)
  const r = el.getBoundingClientRect()
  if (side) { const hx = toScreen(hp.clone().setY(hp.y - 0.45)); el.style.left = clamp(hx.x + 46, 8, W - r.width - 8) + 'px'; el.style.top = clamp(hx.y - r.height / 2, 56, innerHeight - r.height - 8) + 'px' }
  else { el.style.left = clamp(s.x, r.width / 2 + 8, W - r.width / 2 - 8) + 'px'; el.style.top = Math.max(r.height + 56, s.y) + 'px' }
  const pb = $('#patB'); if (pb && c.st === 'wait') { const k2 = clamp(c.pat / c.patMax, 0, 1); pb.style.transform = `scaleX(${k2})`; $('#pat').classList.toggle('low', k2 < 0.3) }
}
function updateHud() {
  if (S.view !== 'play') return
  const s = Math.ceil(S.left); $('#timeTxt').textContent = s; $('#timeChip').classList.toggle('low', S.ph === 'cook' && S.left <= 10)
  $('#boatTxt').textContent = S.st ? S.st.boats : 0
}

// ---------- 3D の見た目を状態から作る
const tmpC = new THREE.Color(), tmpV = new THREE.Vector3()
function syncScene(now) {
  for (let i = 0; i < NH; i++) {
    const h = S.holes[i], o = holes3[i]; if (!h) continue
    o.disk.visible = false; o.ball.visible = false; o.pourBlob.visible = false; o.disk.scale.set(1, 1, 1); o.ball.scale.setScalar(1); o.spin.rotation.set(0, 0, 0); o.ball.rotation.set(0, 0, 0)
    if (h.st === 'pour') { o.pourBlob.visible = true; const k = h.t / 0.3; o.pourBlob.position.y = lerp(1.1, 0.05, k * k); o.pourBlob.scale.set(1, 1 + k, 1); o.disk.visible = k > 0.6; o.disk.scale.set(1, (k - 0.6) / 0.4, 1); o.disk.material.color.copy(batterCol(0)); o.tako.visible = true }
    else if (h.st === 'side1') { o.disk.visible = true; o.disk.material.color.copy(batterCol(h.d)); o.tako.visible = h.d < 0.45; o.disk.position.y = 0.03 + Math.sin(now * 20 + i) * 0.002 }
    else if (h.st === 'flip1' || h.st === 'side2' || h.st === 'flip2' || h.st === 'done' || (h.st === 'char' && h.charSide === 'side2') || h.st === 'scrape' && h.charSide === 'side2') {
      o.ball.visible = true
      const cA = h.st === 'flip1' ? batterCol(h.d1, tmpC) : ballCol(h.d1, h.st === 'done' ? h.hold : 0, tmpC); o.hA.material.color.copy(cA)
      const dB = h.st === 'flip1' ? 0 : h.st === 'flip2' || h.st === 'done' ? h.d2 : h.d
      o.hB.material.color.copy(h.st === 'char' || h.st === 'scrape' ? CHAR : ballCol(dB, h.st === 'done' ? h.hold : 0, tmpC))
      if (h.st === 'char' || h.st === 'scrape') o.hA.material.color.lerp(CHAR, 0.85)
      o.ball.rotation.z = Math.PI / 2
      let y = BR * 0.32
      if (h.st === 'flip1' || h.st === 'flip2') { const k = h.t / 0.3; o.spin.rotation.y = 0; o.ball.rotation.x = -ease(k) * Math.PI * 2; y += Math.sin(Math.PI * clamp(k, 0, 1)) * 0.35 }
      if (h.st === 'flip2' && h.t >= 0.15) { o.ball.rotation.z = lerp(Math.PI / 2, 0.4, ease((h.t - 0.15) / 0.17)) }
      if (h.st === 'done') { y = BR * 0.62; o.ball.rotation.z = 0.4 + Math.sin(now * 2 + i) * 0.15; o.ball.rotation.y = now * 0.6 + i }
      if (h.st === 'scrape') o.ball.scale.setScalar(Math.max(0.01, 1 - h.t / 0.35))
      o.ball.position.y = y
    } else if (h.st === 'char' || h.st === 'scrape') { o.disk.visible = true; o.disk.material.color.copy(CHAR); o.tako.visible = false; if (h.st === 'scrape') o.disk.scale.setScalar(Math.max(0.01, 1 - h.t / 0.35)); else o.disk.scale.set(1, 1.6 + Math.sin(now * 8 + i) * 0.1, 1) }
    else if (h.st === 'splat') { o.disk.visible = true; const k = Math.min(1, h.t * 8); o.disk.scale.set(1 + 0.5 * k, 0.5, 1 + 0.35 * k); o.disk.material.color.set('#ead9a2'); o.tako.visible = true; if (h.t > 0.8) o.disk.scale.multiplyScalar(Math.max(0.01, 1 - (h.t - 0.8) / 0.3)) }
  }
  // ピック
  pk.t > 0.6 ? pick.position.lerp(PICK_HOME, 0.12) : pick.position.lerp(tmpV.copy(pk.tgt).add(new THREE.Vector3(0.12, 0.12, 0.1)), 0.45)
  pick.rotation.set(-0.35, pk.twirl && pk.t < 0.35 ? pk.t * 30 : 0, pk.t > 0.6 ? 0.5 : 0.25)
  // お客さん
  for (const id of CUST_IDS) custs[id].g.visible = false
  for (const c of [S.nextC, S.cur, S.leaving]) {
    if (!c) continue; const o = custs[c.id]; o.g.visible = true
    o.g.position.x = c.x; o.g.position.z = c.z
    const walking = c.st === 'walk' || c.st === 'leave' || c === S.nextC && Math.abs(c.x - 1.9) > 0.05
    o.g.position.y = o.baseY + (walking ? Math.abs(Math.sin(now * 12)) * 0.08 : 0)
    o.body.rotation.y = c.st === 'leave' ? -0.9 : c === S.nextC ? -0.3 : 0
    setFace(o, c === S.nextC ? 'normal' : c.mood)
    const hop = c.st === 'react' && c.react === 'perfect' ? Math.abs(Math.sin(now * 10)) * 0.25 : 0
    o.body.position.y = hop
    o.arms[0].rotation.z = c.st === 'react' && c.react === 'perfect' ? 2.6 + Math.sin(now * 14) * 0.3 : c.st === 'react' && c.react === 'burnt' ? 0.9 + Math.sin(now * 30) * 0.2 : Math.sin(now * 3) * 0.05
    o.arms[1].rotation.z = c.st === 'react' && c.react === 'perfect' ? -2.6 - Math.sin(now * 14) * 0.3 : c.st === 'wait' && c.pat < c.patMax * 0.3 ? -0.6 + Math.sin(now * 16) * 0.25 : -Math.sin(now * 3) * 0.05
    o.head.rotation.z = c.st === 'react' && c.react === 'burnt' ? Math.sin(now * 25) * 0.12 : 0
  }
  // 舟
  const sv = S.serve, balls = sv ? sv.balls : S.boat ? S.boat.balls : []
  for (let k = 0; k < 8; k++) {
    const m = mini[k], b = balls[k], flying = S.boat && !sv && S.boat.fly.some(f => f.k === k)
    m.visible = !!b && !flying
    if (b) m.material.color.set(b.c1).lerp(tmpC.set(b.c2), 0.5)
    sauceCaps[k].visible = !!sv && sv.t >= SERVE.sauce * (0.6 + k * 0.05)
    m.position.copy(slotPos(k)); m.rotation.set(0, 0, 0)
  }
  for (const ml of mayoLines) ml.visible = !!sv && sv.t >= SERVE.mayo
  nori.visible = !!sv && sv.t >= SERVE.nori
  for (const kt of katsuo) { kt.visible = !!sv && sv.t >= SERVE.dance; if (kt.visible) { const ph = kt.userData.ph; kt.rotation.set(-Math.PI / 2 + Math.sin(now * 9 + ph) * 0.9, Math.sin(now * 7 + ph) * 0.6, Math.sin(now * 11 + ph) * 0.5); kt.position.y = 0.32 + Math.abs(Math.sin(now * 9 + ph)) * 0.04 } }
  boatG.position.copy(BOAT_POS)
  if (sv && sv.t > SERVE.slide) { const k = ease((sv.t - SERVE.slide) / (SERVE.hand - SERVE.slide)); boatG.position.z = lerp(BOAT_POS.z, CUST_Z + 0.55, k); boatG.position.y = BOAT_POS.y + k * 0.5 }
  else if (!sv && S.boat && S.boat.appear < 0.3) boatG.position.x = lerp(-3.5, 0, ease(S.boat.appear / 0.3))
  boatG.visible = !!S.boat || !!sv
  // 飛んでいる玉
  const f = S.boat && S.boat.fly.at(-1)
  flyer.visible = !!f
  if (f) { const k = f.t / 0.3, to = slotPos(f.k).add(boatG.position); flyer.position.lerpVectors(f.from, to, k); flyer.position.y += Math.sin(Math.PI * k) * 0.8; flyer.scale.setScalar(lerp(1, 0.55, k)); flyer.material.color.copy(f.col) }
  for (const c of chochins) c.rotation.z = Math.sin(now * 1.3 + c.position.x) * 0.06
  warm.intensity = 9 + Math.sin(now * 7) * 0.6 + (S.cooking || 0) * 0.3
}

// ---------- カメラ（鉄板・舟・お客さんの頭が全部入る距離を探す）
const camDir = new THREE.Vector3(0, 0.72, 1).normalize()
let camLk = new THREE.Vector3(0, 0.3, -0.8), camD = 9
function layout() {
  const W = innerWidth, H = innerHeight
  renderer.setSize(W, H, false); camera.aspect = W / H
  const land = W > H, lowLand = land && H <= 560
  camera.fov = land ? 36 : 42; camera.updateProjectionMatrix()
  const topPx = lowLand ? 50 : 162, botPx = lowLand ? 12 : (S.tut ? 70 : 28)
  const top = 1 - 2 * topPx / H, bot = -1 + 2 * botPx / H, side = 0.96
  const plateP = [[-2.05, 0, 1.08], [2.05, 0, 1.08], [-2.05, 0, -1.1], [2.05, 0, -1.1]].map(a => new THREE.Vector3(...a))
  const headP = new THREE.Vector3(0, 2.35, CUST_Z), all = [...plateP, headP, new THREE.Vector3(0, 0.6, -1.5)]
  const v = new THREE.Vector3()
  const fits = () => all.every(p => { v.copy(p).project(camera); return v.x > -side && v.x < side && v.y < top && v.y > bot })
  for (let it = 0; it < 3; it++) {
    let d = 4; for (; d < 40; d += 0.05) { camera.position.copy(camLk).addScaledVector(camDir, d); camera.lookAt(camLk); camera.updateMatrixWorld(); if (fits()) break }
    camD = d
    let mn = 9, mx = -9; for (const p of all) { v.copy(p).project(camera); mn = Math.min(mn, v.y); mx = Math.max(mx, v.y) }
    const off = (top + bot) / 2 - (mn + mx) / 2, halfH = d * Math.tan(camera.fov * Math.PI / 360)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    camLk.addScaledVector(up, -off * halfH)
  }
  camera.position.copy(camLk).addScaledVector(camDir, camD); camera.lookAt(camLk); camera.updateMatrixWorld()
  if (S.view === 'result') sizePhoto()
}
addEventListener('resize', () => { layout(); if (S.view === 'result') sizePhoto() })

// ---------- 結果
function fillResult(keep) {
  const R = S.result, tr = R.tierObj
  $('#stBoats .v').innerHTML = `${R.boats}<small>${T('unitBoat')}</small>`
  $('#stRound .v').innerHTML = `${Math.round(R.round * 100)}<small>%</small>`
  $('#stBurnt .v').innerHTML = `${R.burnt}<small>${T('unitKo')}</small>`
  $('#stBecha .v').innerHTML = `${R.splat}<small>${T('unitKo')}</small>`
  $('#rankN').textContent = L(tr); $('#rankT').textContent = L(tr.boss)
  $('#rank').className = 'rank tier-' + tr.color + (keep && S.shown >= 6 ? ' on' : '')
  $('#stamp').innerHTML = stampSvg(tr)
  drawPhoto($('#photo').getContext('2d'), 600, 660, R.last, S.lang)
  sizePhoto()
  if (!keep) { S.shown = 0; for (const el of $$('.st')) el.classList.remove('on'); $('#photo').classList.remove('on'); $('.rBtns').style.visibility = 'hidden'; $('#skip').hidden = false }
}
function stampSvg(tr) {
  const col = { gold: '#f4c03e', red: '#ff5a3c', blue: '#6aa8ff', gray: '#c9c2d8', black: '#9a90aa' }[tr.color]
  const word = stampWord(tr, S.lang)
  const fs = word.length >= 5 ? 15 : word.length >= 3 ? 22 : 30
  return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="${col}" stroke-width="6"/><circle cx="50" cy="50" r="36" fill="none" stroke="${col}" stroke-width="2"/><text x="50" y="${50 + fs * 0.36}" text-anchor="middle" font-family="'Dela Gothic One',sans-serif" font-size="${fs}" fill="${col}">${word}</text></svg>`
}
function stampWord(tr, lang) {
  return lang === 'ja' ? { meijin: '名人', naniwa: '職人', sokusen: '即戦', minarai: '見習', nama: '生焼', sumi: '炭', becha: 'ベチャ', kenbutsu: '見物' }[tr.id] : { meijin: 'MASTER', naniwa: 'PRO', sokusen: 'READY', minarai: 'NEWBIE', nama: 'RAW', sumi: 'CHAR', becha: 'MUSH', kenbutsu: 'WATCH' }[tr.id]
}
function sizePhoto() {
  const bx = $('#photoBox').getBoundingClientRect(), c = $('#photo')
  const k = Math.max(0.1, Math.min((bx.width - 12) / 600, (bx.height - 12) / 660))
  c.style.width = Math.floor(600 * k) + 'px'; c.style.height = Math.floor(660 * k) + 'px'
}
function resultTick() {
  const R = S.result, t = S.rt
  const at = (n, time, fn) => { if (S.shown < n && t >= time) { S.shown = n; fn() } }
  at(1, 0.3, () => { $('#photo').classList.add('on'); sfx('box') })
  at(2, 0.9, () => { $('#stBoats').classList.add('on'); sfx('ding', 4) })
  at(3, 1.4, () => { $('#stRound').classList.add('on'); sfx('ding', 6) })
  at(4, 1.9, () => { $('#stBurnt').classList.add('on'); $('#stBecha').classList.add('on'); sfx(R.burnt + R.splat > 4 ? 'burn' : 'ding', 8) })
  at(5, 2.3, () => sfx('roll'))
  at(6, 3.5, () => {
    $('#rank').classList.add('on'); sfx('slam')
    const good = R.tier === 'meijin' || R.tier === 'naniwa'
    body.classList.toggle('party', good); body.classList.toggle('gloom', ['sumi', 'becha', 'kenbutsu', 'nama'].includes(R.tier))
    if (!S.quiet) { Snd.setTrack(good || R.tier === 'sokusen' ? 'good' : 'sad'); sfx(good ? 'cheer' : R.tier === 'kenbutsu' ? 'crow' : 'boo') }
  })
  at(7, 4.1, () => { $('.rBtns').style.visibility = 'visible'; $('#skip').hidden = true })
}
function skipResult() { if (S.view === 'result' && S.shown < 7) { S.rt = Math.max(S.rt, 4.1); resultTick() } }

// 最後の一舟の写真（2D で描く。結果画面と保存画像で共用）
function drawPhoto(x, W, H, boat, lang) {
  x.save(); x.clearRect(0, 0, W, H)
  x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, W, H)
  const px = 28, py = 28, pw = W - 56, ph = H - 150
  const g = x.createRadialGradient(W / 2, py + ph * 0.45, 30, W / 2, py + ph * 0.5, pw * 0.8); g.addColorStop(0, '#6a4426'); g.addColorStop(1, '#2a1a10'); x.fillStyle = g; x.fillRect(px, py, pw, ph)
  x.save(); x.beginPath(); x.rect(px, py, pw, ph); x.clip()
  x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(px, py + i * 34 + 10); x.bezierCurveTo(px + pw / 3, py + i * 34 + 16, px + pw * 2 / 3, py + i * 34 + 4, px + pw, py + i * 34 + 12); x.stroke() }
  const cx = W / 2, cy = py + ph * 0.56, bw = pw * 0.82, bh = ph * 0.46
  // 舟
  x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(cx, cy + bh * 0.42, bw * 0.52, bh * 0.16, 0, 0, 7); x.fill()
  x.fillStyle = '#c99a5e'; x.beginPath(); x.moveTo(cx - bw / 2, cy - bh * 0.3); x.lineTo(cx + bw / 2, cy - bh * 0.3); x.lineTo(cx + bw * 0.42, cy + bh * 0.38); x.lineTo(cx - bw * 0.42, cy + bh * 0.38); x.closePath(); x.fill()
  x.fillStyle = '#e6c48e'; x.beginPath(); x.moveTo(cx - bw * 0.45, cy - bh * 0.26); x.lineTo(cx + bw * 0.45, cy - bh * 0.26); x.lineTo(cx + bw * 0.39, cy + bh * 0.3); x.lineTo(cx - bw * 0.39, cy + bh * 0.3); x.closePath(); x.fill()
  x.strokeStyle = 'rgba(140,90,40,.35)'; x.lineWidth = 1.5; for (let i = 0; i < 9; i++) { const yy = cy - bh * 0.24 + i * bh * 0.065; x.beginPath(); x.moveTo(cx - bw * 0.44, yy); x.lineTo(cx + bw * 0.44, yy); x.stroke() }
  const balls = boat ? boat.balls : []
  const n = balls.length, cols = n > 4 ? Math.ceil(n / 2) : n, rows = n > 4 ? 2 : 1, r = Math.min(bw * 0.4 / Math.max(cols, 3), bh * 0.27)
  const pos = []
  for (let k = 0; k < n; k++) { const row = rows === 2 ? Math.floor(k / cols) : 0, col = rows === 2 ? k % cols : k, inRow = rows === 2 ? (row === 0 ? cols : n - cols) : n; pos.push([cx + (col - (inRow - 1) / 2) * r * 2.1, cy + (rows === 2 ? (row - 0.5) * r * 1.75 : 0) - r * 0.1]) }
  const R2 = rng(boat ? boat.balls.length * 7 + 3 : 3)
  for (let k = 0; k < n; k++) {
    const [bx, by] = pos[k], b = balls[k]
    const gg = x.createRadialGradient(bx - r * 0.35, by - r * 0.4, r * 0.1, bx, by, r); gg.addColorStop(0, b.kind === 'burnt' ? '#4a3a32' : '#f3c27a'); gg.addColorStop(0.45, b.c1); gg.addColorStop(1, b.kind === 'burnt' ? '#050303' : '#5a2c10')
    x.fillStyle = gg; x.beginPath(); x.arc(bx, by, r, 0, 7); x.fill()
    if (b.kind !== 'perfect') { x.fillStyle = b.c2; x.globalAlpha = 0.85; x.beginPath(); x.ellipse(bx + r * 0.3, by + r * 0.15, r * 0.55, r * 0.7, 0.3, 0, 7); x.fill(); x.globalAlpha = 1 }
    // ソース
    x.fillStyle = 'rgba(70,30,12,.92)'; x.beginPath(); x.ellipse(bx, by - r * 0.25, r * 0.92, r * 0.62, 0, Math.PI, 0); x.bezierCurveTo(bx + r * 0.9, by + r * 0.1, bx + r * 0.5, by + r * 0.05, bx + r * 0.3, by + r * 0.3); x.lineTo(bx - r * 0.1, by + r * 0.05); x.bezierCurveTo(bx - r * 0.5, by + r * 0.2, bx - r * 0.9, by, bx - r * 0.92, by - r * 0.25); x.fill()
    x.fillStyle = 'rgba(255,255,255,.4)'; x.beginPath(); x.ellipse(bx - r * 0.35, by - r * 0.5, r * 0.22, r * 0.1, -0.4, 0, 7); x.fill()
    if (b.kind === 'burnt') { x.strokeStyle = 'rgba(80,80,80,.7)'; x.lineWidth = 3; x.beginPath(); x.moveTo(bx, by - r * 1.1); x.bezierCurveTo(bx + r * 0.4, by - r * 1.5, bx - r * 0.4, by - r * 1.8, bx + r * 0.1, by - r * 2.2); x.stroke() }
  }
  if (n) {
    // マヨ
    x.strokeStyle = '#fff8e2'; x.lineWidth = Math.max(3, r * 0.12); x.lineCap = 'round'; x.beginPath()
    const y0 = cy - bh * 0.18, y1 = cy + bh * 0.12; let up = true
    for (let xx = cx - bw * 0.36; xx <= cx + bw * 0.36; xx += r * 0.7) { if (xx === cx - bw * 0.36) x.moveTo(xx, up ? y0 : y1); else x.lineTo(xx, up ? y0 : y1); up = !up }
    x.stroke()
    // 青のり
    x.fillStyle = '#3f7a22'; for (let i = 0; i < 70; i++) { const a = R2() * 7, rr = Math.sqrt(R2()); x.fillRect(cx + Math.cos(a) * rr * bw * 0.36, cy - r * 0.1 + Math.sin(a) * rr * bh * 0.24, 3, 3) }
    // かつお節
    for (let i = 0; i < 16; i++) { const fx = cx + (R2() - 0.5) * bw * 0.7, fy = cy + (R2() - 0.5) * bh * 0.45 - r * 0.2; x.save(); x.translate(fx, fy); x.rotate(R2() * 6); x.fillStyle = R2() < 0.5 ? '#eab49a' : '#d8957a'; x.beginPath(); x.moveTo(-r * 0.3, 0); x.quadraticCurveTo(0, -r * 0.35, r * 0.3, 0); x.quadraticCurveTo(0, r * 0.12, -r * 0.3, 0); x.fill(); x.restore() }
  } else {
    // 1舟も売れず: 空の舟とカラス
    x.fillStyle = '#1a1414'; for (const [bx, by, s] of [[cx + bw * 0.28, cy - bh * 0.5, 1], [cx - bw * 0.3, cy - bh * 0.62, 0.7]]) { x.save(); x.translate(bx, by); x.scale(s, s); x.beginPath(); x.ellipse(0, 0, 26, 16, 0, 0, 7); x.fill(); x.beginPath(); x.arc(22, -12, 11, 0, 7); x.fill(); x.beginPath(); x.moveTo(30, -12); x.lineTo(44, -8); x.lineTo(30, -6); x.fill(); x.beginPath(); x.moveTo(-10, -4); x.lineTo(-40, -26); x.lineTo(-4, 6); x.fill(); x.restore() }
  }
  // お客さんの一言
  if (boat) {
    const c = CUSTOMERS[boat.cust]
    const im = faceCanvas(boat.cust, boat.react === 'burnt' ? (boat.cust === 'yuta' ? 'cry' : 'mad') : boat.react === 'perfect' ? 'wow' : 'huh')
    x.save(); x.beginPath(); x.arc(px + 62, py + 62, 42, 0, 7); x.clip(); x.drawImage(im, px + 20, py + 20, 84, 84); x.restore()
    x.strokeStyle = '#fff4dc'; x.lineWidth = 4; x.beginPath(); x.arc(px + 62, py + 62, 42, 0, 7); x.stroke()
    const line = L(c[boat.react]); x.font = `900 ${line.length > 14 ? 24 : 28}px 'Zen Maru Gothic','Hiragino Sans',sans-serif`
    const tw = Math.min(pw - 140, x.measureText(line).width + 28)
    x.fillStyle = boat.react === 'burnt' ? '#ffd2c8' : boat.react === 'perfect' ? '#fff1a8' : '#fff4dc'; roundRect(x, px + 112, py + 34, tw, 52, 14); x.fill()
    x.beginPath(); x.moveTo(px + 112, py + 54); x.lineTo(px + 100, py + 62); x.lineTo(px + 114, py + 66); x.fill()
    x.fillStyle = '#241510'; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillText(line, px + 126, py + 61, tw - 28)
  }
  x.restore()
  // キャプション
  x.fillStyle = '#3a2a20'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'
  x.font = `900 40px 'Zen Maru Gothic','Hiragino Sans',sans-serif`; x.fillText(boat ? TXT[lang].photoCap : TXT[lang].photoNone, W / 2, H - 70)
  x.font = `700 22px 'Zen Maru Gothic','Hiragino Sans',sans-serif`; x.fillStyle = '#8a7a6a'
  if (boat) { const k = boat.balls.filter(b => b.kind === 'perfect').length; x.fillText(`${L(CUSTOMERS[boat.cust].name)}  ${lang === 'ja' ? `まんまる ${k}/${boat.balls.length}` : `round ${k}/${boat.balls.length}`}`, W / 2, H - 32) }
  x.restore()
}
const faceCanvasCache = {}
function faceCanvas(id, mood) { const k = id + mood; if (!faceCanvasCache[k]) { const c = document.createElement('canvas'); c.width = c.height = 168; drawFace(c.getContext('2d'), id, mood, 168, true); faceCanvasCache[k] = c } return faceCanvasCache[k] }

// 結果を1枚の画像に（1080x1350）
async function drawCard() {
  const R = S.result, tr = R.tierObj, lang = S.lang, X = TXT[lang]
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d')
  try { await document.fonts.ready } catch (e) {}
  const g = x.createLinearGradient(0, 0, 0, 1350); g.addColorStop(0, '#2a1d4a'); g.addColorStop(1, '#120c22'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1350)
  for (let i = 0; i < 9; i++) { const lx = 60 + i * 120, ly = 40 + Math.sin(i) * 14; const rg = x.createRadialGradient(lx, ly, 2, lx, ly, 60); rg.addColorStop(0, 'rgba(255,130,60,.55)'); rg.addColorStop(1, 'rgba(255,130,60,0)'); x.fillStyle = rg; x.fillRect(lx - 60, ly - 60, 120, 120); x.fillStyle = '#e8452a'; x.beginPath(); x.ellipse(lx, ly, 18, 24, 0, 0, 7); x.fill() }
  x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = `86px 'Dela Gothic One',sans-serif`; x.fillText(X.title, 540, 170)
  x.font = `900 32px 'Zen Maru Gothic',sans-serif`; x.fillStyle = '#f4c03e'; x.fillText(X.sub, 540, 224)
  // 写真
  const pc = document.createElement('canvas'); pc.width = 600; pc.height = 660; drawPhoto(pc.getContext('2d'), 600, 660, R.last, lang)
  x.save(); x.translate(390, 600); x.rotate(-0.04); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 30; x.shadowOffsetY = 12; x.drawImage(pc, -300 * 0.92, -330 * 0.92, 600 * 0.92, 660 * 0.92); x.restore()
  // ハンコ
  const col = { gold: '#f4c03e', red: '#ff5a3c', blue: '#6aa8ff', gray: '#c9c2d8', black: '#b0a6c0' }[tr.color]
  x.save(); x.translate(880, 440); x.rotate(-0.2); x.strokeStyle = col; x.lineWidth = 10; x.beginPath(); x.arc(0, 0, 130, 0, 7); x.stroke(); x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 112, 0, 7); x.stroke()
  x.fillStyle = col; const word = stampWord(tr, lang), fs = Math.min(96, 200 / Math.max(1, word.length) * (lang === 'ja' ? 1 : 1.5)); x.font = `${fs}px 'Dela Gothic One',sans-serif`; x.fillText(word, 0, fs * 0.36)
  x.restore()
  x.fillStyle = col; let tf = 50; x.font = `${tf}px 'Dela Gothic One',sans-serif`; while (x.measureText(L(tr)).width > 330 && tf > 24) { tf -= 2; x.font = `${tf}px 'Dela Gothic One',sans-serif` } x.fillText(L(tr), 880, 640)
  // 数字
  const stats = [[X.resBoats, R.boats + X.unitBoat], [X.resRound, Math.round(R.round * 100) + '%'], [X.resBurnt, R.burnt + X.unitKo], [X.resBecha, R.splat + X.unitKo]]
  stats.forEach(([k, v], i) => { const sx = 760, sy = 676 + i * 100; x.fillStyle = 'rgba(255,244,220,.08)'; roundRect(x, sx, sy, 270, 88, 18); x.fill(); x.fillStyle = '#d9cbe8'; x.font = `900 24px 'Zen Maru Gothic',sans-serif`; x.fillText(k, sx + 135, sy + 32); x.fillStyle = i === 1 ? '#f4c03e' : '#fff'; x.font = `44px 'Dela Gothic One',sans-serif`; x.fillText(v, sx + 135, sy + 76) })
  // 親方の一言
  const face = faceCanvas('boss', 'normal'); x.save(); x.beginPath(); x.arc(110, 1150, 56, 0, 7); x.clip(); x.drawImage(face, 54, 1094, 112, 112); x.restore()
  x.fillStyle = '#fff4dc'; roundRect(x, 190, 1100, 840, 100, 22); x.fill()
  x.fillStyle = '#8a1c15'; x.textAlign = 'left'; x.font = `900 22px 'Zen Maru Gothic',sans-serif`; x.fillText(X.boss, 214, 1132)
  x.fillStyle = '#241510'; x.font = `900 30px 'Zen Maru Gothic',sans-serif`; x.fillText(L(tr.boss), 214, 1178, 800)
  x.textAlign = 'center'; x.fillStyle = '#a99ac0'; x.font = `900 26px 'Zen Maru Gothic',sans-serif`; x.fillText(X.cardFoot, 540, 1300)
  return c
}
// Xでポスト（クリックの中で同期的に開く。URL は url パラメータで渡す）
const GAME_URL = 'https://tom3games.github.io/takoyaki-spin/'
function xText() { const R = S.result; if (!R) return ''; return T('xText').replace('{t}', L(R.tierObj)).replace('{n}', R.boats).replace('{r}', Math.round(R.round * 100)) + ' ' + T('xTag') }
function xIntent() { return 'https://x.com/intent/post?text=' + encodeURIComponent(xText()) + '&url=' + encodeURIComponent(GAME_URL) }
function postX() { if (!S.result) return; window.open(xIntent(), '_blank', 'noopener') }
function canShare() { try { return isTouch() && !!navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'a.png', { type: 'image/png' })] }) } catch (e) { return false } }
async function saveImage() {
  const c = await drawCard(), blob = await new Promise(r => c.toBlob(r, 'image/png'))
  const file = new File([blob], 'takoyaki-spin.png', { type: 'image/png' })
  if (canShare()) { try { await navigator.share({ files: [file], title: T('title'), text: `${T('title')} ${L(S.result.tierObj)} tom3games.github.io/takoyaki-spin/` }); return blob } catch (e) { if (e && e.name === 'AbortError') return blob } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'takoyaki-spin.png'; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast(T('saved')); return blob
}
function toast(s) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = s; document.body.appendChild(d); setTimeout(() => d.remove(), 1600) }

// ---------- ループ（固定60Hz。時計は performance.now）
let acc = 0, lastT = performance.now(), paused = false, fpsN = 0, fpsT = performance.now(), fps = 0
function frame() {
  const now = performance.now(); let dt = (now - lastT) / 1000; lastT = now; if (dt > 0.25) dt = 0.25
  if (!paused) { acc += dt; while (acc >= STEP) { update(); acc -= STEP } } else acc = 0
  render()
  fpsN++; if (now - fpsT > 1000) { fps = fpsN * 1000 / (now - fpsT); fpsN = 0; fpsT = now }
  if (!S.quiet && S.view === 'play') { Snd.sizzle(Math.min(1, (S.cooking || 0) / 5)); Snd.crackle(Math.min(1, (S.cooking || 0) / 4)) }
  Snd.tick()
  requestAnimationFrame(frame)
}
function render() { syncScene(S.t); updateOrder(); updateHud(); renderer.render(scene, camera) }

// ---------- 起動
function boot() {
  try { const l = localStorage.getItem('tk.lang'); S.lang = l || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en') } catch (e) { S.lang = (navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en' }
  try { if (localStorage.getItem('tk.mute') === '1') { Snd.muted = true; $('#icOn').hidden = true; $('#icOff').hidden = false } } catch (e) {}
  for (const el of $$('[data-face]')) el.style.backgroundImage = `url(${faceUrl(el.dataset.face)})`
  applyLang()
  const on = (id, fn) => $(id).addEventListener('click', e => { Snd.init(); fn(e) })
  on('#bStart', () => { Snd.sfx('tap'); startGame() })
  on('#bHowStart', () => { Snd.sfx('tap'); startGame() })
  on('#bHow', () => { Snd.sfx('tap'); go('vHow') })
  on('#bHowBack', () => { Snd.sfx('tap'); go('vTitle') })
  on('#bAgain', () => { Snd.sfx('tap'); startGame() })
  on('#bSave', () => saveImage())
  on('#bX', () => { Snd.sfx('tap'); postX() })
  on('#bTitle', () => { Snd.sfx('tap'); go('vTitle') })
  on('#bLang', () => { S.lang = S.lang === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('tk.lang', S.lang) } catch (e) {} applyLang() })
  on('#bMute', () => { Snd.setMute(!Snd.muted); $('#icOn').hidden = Snd.muted; $('#icOff').hidden = !Snd.muted; try { localStorage.setItem('tk.mute', Snd.muted ? '1' : '0') } catch (e) {} })
  $('#vPlay').addEventListener('pointerdown', onDown)
  $('#vResult').addEventListener('pointerdown', e => { if (!e.target.closest('button')) skipResult() })
  document.addEventListener('visibilitychange', () => { lastT = performance.now(); acc = 0 })
  addEventListener('keydown', e => { if (S.view === 'play' && /^[1-8]$/.test(e.key)) { Snd.init(); tapHole(+e.key - 1) } })
  startDemo(); go('vTitle')
  requestAnimationFrame(frame)
  window.__tkReady = true
}

// 検証用の窓口
window.tk = {
  S, BOTS, startGame, tapHole, holeAt, toScreen, holePos, computeResult, drawCard, drawPhoto, saveImage, xText, xIntent, postX, GAME_URL, Snd, custs, layout,
  get fps() { return fps },
  dbg: {
    pause: v => { paused = v }, step: n => { for (let i = 0; i < n; i++) update() }, render, fps: () => fps,
    autoplay: b => { S.bot = b; S.userBot = b; S.botCd = 0 }, quiet: v => { S.forceQuiet = v; S.quiet = v || S.mode === 'demo' },
    setLeft: v => { S.left = v }, tut: v => { S.forceTut = v }, noPops: v => { S.noPops = v },
    cam: (p, l) => { camera.position.set(...p); camera.lookAt(...l); camera.updateMatrixWorld() },
    // 状態を直接作る（検証と OGP 用）
    setHole: (i, o) => Object.assign(S.holes[i], o),
    viewOffset: px => { camera.setViewOffset(innerWidth, innerHeight, px, 0, innerWidth, innerHeight); camera.updateProjectionMatrix() },
  },
}
boot()
