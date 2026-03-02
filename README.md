# 제주대학교 시간표 -> Google Calendar 자동 동기화

제주대학교 포털 시간표를 Google Calendar에 자동 반영하는 프로젝트입니다.

기본 운영 방식은 GitHub Actions 자동 실행이며, 로컬 PC에서 프로그램을 계속 켜둘 필요가 없습니다.

## 1. 이미 예전에 설정해둔 경우

대부분은 삭제/재설정할 필요 없이 날짜만 바꾸면 됩니다.

1. GitHub 저장소 `Settings` 클릭
2. `Secrets and variables` -> `Actions` 클릭
3. `Repository variables`에서 아래 2개만 수정
- `START_YYYYMMDD`
- `END_YYYYMMDD`
4. 저장소 `Actions` 탭 -> `cron` 워크플로 -> `Run workflow` 수동 실행
5. 캘린더 반영 확인

다시 설정이 필요한 경우:
- 서비스 계정(JSON 키)을 새로 만들었을 때
- `GOOGLE_CLIENT_EMAIL` 또는 `GOOGLE_PRIVATE_KEY`를 바꿨을 때
- 캘린더를 새로 만들고 `GOOGLE_CALENDAR_ID`가 바뀌었을 때

## 2. 꼭 필요한 설정이 최소인지

현재 구조에서 필수값은 아래 7개입니다.

1. 포털 인증
- `PORTAL_USERNAME`
- `PORTAL_PASSWORD`

2. Google 인증/대상 캘린더
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID`

3. 조회 기간
- `START_YYYYMMDD`
- `END_YYYYMMDD`

인증값은 외부 서비스 요구사항이라 더 줄이기 어렵고, 보통 학기마다 바꾸는 값은 기간 2개뿐입니다.

## 3. 서비스 계정 공유 설정이 필요한지 판단

### 케이스 A (일반적): 캘린더 소유자가 본인 Gmail 계정

- 서비스 계정 이메일(`client_email`)을 캘린더 공유 목록에 추가해야 합니다.
- 권한은 `변경 및 공유 관리(Manage changes and sharing)` 권장

### 케이스 B: 캘린더 소유자 자체가 서비스 계정

- 서비스 계정과 캘린더 소유자가 동일하면 별도 공유 추가가 필요 없습니다.

### 본인 상태 확인 방법

Google Calendar 설정 화면에서 대상 캘린더의 `공유 대상(Shared with)`을 확인하세요.

- 서비스 계정이 이미 보이면 추가 설정 없이 진행
- 현재 스크린샷처럼 서비스 계정이 공유 목록에 있고 권한도 부여되어 있으면 정상

## 4. 처음 설정하는 방법 (버튼 순서)

## 4-1. 동기화용 Google Calendar 준비

1. https://calendar.google.com 접속
2. 왼쪽 `다른 캘린더` 옆 `+` 클릭
3. `새 캘린더 만들기` 클릭
4. 이름 입력 후 생성
5. 생성한 캘린더 `설정 및 공유`로 이동
6. `캘린더 통합` 섹션에서 `캘린더 ID` 복사
- 이 값을 `GOOGLE_CALENDAR_ID`로 사용

## 4-2. Google Cloud 서비스 계정 준비

1. https://console.cloud.google.com/projectcreate 에서 프로젝트 생성
2. https://console.cloud.google.com/apis/library/calendar-json.googleapis.com 에서 `Google Calendar API` 활성화
3. https://console.cloud.google.com/iam-admin/serviceaccounts 이동
4. `서비스 계정 만들기` 클릭
5. 계정 생성 후 상세 화면 진입
6. `키` 탭 -> `키 추가` -> `새 키 만들기` -> `JSON` 선택 -> 생성
7. 내려받은 JSON 파일에서 아래 값 확보
- `client_email` -> `GOOGLE_CLIENT_EMAIL`
- `private_key` -> `GOOGLE_PRIVATE_KEY`

## 4-3. 캘린더 공유 설정 (필요한 경우만)

케이스 A(캘린더 소유자 != 서비스 계정)인 경우만 진행:

1. 캘린더 `설정 및 공유` 화면
2. `특정 사용자 및 그룹과 공유`에서 `사용자 및 그룹 추가`
3. 서비스 계정 이메일(`client_email`) 입력
4. 권한 `변경 및 공유 관리` 선택 후 저장

케이스 B(소유자 == 서비스 계정)이면 이 단계 생략

## 4-4. GitHub Actions 값 입력

저장소 -> `Settings` -> `Secrets and variables` -> `Actions`

`Repository secrets`에 추가:
- `PORTAL_USERNAME`
- `PORTAL_PASSWORD`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID`

`Repository variables`에 추가:
- `START_YYYYMMDD` (예: `20260302`)
- `END_YYYYMMDD` (예: `20260630`)

주의:
- `GOOGLE_PRIVATE_KEY`는 줄바꿈이 포함된 원문 그대로 입력하거나 `\n` 이스케이프 문자열로 입력

## 4-5. 첫 실행

1. 저장소 `Actions` 탭
2. 왼쪽 `cron` 워크플로 선택
3. 오른쪽 `Run workflow` 클릭
4. 완료 로그에서 동기화 성공 확인
5. Google Calendar에서 이벤트 생성 확인

## 5. 자동 업데이트 방식

- 워크플로: `.github/workflows/cron.yml`
- 스케줄: `0 1 * * *` (UTC)
- 한국 시간: 매일 오전 10시 (KST)

포털 데이터(휴강/보강 포함)가 바뀌면 다음 자동 실행에서 캘린더도 갱신됩니다.

## 6. 자주 묻는 질문

### Q1. 매 학기마다 뭘 바꿔야 하나요?

보통 `START_YYYYMMDD`, `END_YYYYMMDD` 두 값만 바꾸면 됩니다.

### Q2. 기존 설정을 삭제하고 다시 해야 하나요?

아니요. 기존 동기화가 정상 동작 중이면 재설정 불필요합니다.

### Q3. 서비스 계정 이메일 공유를 꼭 해야 하나요?

- 캘린더 소유자가 본인 계정이면 해야 합니다.
- 캘린더 소유자와 서비스 계정이 동일하면 생략 가능합니다.

### Q4. 로컬에서 Node.js가 꼭 필요한가요?

GitHub Actions 자동 모드만 쓸 경우 필요 없습니다.
로컬 수동 실행 시에만 필요합니다.
