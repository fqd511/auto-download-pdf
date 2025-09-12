# Auto Download PDF

An automated tool that downloads exam PDFs using Playwright.


## Setup

1. Install Node.js deps:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npm run install-browsers
```

3. Configure environment variables:
Edit `.env` with real credentials:
```
USERNAME=your_real_email@example.com
PASSWORD=your_real_password
LOGIN_URL=https://target-website.com/login-endpoint
DOWNLOAD_DIR=./downloads
```

## Usage

Run the script:
```bash
npm start
```

Or run in dev mode (hot reload):
```bash
npm run dev
```

## How it works

1. Date calculation: compute N = business days between today and 2025-09-10
2. Login: sign in using env credentials (redirects to home on success)
3. Filter combos: iterate grades P1–P6 and subjects (Chinese, English, Math, General Studies)
4. Item selection: click the Nth item under each filter
5. PDF download: on the detail page, download the PDF and rename it
6. Loop: return to the list and continue with the next combo

## Technical notes

- Follow Playwright best practices: use `waitFor`, `waitForNavigation`; avoid hard-coded timeouts
- Smart waits: wait for element visibility and network idle
- Fault tolerance: handle load failures and missing elements

## Logging

- Set log level via env: `LOG_LEVEL=error|warn|info|debug` (default: info)
- Or enable verbose logs with `DEBUG=true` (equivalent to `LOG_LEVEL=debug`)
- Logs are timestamped and scoped; see `utils/logger.js`

## Project structure

```
auto-download-pdf/
├── index.js                 # Main entry
├── package.json             # Project config
├── .env                     # Environment variables
├── downloads/               # PDF output
└── utils/
    ├── dateCalculator.js    # Date utilities
    ├── loginHandler.js      # Login utilities
    ├── navigationHandler.js # Navigation utilities
    └── downloadHandler.js   # Download utilities
```

## Notes

- Ensure you have a valid account on the target site
- For the first run, set `headless: false` to observe
- PDFs are saved to `downloads`
- If a combo lacks enough items, it is skipped automatically
- Keep your network connection stable

## Troubleshooting

If something goes wrong, check:
1. Environment variables are correct
2. Network connection is stable
3. Account is valid and has download permissions
4. Playwright browsers are installed
5. The target site’s DOM may have changed
