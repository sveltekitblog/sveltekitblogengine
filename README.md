# 🚀 SvelteKit Blog Engine

🌐 **[한국어](./README.kr.md) | [日本語](./README.ja.md)**

**A self-hosted, open-source blog engine built for developers who want to own their blog, data, and infrastructure.**

> **A blog you can deploy, own, customize, and leave running without a monthly server bill.**

Built with **SvelteKit + Cloudflare Pages + D1 + KV**.

[![Live Design Editor Demo](./GIFs/design_editor.gif)](https://www.youtube.com/watch?v=XOza3hgiNQw)

*Click the GIF to watch the full design editor demo on YouTube.*

### Why this project?

- 💸 **$0 ongoing server cost** within Cloudflare's applicable Free Tier limits
- 🏠 **Your data stays in your Cloudflare account**
- ⚡ **Fast by design**, running on Cloudflare's edge infrastructure
- 🎨 **Change the design without rebuilding or redeploying**
- 💾 **Backup & Restore** for safer updates and testing
- 🌍 **Multilingual** — Korean, English, Japanese included, with support for adding your own languages
- 📡 **RSS support** for content distribution and feed readers
- 🚀 **One-command deployment** with `npm run setup`
- 🔓 **Open source under AGPL-3.0**

> **Your blog. Your data. Your infrastructure.**

### 🌐 Live Demo

**[sveltekitblog.com](https://sveltekitblog.com)**

The live website is running the actual codebase from this repository.

Want to check the performance?

**[Test it yourself with Google PageSpeed Insights](https://pagespeed.web.dev/)**

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Who Is This For?](#-who-is-this-for)
3. [Why I Built This](#-why-i-built-this)
4. [Zero Ongoing Infrastructure Cost](#-zero-ongoing-infrastructure-cost)
5. [Own Your Data](#-own-your-data)
6. [Key Features](#-key-features)
7. [Installing & Deploying](#-installing--deploying)
8. [Backup & Restore](#-backup--restore)
9. [Design System](#-design-system)
10. [Multilingual Support](#-multilingual-support)
11. [SEO, Analytics & AdSense](#-seo-analytics--adsense)
12. [Performance](#-performance)
13. [Content Hub](#-content-hub)
14. [Found a Problem?](#-found-a-problem)
15. [License](#-license)
16. [Support](#-support)

---

## 🔍 Project Overview

SvelteKit Blog Engine is a monorepo containing both the public blog and its administration dashboard.

```text
apps/
├── blog/       # Public blog
└── admin/      # Administration dashboard

packages/
└── shared/     # Shared schemas, utilities & i18n
```

The blog and Admin are designed to be deployed separately.

The public blog handles content and visitors, while the Admin dashboard handles posts, settings, design customization, analytics, and other management features.

The project uses:

- **SvelteKit**
- **Cloudflare Pages**
- **Cloudflare D1**
- **Cloudflare KV**
- **Drizzle ORM**

---

## 🎯 Who Is This For?

This project is primarily for **developers and technically-oriented users**.

It's a good fit if you:

- Are comfortable with a terminal
- Want to self-host your own blog
- Want to own your data
- Already use Cloudflare or don't mind learning it
- Want a full blogging system rather than a simple static site
- Don't want a monthly VPS bill for a personal project

It is **not intended to be a no-code blogging service**.

If `npm run setup` looks like alien language, this probably isn't the easiest blogging platform for you.

And that's intentional.

---

## 🧭 Why I Built This

This started as a blog I wanted to build for myself.

I didn't want another blog that required:

- A VPS
- Monthly hosting fees
- Manual server maintenance
- Giving my data to a third-party platform

I wanted something I could deploy, customize, back up, and basically leave alone.

The project eventually became much larger than the original plan, so I decided to release it as open source.

The bigger idea is simple:

> **Build a blog you actually own.**

---

## 💸 Zero Ongoing Infrastructure Cost

One of the main design goals was keeping infrastructure costs as close to zero as possible.

For a small personal blog that stays within Cloudflare's applicable Free Tier limits:

> **The ongoing server cost can be $0.**

You still need a domain, and Cloudflare's usage limits and policies apply.

This isn't about claiming that hosting is magically free forever.

It's about this:

> **If you stop updating your blog for a while, it shouldn't keep costing you money.**

Even if you leave your blog untouched for a while, it shouldn't keep generating a monthly server bill.

### 💳 No Surprise Bills

Cloudflare's Free Tier does not require a credit card to get started.

Just sign up with your email and you're ready to go. Since you don't have to add a payment method, there's no risk of accidentally getting charged just because you used too much.

Start for free and use it without worrying about unexpected bills.

If your blog grows enough to go beyond the Free Tier and starts costing money, that's fine. Pay for it then.

If your blog has grown that much, that's actually a good thing.

> **Start for free. If your blog grows enough to cost money, that's a good problem to have.**

---

## 🏠 Own Your Data

Your blog runs on **your own Cloudflare account**.

You control:

- Your blog
- Your database
- Your media
- Your configuration
- Your backups
- Your domain
- Your deployment

There is no central server operated by this project that your blog depends on for normal operation.

**Your data stays yours.**

---

## ✨ Key Features

### 🚀 Simple Deployment

After cloning the repository:

```bash
npm install
npm run setup
```

The setup process provisions the required Cloudflare resources and deploys the application.

For users who want more control, an interactive setup mode is also available.

```bash
npm run setup:select
```

---

### 🎨 Dynamic Design

The blog design is configuration-driven.

You can change the appearance from the Admin dashboard without rebuilding and redeploying the application for every design change.

Change it in Admin → save → the public blog uses the new configuration.

---

### 💾 Backup & Restore

Backup and restore isn't only for disaster recovery.

It can also be used to safely test updates.

A practical workflow is:

```text
Production Blog
      ↓
   Backup
      ↓
   Test Blog
      ↓
Restore Data
      ↓
Test New Release
      ↓
Deploy to Production
```

You can keep a separate test deployment, restore your production data into it, test a new version, and only then update the production blog.

---

### 🎨 Design Sharing

Design configurations can be shared between installations.

Create a design on one blog → export it → import it into another installation.

This makes it possible to reuse and share blog designs without rebuilding them from scratch.

---

### 📡 RSS

The blog supports **RSS feeds**, allowing readers to subscribe to your content using their preferred feed reader.

---

## 🌍 Multilingual Support

The project currently includes:

- 🇰🇷 Korean
- 🇺🇸 English
- 🇯🇵 Japanese

But the engine is **not limited to these languages**.

Each installation can add its own languages through the built-in i18n system.

---

## 📊 SEO, Analytics & AdSense

The engine includes support for common SEO features and integrations such as:

- SEO metadata
- Canonical URLs
- Multilingual SEO
- Sitemap
- RSS
- Social metadata
- Google Search Console
- Google Analytics 4
- Google AdSense

Third-party services are optional and subject to their own policies and requirements.

---

## ⚡ Performance

Performance was one of the reasons for choosing SvelteKit and Cloudflare.

Rather than asking you to trust a benchmark number in this README:

**Test the live site yourself.**

### 🌐 Live Demo

**[https://sveltekitblog.com](https://sveltekitblog.com)**

### 📈 PageSpeed Insights

**[Test sveltekitblog.com on Google PageSpeed Insights](https://pagespeed.web.dev/)**

Performance can vary depending on device, network, cache state, third-party scripts, advertising, and other conditions.

So don't take a score in this README as a guarantee.

**Go test it yourself.**

---

## 🌐 Content Hub

The project also includes a content hub designed around independently-owned blogs.

The idea is simple:

> **Help people discover real blogs written by real people.**

The goal isn't to create another collection of automatically generated, low-quality content.

The Hub is intended to connect independently hosted blogs and their authors with readers.

---

## 🛠️ Installing & Deploying

### Install dependencies

```bash
npm install
npm audit fix
```

### Initial setup

```bash
npm run setup
```

Or use interactive setup:

```bash
npm run setup:select
```

Before deployment, create the required `.dev.vars` files from the provided examples and configure your credentials.

```text
apps/blog/.dev.vars.example
apps/admin/.dev.vars.example
```

### Deploy Blog

```bash
npm run deploy:blog
```

### Deploy Admin

```bash
npm run deploy:admin
```

For detailed deployment instructions, configuration guides, and troubleshooting:

**[Visit the official website → sveltekitblog.com](https://sveltekitblog.com)**

---

## 🐛 Found a Problem?

This project is currently maintained by me.

If you find a bug, security issue, SEO problem, deployment problem, or documentation error, please let me know through GitHub Issues.

You don't need to submit a pull request.

**Found a problem? Tell me. I'll take a look.**

---

## 📄 License

This project is open-source and distributed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

See the [LICENSE](LICENSE) file for the complete license text.

---

## ☕ Support

This project is maintained as a free open-source project.

If you find it useful and would like to support its development, you can buy the developer a coffee.

<a href="https://buymeacoffee.com/sveltekitblogengine" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

Thank you for your support!

---

> **Your blog. Your data. Your infrastructure.**
