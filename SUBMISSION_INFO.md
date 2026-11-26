# TrailMate 제출 안내

- 제출 형식: ZIP 파일 업로드
- 공개 저장소: https://github.com/seungbo7523/-NO.1/tree/feature/additional-changes
- 배포된 앱: https://seungbo7523.github.io/-NO.1/
- 앱 코드 기준 커밋: `1f038cc`

## 포함 내용

전체 화면 소스, JavaScript 모듈, Supabase 스키마와 마이그레이션, 자동 테스트, 로컬 실행 방법, 평가 근거 문서를 포함합니다. `.git` 기록과 업로드 파일은 포함하지 않습니다.

## 검증

```sh
node --test tests/*.test.cjs
```

앱 코드 기준 커밋에서 자동 테스트 11개가 통과했습니다. 테스트는 Node.js VM의 모의 DB/GPS를 사용하며 실제 Supabase 통합 테스트는 아닙니다.

## 범위와 제한

가상 안전 안내도와 추정 고도 단면은 시연용입니다. 실제 공공 안전 데이터, 실제 경로, 크루 실시간 위치 공유, AI·날씨 추천, 자동 119 신고는 연결되어 있지 않습니다. GPS 기록은 명시적 동의가 있어야 시작되며 본인 기록으로만 저장됩니다.
