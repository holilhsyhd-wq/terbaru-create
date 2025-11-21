# terbaru-create
# Server Create – Pterodactyl

Project untuk membuat **panel** dan **admin panel** Pterodactyl dengan pilihan RAM dari **1–9 GB** dan **Unlimited**.

## Struktur

- `public/index.html` — tampilan web
- `api/create.js` — API backend (Vercel Serverless Function)
- `config.js` — konfigurasi panel Pterodactyl (domain, API key, dll)
- `package.json` — konfigurasi project Node

## Setup

1. Edit `config.js`:
   - Ganti `domain` dengan URL panel Pterodactyl.
   - Ganti `apiKey` dengan Application API key Pterodactyl.

2. Push project ini ke GitHub.

3. Deploy ke Vercel:
   - Import repository.
   - Root directory: projek ini.
   - Build & Output: default (Vercel akan serve `public` dan `api` otomatis).

Selesai. Akses URL Vercel kamu dan gunakan form untuk membuat Panel / Admin Panel.
