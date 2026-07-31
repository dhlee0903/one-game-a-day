# Day 05 · 횡스크롤 플랫포머 (Platformer)

바닐라 JS + Canvas로 만든 마리오풍 횡스크롤 액션. 타일 기반 레벨을 달리며 코인을 먹고,
적을 밟아 처치하고, 깃발에 도달하면 클리어.

## 실행

ES 모듈은 `file://`에서 로드되지 않으므로 정적 서버가 필요합니다.

```bash
npx serve .
# 또는
python -m http.server 8000
```

## 구조

```
day05-platformer/
├── index.html          # 캔버스 + HUD + 터치 버튼
├── css/style.css
└── src/
    ├── config.js       # 상수 (타일·물리·색)
    ├── level.js        # 레벨 생성 (타일 그리드 + 코인/적/골)
    ├── physics.js      # AABB 타일 충돌
    ├── player.js       # 플레이어 (이동·점프·가변 점프 높이)
    ├── enemy.js        # 적 (순찰·벽/절벽 반전·밟기)
    ├── game.js         # 루프 · 충돌 · 카메라 · 점수/목숨/상태
    ├── renderer.js     # Canvas 렌더 (카메라 오프셋)
    └── main.js         # DOM 연결 · 입력 · 오버레이
```

단방향 의존: `config ← level/physics ← player/enemy ← game ← main`. 렌더러는 상태를 읽기만 함.

## 조작

| 입력 | 동작 |
| --- | --- |
| ← → / A D | 이동 |
| ↑ / W / Space | 점프 (길게 누르면 더 높이) |
| 적 위로 착지 | 밟아 처치 (+바운스) |
| (모바일) 화면 버튼 | 이동 · 점프 |

## 규칙

- **코인** +50, **적 밟기** +100
- 적에 옆으로 닿거나 **구덩이에 빠지면** 목숨 -1 (기본 3)
- 목숨이 없으면 게임 오버, **깃발** 도달 시 클리어
