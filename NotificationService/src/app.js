require('dotenv').config();
const express = require('express');
const { startOrderFinalizedConsumer } = require('./messaging/orderFinalizedConsumer');
const { logger, requestLogger } = require('./logger');

const app = express();
app.use(express.json());
app.use(requestLogger);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/notification', require('./routes/notificationRoutes'));

// Health-check
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'NotificationService' }));

const PORT = process.env.PORT || 8084;

async function startOrderFinalizedConsumerWithRetry() {
	const maxAttempts = Number(process.env.RABBITMQ_STARTUP_MAX_ATTEMPTS || 30);
	const delayMs = Number(process.env.RABBITMQ_STARTUP_RETRY_MS || 2000);

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			await startOrderFinalizedConsumer();
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

startOrderFinalizedConsumerWithRetry()
	.then(() => {
		app.listen(PORT, () => logger.info('NotificationService started', { port: PORT }));
	})
	.catch(err => {
		logger.error('NotificationService RabbitMQ startup error', { error: err });
		process.exit(1);
	});
