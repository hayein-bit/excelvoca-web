# ExcelVoca

겉보기엔 엑셀, 실제로는 TEPS 어휘 퀴즈. `Tab` 한 번이면 화면 전체가 가짜 업무 대시보드(Boss Mode)로 바뀌고, 다시 `Tab`을 누르면 풀던 문제·콤보·통계 그대로 돌아옵니다.

## 구성

- **데스크톱 앱** (`src/`) — Plain Electron + vanilla ES6+ (React/번들러/TypeScript 없음). `contextIsolation`/`sandbox` 켠 표준 Electron 보안 구성.
- **웹 버전** (`web/`) — 같은 게임 로직(`src/game`, `src/storage`, `src/data`)을 그대로 재사용하는 경량 브라우저 프론트엔드. 폰이나 Electron을 설치할 수 없는 PC에서 이어서 학습할 때 사용.
- **단어 데이터** (`data/teps_words.csv`) — 직접 큐레이션한 TEPS 어휘 목록.

## 실행

### 데스크톱 (Electron)

```bash
npm install
npm start
```

### 웹 버전

`web/index.html`을 정적 호스팅(GitHub Pages 등)하면 됩니다. 최초 접속 시 진행 상황 동기화용 GitHub Personal Access Token을 한 번 등록해야 합니다 (아래 참고).

## 진행 상황 동기화

두 프론트엔드가 동일한 학습 기록을 공유하도록, `progress.json`/`session.json`은 이 저장소가 아니라 **별도의 private 저장소**를 통해 GitHub Contents API로 읽고 씁니다. 이 저장소에는 개인 학습 데이터가 전혀 포함되지 않습니다.

## 라이선스

개인용 프로젝트입니다. 재사용/배포를 염두에 두고 만들지 않았습니다.
