# ExcelVoca

[![Pages Build](https://github.com/hayein-bit/excelvoca-web/actions/workflows/pages/pages-build-deployment/badge.svg)](https://github.com/hayein-bit/excelvoca-web/actions)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://hayein-bit.github.io/excelvoca-web/)
[![Stack](https://img.shields.io/badge/stack-vanilla%20JS%20%2B%20Electron-yellow)](#)

겉보기엔 엑셀, 실제로는 TEPS 어휘 퀴즈. `Tab` 한 번이면 화면 전체가 가짜 업무 대시보드(Boss Mode)로 바뀌고, 다시 `Tab`을 누르면 풀던 문제·콤보·통계 그대로 돌아옵니다. (Boss Mode는 데스크톱 앱 전용이며, 웹 버전에는 애초에 위장할 스프레드시트 화면이 없어 해당 기능이 없습니다.)

## 구성

- **데스크톱 앱** (`src/`): Plain Electron + vanilla ES6+ (React/번들러/TypeScript 없음). `contextIsolation`/`sandbox` 켠 표준 Electron 보안 구성.
- **웹 버전** (`web/`): 같은 게임 로직(`src/game`, `src/storage`, `src/data`)을 그대로 재사용하는 경량 브라우저 프론트엔드. 폰이나 Electron을 설치할 수 없는 PC에서 이어서 학습할 때 사용.
- **단어 데이터** (`data/teps_words.csv`): 직접 큐레이션한 TEPS 어휘 목록. 뜻/예문/예문 번역 외에 유명한 연어(collocation) 힌트도 일부 단어에 붙어 있습니다.

## 게임 모드

데스크톱(리본 메뉴)과 웹(상단 모드 전환 버튼) 양쪽에서 동일하게 4가지 모드를 오갈 수 있습니다. 정답/오답/streak 등 학습 기록은 같은 단어 항목이면 모드와 무관하게 공유됩니다.

- 🔤 **클래식**: 단어를 보고 4지선다로 뜻 고르기 (약 30% 확률로 뜻→단어 역방향 출제). 유일하게 이어하기(세션 복원)를 지원하는 모드입니다.
- 📖 **예문**: 영어 예문을 먼저 읽고(스스로 페이스 조절), 준비되면 4지선다로 뜻을 고릅니다.
- ⌨️ **타이핑**: 한국어 뜻을 보고 영어 단어를 직접 입력 (객관식이 아닌 능동 회상 방식).
- 🔗 **매칭**: 영어 목록과 한국어 뜻 목록을 각각 클릭해서 짝짓기.

## 난이도

단어마다 1~5단계 난이도가 매겨져 있고, 직급(랭크)이 낮을수록 쉬운 단어가 압도적으로 많이 나오다가 랭크가 오를수록 점점 어려운 단어 비중이 커집니다.

| 랭크 | 레벨1 | 레벨2 | 레벨3 | 레벨4 | 레벨5 |
| --- | --- | --- | --- | --- | --- |
| Intern | 70% | 18% | 8% | 3% | 1% |
| Junior Analyst | 55% | 25% | 13% | 5% | 2% |
| Analyst | 35% | 30% | 20% | 10% | 5% |
| Senior Analyst | 22% | 28% | 27% | 15% | 8% |
| Manager | 12% | 20% | 30% | 23% | 15% |
| Director | 7% | 14% | 27% | 28% | 24% |
| Executive | 4% | 9% | 20% | 32% | 35% |
| CEO | 2% | 5% | 13% | 30% | 50% |

## 실행

### 데스크톱 (Electron)

```bash
npm install
npm start
```

### 웹 버전

`web/index.html`을 정적 호스팅(GitHub Pages 등)하면 됩니다. 최초 접속 시 진행 상황 동기화용 GitHub Personal Access Token을 한 번 등록하면, 그다음부터는 4자리 PIN만으로 열 수 있습니다 (아래 참고). 화면 안의 "기록 관리" 버튼으로 오늘 통계만 초기화하거나 전체 학습 기록을 리셋할 수도 있습니다.

## 진행 상황 동기화

두 프론트엔드가 동일한 학습 기록을 공유하도록, `progress.json`/`session.json`은 이 저장소가 아니라 **별도의 private 저장소**를 통해 GitHub Contents API로 읽고 씁니다. 이 저장소에는 개인 학습 데이터가 전혀 포함되지 않습니다.

## 라이선스

개인용 프로젝트입니다. 재사용/배포를 염두에 두고 만들지 않았습니다.