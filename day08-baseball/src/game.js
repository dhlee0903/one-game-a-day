// 게임 진행: 정답 보관, 입력 버퍼, 판정 누적, 승패 판정, 힌트, 후보 추적.
// DOM을 모른다(렌더러가 이 상태를 읽어서 그린다).

import { DIGITS, MAX_TRIES, HINTS_PER_GAME } from './config.js';
import { makeSecret, judge, isValidGuess } from './rules.js';
import { allCandidates, narrow } from './solver.js';
import { recordGame, getBest } from './storage.js';

export class Game {
  constructor({ onChange, onEnd, onFeedback } = {}) {
    this.onChange = onChange || (() => {});
    this.onEnd = onEnd || (() => {});
    this.onFeedback = onFeedback || (() => {}); // 'bad' | 'strike' | 'out'
    this.newGame();
  }

  newGame() {
    this.digits = DIGITS;
    this.maxTries = MAX_TRIES;
    this.secret = makeSecret(this.digits);
    this.input = '';
    this.guesses = [];
    this.hints = [];            // [{ index, digit }] 공개된 자리
    this.hintsLeft = HINTS_PER_GAME;
    this.usedHint = false;
    this.candidates = allCandidates(this.digits);
    this.phase = 'playing';
    this.message = '';
    this.recorded = null;       // { best, isNewBest } 판이 끝나면 채워진다
    this.onChange(this);
  }

  get triesLeft() { return this.maxTries - this.guesses.length; }

  get best() { return getBest(this.digits); }

  // ---- 입력 ----

  pressDigit(ch) {
    if (this.phase !== 'playing') return;
    if (this.input.length >= this.digits) return;
    this.input += ch; // 중복 숫자도 허용 — 0011 같은 탐색 수를 쓸 수 있다
    this.message = '';
    this.onChange(this);
  }

  backspace() {
    if (this.phase !== 'playing' || !this.input) return;
    this.input = this.input.slice(0, -1);
    this.message = '';
    this.onChange(this);
  }

  clearInput() {
    if (this.phase !== 'playing' || !this.input) return;
    this.input = '';
    this.message = '';
    this.onChange(this);
  }

  _warn(text) {
    this.message = text;
    this.onFeedback('bad');
    this.onChange(this);
  }

  // ---- 제출 ----

  submit() {
    if (this.phase !== 'playing') return;
    const guess = this.input;
    if (!isValidGuess(guess, this.digits)) { this._warn(`숫자 ${this.digits}개를 입력`); return; }
    if (this.guesses.some((g) => g.guess === guess)) { this._warn('이미 시도한 숫자'); return; }

    const result = judge(this.secret, guess);
    this.guesses.push({ guess, ...result });
    this.candidates = narrow(this.candidates, guess, result);
    this.input = '';
    this.message = '';

    if (result.strikes === this.digits) this._finish(true);
    else if (this.triesLeft <= 0) this._finish(false);
    else this.onFeedback(result.strikes > 0 || result.balls > 0 ? 'strike' : 'out');

    this.onChange(this);
  }

  _finish(won) {
    this.phase = won ? 'won' : 'lost';
    this.recorded = recordGame({
      digits: this.digits,
      won,
      tries: this.guesses.length,
      usedHint: this.usedHint,
    });
    this.onEnd(this.phase, {
      digits: this.digits,
      secret: this.secret,
      tries: this.guesses.length,
      usedHint: this.usedHint,
      ...this.recorded,
    });
  }

  // ---- 힌트 ----

  // 아직 공개되지 않은 자리 하나의 숫자를 알려준다. 쓰면 그 판은 기록 제외.
  useHint() {
    if (this.phase !== 'playing' || this.hintsLeft <= 0) return;
    const taken = new Set(this.hints.map((h) => h.index));
    const open = [];
    for (let i = 0; i < this.digits; i += 1) if (!taken.has(i)) open.push(i);
    if (!open.length) return;
    const index = open[Math.floor(Math.random() * open.length)];
    this.hints.push({ index, digit: this.secret[index] });
    this.hintsLeft -= 1;
    this.usedHint = true;
    this.message = `${index + 1}번째 자리는 ${this.secret[index]}`;
    this.onChange(this);
  }
}
