# 🚀 스벨트킷 블로그 엔진 (SvelteKit Blog Engine)

🌐 **[English](./README.md) | [日本語](./README.ja.md)**

Cloudflare Pages, D1, KV 및 SvelteKit을 사용하여 구축한 초고속 오픈소스 블로그 및 어드민 관리 시스템입니다. 본 프로젝트는 **GNU Affero General Public License v3.0 (AGPL-3.0)** 라이선스 하에 배포됩니다.

> 💡 **본 리포지토리의 코드로 직접 배포해 운영 중인 공식 웹사이트 [sveltekitblog.com](https://sveltekitblog.com)에서 상세한 배포 방법, 가이드 매뉴얼 및 실제 작동하는 라이브 데모를 확인하실 수 있습니다!**
>
> * **비용 제로(Zero Cost) 구축:** 본 블로그는 도메인 구입 비용을 제외한 모든 인프라(Cloudflare Pages, D1 SQL Database, KV)를 **클라우드플레어의 무료 요금제(Free Tier)**만 사용하여 서버 유지 비용이 일절 없는 0원으로 구현되었습니다.
> * **마케팅 및 수익화 연동:** 현재 데모 블로그에는 **Google Search Console(구글 서치)** 등록 및 **Google Analytics 4(GA4)** 연동이 완료되어 어드민에서 실시간으로 지표가 추적 중이며, **Google AdSense(애드센스)** 광고 게재 승인 신청이 진행 중입니다.
> * **프로젝트 후원:** 이 오픈소스 프로젝트가 도움이 되셨다면 [Buy Me a Coffee](https://buymeacoffee.com/sveltekitblogengine)를 통해 개발자를 응원하고 후원해 주실 수 있습니다!

> ⚠️ **중요:** D1 데이터베이스의 특성상 로컬 환경에서 로컬 데이터베이스만을 별도로 완벽하게 구동하여 테스트하는 것은 권장되지 않으며, 실제 클라우드플레어(Cloudflare) 플랫폼 상에 리소스를 배포하여 연동하는 방식으로 구동됩니다. 따라서 본 가이드는 **실제 클라우드플레어 원격 환경에 리소스를 생성하고 빌드/배포하는 과정**을 중심으로 설명합니다.

---

## 📋 목차
1. [프로젝트 소개](#-프로젝트-소개)
2. [의존성 설치](#-의존성-설정)
3. [Cloudflare 인프라 생성 및 초도 배포 (npm run setup)](#-cloudflare-인프라-생성-및-초도-배포-npm-run-setup)
4. [환경변수 및 비밀값 자동 동기화 (.dev.vars)](#-환경변수-및-비밀값-자동-동기화-devvars)
5. [개별 빌드 및 배포 명령어](#-개별-빌드-및-배포-명령어)
6. [라이선스](#-라이선스)

---

## 🔍 프로젝트 소개

[![실시간 디자인 에디터 데모 (유튜브 풀영상 보기)](./GIFs/design_editor.gif)](https://www.youtube.com/watch?v=XOza3hgiNQw)
*💡 위 이미지를 클릭하면 유튜브에서 실제 작동하는 전체 기능 데모 영상을 확인하실 수 있습니다.*

이 프로젝트는 단일 Git 리포지토리 내에서 블로그 프론트엔드와 어드민 대시보드를 관리할 수 있는 모노레포 구조로 구성되어 있으며, 실제 클라우드플레어의 에지 서비스들과 결합하여 동작합니다.

- **apps/blog**: 누구나 방문하여 글을 읽을수 있고 소셜 로그인, 또는 이메일로 가입하여 댓글/방명록을 작성할 수 있는 블로그 프론트엔드 (SvelteKit)
- **apps/admin**: 게시글 작성, GA4 통계 및 애드센스 조회, 레이아웃/디자인 변경을 담당하는 어드민 대시보드 (SvelteKit)
- **packages/shared**: Drizzle ORM 스키마, 데이터베이스 구조 정의, 유틸리티, 다국어(i18n) 설정 등이 포함된 공유 패키지

---

## 🛠️ 의존성 설치

루트 디렉토리에서 아래 명령어를 실행하여 모노레포 내의 전체 의존성을 링크 및 설치합니다:
```bash
npm install
npm audit fix
```

---

## ☁️ Cloudflare 인프라 생성 및 초도 배포 (npm run setup)

[![npm run setup 실행 데모 (유튜브 풀영상 보기)](./GIFs/npm_run_setup.gif)](https://www.youtube.com/watch?v=eJvG-4fZGsA)
*💡 위 이미지를 클릭하면 전체 자동 인프라 셋업 및 배포가 진행되는 과정의 무편집 유튜브 영상을 보실 수 있습니다.*

이 프로젝트는 클라우드플레어의 D1(SQL DB) 및 KV(키-값 저장소)를 데이터 공간으로 사용합니다. 첫 가동 시 아래의 원클릭 셋업 스크립트를 사용하여 **실제 클라우드플레어 원격 플랫폼 상에 리소스를 자동으로 구축하고 초도 배포를 완료**합니다.

> **Tip:** 기존 인프라 데이터를 날리지 않고 설정 정보(wrangler.backup.json 등)만 백업에서 안전하게 복구하여 재배포하고 싶다면 `npm run restore` 명령어를 사용해 복구 모드로 실행하십시오.

```bash
# 기본 모드 (기본 언어 선택 후 빌드/배포까지 풀 자동 원스톱 실행)
npm run setup

# 직접 선택 모드 (배포 이름, 리소스 이름 등을 하나하나 직접 선택해 커스텀 실행)
npm run setup:select
```

### ⚙️ `npm run setup` 실행 시 진행되는 작업:
1. **진입 설정 선택:** 스크립트 실행 즉시 기본 블로그 언어(ko/en/ja)를 지정한 뒤, 나머지 셋업 과정을 **풀 자동**으로 처리할 것인지 **사용자 직접 선택**으로 처리할 것인지 결정합니다.
2. **Cloudflare 계정 인증:** Wrangler CLI를 통해 클라우드플레어 계정에 로그인합니다 (`wrangler login`). 로그인 상태가 이미 활성화되어 있으면 자동으로 건너뜁니다.
3. **인프라 자동 생성:** 원격 클라우드플레어에 D1 데이터베이스(`blog-db-*`, `user-db-*`)와 KV 네임스페이스(`blog-images-kv-*`)를 셋업합니다. (자동 모드 시에는 기본 리소스명으로 즉시 생성됩니다.)
4. **원격 마이그레이션 실행:** 생성된 D1 데이터베이스에 테이블 스키마를 구성하고, 지정된 기본 언어에 따른 초기 시드(Seed) 데이터를 직접 주입합니다. (자동 셋업 시에는 최초 설치로 자동 인식하여 다국어 사전 질문 대기가 자동 스킵됩니다.)
5. **보안 환경변수 및 초도 배포:** 로컬의 `.dev.vars` 내 비밀값들을 Pages Secret으로 자동 전송한 후, 앱을 빌드하여 Cloudflare Pages에 최종 배포합니다. (프로젝트를 배포 전에 미리 사전 생성하여 비밀값을 주입하므로, 첫 배포와 동시에 모든 환경변수가 누락 없이 정상 적용됩니다.)

---

## 🔐 환경변수 및 비밀값 자동 동기화 (.dev.vars)

애플리케이션 구동에 필요한 비밀키(OAuth 키, API 계정 정보 등)는 각 앱의 `.dev.vars.example` 파일에 템플릿 형태로 제공됩니다. **실제 보안 키가 들어가는 `.dev.vars` 파일은 Git 추적에서 제외되어 있습니다. 따라서 배포 전 반드시 각 앱 폴더에서 `.dev.vars.example` 파일을 복사하여 `.dev.vars` 파일을 생성하고 적절한 비밀값을 기입해야 합니다.**

### ⚙️ 설정 방법:
1. `apps/blog/.dev.vars.example`을 복사하여 `apps/blog/.dev.vars` 파일을 만듭니다.
2. `apps/admin/.dev.vars.example`을 복사하여 `apps/admin/.dev.vars` 파일을 만듭니다.
3. 생성한 `.dev.vars` 파일을 열고 아래의 **필수 입력 키**와 **선택 입력 키** 가이드를 참조하여 값을 설정합니다.

> 💡 **비밀 환경변수 동기화 방식:**
> `npm run setup` 스크립트는 배포 전에 클라우드플레어에 Pages 프로젝트를 미리 원격 생성하므로, 최초 셋업 실행 시에도 `.dev.vars` 내 비밀값들이 원격 Pages Secret으로 누락 없이 자동 주입 및 동기화됩니다. 이후 소스 코드나 비밀값 수정이 필요할 때는 개별 배포 명령어(`npm run deploy:blog` 등)를 구동하여 다시 업로드할 수 있습니다.

---

### 1. `apps/blog/.dev.vars` (블로그 OAuth 및 로그인 인증 비밀값)

* 🔴 **필수 입력 키 (Must-have Key)**:
  * `BETTER_AUTH_SECRET`: 세션 토큰 및 쿠키 암호화용 무작위 비밀값 (최소 32자 권장). 이 값이 없으면 사용자 인증 기능 전체가 작동하지 않습니다.
* 🟢 **더미 입력 가능 키 (Dummy Allowed Keys)**:
  * `GITHUB_*`, `GOOGLE_*`: 소셜 로그인 인증 연동 키. 이메일/비밀번호 가입 로그인 방식만 사용하고 소셜 로그인을 사용하지 않을 경우, 더미값(`dummy_*`) 상태로 그대로 두어도 블로그 구동에 아무런 문제가 없습니다.

```text
# [필수] 암호화 및 서명용 비밀키
BETTER_AUTH_SECRET=여러분의_무작위_비밀_문자열_입력 (최소 32자 권장)

# [선택] 소셜 로그인 연동 (사용하지 않을 시 더미값 유지 가능)
GITHUB_CLIENT_ID=dummy_github_id
GITHUB_CLIENT_SECRET=dummy_github_secret
GOOGLE_CLIENT_ID=dummy_google_id
GOOGLE_CLIENT_SECRET=dummy_google_secret
```

---

### 2. `apps/admin/.dev.vars` (어드민 접속 및 구글 API 연동 비밀값)

* 🔴 **필수 입력 키 (Must-have Key)**:
  * `ADMIN_PASSWORD`: 관리자 대시보드 로그인 시 사용할 비밀번호. 더미값 상태로 두면 어드민 대시보드 보안에 심각한 위협이 되므로 반드시 실제 사용할 고유 비밀번호로 변경하십시오.
* 🟢 **더미 입력 가능 키 (Dummy Allowed Keys)**:
  * `GA4_*` (GA 통계 연동), `ADSENSE_*` (애드센스 연동): 해당 연동 기능을 사용하지 않거나 아직 계정이 생성되지 않은 상태라면, 더미값(`dummy_*`) 상태를 그대로 유지하고 배포해도 어드민 대시보드 컴파일 및 기본 가동에는 전혀 지장이 없습니다. (해당 위젯 데이터만 비어서 출력됩니다.)

> 💡 **GA4_PRIVATE_KEY**의 경우 반드시 예시와 같이 큰따옴표(`"`) 내부에 개행 문자(`\n`)가 포함된 전체 프라이빗 키 문자열 형태로 작성해 주셔야 합니다.

```text
# [필수] 어드민 대시보드 로그인 비밀번호
ADMIN_PASSWORD=여러분의_실제_어드민_접속_비밀번호

# [선택] GA4 통계 대시보드 연동 (사용하지 않을 시 더미값 유지 가능)
GA4_PROPERTY_ID=dummy_ga4_property_id
GA4_CLIENT_EMAIL=dummy-email@iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ndummy_private_key_string\n-----END PRIVATE KEY-----\n"

# [선택] 구글 애드센스 연동 (사용하지 않을 시 더미값 유지 가능)
ADSENSE_ACCOUNT_ID=accounts/pub-dummy
ADSENSE_CLIENT_ID=dummy_adsense_client_id.apps.googleusercontent.com
ADSENSE_CLIENT_SECRET=dummy_adsense_secret
ADSENSE_REFRESH_TOKEN=dummy_refresh_token
```

### 🔒 어드민 접속 IP 제한 (`ALLOWED_IP`) 자동 처리
* 보안 유지를 위한 어드민 접속 허용 IP 제어 설정(`ALLOWED_IP`)은 대시보드에 직접 입력하거나 파일을 수정할 필요가 없습니다.
* 배포 스크립트 실행 과정에서 `sync-secrets.js` 파일이 **사용자의 현재 공인 IP 주소를 자동으로 감지**하여 `apps/admin/.dev.vars`에 동적으로 갱신해 주며, 이 정보 역시 Cloudflare Pages Secret으로 자동 주입됩니다.
* 이후 배포한 IP 주소 이외의 다른 IP로는 admin페이지로 접근 자체가 불가능합니다. IP 주소가 변경된 경우 DB를 유지하는 형태로 재배포를 하거나 DB에서 직접 IP를 수정해야 접속이 가능해집니다.

---

## 🚀 개별 빌드 및 배포 명령어

초기 `setup`을 통해 리소스 생성이 완료된 후, 코드가 수정되거나 비밀키가 변경되어 개별적으로 프로젝트를 다시 배포할 때는 아래 명령어를 사용합니다. (해당 명령어 실행 시 자동으로 로컬 비밀값이 원격 Pages Secret에 동기화된 후 빌드 및 업로드가 완료됩니다.)

* **블로그(Blog) 서비스 배포:**
  ```bash
  npm run deploy:blog
  ```
* **어드민(Admin) 대시보드 배포:**
  ```bash
  npm run deploy:admin
  ```

---

## 📄 라이선스

이 프로젝트는 **GNU Affero General Public License v3.0 (AGPL-3.0)** 라이선스에 따라 오픈소스로 배포됩니다. 자세한 내용은 루트의 [LICENSE](LICENSE) 파일을 참조하십시오.
AGPL-3.0 조건에 따라 본 소프트웨어를 수정하거나 네트워크를 통해 서비스로 제공하는 경우, 해당 수정 버전에 대한 전체 소스 코드를 사용자에게 무상으로 공개해야 합니다.

---

## ☕ 후원 및 지원 (Support)

본 프로젝트는 AGPL-3.0 라이선스를 따르는 오픈소스 프로젝트이며 무료로 관리되고 있습니다. 이 프로젝트가 유익하셨거나 지속적인 발전을 지지하고 싶으시다면 아래 버튼을 통해 따뜻한 커피 한 잔을 후원하실 수 있습니다. 감사합니다!

<a href="https://buymeacoffee.com/sveltekitblogengine" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>
