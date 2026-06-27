# Nordea Spending Tracker

A personal finance dashboard that parses your Nordea credit card PDF invoices and displays interactive spending analysis — accessible from any device.

## Setup (5 minutes)

### 1 — Create a GitHub repository
1. Go to [github.com/new](https://github.com/new)
2. Name it `nordea-tracker` (or anything you like)
3. Set it to **Private** (your financial data stays yours)
4. Click **Create repository**

### 2 — Upload these files
Drag all files/folders into the GitHub repository page, or use:
```bash
git init
git remote add origin https://github.com/YOUR-USERNAME/nordea-tracker.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

### 3 — Enable GitHub Pages
1. Go to your repo → **Settings** → **Pages**
2. Under *Source*, select **Deploy from a branch**
3. Choose `main` branch, `/ (root)` folder
4. Click **Save**

Your dashboard will be live at:
`https://YOUR-USERNAME.github.io/nordea-tracker/`

(Takes ~1 minute to deploy after first push)

## Using the app

1. Open the URL on any device (phone or PC)
2. Go to **Statements** → drag & drop your Nordea PDF invoices
3. The app parses them automatically in your browser
4. View your spending history in **Dashboard**

All data is stored **locally in your browser** (IndexedDB). Nothing is sent to any server.

## Adding a new month
Just upload the new PDF in the Statements page — the dashboard updates automatically.

## Privacy
- 100% client-side. No server, no analytics, no data leaving your browser.
- Keep the GitHub repo **Private** so the code isn't publicly indexed.
