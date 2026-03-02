# 제주대학교 시간표 -> Google Calendar 자동 동기화

제주대학교 포털 시간표를 Google Calendar에 자동 반영하는 프로젝트입니다.

권장 사용 방식은 GitHub Actions 자동 실행입니다.  
로컬 PC에서 프로그램을 계속 실행할 필요가 없습니다.

## 0. 제일 헷갈리는 포인트 먼저 정리

`client_email`은 내 개인 Gmail 주소와 다를 수 있고, 그게 정상입니다.

| 항목 | 의미 |
| --- | --- |
| 내 Gmail | 캘린더 소유자(사람 계정) |
| 서비스 계정 `client_email` | 자동화 봇 계정(기계 계정) |

즉, 봇이 내 캘린더를 수정하려면:
1. 봇(service account) 자격증명이 필요하고
2. 내 캘린더에 봇 권한이 있어야 합니다.

## 1. 이미 예전에 설정해둔 경우

대부분 재설정할 필요 없습니다. 날짜만 수정하면 됩니다.

1. GitHub 저장소 `Settings` 클릭
2. `Secrets and variables` -> `Actions`
3. `Repository variables`에서 아래 2개 수정
- `START_YYYYMMDD`
- `END_YYYYMMDD`
4. `Actions` 탭 -> `cron` 워크플로 -> `Run workflow`

다시 설정해야 하는 경우:
- 서비스 계정 키(JSON)를 새로 발급했을 때
- 캘린더 ID를 바꿨을 때
- 포털 계정을 바꿨을 때

## 2. 최소 설정값 (추천 방식)

추천 방식은 서비스 계정 정보를 1개 secret으로 넣는 것입니다.

`Repository secrets`:
- `PORTAL_USERNAME`
- `PORTAL_PASSWORD`
- `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON 파일 전체 내용)
- `GOOGLE_CALENDAR_ID`

`Repository variables`:
- `START_YYYYMMDD`
- `END_YYYYMMDD`

총 6개만 관리하면 됩니다.

## 3. 처음 설정하는 방법 (버튼 순서)

## 3-1. Google Calendar 만들기

1. https://calendar.google.com 접속
2. 왼쪽 `다른 캘린더` 옆 `+` 클릭
3. `새 캘린더 만들기` 클릭
4. 이름 입력 후 생성
5. 생성한 캘린더의 `설정 및 공유`로 이동
6. `캘린더 통합` 섹션에서 `캘린더 ID` 복사
7. 이 값을 `GOOGLE_CALENDAR_ID`로 사용

## 3-2. 서비스 계정과 JSON 키 만들기

1. https://console.cloud.google.com/projectcreate 에서 프로젝트 생성
2. https://console.cloud.google.com/apis/library/calendar-json.googleapis.com 에서 `Google Calendar API` 활성화
3. https://console.cloud.google.com/iam-admin/serviceaccounts 이동
4. `서비스 계정 만들기` 클릭
5. 서비스 계정 생성 후 상세 화면 진입
6. `키` 탭 -> `키 추가` -> `새 키 만들기` -> `JSON` -> 생성
7. 다운로드된 JSON 파일 내용을 통째로 복사
8. 이 전체 문자열을 `GOOGLE_SERVICE_ACCOUNT_JSON` secret으로 사용

## 3-3. 캘린더에 서비스 계정 권한 주기

판단 기준:
- 캘린더 소유자와 서비스 계정이 다르면: 권한 추가 필요
- 같으면: 생략 가능

권한 추가가 필요한 경우:
1. Google Calendar 대상 캘린더 `설정 및 공유`
2. `특정 사용자 및 그룹과 공유` -> `사용자 및 그룹 추가`
3. JSON의 `client_email` 입력
4. 권한 `변경 및 공유 관리` 선택 후 저장

## 3-4. GitHub Actions 값 입력

저장소 -> `Settings` -> `Secrets and variables` -> `Actions`

`Repository secrets` 생성:
1. `PORTAL_USERNAME`: 제주대 포털 아이디
2. `PORTAL_PASSWORD`: 제주대 포털 비밀번호
3. `GOOGLE_SERVICE_ACCOUNT_JSON`: JSON 파일 전체 내용
4. `GOOGLE_CALENDAR_ID`: 캘린더 ID

`Repository variables` 생성:
1. `START_YYYYMMDD` (예: `20260302`)
2. `END_YYYYMMDD` (예: `20260630`)

## 3-5. 첫 실행

1. 저장소 `Actions` 탭
2. 왼쪽 `cron` 워크플로 선택
3. 오른쪽 `Run workflow` 클릭
4. 완료 후 로그에서 동기화 성공 확인
5. Google Calendar에서 일정 생성 확인

## 4. 자동 업데이트 시간

- 워크플로 파일: `.github/workflows/cron.yml`
- cron: `0 1 * * *` (UTC)
- 한국 시간: 매일 오전 10시 (KST)

포털에서 휴강/보강이 변경되면 다음 실행 때 자동 반영됩니다.

## 5. 자주 묻는 질문

### Q1. 내 이메일이랑 client_email이 다른데 정상인가요?

정상입니다. `client_email`은 봇 계정입니다.

### Q2. 기존 설정 다 지우고 다시 해야 하나요?

아니요. 대부분 날짜 변수 2개만 바꾸면 됩니다.

### Q3. 로컬에 Node.js 꼭 설치해야 하나요?

GitHub Actions 자동 모드만 쓰면 필요 없습니다.

### Q4. 예전 방식(`GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`)도 되나요?

됩니다. 하위 호환됩니다.  
하지만 새로 설정할 때는 `GOOGLE_SERVICE_ACCOUNT_JSON` 1개 사용을 권장합니다.
