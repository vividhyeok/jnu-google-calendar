# 📅 제주대학교 시간표 → Google Calendar 자동 동기화

제주대학교 포털 시간표 API를 읽어 Google Calendar에 자동 반영하는 프로젝트입니다.

## 0) 먼저 결론

- 권장 운영 방식: `GitHub Actions` 자동 실행
- 이 방식에서는 로컬 PC에서 프로그램을 계속 켜둘 필요가 없습니다.
- 현재 자동 스케줄: `매일 KST 10:00` (`cron: 0 1 * * *`, UTC 기준)

## 1) 꼭 해야 하는 설정이 최소인지?

네, 현재 구조에서 아래 항목은 사실상 필수입니다.

1. 제주대 포털 계정 2개 값
- `PORTAL_USERNAME`
- `PORTAL_PASSWORD`

2. Google 서비스 계정/캘린더 연결 3개 값
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID`

3. 조회 기간 2개 값
- `START_YYYYMMDD`
- `END_YYYYMMDD`

총 7개입니다. 
이 중 1, 2번은 외부 시스템 인증이라 줄이기 어렵고, 3번(기간)은 학기마다 한 번 변경하면 됩니다.

## 2) 빠른 체크리스트 (자동 모드)

아래 6단계만 끝내면 됩니다.

1. Google Calendar에 동기화 전용 캘린더 생성
2. Google Cloud 프로젝트 생성
3. Google Calendar API 활성화
4. 서비스 계정 생성 + JSON 키 발급
5. 캘린더에 서비스 계정 권한 부여
6. GitHub Actions Secrets/Variables 입력 후 워크플로 실행

---

## 3) 상세 설정 가이드 (버튼 단위)

### 3-1) Google Calendar 동기화 전용 캘린더 만들기

1. 브라우저에서 `https://calendar.google.com` 접속
2. 왼쪽 메뉴에서 `다른 캘린더` 오른쪽 `+` 클릭
3. `새 캘린더 만들기` 클릭
4. 캘린더 이름 입력 (예: `JNU Timetable Sync`)
5. `캘린더 만들기` 클릭
6. 생성 후 왼쪽 메뉴 `내 캘린더 설정`에서 방금 만든 캘린더 클릭
7. 아래로 내려 `캘린더 통합` 섹션에서 `캘린더 ID` 복사
8. 이 값을 나중에 `GOOGLE_CALENDAR_ID`로 사용

참고 링크:
- Google Calendar: https://calendar.google.com

### 3-2) Google Cloud 프로젝트 만들기

1. `https://console.cloud.google.com/projectcreate` 접속
2. `새 프로젝트` 화면에서 프로젝트 이름 입력 (예: `jnu-calendar-sync`)
3. `만들기` 클릭
4. 상단 프로젝트 선택기가 방금 만든 프로젝트로 선택됐는지 확인

### 3-3) Google Calendar API 활성화

1. 아래 링크로 이동 (프로젝트 선택 상태에서 열기)
- https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
2. `Google Calendar API` 페이지에서 `사용(Enable)` 버튼 클릭
3. 이미 활성화된 경우 `관리(Manage)`가 보이면 정상

### 3-4) 서비스 계정 만들기 + JSON 키 발급

1. `https://console.cloud.google.com/iam-admin/serviceaccounts` 접속
2. 상단 `서비스 계정 만들기` 클릭
3. `서비스 계정 이름` 입력 (예: `jnu-calendar-bot`)
4. `만들고 계속하기` 클릭
5. 역할 선택 화면은 비워두고 `계속` 클릭
6. `완료` 클릭
7. 생성된 서비스 계정 클릭
8. 상단 탭 `키(Keys)` 클릭
9. `키 추가` -> `새 키 만들기` 클릭
10. `JSON` 선택 후 `만들기` 클릭
11. JSON 파일 다운로드 확인

JSON 파일에서 필요한 값:
- `client_email` -> `GOOGLE_CLIENT_EMAIL`
- `private_key` -> `GOOGLE_PRIVATE_KEY`

### 3-5) 캘린더에 서비스 계정 권한 부여

1. `https://calendar.google.com` 다시 이동
2. 왼쪽에서 동기화용 캘린더 선택 -> `설정 및 공유`
3. `특정 사용자 및 그룹과 공유` 섹션으로 이동
4. `사용자 및 그룹 추가` 클릭
5. 서비스 계정 이메일(`client_email`) 입력
6. 권한을 `변경 및 공유 관리`로 선택
7. `전송` 또는 `저장`

주의:
- 이 권한이 없으면 이벤트 생성/수정이 실패합니다.

### 3-6) GitHub 저장소 설정

#### A. 저장소 준비

1. 이 저장소를 본인 계정으로 `Fork`하거나 본인 저장소로 Push
2. GitHub 저장소 페이지로 이동

#### B. Secrets 입력

1. 저장소 상단 `Settings` 클릭
2. 왼쪽 메뉴 `Secrets and variables` -> `Actions` 클릭
3. `Repository secrets` 영역에서 `New repository secret` 클릭
4. 아래 항목을 각각 추가

- `PORTAL_USERNAME` = 제주대 포털 아이디
- `PORTAL_PASSWORD` = 제주대 포털 비밀번호
- `GOOGLE_CLIENT_EMAIL` = JSON의 `client_email`
- `GOOGLE_PRIVATE_KEY` = JSON의 `private_key` 값 전체
- `GOOGLE_CALENDAR_ID` = 3-1에서 복사한 캘린더 ID

팁:
- `GOOGLE_PRIVATE_KEY`는 JSON 원본의 `\n`이 포함된 문자열 그대로 붙여넣어도 됩니다.

#### C. Variables 입력

1. 같은 화면에서 `Repository variables` 영역의 `New repository variable` 클릭
2. 아래 항목 추가

- `START_YYYYMMDD` = 예: `20250901`
- `END_YYYYMMDD` = 예: `20251231`

학기 바뀔 때 보통 이 2개만 바꾸면 됩니다.

참고 링크:
- GitHub Secrets: https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions
- GitHub Variables: https://docs.github.com/en/actions/learn-github-actions/variables

### 3-7) 자동 워크플로 실행 및 확인

1. 저장소 상단 `Actions` 탭 클릭
2. 좌측 워크플로 목록에서 `cron` 클릭
3. 우측 `Run workflow` 클릭
4. 브랜치 `main` 선택 후 `Run workflow` 버튼 클릭
5. 실행이 끝나면 로그에서 `Google Calendar synced` 메시지 확인

성공 확인:
1. `https://calendar.google.com` 접속
2. 동기화 대상 캘린더 표시 ON
3. `START_YYYYMMDD ~ END_YYYYMMDD` 범위에 수업 일정 생성 확인

---

## 4) 자동 업데이트 방식

- GitHub Actions가 매일 정해진 시간에 실행됩니다.
- 실행 시마다 포털 API 최신 상태를 다시 읽어 캘린더를 갱신합니다.
- 휴강/보강 변경은 포털 데이터에 반영된 다음 실행에서 자동 반영됩니다.

워크플로 파일:
- `.github/workflows/cron.yml`

---

## 5) 자주 막히는 지점

1. 일정이 생성되지 않음
- 서비스 계정이 캘린더에 `변경 및 공유 관리` 권한인지 확인
- `GOOGLE_CALENDAR_ID`가 맞는 캘린더 ID인지 확인

2. 포털 로그인 실패
- `PORTAL_USERNAME`, `PORTAL_PASSWORD` 오타 확인

3. 일부 기간만 보임
- `START_YYYYMMDD`, `END_YYYYMMDD` 값 확인
- 학기 변경 시 두 변수 업데이트 필요

4. 워크플로가 실행 안 됨
- 저장소 `Actions` 활성화 여부 확인

---

## 6) 로컬 실행은 언제 필요한가? (선택)

- GitHub Actions를 못 쓰는 환경에서만 사용
- 평소 자동 운영에는 필요 없음

로컬 실행이 필요한 경우에만:

```powershell
npm install
Copy-Item .env.example .env.local
npm run sync
```

---

## 7) 추가 개선 여지 (설정 더 줄이기)

현재도 필수 항목 위주지만, 더 줄일 여지는 있습니다.

1. `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`를
하나의 `GOOGLE_SERVICE_ACCOUNT_JSON` Secret으로 합치기

2. 학기 기간(`START_YYYYMMDD`, `END_YYYYMMDD`)을
워크플로 입력값 또는 자동 계산으로 단순화

원하면 다음 단계로 이 2개도 코드에 바로 반영해 드릴 수 있습니다.
