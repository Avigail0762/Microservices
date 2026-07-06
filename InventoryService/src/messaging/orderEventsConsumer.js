const amqp = require('amqplib');
const ticketService = require('../services/ticketService');
const { logger, withCorrelationId } = require('../logger');

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'order.events';
const ORDER_PLACED_QUEUE = process.env.RABBITMQ_INVENTORY_ORDER_QUEUE || 'inventory.order-placed';
const GIFT_QUEUE = process.env.RABBITMQ_INVENTORY_QUEUE || 'inventory.gift-purchased';
const FAIL_QUEUE = process.env.RABBITMQ_INVENTORY_FAIL_QUEUE || 'inventory.purchase-failed';
const MAX_RESERVATIONS_PER_GIFT = Number(process.env.MAX_RESERVATIONS_PER_GIFT || '100000');

function getAmqpUrl() {
  const host = process.env.RABBITMQ_HOST || 'localhost';
  const port = process.env.RABBITMQ_PORT || '5672';
  const user = process.env.RABBITMQ_USER || 'guest';
  const password = process.env.RABBITMQ_PASSWORD || 'guest';
  const vhost = process.env.RABBITMQ_VHOST || '/';
  const encodedVhost = encodeURIComponent(vhost);
  return `amqp://${user}:${password}@${host}:${port}/${encodedVhost}`;
}

async function startOrderEventsConsumer() {
  const connection = await amqp.connect(getAmqpUrl());
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(ORDER_PLACED_QUEUE, { durable: true });
  await channel.assertQueue(GIFT_QUEUE, { durable: true });
  await channel.assertQueue(FAIL_QUEUE, { durable: true });
  await channel.bindQueue(ORDER_PLACED_QUEUE, EXCHANGE, 'order.events.order-placed');
  await channel.bindQueue(GIFT_QUEUE, EXCHANGE, 'order.events.gift-purchased');
  await channel.bindQueue(FAIL_QUEUE, EXCHANGE, 'order.events.purchase-failed');
  channel.prefetch(20);

  channel.consume(ORDER_PLACED_QUEUE, async msg => {
    if (!msg) return;
    const correlationId = extractCorrelationId(msg);
    const messageLogger = withCorrelationId(correlationId);
    try {
      const payload = JSON.parse(msg.content.toString());
      payload.correlationId = correlationId;

      const activeReservations = await ticketService.countActiveReservationsByGiftId(payload.giftId);
      if (activeReservations >= MAX_RESERVATIONS_PER_GIFT) {
        publish(channel, 'order.events.inventory-rejected', {
          eventId: randomId(),
          correlationId: payload.correlationId,
          sagaId: payload.sagaId,
          occurredAt: new Date().toISOString(),
          sourceService: 'InventoryService',
          schemaVersion: '1.0',
          ticketId: payload.ticketId,
          giftId: payload.giftId,
          userId: payload.userId,
          reason: `Reservation capacity reached for gift ${payload.giftId}`
        }, correlationId);
        messageLogger.warn('Rejected inventory reservation', { giftId: payload.giftId, ticketId: payload.ticketId });
        channel.ack(msg);
        return;
      }

      await ticketService.registerTicket({
        ticketId: payload.ticketId,
        giftId: payload.giftId,
        userId: payload.userId,
        correlationId: payload.correlationId,
        sagaId: payload.sagaId,
        reservationStatus: 'Reserved',
        ticketNumberForGift: payload.ticketNumberForGift,
        quantity: payload.quantity,
        purchasedAt: payload.purchasedAt
      });

      publish(channel, 'order.events.inventory-reserved', {
        eventId: randomId(),
        correlationId: payload.correlationId,
        sagaId: payload.sagaId,
        occurredAt: new Date().toISOString(),
        sourceService: 'InventoryService',
        schemaVersion: '1.0',
        ticketId: payload.ticketId,
        giftId: payload.giftId,
        userId: payload.userId
      }, correlationId);

      messageLogger.info('Reserved inventory ticket', { giftId: payload.giftId, ticketId: payload.ticketId });

      channel.ack(msg);
    } catch (err) {
      messageLogger.error('Inventory consumer order-placed error', { error: err });
      channel.nack(msg, false, true);
    }
  });

  channel.consume(GIFT_QUEUE, async msg => {
    if (!msg) return;
    const correlationId = extractCorrelationId(msg);
    const messageLogger = withCorrelationId(correlationId);
    try {
      const payload = JSON.parse(msg.content.toString());
      payload.correlationId = correlationId;
      await ticketService.registerTicket({
        ticketId: payload.ticketId,
        giftId: payload.giftId,
        userId: payload.userId,
        correlationId: payload.correlationId,
        ticketNumberForGift: payload.ticketNumberForGift,
        quantity: payload.quantity,
        purchasedAt: payload.purchasedAt
      });
      messageLogger.info('Registered gift-purchased ticket', { giftId: payload.giftId, ticketId: payload.ticketId });
      channel.ack(msg);
    } catch (err) {
      messageLogger.error('Inventory consumer gift-purchased error', { error: err });
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
      await ticketService.removeTicketByTicketId(payload.ticketId);
      messageLogger.info('Removed ticket after purchase failure', { giftId: payload.giftId, ticketId: payload.ticketId });
      channel.ack(msg);
    } catch (err) {
      messageLogger.error('Inventory consumer purchase-failed error', { error: err });
      channel.nack(msg, false, true);
    }
  });

  logger.info('InventoryService RabbitMQ consumers started');
  return { connection, channel };
}

function publish(channel, routingKey, payload, correlationId) {
  const body = Buffer.from(JSON.stringify(payload));
  channel.publish(EXCHANGE, routingKey, body, {
    persistent: true,
    correlationId,
    headers: {
      CorrelationId: correlationId
    }
  });
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

  return randomId();
}

function randomId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = { startOrderEventsConsumer };