# DailyDoseofBCA

DailyDoseofBCA is a student resource website for BCA notes, assignments, lab manuals, and updates.

This repo now works in two hosting modes:

- **Static GitHub Pages**: serves the HTML, CSS, JS, videos, PDFs, and images directly from GitHub.
- **Full-stack Node host**: serves the same pages plus API endpoints for contact messages and notification updates.

## Features

- Semester pages for BCA resources.
- Site-wide notification banner driven by `notification-config.json` or `/api/notifications`.
- Admin-controlled landing page driven by `site-config.json` or `/api/site-config`.
- Contact form that saves messages when the Node backend is running.
- Admin page for updating notifications and reading saved contact messages.
- Public semester-page chat with unique user profiles and messages that expire after 24 hours.
- GitHub Pages workflow and custom domain support through `CNAME`.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the full-stack server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Admin Setup

Create a local `.env` file:

```bash
cp .env.example .env
```

Set a private token:

```text
ADMIN_TOKEN=your-private-password
```

Then open:

```text
http://localhost:3000/admin.html
```

Use the same token in the admin page.

## GitHub Pages Hosting

GitHub Pages can host the frontend only. The backend routes will not run on GitHub Pages, so the contact form will offer an email fallback there.

Steps:

1. Create a GitHub repository.
2. Upload/push this project to the repository.
3. In GitHub, go to **Settings > Pages**.
4. Set **Source** to **GitHub Actions**.
5. Push to the `main` branch.
6. The workflow in `.github/workflows/pages.yml` deploys the site.

## Custom Domain

The current `CNAME` file contains:

```text
daily.doseofbca.com
```

For GitHub Pages, add one of these DNS setups at your domain provider:

- For a subdomain like `daily.doseofbca.com`, add a `CNAME` record pointing to `YOUR-GITHUB-USERNAME.github.io`.
- For an apex/root domain like `doseofbca.com`, add GitHub Pages `A` records in your DNS settings.

After DNS is updated, go to **Settings > Pages**, enter the domain, and enable **Enforce HTTPS** after GitHub verifies it.

## Full-Stack Hosting

Use a Node-capable host such as Render, Railway, Fly.io, DigitalOcean, or a VPS.

Typical settings:

- Build command: `npm install`
- Start command: `npm start`
- Environment variables: `ADMIN_TOKEN`, optional `PORT`

If you want the full-stack host to use your purchased domain, point your domain DNS to that host instead of GitHub Pages.

## Project Files

- `server.js`: Express server and API routes.
- `contact.html`: Contact page with backend submission and static fallback.
- `admin.html`: Protected admin UI for notifications and messages.
- `notification-config.json`: Static notification config.
- `site-config.json`: Static landing page config.
- `chat-widget.js`: Floating public chat widget for semester pages.
- `CNAME`: GitHub Pages custom domain.
- `.github/workflows/pages.yml`: Static GitHub Pages deployment.
