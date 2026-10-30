// 全項目の自動検証。node verify.mjs（shots/ にスクショを出す）
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, statSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
// 空いているポートを自動で取る（並行して他のゲームも検証するため）
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '0' } })
const PORT = await new Promise(r => server.stdout.on('data', d => { const m = String(d).match(/:(\d+)/); if (m) r(m[1]) }))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)) }
async function open(browser, opts = {}, tutDone = true) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, acceptDownloads: true, ...opts })
  await ctx.addInitScript(k => { try { localStorage.clear(); if (k) localStorage.setItem('tk.tut', '1') } catch (e) {} }, tutDone)
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__tkReady, null, { timeout: 15000 })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
// 一画面に収まる（縦スクロールなし・ボタンや吹き出しが画面内・右上の小ボタンと重ならない）
const fit = q => q.evaluate(() => {
  const H = innerHeight, W = innerWidth, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  const sel = 'main:not([hidden]) button,main:not([hidden]) .order,main:not([hidden]) .st,main:not([hidden]) .rank,main:not([hidden]) .panel,main:not([hidden]) .logo,main:not([hidden]) .bubble,main:not([hidden]) .chip,main:not([hidden]) #photo,main:not([hidden]) .tut,#corner button'
  for (const el of document.querySelectorAll(sel)) {
    if (!el.offsetParent || el.closest('[hidden]')) continue; const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1 || r.left < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom))
  }
  const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  const cr = document.querySelector('#corner').getBoundingClientRect()
  for (const el of document.querySelectorAll('main:not([hidden]) .order,main:not([hidden]) .logo,main:not([hidden]) .rHead,main:not([hidden]) .chip,main:not([hidden]) .st,main:not([hidden]) .panel')) {
    if (!el.offsetParent || el.closest('[hidden]')) continue; if (hit(el.getBoundingClientRect(), cr)) over.push('corner-overlap:' + (el.id || el.className))
  }
  const o = document.querySelector('#order'); if (o && !o.hidden) for (const c of document.querySelectorAll('.chip')) if (hit(o.getBoundingClientRect(), c.getBoundingClientRect())) over.push('order-hud-overlap')
  return { H, over: over.slice(0, 6) }
})
// 穴が画面内にあって、指で押せる大きさ
const holesOk = q => q.evaluate(() => {
  const W = innerWidth, H = innerHeight, out = []
  for (let i = 0; i < 8; i++) { const c = tk.holePos(i), a = tk.toScreen(c), b = tk.toScreen(c.clone().setX(c.x + 0.36)); out.push({ x: Math.round(a.x), y: Math.round(a.y), r: Math.round(Math.abs(b.x - a.x)) }) }
  const inside = out.every(o => o.x - o.r > 0 && o.x + o.r < W && o.y > 50 && o.y < H - 10)
  const tut = document.querySelector('#tut'), tr = tut.hidden ? null : tut.getBoundingClientRect()
  const underTut = tr ? out.filter(o => o.y + o.r * 0.6 > tr.top && o.x > tr.left && o.x < tr.right).length : 0
  return { inside, minR: Math.min(...out.map(o => o.r)), underTut }
})
const variance3d = p => p.evaluate(() => {
  tk.dbg.render(); const src = document.querySelector('#world'), c = document.createElement('canvas'); c.width = 200; c.height = Math.round(200 * src.height / src.width)
  const x = c.getContext('2d'); x.drawImage(src, 0, 0, c.width, c.height); const d = x.getImageData(0, 0, c.width, c.height).data
  let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 3) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  return Math.round(s2 / n - (s / n) ** 2)
})
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [844, 390, 'land'], [667, 375, 'land-se'], [768, 1024, 'tab'], [1440, 900, 'pc']]
const toCook = p => p.evaluate(() => { tk.dbg.pause(true); let k = 0; while (tk.S.ph !== 'cook' && k++ < 300) tk.dbg.step(1); tk.dbg.render(); return tk.S.ph })
// 人のように本物のマウスで遊ぶ（状態を見て、押す穴の画面座標をクリック）
async function playWithMouse(p, until = 'result', maxIter = 400) {
  let clicks = 0
  for (let it = 0; it < maxIter; it++) {
    const a = await p.evaluate(() => {
      const S = tk.S; if (S.view !== 'play') return { done: true }
      const H = S.holes; let h = H.find(h => (h.st === 'side1' || h.st === 'side2') && h.d >= 0.66)
      if (!h && (S.boat && !S.serve && S.cur && (S.cur.st === 'wait' || S.cur.st === 'walk') && S.boat.balls.length < S.boat.need)) h = H.find(h => h.st === 'done')
      if (!h && H.filter(x => !['empty', 'char', 'splat', 'scrape'].includes(x.st)).length < 6) h = H.find(x => x.st === 'empty')
      if (!h) h = H.find(x => x.st === 'char')
      return h ? { ...tk.toScreen(tk.holePos(h.i)), i: h.i } : {}
    })
    if (a.done) break
    if (a.x !== undefined) { await p.mouse.click(a.x, a.y); clicks++ }
    await p.evaluate(() => tk.dbg.step(10))
  }
  return clicks
}

const browser = await chromium.launch()
const p = await open(browser, {}, false)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', r); return r
})
await t('OGP 一式がある（og:image は ?v= 付きの公開URL）', async () => {
  const r = await p.evaluate(() => ({ has: ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(document.querySelector('meta[name="twitter:card"]')?.content === 'summary_large_image'), img: document.querySelector('meta[property="og:image"]').content, url: document.querySelector('meta[property="og:url"]').content }))
  expect(r.has.every(Boolean) && r.img === 'https://tom3games.github.io/takoyaki-spin/og.png?v=1' && r.url === 'https://tom3games.github.io/takoyaki-spin/', r)
})
await t('og.png が 1200x630', async () => { const r = await p.evaluate(async () => { const im = new Image(); im.src = 'og.png'; await im.decode(); return [im.naturalWidth, im.naturalHeight] }); expect(r[0] === 1200 && r[1] === 630, r); return r })
await t('タイトルの3D（屋台）が描けている', async () => { await p.waitForTimeout(1500); const v = await variance3d(p); expect(v > 200, v); return v })
await t('タイトルの裏で鉄板が動いている（デモ）', async () => { const r = await p.evaluate(() => ({ mode: tk.S.mode, busy: tk.S.holes.filter(h => h.st !== 'empty').length })); expect(r.mode === 'demo' && r.busy > 0, r); return r })
await t('初回はチュートリアルが4段階で進み、終わると消える（マウスで）', async () => {
  await p.click('#bStart'); await toCook(p); const seen = []
  const txt = () => p.evaluate(() => !document.querySelector('#tut').hidden && document.querySelector('#tutTxt').textContent)
  seen.push(await txt())
  let c = await p.evaluate(() => tk.toScreen(tk.holePos(0))); await p.mouse.click(c.x, c.y); seen.push(await txt())
  await p.evaluate(() => { let k = 0; while (tk.S.holes[0].d < 0.7 && k++ < 600) tk.dbg.step(1) }); await p.mouse.click(c.x, c.y); seen.push(await txt())
  await p.evaluate(() => { let k = 0; while (!(tk.S.holes[0].st === 'side2' && tk.S.holes[0].d >= 0.7) && k++ < 600) tk.dbg.step(1) }); await p.mouse.click(c.x, c.y); seen.push(await txt())
  await p.evaluate(() => { let k = 0; while (tk.S.holes[0].st !== 'done' && k++ < 600) tk.dbg.step(1); k = 0; while (tk.S.cur.st !== 'wait' && k++ < 600) tk.dbg.step(1) }); await p.mouse.click(c.x, c.y)
  const end = await p.evaluate(() => ({ hid: document.querySelector('#tut').hidden, flag: localStorage.getItem('tk.tut'), boat: tk.S.boat.balls.length }))
  expect(seen.length === 4 && seen.every(Boolean) && new Set(seen).size === 4 && /クリック/.test(seen[0]) && end.hid && end.flag === '1' && end.boat === 1, { seen, end }); return seen
})
await p.close()

// 通しで遊ぶ（本物のマウス）
const q = await open(browser)
await t('マウスで60秒通しで遊べる（舟が売れて結果が出る）', async () => {
  await q.click('#bStart'); await toCook(q); await q.evaluate(() => tk.dbg.step(60 * 8)); await q.screenshot({ path: `${ROOT}/shots/play-early.png` })
  const clicks = await playWithMouse(q, 'result', 120)
  await q.evaluate(() => tk.dbg.render()); await q.screenshot({ path: `${ROOT}/shots/play-mid.png` })
  const clicks2 = await playWithMouse(q)
  await q.evaluate(() => { let k = 0; while (tk.S.view !== 'result' && k++ < 60 * 90) tk.dbg.step(1) })
  const r = await q.evaluate(() => ({ view: tk.S.view, boats: tk.S.result.boats, perfect: tk.S.result.perfect, taps: tk.S.result.taps, tier: tk.S.result.tier }))
  expect(r.view === 'result' && r.boats >= 3 && r.taps > 50, { r, clicks, clicks2 }); return r
})
await t('結果発表: 称号は発表まで見せない → ハンコが押される', async () => {
  const before = await q.evaluate(() => ({ rank: document.querySelector('#rank').classList.contains('on'), btn: getComputedStyle(document.querySelector('.rBtns')).visibility }))
  await q.evaluate(() => tk.dbg.step(60 * 1.6)); await q.evaluate(() => tk.dbg.render()); await q.screenshot({ path: `${ROOT}/shots/result-reveal.png` })
  const mid = await q.evaluate(() => document.querySelector('#rank').classList.contains('on'))
  await q.evaluate(() => tk.dbg.step(60 * 3)); await q.waitForTimeout(600)
  const after = await q.evaluate(() => ({ rank: document.querySelector('#rank').classList.contains('on'), n: document.querySelector('#rankN').textContent, st: document.querySelectorAll('.st.on').length, photo: document.querySelector('#photo').classList.contains('on'), btn: getComputedStyle(document.querySelector('.rBtns')).visibility }))
  await q.screenshot({ path: `${ROOT}/shots/result-final.png` })
  expect(!before.rank && !mid && before.btn === 'hidden' && after.rank && after.st === 4 && after.photo && after.btn === 'visible' && after.n, { before, mid, after }); return after.n
})
await t('結果の写真（最後の一舟）にたこ焼きが写っている', async () => {
  const v = await q.evaluate(() => { const c = document.querySelector('#photo'), d = c.getContext('2d').getImageData(60, 120, 480, 300).data; let brown = 0; for (let i = 0; i < d.length; i += 16) if (d[i] > 90 && d[i] < 230 && d[i + 1] > 40 && d[i + 1] < 160 && d[i + 2] < 90) brown++; return { brown, n: tk.S.result.last.balls.length } })
  expect(v.brown > 500 && v.n >= 4, v); return v
})
await t('結果画像（1080x1350）を保存できる', async () => {
  const dl = q.waitForEvent('download'); await q.click('#bSave'); const d = await dl
  const path = `${ROOT}/shots/card.png`; await d.saveAs(path); const size = statSync(path).size
  const dim = await q.evaluate(async () => { const c = await tk.drawCard(); return [c.width, c.height] })
  expect(d.suggestedFilename() === 'takoyaki-spin.png' && size > 80000 && dim[0] === 1080 && dim[1] === 1350, { f: d.suggestedFilename(), size, dim }); return { size }
})
await t('もう一回ですぐ遊べる', async () => { await q.click('#bAgain'); const r = await q.evaluate(() => ({ v: tk.S.view, ph: tk.S.ph, left: tk.S.left, boats: tk.S.st.boats, busy: tk.S.holes.filter(h => h.st !== 'empty').length })); expect(r.v === 'play' && r.ph === 'ready' && r.left === 60 && r.boats === 0 && r.busy === 0, r); return r })
await t('通しでエラーなし', async () => { expect(q.errs.length === 0, q.errs.join('|')) })
await q.close()

// 採点・境界
const s = await open(browser)
await s.evaluate(() => { tk.dbg.quiet(true); tk.dbg.noPops(true); tk.dbg.tut(0) })
const runBot = (bot, seed) => s.evaluate(([bot, seed]) => { tk.dbg.pause(true); tk.dbg.autoplay(bot); tk.startGame(seed); let k = 0; while (tk.S.view !== 'result' && k++ < 60 * 90) tk.dbg.step(1); tk.dbg.autoplay(null); const r = tk.S.result; return { score: r.score, tier: r.tier, boats: r.boats, round: Math.round(r.round * 100), burnt: r.burnt, splat: r.splat, left: r.leftCust, secs: Math.round(k / 6) / 10 } }, [bot, seed])
await t('同じ種と同じ手なら同じ結果（再現性）', async () => { const a = await runBot('normal', 4242), b = await runBot('normal', 4242); expect(JSON.stringify(a) === JSON.stringify(b), [a, b]); return a })
const dist = {}
await t('台本のボットで分布（上手い＞ふつう＞雑＞何もしない。名人は上手くてもたまに）', async () => {
  for (const bot of ['good', 'normal', 'sloppy', 'idle']) { dist[bot] = []; for (let i = 1; i <= 12; i++) dist[bot].push(await runBot(bot, i * 7919)) }
  const m = b => Math.round(dist[b].reduce((a, r) => a + r.score, 0) / dist[b].length)
  const cnt = (b, ids) => dist[b].filter(r => ids.includes(r.tier)).length
  const out = { good: m('good'), normal: m('normal'), sloppy: m('sloppy'), idle: m('idle'), goodMeijin: cnt('good', ['meijin']), goodTop2: cnt('good', ['meijin', 'naniwa']), normalMid: cnt('normal', ['sokusen', 'minarai']), sloppyLow: cnt('sloppy', ['minarai', 'nama', 'sumi', 'becha']), idleK: cnt('idle', ['kenbutsu']) }
  expect(out.good > out.normal && out.normal > out.sloppy && out.sloppy > out.idle && out.goodMeijin >= 1 && out.goodMeijin <= 8 && out.goodTop2 >= 10 && out.normalMid >= 7 && out.sloppyLow >= 10 && out.idleK === 12 && cnt('normal', ['meijin']) === 0, out); return out
})
await t('1回は60秒（＋開始と終了の合図）', async () => { const g = dist.good.map(r => r.secs); expect(g.every(x => x >= 61 && x <= 64), g); return g[0] })
const scen = fn => s.evaluate(fn)
const fresh = `tk.dbg.autoplay('idle'); tk.startGame(11); let k = 0; while (tk.S.ph !== 'cook' && k++ < 300) tk.dbg.step(1);`
await t('真ん中の穴は端より早く焼ける', async () => {
  const r = await scen(new Function(`${fresh} tk.tapHole(0); tk.tapHole(1); tk.dbg.step(60 * 1.3); return { edge: +tk.S.holes[0].d.toFixed(2), center: +tk.S.holes[1].d.toFixed(2) }`))
  expect(r.center > r.edge * 1.2, r); return r
})
await t('早すぎるとベチャッ（崩れて穴が空く）', async () => {
  const r = await scen(new Function(`${fresh} tk.tapHole(2); tk.dbg.step(30); const a = tk.tapHole(2); const st = tk.S.holes[2].st; tk.dbg.step(80); return { a, st, after: tk.S.holes[2].st, splat: tk.S.st.splat }`))
  expect(r.a === 'splat' && r.st === 'splat' && r.after === 'empty' && r.splat === 1, r); return r
})
await t('ちょうどいい色で2回返すと、まんまる', async () => {
  const r = await scen(new Function(`${fresh} tk.tapHole(4); k = 0; while (tk.S.holes[4].d < 0.72 && k++ < 900) tk.dbg.step(1); const a = tk.tapHole(4); k = 0; while (!(tk.S.holes[4].st === 'side2' && tk.S.holes[4].d >= 0.72) && k++ < 900) tk.dbg.step(1); const b = tk.tapHole(4); tk.dbg.step(30); return { a, b, st: tk.S.holes[4].st, pf: tk.S.st.pflips }`))
  expect(r.a === 'flip:p' && r.b === 'flip:p' && r.st === 'done' && r.pf === 2, r); return r
})
await t('放っておくと焦げて炭になり、煙が出る → タップでガリガリ', async () => {
  const r = await scen(new Function(`${fresh} tk.tapHole(5); tk.dbg.step(60 * 6); const st = tk.S.holes[5].st, smoke = tk.S.st.char; tk.dbg.step(30); const a = tk.tapHole(5); tk.dbg.step(30); return { st, smoke, a, after: tk.S.holes[5].st }`))
  expect(r.st === 'char' && r.smoke === 1 && r.a === 'scrape' && r.after === 'empty', r); return r
})
await t('焦げ玉を出すと「なんやこれ」系の反応、まんまるだけだと大喜び', async () => {
  const r = await scen(new Function(`${fresh}
    const mk = (i, hold, q) => tk.dbg.setHole(i, { st: 'done', d1: 0.72, d2: 0.72, hold, q1: q, q2: q })
    k = 0; while (tk.S.cur.st !== 'wait' && k++ < 300) tk.dbg.step(1)
    const id1 = tk.S.cur.id, n1 = tk.S.cur.n
    for (let i = 0; i < n1; i++) { mk(i, i === 0 ? 1.2 : 0.1, 'p'); tk.tapHole(i) }
    k = 0; while (!(tk.S.leaving && tk.S.leaving.st === 'react') && k++ < 300) tk.dbg.step(1)
    const r1 = { id: id1, react: tk.S.leaving.react, line: tk.S.leaving.line, mood: tk.S.leaving.mood }
    tk.dbg.render(); const bub1 = document.querySelector('#order').textContent
    k = 0; while (tk.S.cur.st !== 'wait' && k++ < 300) tk.dbg.step(1)
    const n2 = tk.S.cur.n; for (let i = 0; i < n2; i++) { mk(i, 0.1, 'p'); tk.tapHole(i) }
    k = 0; while (!(tk.S.leaving && tk.S.leaving.st === 'react' && tk.S.leaving.react !== 'burnt') && k++ < 300) tk.dbg.step(1)
    return { r1, bub1, r2: tk.S.leaving.react, mood2: tk.S.leaving.mood, boats: tk.S.st.boats, bs: tk.S.st.burntServed }`))
  expect(r.r1.react === 'burnt' && (r.r1.mood === 'mad' || r.r1.mood === 'cry') && r.bub1.includes(r.r1.line) && r.r2 === 'perfect' && r.mood2 === 'wow' && r.boats === 2 && r.bs === 1, r); return r
})
await t('テツさんにまんまるを出すと「プロやな！」、焦がすと「なんやこれ」', async () => {
  const r = await scen(() => ({ p: CUSTOMERS.tetsu.perfect.ja, b: CUSTOMERS.tetsu.burnt.ja }))
  expect(r.p === 'プロやな！' && /^なんやこれ/.test(r.b), r); return r
})
await t('焼き上がりを放っておくと焦げ玉（出せる）→ さらに放っておくと炭（出せない）', async () => {
  const r = await scen(new Function(`${fresh} tk.dbg.setHole(3, { st: 'done', d1: 0.7, d2: 0.7, hold: 0.9, q1: 'p', q2: 'p', burntCounted: false }); tk.dbg.step(60); const a = { st: tk.S.holes[3].st, hold: +tk.S.holes[3].hold.toFixed(2), bb: tk.S.st.burntBall }; tk.dbg.step(60 * 8); return { a, st: tk.S.holes[3].st, bb: tk.S.st.burntBall, char: tk.S.st.char }`))
  expect(r.a.st === 'done' && r.a.hold >= 1 && r.a.bb === 1 && r.st === 'char' && r.bb === 1 && r.char === 0, r); return r
})
await t('待たせすぎるとお客さんが怒って帰る', async () => {
  const r = await scen(new Function(`${fresh} const id = tk.S.cur.id; k = 0; while (!tk.S.leaving && k++ < 60 * 40) tk.dbg.step(1); return { id, gone: tk.S.leaving && tk.S.leaving.id, react: tk.S.leaving && tk.S.leaving.react, left: tk.S.st.leftCust, secs: Math.round(k / 6) / 10, next: tk.S.cur.id !== id }`))
  expect(r.gone === r.id && r.react === 'leave' && r.left === 1 && r.next && r.secs > 8 && r.secs < 25, r); return r
})
await t('盛り付け中は舟に入れられない（ちょい待ち）', async () => {
  const r = await scen(new Function(`${fresh} k = 0; while (tk.S.cur.st !== 'wait' && k++ < 300) tk.dbg.step(1); const n = tk.S.cur.n; for (let i = 0; i < 8; i++) tk.dbg.setHole(i, { st: 'done', d1: 0.7, d2: 0.7, hold: 0, q1: 'p', q2: 'p' }); for (let i = 0; i < n; i++) tk.tapHole(i); const a = tk.tapHole(n % 8 === 0 ? 7 : n); return { serving: !!tk.S.serve, a }`))
  expect(r.serving && r.a === 'wait', r); return r
})
await t('時間切れで終わり、そこまで中は押しても何も起きない', async () => {
  const r = await scen(new Function(`${fresh} tk.dbg.setLeft(0.05); tk.dbg.step(5); const ph = tk.S.ph, a = tk.tapHole(3); return { ph, a }`))
  expect(r.ph === 'end' && r.a === null, r); return r
})
await t('何もしない → ただの見物人', async () => { expect(dist.idle.every(r => r.tier === 'kenbutsu' && r.boats === 0), dist.idle[0]); return dist.idle[0].tier })
await t('称号の境界（炭職人・ベチャ職人・名人）', async () => {
  const r = await scen(() => {
    const base = { boats: 0, perfect: 0, ok: 0, burntServed: 0, char: 0, burntBall: 0, splat: 0, leftCust: 0, taps: 10, flips: 0, pflips: 0, maxCombo: 0 }
    return { sumi: tk.computeResult({ ...base, char: 6, perfect: 2, boats: 1, ok: 4 }).tier, becha: tk.computeResult({ ...base, splat: 6, perfect: 1 }).tier, meijin: tk.computeResult({ ...base, boats: 8, perfect: 30, ok: 14 }).tier, nama: tk.computeResult({ ...base, leftCust: 4 }).tier }
  })
  expect(r.sumi === 'sumi' && r.becha === 'becha' && r.meijin === 'meijin' && r.nama === 'nama', r); return r
})
await t('採点・境界でエラーなし', async () => { expect(s.errs.length === 0, s.errs.join('|')) })
await s.close()

// 音
const a = await open(browser)
await t('音: BGM・ジュージュー・生地・くるっ・声が鳴り、エラーなし', async () => {
  await a.evaluate(() => tk.dbg.autoplay('normal')); await a.click('#bStart')
  await a.waitForTimeout(9000)
  const r = await a.evaluate(() => ({ played: tk.Snd.played, st: tk.Snd.ctx && tk.Snd.ctx.state }))
  await a.evaluate(() => { for (const n of ['splat', 'burn', 'scrape', 'box', 'nope', 'serve', 'sauce', 'sprinkle', 'leave', 'round', 'perfect', 'slam', 'cheer', 'boo', 'crow', 'roll', 'whistle']) tk.Snd.sfx(n); for (const k of ['wow', 'mad', 'cry', 'ok']) tk.Snd.voice(1, k); for (const tr of ['good', 'sad', 'title']) tk.Snd.setTrack(tr) })
  await a.waitForTimeout(1200)
  const keys = Object.keys(r.played)
  expect(r.st === 'running' && ['bgm:play', 'pour', 'spin', 'sizzle'].every(k => keys.includes(k)) && keys.some(k => k.startsWith('voice:')) && a.errs.length === 0, { keys, e: a.errs }); return { keys: keys.length }
})
await t('ミュートで音量が0', async () => { await a.click('#bMute'); const m = await a.evaluate(() => tk.Snd.master.gain.value); await a.click('#bMute'); expect(m === 0, m) })
await a.close()

// 英語
const e = await open(browser)
await t('英語表示（タイトル・遊び方・プレイ・結果・画像に日本語が残らない）', async () => {
  await e.click('#bLang'); const jp = /[぀-ヿ一-鿿]/
  const tt = await e.evaluate(() => document.querySelector('#vTitle').innerText); await e.screenshot({ path: `${ROOT}/shots/en-title.png` })
  await e.click('#bHow'); const ht = await e.evaluate(() => document.querySelector('#vHow').innerText); await e.screenshot({ path: `${ROOT}/shots/en-how.png` })
  await e.evaluate(() => { tk.dbg.autoplay('normal'); tk.dbg.tut(1) }); await e.click('#bHowStart'); await toCook(e); await e.evaluate(() => { let k = 0; while (!(tk.S.cur.st === 'wait') && k++ < 300) tk.dbg.step(1); tk.dbg.render() })
  const pt = await e.evaluate(() => document.querySelector('#vPlay').innerText); await e.screenshot({ path: `${ROOT}/shots/en-play.png` })
  await e.evaluate(() => { tk.dbg.quiet(true); let k = 0; while (tk.S.view !== 'result' && k++ < 60 * 90) tk.dbg.step(1); tk.dbg.step(60 * 5) }); await e.waitForTimeout(600)
  const rt = await e.evaluate(() => document.querySelector('#vResult').innerText); await e.screenshot({ path: `${ROOT}/shots/en-result.png` })
  const card = await e.evaluate(async () => { const c = await tk.drawCard(); return c.width })
  const bad = [tt, ht, pt, rt].filter(x => jp.test(x)).map(x => x.match(/.{0,8}[぀-ヿ一-鿿].{0,8}/)[0])
  expect(!bad.length && card === 1080 && e.errs.length === 0, bad.concat(e.errs)); return rt.slice(0, 50).replace(/\n/g, ' / ')
})
await e.close()

// 6サイズ × 全画面
for (const [w, h, name] of SIZES) {
  const v = await open(browser, { viewport: { width: w, height: h } }, false)
  const views = {}; await v.waitForTimeout(400)
  views.title = await fit(v); await v.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await v.click('#bHow'); views.how = await fit(v); await v.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` }); await v.click('#bHowBack')
  await v.evaluate(() => tk.dbg.autoplay('good')); await v.click('#bStart'); await toCook(v)
  await v.evaluate(() => { let k = 0; while (tk.S.cur.st !== 'wait' && k++ < 300) tk.dbg.step(1); tk.dbg.render() })
  views.tut = await fit(v); const h1 = await holesOk(v); await v.screenshot({ path: `${ROOT}/shots/fit-${name}-tut.png` })
  await v.evaluate(() => { tk.dbg.step(60 * 9); tk.dbg.render() }); views.play = await fit(v); const h2 = await holesOk(v); await v.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  await v.evaluate(() => { let k = 0; while (!(tk.S.leaving && tk.S.leaving.st === 'react') && k++ < 60 * 20) tk.dbg.step(1); tk.dbg.step(20); tk.dbg.render() }); views.react = await fit(v); await v.screenshot({ path: `${ROOT}/shots/fit-${name}-react.png` })
  await v.evaluate(() => { tk.dbg.quiet(true); let k = 0; while (tk.S.view !== 'result' && k++ < 60 * 90) tk.dbg.step(1); tk.dbg.step(60 * 5) }); await v.waitForTimeout(700)
  views.result = await fit(v); await v.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  for (const [vn, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${vn}`, async () => { expect(!r.over.length, r) })
  await t(`${name}: 8つの穴が画面内・押せる大きさ・案内に隠れない`, async () => { expect(h1.inside && h2.inside && h1.minR >= 22 && h1.underTut === 0, { h1, h2 }); return { r: h1.minR } })
  await t(`${name}: 写真が見える大きさ`, async () => { const ts = await v.evaluate(() => document.querySelector('#photo').getBoundingClientRect().width); expect(ts >= 120, ts); return Math.round(ts) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(v); expect(o.sw <= o.W && !o.bad.length && !v.errs.length, JSON.stringify(o) + v.errs.join('|')) })
  await v.close()
}
await browser.close()

// WebKit（iPhone 相当）でタッチの通し
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, false)
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで開始 → 指で穴をタップすると生地が入る（案内は「タップ」）→ 結果まで', async () => {
  await wp.tap('#bStart'); await toCook(wp)
  const tut = await wp.evaluate(() => document.querySelector('#tutTxt').textContent)
  const c = await wp.evaluate(() => tk.toScreen(tk.holePos(6))); await wp.touchscreen.tap(c.x, c.y)
  const st = await wp.evaluate(() => tk.S.holes[6].st)
  const r = await wp.evaluate(() => { tk.dbg.autoplay('normal'); tk.dbg.quiet(true); let k = 0; while (tk.S.view !== 'result' && k++ < 60 * 90) tk.dbg.step(1); tk.dbg.step(60 * 5); return { view: tk.S.view, boats: tk.S.result.boats } })
  await wp.waitForTimeout(600); await wp.screenshot({ path: `${ROOT}/shots/webkit-result.png` })
  expect(/タップ/.test(tut) && st === 'pour' && r.view === 'result' && r.boats > 0, { tut, st, r }); return r
})
await t('WebKit: 3Dが描けている', async () => { await wp.tap('#bAgain'); await toCook(wp); await wp.evaluate(() => tk.dbg.step(60 * 5)); const v = await variance3d(wp); expect(v > 200, v); return v })
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()

// 性能（GPU を使う Chromium で実時間 4 秒遊ばせて fps を測る）
try {
  const gb = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
  const gp = await open(gb, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await gp.evaluate(() => { tk.dbg.autoplay('good'); tk.dbg.quiet(true) }); await gp.click('#bStart'); await gp.waitForTimeout(4500)
  const fps = await gp.evaluate(() => Math.round(tk.dbg.fps()))
  await t('性能: プレイ中のfps（GPUあり・390x844・DPR2）', async () => { expect(fps >= 50, fps); return fps })
  await gb.close()
} catch (err) { results.push('skip 性能: ' + err.message.split('\n')[0]) }
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
