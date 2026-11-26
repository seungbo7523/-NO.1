# TrailMate 경남 기술 설계서 (TRD)

> **문서 목적**: PRD에 정의된 문제와 사용자 흐름을 실제 해커톤 MVP로 구현하기 위한 기술 구조, 데이터 흐름, 보안 경계, 검증 기준을 정의한다.
> **문서 상태**: 심사 제출용 설계안. 구현 완료 여부는 아래 상태 표를 따르며, 설계 내용을 구현 사실로 간주하지 않는다.
> **기준 문서**: [PRD 및 요구사항 (이슈 #3)](https://github.com/seungbo7523/-NO.1/issues/3) · [프로토타입 (이슈 #2)](https://github.com/seungbo7523/-NO.1/issues/2)

## 1. 한눈에 보는 설계

TrailMate는 경남 2030 청년이 **코스 발견 → 크루 소통 → 현장 안전 확인**을 한 흐름으로 경험하는 모바일 우선 웹 서비스다. MVP는 관리 부담이 적은 정적 웹 프론트엔드와 관리형 인증·데이터·실시간 서비스를 사용한다. 추천은 검증된 코스 후보 안에서만 개인 조건에 맞게 순위를 매기며, AI는 안전 사실이나 코스를 만들어내지 않고 추천 이유를 설명한다.

| 구분 | 결정 |
| --- | --- |
| 주요 사용자 | 산행을 처음 시작하거나 코스 선택·동행·안전 부담 때문에 망설이는 경남 2030 청년 |
| 핵심 흐름 | 조건 입력 → 코스 추천·상세 → 코스 크루방 → 안전 정보·긴급 안내 |
| MVP 클라이언트 | 모바일 우선 정적 웹 (현재 `index.html`, JavaScript, Tailwind CSS) |
| 계정·실시간 채팅 | Clerk 인증 + Supabase PostgreSQL·Realtime·Row Level Security (RLS) |
| 추천 | 검증된 후보에 대한 결정론적 순위화 + 선택적 AI 설명, 실패 시 동일 후보의 규칙 기반 추천 |
| 안전 데이터 | 출처·확인일을 기록한 검수된 큐레이션 데이터. 확인하지 않은 위치·위험 정보는 사실처럼 표시하지 않음 |
| 배포 | GitHub Actions → GitHub Pages HTTPS |
| MVP에서 제공하지 않는 것 | 실제 구조 요청 전송, 검증되지 않은 실시간 사고 예측, 동의 없는 위치 공유, 검증되지 않은 AI 생성 코스 |

### 현재 구현과 설계 목표

| 기능 | 저장소에서 확인되는 상태 | 심사·시연 시 표현 |
| --- | --- | --- |
| 4단계 화면과 경남 코스 카드 | `index.html`에 시연용 코스와 화면 구현 | 코스 탐색 프로토타입 |
| 로그인 및 코스별 채팅 | Clerk·Supabase 클라이언트 코드와 SQL 스키마 존재 | 설정된 환경에서 동작 확인 후 실시간 채팅으로 소개 |
| 코스별 참여자 접근 제어 | Supabase RLS 정책 존재 | 서로 다른 계정·방으로 허용/차단 테스트 필요 |
| AI 추천 API | 아직 구현되지 않음 | 아래의 목표 설계. 실제 연동 전에는 AI가 동작한다고 설명하지 않음 |
| 실제 지도·GPS 위치 공유 | 현재 화면 요소는 시뮬레이션이며 위치 좌표 실시간 전송은 없음 | 시연용 화면이라고 표시 |
| 안전 시설·사고 데이터 연동 | 검증된 운영 데이터 연동 확인되지 않음 | 데이터 출처와 기준일 검증 전에는 샘플/시뮬레이션으로 표시 |
| GitHub Pages 배포 | 배포 워크플로 존재 | 심사 기기에서 공개 HTTPS 주소·로그인·채팅을 최종 확인 |

## 2. 시스템 아키텍처

```mermaid
flowchart LR
    U["등산객<br/>모바일·PC 브라우저"]
    GH["GitHub Actions<br/>정적 웹 배포"]
    WEB["GitHub Pages<br/>HTTPS · HTML/CSS/JS"]
    CLERK["Clerk<br/>회원 인증·세션"]
    SB["Supabase API"]
    DB[("PostgreSQL<br/>참여자 · 메시지")]
    RT["Supabase Realtime<br/>코스별 메시지 이벤트"]
    DATA["검수된 코스·안전 시드<br/>출처 · 확인일 포함"]
    EDGE["Supabase Edge Function<br/>추천 요청 검증·중계"]
    RANK["추천 엔진<br/>필터·점수화·결과 검증"]
    AI["LLM 제공자 (선택)<br/>추천 이유 문장화"]
    MAP["지도 SDK (선택)<br/>검증된 좌표만 표시"]

    GH --> WEB
    U --> WEB
    WEB <-->|"로그인·JWT"| CLERK
    WEB -->|"JWT + 공개 키"| SB
    SB --> DB
    DB --> RT
    RT -->|"방 구독자에게 전달"| WEB
    WEB --> DATA
    WEB -->|"조건 입력"| EDGE
    EDGE --> RANK
    RANK --> DATA
    RANK -.->|"키는 서버 보관 · 실패 가능"| AI
    RANK -->|"정형 결과 + 검증된 코스 ID"| EDGE
    EDGE --> WEB
    WEB -.->|"좌표 데이터가 검증된 경우만"| MAP
```

### 신뢰 경계와 연결 규칙

1. 브라우저는 공개 웹 자산만 내려받는다. Clerk publishable key와 Supabase publishable/anon key는 공개 클라이언트 키이며, **Supabase service-role key나 LLM 비밀 키는 브라우저·Git 저장소에 넣지 않는다.**
2. Clerk 로그인 세션에서 발급한 JWT를 Supabase 요청에 전달한다. Supabase의 RLS가 요청 사용자와 방 참여 관계를 확인하며, 프론트엔드에서 숨긴 버튼만으로 접근을 통제하지 않는다.
3. AI 추천은 브라우저에서 모델 제공자를 직접 호출하지 않는다. 실제 모델을 연동할 경우 Edge Function이 입력을 검증하고 서버 측 비밀 키로 요청한다. 함수·모델 장애 시 결정론적 추천으로 전환한다.
4. 위치는 MVP에서 서버에 전송하지 않는다. 추후 기능을 추가할 때만 별도의 명시적 동의, 권한 확인, 저장 기간과 철회 처리를 포함한다.
5. 지도나 안전 시설 좌표가 검증되지 않으면 실제 위치 마커로 표현하지 않는다. 지도 SDK의 시각적 시연과 실제 위치 기반 안내를 구분한다.

### 2.1 Clerk 로그인부터 Supabase RLS 응답까지

```mermaid
sequenceDiagram
    actor U as 사용자
    participant B as 브라우저
    participant C as Clerk
    participant S as Supabase API
    participant DB as PostgreSQL RLS

    U->>B: 아이디·비밀번호 제출
    B->>C: Clerk sign-in API
    C-->>B: 활성 세션
    B->>C: session.getToken()
    C-->>B: 서명된 JWT (sub = Clerk 사용자 ID)
    B->>S: 요청 + Authorization Bearer JWT + 공개 키
    S->>S: 설정된 Clerk issuer/JWKS로 JWT 서명·issuer·만료 검증
    S->>DB: 인증 역할로 SQL 실행
    DB->>DB: auth.jwt()->>'sub'와 방 멤버십 RLS 검사
    DB-->>S: 허용된 행만 반환 또는 정책 거부
    S-->>B: JSON 응답 또는 HTTP 오류
    B-->>U: 데이터 표시 또는 재로그인/재시도 안내
```

| 순서 | 책임 | 확인 항목 |
| --- | --- | --- |
| 1. 로그인 | Clerk | username/password 로그인 성공 후 활성 세션이 생긴다. 비밀번호·세션 토큰을 앱 로그에 기록하지 않는다. |
| 2. 토큰 발급 | 브라우저의 Clerk SDK | 매 API 요청에서 `session.getToken()`으로 유효 토큰을 얻는다. 세션 만료·로그아웃 후 이전 토큰을 재사용하지 않는다. |
| 3. 전송 | Supabase JS SDK | 요청의 Authorization 헤더에 Clerk JWT를 전달하고 공개 anon/publishable key는 `apikey` 헤더로 보낸다. |
| 4. JWT 검증 | Supabase Auth 설정 | Clerk 연동의 issuer 및 공개 서명키(JWKS) 설정을 확인한다. 서명, issuer, 만료 검증에 실패한 토큰은 거부한다. 정책 적용 대상인 `authenticated` role claim도 함께 확인한다. |
| 5. 행 권한 | PostgreSQL RLS | `auth.jwt()->>'sub'`가 `user_id`와 같은지, 요청 코스의 참여자인지 각 쿼리에서 검사한다. |
| 6. 응답 | Supabase API/Realtime | 현재 사용자의 정책으로 허용된 행만 반환한다. RLS는 REST 조회·쓰기뿐 아니라 Realtime 변경 이벤트에도 적용한다. |

### 2.2 환경별 설정 체크리스트

| 단계 | 개발/미리보기 환경 | 제출/운영 환경 |
| --- | --- | --- |
| Clerk 애플리케이션 | 전용 Development instance 생성. username/password 로그인 활성화. 이메일 필수 여부를 결정하고 현재 UI 설정과 일치시킴 | 운영용 Production instance 생성. 공개 HTTPS 도메인을 허용 도메인/redirect origin으로 등록. 실제 제출 주소에서 가입·로그인 검증 |
| Clerk–Supabase 연동 | Clerk Dashboard의 Supabase integration을 개발 Supabase 프로젝트와 연결. 발급자(issuer)와 서명키 설정이 Supabase 프로젝트에서 활성인지 확인 | 운영 Clerk instance를 운영 Supabase 프로젝트에 별도로 연결. 개발 issuer와 혼용하지 않음 |
| Supabase DB | `schema.sql` 실행 후 `clerk-migration.sql` 실행. 기존 DB는 migration만 실행. 두 번째 실행 시 SQL 오류가 없는지 확인 | 개발 DB와 분리된 프로젝트에서 승인된 스키마/정책을 적용하고 정책 확인 테스트 |
| 웹 공개 설정 | `SUPABASE_URL`, Supabase 공개 anon/publishable key, Clerk publishable key와 Clerk SDK URL을 개발 설정에 연결 | 공개 브라우저 값만 배포. Clerk Production 도메인·Supabase URL·공개 키만 반영. service-role key, secret key, LLM key는 정적 웹에 절대 삽입하지 않음 |
| 사용자 식별 | 로그인 후 JWT `sub`가 Clerk 사용자 ID와 같은지 테스트. 동일 ID가 DB `user_id`와 비교되는지 확인 | 새 계정 두 개로 본인 가입·메시지 접근과 타 사용자/타 방 차단을 재검증 |
| Realtime | `course_room_messages`가 `supabase_realtime` publication에 포함되는지 확인 | 로그인 사용자 같은 방 수신, 비참여·타 방 무수신, 토큰 만료·재연결을 확인 |
| 배포 | 로컬/preview 주소를 사용하고 개발 자격 증명을 사용 | GitHub Pages HTTPS 주소, 브라우저 storage 초기화 및 새 기기에서 종단 간 시험 |

**현재 구현 주의**: `index.html`은 Clerk SDK의 `window.Clerk.session?.getToken()`을 Supabase 클라이언트의 `accessToken` callback에 전달한다. README에는 프로젝트 URL과 공개 키가 코드에 있다고 설명되어 있다. GitHub Pages는 정적 호스팅이므로 런타임 비밀 환경변수를 숨길 수 없다. 키를 넣어야 하는 Edge Function은 Supabase 쪽 서버 환경변수로 관리한다.

## 3. 기술 구성 및 선정 이유

| 계층 | MVP 기술 | 선택 이유와 적용 범위 |
| --- | --- | --- |
| 웹 클라이언트 | 기존 정적 HTML·JavaScript·Tailwind CSS | 현재 동작하는 프로토타입을 재사용해 전환 비용을 줄이고 핵심 사용자 흐름 검증에 집중 |
| 정적 호스팅 | GitHub Pages + GitHub Actions | 별도 서버 운영 없이 HTTPS 배포. 비밀 값이 필요한 서버 기능은 여기서 실행하지 않음 |
| 사용자 인증 | Clerk (username/password) | 기존 로그인 구현 재사용. 게스트 입장은 요구사항과 현재 구현의 차이로 문서화 |
| 데이터베이스 | Supabase PostgreSQL | 코스방 참여자와 메시지를 저장하고 SQL 제약조건·RLS로 접근 제어 |
| 실시간 이벤트 | Supabase Realtime (Postgres Changes) | 메시지 INSERT를 같은 코스방 구독자에게 전달 |
| 추천 중계 | Supabase Edge Function (AI 연동 시) | 모델 비밀 키 보호, 입력 검증, 출력 스키마 검증, 요청 제한 |
| 코스·안전 데이터 | 버전 관리되는 검수 시드 데이터에서 시작 | 해커톤 중 외부 데이터 장애·키 설정 문제를 줄이고 출처와 기준일을 추적 |
| 지도 | 선택 기능: Kakao Maps 또는 Naver Maps | 지도 사업자·키·도메인 제한·좌표 데이터 검증 후 적용. 미확정 상태에서 실동작으로 표현하지 않음 |

**기술 선택 원칙**: 해커톤 MVP에서는 새로운 프레임워크로 전면 이전하지 않는다. 테스트 가능한 사용자 가치와 데이터 정확성을 우선한다. React/Next.js, 별도 코스 DB, 지도 API는 요구와 운영 조건이 확인될 때 증분 도입한다.

## 4. 주요 처리 흐름

### 4.1 조건 기반 코스 추천

1. 클라이언트가 난이도, 체력/컨디션, 희망 산행 시간 및 선택 입력을 제출한다. 이름, 계정 ID, 정밀 위치는 추천 입력에 포함하지 않는다.
2. 추천 엔진은 검수된 코스 목록에서 필수 조건에 맞지 않는 후보를 먼저 제외한다. 초급자에게 검증되지 않은 고난도 코스를 추천하는 등 안전 필터를 점수로 상쇄할 수 없게 한다.
3. 남은 후보의 설명 가능한 점수를 계산한다. 시작 가중치는 팀이 코스 데이터와 비팀원 테스트로 조정한다.

   `점수 = 0.40 × 난이도 적합도 + 0.30 × 희망 시간 적합도 + 0.20 × 컨디션 적합도 + 0.10 × 검증된 당일 조건 적합도`

   당일 기상 등 신뢰 가능한 최신 입력이 없으면 해당 항목은 “미반영”으로 표시하고 사용 가능한 가중치만 재정규화한다. 존재하지 않는 날씨·사고 데이터를 추정해 넣지 않는다.
4. AI 기능을 활성화한 경우에도 추천 엔진이 정한 코스 ID와 사실만 모델에 제공한다. 모델은 후보를 새로 만들거나 안전 등급을 변경할 수 없고, 설명 문장만 생성한다. JSON 스키마·코스 ID·문장 길이를 검증하며, 검증 실패·타임아웃·한도 초과 시 규칙 기반 설명으로 대체한다.
5. 화면은 추천 이유와 코스의 거리·예상 시간·고도, 데이터의 출처·확인일을 함께 표시한다. 후보가 없으면 결과 없음과 필터 조정 방법을 안내한다.

**AI 정직성 원칙**: 현재 저장소에 AI 모델/API 연동은 없다. Edge Function과 모델을 실제 연결하고 성공·장애 대체 경로를 확인하기 전까지 기능을 “AI 연동 완료”로 소개하지 않는다. MVP에서 AI 연동이 불가하면 설명 가능한 규칙 기반 추천을 제공하고 AI 기능은 후속 범위로 표기한다.

### 4.2 크루방 입장과 실시간 메시지

```mermaid
sequenceDiagram
    actor H as 등산객
    participant W as 웹 클라이언트
    participant C as Clerk
    participant S as Supabase API
    participant D as PostgreSQL + RLS
    participant R as Realtime
    actor M as 같은 방 참여자

    H->>W: 코스 선택 후 방 입장
    W->>C: 로그인 세션 확인
    C-->>W: 사용자 JWT
    W->>S: JWT로 방 참여자 조회/가입
    S->>D: 사용자 ID·코스 ID 정책 검사
    D-->>W: 참여 성공
    W->>S: 메시지 최대 100건 조회 (V1.0은 오래된 순)
    W->>R: 해당 코스 메시지 INSERT 구독
    H->>W: 메시지 전송
    W->>S: 메시지 INSERT (JWT)
    S->>D: 본인·방 참여·길이 제약 검사
    D-->>W: 저장 결과
    D-->>R: INSERT 이벤트
    R-->>M: 동일 코스방에 이벤트 전달
```

- 방 입장 후 최대 최근 100건을 조회하고, 해당 `course_id`의 새 메시지만 실시간 구독한다.
- 메시지는 서버 저장 성공 응답 후 화면에 반영한다. 실패한 메시지를 전송 완료처럼 표시하지 않고 재시도 가능한 오류를 보여준다.
- **빠른 상태 결정**: MVP에서는 “정상 도착·휴식 중·택시 동행”을 독립 presence/badge 레코드가 아닌 일반 채팅 이벤트 메시지로 보낸다. 현재 DB의 `body`만으로 구현 가능하며, 별도 상태 테이블/Realtime 이벤트는 추가하지 않는다.
- 이 설계에서 상태의 만료·해제는 다음과 같다: 영구 상태 배지가 없으므로 방 참여자의 “현재 상태”는 저장·표시하지 않는다. 각 상태 메시지는 방 채팅과 동일하게 30일 보관 대상으로 정하고 이후 삭제한다. 사용자가 상태를 정정하려면 새 메시지를 보낸다. “해제” 버튼이나 이전 상태를 수정하는 기능은 제공하지 않는다. 30일 보관과 만료 작업은 정책 제안이며 자동 삭제 설정 전까지 운영 환경에서 시행된 것으로 간주하지 않는다.
- 추후 지속 배지가 필요하면 별도 `course_room_statuses` 테이블에 사용자당 방별 단일 행, 허용 상태 enum, `updated_at`, `expires_at`을 두는 후속 변경으로 분리한다. 제안 TTL은 30분이며 만료 시 Realtime 구독에서 제외하고, 사용자가 해제하거나 방을 나갈 때 행을 삭제한다. 이 확장은 현재 MVP 범위가 아니다.
- 나가기 또는 사용자 변경 시 이전 Realtime 채널을 해제하고 해당 방 화면을 비운다.

### 4.3 주요 API 계약

아래 Supabase REST 요청은 현재 클라이언트 동작을 HTTP 계약으로 표현한 것이다. JSON 응답은 선택 컬럼만 포함한다. Supabase Realtime은 별도 REST 응답을 반환하지 않고 같은 코스의 INSERT payload를 구독자에게 이벤트로 전달한다. 추천 API는 **제안 설계이며 아직 구현되지 않았다.**

모든 Supabase REST 요청은 `apikey: <SUPABASE_PUBLIC_KEY>`, `Authorization: Bearer <CLERK_SESSION_JWT>` 헤더를 보낸다. JSON 쓰기 요청은 `Content-Type: application/json`을 설정한다. 아래 `{courseId}`·`{userId}`는 URL 인코딩이 필요한 경로/쿼리 값이며, 서버는 전달된 `user_id`를 신뢰하지 않고 JWT `sub`와 비교한다.

| 동작 | 요청 | 권한/제약 | 성공 응답 |
| --- | --- | --- | --- |
| 내 방 참여 확인 | `GET /rest/v1/course_room_members?select=user_id&course_id=eq.{courseId}&user_id=eq.{userId}` | 유효한 Clerk JWT. RLS는 본인 `user_id`만 허용 | `200` `[{ "user_id": "user_..." }]`; 미참여면 `200 []` |
| 방 참여 | `POST /rest/v1/course_room_members` JSON `{course_id,user_id,display_name}` | `user_id == JWT sub`; 허용된 코스 ID; 이름 1–30자; 이미 가입한 경우 unique 제약 | `201` (return representation 요청 시 생성 행) |
| 초기 메시지 이력 | `GET /rest/v1/course_room_messages?select=id,course_id,user_id,display_name,body,created_at&course_id=eq.{courseId}&order=created_at.asc&limit=100` | 유효 JWT + 해당 방 참여자 RLS | `200` 메시지 배열. **V1.0 코드는 오름차순 후 limit 100이므로 최근 100건이 아니라 해당 방의 가장 오래된 메시지 최대 100건을 조회한다.** 최근 메시지가 필요하면 내림차순 limit 후 화면 표시 직전 역순 정렬로 변경해야 하며 현재는 미구현 |
| 메시지 전송 | `POST /rest/v1/course_room_messages?select=id,course_id,user_id,display_name,body,created_at` JSON `{course_id,user_id,display_name,body}` + `Prefer: return=representation` | `user_id == JWT sub`; 방 참여자; 이름 1–30자; 본문 1–1,000자 | `201` 생성된 메시지 객체 |
| 메시지 실시간 수신 | Supabase Realtime `postgres_changes`, `event=INSERT`, `table=course_room_messages`, `filter=course_id=eq.{courseId}` | 로그인 JWT와 메시지 테이블 RLS로 필터 | 데이터 변경 payload `{eventType:"INSERT", new:{id,course_id,user_id,display_name,body,created_at}}`; HTTP 응답 없음 |
| 코스 추천 | `POST /functions/v1/recommend-courses` JSON 아래 예시 | 제안 API. 익명 조건 입력만 허용, 서버 검증 및 요청 제한 | `200` 코스 ID가 유효한 정형 추천 응답. 미구현 |

#### 채팅 API JSON 예시

클라이언트 메시지 쓰기 payload:

```json
{
  "course_id": "cheonjusan",
  "user_id": "user_clerk_123",
  "display_name": "다현",
  "body": "입구 주차장에 도착했어요!"
}
```

PostgREST 생성 결과(REST 배열 형태):

```json
[
  {
    "id": 418,
    "course_id": "cheonjusan",
    "user_id": "user_clerk_123",
    "display_name": "다현",
    "body": "입구 주차장에 도착했어요!",
    "created_at": "2026-11-26T08:47:00Z"
  }
]
```

`supabase-js`의 `.select(...).single()`은 위 REST 응답을 단일 객체 `data`로 노출한다. 실제 빠른 상태 버튼도 `body`만 `"정상 도착"`, `"휴식 중"`, `"택시 동행"`으로 바꿔 같은 메시지 API를 호출한다. 사용자 ID는 요청 payload에 포함하더라도 RLS가 토큰의 `sub`와 일치하지 않으면 쓰기를 거부한다.

#### 추천 API 제안 요청/응답

```json
{
  "difficulty": "beginner",
  "condition": "light_hike",
  "preferredMinutes": 120,
  "weather": null
}
```

```json
{
  "recommendations": [
    {
      "courseId": "cheonjusan",
      "score": 0.91,
      "reason": "초급 난이도이며 선택한 가벼운 산행 조건과 희망 시간에 맞습니다."
    }
  ],
  "method": "rules",
  "dataAsOf": "2026-11-26"
}
```

`method`는 `rules` 또는 실제 모델 설명이 성공한 경우 `rules+ai-explanation`이다. 반환 코스는 검수된 코스 카탈로그의 ID여야 하고, AI 설명은 점수·사실을 덮어쓰지 못한다. 유효한 후보가 없으면 `200 {"recommendations":[],"method":"rules","dataAsOf":"..."}`와 같이 빈 결과를 정상 응답으로 반환한다.

#### 오류 응답과 시간 제한

오류는 HTTP status와 정형 JSON `{ "code": "...", "message": "...", "requestId": "..." }`로 표준화한다. Supabase가 직접 생성하는 오류 형식은 공급자 오류 본문이 다를 수 있으므로 클라이언트는 HTTP status/SQLSTATE를 기준으로 분류하고 사용자 메시지에 원문 토큰·SQL 세부정보를 노출하지 않는다.

| 상황 | HTTP / 코드 예시 | 사용자 동작 |
| --- | --- | --- |
| JWT 없거나 만료·issuer/서명 불일치 | `401 AUTH_REQUIRED` (PostgREST JWT 거부 응답) | 로그인 갱신 후 한 번 재시도. 자동 재시도 실패 시 로그인 안내 |
| 유효한 로그인이나 RLS 권한 거부 | `403 ROOM_FORBIDDEN` 또는 정책에 의해 조회 결과 `[]` | 방 재입장 유도, 데이터는 표시하지 않음 |
| 잘못된 필드/길이/코스 ID | `400 VALIDATION_ERROR` (`23514` check violation 등) | 입력 수정. 폼에 사용자용 검증 문구 표시 |
| 중복 멤버십 | `409 ROOM_ALREADY_JOINED` (`23505` unique violation) | 이미 참여한 것으로 처리 후 메시지 로드 |
| 요청 제한 초과 | `429 RATE_LIMITED` | 1초 이상 `Retry-After`를 따르고 버튼을 잠시 비활성화 |
| Supabase/네트워크 일시 장애 | `502/503 UPSTREAM_UNAVAILABLE` 또는 SDK 네트워크 오류 | 메시지는 실패 상태로 보이고 사용자가 재시도. 전송 성공으로 가장하지 않음 |
| 추천 입력 오류 | `400 INVALID_RECOMMENDATION_INPUT` | 허용 enum·범위 안내 |
| 추천 후보 없음 | `200` 빈 `recommendations` | 안전 필터를 낮추지 않고 조건 조정 안내 |
| AI 호출 제한 시간 초과/모델 오류/출력 검증 실패 | 내부 fallback, 외부에는 `200 method:"rules"` | 규칙 추천 결과와 AI 미사용 안내 |

**권장 제한**: 채팅 저장 요청의 클라이언트 timeout은 8초, 추천 요청의 전체 deadline은 5초(정상 응답 목표 p95 ≤ 3초), AI 설명 하위 호출은 2초다. timeout은 요청이 서버에 저장되지 않았음을 보장하지 않으므로 메시지 재시도 시 중복 가능성을 알리고, 실제 idempotency key 도입 전에는 무조건 자동 재전송하지 않는다. 현재 클라이언트는 이러한 deadline을 모두 구현하지 않았으며, 표는 구현 기준이다.

### 4.4 안전 정보와 긴급 안내

- 코스 안전 항목은 유형(위험 구간, 쉼터, 화장실, 구급함), 출처, 확인일 및 검증된 좌표가 있을 때만 표시한다.
- 권한 거부, GPS 미수신 또는 데이터 미등록은 각각 별도 상태로 안내한다. 정보 부재를 “위험 없음” 또는 “시설 없음”으로 해석하지 않는다.
- 119 버튼은 지원 기기에서 전화 앱을 여는 `tel:119` 링크다. 서비스가 신고를 전달하거나 구조를 요청했다고 주장하지 않는다.
- 국가지점번호는 검증된 데이터/변환 절차가 확보될 때만 실제 값으로 제시한다. 그 전에는 현장 표지판 확인과 119 직접 통화를 안내한다.
- 안내 문구에는 정보의 기준일과 “현장 표지판·공식 안내를 우선 확인”하는 주의 문구를 제공한다. 앱은 구조·의료 전문 판단을 대신하지 않는다.

## 5. 데이터 설계

### 5.1 현재 Supabase 테이블

`supabase/schema.sql` 및 `supabase/clerk-migration.sql`에 정의된 스키마를 기준으로 한다.

| 테이블 | 핵심 컬럼 | 제약·용도 |
| --- | --- | --- |
| `course_room_members` | `course_id`, `user_id`, `display_name`, `joined_at` | `(course_id, user_id)` 기본 키. 사용자별 코스방 참여 |
| `course_room_messages` | `id`, `course_id`, `user_id`, `display_name`, `body`, `created_at` | 메시지 저장. `(course_id, created_at)` 조회 인덱스, Realtime publication 등록 |

- Clerk 연동 후 사용자 식별자는 Clerk JWT의 `sub`와 일치하는 text 값이다. 신규/기존 프로젝트 SQL 적용 순서는 README 설정 절차를 따른다.
- 현재 허용 코스 ID는 DB 제약조건에 고정(`cheonjusan`, `muhaksan`, `hwangmaesan`, `yongji`)되어 있다. 새 코스 추가 시 프론트엔드 데이터와 SQL 제약조건을 함께 변경한다.
- 메시지 본문은 공백 제거 후 1~1,000자, 표시 이름은 1~30자 범위로 클라이언트와 DB 모두에서 제한한다.

### 5.2 코스·안전 데이터 계약

시드 데이터를 파일로 관리할 때도 동일한 필드 계약을 적용한다. 좌표는 현장·공공 출처를 검증한 항목에만 포함한다.

```json
{
  "id": "cheonjusan",
  "name": "창원 천주산 진달래길 코스",
  "region": "경남 창원시",
  "difficulty": "beginner",
  "distanceKm": 4.2,
  "estimatedMinutes": 100,
  "summitElevationM": 638,
  "conditionTags": ["light_hike"],
  "elevationProfile": [],
  "source": "검증 후 실제 출처 기재",
  "verifiedAt": "검증 후 날짜 기재"
}
```

| 안전 항목 필드 | 규칙 |
| --- | --- |
| `id`, `courseId`, `type`, `name` | 식별자와 코스, 유형(`hazard`, `shelter`, `toilet`, `first_aid`)을 명시 |
| `latitude`, `longitude` | 좌표 출처·정확도 확인이 끝난 경우에만 저장·표시 |
| `source`, `verifiedAt` | 출처와 확인일이 없는 데이터는 실제 안전 정보로 노출하지 않음 |
| `status` | `verified`, `sample`, `unavailable`을 구분해 샘플을 운영 데이터와 혼동하지 않음 |

### 5.3 Clerk 사용자 ID 기준 전체 채팅 스키마 (통합 참고 DDL)

다음은 `schema.sql` 실행 후 `clerk-migration.sql`까지 적용한 뒤의 **유효 스키마를 새 환경 기준으로 합쳐 적은 참고용 DDL**이다. 이미 두 SQL 파일을 적용한 프로젝트에는 이 블록을 다시 실행하지 않는다. 기존 환경에서는 저장소의 `schema.sql` → `clerk-migration.sql` 적용 순서를 사용한다. 샘플 코드이며 Supabase SQL Editor에서 staging 검증 후 운영에 적용한다.

```sql
create table if not exists public.course_room_members (
  course_id text not null
    check (course_id in ('cheonjusan', 'muhaksan', 'hwangmaesan', 'yongji')),
  user_id text not null,
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 30),
  joined_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

create table if not exists public.course_room_messages (
  id bigint generated by default as identity primary key,
  course_id text not null
    check (course_id in ('cheonjusan', 'muhaksan', 'hwangmaesan', 'yongji')),
  user_id text not null,
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 30),
  body text not null
    check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists course_room_messages_course_created_idx
  on public.course_room_messages (course_id, created_at);

alter table public.course_room_members enable row level security;
alter table public.course_room_messages enable row level security;

create policy "Members can read their own room memberships"
  on public.course_room_members for select to authenticated
  using (user_id = (select auth.jwt()->>'sub'));

create policy "Users can join rooms as themselves"
  on public.course_room_members for insert to authenticated
  with check (user_id = (select auth.jwt()->>'sub'));

create policy "Users can leave their own rooms"
  on public.course_room_members for delete to authenticated
  using (user_id = (select auth.jwt()->>'sub'));

create policy "Room members can read room messages"
  on public.course_room_messages for select to authenticated
  using (
    exists (
      select 1 from public.course_room_members as member
      where member.course_id = course_room_messages.course_id
        and member.user_id = (select auth.jwt()->>'sub')
    )
  );

create policy "Room members can send messages as themselves"
  on public.course_room_messages for insert to authenticated
  with check (
    user_id = (select auth.jwt()->>'sub')
    and exists (
      select 1 from public.course_room_members as member
      where member.course_id = course_room_messages.course_id
        and member.user_id = (select auth.jwt()->>'sub')
    )
  );

grant select, insert, delete on public.course_room_members to authenticated;
grant select, insert on public.course_room_messages to authenticated;
grant usage, select on sequence public.course_room_messages_id_seq to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'course_room_messages'
  ) then
    alter publication supabase_realtime add table public.course_room_messages;
  end if;
end
$$;
```

정책은 `UPDATE` 권한을 부여하지 않는다. 현재 Clerk migration은 Supabase `auth.users` 외래 키를 제거하고 `user_id`를 Clerk JWT의 `sub`와 비교하므로, 멤버·메시지의 `user_id`는 Clerk ID여야 한다. Realtime의 필터는 편의 기능이며, 데이터 노출 방지는 위 메시지 `SELECT` RLS가 담당한다.

### 5.4 안전 데이터 운영·갱신 정책 제안

운영 데이터로 공개하기 전 팀이 콘텐츠 담당자 1명을 지정한다. 해당 역할이 비어 있으면 안전 데이터를 `verified`로 배포하지 않는다.

| 데이터 유형 | 제안 확인 주기 | 만료/오래된 자료 처리 |
| --- | --- | --- |
| 고정 코스 메타데이터·고도 | 분기 1회 및 코스 변경 제보 시 | 확인일 180일 초과 시 `stale` 표시, 재확인 전 추천의 참고자료로만 제공 |
| 쉼터·화장실·구급함 좌표 | 분기 1회, 가능하면 공식 데이터 갱신 시 | 확인일 90일 초과 시 위치 안내에서 제외하거나 “정보 확인 필요”로 표시 |
| 사고 위험·통제·임시 폐쇄 | 공식 원본의 게시·변경을 확인해 시연일 전 및 산행 안내 직전 확인 | 임시 항목은 원본 종료 시각에 제거. 종료 시각이 없으면 등록 후 최대 24시간만 활성 유지, 이후 `stale` 경고/활성 알림 제외 |

갱신 기록에는 항목 ID, 원본 URL/기관, 원본 발행일, 팀 확인일, 확인자, 좌표 검증 여부, 변경 요약을 남긴다. 자동 수집이 없는 MVP에서 “실시간”이라고 표시하지 않는다. **이 주기와 담당자 운영은 제안 정책이며 아직 자동화·현장 검증되지 않았다.**

## 6. 인증, 보안 및 개인정보

### 6.1 Supabase RLS 정책

| 동작 | 필수 정책 |
| --- | --- |
| 참여자 조회 | 로그인 사용자는 본인의 참여 정보만 조회 |
| 방 참여 | JWT `sub`와 요청 `user_id`가 일치할 때만 가입 |
| 방 나가기 | 로그인 사용자는 본인의 참여 정보만 삭제 |
| 메시지 조회 | 요청 사용자가 동일 `course_id`의 참여자인 경우에만 허용 |
| 메시지 작성 | 작성자 ID가 JWT `sub`와 같고 해당 방 참여자인 경우에만 허용 |
| 실시간 구독 | 데이터베이스 RLS를 동일하게 적용. 클라이언트의 코스 필터만 보안 경계로 신뢰하지 않음 |

### 6.2 데이터 보호 원칙

- GPS 공유를 구현할 때 기본값은 OFF다. 명시적 동의와 위치 권한 허용 후에만 공유하고, 화면에 공유 중임을 지속 표시한다.
- 동의 철회·방 나가기·로그아웃 시 위치 전송을 즉시 중단한다. 저장 위치의 삭제/만료와 모든 참여자 화면에서의 제거를 함께 검증한다.
- P0 채팅·인증에서 필요하지 않은 전화번호, 실명, 정밀 위치를 수집하지 않는다. 추천 요청은 익명 조건값만 전달한다.
- Clerk 사용자 표시 이름은 사용자 프로필 데이터이지 실명 인증값이 아니다. 채팅 입력은 HTML로 실행하지 않고 텍스트로 렌더링한다.
- 클라이언트 키는 공개 키로만 제한하고 DB 권한은 RLS로 집행한다. 비밀 키·비밀번호·세션 토큰을 코드, 커밋, 화면 오류에 포함하지 않는다.
- **채팅 보관 결정**: 방 메시지는 산행 동행 조율 목적의 데이터로 30일 후 삭제하는 정책을 제안한다. 현재 SQL에는 자동 삭제 스케줄이 없으므로 설정 전에는 이 보관 기간이 시행된 것이 아니다. 공개 배포 전 Supabase 서버 측 일일 정리 작업을 설정하고, `created_at < now() - interval '30 days'` 메시지 삭제 후 삭제 건수·마지막 실행 시각을 확인한다.
- **사용자 삭제 요청**: 요청자의 Clerk ID를 확인한 운영자가 해당 ID의 메시지를 삭제하고 `course_room_members` 행을 삭제한다. 메시지에는 테이블 FK가 없으므로 계정 삭제만으로 메시지가 자동 삭제된다고 가정하지 않는다. 운영 작업은 service-role 권한이 있는 서버/관리 콘솔에서만 수행하고, service-role key는 문서·브라우저에 넣지 않는다. 처리 후 두 테이블의 대상 행이 0건인지 검증하고 요청·완료 시각만 기록한다.
- MVP는 실제 위치를 수집·저장하지 않는다. 위치 기록의 보관기간을 별도 결정하지 않은 채 위치 수집 기능을 켜지 않는다.

## 7. 비기능 요구사항과 장애 처리

| 항목 | 목표·처리 |
| --- | --- |
| 반응형 UX | 모바일 우선. 코스 선택부터 안전 안내까지 핵심 동작을 작은 화면에서 스크롤·키보드 조작으로 수행 가능 |
| 실시간성 | 다중 접속 테스트에서 채팅/빠른 상태의 95% 이상을 2초 이내 반영하는 것을 목표로 측정 |
| 추천 응답 | 추천 API를 연동할 경우 정상 응답 p95 3초 이내 목표. 타임아웃이면 결정론적 로컬 점수 결과를 제공 |
| 접근성 | 버튼 이름, 입력 오류, 연결/전송 상태를 텍스트와 접근 가능한 상태 요소로 제공. 색상만으로 위험·성공을 구분하지 않음 |
| 데이터 신뢰 | 모든 코스·시설 데이터에 출처와 기준일을 기록. 출처 또는 좌표를 확인하지 못하면 미확인으로 표시 |
| 서비스 장애 | Clerk·Supabase·모델 장애를 구별해 알림. 채팅 실패 시 전송 실패 표시, 모델 장애 시 규칙 기반 추천, 지도 장애 시 안전 정보 목록/전화 안내 제공 |
| 네트워크 불안정 | 저장·동기화 성공을 가장하지 않음. 현재 연결 여부와 마지막으로 확인된 데이터 시각을 표시 |
| 배포 | HTTPS와 Clerk 허용 도메인 설정 확인. `main` 배포 후 별도 기기/네트워크에서 실제 공개 접속 검증 |

**안전 기능의 장애 원칙**: 지도나 GPS가 작동하지 않더라도 안내 문구는 사용할 수 있어야 한다. 단, 이 기능을 오프라인 안전 서비스라고 부르려면 검증된 오프라인 데이터 저장·만료·복원 기능을 별도로 구현하고 시험해야 한다.

## 8. 배포 및 운영

```mermaid
flowchart LR
    DEV["검토된 main 커밋"] --> ACT["GitHub Actions"]
    ACT --> PAGES["GitHub Pages HTTPS"]
    PAGES --> BROWSER["참가자 브라우저"]
    BROWSER --> CLERK["Clerk 도메인 설정"]
    BROWSER --> SUPA["Supabase 프로젝트"]
    EDGE["Supabase Edge Function<br/>AI 키는 서버 비밀 값"] -.-> SUPA
```

1. 변경은 PR에서 검토한 뒤 `main`에 반영한다.
2. GitHub Actions가 정적 웹 자산을 GitHub Pages에 배포한다. 저장소에 커밋한 모든 정적 파일은 공개될 수 있으므로 비밀 설정 파일을 포함하지 않는다.
3. Clerk의 허용 도메인/redirect URL, Supabase URL·공개 키, Clerk-Supabase JWT 연동, RLS 및 Realtime publication을 대상 환경에서 확인한다.
4. AI 모델을 활성화하는 경우 Supabase Edge Function에 제공자 키를 비밀 값으로 설정한다. 프론트엔드 번들·GitHub Actions 로그·응답에 키가 노출되지 않는지 확인한다.
5. 릴리스 전 HTTPS 접근, 코스 선택, 새 계정 로그인, 두 사용자 간 메시지, 다른 방 차단 및 안전 안내를 실제 모바일 브라우저에서 점검한다.

## 9. 검증 계획과 완료 기준

PRD에서 제시한 목표를 **측정 가능한 인수 기준**으로 사용한다. 결과를 측정하기 전에는 달성했다고 주장하지 않는다.

| 검증 영역 | 절차 | 통과 기준 |
| --- | --- | --- |
| 추천·입장 사용성 | 비팀원 5명 이상이 조건 선택 → 추천 확인 → 코스 상세 → 크루방 진입 수행 | 성공 완료율 85% 이상. 인원, 성공 건수, 환경을 함께 기록 |
| 추천 안전성 | 허용되지 않은 난이도 후보, 후보 데이터 누락, 기상 데이터 없음, 모델 장애/잘못된 JSON을 주입 | 부적합 후보 미노출. 출처 없는 사실 생성 없음. 모델 장애 시 규칙 결과 제공 |
| 실시간 채팅 | 두 계정·두 기기에서 같은 방과 서로 다른 방을 각각 시험. 각 기기 전송 시각·수신 시각 기록 | 같은 방 이벤트 95% 이상이 2초 이내 수신. 다른 방 메시지 읽기/구독 불가 |
| 메시지 검증 | 비인증, 비참여자, 빈 문자열, 1,000자 초과, HTML 입력으로 요청 | 서버 RLS/제약이 거부하거나 안전한 텍스트로 렌더링 |
| 안전 안내 | 안전 정보 있는/없는 코스, 위치 권한 거부, GPS 미수신, 통신 끊김 시험 | 안전 화면에서 위험/거점 및 119·국가지점번호 안내 확인 평균 15초 이내. 미확인 자료를 실제 정보로 표시하지 않음 |
| 위치 개인정보 | 동의 OFF, 권한 거부, 동의 ON 후 철회, 방 퇴장 시험 | 동의 전 좌표 전송 0건. 철회 이후 업데이트 0건. P1 구현 전에는 위치 서버 요청 0건 |
| 배포·시연 | 공개 HTTPS 주소를 팀 외부 기기·네트워크에서 접속 | 4단계 시연 성공. 핵심 흐름에서 치명적 오류 0건 목표 |

테스트 기록에는 빌드/커밋, 날짜, 브라우저·기기, 네트워크, 시도 건수, 원시 성공/실패 건수, 지연 측정값 및 미해결 문제를 남긴다. 평균이나 퍼센트만으로 표본 수를 숨기지 않는다.

### 현재 검증 실행 결과

| 검증 항목 | 현재 결과 | 제출 전 남은 증거 |
| --- | --- | --- |
| 소스/문서 대조 | 소스와 SQL 파일을 읽어 구현 범위를 문서화함. 런타임 테스트는 아님 | 테스트한 커밋, 브라우저, 실제 결과 |
| Clerk → Supabase JWT | 미검증 | issuer/JWKS 설정 화면(비밀값 제외), `sub` 매칭 결과, 만료 토큰 거부 |
| 같은 방 실시간 채팅·타 방 차단 | 미검증 | 테스트 계정 2개/기기 2대, 전송·수신 건수와 지연 |
| SQL RLS 통합 DDL | 문서에 저장소 SQL 기반 전문 수록; 별도 DB 재실행 테스트 미검증 | 새 staging DB 적용 로그와 비인증/비참여/참여자 CRUD 결과 |
| 추천 API/AI fallback | 미구현, 실행 결과 없음 | 구현 전에는 “설계”로 표기. 구현 후 정상/타임아웃/잘못된 JSON 결과 |
| 안전 데이터 출처·갱신/만료 | 정책 초안이며 운영 데이터 검증 미완료 | 담당자, 원본 링크, 확인일 및 만료 레코드 테스트 |
| 채팅 30일 삭제·사용자 삭제 절차 | 제안 정책, 자동화 미구현 | 정리 작업 실행 기록과 대상 행 0건 확인 |
| 공개 HTTPS 배포 종단 간 흐름 | 배포 워크플로 확인; 이 문서 갱신 기준 런타임 결과는 미기록 | 심사 장소/외부 네트워크의 URL, 날짜, 화면·채팅 결과 |

위 “미검증/미구현” 항목은 점수를 높이기 위해 완료로 바꾸지 않는다. 팀이 테스트 증거를 추가한 항목만 실행 완료로 갱신한다.

## 10. 범위, 단계 및 위험 관리

### 해커톤 단계

| 단계 | 결과물 | 완료 조건 |
| --- | --- | --- |
| 1. 기반 | 기존 정적 UI, 코스 시드, 배포 주소, Clerk·Supabase 설정 | 공개 HTTPS에서 인증과 코스 탐색 확인 |
| 2. 연결 | 코스방 참여, 채팅 저장·Realtime, RLS | 서로 다른 계정으로 동일 방 동기화 및 타 방 차단 검증 |
| 3. 신뢰성 | 추천 규칙·설명, 안전 출처/확인일, 오류·정보 부재 UX | AI/네트워크 장애 대체 경로와 허위 정보 방지 확인 |
| 4. 심사 리허설 | 모바일 실기기 시나리오, 측정 결과, 시연 제한사항 | 9절 기록 완료, 미구현 기능을 명확히 표시 |
| P1 (시간 여유 시) | 명시적 동의 기반 실시간 위치, 검증된 지도 레이어, 오프라인 캐시 | 개인정보·철회·오래된 데이터 테스트를 통과해야 공개 |

### 주요 위험과 대응

| 위험 | 영향 | 대응 |
| --- | --- | --- |
| 프로토타입 시뮬레이션을 실제 GPS/안전 기능으로 오인 | 현장 안전과 심사 신뢰에 큰 위험 | 화면의 샘플/시뮬레이션 표시, 검증된 좌표만 사용, 미구현 기능을 시연 전 명시 |
| LLM이 코스·위험 사실을 지어냄 | 잘못된 산행 판단 | 검색 후보 ID만 전달, 구조화 결과 검증, 모델을 안전 판정에 사용하지 않음, 실패 시 규칙 기반 대체 |
| Supabase 설정/RLS/JWT 오류 | 로그인·채팅 실패 또는 데이터 노출 | SQL 적용 순서 재현, 비인증·타방 접근 테스트, 운영 키 미사용 |
| 지도/API 키·통신 장애 | 지도가 안 보이거나 안내 누락 | API에 의존하지 않는 안전 목록과 119 안내 유지, 키·도메인 사전 확인 |
| 오래되거나 출처 불명인 안전 데이터 | 부정확한 현장 정보 | 출처·확인일 필수, 오래된 자료 경고, 최신 여부 모를 때 실시간 표현 금지 |
| 실시간 채팅 동시접속·지연 | 시연 흐름 중단 | 두 기기 사전 리허설, 연결 상태 표시, 오류 재시도, 검증된 시연 계정 준비 |

### 범위 밖

- 실제 119 신고 중계, 구조 출동 보장, 응급 의료 판단
- 검증되지 않은 사고 예측·위험 점수와 위치 자동 추론
- 이번 MVP에서 위치 기반 추적을 기본 활성화하거나 채팅 위치를 무기한 저장하는 것
- 장비 거래·결제, 대회 예약, 정식 커뮤니티 운영
- 학습 데이터가 없는 상태에서 정확도를 주장하는 모델 학습·개인화

## 11. 심사에서 주장할 수 있는 기술적 가치

- **지역 맞춤성**: 경남 코스 후보와 이용 조건을 데이터화해 일반적인 전국 코스 목록이 아닌 지역 청년의 진입 장벽을 다룬다.
- **연속적인 UX**: 추천 결과가 코스 상세, 동일 코스 크루방, 안전 확인으로 이어지도록 한 제품 흐름을 갖는다.
- **설명 가능한 추천**: 적합도 입력과 점수를 공개하고 검증된 후보만 추천한다. 데이터가 부족하면 AI가 사실을 보충하지 않고 제한사항을 드러낸다.
- **프라이버시 우선**: 위치 공유를 기본 기능으로 가장하지 않으며, 향후 구현은 명시적 동의·철회·만료를 완료 기준으로 둔다.
- **실현 가능성과 검증성**: 기존 정적 웹·Clerk·Supabase 기반을 재사용하고, 실시간성·사용성·권한 격리를 수치와 재현 절차로 평가한다.
- **안전 책임성**: 앱이 구조 신고를 완료했다고 오인시키지 않고, 신뢰 가능한 데이터가 없을 때 119 직접 통화와 현장 표지 확인을 안내한다.

## 12. 심사 제출 전 체크리스트

- [ ] AI 추천 API 또는 AI를 사용하지 않는 대체 경로를 실제로 시연하고 표현을 일치시켰는가?
- [ ] 코스·안전 정보의 출처, 확인일, 데이터 소유/검증 담당을 채웠는가?
- [ ] 두 사용자 기기에서 실시간 채팅과 타 방 접근 차단을 확인했는가?
- [ ] 위치·고도·통신 상태의 시뮬레이션과 실제 기능을 화면에서 구별했는가?
- [ ] GitHub Pages 공개 주소, 로그인 허용 도메인, HTTPS와 재접속을 확인했는가?
- [ ] 9절의 실제 측정 결과와 테스트 표본 수를 문서/발표에 첨부했는가?
- [ ] 미구현 기능과 실패 시 안전 안내를 발표에서 과장 없이 설명할 수 있는가?
