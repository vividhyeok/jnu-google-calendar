# update.md

## 2026-03-02 변경 내역

### 0. 설정 단순화 (추가)

- `GOOGLE_SERVICE_ACCOUNT_JSON` 단일 secret 지원 추가
- 이제 `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`를 따로 넣지 않아도 동작
- 기존 분리 방식은 하위 호환으로 유지
- README를 "내 이메일 vs client_email 차이" 중심으로 재작성

### 1. 실행/설정 편의성 개선

- `npm run sync`(1회 실행) 스크립트 추가
- `npm run start` 반복 실행 스크립트 유지
- `.env.example` 추가로 초기 설정 복사 방식 제공
- `.env.local` 우선 로딩 + 기본 `.env` 로딩 지원
- `PORTAL_USERNAME`, `PORTAL_PASSWORD` 정식 지원
- 기존 `username`, `password`는 하위 호환 유지

### 2. 설정 검증 강화

- `START_YYYYMMDD`, `END_YYYYMMDD` 포맷 검증 추가
- 유효하지 않은 달/일 입력 시 즉시 에러 처리
- 시작일 > 종료일인 경우 즉시 에러 처리
- 누락 변수 에러 메시지에 허용 키 목록 표시

### 3. 포털 조회 안정성 개선

- 포털 로그인 시 입력 필드 대기 추가
- 로그인 후 URL 재검증으로 로그인 실패 조기 감지
- 시간표 응답이 JSON이 아닌 경우 명확한 에러 출력
- 네트워크/타임아웃/5xx 계열 오류에 자동 재시도 적용

### 4. Google Calendar 동기화 안정성 개선

- Google API 요청 공통 재시도 로직 추가
- 429 및 5xx 오류 자동 재시도
- 동기화 시 이벤트 삭제 범위를 이벤트 목록 기반이 아닌 학기 기간 기반으로 통일
- 포털 결과가 비어도 기존 학기 범위 이벤트 정리 가능

### 5. 변환 로직 정확성 개선

- 연강 병합 조건 보강
- 동일 과목/동일 일자라도 시간 간격이 큰 수업은 병합하지 않도록 수정
- 강사/강의실이 다른 경우 병합 방지
- 추가 테스트 케이스 반영

### 6. CI/CD 및 운영 환경 정리

- GitHub Actions 런너 `macos-latest` → `ubuntu-latest`
- cron 스케줄 `MON-FRI` → 매일 실행으로 변경
- Actions 환경변수 이름을 `PORTAL_USERNAME/PASSWORD`로 통일

### 7. 정리된 파일

- 삭제: `src/aws.ts` (미사용)
- 추가: `src/retry.ts`, `.env.example`
- 문서 갱신: `README.md`

### 8. 테스트 상태

- `vitest` 기준 전체 테스트 통과 (`11 passed`)
