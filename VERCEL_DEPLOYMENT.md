# Vercel backend deployment preparation

No remote deployment was performed during the backend upgrade. First provision Aiven **Free** MySQL, run the current migrations and verify TLS using the [database guide](docs/aiven-free-database-setup.md).

The backend project root is `POS_Backend`. `src/app.js` imports Express and exports the application with CommonJS. This matches Vercel's documented Express entry convention. `server.js` is for local startup and graceful shutdown; it does not import Express directly. Prefer the Express framework detection, without a second API folder or competing legacy builds/rewrites. [Official Express support and entry paths](https://vercel.com/docs/frameworks/backend/express).

1. Import this backend repository into a separate Vercel project, or set the project root to `POS_Backend` if importing the encompassing workspace.
2. Select Express and a supported Node.js runtime matching the local release (24 recommended).
3. Configure variables from `.env.aiven.example`: NODE_ENV=production, DB host/port/user/password/name, DB_SSL=true, DB_SSL_CA containing the full CA PEM, DB_CONNECTION_LIMIT=3, DB_QUEUE_LIMIT=30, a fresh JWT_SECRET, exact frontend CORS_ORIGIN and the correct TRUST_PROXY hop setting. Omit DB_SSL_CA_FILE in hosted environments.
4. Configure BLOB_READ_WRITE_TOKEN if enabling product image uploads. The API uses memory uploads + Vercel Blob when VERCEL=1. Local disk URLs cannot serve as persistent hosted uploads; Vercel's Express adapter does not serve express.static assets. [Official static-asset guidance](https://vercel.com/docs/frameworks/backend/express#serving-static-assets).
5. Apply migrations once from a controlled workstation/release job. Never apply them per request/cold start. The runtime DB user can later be separated from migration/admin credentials.
6. Create a preview deployment. Check health, login, permissions, TLS, both cold and warm requests, transactions, pool limits, image uploads and CORS before using it as a public demo.

The pool is bounded with idle settings, but provider-wide connection limits still require preview/load testing across instances. Vercel-specific pool lifecycle integration and remote resource limits should be evaluated in the deployment phase. No claim of hosted acceptance is made here.

For the public portfolio demo, define limited visitor roles, synthetic data, reset behavior and admin protections before publication. The local administrator created in this workspace is not a shared public demo credential.
