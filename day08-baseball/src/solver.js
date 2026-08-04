// 후보 추론: 지금까지의 판정과 모순되지 않는 정답 후보를 좁힌다.
// "남은 후보 수" 표시와 힌트가 이걸 쓴다.

import { POOL } from './config.js';
import { judge } from './rules.js';

// 중복 없는 `digits`자리 순열 전체(3자리 720개, 4자리 5040개).
export function allCandidates(digits) {
  const out = [];
  const pool = POOL.split('');
  const walk = (prefix, rest) => {
    if (prefix.length === digits) { out.push(prefix); return; }
    for (let i = 0; i < rest.length; i += 1) {
      walk(prefix + rest[i], rest.slice(0, i).concat(rest.slice(i + 1)));
    }
  };
  walk('', pool);
  return out;
}

// 이 추측에 대해 같은 판정이 나오는 후보만 남긴다.
export function narrow(candidates, guess, result) {
  return candidates.filter((c) => {
    const j = judge(c, guess);
    return j.strikes === result.strikes && j.balls === result.balls;
  });
}
