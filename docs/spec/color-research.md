# 색 조합 근거 (논문) — 2026-11-18

> 사장 지시: "색조합에 관해 논문 찾아보고 해". 아래 논문 결과로 앱 색을 정했다. 논문 원문을 직접 읽은 것만 적었고, 못 읽은 것은 "확인 못 함"으로 적었다.

## 1. 읽은 논문과 우리 앱에 쓰는 결과

| 논문 | 무엇을 했나 | 우리가 쓰는 결과 (원문) |
|---|---|---|
| **O'Donovan, Agarwala, Hertzmann (2011)** "Color Compatibility From Large Datasets", ACM TOG (SIGGRAPH) | Adobe Kuler 22,376명이 매긴 평점 327,381개 등 대규모 5색 조합 분석 | ① "users generally prefer themes which are neither too simple (i.e., monochromatic), nor too complex (more than 2-3 different hues)" → **한 화면 색상은 2~3가지** ② "dark themes are poorly rated" → **밝은 바탕** ③ "a preference for warm hues and cyans in color themes", "orange often pairs with cyan" → **따뜻한 색 + 청록** ④ 보색·삼각 같은 hue 템플릿은 "no evidence is found that they predict compatible colors" → 템플릿으로 고르지 않음 |
| **Schloss & Palmer (2011)** "Aesthetic response to color combinations: preference, harmony, and similarity", Attention, Perception & Psychophysics 73:551–571 | 48명, 전경/배경 2색 쌍의 선호·조화·유사도 | ① "pair preferences decrease monotonically as a function of the difference in hue between figure and ground" — 전경·배경이 **같은 색상, 다른 밝기**일 때 가장 선호·조화 ② "more preferred pairs contained cooler colors that were similar in hue and contrasting in Munsell value (lightness)" → **글자와 카드 바탕은 같은 색상, 밝기 차이 크게** ③ "saturated red produces particularly disharmonious and disliked combinations" → **진한 빨강 안 씀** ④ 보색 쌍은 선호·조화가 오르지 않음 |
| **Ou & Luo (2006)** "A colour harmony model for two-colour combinations", Color Res. Appl. 31:191–204 (2차 출처로 확인) | 1,431개 2색 쌍 | 색상이 비슷하고, 밝기 차가 중간이며, 밝기 합이 높고, **채도 차가 작을수록** 조화 (Gao 학위논문 PolyU 문헌 검토, Schloss & Palmer 2011 Exp 2 서론). 모델 식(tanh 항)은 원문을 못 읽어 **확인 못 함** — 식은 쓰지 않음 |
| **Ou et al. (2004)** (Gao 학위논문 인용) | 영국인·중국인 비교 | "hue was found to be the most predominant attribute for British, whereas lightness was the most predominant for Chinese" — 동아시아 관찰자는 **밝은 조합**을 더 편안해함("high lightness principle"). 한국인 대상 연구는 **확인 못 함** |
| **Brom, Stárková, D'Mello (2018)** 메타분석, Educational Research Review | 학습 자료의 보기 좋은 색·얼굴(감성 디자인), 33개 표본 2,924명 | 기억 d=0.39, 이해 d=0.32 향상(2차 출처 수치). 색만 따로 본 Wong & Adesope(2021)는 기억·내적 동기에만 효과 → **학습 화면에 색을 쓰는 근거, 대신 과장하지 않음** |
| Palmer & Schloss (2010) PNAS "An ecological valence theory of human color preference" | 색 선호의 이유 | 사람들은 좋아하는 사물의 색을 좋아함(맑은 하늘·물의 파랑은 좋아하고, 썩은 음식의 갈색은 싫어함) → **파랑을 주색으로 유지** |

## 2. 그래서 바꾼 것 (11/18 6차)
- **색상 7개 이상 → 3개**: 파랑(Butter 강조 #225bff + 연파랑 #dbe1ff), 청록 #a9eff0, 주황 #ffdcb6. 분홍·보라·노랑 분류색·청록(teal) 은 뺌 (O'Donovan ①③)
- 단계 1~7 은 이 세 색을 차례로(1 파랑 · 2 주황 · 3 청록 · 4 파랑 …), 옆 단계끼리는 다른 색
- 카드 글자는 **같은 색상의 진한 색**(파랑 카드 #203a6c, 주황 카드 #622e00, 청록 카드 #004649) — Schloss & Palmer ①②, 대비 8:1 이상
- 세 바탕색의 채도 16~24 로 비슷하게(Ou & Luo 채도 차 작게). 채도 50~55 로 튀던 노랑 카드는 뺌
- 바탕: (11/18 7차) 크림 #fdfbe4(노란 기, C* 11.7) → **#f6f8fb**(L* 97.5, C* 1.7, 살짝 차가운 흰색). 근거: Schloss & Palmer 2011 Exp 4 "figural colors were more preferred on cooler backgrounds"(따뜻한 전경이 차가운 배경에서 특히 선호), 밝은 바탕(O'Donovan ②, Ou et al. 2004). 글자 #171b24 대비 16.2, 흐린 글자 #586070 대비 5.94
- 직접 해보기 결과 화면은 그대로 파랑 하나 + 회색(판정처럼 보이지 않게)

## 3. 잰 값 (scratchpad colorcheck.py, sRGB→CIELAB D65, WCAG 2 대비)
| 쌍 | 대비 | 배경 L* | 글자 L* | ΔL* | 배경 h° | 글자 h° | 배경 C* |
|---|---|---|---|---|---|---|---|
| 크림 바탕 / 글자 #1d1c11 | 16.39 | 98.2 | 10.0 | 88.2 | 106 | 104 | 11.7 |
| 파랑 카드 #dbe1ff / #203a6c | 8.62 | 89.9 | 25.0 | 64.9 | 284 | 284 | 15.7 |
| 주황 카드 #ffdcb6 / #622e00 | 8.46 | 89.8 | 25.4 | 64.4 | 74 | 60 | 24.1 |
| 청록 카드 #a9eff0 / #004649 | 8.26 | 90.1 | 26.3 | 63.7 | 199 | 202 | 22.6 |
| 파랑 버튼 #225bff / 흰 글자 | 5.24 | 45.7 | 100 | 54.3 | 297 | — | 95.9 |
(뺀 것: 노랑 #f0df72 C* 55.4, 버터 노랑 #fdee8c C* 49.7, 분홍 h 328, 보라 h 315)

## 4. 한계
- 논문 자극은 회색 바탕 위 2색 도형·5색 견본이라 앱 화면에 그대로 옮겨지지 않음. 한국인 대상 색 조화 연구는 찾지 못함
- Ou & Luo 모델 식, O'Donovan 의 세부 회귀 계수는 확인 못 함(쓰지 않음)

## 출처
- https://www.dgp.toronto.edu/~donovan/color/colorcomp.pdf (원문 PDF에서 글자 추출해 읽음)
- https://pmc.ncbi.nlm.nih.gov/articles/PMC3037488 (Schloss & Palmer 2011 원문)
- https://theses.lib.polyu.edu.hk/bitstream/200/3321/1/b21458911.pdf (Gao 학위논문, Ou & Luo·Ou et al. 인용 부분)
- https://pmc.ncbi.nlm.nih.gov/articles/PMC2889342 (Palmer & Schloss 2010)
- https://artemis.ms.mff.cuni.cz/main/papers/emodesign_manuscript_1rev_180928_FINAL_norev.pdf (Brom et al. 2018 원고), https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1393113/full (수치 인용)

- (11/18 8차) 바탕은 사장 선택으로 **순백 #ffffff**. 흰 카드는 1px 선(#e2e6ed)으로 구분, 연한 면 #f2f4f6.
