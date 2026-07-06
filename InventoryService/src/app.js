require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { startOrderEventsConsumer } = require('./messaging/orderEventsConsumer');
const { logger, requestLogger } = require('./logger');

const app = express();
app.use(express.json());
app.use(requestLogger);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/lottery',   require('./routes/lotteryRoutes'));
app.use('/api/purchases', require('./routes/purchasesRoutes'));

// Health-check
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'InventoryService' }));

async function startOrderConsumerWithRetry() {
  const maxAttempts = Number(process.env.RABBITMQ_STARTUP_MAX_ATTEMPTS || 30);
  const delayMs = Number(process.env.RABBITMQ_STARTUP_RETRY_MS || 2000);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await startOrderEventsConsumer();
      if (attempt > 1) {
        logger.info('RabbitMQ consumer connected after retry', { attempt });
      }
      return;
    } catch (error) {
      logger.warn('RabbitMQ consumer startup retry', {
        attempt,
        maxAttempts,
        error: error.message || error
      });

      if (attempt === maxAttempts) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// ── MongoDB connection ─────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    logger.info('Connected to MongoDB', { database: 'inventorydb' });
    await startOrderConsumerWithRetry();
    const PORT = process.env.PORT || 8083;
    app.listen(PORT, () => logger.info('InventoryService started', { port: PORT }));
  })
  .catch(err => {
    logger.error('MongoDB connection error', { error: err });
    process.exit(1);
  });
