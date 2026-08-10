// 도트 스프라이트 — 한 글자가 한 도트다.
// 여기서 정의한 모든 그림은 시작할 때 **하나의 스프라이트시트(아틀라스)**로 구워지고,
// 이후 렌더러는 아틀라스에서 잘라 쓰기만 한다(drawImage의 9인자 형태).
//
//   '.'  투명       'k'  외곽선
//   나머지 글자의 뜻은 팔레트(PAL)마다 다르다.
//
// 큰 그림(보스)은 좌우 대칭이라 **왼쪽 절반 + 가운데 열**만 찍고 구울 때 뒤집어 붙인다.
// 프레임마다 lift(0/1)를 줄 수 있다 — 굽는 캔버스가 한 줄 더 높고, 1이면 한 줄 떠 있다.
// 발밑(bottom-center) 기준으로 그리므로 lift를 번갈아 주면 걷는 동안 몸이 통통 튄다.

// ---- 팔레트 ----
export const PAL = {
  wizard: {
    k: '#150e28', h: '#4a2f9e', H: '#6d4bd6',
    r: '#3f2a86', R: '#5b3fb8', t: '#2a1c5c',
    s: '#f0c9a0', S: '#cf9c72', e: '#241a3d',
    b: '#e9eef8', B: '#b9c4dc',
    w: '#8a5a2b', W: '#b8834a', o: '#7ff0ff', O: '#ffffff',
  },
  bat: { k: '#100c1c', b: '#4a3a6e', B: '#6d5a99', e: '#ff5a63', w: '#2d2447', W: '#463a6b' },
  slime: { k: '#0d2418', g: '#1e6b39', G: '#3f9f56', l: '#a8f0b4', e: '#0a1a10' },
  bone: { k: '#141026', b: '#d9d6c8', B: '#a9a596', e: '#ff4a4a' },
  ghost: { k: '#1a1030', g: '#5f7fbe', G: '#cfe3ff', e: '#2b2050', t: '#8fb6e8' },
  stone: { k: '#0f1a14', S: '#8a9a83', s: '#5c6b57', m: '#c9d6b8', v: '#3d4a3a', e: '#ffb03a' },
  lich: {
    k: '#0b0718', r: '#2a1b52', R: '#463086', b: '#e6ecfa', B: '#a9b2c9',
    e: '#7ff0ff', o: '#b06bff', c: '#ffd23f',
  },
  gemBlue: { k: '#0a1c3a', G: '#3aa0ff', l: '#cfe9ff' },
  gemGreen: { k: '#0c2a16', G: '#3fce6a', l: '#d2ffd9' },
  gemRed: { k: '#3a0a12', G: '#ff5a63', l: '#ffd6d8' },
  heart: { k: '#3a0d16', H: '#ff5a63', h: '#ffd0d4' },
  magnet: { k: '#161a26', m: '#7f8ba3', M: '#c3ccdd', p: '#ff5a63' },
  chest: { k: '#2a1408', w: '#7a4a1c', W: '#b5793a', c: '#ffd23f' },
  arcane: { k: '#2a1060', o: '#8f6bff', O: '#e0d4ff' },
  frost: { k: '#123a52', c: '#4fb6e8', C: '#cfeeff' },
  rune: { k: '#2b1a0a', p: '#c98b3a', P: '#f0c070', y: '#ffd23f', Y: '#fff6c0' },
  zap: { k: '#243a7a', z: '#7fc4ff', Z: '#ffffff' },
  fire: { k: '#5a1400', f: '#ff7a1a', F: '#ffb03a', y: '#fff2b0' },
  rock: { k: '#1a2a1e', S: '#6e7a6a', M: '#a6b09c', v: '#42503f' },
  tuft: { k: '#14301c', g: '#4a8f43' },
  grave: { k: '#12171d', S: '#5f6773', v: '#3a414c', d: '#2c2620' },
  ground: { a: '#22301f', b: '#26381f', c: '#2c4126', d: '#1c2a1b', e: '#334c2b' },
  path: { a: '#3a3324', b: '#453c2a', c: '#4f4530', d: '#2f2a1e', e: '#564a33' },
};

// ---- 마법사 ----
// 오른쪽을 보고 있다. 왼쪽으로 갈 때는 그릴 때 좌우로 뒤집는다.
const WIZ_BODY = [
  '.....kk.........',
  '....khHk........',
  '....khHHk.......',
  '...khhHHHk......',
  '...khhHHHHk.....',
  '..khhhHHHHHk....',
  '.kkkkkkkkkkk.kk.',
  '...kssssssk.kOok',
  '...kssesSSk.kook',
  '...kbbbbbSk..kk.',
  '..kbBbbbbbk..wk.',
  '..krRRRRRrk..wk.',
  '.krrRRRRRrrk.Wk.',
  '.krrRRRRRrrk.wk.',
  '.krrrRRRrrrk.wk.',
  '.krrrrrrrrrk.wk.',
];

// 아랫단(다리) 두 줄만 갈아 끼워 걸음을 만든다
const WIZ_HEM = {
  stand: ['..kttttttttk.wk.', '...kkkkkkkk..kk.'],
  stepA: ['..ktttttttk..wk.', '...kkkk.kkk..kk.'],
  stepB: ['...ktttttttk.wk.', '....kkk.kkk..kk.'],
};

const wiz = (hem, lift) => ({ pal: 'wizard', rows: [...WIZ_BODY, ...WIZ_HEM[hem]], lift });

// ---- 리치(보스) ----
// 좌우 대칭 — 왼쪽 절반 + 가운데 열(14칸)만 찍는다. 최종 폭 27.
const lichRows = (wide) => [
  '.........c.c.c',
  '........kcckcc',
  '........kccccc',
  '.......kkbbbbb',
  '......kbbbbbbb',
  '......kbbbbbbb',
  '......kbeeekbb',
  '......kbeeekbb',
  '......kbbbbbbb',
  '.......kbbkbbb',
  '........kkkbbb',
  '.....kkkkkkkkk',
  '...kkRRRRRRRRR',
  // 가슴의 마력 핵 — 프레임마다 한 겹씩 부푼다
  wide ? '..kRRRRRRRRkoo' : '..kRRRRRRRRRRR',
  wide ? '.kRRRRRRRRkooo' : '.kRRRRRRRRRkoo',
  wide ? 'kRRRRRRRRkoooo' : 'kRRRRRRRRRkooo',
  wide ? 'kRRRRRRRRkoooo' : 'kRRRRRRRRRkooo',
  wide ? '.kRRRRRRRRkooo' : '.kRRRRRRRRRkoo',
  wide ? '.kRRRRRRRRRkoo' : '.kRRRRRRRRRRRR',
  '.kRrRRRRRRRRRR',
  '.kRrrRRRRRRRRR',
  '.kRrrrRRRRRRRR',
  '..kRrrrrRRRRRR',
  '..kRrrrrrRRRRR',
  '...kRrrrrrRRRR',
  '...kRrrrrrrRRR',
  '....kRrrrrrrRR',
  '....kkRrrrrrrR',
  '.....kkRrrrrrr',
  '......kkkkkkkk',
];

// ---- 결정적 노이즈로 굽는 바닥 타일 ----
// 손으로 16×16 잡티를 찍는 건 읽기도 고치기도 어렵다. 대신 시드 고정 난수로
// 글자를 흩뿌려 만든다 — 결과는 다른 그림과 똑같이 아틀라스에 구워진다.
function noiseTile(size, weights, seed) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const bag = [];
  for (const [ch, n] of weights) for (let i = 0; i < n; i += 1) bag.push(ch);
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    let line = '';
    for (let x = 0; x < size; x += 1) line += bag[Math.floor(rnd() * bag.length)];
    rows.push(line);
  }
  return rows;
}

const GRASS_MIX = [['a', 9], ['b', 6], ['c', 3], ['d', 3], ['e', 1]];
const PATH_MIX = [['a', 9], ['b', 6], ['c', 3], ['d', 3], ['e', 1]];

// ---- 프레임 목록 ----
// name → { pal, rows, mirror?, lift?, flipX? }
export const MAPS = {
  'wizard.idle0': wiz('stand', 0),
  'wizard.idle1': wiz('stand', 1),
  'wizard.walk0': wiz('stepA', 1),
  'wizard.walk1': wiz('stand', 0),
  'wizard.walk2': wiz('stepB', 1),
  'wizard.walk3': wiz('stand', 0),

  'bat.0': {
    pal: 'bat',
    lift: 1,
    rows: [
      'kk........kk',
      'kWk......kWk',
      'kWWk....kWWk',
      '.kWWkkkkWWk.',
      '..kbBbbBbk..',
      '..kbeBBebk..',
      '...kbbbbk...',
      '....kbbk....',
      '.....kk.....',
    ],
  },
  'bat.1': {
    pal: 'bat',
    lift: 0,
    rows: [
      '............',
      '............',
      '...kkkkkkk..',
      '..kbBbbBbk..',
      '..kbeBBebk..',
      'kWkbbbbbbkWk',
      'kWWkkbbkkWWk',
      '.kWWkbbkWWk.',
      '..kkk..kkk..',
    ],
  },

  'slime.0': {
    pal: 'slime',
    rows: [
      '.....kkkk.....',
      '...kkGGGGkk...',
      '..kGGllGGGGk..',
      '.kGGlllGGGGGk.',
      '.kGGGGGGGGGGk.',
      'kGGeGGGGGeGGGk',
      'kGGGGGGGGGGGGk',
      'kGGGGGkkGGGGGk',
      'kggGGGGGGGGggk',
      '.kggggggggggk.',
      '..kkkkkkkkkk..',
    ],
  },
  'slime.1': {
    pal: 'slime',
    rows: [
      '..............',
      '..............',
      '....kkkkkk....',
      '..kkGGllGGkk..',
      '.kGGlllGGGGGk.',
      'kGGeGGGGGeGGGk',
      'kGGGGGGGGGGGGk',
      'kGGGGGkkGGGGGk',
      'kggGGGGGGGGggk',
      '.kggggggggggk.',
      '..kkkkkkkkkk..',
    ],
  },

  'skeleton.0': {
    pal: 'bone',
    lift: 0,
    rows: [
      '...kkkk.....',
      '..kbbbbk....',
      '..kbebek....',
      '..kbbbbk....',
      '..kbBBbk....',
      '...kkkk.....',
      '....kk......',
      '..kbbbbbk...',
      '.kbBbbbBbk..',
      '.kbkbbbkbk..',
      '.kbBbbbBbk..',
      '..kbbbbbk...',
      '..kb...bk...',
      '..kb...bk...',
      '..kbk.kbk...',
      '..kkk.kkk...',
    ],
  },
  'skeleton.1': {
    pal: 'bone',
    lift: 1,
    rows: [
      '...kkkk.....',
      '..kbbbbk....',
      '..kbebek....',
      '..kbbbbk....',
      '..kbBBbk....',
      '...kkkk.....',
      '....kk......',
      '..kbbbbbk...',
      '.kbBbbbBbk..',
      '.kbkbbbkbk..',
      '.kbBbbbBbk..',
      '..kbbbbbk...',
      '..kb..bk....',
      '..kbb.bk....',
      '.kbk..kbk...',
      '.kkk..kkk...',
    ],
  },

  'ghost.0': {
    pal: 'ghost',
    lift: 0,
    rows: [
      '....kkkkk....',
      '..kkGGGGGkk..',
      '.kGGGGGGGGGk.',
      '.kGGGGGGGGGk.',
      'kGGGeGGGeGGGk',
      'kGGGeGGGeGGGk',
      'kGGGGGGGGGGGk',
      'kGGGGkkkGGGGk',
      'kgGGGGGGGGGgk',
      'kgGGGGGGGGGgk',
      '.kgggggggggk.',
      '.ktktkktktk..',
      '..k.k..k.k...',
    ],
  },
  'ghost.1': {
    pal: 'ghost',
    lift: 1,
    rows: [
      '....kkkkk....',
      '..kkGGGGGkk..',
      '.kGGGGGGGGGk.',
      '.kGGGGGGGGGk.',
      'kGGGeGGGeGGGk',
      'kGGGeGGGeGGGk',
      'kGGGGGGGGGGGk',
      'kGGGGkkkGGGGk',
      'kgGGGGGGGGGgk',
      'kgGGGGGGGGGgk',
      '.kgggggggggk.',
      '..ktkkkkktk..',
      '...k.k.k.k...',
    ],
  },

  'golem.0': {
    pal: 'stone',
    lift: 0,
    rows: [
      '......kkkkkkk.......',
      '.....kSSSSSSSk......',
      '.....kSeSSSeSk......',
      '.....kSSSSSSSk......',
      '.....kvSSSSSvk......',
      '..kkkkkkkkkkkkkkk...',
      '.kSSSSSSSSSSSSSSSk..',
      'kSSmSSSSSSSSSSSmSSk.',
      'kSSSkSSSeeSSSkSSSSk.',
      'kSSSkSSSeeSSSkSSSSk.',
      'kSSSkSSSSSSSSkSSSSk.',
      'kvSSkSSSSSSSSkSSSvk.',
      'kvSSkkvvvvvvkkSSSvk.',
      '.kkk.kvvvvvvk.kkkk..',
      '.....kvSSSSvk.......',
      '....kkSSSSSSkk......',
      '....kSSSkkSSSk......',
      '....kSSk..kSSk......',
      '....kSSk..kSSk......',
      '....kkkk..kkkk......',
    ],
  },
  'golem.1': {
    pal: 'stone',
    lift: 1,
    rows: [
      '......kkkkkkk.......',
      '.....kSSSSSSSk......',
      '.....kSeSSSeSk......',
      '.....kSSSSSSSk......',
      '.....kvSSSSSvk......',
      '..kkkkkkkkkkkkkkk...',
      '.kSSSSSSSSSSSSSSSk..',
      'kSSmSSSSSSSSSSSmSSk.',
      'kSSSkSSSeeSSSkSSSSk.',
      'kSSSkSSSeeSSSkSSSSk.',
      'kSSSkSSSSSSSSkSSSSk.',
      'kvSSkSSSSSSSSkSSSvk.',
      'kvSSkkvvvvvvkkSSSvk.',
      '.kkk.kvvvvvvk.kkkk..',
      '.....kvSSSSvk.......',
      '....kkSSSSSSkk......',
      '....kSSSkkSSSk......',
      '...kSSk....kSSk.....',
      '...kSSk....kSSk.....',
      '...kkkk....kkkk.....',
    ],
  },

  'lich.0': { pal: 'lich', mirror: true, lift: 0, rows: lichRows(false) },
  'lich.1': { pal: 'lich', mirror: true, lift: 1, rows: lichRows(true) },

  'gem.blue': { pal: 'gemBlue', rows: gemRows() },
  'gem.green': { pal: 'gemGreen', rows: gemRows() },
  'gem.red': { pal: 'gemRed', rows: gemRows() },

  'heart': {
    pal: 'heart',
    rows: [
      '.kk...kk.',
      'kHHkkkHHk',
      'kHhHHHHHk',
      'kHHHHHHHk',
      '.kHHHHHk.',
      '..kHHHk..',
      '...kHk...',
      '....k....',
    ],
  },
  'magnet': {
    pal: 'magnet',
    rows: [
      '..kkkkk..',
      '.kmmkmmk.',
      'kmMkkkMmk',
      'kmMk.kMmk',
      'kmMk.kMmk',
      'kmMk.kMmk',
      'kppk.kppk',
      'kppk.kppk',
      '.kk...kk.',
    ],
  },
  'chest': {
    pal: 'chest',
    rows: [
      '..kkkkkkkkk..',
      '.kwWWWWWWWwk.',
      'kwWWWWWWWWWwk',
      'kwWWWWcWWWWwk',
      'kkkkkkckkkkkk',
      'kwwwwwcwwwwwk',
      'kwWWWWcWWWWwk',
      'kwWWWWcWWWWwk',
      'kwWWWWWWWWWwk',
      'kwwwwwwwwwwwk',
      '.kkkkkkkkkkk.',
    ],
  },

  'bolt.0': {
    pal: 'arcane',
    rows: [
      '..kkk..',
      '.koook.',
      'koOOOok',
      'koOOOok',
      'koOOOok',
      '.koook.',
      '..kkk..',
    ],
  },
  'bolt.1': {
    pal: 'arcane',
    rows: [
      '.......',
      '..kkk..',
      '.koOok.',
      '.kOOOk.',
      '.koOok.',
      '..kkk..',
      '.......',
    ],
  },

  'shard': {
    pal: 'frost',
    rows: [
      '......kkk..',
      'kkkkkkcCCk.',
      'kccCCCCCCCk',
      'kkkkkkcCCk.',
      '......kkk..',
    ],
  },

  'rune.0': {
    pal: 'rune',
    rows: [
      '..kkkkk..',
      '.kppppPk.',
      'kpPkkkPpk',
      'kpkyyykpk',
      'kpkyYykpk',
      'kpkyyykpk',
      'kpPkkkPpk',
      '.kppppPk.',
      '..kkkkk..',
    ],
  },
  'rune.1': {
    pal: 'rune',
    rows: [
      '...kkk...',
      '...kpk...',
      '...kpk...',
      '...kyk...',
      '...kYk...',
      '...kyk...',
      '...kpk...',
      '...kpk...',
      '...kkk...',
    ],
  },

  'zap.0': { pal: 'zap', rows: zapRows() },
  'zap.1': { pal: 'zap', rows: zapRows(), flipX: true },

  'flame.0': {
    pal: 'fire',
    rows: [
      '...k...',
      '..kfk..',
      '..kFk..',
      '.kfFfk.',
      '.kFFFk.',
      'kfFFFfk',
      'kfFyFfk',
      '.kfffk.',
      '..kkk..',
    ],
  },
  'flame.1': {
    pal: 'fire',
    rows: [
      '.......',
      '...k...',
      '..kfk..',
      '..kFk..',
      '.kFfFk.',
      'kfFyFfk',
      'kfFFFfk',
      '.kfffk.',
      '..kkk..',
    ],
  },
  'flame.2': {
    pal: 'fire',
    rows: [
      '.......',
      '.......',
      '...k...',
      '..kfk..',
      '.kfFfk.',
      '.kFyFk.',
      'kfFFFfk',
      '.kfffk.',
      '..kkk..',
    ],
  },

  'rock': {
    pal: 'rock',
    rows: [
      '...kkk...',
      '.kkSSSkk.',
      'kSSSSMSSk',
      'kSSSSSSSk',
      'kvSSSSSvk',
      '.kvvvvvk.',
      '..kkkkk..',
    ],
  },
  'tuft': {
    pal: 'tuft',
    rows: [
      '.k...k.',
      'kg.k.gk',
      'kg.g.gk',
      '.kgggk.',
      '..kkk..',
    ],
  },
  'grave': {
    pal: 'grave',
    rows: [
      '...kkkkk...',
      '..kSSSSSk..',
      '.kSSSSSSSk.',
      'kSSSSvSSSSk',
      'kSSSvvvSSSk',
      'kSSSSvSSSSk',
      'kSSSSvSSSSk',
      'kSSSSSSSSSk',
      'kvSSSSSSSvk',
      'kvvSSSSSvvk',
      'kvvvvvvvvvk',
      '.kkkkkkkkk.',
      '..ddddddd..',
    ],
  },

  'tile.grass0': { pal: 'ground', tile: true, rows: noiseTile(16, GRASS_MIX, 20260810) },
  'tile.grass1': { pal: 'ground', tile: true, rows: noiseTile(16, GRASS_MIX, 77712) },
  'tile.path': { pal: 'path', tile: true, rows: noiseTile(16, PATH_MIX, 31337) },
};

function gemRows() {
  return [
    '..kkk..',
    '.kGGGk.',
    'kGllGGk',
    'kGlGGGk',
    'kGGGGGk',
    '.kGGGk.',
    '..kkk..',
  ];
}

function zapRows() {
  return [
    '....kkk....',
    '...kzZk....',
    '...kzZk....',
    '..kzZZk....',
    '..kzZk.....',
    '.kzZZk.....',
    '.kzZk......',
    '.kzZk......',
    '..kzZZk....',
    '...kzZZk...',
    '....kzZZk..',
    '....kzZk...',
    '.....kzZk..',
    '.....kzZk..',
    '....kzZZk..',
    '....kzZk...',
    '...kzZk....',
    '...kzk.....',
    '..kzk......',
    '..kk.......',
  ];
}

// ---- 5×7 비트맵 글꼴(HUD 전용) ----
// 캔버스 위 숫자·라벨은 도트로 찍는다. 한글 문구는 DOM 오버레이가 맡는다.
export const FONT = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '01010', '00100', '00100', '00100', '01010', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

// ---- 검증 ----
// 픽셀맵은 손으로 찍는다 — 줄 길이가 하나만 어긋나도 그림이 밀린다.
// 굽기 전에 직사각형인지, 팔레트에 없는 글자가 없는지 본다.
export function validateMaps() {
  const bad = [];
  for (const [name, m] of Object.entries(MAPS)) {
    const pal = PAL[m.pal];
    if (!pal) { bad.push(`${name}: 팔레트 '${m.pal}' 없음`); continue; }
    const w = m.rows[0].length;
    m.rows.forEach((row, y) => {
      if (row.length !== w) bad.push(`${name}: ${y}번째 줄 길이 ${row.length} (기대 ${w})`);
      for (const ch of row) {
        if (ch !== '.' && !pal[ch]) bad.push(`${name}: ${y}번째 줄에 모르는 글자 '${ch}'`);
      }
    });
  }
  return bad;
}

// ---- 굽기 ----
// 모든 프레임을 선반(shelf) 방식으로 하나의 캔버스에 채운다.
// 반환: { canvas, tinted, frames } — frames[name] = { x, y, w, h }
const SHEET_W = 256;
const GAP = 1;

// 캐릭터 프레임은 한 줄 더 높게 굽는다(lift용). 바닥 타일은 이어 붙여야 하므로 딱 맞게.
export function frameSize(m) {
  const half = m.rows[0].length;
  return { w: m.mirror ? half * 2 - 1 : half, h: m.rows.length + (m.tile ? 0 : 1) };
}

function paintFrame(ctx, m, ox, oy) {
  const pal = PAL[m.pal];
  const half = m.rows[0].length;
  const w = m.mirror ? half * 2 - 1 : half;
  const top = oy + (m.tile || m.lift ? 0 : 1);
  for (let y = 0; y < m.rows.length; y += 1) {
    const row = m.rows[y];
    for (let x = 0; x < half; x += 1) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = pal[ch];
      const px = m.flipX ? w - 1 - x : x;
      ctx.fillRect(ox + px, top + y, 1, 1);
      if (m.mirror) {
        const mx = w - 1 - x;
        if (mx !== x) ctx.fillRect(ox + mx, top + y, 1, 1);
      }
    }
  }
}

export function buildSheet() {
  const problems = validateMaps();
  if (problems.length) console.error('스프라이트 픽셀맵 오류:\n' + problems.join('\n'));

  const names = Object.keys(MAPS);
  // 높은 것부터 채우면 선반 낭비가 준다
  const order = [...names].sort((a, b) => frameSize(MAPS[b]).h - frameSize(MAPS[a]).h);

  const frames = {};
  let x = GAP;
  let y = GAP;
  let shelf = 0;
  for (const name of order) {
    const { w, h } = frameSize(MAPS[name]);
    if (x + w + GAP > SHEET_W) { x = GAP; y += shelf + GAP; shelf = 0; }
    frames[name] = { x, y, w, h };
    x += w + GAP;
    if (h > shelf) shelf = h;
  }
  const height = y + shelf + GAP;

  const canvas = document.createElement('canvas');
  canvas.width = SHEET_W;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (const name of order) paintFrame(ctx, MAPS[name], frames[name].x, frames[name].y);

  // 피격 순간에 쓸 흰 실루엣 — 같은 좌표계라 프레임 표를 그대로 쓴다
  const tinted = document.createElement('canvas');
  tinted.width = canvas.width;
  tinted.height = canvas.height;
  const tc = tinted.getContext('2d');
  tc.drawImage(canvas, 0, 0);
  tc.globalCompositeOperation = 'source-atop';
  tc.fillStyle = 'rgba(255,255,255,.88)';
  tc.fillRect(0, 0, tinted.width, tinted.height);

  return { canvas, tinted, frames };
}
