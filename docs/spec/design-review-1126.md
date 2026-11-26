# 디자인 평가 (2026-11-26, 처음 보는 평가자)

- 범위: 홈·검색·단어 상세·뜻 맞히기(단계·문제·결과 판·한 판 결과·랭킹)·직접 해보기(목록·카메라 안내·연습·카운트다운·기록 중·결과·다른 동작 고르기·기록됨)·문장 만들기(목록·예시 문장·후보·내 문장)·내 기록·정보·출처
- 기기: iPhone 13(390×664), iPhone SE(320×568), 넓은 화면(1280×800), deviceScaleFactor 1, 가짜 카메라(택시 영상)
- 스크린샷: `/tmp/claude-0/-home-user-sueo42/90bd225a-dd34-585d-a3a1-5e1b432f8073/scratchpad/review/` (`iPhone13-*.png`, `iPhoneSE-*.png`, `wide-*.png`, 촬영 스크립트 `review/rv.js`, 위치 측정 `review/m.js`)
- 기준: taste-skill(design-taste-frontend 2.5.1)의 앱에 맞는 규칙(한 시스템·누르는 곳 44px·글자 대비·13px 이상·움직임 절제), WCAG 2.2(1.4.3 글자 대비 4.5:1, 1.4.11 비글자 대비 3:1, 2.4.11 초점 보임), design.md 1~30절의 사장 결정
- 지키는 것: 기능·문구·버튼 구성·흐름 그대로 / 초록 한 테마·로고 그대로 / 직접 해보기·문장 만들기에 점수·%·맞음/틀림·축하 없음, 버튼 3개 같은 모양 / 사전 영상 편집 없이 크기·위치만 / 스크롤 최소
- 참고: 헤드리스 환경이라 단어 상세·넓은 화면 문제의 사전 영상이 검게(불러오는 중) 찍힌 장면이 있음. 영상 내용은 평가하지 않음

## 1. 화면별 점수 (10점)

| 화면 | 점수 | 한 줄 총평 |
|---|---|---|
| 홈 | 7.0 | 목표 고리·직접 해보기·단계 배너 위계는 좋음. 단어 길이 42개 × 139px 로 길이 7,000px, 동그라미 그림이 거의 같아 보여 단조로움 |
| 단어 검색 | 7.5 | 정돈된 목록·초성 검색 좋음. 단계 칩 5~7 이 화면 밖에 숨어 있는데 넘길 수 있다는 표시가 없음 |
| 단어 상세 | 6.5 | 영상이 화면 높이 20%(iPhone 13 133px, SE 65px)로 작고 양옆이 비어 화면의 주인공이 약함. [느리게 보기]가 영상과 떨어져 떠 있음 |
| 뜻 맞히기 단계 목록 | 7.5 | 단계 번호·사전 그림 줄·진행 막대·최고 점수 알약 모두 깔끔 |
| 뜻 맞히기 문제·결과 판 | 8.0 | 앱에서 가장 완성도 높음. 오답 회색 판·근거 상자·한 화면에 들어옴 |
| 한 판 결과·축하 창 | 7.5 | 메달·버튼 위계 좋음. 뒤 화면 버튼 3개가 회색 막에 가려 흐릿하게 비침 |
| 랭킹(빈 상태) | 5.5 | 빈 상자에 글 한 줄뿐, 아래 안내 글이 상자에 붙어 있음(간격 0) |
| 직접 해보기 목록 | 7.0 | 문장 만들기 카드 + 단계 카드 + 단어 그림 격자, 정돈됨. 다 한 단계 줄과 펼친 단계 줄의 높이·모양 차이가 큼 |
| 카메라 안내 | 8.0 | 안내 그림·글·주 버튼 한 화면, 위계 분명 |
| 직접 해보기 연습 | 5.0 | **[동작 시작]이 화면 밖**(iPhone 13·SE 모두). 기록 중 '지금 하세요' 글자를 사전 영상 칸이 가림 |
| 직접 해보기 결과 | 6.5 | 영상 나란히·버튼 3개 같은 모양은 좋음. ① 칩이 뜻 맞히기 '정답' 과 같은 연초록 → 정답처럼 보임 |
| 다른 동작 고르기 창 | 6.0 | 검색 입력칸에 테두리·바탕이 없어 글자처럼 보임 |
| 기록됨 | 7.5 | 담백하고 위계 분명. 토스트가 상태 줄 로고를 반쯤 덮음 |
| 문장 만들기 목록 | 7.0 | 카드 구성 좋음. '내 문장 만들기' 카드 아이콘이 위아래 가운데에서 벗어나 보이고 설명 글 13px 3줄로 빽빽함 |
| 문장 만들기 연습·후보 | 6.5 | 문장 블록 아이디어 좋음. 하트(목숨처럼 보임)·후보 4+1 줄바꿈·SE 에서 블록이 얼굴을 덮음 |
| 내 문장 만들기 | 7.0 | 단순·명료. 빈 칸 '?' 블록 하나만 있어 시작 상태가 약함 |
| 내 기록 | 6.5 | 레벨(파랑)·연속(빨강) 카드 색 뜻이 분명. 배지 2칸 격자라 페이지 2,165px, 못 받은 배지 회색이 너무 흐림 |
| 정보·출처 | 7.5 | 아이콘 줄 목록 깔끔. 제목 '정보·출처'의 가운뎃점이 자간 때문에 거의 안 보임 |
| 넓은 화면(공통) | 5.5 | 내용은 가운데 520px 인데 상태 줄·탭 바는 1280px 끝까지 → 로고·칩·탭이 흩어져 보임 |

전체 인상: 초록 한 테마 + 두꺼운 아래 테두리 입체 부품이 화면마다 일관돼 "한 시스템"은 잘 잡혀 있다. 남은 문제는 대부분 (1) 핵심 화면(직접 해보기 연습)의 배치 버그, (2) 초록 '정답 색'이 AI 결과 화면에도 쓰이는 의미 겹침, (3) 긴 목록 화면의 밀도, (4) 넓은 화면 정렬이다.

## 2. 문제 목록 (효과 큰 순)

### P1 반드시

**1. 직접 해보기 연습: [동작 시작]이 화면 밖 — 고정 막대가 붙지 않음**
- 화면: 직접 해보기 연습(`iPhone13-32-lab-practice.png`, `iPhoneSE-32-lab-practice.png`), 넓은 화면도 29px 넘침
- 근거(측정 `review/m.js`): iPhone 13 화면 높이 664 인데 `.sticky-actions` 위끝 674·버튼 690~742 → 버튼이 통째로 안 보임. SE 는 화면 568, 버튼 615~667. 스크롤 60·77px
- 원인: `css/app.css` 44행 `html, body { overflow-x: hidden; }` — html·body 둘 다 overflow 를 주면 body 가 스크롤 상자가 되어 `.sticky-actions { position: sticky; bottom: 0 }`(597행)가 붙지 않음
- 수정안: 44행을 `html, body { margin: 0; overflow-x: clip; }` 로(가로 넘침은 똑같이 막고 sticky 는 살아남). 바꾼 뒤 연습 화면에서 버튼 아래끝이 `innerHeight` 안에 있는지 다시 잼. 같이 연습 화면 아래 공지 `.lab-practice .info-line`(L-13, 70px) 을 2번 항목처럼 줄이면 스크롤 자체도 0 에 가까워짐

**2. 직접 해보기 결과: ① 칩·순위 글자가 '정답 초록'과 같은 색**
- 화면: `iPhone13-33-lab-result.png` — ① 칩은 연초록 바탕 + 초록 테두리, ② 칩은 흰색. 뜻 맞히기 정답 보기 `.option.is-answer`(265행 `var(--g-100)` + `var(--g-500)`)·정답 판과 같은 조합이라 "①이 맞았다"로 읽힘. 위 글 `.rank-line strong`(373행)도 ①만 초록 굵게
- design.md 2절 "순위 ①②는 같은 모양의 알약 2개", "결과 화면은 판정처럼 보이지 않게"와 어긋남
- 수정안(선택 상태는 남기되 정답 색을 빼기):
  - `.lab-result .rank-switch .chip.on { background: var(--card); color: var(--g-900); border-color: var(--g-900); border-bottom-color: var(--g-900); }` + 선택 표시는 2px 더 진한 테두리만(바탕 흰색 유지). 안 고른 칩은 그대로
  - `.lab-result .rank-line strong { color: inherit; }` (①·② 같은 굵기·같은 색)
  - 같은 이유로 연습 화면 공지 `.lab-practice .info-line` 도 연초록 대신 `background: var(--surface) /* #eef3f0 */; color: var(--text);`

**3. 기록 중 '지금 하세요'·카운트다운 숫자를 사전 영상 칸이 가림**
- 화면: `iPhone13-32c-recording.png` — 가운데 `.cam-cue` 의 "지금 하세…"가 오른쪽 위 떠 있는 사전 영상(`.video-box.pip-float`, z-index 30) 밑으로 잘림
- 수정안(사전 영상은 건드리지 않고 안내 위치만): `.lab-practice .cam-cue { justify-content: flex-end; padding-bottom: 18%; background: linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,0) 60%); }` — 글자와 기록 막대를 카메라 아래쪽 1/3 로 내림. 카운트다운 숫자 `.cam-cue .count` 는 64px 그대로. 사전 영상 칸의 기본 위치는 오른쪽 위라 겹치지 않음

### P2 권장

**4. 상태 줄 불꽃 칩이 앱에서 가장 센 색**
- 화면: 모든 화면 오른쪽 위 — `.chip-stat.streak.lit`(503행 `#d4361a` 채움 + 흰 글자). 주 버튼 초록보다 먼저 눈에 들어와 화면마다 시선을 빼앗음
- 수정안(불=빨강 뜻은 유지, design.md 14절): 채움 대신 연한 바탕 `background: var(--fire-pale) /* #fff0eb */; border-color: var(--fire-line) /* #ffd2c4 */; color: var(--fire-ink) /* #8a1f0b, 대비 약 10:1 */;` 아이콘만 `color: var(--fire)`. 진한 빨강 채움은 내 기록의 연속 카드 아이콘(`.streak-flame`)에만

**5. 넓은 화면: 상태 줄·탭 바가 화면 끝까지 퍼짐**
- 화면: `wide-01-home.png`, `wide-20-records.png` — 로고는 x 16, 칩은 x 1260, 탭 5개가 256px 간격으로 흩어짐. 내용은 가운데 520px
- 수정안: `@media (min-width: 800px) { .status-bar { padding-inline: max(16px, calc((100vw - 520px) / 2 + 16px)); } .tab-bar { left: 50%; right: auto; width: 520px; transform: translateX(-50%); border-radius: 20px 20px 0 0; } }` 연습 화면(최대 980px)일 때는 `body:has(.lab-practice) .status-bar { padding-inline: max(16px, calc((100vw - 980px) / 2 + 16px)); }`

**6. 초점 고리가 흰 바탕에서 안 보임**
- `:focus-visible { outline: 3px solid var(--lime); }`(49행) — 연두 #a6e35a 대 흰색 1.53:1(WCAG 1.4.11·2.4.11 기준 3:1 미달). 키보드·스위치 사용자가 위치를 잃음
- 수정안: `:focus-visible { outline: 3px solid var(--g-900); outline-offset: 2px; box-shadow: 0 0 0 6px rgba(166, 227, 90, .55); }` (진한 초록 고리 + 연두 번짐, 대비 12:1). 어두운 카메라 위 버튼(`.pip-btn`, `.file-chip`)은 `outline-color: #fff`

**7. '다른 동작이었어요' 창: 검색칸이 입력칸처럼 안 보임**
- 화면: `iPhone13-33b-lab-other.png` — `openPicker` 가 `.search-input` 만 넣고 `.search-field` 껍데기가 없어 "단어 검색"이 그냥 회색 글자로 보임. 문장 만들기 [목록에서 고르기]도 같은 창
- 수정안(CSS 만): `.picker > .search-input { height: 48px; margin-top: 10px; padding: 0 14px; border: 2px solid var(--line); border-bottom-width: 4px; border-radius: 14px; background: var(--card); } .picker > .search-input:focus { border-color: var(--g-600); }`

**8. 홈 단어 길이 너무 김(7,000px)**
- 화면: `iPhone13-01-home-full.png` — 동그라미 74px + 이름 + 별 + 간격 14px = 한 단어 약 139px, 42개 × 139 ≈ 5,800px. 사전 그림이 모두 같은 회색 배경·같은 사람이라 계속 같은 그림이 반복되는 느낌
- 수정안(길·순서·문구 그대로, 간격만): `.wp-node { width: 64px; height: 64px; border-width: 3px; box-shadow: 0 5px 0 …; }` `.word-path { gap: 4px; }` `.wp-label { margin-top: 2px; font-size: 14px; }` `.wp-stars svg { width: 12px; height: 12px; }` → 한 단어 약 108px, 홈 길이 약 1,300px 줄어듦. 좌우로 굽이치는 폭(`--x`)은 ±56px 정도로 넓혀 세로 압축을 가로 움직임으로 보충

**9. 내 기록: 배지 2칸 격자 → 페이지 2,165px**
- 화면: `c-rec.png`(내 기록 아래쪽) — 배지 13개가 2칸 7줄, 한 칸 약 165px. 못 받은 배지의 회색 메달·조건 글이 흐려 "무엇을 하면 받는지"가 잘 안 읽힘
- 수정안: 배지 격자를 `grid-template-columns: repeat(3, 1fr); gap: 14px 8px;`, 메달 60→52px, 배지 이름 15px·조건 13px. 못 받은 배지 메달 테두리·아이콘 `var(--line-edge)`(#c9d6cf, 흰 바탕 대비 1.5:1) → `#869690`(3.1:1, WCAG 1.4.11 비글자 3:1 충족), 진행 글 "진행 n/m"은 `color: var(--muted)` 유지. 4줄 + 1개로 약 500px 줄어듦

**10. 문장 만들기: '기회' 표시가 빨간 하트(목숨처럼 보임)**
- 화면: `iPhone13-41-sent-practice.png` — `.chance-pill`(주황빨강 #c2410c + 하트), 적어지면 `.low` 로 빨강 채움. design.md 0절에서 뺀 "하트(목숨)"와 같은 그림이고, 줄어드는 빨간 하트는 '틀려서 벌 받는' 느낌 → 문장 만들기 '판정 없음' 원칙과 부딪힘
- 수정안: 하트 아이콘 대신 기존 카메라/손 아이콘, 색은 `background: rgba(255,255,255,.92); color: var(--g-900);` 그리고 `.chance-pill.low` 도 같은 색에 `border: 2px solid var(--g-900)` 만(빨강 채움 없음). 문구 "기회 n번"은 그대로

**11. 문장 만들기 후보 블록 5개가 4+1로 줄바꿈**
- 화면: `iPhone13-42-sent-cands.png` — `.block-list { display: flex; flex-wrap: wrap }` 라 블록 폭이 글자 길이마다 달라지고 마지막 ⑤만 혼자 아래 줄. 크기가 달라 '더 큰 후보가 더 맞는 것' 처럼 읽힐 수 있음
- 수정안: `.block-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; } .word-block { justify-content: center; min-height: 48px; padding: 0 8px; }` → 3+2, 모든 블록 같은 폭. SE(320)에서도 칸 약 92px 이라 "잃어버리다"(5자, 16px) 들어감

**12. SE 에서 카메라 위 문장 블록이 얼굴을 덮음**
- 화면: `iPhoneSE-41-sent-practice.png`, `iPhoneSE-42-sent-cands.png` — 카메라 폭이 좁아 [지하철] 타러 [가다]가 2~3줄로 쌓여 얼굴·손 자리를 가림
- 수정안: `@media (max-width: 360px) { .slot { height: 28px; padding: 0 8px; font-size: 14px; border-radius: 8px; } .slot-row { gap: 3px; } .slot-row .glue { font-size: 13px; } .sentence-over .chance-pill { height: 26px; padding: 0 8px; } }` 그래도 두 줄이면 `.sentence-slot` 를 `top: auto; bottom: 8px` 로(손이 주로 오는 가운데·위를 비움)

**13. 단어 상세: 영상이 작고 도구가 떨어져 있음**
- 화면: `iPhone13-03-word.png`(영상 133px, 양옆 각 90px 빈칸), `iPhoneSE-03-word.png`(영상 100×65px)
- 수정안(편집 없이 크기만): 단계 칩과 제목 사이 간격·`.detail .fact` 패딩을 줄여 생긴 높이를 영상에: `.detail .video-box { height: 26svh; }`, SE(`max-height: 600px`)는 `20svh`. [느리게 보기]는 영상 아래 오른쪽 대신 영상 바로 아래 가운데(`.detail .video-tools { justify-content: center; margin-top: 6px; }`). 영상이 오기 전 검은 칸은 `.video-box video { background: var(--surface); }` 로 바탕과 같은 연회색
- 참고: 같은 CSS 파일에 `.detail .video-box` 높이가 30→25→22→20svh 로 4번 덮어써 있음(683~705행). 고칠 때 한 줄로 합치기

**14. 연습 화면 아래 안내 글들이 버튼을 밀어냄**
- 화면: `iPhone13-32-lab-practice.png` — 상태 칩, [느리게 보기][수형 설명 보기], 출처 2줄, L-13 공지 상자(70px), "준비되면…" 12px 안내가 차례로 쌓임
- 수정안: L-13 상자를 한 줄 정보 줄로 `.lab-practice .info-line { padding: 8px 12px; font-size: 14px; font-weight: 600; border-radius: 12px; }` (2번의 회색 바탕과 함께). "준비되면 [동작 시작]…"(`.lab-practice > .muted.small`)은 12px → 13px 로 올리되 `.sticky-actions` 안 버튼 바로 위로 옮겨(같은 글, 위치만) 버튼과 한 묶음으로

### P3 있으면 좋음

**15. 12px 이하 글자**
- 탭 이름 `.tab`(12px), 사전 영상 라벨 `.pip-label`(11px), `.file-chip`(12px), 결과 판·연습 화면 출처(12px). design.md 8절 "13px 이상" 결정과 어긋남
- 수정안: `.tab { font-size: 13px; }`(아이콘 칸 32→30px 로 높이 유지), `.pip-label, .file-chip { font-size: 12.5px; }` 는 영상 위 글자라 대신 굵기 800·바탕 불투명도 .85 로 대비 확보, 출처는 13px 유지 가능한 화면(단어 상세·뜻 맞히기 문제)부터 되돌림

**16. 제목 자간이 너무 좁음(가운뎃점이 사라짐)**
- `h1, h2, h3 { letter-spacing: -.03em; }`(52행) — `iPhone13-21-info.png` 의 "정보·출처"가 "정보출처"로 보임
- 수정안: `h1 { letter-spacing: -.02em; }` (Pretendard 큰 제목 권장 범위), h2·h3 는 -.02em → -.01em

**17. 토스트가 상태 줄 로고·칩을 반쯤 덮음**
- 화면: `iPhone13-12-quiz-answer0.png`, `iPhone13-34-lab-saved.png` — 가로 약 200px 알약이 로고 '수어42' 글자와 불꽃 칩 사이에 걸쳐 어중간하게 겹침
- 수정안: 상태 줄을 "덮는다"는 것이 분명하게 `.toast { left: 8px; right: 8px; transform: translateY(-12px); height: calc(var(--status-h) - 8px); justify-content: center; border-radius: 14px; }` (`.toast.show { transform: none; }`) — 위치·나오는 때는 그대로

**18. 검색 단계 칩이 화면 밖으로 숨음**
- 화면: `iPhone13-02-search.png` — `.chips` 가로 스크롤인데 '단계 4' 뒤가 잘린 표시 없이 끊김
- 수정안: `.chips { mask-image: linear-gradient(to right, #000 85%, transparent); padding-right: 24px; }` (끝까지 넘기면 JS 없이도 마지막 칩이 다 보이게 오른쪽 여백)

**19. 랭킹 빈 상태가 허전함**
- 화면: `iPhone13-14-ranking.png` — `.empty-state` 에 그림(`.empty-icon`, 이미 CSS 있음)이 안 나오고, 아래 "랭킹은 이 기기에서만 보여요" 글이 상자에 붙음(간격 0)
- 수정안: 빈 랭킹 상자에도 `.empty-icon`(bubbles.svg) 쓰기, 상자 다음 안내 글 `margin-top: 10px; font-size: 13px;`

**20. '내 문장 만들기' 진입 카드 정렬**
- 화면: `iPhone13-40-sent.png` — 아이콘(44px)이 3줄 설명 기준으로 가운데라 제목보다 아래로 내려가 보이고, 설명 13px 3줄이 빽빽함
- 수정안: `.sentence-entry { align-items: flex-start; } .sentence-entry-icon { margin-top: 2px; } .sentence-entry-text small { font-size: 14px; line-height: 1.45; }` `.sentence-entry-go { align-self: center; }`

## 3. 그대로 두는 것이 좋은 것
- 뜻 맞히기 오답 회색 판·근거 상자·출처 줄 — 강의 원칙과 디자인이 가장 잘 맞음
- 직접 해보기 버튼 3개 같은 크기·같은 흰 버튼(`.choice-row`), SE 에서 '다른 동작이었어요'만 두 줄이지만 칸 크기는 같으므로 그대로 둬도 됨
- 카메라 안내 그림(손 모양 없이 손 자리만)
- 내 기록의 불=빨강·레벨=파랑·배지=금색 뜻 색(직접 해보기 결과 화면에는 없음)

## 4. 제안하지 않은 것(규칙 때문에 뺌)
- 직접 해보기 결과의 ①을 크게·강조하기, 결과 뒤 반짝임 — 판정처럼 보임
- 사전 그림·영상 자르기·밝기 보정으로 홈 동그라미를 다르게 보이게 하기 — 편집 금지
- 테마 색 바꾸기, 그라데이션·점 무늬 되살리기, 특정 앱 화면 따라 그리기 — 사장이 이미 거절
- 문구 바꾸기(축하 창 "배지를 받았어요"가 제목·본문에 두 번 나오는 것 등) — 문구는 copy.md 담당
