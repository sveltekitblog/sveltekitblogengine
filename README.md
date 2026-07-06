# 🚀 SvelteKit Blog Engine

🌐 **[한국어](./README.kr.md) | [日本語](./README.ja.md)**

A lightning-fast, open-source blog and admin management system built using SvelteKit, Cloudflare Pages, D1 SQL Database, and KV Store. This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

> 💡 **You can find detailed deployment guides, manuals, and a live demo running this repository's codebase at the official website: [sveltekitblog.com](https://sveltekitblog.com)!**
>
> * **Zero Cost Infrastructure:** Excluding domain registration, the entire infrastructure (Cloudflare Pages, D1 SQL Database, KV Store) is hosted on **Cloudflare's Free Tier**, incurring exactly $0 in ongoing server maintenance costs.
> * **Analytics & Monetization Integrated:** The live demo is fully integrated with **Google Search Console** and **Google Analytics 4 (GA4)** (visible in the admin dashboard), with a **Google AdSense** application currently under review.

> ⚠️ **Important:** Due to the nature of Cloudflare D1, running and testing the database entirely in a local-only environment is not recommended. The system is designed to integrate and run actively on the live Cloudflare platform. Therefore, this guide focuses on creating resources and deploying directly to the remote Cloudflare environment.

---

## 📋 Table of Contents
1. [Project Overview](#-project-overview)
2. [Installing Dependencies](#-installing-dependencies)
3. [Cloudflare Infrastructure & Initial Deployment (npm run setup)](#-cloudflare-infrastructure--initial-deployment-npm-run-setup)
4. [Environment Variables & Secret Synchronization (.dev.vars)](#-environment-variables--secret-synchronization-devvars)
5. [Individual Build & Deployment Commands](#-individual-build--deployment-commands)
6. [License](#-license)
7. [Support](#-support)

---

## 🔍 Project Overview

[![Live Design Editor Demo (Watch full video on YouTube)](./GIFs/design_editor.gif)](https://www.youtube.com/watch?v=XOza3hgiNQw)
*💡 Click the image above to watch the full feature demo video on YouTube.*

This project is a monorepo that manages both the blog front-end and the admin dashboard within a single Git repository, fully integrated with Cloudflare's edge-native services.

- **apps/blog**: SvelteKit-powered blog front-end where anyone can read posts, register/login via email or OAuth, and write comments or guestbook entries.
- **apps/admin**: SvelteKit-powered admin dashboard for composing posts, viewing Google Analytics (GA4)/AdSense stats, and customizing layout/themes.
- **packages/shared**: Shared packages containing Drizzle ORM schemas, database structure definitions, utility functions, and internationalization (i18n) configs.

---

## 🛠️ Installing Dependencies

Run the following command in the root directory to link and install all dependencies in the monorepo:
```bash
npm install
npm audit fix
```

---

## ☁️ Cloudflare Infrastructure & Initial Deployment (npm run setup)

[![npm run setup Execution Demo (Watch full video on YouTube)](./GIFs/npm_run_setup.gif)](https://www.youtube.com/watch?v=eJvG-4fZGsA)
*💡 Click the image above to watch the full setup and deployment run on YouTube.*

This project uses Cloudflare D1 (SQL Database) and KV (Key-Value) namespaces for data persistence. On first use, run the one-click setup script to **automatically provision resources in your remote Cloudflare account and deploy the project**.

> **Tip:** If you wish to restore configurations (`wrangler.backup.json`, etc.) from a backup without resetting existing infrastructure data, run the script in restore mode via `npm run restore`.

```bash
# Default Mode (Select default language and run a full auto, one-stop build/deployment)
npm run setup

# Interactive Mode (Step-by-step custom setup: choose project names, DB names, etc.)
npm run setup:select
```

### ⚙️ What `npm run setup` does:
1. **Interactive Setup Mode:** Immediately prompts you to select the default blog language (ko/en/ja), then asks whether you want to run the remaining configuration in **Full Auto** or **Custom Interactive** mode.
2. **Cloudflare Authentication:** Logs into your Cloudflare account using Wrangler CLI (`wrangler login`). This step is automatically skipped if an active session already exists.
3. **Resource Provisioning:** Provisions remote D1 databases (`blog-db-*`, `user-db-*`) and a KV namespace (`blog-images-kv-*`) on Cloudflare. (In Auto mode, default resource names are assigned instantly.)
4. **Remote Schema Migrations:** Sets up database tables and seeds initial data according to your chosen default language. (During Auto setup, it is recognized as a fresh installation, and the translation dictionary interactive prompt is automatically skipped.)
5. **Secure Environment Setup & Deploy:** Automatically uploads your local `.dev.vars` secrets as Pages Secrets, builds the apps, and publishes them to Cloudflare Pages. (Since the Pages projects are pre-created remotely before building, secrets will sync on the first deployment without skipping.)

---

## 🔐 Environment Variables & Secret Synchronization (.dev.vars)

Secrets required for running the application (OAuth keys, API credentials, etc.) are provided as templates in each app's `.dev.vars.example` file. **The `.dev.vars` files containing actual production keys are excluded from Git tracking. Therefore, you must copy the `.dev.vars.example` files to create `.dev.vars` in each app directory and enter your credentials before deployment.**

### ⚙️ Setup Instructions:
1. Copy `apps/blog/.dev.vars.example` to `apps/blog/.dev.vars`.
2. Copy `apps/admin/.dev.vars.example` to `apps/admin/.dev.vars`.
3. Open the newly created `.dev.vars` files and fill in the required keys.

> 💡 **Secret Synchronization Details:**
> Since the `npm run setup` script pre-creates the Cloudflare Pages projects remotely before deployment, the secrets configured in your `.dev.vars` files will be successfully uploaded to Pages Secrets during the initial run. If you need to modify credentials or codebase later, run the respective deploy command (e.g., `npm run deploy:blog`) to sync changes.

---

### 1. `apps/blog/.dev.vars` (Blog OAuth & Authentication Secrets)

* 🔴 **Must-have Key**:
  * `BETTER_AUTH_SECRET`: A random secret key (minimum 32 characters recommended) for encrypting session tokens and cookies. Without this key, authentication features will not work.
* 🟢 **Dummy Allowed Keys**:
  * `GITHUB_*`, `GOOGLE_*`: OAuth keys for social login. If you only plan to use email/password authentication, you can leave these as dummy values (`dummy_*`) without impacting site launch.

```text
# [Required] Secret key for encryption and signing
BETTER_AUTH_SECRET=your_random_secret_string (minimum 32 characters recommended)

# [Optional] Social login integration (keep dummy values if unused)
GITHUB_CLIENT_ID=dummy_github_id
GITHUB_CLIENT_SECRET=dummy_github_secret
GOOGLE_CLIENT_ID=dummy_google_id
GOOGLE_CLIENT_SECRET=dummy_google_secret
```

---

### 2. `apps/admin/.dev.vars` (Admin Credentials & Google API Secrets)

* 🔴 **Must-have Key**:
  * `ADMIN_PASSWORD`: The password required to log in to the admin dashboard. Do not leave this as a dummy value in production.
* 🟢 **Dummy Allowed Keys**:
  * `GA4_*` (Analytics), `ADSENSE_*` (AdSense): Google reporting keys. If you don't use these features yet, leaving them as dummy values (`dummy_*`) is completely fine; the dashboard widgets will simply display empty states.

> 💡 **GA4_PRIVATE_KEY** must be written in a single line enclosed in double quotes (`"`) with literal newlines (`\n`) as shown below.

```text
# [Required] Password for admin dashboard access
ADMIN_PASSWORD=your_actual_admin_password

# [Optional] Google Analytics 4 integration (keep dummy values if unused)
GA4_PROPERTY_ID=dummy_ga4_property_id
GA4_CLIENT_EMAIL=dummy-email@iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ndummy_private_key_string\n-----END PRIVATE KEY-----\n"

# [Optional] Google AdSense integration (keep dummy values if unused)
ADSENSE_ACCOUNT_ID=accounts/pub-dummy
ADSENSE_CLIENT_ID=dummy_adsense_client_id.apps.googleusercontent.com
ADSENSE_CLIENT_SECRET=dummy_adsense_secret
ADSENSE_REFRESH_TOKEN=dummy_refresh_token
```

### 🔒 IP Whitelisting (`ALLOWED_IP`) for Admin Protection
* You do not need to configure allowed IPs manually.
* The deploy script runs `sync-secrets.js` which **automatically detects your current public IP address** and injects it into `apps/admin/.dev.vars`, uploading it automatically as a remote Pages Secret.
* Note: Only the IP address registered during deployment will be allowed to access the admin panel. If your IP changes, you will need to redeploy or manually update the IP value in the database.

---

## 🚀 Individual Build & Deployment Commands

Once the infrastructure resources are provisioned via `setup`, use the following commands to rebuild and redeploy individual services:

* **Deploy Blog Service:**
  ```bash
  npm run deploy:blog
  ```
* **Deploy Admin Dashboard:**
  ```bash
  npm run deploy:admin
  ```

---

## 📄 License

This project is open-source and distributed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. For details, refer to the [LICENSE](LICENSE) file in the root directory.
Under AGPL-3.0, if you modify this software or run it as a network service, you must make your modified source code available to your users.

---

## ☕ Support

This project is an open-source initiative licensed under AGPL-3.0 and is maintained for free. If this project has been helpful to you, or if you'd like to support its ongoing development, feel free to buy the developer a coffee! Thank you for your support!

<a href="https://buymeacoffee.com/sveltekitblogengine" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>
