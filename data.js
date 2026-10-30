// たこ焼きくるくる 文言・お客さん・称号。処理は game.js
'use strict'

const TXT = {
  ja: {
    title: 'たこ焼きくるくる', titleA: 'たこ焼き', titleB: 'くるくる',
    sub: '8つの穴、全部まんまるに焼き上げろ。',
    boss: 'タコ吉親方', bossLine: 'わし、腰いわしてもうた…。今日の屋台はお前に任せたで。焦がしたら常連が黙ってへんからな！',
    start: '鉄板に立つ', how: '遊び方', back: 'もどる', howTitle: '遊び方',
    how1T: '空いた穴を{tap}して生地を流す', how2T: 'きつね色になったら{tap}。ピックでくるっ（1回目で半分）',
    how3T: 'もう一回きつね色で{tap}すると、まんまる', how4T: 'まんまるを{tap}して舟皿へ。注文の数がそろうと出せる',
    howNote: '早すぎるとベチャッ、遅いと炭。真ん中の穴ほど早く焼ける。60秒勝負！',
    tapT: 'タップ', tapC: 'クリック',
    colRaw: '生', colGood: 'ここ！', colBurnt: '焦げ',
    ready: 'よーい…', go: '焼けッ！', timeUp: 'そこまで！',
    tut1: '空いた穴を{tap}して生地を流す', tut2: 'きつね色になったら{tap}でくるっ', tut3: 'もう一回きつね色で{tap} → まんまる', tut4: 'まんまるを{tap}して舟皿へ',
    pPerfect: 'ええ色！', pEarly: 'ちょい生', pLate: '濃いめ', pSplat: 'ベチャッ', pChar: '炭…', pScrape: 'ガリガリ', pWait: 'ちょい待ち！', pRound: 'まんまる！', pCombo: '{n}連続！',
    sold: '舟', secs: '秒', inBoat: '{a}/{b}こ',
    resHead: '本日の売上', resBoats: '売った舟', resRound: 'まんまる率', resBurnt: '焦げ', resBecha: 'ベチャ', resLeft: '帰った客', resTitle: '称号',
    unitBoat: '舟', unitKo: 'こ', unitNin: '人',
    photoCap: '最後の一舟', photoNone: '1舟も売れず…',
    again: 'もう一回焼く', save: '画像を保存', share: '画像を共有', post: 'Xでポスト', xText: 'たこ焼きくるくるで「{t}」でした。{n}舟売って、まんまる率{r}%。', xTag: '#たこ焼きくるくる', saved: '画像を保存しました', tapSkip: 'タップでとばす',
    cardFoot: 'tom3games.github.io/takoyaki-spin',
  },
  en: {
    title: 'TAKOYAKI SPIN', titleA: 'TAKOYAKI', titleB: 'SPIN',
    sub: 'Eight holes. Make every ball perfectly round.',
    boss: 'Boss Takokichi', bossLine: 'I threw my back out... The stall is yours today. Burn them and the regulars will riot!',
    start: 'Start cooking', how: 'How to play', back: 'Back', howTitle: 'How to play',
    how1T: '{tap} an empty hole to pour batter', how2T: '{tap} when it turns golden. The pick spins it halfway',
    how3T: '{tap} at golden again to make it round', how4T: '{tap} round balls to put them in the boat. Fill the order to serve',
    howNote: 'Too early: SPLAT. Too late: charcoal. Center holes cook faster. 60 seconds!',
    tapT: 'Tap', tapC: 'Click',
    colRaw: 'Raw', colGood: 'NOW!', colBurnt: 'Burnt',
    ready: 'Ready...', go: 'COOK!', timeUp: 'TIME!',
    tut1: '{tap} an empty hole to pour', tut2: '{tap} when golden to spin', tut3: '{tap} at golden again: round!', tut4: '{tap} the round ball to box it',
    pPerfect: 'PERFECT!', pEarly: 'A bit raw', pLate: 'Dark-ish', pSplat: 'SPLAT', pChar: 'CHAR...', pScrape: 'SCRAPE', pWait: 'Hold on!', pRound: 'ROUND!', pCombo: '{n} in a row!',
    sold: 'boats', secs: 's', inBoat: '{a}/{b}',
    resHead: "Today's sales", resBoats: 'Boats sold', resRound: 'Round rate', resBurnt: 'Burnt', resBecha: 'Splats', resLeft: 'Walked out', resTitle: 'Title',
    unitBoat: '', unitKo: '', unitNin: '',
    photoCap: 'The last boat', photoNone: 'Not a single boat sold...',
    again: 'Cook again', save: 'Save image', share: 'Share image', post: 'Post on X', xText: 'I got "{t}" in TAKOYAKI SPIN. Sold {n} boats, {r}% perfectly round.', xTag: '#TakoyakiSpin', saved: 'Image saved', tapSkip: 'Tap to skip',
    cardFoot: 'tom3games.github.io/takoyaki-spin',
  },
}

// お客さん。n は注文の数、pitch は声の高さ。行は ja/en
const CUSTOMERS = {
  tetsu: {
    n: 6, pitch: 0.72, skin: '#e7b48a', shirt: '#3a6fb0', hair: '#3a3a3a', style: 'bald',
    name: { ja: '常連のテツさん', en: 'Tetsu (regular)' },
    order: { ja: 'いつもの6こ！はよしてや', en: 'The usual, six! Chop chop!' },
    perfect: { ja: 'プロやな！', en: "You're a pro!" },
    ok: { ja: 'まあ、食えるわ', en: 'Eh, edible.' },
    burnt: { ja: 'なんやこれ！炭やんけ！', en: "What's this?! Charcoal!" },
    leave: { ja: '遅いわ！もうええ！', en: 'Too slow! Forget it!' },
  },
  yuta: {
    n: 4, pitch: 1.9, skin: '#f3c9a0', shirt: '#f2c230', hair: '#2a1a12', style: 'cap',
    name: { ja: 'ゆうたくん（7さい）', en: 'Yuta (age 7)' },
    order: { ja: '4こください！', en: 'Four, please!' },
    perfect: { ja: 'まんまるー！すごーい！', en: 'So round! Wow!' },
    ok: { ja: 'おいしいけど…ふにゃ', en: 'Yummy... but squishy' },
    burnt: { ja: 'まっくろ…おかあさーん！', en: "It's black... Mommy!" },
    leave: { ja: 'もう帰るー！', en: "I'm going home!" },
  },
  mike: {
    n: 8, pitch: 1.12, skin: '#f2cdb0', shirt: '#e85a8a', hair: '#e8c45a', style: 'hat',
    name: { ja: '観光客のマイク', en: 'Mike (tourist)' },
    order: { ja: 'エイト、プリーズ！ゼンブ！', en: 'Eight, please! All of them!' },
    perfect: { ja: 'ワオ！パーフェクト・ボール！', en: 'WOW! Perfect spheres!' },
    ok: { ja: 'グッド…たぶん？', en: 'Good... I think?' },
    burnt: { ja: 'コレ…チャコール？', en: 'Is this... charcoal?' },
    leave: { ja: 'タイムアウト…バイ…', en: 'Time out... bye...' },
  },
  machiko: {
    n: 6, pitch: 1.45, skin: '#efc19a', shirt: '#d9a03a', hair: '#7a3a8a', style: 'perm',
    name: { ja: 'ヒョウ柄のマチコさん', en: 'Machiko (leopard print)' },
    order: { ja: '6こちょうだい。アメちゃんあげるわ', en: 'Six, dear. Have a candy.' },
    perfect: { ja: 'あんた天才ちゃう！？', en: 'Are you a genius?!' },
    ok: { ja: 'ほな、まあまあやね', en: 'Well, so-so.' },
    burnt: { ja: 'なんやのこれ！真っ黒やん！', en: "What on earth! It's pitch black!" },
    leave: { ja: '日ぃ暮れるわ！', en: "I'll be here till sunset!" },
  },
}
const CUST_IDS = Object.keys(CUSTOMERS)

// 称号（上から判定。special は条件で先に決まる）
const TIERS = [
  { id: 'meijin', min: 300, color: 'gold', ja: 'たこ焼き名人', en: 'TAKOYAKI MASTER', boss: { ja: 'わしより上手いやないか…腰治っても戻られへんわ', en: "You're better than me... I may never come back." } },
  { id: 'naniwa', min: 170, color: 'red', ja: '浪速の焼き職人', en: 'OSAKA GRILL PRO', boss: { ja: 'ほぉ、ええ手つきや。明日も頼むで', en: 'Nice hands. Come back tomorrow.' } },
  { id: 'sokusen', min: 75, color: 'blue', ja: '屋台の即戦力', en: 'STALL READY', boss: { ja: 'まあまあやな。まんまるにはまだ遠いで', en: 'Not bad. Still far from round.' } },
  { id: 'minarai', min: 20, color: 'gray', ja: 'たこ焼き見習い', en: 'APPRENTICE', boss: { ja: '…明日からは、くるっと返す練習や', en: '...Tomorrow we practice spinning.' } },
  { id: 'nama', min: -9999, color: 'gray', ja: 'まだ生焼け', en: 'STILL RAW', boss: { ja: 'お客さん、みんな帰ってもうたで…', en: 'Every customer walked out...' } },
]
const SPECIAL = {
  sumi: { id: 'sumi', color: 'black', ja: '炭職人', en: 'CHARCOAL ARTISAN', boss: { ja: 'たこ焼き屋や！炭焼き小屋ちゃうねん！', en: "This is a takoyaki stall, not a charcoal kiln!" } },
  becha: { id: 'becha', color: 'black', ja: 'ベチャ職人', en: 'MUSH MAKER', boss: { ja: '返すの早すぎや！鉄板がもんじゃになっとる！', en: "Too early! The grill looks like soup!" } },
  kenbutsu: { id: 'kenbutsu', color: 'black', ja: 'ただの見物人', en: 'JUST WATCHING', boss: { ja: '…見とっただけか？お前、客か？', en: '...You just watched? Are you a customer?' } },
}
