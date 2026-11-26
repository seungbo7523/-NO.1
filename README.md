# -NO.1
AI 산·코스 추천, 현장 소통, 장비 대여/거래, 크루 GPS 위치 공유 및 사고 다발지역 알림을 제공하는 등산 중심 플랫폼 (산책로·둘레길 부가 지원)

## 핵심 서비스 개요

- **메인 영역**: 등산 (산행 코스, 입산/하산, 크루 산행, 트레일 마라톤/대회)
- **부가 영역**: 산책로·둘레길 (초보자·가벼운 일상 코스 서브 지원)

## 핵심 기능

1. **AI 산/코스 추천**: 초보·중급·고수 난이도와 당일 조건(날씨 등)을 반영하며, 부가적으로 가벼운 산책로를 추천
2. **등산자 커뮤니케이션 채널**: 파트너/동행 매칭, 하산 후 택시 동행, 날씨·장비·현장 정보 공유
3. **등산 장비 대여 및 판매**
4. **크루 모집 및 크루원 GPS 위치 확인**: 산행 중 동의한 크루원에 한해 위치 공유
5. **GPS 기반 안전 기능**
   - 실시간 등산 상황 확인
   - 휴게시설 위치 안내
   - 소방당국 등 공공데이터 기반 최근 사고 다발지역 알림
6. **부가 기능**: 트레일 마라톤/대회 안내, 산책로 코스 지원

## 인터랙티브 프로토타입

`index.html`은 이슈 #2에 첨부된 TrailMate 경남 시연용 프로토타입입니다. 코스를 선택하면 해당 코스 소통방 입장 동의를 확인하고, 이메일·비밀번호 로그인 후 회원으로 참여합니다. Supabase를 설정하면 코스별 채팅 메시지가 저장되고 실시간으로 공유됩니다. GPS·고도 안내와 지도 데이터는 시연용 로컬 시뮬레이션이며 실제 위치 공유, 공공데이터 연동 또는 긴급 신고 기능은 제공하지 않습니다.

### 실시간 소통방 설정

1. Supabase 프로젝트를 만들고 SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql)을 실행합니다. 이 스키마는 회원만 해당 코스방의 메시지를 읽고 보낼 수 있도록 RLS 정책을 설정합니다.
2. Supabase Authentication에서 이메일 로그인을 활성화하고, URL 설정의 Site URL 및 Redirect URLs에 `https://seungbo7523.github.io/-NO.1/`을 추가합니다.
3. 현재 Supabase Project URL과 publishable key는 `index.html`의 `SUPABASE_URL`, `SUPABASE_PUBLIC_KEY`에 설정되어 있습니다. 다른 프로젝트를 연결할 때만 값을 바꾸고, `service_role` 또는 secret key는 브라우저 코드에 넣지 마세요.
4. 변경사항을 `main`에 반영하면 GitHub Pages가 다시 배포됩니다. Supabase 설정 전에는 입장 확인창에서 서버 미설정 안내가 표시됩니다.

Supabase 기본 인증 메일은 프로젝트당 시간당 2건으로 제한되며 프로젝트 팀에 등록된 주소에만 발송할 수 있습니다. 일반 방문자의 회원가입을 위해서는 [별도의 SMTP 발송 서비스 설정](https://supabase.com/docs/guides/auth/auth-smtp)과 Supabase의 **Authentication → Rate Limits** 조정이 필요합니다. 발송 한도 오류가 발생하면 한도가 회복된 후 다시 시도하세요. SMTP 비밀번호 등 비밀 값은 Supabase 설정에만 입력하고 저장소에 넣지 마세요.

`main` 브랜치에 반영되면 `.github/workflows/deploy-pages.yml`이 GitHub Pages 배포를 수행하고 Pages 활성화를 시도합니다. 저장소 정책이나 권한으로 자동 활성화되지 않으면 GitHub 저장소 설정에서 Pages 배포 원본을 **GitHub Actions**로 지정하세요.
