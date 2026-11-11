# vendor/ 파일 출처 (2026-11-09 받음)

결선장 인터넷이 불안정해도 직접 해보기가 돌도록 라이브러리를 저장소 안에 둔다(결재 2026-11-09 구조 7·8).
파일은 받은 그대로이며 고치지 않았다. 버전은 고정한다(latest 금지).

| 파일 (vendor/…) | 원본 주소 | 크기(바이트) | sha256 |
|---|---|---|---|
| mediapipe/tasks-vision@0.10.14/vision_bundle.mjs | https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs | 136,870 | e77f281f9619150d937023c355bae170e9120e3b9e43f1e23a2a7bee07197669 |
| mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_internal.js | https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_internal.js | 209,826 | 9440cf0cc0cea21800e31581ec32aeedcc5fbf9df4509796bbc7d3f99e52ab9c |
| mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_internal.wasm | https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_internal.wasm | 9,423,986 | f82a8e6c05e08a44cc9f9e7ec5f845935bcbb1b1500ebe8c2f4812fb4e2917dc |
| mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_nosimd_internal.js | https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_nosimd_internal.js | 209,735 | abe9b6fbeaf86fcb53a5edce3926c82ccb0619e18fed4d9d9ce561ee7f55e054 |
| mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_nosimd_internal.wasm | https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_nosimd_internal.wasm | 9,294,247 | 38b61feab2fd7934e05cbe9f68baa308978a5e3b7f85c1913bb8ae89b8ef8b97 |
| mediapipe/hand_landmarker/float16-1/hand_landmarker.task | https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task | 7,819,105 | fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1 |
| tfjs@4.22.0/tf.min.js | https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js | 1,469,843 | 300dfae273d20b4046f46a06d735688f03675a807561e9bcb5f664eb2f3d2831 |
| LICENSE-mediapipe.txt | https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE | 12,331 | 8707eef0533987efc5b155d64761eeb6e20793f50b9bd1a68dad1cf4719d0ed8 |
| LICENSE-tfjs.txt | https://raw.githubusercontent.com/tensorflow/tfjs/master/LICENSE | 11,358 | cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30 |

## 라이선스
- @mediapipe/tasks-vision 0.10.14: Apache-2.0 (패키지 package.json `"license": "Apache-2.0"`, 원문 LICENSE-mediapipe.txt)
- @tensorflow/tfjs 4.22.0: Apache-2.0 (패키지 package.json `"license": "Apache-2.0"`, 원문 LICENSE-tfjs.txt)
- npm 패키지 안에는 LICENSE 파일이 없어 원 저장소(github.com/google-ai-edge/mediapipe, github.com/tensorflow/tfjs) 의 LICENSE 를 받아 두었다.
- hand_landmarker.task 모델 파일의 라이선스: **확인 못 함**(공식 페이지의 모델 카드에서 확인 필요).
- 크기 7개는 docs/tech/structure.md 2절(2026-11-05 확인 값)과 모두 같다.
