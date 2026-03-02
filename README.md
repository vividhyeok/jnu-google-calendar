# 📅 제주대학교 시간표 → Google Calendar 자동 동기화

제주대학교 포털 시간표 API를 주기적으로 가져와 Google Calendar에 동기화하는 개인용 프로젝트입니다.

이 프로젝트는 안드로이드/윈도우 사용자 기준으로 운영하기 쉽도록 구성되어 있습니다.

## 0. 가장 중요한 점 (권장 모드)

- 이 프로젝트의 기본 사용 방식은 `GitHub Actions` 자동 실행입니다.
- 이 경우 로컬 PC에서 Node.js를 계속 실행할 필요가 없습니다.
- Node.js가 필요한 경우는 `로컬에서 직접 실행`할 때만입니다.
- 현재 자동 실행 스케줄은 `매일 KST 10:00`입니다.

## 1. 동작 방식

1. 포털 로그인 후 기간(`START_YYYYMMDD` ~ `END_YYYYMMDD`)의 `classTables` 데이터를 조회합니다.
2. 휴강/보강/온라인 수업 상태를 해석해 캘린더 이벤트로 변환합니다.
3. Google Calendar의 동일 기간 이벤트를 먼저 정리한 뒤, 새 이벤트를 다시 넣습니다.
4. 포털 데이터가 갱신되면(휴강/보강 변경 포함) 다음 실행 시 캘린더에도 반영됩니다.

## 2. 사전 준비

공통:
1. Google 계정
2. 제주대학교 포털 계정
3. 동기화용 Google Calendar 1개
4. Google Cloud 서비스 계정 1개

로컬 실행 시에만 추가:
1. Node.js 22 이상

## 3. Google Calendar/Service Account 설정

1. `https://calendar.google.com`에서 동기화 전용 캘린더를 생성합니다.
2. 캘린더 설정에서 `캘린더 ID`를 복사합니다.
3. `https://console.cloud.google.com`에서 프로젝트를 생성합니다.
4. `Google Calendar API`를 활성화합니다.
5. `IAM & Admin > Service Accounts`에서 서비스 계정을 생성합니다.
6. 서비스 계정 키(JSON)를 발급합니다.
7. JSON의 `client_email`, `private_key`를 환경변수에 사용합니다.
8. Google Calendar 공유 설정에서 서비스 계정 이메일에 `변경 및 공유 관리` 권한을 부여합니다.

## 4. 로컬 실행 (선택 사항, Windows 기준)

아래는 GitHub Actions를 쓰지 않고 직접 PC에서 돌리고 싶을 때만 필요합니다.

1. 저장소 이동 후 의존성 설치

```powershell
npm install
```

2. 환경 파일 생성

```powershell
Copy-Item .env.example .env.local
```

3. `.env.local` 수정

```env
PORTAL_USERNAME=포털아이디
PORTAL_PASSWORD=포털비밀번호
START_YYYYMMDD=20250901
END_YYYYMMDD=20251231
GOOGLE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=xxxx@group.calendar.google.com
SYNC_INTERVAL_HOURS=0
```

4. 1회 동기화 실행

```powershell
npm run sync
```

5. 주기 실행(로컬 데몬 형태)

```powershell
npm run start
```

## 5. 실행 명령어

- `npm run sync`: 1회 실행 후 종료
- `npm run start`: `SYNC_INTERVAL_HOURS` 간격 반복 실행
- `npm test`: 변환 로직 테스트 실행

## 6. 환경변수 설명

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `PORTAL_USERNAME` | O | 제주대 포털 아이디 |
| `PORTAL_PASSWORD` | O | 제주대 포털 비밀번호 |
| `START_YYYYMMDD` | O | 조회 시작일 (`YYYYMMDD`) |
| `END_YYYYMMDD` | O | 조회 종료일 (`YYYYMMDD`) |
| `GOOGLE_CLIENT_EMAIL` | O | 서비스 계정 `client_email` |
| `GOOGLE_PRIVATE_KEY` | O | 서비스 계정 `private_key` 전체 문자열 |
| `GOOGLE_CALENDAR_ID` | O | 동기화 대상 캘린더 ID |
| `SYNC_INTERVAL_HOURS` | X | 반복 실행 간격(시간), 기본값 `24`, `0`이면 1회 실행 |

참고:
- 기존 `username`, `password`도 하위 호환으로 인식됩니다.
- `GOOGLE_PRIVATE_KEY`는 줄바꿈을 `\n` 형태로 유지해야 합니다.
- `START_YYYYMMDD`와 `END_YYYYMMDD`는 유효한 날짜 형식이어야 합니다.

## 7. GitHub Actions 자동 실행

### 7-1. Repository Secrets

- `PORTAL_USERNAME`
- `PORTAL_PASSWORD`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID`

### 7-2. Repository Variables

- `START_YYYYMMDD`
- `END_YYYYMMDD`

### 7-3. 스케줄

- 워크플로 파일: `.github/workflows/cron.yml`
- 현재 cron: `0 1 * * *` (UTC 기준 매일 01:00)
- 한국 시간(KST, UTC+9) 기준: 매일 10:00 실행

### 7-4. 수동 실행

1. GitHub 저장소 `Actions` 탭 이동
2. `cron` 워크플로 선택
3. `Run workflow` 실행

## 8. 자주 발생하는 문제

1. `pnpm is not recognized`
- `npm install`, `npm run sync`로 그대로 실행하면 됩니다.

2. `Missing environment variable`
- `.env.local` 파일명/키 이름 오타를 확인하세요.
- GitHub Actions라면 Secrets/Variables 이름이 README와 정확히 일치해야 합니다.

3. `Portal login failed`
- 포털 계정 정보가 틀렸거나 일시적으로 로그인 세션이 실패한 경우입니다.
- 코드에서 자동 재시도 후에도 실패하면 계정 정보를 다시 확인하세요.

4. Google API 429/5xx
- 일시적인 quota/서버 이슈일 수 있습니다.
- 코드에서 자동 재시도하며, 계속 실패하면 잠시 후 재실행하세요.

5. 일정이 비어 보임
- 조회 기간(`START_YYYYMMDD`, `END_YYYYMMDD`)이 실제 학기 범위를 포함하는지 확인하세요.
- 포털 API 응답에서 `classTables`가 비어 있는지 먼저 확인하세요.

## 9. 운영 팁

- 학기 변경 시 가장 먼저 `START_YYYYMMDD`, `END_YYYYMMDD`만 갱신하세요.
- 테스트는 배포 전 `npm test` 1회 실행해두면 안전합니다.
- 서비스 계정 키는 절대 저장소에 커밋하지 마세요.

## 10. 기반 프로젝트

- https://github.com/mu-hun/jejunu-icalendar-server
