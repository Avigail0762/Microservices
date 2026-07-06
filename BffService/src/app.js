require('dotenv').config();
const express = require('express');
const { logger, requestLogger } = require('./logger');

const app = express();
app.use(express.json());
app.use(requestLogger);

app.use('/api/bff', require('./routes/webRoutes'));

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'BffService' });
});

const PORT = process.env.PORT || 8090;
app.listen(PORT, () => {
  logger.info('BffService started', { port: PORT });
});
