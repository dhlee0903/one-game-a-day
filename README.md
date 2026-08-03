# 하루에 게임 1개씩 (One Game a Day)

매일 웹 기반 게임을 하나씩 만드는 프로젝트. 프레임워크 없이 바닐라 JS로,
각 게임은 유지보수 가능한 모듈 구조로 작성합니다.

## 게임 목록

| Day | 게임 | 스택 | 패턴 |
| --- | --- | --- | --- |
| 01 | [테트리스](./day01-tetris) | Vanilla JS + Canvas | ES Modules · 관심사 분리(OOP) |
| 02 | [야추 다이스](./day02-yacht-dice) | Vanilla JS | ES Modules · 관심사 분리(OOP) |
| 03 | [스네이크](./day03-snake) | Vanilla JS + Canvas | ES Modules · 관심사 분리(OOP) |
| 04 | [카드](./day04-cards) | Vanilla JS | ES Modules · 관심사 분리(OOP) |
| 05 | [플랫포머](./day05-platformer) | Vanilla JS + Canvas | ES Modules · 관심사 분리(OOP) |
| 06 | [러너 (3라인)](./day06-runner) | Vanilla JS + Canvas | ES Modules · 의사 3D 원근 |
| 07 | [3매치 퍼즐](./day07-match3) | Vanilla JS + Canvas | ES Modules · 관심사 분리(OOP) |

## 공통 규칙

- **의존성 제로**: 런타임 라이브러리 없이 순수 웹 기술만 사용
- **모듈 구조**: 로직/렌더링/입력/상태를 파일 단위로 분리
- **정적 서버로 실행**: ES 모듈은 `file://`에서 동작하지 않으므로 로컬 서버 필요

```bash
# 아무 게임 폴더에서
npx serve .
# 또는
python -m http.server 8000
```
