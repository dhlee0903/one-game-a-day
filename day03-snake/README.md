# Day 03 · 스네이크 (Snake)

바닐라 JS + Canvas로 만든 클래식 스네이크. 먹이를 먹어 몸을 늘리고, 벽·자기 몸에
부딪히면 끝. 먹을수록 빨라진다.

## 실행

ES 모듈은 `file://`에서 로드되지 않으므로 정적 서버가 필요합니다.

```bash
npx serve .
# 또는
python -m http.server 8000
```

## 구조

```
day03-snake/
├── index.html          # 캔버스 + HUD, 모듈 진입점
├── css/style.css
└── src/
    ├── config.js       # 상수 (그리드·속도·색·방향)
    ├── snake.js        # 스네이크 모델 (몸·방향·이동·성장)
    ├── game.js         # 틱 루프 · 먹이 · 충돌 · 점수 · 상태 머신
    ├── renderer.js     # Canvas 렌더링
    ├── input.js        # 키보드/WASD/스와이프 입력
    ├── storage.js      # 최고 점수 (localStorage)
    └── main.js         # DOM 연결 · 오버레이 · 점수 UI
```

단방향 의존: `config ← snake ← game ← main`, 렌더러는 상태를 읽기만 함.

## 조작

| 키 | 동작 |
| --- | --- |
| ← ↑ → ↓ / WASD | 방향 전환 |
| P | 일시정지 |
| Space / Enter | 시작 · 일시정지 · 재시작 |
| (모바일) 스와이프 | 방향 전환 |

## 기능

- 먹이 먹으면 몸 성장 + 점수 + **속도 증가**(최소 틱까지)
- 벽/자기 몸 충돌 시 게임오버, 180° 역주행 방지
- **최고 점수** localStorage 저장, 신기록 표시
- 일시정지, 키보드 + 모바일 스와이프
