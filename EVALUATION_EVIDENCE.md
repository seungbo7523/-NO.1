# TrailMate 평가 근거 자료

## 제출 기준

- 기준 버전: `v.10` (`cdb0e7d`) 이후 피드백 반영본
- 확인 브랜치: `feature/additional-changes`
- 검증 명령: `node --test tests/*.test.cjs`
- 피드백 반영 후 테스트 결과: `node --test tests/*.test.cjs` 기준 11개 통과, 0개 실패.

기존 평가에서 `index.html` 일부만 제공되어 핵심 동작을 확인하기 어렵다고 지적했습니다. 피드백 반영으로 화면 마크업(`index.html`), 코스 데이터(`js/courses.js`), 추천 필터(`js/recommendations.js`), 안전 화면 로직(`js/safety.js`), 앱 상태·인증·채팅·GPS(`js/app.js`), 데이터 정책(`supabase/`), 테스트(`tests/`), 실행·설정 안내(`README.md`)를 구분했습니다.

## 기능별 코드 근거

| 검토 항목 | 구현 근거 | 범위와 제한 |
| --- | --- | --- |
| 코스 선택·필터·상세 | `js/courses.js:2-74`의 정적 코스 데이터, `js/app.js:90-167`의 난이도 필터·목록·선택·상세 갱신 | 코스 추천은 정적 데이터와 난이도 필터입니다. AI·날씨 기반 추천은 구현되어 있지 않습니다. |
| 코스→크루방 흐름 | `js/app.js`의 코스 선택, 방 입장 동의, 로그인 분기, 단계 전환 | Supabase 미설정 시 입장이 차단되고 안내가 표시됩니다. GPS 시작은 방 입장과 분리되어 있습니다. |
| 추천·안전 모듈 | `js/recommendations.js`, `js/safety.js` | 난이도 필터와 안전 화면 로직은 모듈로 분리했습니다. 코스 추천은 정적 데이터이며 AI·날씨 기반 추천은 아닙니다. |
| 코스별 메시지와 빠른 상태 공유 | `js/app.js`의 메시지 검증, `course_room_messages` 저장, 상태 칩 | 로그인 사용자와 입장 중인 코스가 있어야 전송할 수 있고, 1,000자 초과 및 DB 오류를 사용자에게 알립니다. Clerk/Supabase 설정이 필요합니다. |
| GPS 기록·동의 해제 | `js/app.js`의 동의 확인, 기록 복구·이력 조회·위치 요청·시작·종료 | 채팅방 입장만으로 GPS를 요청하지 않습니다. 별도 동의가 있어야 기록을 시작하고, 동의 해제 시 watch를 중단하고 종료 좌표 없이 종료할 수 있습니다. 기존 DB에는 `supabase/tracking-location-consent.sql` 적용이 필요합니다. 위치는 크루와 공유되지 않습니다. |
| 안전 화면과 비상 안내 | `index.html`의 가상 도식·119 안내, `js/safety.js`의 추정 단면·고도 시뮬레이터 | 안전 표식은 시연용이며 공공 데이터·실제 지도와 연결되지 않습니다. 119 링크는 사용자가 직접 전화를 시작하며 자동 신고나 현재 위치 전송은 하지 않습니다. |

## 데이터베이스·접근 제어 근거

- `supabase/schema.sql:1-22`: 코스 ID, 사용자 ID, 닉네임 및 메시지 길이 제약, 인덱스, RLS 활성화.
- `supabase/schema.sql:24-63`: 본인 멤버십만 읽기/탈퇴할 수 있고, 방 멤버만 메시지를 읽고 본인 ID로 전송하도록 하는 정책.
- `supabase/clerk-migration.sql:1-49`: Clerk의 문자열 사용자 ID와 JWT `sub` 기준으로 기존 정책을 마이그레이션합니다. README에 기재된 순서대로 기본 스키마 다음에 적용해야 합니다.
- `supabase/tracking.sql`: 좌표 범위, 시작·종료 조건, 사용자당 활성 세션 하나를 제한합니다. 종료 동의 철회 시 좌표 없이 종료할 수 있으며, 기존 DB에는 `supabase/tracking-location-consent.sql`을 적용해야 합니다.
- `supabase/tracking.sql:35-52` 및 `supabase/tracking-altitude.sql:19-23`: JWT 사용자 ID가 본인인 세션만 읽고 시작·종료·고도 갱신하도록 RLS/권한을 제한합니다.

**남은 보안 개선점:** 채팅 전송 정책은 `user_id`와 방 멤버십을 JWT에 바인딩하지만, `display_name`이 JWT의 사용자 표시 이름과 일치하는지는 DB 정책에서 검증하지 않습니다. 사용자 프로필 이름을 신뢰할 수 있는 서버 측 값으로 관리하거나, 정책/DB 함수에서 claim과 대조하는 보완이 필요합니다.

## 구조 개선 범위

- `index.html`은 화면 마크업을, `js/courses.js`는 코스 목록을, `js/app.js`는 상태·화면 동작·Supabase/Clerk 호출을 담당합니다.
- 앱 로직 안의 화면 상태와 Supabase 서비스는 아직 `js/app.js`에 함께 있습니다. 기능별 서비스 모듈 분리는 후속 개선 항목입니다.

## 테스트·실행 방법

현재 Node 내장 테스트 러너로 실행합니다.

```sh
node --test tests/*.test.cjs
```

- `tests/safety.test.cjs`: 안전 안내·가상 표식, 119 전화 링크, 각 코스별 단면/표식 배치 검증.
- `tests/flows.test.cjs`: 난이도 필터, 크루방 화면 접근 조건, 채팅 저장 오류 표시 및 메시지 길이 제한 검증.
- `tests/tracking.test.cjs`: 별도 동의 전 위치 요청 없음, 산행 시작·최고 고도 저장·종료, 동의 철회 후 위치 없는 종료, 기존 활성 세션 복구, GPS 권한 거부·시간 초과 후 재시도 검증.
- 이 테스트는 브라우저 자동화나 실제 Supabase 인스턴스를 사용하는 통합 테스트는 아닙니다. Supabase/Clerk 설정 및 배포 환경에서의 수동 시연은 별도로 필요합니다.
- GPS 동의 해제 마이그레이션은 `supabase/tracking-location-consent.sql`이며, 기존 Supabase 데이터베이스에 직접 적용해야 합니다. GitHub Pages 배포가 DB 스키마를 자동 변경하지는 않습니다.

정적 화면은 저장소 루트에서 `python3 -m http.server 8000`을 실행하고 `http://localhost:8000/`으로 확인할 수 있습니다. 로그인·채팅·영구 GPS 기록은 README의 Clerk/Supabase 설정과 SQL 마이그레이션이 적용되어야 동작합니다.

## 알려진 제품 범위

- 현재 코스 데이터와 추천 목록은 `js/courses.js`에 있는 시연용 정적 데이터입니다.
- 안전 안내도의 경로·현재 위치·크루·휴게시설·사고 구간은 모두 가상입니다. 공개 안전 데이터, 실제 지도 경로, 크루 위치 실시간 공유, 자동 119 신고는 연결되어 있지 않습니다.
- 산행 기록은 사용자가 고른 코스와 실제 GPS 경로가 일치하는지 검증하지 않으며, 전체 이동 경로를 저장하지 않습니다.
- `README.md:25-48`에는 Clerk/Supabase 설정, 마이그레이션 순서, GPS 기록의 전제와 제한을 기록했습니다.
