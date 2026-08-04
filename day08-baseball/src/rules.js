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

// 자리·숫자 모두 맞으면 스트라이크, 숫자만 맞으면 볼. 둘 다 0이면 아웃.
// 정답/추측 모두 중복 없는 문자열이라는 전제(입력 검증에서 보장).
export function judge(secret, guess) {
  let strikes = 0;
  let balls = 0;
  for (let i = 0; i < guess.length; i += 1) {
    const at = secret.indexOf(guess[i]);
    if (at === i) strikes += 1;
    else if (at !== -1) balls += 1;
  }
  return { strikes, balls };
}

// 입력이 규칙에 맞는지: 자리수 일치, 숫자만, 중복 없음.
export function isValidGuess(guess, digits) {
  if (guess.length !== digits) return false;
  for (const ch of guess) if (!POOL.includes(ch)) return false;
  return new Set(guess).size === guess.length;
}

// 판정 표기: "2S 1B" / "아웃"
export function formatJudge({ strikes, balls }) {
  if (strikes === 0 && balls === 0) return '아웃';
  const parts = [];
  if (strikes > 0) parts.push(`${strikes}S`);
  if (balls > 0) parts.push(`${balls}B`);
  return parts.join(' ');
}
