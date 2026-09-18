# LeadFlow API + Dashboard

WordPress captures leads. The MERN app stores, scores, searches, and manages them.
The small Angular client provides the separate Lead Insights adaptability view.

The WordPress plugin is already installed on Local as `leadflow-connector`. This repository also
contains an installable copy in `wordpress-plugin/leadflow-connector`; copy it into WordPress when
setting up a fresh site.

## What runs where

| Piece | URL | Role |
|---|---|---|
| WordPress form | http://leadflow.local/lead-form/ | Public lead form (already built) |
| API | http://localhost:5000 | Receives and stores leads |
| Dashboard | http://localhost:5173 | Login and lead list |
| Angular insights | http://localhost:4200 | Summary and top-five scoring view |

## Architecture

```text
WordPress form ──Bearer API secret──> Express API ──Mongoose──> MongoDB
                                          ↑
React CRM ─────────JWT─────────────────────┤
Angular Insights ──JWT─────────────────────┘
```

WordPress saves every submission locally before syncing it. The API owns validation, duplicate
prevention, lead scoring, CRM status, and analytics. React is the main product UI; Angular is an
intentionally small secondary client of the same API.

Key decisions:

- Separate WordPress API-secret authentication from admin JWT authentication.
- Calculate scores only on the server so clients cannot manipulate priority.
- Keep analytics in one endpoint shared by both frontends.
- Use MongoDB indexes for unique email, status, score, and date-oriented queries.
- Keep the Angular task independent so it cannot destabilize the React application.

## Prerequisites

- Node.js 20.19+, 22.12+, or 24+
- MongoDB Community Server running locally, or a MongoDB Atlas connection string
- WordPress Local site `leadflow` with the LeadFlow Connector plugin enabled

## 1. Start the API

Start MongoDB first. The default connection is:

```
mongodb://127.0.0.1:27017/leadflow
```

For MongoDB Atlas, put your Atlas URI in `backend/.env` as `MONGODB_URI`.

```bash
cd backend
npm install
npm run dev
```

API: http://localhost:5000  
Health check: http://localhost:5000/health

Default `.env` values (already match the WordPress plugin defaults):

```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/leadflow
MONGODB_DB=leadflow
DNS_SERVERS=8.8.8.8,1.1.1.1
API_SECRET=my_jwt_or_secret_token
JWT_SECRET=replace_with_a_long_random_value
ADMIN_EMAIL=admin@leadflow.local
ADMIN_PASSWORD=admin123
CLIENT_URL=http://localhost:5173
```

## 2. Start the dashboard

```bash
cd frontend
npm install
npm run dev
```

Dashboard: http://localhost:5173

Sign in with:

- Email: `admin@leadflow.local`
- Password: `admin123`

## 3. Connect WordPress

For a fresh WordPress installation, copy
`wordpress-plugin/leadflow-connector` into `wp-content/plugins/`, activate **LeadFlow Connector**,
and add `[leadflow_form]` to a page.

In WP Admin go to **LeadFlow CRM → API Settings**:

- Node.js API URL: `http://localhost:5000/api/leads`
- API Secret / Bearer Token: `my_jwt_or_secret_token`

These are also the plugin defaults, so first-run submissions use them even before the settings
form is saved. Save the form whenever you change either value.

Submit the form on http://leadflow.local/lead-form/. You should see a green success message, then the lead in the dashboard.

If WordPress still cannot reach port 5000 (`cURL error 7`), Local is treating `localhost` as the WordPress container, not your PC. Keep the plugin unchanged and only update the API URL in settings to one of:

- `http://host.docker.internal:5000/api/leads`
- `http://127.0.0.1:5000/api/leads`
- `http://YOUR_PC_LAN_IP:5000/api/leads`

The token must stay `my_jwt_or_secret_token` unless you change `API_SECRET` in `backend/.env` too.

## 4. Angular Lead Insights

This intentionally small standalone Angular client uses the same JWT login as the React CRM.

```bash
cd angular-insights
npm install
npm start
```

Open http://localhost:4200 and use the same admin credentials. The API URL is configured in
`angular-insights/src/environments/environment.ts`.

## API

WordPress ingest (Bearer = `API_SECRET`):

```http
POST /api/leads
Authorization: Bearer my_jwt_or_secret_token
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane@email.com",
  "phone": "03001234567",
  "service": "Web Development",
  "budgetRange": "$1000 - $5000",
  "message": "Need a site"
}
```

Dashboard:

- `POST /api/auth/login` `{ "email", "password" }` → `{ "token", "email" }`
- `POST /api/leads` creates and scores a lead (Bearer JWT or WordPress API secret)
- `GET /api/leads?q=&status=&minScore=&maxScore=&page=&limit=` searches and paginates
- `GET /api/leads/:id` returns lead details
- `PATCH /api/leads/:id` updates status: `new`, `contacted`, `qualified`, `won`, or `lost`
- `GET /api/leads/export.csv` downloads the CRM as CSV
- `GET /api/analytics/insights` returns totals, counts by status, and top five leads
- `GET /health`

Lead reads, updates, export, and analytics require a JWT. Lead creation accepts either a JWT or
the static WordPress `API_SECRET`; manual dashboard creation uses a JWT. Duplicate email addresses
return HTTP 409.

## Lead scoring

`backend/src/utils/calculateLeadScore.js` calculates every score server-side from 0–100:

- Budget intent: 8–40 points
- Requested service: 10–15 points
- Message detail: 7–20 points
- Complete phone number: 10 points
- Business email: 10 points; common free email: 5 points
- Lead source: 3–5 points

The formula rewards buying intent, contactability, and a detailed brief. Scores are capped at
100 and cannot be supplied or overridden by a client.

## API testing

Import `postman/LeadFlow.postman_collection.json` into Postman. Run **Login** first; its test
script stores the JWT automatically. The collection includes health, both creation auth modes,
search/list, details, status update, insights, and CSV export.

Dashboard Lead List view
![alt text](image.png)

Dashboard Lead Insight view
![alt text](image-1.png)

## Project structure

```text
backend/          Express/Mongoose API
  server.js        API entry point
  src/config/     MongoDB connection
  src/middleware/ Authentication
  src/models/     Mongoose schemas
  src/routes/     API routes
  src/utils/      Lead scoring and scoring unit tests
frontend/         Main React CRM
angular-insights/ Standalone Angular adaptability task
wordpress-plugin/ Submission copy of the installable plugin
postman/          Importable API collection
```

## Security notes

- `.env` files and dependencies are ignored by Git; commit only `.env.example`.
- Replace all example secrets and admin credentials outside local development.
- Login is rate-limited, API responses use Helmet headers, and protected routes require Bearer
  authentication.
- Restrict MongoDB Atlas Network Access to trusted addresses in production.

## Optional deployment

- API: deploy `backend/` to Render, Railway, or another Node host. Set every variable from
  `backend/.env.example`, use an Atlas URI, and set `CLIENT_URL` to the deployed React origin.
- React: deploy `frontend/` to Vercel or Netlify and set `VITE_API_URL` to the public API URL.
- Angular: deploy `angular-insights/dist/lead-insights/browser` after `npm run build`; update
  `src/environments/environment.ts` before building.
- WordPress: install the bundled plugin on the target site and set its API URL to the public API.
- Add deployed frontend origins to the CORS allowlist in `backend/src/app.js`.

Deployment is optional for this assignment; local setup is the documented primary path.
