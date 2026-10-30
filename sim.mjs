// 台本のボットで結果の分布を測る。node sim.mjs（N=回数）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '0' } })
const PORT = await new Promise(r => server.stdout.on('data', d => { const m = String(d).match(/:(\d+)/); if (m) r(m[1]) }))
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' })
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__tkReady)
const N = Number(process.env.N || 12)
const out = await p.evaluate(N => {
  tk.dbg.pause(true); tk.dbg.quiet(true); tk.dbg.tut(0); tk.dbg.noPops(true); const res = {}
  for (const bot of ['good', 'normal', 'sloppy', 'idle']) {
    res[bot] = { tiers: {}, rows: [] }
    for (let s = 1; s <= N; s++) {
      tk.dbg.autoplay(bot); tk.startGame(s * 7919); let k = 0
      while (tk.S.view !== 'result' && k < 60 * 90) { tk.dbg.step(1); k++ }
      const r = tk.S.result
      res[bot].tiers[r.tier] = (res[bot].tiers[r.tier] || 0) + 1
      res[bot].rows.push([r.score, r.boats, Math.round(r.round * 100), r.burnt, r.splat, r.leftCust, Math.round(k / 6) / 10, r.char, r.burntBall, r.burntServed, r.pflips, r.flips])
    }
  }
  tk.dbg.autoplay(null)
  return res
}, N)
for (const [k, v] of Object.entries(out)) {
  const m = i => (v.rows.reduce((a, r) => a + r[i], 0) / v.rows.length).toFixed(1)
  console.log(k.padEnd(7), 'score', m(0), 'boats', m(1), 'round%', m(2), 'burnt', m(3), 'splat', m(4), 'left', m(5), 'secs', m(6), 'char', m(7), 'bball', m(8), 'bserved', m(9), 'pflip', m(10), 'flips', m(11), JSON.stringify(v.tiers))
  console.log('        scores', v.rows.map(r => r[0]).join(' '))
}
console.log('errors', errs.length ? errs.slice(0, 5) : 'none')
await b.close(); server.kill()
