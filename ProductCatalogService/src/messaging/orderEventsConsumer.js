const amqp = require('amqplib');
const giftService = require('../services/giftService');
const ProcessedEvent = require('../models/ProcessedEvent');
const { logger, withCorrelationId } = require('../logger');

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'order.events';
const RESERVED_QUEUE = process.env.RABBITMQ_CATALOG_RESERVED_QUEUE || 'product-catalog.inventory-reserved';
const FAIL_QUEUE = process.env.RABBITMQ_CATALOG_FAIL_QUEUE || 'product-catalog.purchase-failed';

function getAmqpUrl() {
  const host = process.env.RABBITMQ_HOST || 'localhost';
  const port = process.env.RABBITMQ_PORT || '5672';
  const user = process.env.RABBITMQ_USER || 'guest';
  const password = process.env.RABBITMQ_PASSWORD || 'guest';
  const vhost = process.env.RABBITMQ_VHOST || '/';
  const encodedVhost = encodeURIComponent(vhost);
  return `amqp://${user}:${password}@${host}:${port}/${encodedVhost}`;
}

async function ensureNotProcessed(eventId, payload, eventType) {
  const existing = await ProcessedEvent.findOne({ eventId }).lean();
  if (existing) {
    withCorrelationId(payload.correlationId).info('Duplicate event skipped', {
      eventType,
      eventId,
      giftId: payload.giftId
    });
    return false;
  }

  await ProcessedEvent.create({
    eventId,
    correlationId: payload.correlationId,
    sagaId: payload.sagaId,
    eventType,
    giftId: payload.giftId
  });

  return true;
}

async function startOrderEventsConsumer() {
  const connection = await amqp.connect(getAmqpUrl());
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(RESERVED_QUEUE, { durable: true });
  await channel.assertQueue(FAIL_QUEUE, { durable: true });
  await channel.bindQueue(RESERVED_QUEUE, EXCHANGE, 'order.events.inventory-reserved');
  await channel.bindQueue(FAIL_QUEUE, EXCHANGE, 'order.events.purchase-failed');
  channel.prefetch(20);

  channel.consume(RESERVED_QUEUE, async msg => {
    if (!msg) return;
    const correlationId = extractCorrelationId(msg);
    const messageLogger = withCorrelationId(correlationId);
    try {
      const payload = JSON.parse(msg.content.toString());
      payload.correlationId = correlationId;
      const validationError = validateInventoryEventPayload(payload);
      if (validationError) {
        messageLogger.error('Catalog consumer inventory-reserved payload invalid', {
          error: validationError,
          payload
        });
        channel.ack(msg);
        return;
      }

      const shouldProcess = await ensureNotProcessed(payload.eventId, payload, 'inventory-reserved');
      if (!shouldProcess) {
        channel.ack(msg);
        return;
      }

      await giftService.incrementBuyers(Number(payload.giftId));
      messageLogger.info('Processed inventory-reserved event', { giftId: payload.giftId, ticketId: payload.ticketId });
      channel.ack(msg);
    } catch (err) {
      messageLogger.error('Catalog consumer inventory-reserved error', { error: err });
      channel.nack(msg, false, true);
    }
  });

  channel.consume(FAIL_QUEUE, async msg => {
    if (!msg) return;
    const correlationId = extractCorrelationId(msg);
    const messageLogger = withCorrelationId(correlationId);
    try {
      const payload = JSON.parse(msg.content.toString());
      payload.correlationId = correlationId;
      const validationError = validateInventoryEventPayload(payload);
      if (validationError) {
        messageLogger.error('Catalog consumer purchase-failed payload invalid', {
          error: validationError,
          payload
        });
        channel.ack(msg);
        return;
      }

      const shouldProcess = await ensureNotProcessed(payload.eventId, payload, 'purchase-failed');
      if (!shouldProcess) {
        channel.ack(msg);
        return;
      }

      await giftService.decrementBuyers(Number(payload.giftId));
      messageLogger.info('Processed purchase-failed event', { giftId: payload.giftId, ticketId: payload.ticketId });
      channel.ack(msg);
    } catch (err) {
      messageLogger.error('Catalog consumer purchase-failed error', { error: err });
      channel.nack(msg, false, true);
    }
  });

  logger.info('ProductCatalogService RabbitMQ consumers started');
  return { connection, channel };
}

function extractCorrelationId(msg) {
  const headerValue = msg.properties?.headers?.CorrelationId;
  if (msg.properties?.correlationId) {
    return msg.properties.correlationId;
  }

  if (Buffer.isBuffer(headerValue)) {
    return headerValue.toString('utf8');
  }

  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue;
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function validateInventoryEventPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Payload must be an object';
  }

  if (!payload.eventId) {
    return 'eventId is required';
  }

  if (!payload.sagaId) {
    return 'sagaId is required';
  }

  if (payload.giftId === undefined || payload.giftId === null || payload.giftId === '') {
    return 'giftId is required';
  }

  return null;
}

module.exports = { startOrderEventsConsumer };