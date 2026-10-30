// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
import { chromium, webkit } from 'playwright'
const SLUG = 'takoyaki-spin', ORG = 'tom3games'
const URL0 = `https://${ORG}.github.io/${SLUG}/`
const ID = ['tmk', '4men'].join('')   // 公開物に出てはいけない個人ID（文字列を分けて持つ）
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts }), p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errs.push('fail ' + r.url()) })
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__tkReady, null, { timeout: 20000 })
  // 遊びの通し（タイトル → 焼く → 結果）
  await p.evaluate(() => { tk.dbg.autoplay('normal'); tk.dbg.quiet(true) })
  if (name === 'webkit') await p.tap('#bStart'); else await p.click('#bStart')
  const r = await p.evaluate(() => { tk.dbg.pause(true); let k = 0; while (tk.S.view !== 'result' && k++ < 60 * 90) tk.dbg.step(1); tk.dbg.step(60 * 5); return { view: tk.S.view, boats: tk.S.result && tk.S.result.boats, tier: tk.S.result && tk.S.result.tier } })
  await p.waitForTimeout(500)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: play=${JSON.stringify(r)} og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(), p = await b.newPage()
for (const u of [`https://github.com/${ORG}/${SLUG}`, `https://github.com/${ORG}/${SLUG}/commits/main`]) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} personalId=${new RegExp(ID, 'i').test(await p.content()) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
