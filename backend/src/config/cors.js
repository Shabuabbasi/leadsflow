/**
 * Utility to parse allowed CORS origins dynamically from environment variables
 * and default fallbacks without hardcoding deployment URLs.
 */
export function getAllowedOrigins() {
  const envOrigins = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.ALLOWED_ORIGINS, // comma-separated string e.g. "https://app.example.com,https://demo.example.com"
  ]
    .filter(Boolean)
    .flatMap((item) => item.split(',').map((url) => url.trim()));

  const defaultDevOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  return Array.from(new Set([...envOrigins, ...defaultDevOrigins]));
}

/**
 * Dynamic CORS checker function compatible with Express cors module and Socket.IO
 */
export function corsOriginDelegate(origin, callback) {
  // Allow requests with no origin (e.g. mobile apps, curl, Postman, server-to-server)
  if (!origin) {
    return callback(null, true);
  }

  // Allow all origins if explicitly set via env flag
  if (process.env.ALLOW_ALL_CORS === 'true') {
    return callback(null, true);
  }

  const allowedOrigins = getAllowedOrigins();

  // Check exact origin match or Render / Vercel preview domain patterns dynamically
  const isAllowed =
    allowedOrigins.includes(origin) ||
    /\.onrender\.com$/.test(origin) ||
    /\.vercel\.app$/.test(origin);

  if (isAllowed) {
    return callback(null, true);
  }

  return callback(new Error(`CORS policy blocked access from origin: ${origin}`), false);
}
