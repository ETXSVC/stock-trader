# Frontend — Stock Sampler Bot

React 18 + TypeScript + Vite 8 frontend for the Stock Sampler Bot.

## Development

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173`. All `/api` and `/appws` requests are proxied to the backend at `localhost:8000` via `vite.config.ts`.

## Production build

```bash
npm run build
```

Output goes to `dist/`. The FastAPI backend serves this directory as static files — no separate web server needed.

## Pages

| Route | Page |
|-------|------|
| `/` | Dashboard — live price table |
| `/top-movers` | Top gainers and losers |
| `/alerts` | Alert configuration |
| `/notifications` | Notification history |
| `/settings` | Stocks, schedules, export, triggers |
