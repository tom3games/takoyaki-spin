// SNS用サムネ og.png（1200x630）。遊んでいる一番おもしろい場面（焦げを出してテツさん激怒）＋タイトル。node og.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '0' } })
const PORT = await new Promise(r => server.stdout.on('data', d => { const m = String(d).match(/:(\d+)/); if (m) r(m[1]) }))
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, locale: 'ja-JP' })
await p.addInitScript(() => { try { localStorage.setItem('tk.tut', '1') } catch (e) {} })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__tkReady)
await p.evaluate(() => document.fonts.ready)
await p.evaluate(() => {
  const S = tk.S; tk.dbg.pause(true); tk.dbg.quiet(true); tk.dbg.noPops(true); tk.dbg.autoplay('idle'); tk.startGame(5)
  let k = 0; while (S.ph !== 'cook' && k++ < 300) tk.dbg.step(1)
  const set = () => {
    const H = [
      { st: 'done', d1: 0.72, d2: 0.7, hold: 0.15, q1: 'p', q2: 'p' }, { st: 'side2', d: 0.95, d1: 0.72 }, { st: 'char', charSide: 'side1', d: 1.1 }, { st: 'done', d1: 0.7, d2: 0.74, hold: 0.3, q1: 'p', q2: 'p' },
      { st: 'side1', d: 0.68 }, { st: 'flip1', t: 0.12, d1: 0.7 }, { st: 'splat', t: 0.4 }, { st: 'side1', d: 0.3 }]
    H.forEach((o, i) => tk.dbg.setHole(i, { t: 0, ...o }))
  }
  set(); for (let i = 0; i < 50; i++) { tk.dbg.step(1); if (i % 10 === 0) set() } set()
  const tetsu = { id: 'tetsu', n: 6, st: 'react', react: 'burnt', line: CUSTOMERS.tetsu.burnt.ja, mood: 'mad', t: 0.4, x: -0.15, z: -2.75, pat: 0, patMax: 1 }
  S.cur = { ...S.cur, id: 'machiko', st: 'walk', x: 1.0, z: -3.3 }; S.nextC = { ...S.cur, id: 'yuta', x: 1.9, z: -3.65, st: 'line' }; S.leaving = tetsu
  const balls = [0, 1, 2, 3, 4, 5].map(i => ({ c1: i === 2 ? '#141010' : '#cc7a2a', c2: i === 2 ? '#141010' : '#c4702a', kind: i === 2 ? 'burnt' : 'perfect' }))
  S.serve = { t: 0.95, balls, cust: tetsu, extra: [] }; S.boat = { balls, need: 6, fly: [], appear: 1 }
  tk.dbg.viewOffset(230); tk.dbg.render()
})
await p.addStyleTag({ content: `#corner,.hud,#tut,#banner{display:none!important}.order{font-size:27px!important;max-width:460px!important;padding:12px 18px!important}.order small{font-size:16px!important}
  body::after{content:'';position:fixed;inset:0 0 0 50%;background:linear-gradient(90deg,rgba(22,18,42,0),rgba(22,18,42,.94) 26%);z-index:30}` })
await p.evaluate(() => {
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;right:34px;top:0;bottom:0;width:470px;z-index:31;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:20px;color:#fff;text-align:center'
  d.innerHTML = `<div style="padding:16px 34px 20px;border-radius:46%/34%;background:radial-gradient(120% 90% at 50% 40%,#ff6a3a,#d8352a 55%,#7a1410);box-shadow:0 0 50px rgba(255,120,60,.5)"><div style="font-weight:900;font-size:28px;letter-spacing:.35em;color:#ffe9b0;font-family:'Zen Maru Gothic'">たこ焼き</div><div style="font-family:'Dela Gothic One';font-size:96px;line-height:1.05;text-shadow:0 5px 0 #7a1410">くるくる</div></div>
  <div style="font-weight:900;font-size:31px;line-height:1.45;font-family:'Zen Maru Gothic'">8つの穴、全部まんまるに焼き上げろ。<br><span style="color:#f4c03e">焦がしたら、おっちゃんが黙ってない。</span></div>`
  document.body.appendChild(d)
})
await p.evaluate(() => tk.dbg.render())
await p.waitForTimeout(500)
await p.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill()
console.log('ok')
