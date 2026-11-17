const cors = require('cors');
const express = require('express');
const { corsOrigins } = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');
const { apiRouter } = require('./routes/api.routes');

const app = express();

app.use(cors({
	origin(origin, callback) {
		const localDevelopmentOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
		if (!origin || corsOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && localDevelopmentOrigin)) {
			return callback(null, true);
		}
		return callback(new Error('Origin is not allowed by CORS.'));
	},
}));
app.use(express.json({ limit: '100kb' }));
app.use('/api', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };