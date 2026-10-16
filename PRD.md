# PRD: AEGIS-4 (Autonomous Exploit Verification, Binary Hot-Patch & Route-Shield Platform)

- **Track**: Track 4 — Open Innovation (Autonomous Agents & Developer Tools)
- **Lead Model**: `gemini-4-argon` (1M Context Window, `thinking_level="high"` / `"medium"`)
- **Companion Models & Agents**:
  - `antigravity-preview-09-2026` (Managed Linux Sandbox for isolated reproduction, binary analysis & patch verification)
  - `gemini-3.8-flash` (Parallel file/endpoint reconnaissance & fast static triage)
  - `gemini-3.5-flash-lite` (Target classification, CI/CD artifact detection & edge-proxy rule routing)
- **Deployment Target**: Google Cloud Run (Web Dashboard + Orchestrator API + Live Route-Shield Proxy)

---

## 1. 제품 개요 (Product Vision)

**AEGIS-4**는 소스코드 유무나 배포 형태(웹/API/설치형 바이너리)에 구애받지 않고, **취약점 탐색 → 샌드박스 실증(Red) → 자율 패치 및 방어막 생성 → 재검증(Green)**까지 단일 루프로 완수하는 **자율형 자가치유(Self-Healing) 보안 플랫폼 및 SDK**다.

1. **White-Box (GitHub App & CI/CD 연동)**: 레포지토리의 CD 파이프라인을 분석해 배포 형태(웹/API vs 설치형 바이너리)를 자동 판별하고, 코드 리뷰 + 실증 테스트 후 **전용 패치 브랜치 생성 및 GitHub PR + 상세 리포트 코멘트**를 자동으로 올린다.
2. **Black-Box / No-Code (단독 URL 또는 바이너리 파일 입력)**: 소스코드가 없거나 비공개여도 **DNS TXT 레코드로 소유권이 인증된 웹/API 링크**나 **빌드된 바이너리 파일**만으로 프로젝트를 생성해 진단하고, **바이너리 직접 하드패치(Binary Hot-Patch)** 또는 **웹/API 라우트 실시간 보호막(Virtual Patching / Edge Route Shield)**을 즉시 생성·적용한다.

---

## 2. 핵심 사용자 흐름 (End-to-End User Flows)

### Flow A: GitHub 커넥터 & CD 기반 자율 패치 파이프라인 (Source-Available)
1. **GitHub App 연결**: 사용자가 GitHub 레포지토리를 연결하거나 Webhook/CD 스크립트를 등록.
2. **CD 파이프라인 & 타깃 자동 감지 (`gemini-3.5-flash-lite`)**:
   - `.github/workflows`, `Dockerfile`, `package.json`, `CMakeLists.txt`,
   - `Makefile` 등을 스캔해 **웹 서비스 / API 서버 / 설치형 바이너리(Desktop·Native)** 여부를 자동 판별.
      - CD에 연결된 스테이징 배포 URL이 있으면 **라이브 엔드포인트 동적 진단**, 빌드 아티팩트(설치파일/ELF/PE)가 있으면 **바이너리 리버싱 분석**을 코드 리뷰와 병행.
   3. **하이브리드 탐색 & 샌드박스 실증 (`gemini-4-argon` + `antigravity-preview-09-2026`)**:
      - `gemini-4-argon`이 1M 컨텍스트에 전체 코드베이스와 배포 스펙을 적재해 취약 경로를 추적.
      - 격리 샌드박스에서 재현 테스트(PoC 검증 스크립트)를 실행해 실제 취약점이 트리거되는지 확인 (`RED: VULNERABILITY CONFIRMED`).
   4. **자율 소스 패치 & 회귀 검증**:
      - `gemini-4-argon`이 최소 변경 보안 패치를 작성.
      - 샌드박스에서 재현 스크립트(차단 확인) + 기존 테스트 스위트(정상 동작 확인)를 통과할 때까지 루프 실행 (`GREEN: PATCH VERIFIED`).
   5. **자동 브랜치 푸시 & GitHub PR + 코멘트 발송**:
      - `aegis/fix-<vuln-id>` 브랜치를 생성해 커밋·푸시 후 자동으로 PR 오픈.
      - PR 본문 및 코멘트에 **취약점 원인, 공격 재현 로그(Before/After), 패치 인사이트**를 마크다운 리포트로 자동 등록.
   
   ### Flow B: GitHub 없는 독립 프로젝트 (URL / 바이너리 업로드 & 코드 비공개 방어)
   1. **단독 프로젝트 생성 & 도메인 소유권 인증 (No-GitHub Mode + DNS Ownership Gate)**:
      - **링크 입력 모드 (DNS TXT 본인 소유 인증 필수)**: 배포된 웹 서비스 URL 또는 API 서버 엔드포인트를 입력하면, 타인/외부 서비스 무단 스캔 방지를 위해 프로젝트 고유 검증 토큰(`_aegis-verify.<domain>` TXT 레코드 `aegis-verify=<token>`)을 발급하고 실시간 DNS 조회(Google DoH / `dnspython`)로 **도메인 소유권이 검증된 타깃만** 동적 펜테스팅을 허용.
      - **파일 업로드 모드**: 설치파일이나 컴파일된 실행 바이너리(ELF, PE, Mach-O, APK 등) 업로드 (격리 샌드박스 내부에서만 실행되므로 즉시 분석).
   2. **논코드(No-Code) 동적 진단 & 바이너리 리버싱**:
      - **웹/API**: 라우트 크롤링, 인증/인가 경계 테스트, 입력 검증 및 스키마 퍼징 수행.
      - **설치형 바이너리**: 샌드박스 내에서 심볼·스트링·디스어셈블리/디컴파일 제어 흐름(CFG)·메모리 보호 기법(NX/PIE/Canary) 및 위험 함수 호출 지점 정밀 분석.
   3. **소스 비공개 상태의 즉시 방어 (No-Source Remediation)**:
      - **[설치형 바이너리 → Binary Hard-Patch]**: 소스코드 없이 바이너리 명령어/상수 테이블/경계 체크 루틴을 직접 바이너리 패치(분기 조건 교정, 길이 제한 바이트 패치 또는 보안 래퍼 주입)하여 **패치된 실행 파일 아티팩트**와 바이트 Diff를 바로 다운로드 제공.
      - **[웹 서비스 / API 서버 → Route & API Shield (Virtual Patching)]**: 원본 서버 코드를 건드리지 않고 앞단에서 즉시 공격 페이로드를 차단하는 **리버스 프록시 미들웨어 / Cloud Armor / Cloudflare Worker / Envoy 필터 룰**을 자동 생성하고, 대시보드 내 **1-Click Route Shield 게이트웨이**를 켜서 해당 라우트 공격이 즉시 `403 Blocked by AEGIS Shield`로 막히는 것을 실시간 입증.
   
   ---
   
   ## 3. 기능 요구사항 (Functional Requirements)
4. ### FR-1. 프로젝트 인테이크, DNS 소유권 인증 & 타깃 자동 분류기
- **입력 소스 3종 지원**:
  1. `GitHub Repository 연동` (OAuth / GitHub App / PAT + CD 설정 파일 파싱)
  2. `Target URL 입력 + DNS TXT 소유권 인증` (`_aegis-verify.<domain>` TXT 레코드 검증 통과 시에만 능동 스캔 활성화)
  3. `Binary Artifact 업로드` (컴파일된 바이너리 및 설치 패키지)
- **CD & 아티팩트 기반 자동 프로파일링**:
  - 레포 내 빌드/배포 구성을 읽고 `Web App`, `API Server`, `Native Binary`, `Hybrid`로 자동 태깅 후 알맞은 진단 파이프라인(SAST + DAST vs SAST + Binary Reversing)을 자동 배정.

### FR-2. 멀티모드 취약점 탐색 & 검증 엔진 (Discovery & Verification Loop)
- **코드 리뷰 탐색 (White-Box)**: `gemini-4-argon` 1M 컨텍스트 기반 파일 간 데이터 흐름(Taint Flow) 및 비즈니스 로직 취약점 추적.
- **논코드 웹/API 펜테스팅 (Black-Box DAST)**: 라우트 맵핑, 파라미터 변조 시뮬레이션, 인증 우회 및 인젝션 경계 검증.
- **바이너리 리버싱 탐색 (Binary Analysis)**: `objdump`/`radare2`/`readelf` 및 정적 디스어셈블리 분석을 통해 버퍼 오버플로우, 포맷 스트링, 하드코딩 시크릿, 명령어 인젝션 싱크 식별.
- **Zero-False-Positive 검증 루프**: 모든 후보 취약점은 샌드박스에서 재현 테스트를 통과해 실제 입증된 건만 확정 리포트로 승격.

### FR-3. 3대 자가치유 엔진 (Tri-Mode Remediation Engine)
- **모드 1 — Git 브랜치 & PR 패치 (코드 보유 시)**:
  - 소스코드 자동 패치 → 샌드박스 재검증 → 새 브랜치 푸시 → GitHub PR 생성 및 상세 코멘트 리포트 전송.
- **모드 2 — 바이너리 하드패치 (코드 비공개 설치형)**:
  - 취약 오프셋(Offset) 식별 → 어셈블리/바이트 수준 하드패치 적용 → 패치 전후 바이너리 해시·바이트 Diff 및 샌드박스 방어 검증 로그 생성 → 패치된 바이너리 다운로드.
- **모드 3 — 웹 라우트 & API 보호막 (코드 비공개 웹/API)**:
  - 취약 라우트 전용 정규식/스키마/레이트리밋/헤더 검증 필터 생성 → 실시간 리버스 프록시(Edge Shield) 룰 즉시 활성화 및 NGINX/Cloudflare/Cloud Run 미들웨어 스니펫 내보내기.

### FR-4. 인앱 통합 대시보드 & 패치 인사이트 뷰 (In-App Dashboard)
- **프로젝트 오버뷰**: 타깃 유형 배지(`Web` / `API` / `Binary`), 도메인 DNS 인증 상태(`Verified`), 탐지된 취약점 수, 심각도(Critical~Low), 현재 방어 상태(`Patched via PR` / `Protected via Route Shield` / `Binary Hard-Patched`).
- **실시간 검증 타임라인**: `Recon` → `PoC Reproduction (RED)` → `Remediation Synthesis` → `Verification (GREEN)` 단계별 라이브 로그.
- **패치 인사이트 탭**:
  - 취약점 발생 원인과 공격 벡터 설명
  - Side-by-Side 코드 Diff / 바이너리 Hex·Disassembly Diff / API 라우트 보호 룰 뷰어
  - GitHub PR 바로가기 링크 및 코멘트 미리보기

---

## 4. 해커톤 심사 기준 매핑 (Judging Rubric Alignment)

- **Why Gemini 4 Argon (`gemini-4-argon`)**:
- - 1M 통합 컨텍스트로 전체 레포지토리 + CD 파이프라인 + 바이너리 디스어셈블리 덤프를 한 번에 읽고, `thinking_level="high"`로 정밀한 소스 패치·바이너리 오프셋 패치·라우트 방어 규칙을 합성.
- **Verification Loop (`antigravity-preview-09-2026` / Isolated Runner)**:
  - 단순 텍스트 조언이 아니라 실제 재현(Red) 후 패치/보호막 적용 뒤 재공격 차단(Green)까지 자율 검증 루프로 증명.
- **Safety & Human-in-the-Loop Control**:
  - 외부 URL 진단 시 **DNS TXT 레코드 소유권 인증**을 강제해 무단 스캔을 원천 차단하고, 프로덕션 브랜치를 직접 덮어쓰지 않고 별도 PR + 리포트 코멘트 또는 토글형 라우트 보호막으로 안전한 통제권 보장.
- **3-Minute Live Demo**:
  - 1분: GitHub 레포 연결 → 웹/바이너리 감지 → 취약점 실증 후 자동 브랜치/PR + 리포트 코멘트 생성 시연.
  - 1분: DNS TXT 소유권 인증 통과한 외부 API 링크 + 소스 없는 바이너리 파일 투입 → **실시간 API 라우트 보호막(Route Shield) ON** 및 **바이너리 하드패치 파일 생성** 후 재공격 차단(Green) 시연.


DOCS LINK : https://docs.google.com/document/d/13hG3aETJ54oKULF3JZUgM5VYHv7o2ZM4a4AZeqinbRg/edit?tab=t.buqd8v5hdzxz
