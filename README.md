# 📅 제주대학교 시간표 → Google Calendar 자동 동기화 서버

제주대학교 포털에서 강의 시간표를 가져와 Google Calendar에 동기화하는 개인용 스케줄러입니다.

> **출처:**
> 기반 프로젝트 — [https://github.com/mu-hun/jejunu-icalendar-server](https://github.com/mu-hun/jejunu-icalendar-server)

---

# 1. Google Calendar 및 서비스 계정 설정

## 1-1. 동기화용 Google Calendar 생성

1. [https://calendar.google.com](https://calendar.google.com) 접속
2. 왼쪽 **기타 캘린더 → + → 새 캘린더 만들기**
3. 캘린더 생성 후 **설정 및 공유**에서 **캘린더 ID 복사**

   * 예: `abc123@group.calendar.google.com`

---

## 1-2. Google Cloud 서비스 계정 생성

1. [https://console.cloud.google.com](https://console.cloud.google.com)
2. 프로젝트 생성
3. **APIs & Services → Library → Google Calendar API 활성화**
4. **IAM & Admin → Service Accounts → 서비스 계정 생성**
5. 서비스 계정 → **Keys → Add Key → JSON**
6. JSON 파일에서 다음 값 사용

   * `client_email` → `GOOGLE_CLIENT_EMAIL`
   * `private_key` → `GOOGLE_PRIVATE_KEY`

---

## 1-3. 서비스 계정을 Google Calendar에 권한 부여

1. 생성한 캘린더의 설정 페이지 이동
2. **특정 사용자와 공유**에서 서비스 계정 이메일 추가
3. 권한: **변경 및 공유 관리(Manage changes and sharing)**

---

# 2. GitHub 저장소 설정

## 2-1. 저장소 복사

1. 이 저장소를 **Fork**하거나 GitHub에 직접 Push

---

## 2-2. GitHub Actions 환경 변수 설정

GitHub 저장소 →
**Settings → Secrets and variables → Actions**

### Repository secrets

| 이름                    | 값                     |
| --------------------- | --------------------- |
| `PORTAL_USERNAME`     | 제주대 포털 아이디            |
| `PORTAL_PASSWORD`     | 제주대 포털 비밀번호           |
| `GOOGLE_CLIENT_EMAIL` | 서비스 계정 client_email   |
| `GOOGLE_PRIVATE_KEY`  | 서비스 계정 private_key 전체 |
| `GOOGLE_CALENDAR_ID`  | 캘린더 ID                |

### Repository variables

| 이름               | 값                      |
| ---------------- | ---------------------- |
| `START_YYYYMMDD` | 학기 시작일 (예: `20240902`) |
| `END_YYYYMMDD`   | 학기 종료일 (예: `20241221`) |

---

# 3. GitHub Actions 실행

1. GitHub 저장소 상단 **Actions** 탭 이동
2. 비활성화된 경우 **Enable Actions**
3. 왼쪽에서 **cron** 워크플로 선택
4. 오른쪽 상단 **Run workflow → main** 실행
5. 실행 로그에서 동기화 성공 여부 확인

---

# 4. Google Calendar 확인

1. [https://calendar.google.com](https://calendar.google.com)
2. 동기화용 캘린더 표시 활성화
3. 지정한 학기 기간에 일정이 생성되었는지 확인

---

# 5. 갤럭시 기기 연동 (선택)

1. 갤럭시 스마트폰 → **설정 → 계정 및 백업 → 계정 관리**
2. 동일 Google 계정 로그인
3. Samsung Calendar 앱 → **캘린더 관리**에서 동기화 캘린더 활성화
