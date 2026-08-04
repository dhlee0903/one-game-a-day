// 숫자야구 규칙: 정답 생성과 스트라이크/볼 판정. 순수 함수만 둔다.

import { POOL } from './config.js';

// 서로 다른 숫자 `digits`개를 뽑아 정답 문자열을 만든다.
export function makeSecret(digits, rng = Math.random) {
  const pool = POOL.split('');
  let out = '';
  for (let i = 0; i < digits; i += 1) {
    out += pool.splice(Math.floor(rng() * pool.length), 1)[0];
  }
  return out;
}

function count(str, ch) {
  let n = 0;
  for (const c of str) if (c === ch) n += 1;
  return n;
}

// 자리·숫자 모두 맞으면 스트라이크, 숫자만 맞으면 볼.
// 추측에 중복 숫자가 들어올 수 있으므로 멀티셋으로 센다: 숫자별로
// min(정답 개수, 추측 개수)를 합한 값이 전체 일치 수이고, 거기서 스트라이크를 뺀 게 볼.
// 예) 정답 1234 / 추측 1111 → 1S 0B (1은 스트라이크로 소모, 남은 1은 볼이 아니다)
export function judge(secret, guess) {
  let strikes = 0;
  for (let i = 0; i < guess.length; i += 1) if (secret[i] === guess[i]) strikes += 1;
  let matched = 0;
  for (const d of POOL) matched += Math.min(count(secret, d), count(guess, d));
  return { strikes, balls: matched - strikes };
}

// 입력이 규칙에 맞는지: 자리수 일치, 숫자만. 중복은 허용한다.
export function isValidGuess(guess, digits) {
  if (guess.length !== digits) return false;
  for (const ch of guess) if (!POOL.includes(ch)) return false;
  return true;
}

// 판정 표기: "2S 1B" / "아웃"
export function formatJudge({ strikes, balls }) {
  if (strikes === 0 && balls === 0) return '아웃';
  const parts = [];
  if (strikes > 0) parts.push(`${strikes}S`);
  if (balls > 0) parts.push(`${balls}B`);
  return parts.join(' ');
}
