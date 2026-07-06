# 🚀 SvelteKit Blog Engine

🌐 **[한국어](./README.kr.md) | [English](./README.md)**

Cloudflare Pages、D1、KV、および SvelteKit を使用して構築された、超高速なオープンソースのブログ＆管理者用ダッシュボードシステムです。本プロジェクトは、**GNU Affero General Public License v3.0 (AGPL-3.0)** ライセンスのもとで配布されています。

> 💡 **本リポジトリのコードで直接デプロイされ運営されている公式ウェブサイト [sveltekitblog.com](https://sveltekitblog.com) で、詳細なデプロイ方法、ガイドマニュアル、および実際に稼働するライブデモをご確認いただけます！**
>
> * **インフラ費用ゼロ（Zero Cost）の構築:** ドメイン取得費用を除き、すべてのインフラ（Cloudflare Pages、D1 SQL Database、KV）は **Cloudflareの無料枠（Free Tier）** のみを使用しているため、サーバーの維持・運用コストは一切かかりません（0円）。
> * **マーケティングおよび収益化の連携:** 現在、デモブログには **Google Search Console** の登録と **Google Analytics 4（GA4）** の連携が完了しており、管理者ダッシュボードからリアルタイムで指標を追跡できます。また、**Google AdSense（アドセンス）** の広告掲載承認の申請も進行中です。

> ⚠️ **重要：** Cloudflare D1 データベースの特性上、ローカル環境のみでデータベースを完全に稼働させてテストすることは推奨されません。本システムは、実際の Cloudflare プラットフォーム上にリソースをデプロイして連携する形で動作します。そのため、本ガイドは**実際の Cloudflare リモート環境にリソースを作成し、ビルド/デプロイするプロセス**を中心に説明します。

---

## 📋 目次
1. [プロジェクト紹介](#-プロジェクト紹介)
2. [依存関係のインストール](#-依存関係のインストール)
3. [Cloudflare インフラ作成および初回デプロイ (npm run setup)](#-cloudflare-インフラ作成および初回デプロイ-npm-run-setup)
4. [環境変数およびシークレットの自動同期 (.dev.vars)](#-環境変数およびシークレットの自動同期-devvars)
5. [個別ビルドおよびデプロイコマンド](#-個別ビルドおよびデプロイコマンド)
6. [ライセンス](#-ライセンス)
7. [サポート](#-サポート)

---

## 🔍 プロジェクト紹介

[![リアルタイムデザインエディターデモ (YouTubeでフル動画を見る)](./GIFs/design_editor.gif)](https://www.youtube.com/watch?v=XOza3hgiNQw)
*💡 上記の画像をクリックすると、YouTubeで実際の機能デモ動画（フルバージョン）をご覧いただけます。*

このプロジェクトは、単一の Git リポジトリ内でブログのフロントエンドと管理者ダッシュボードを同時に管理できるモノレポ構造で構成されており、Cloudflare のエッジネイティブサービスと密接に連携して動作します。

- **apps/blog**: 誰でもアクセスして記事を読むことができ、ソーシャルログインまたはメールアドレスで会員登録して、コメントやゲストブック（芳名帳）を投稿できるブログフロントエンド (SvelteKit)
- **apps/admin**: 記事の作成、GA4統計やアドセンスの照会、レイアウトおよびデザインのカスタマイズを行うための管理者ダッシュボード (SvelteKit)
- **packages/shared**: Drizzle ORM スキーマ、データベース構造の定義、共通ユーティリティ、多言語（i18n）設定などが含まれる共有パッケージ

---

## 🛠️ 依存関係のインストール

ルートディレクトリで以下のコマンドを実行し、モノレポ全体の依存関係をリンクしてインストールします：
```bash
npm install
npm audit fix
```

---

## ☁️ Cloudflare インフラ作成および初回デプロイ (npm run setup)

[![npm run setup 実行デモ (YouTubeでフル動画を見る)](./GIFs/npm_run_setup.gif)](https://www.youtube.com/watch?v=eJvG-4fZGsA)
*💡 上記の画像をクリックすると、インフラの自動構築とデプロイの全プロセスの実演動画をご覧いただけます。*

本プロジェクトでは、データの永続化に Cloudflare の D1（SQL DB）および KV（キー値ストア）を使用します。初回の導入時は、ワンクリック・セットアップスクリプトを使用して、**実際のリモート Cloudflare プラットフォーム上に自動でリソースを作成し、初回デプロイまで完了**させます。

> **Tip:** 既存のインフラデータをリセットせず、バックアップから設定情報（`wrangler.backup.json` など）のみを安全に復元して再デプロイしたい場合は、`npm run restore` コマンドを使用して復元モードで実行してください。

```bash
# 基本モード (デフォルト言語を選択した後、ビルド・デプロイまでフルオートで実行)
npm run setup

# インタラクティブモード (プロジェクト名やDB名などを個別に指定してカスタム実行)
npm run setup:select
```

### ⚙️ `npm run setup` 実行時の主な処理内容：
1. **初期設定の選択:** 実行後すぐにデフォルトのブログ言語（ko/en/ja）を指定し、残りの設定工程を**フルオート**で処理するか、**個別インタラクティブ選択**で処理するかを選択します。
2. **Cloudflare のアカウント認証:** Wrangler CLI を使用して Cloudflare アカウントにログインします (`wrangler login`)。すでにログイン状態であれば自動でスキップされます。
3. **インフラの自動作成:** リモートの Cloudflare 上に D1 データベース (`blog-db-*`, `user-db-*`) と KV ネームスペース (`blog-images-kv-*`) をセットアップします。(フルオート選択時は、デフォルトのリソース名で即座に作成されます。)
4. **リモートマイグレーションの実行:** 作成された D1 データベースに対してテーブルスキーマを作成し、指定されたデフォルト言語に応じた初期シード（Seed）データを挿入します。(フルオート選択時は初回インストールと自動判定され、多言語辞書の同期確認などのインタラクティブプロンプトは自動スキップされます。)
5. **シークレット環境変数の設定および初回デプロイ:** ローカルの `.dev.vars` に記載されたシークレット値を Pages Secret として自動アップロードし、アプリをビルドして Cloudflare Pages にデプロイします。(ビルド前に Pages プロジェクトを事前にリモート作成するため、初回デプロイ時からすべてのシークレット環境変数が漏れなく正常に適用されます。)

---

## 🔐 環境変数とシークレット値の自動同期 (.dev.vars)

アプリケーションの動作に必要な秘密鍵（OAuth キー、API 認証情報など）は、各アプリの `.dev.vars.example` ファイルにテンプレートとして用意されています。**実際のシークレット値が記載される `.dev.vars` ファイルは Git の追跡から除外されています。デプロイ前に、必ず各アプリフォルダ内の `.dev.vars.example` をコピーして `.dev.vars` ファイルを作成し、適切なシークレット値を記述してください。**

### ⚙️ 設定手順：
1. `apps/blog/.dev.vars.example` をコピーして `apps/blog/.dev.vars` を作成します。
2. `apps/admin/.dev.vars.example` をコピーして `apps/admin/.dev.vars` を作成します。
3. 作成した `.dev.vars` ファイルを開き、必要な値を設定します。

> 💡 **環境変数（シークレット）の同期方式について:**
> `npm run setup` スクリプトはビルド・デプロイ前に Cloudflare Pages のプロジェクトをリモート上に事前作成するため、初回セットアップ時であっても `.dev.vars` のシークレット変数は Pages Secret へ漏れなく自動同期・反映されます。デプロイ後にシークレット値を修正またはコードを再アップロードする場合は、個別デプロイコマンド（`npm run deploy:blog` など）を実行して更新を行ってください。

---

### 1. `apps/blog/.dev.vars` (ブログの OAuth およびログイン認証用シークレット)

* 🔴 **必須項目 (Must-have Key)**:
  * `BETTER_AUTH_SECRET`: セッショントークンおよびクッキーの暗号化に使用するランダムな秘密鍵（32文字以上を推奨）。この値が設定されていない場合、ユーザー認証機能全般が動作しません。
* 🟢 **ダミー値設定可能項目 (Dummy Allowed Keys)**:
  * `GITHUB_*`, `GOOGLE_*`: ソーシャルログイン連携用のキー。メールアドレス/パスワード認証方式のみを使用し、ソーシャルログインを使用しない場合は、デフォルトのダミー値 (`dummy_*`) のままでも動作に影響ありません。

```text
# [必須] 暗号化および署名用のシークレットキー
BETTER_AUTH_SECRET=任意のランダムな秘密文字列 (32文字以上を推奨)

# [任意] ソシャルログイン連携 (使用しない場合はダミー値のままで可)
GITHUB_CLIENT_ID=dummy_github_id
GITHUB_CLIENT_SECRET=dummy_github_secret
GOOGLE_CLIENT_ID=dummy_google_id
GOOGLE_CLIENT_SECRET=dummy_google_secret
```

---

### 2. `apps/admin/.dev.vars` (管理者ログインおよび Google API 連携用シークレット)

* 🔴 **必須項目 (Must-have Key)**:
  * `ADMIN_PASSWORD`: 管理者ダッシュボードへのログイン時に使用するパスワード。ダミー値のままにせず、必ず独自に用意した安全なパスワードに変更してください。
* 🟢 **ダミー値設定可能項目 (Dummy Allowed Keys)**:
  * `GA4_*` (アクセス解析), `ADSENSE_*` (アドセンス): Google連携用キー。これらの機能を使用しない、あるいはまだアカウントが用意できていない場合は、ダミー値 (`dummy_*`) のままデプロイしてもエラーは発生せず、ウィジェットのデータ表示のみが空の状態で動作します。

> 💡 **GA4_PRIVATE_KEY** の値を記述する際は、以下のようにダブルクォーテーション (`"`) で囲み、改行文字 (`\n`) を含めた1行の形式で入力してください。

```text
# [必須] 管理者ダッシュボードログイン用のパスワード
ADMIN_PASSWORD=実際の管理者ログインパスワード

# [任意] Google Analytics 4 連携 (使用しない場合はダミー値のままで可)
GA4_PROPERTY_ID=dummy_ga4_property_id
GA4_CLIENT_EMAIL=dummy-email@iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ndummy_private_key_string\n-----END PRIVATE KEY-----\n"

# [任意] Google AdSense 連携 (使用しない場合はダミー値のままで可)
ADSENSE_ACCOUNT_ID=accounts/pub-dummy
ADSENSE_CLIENT_ID=dummy_adsense_client_id.apps.googleusercontent.com
ADSENSE_CLIENT_SECRET=dummy_adsense_secret
ADSENSE_REFRESH_TOKEN=dummy_refresh_token
```

### 🔒 管理者ページの IP 制限 (`ALLOWED_IP`) 自動化処理
* アクセス制限用のホワイトリスト IP（`ALLOWED_IP`）を管理者側で手動で設定したり、ファイルを直接変更したりする必要はありません。
* デプロイスクリプトの実行時に `sync-secrets.js` が**ユーザーの現在のグローバル IP アドレスを自動的に検知**し、`apps/admin/.dev.vars` へ動的に書き換えて Pages Secret へ自動反映します。
* 注意: デプロイ時に登録された IP アドレス以外からの管理者アクセスは遮断されます。IP アドレスが変更された場合は、再度デプロイを実行するか、データベース内の値を直接修正してください。

---

## 🚀 個別ビルドおよびデプロイコマンド

初回セットアップによってリソース作成が完了した後、コードの変更や環境変数の変更に伴って個別に再デプロイを行う場合は、以下のコマンドを使用します：

* **ブログ（Blog）サービスのデプロイ:**
  ```bash
  npm run deploy:blog
  ```
* **管理者（Admin）ダッシュボードのデプロイ:**
  ```bash
  npm run deploy:admin
  ```

---

## 📄 ライセンス

本プロジェクトはオープンソースであり、**GNU Affero General Public License v3.0 (AGPL-3.0)** ライセンスのもとで配布されています。詳細はルートの [LICENSE](LICENSE) ファイルをご参照ください。
AGPL-3.0 の条件に基づき、本ソフトウェアを改変したり、ネットワーク経由でサービスとして提供したりする場合、その改変されたソースコードの全内容をユーザーに対して無償で開示・公開する必要があります。

---

## ☕ サポート

本プロジェクトは AGPL-3.0 に基づく純粋なオープンソースであり、完全に無料で維持管理されています。もしこのプロジェクトがお役に立ちましたら、または今後の開発継続を応援していただける場合は、開発者へ温かいコーヒーの差し入れ（ご支援）をお願いいたします！

<a href="https://buymeacoffee.com/sveltekitblogengine" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>
