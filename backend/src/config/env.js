require('dotenv').config();

const port = Number(process.env.PORT || 3000);
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const databaseUrl = process.env.DATABASE_URL;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

module.exports = {
  port,
  corsOrigins,
  database: databaseUrl
    ? { connectionString: databaseUrl, ssl: { rejectUnauthorized: true } }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'brokerage_db',
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT || 5432),
      },
};