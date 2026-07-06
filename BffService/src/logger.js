const winston = require('winston');

let SeqTransport;
try {
  ({ SeqTransport } = require('@datalust/winston-seq'));
} catch (error) {
  console.warn('Seq transport disabled: incompatible module format or missing package', error.message);
}

const transports = [
  new winston.transports.Console({
    format: winston.format.json()
  })
];

if (process.env.SEQ_URL && SeqTransport) {
  transports.push(new SeqTransport({
    serverUrl: process.env.SEQ_URL,
    onError: error => console.error('Seq transport error', error)
  }));
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'BffService' },
  transports
});

function requestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info('HTTP request completed', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });
  next();
}

module.exports = { logger, requestLogger };