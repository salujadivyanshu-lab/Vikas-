const { app } = require('./app');
const { port } = require('./config/env');
const { pool } = require('./config/database');

const server = app.listen(port, () => {
  console.log(`Brokerage API listening on http://localhost:${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received; shutting down API.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));