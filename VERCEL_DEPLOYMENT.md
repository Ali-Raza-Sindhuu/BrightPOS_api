# API deployment on Vercel

Set the Vercel project root to `BrightPOS_api`. The existing Express app is
exported from `src/app.js`, which Vercel recognizes as an Express entry point.
The local `server.js` remains the Node development and cPanel entry point.

Configure these environment variables for each Vercel environment:

- `NODE_ENV=production`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` for a persistent
  hosted MySQL provider
- `DB_CONNECTION_LIMIT=5` as a conservative per-function pool limit
- `JWT_SECRET` with a unique high-entropy value
- `JWT_EXPIRES_IN=8h` (or the session duration you choose)
- `CORS_ORIGIN` as a comma-separated list of exact POS and marketing origins
- `BLOB_READ_WRITE_TOKEN` for item image uploads
- `UPLOAD_MAX_FILE_SIZE_MB=4` (Vercel request bodies have a 4.5 MB limit)
- `TRUST_PROXY=true`

Set `VITE_API_BASE_URL` on the POS frontend Vercel project to the API deployment
URL followed by `/api`. Vite values are embedded at build time, so redeploy the
frontend after changing it. Marketing page animation code stays in the
marketing project; the POS app does not use it.

Vercel Functions do not provide persistent local disk storage, and
`express.static()` is not served by the Express function. Item uploads use
Vercel Blob when `VERCEL=1`; local uploads continue to use the configured
uploads directory. Database migrations and admin seeding remain deliberate
operations against the selected database; do not run them during a production
deployment without reviewing the pending migration list and taking a backup.
