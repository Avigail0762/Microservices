using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using OrderService.Messaging.Contracts;
using OrderService.Repositories.Interfaces;
using Serilog.Context;

namespace OrderService.Messaging
{
    public class OrderSagaConsumer : BackgroundService
    {
        private readonly RabbitMqOptions _options;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IEventPublisher _publisher;
        private readonly ILogger<OrderSagaConsumer> _logger;
        private IConnection? _connection;
        private IModel? _channel;

        public OrderSagaConsumer(
            IOptions<RabbitMqOptions> options,
            IServiceScopeFactory scopeFactory,
            IEventPublisher publisher,
            ILogger<OrderSagaConsumer> logger)
        {
            _options = options.Value;
            _scopeFactory = scopeFactory;
            _publisher = publisher;
            _logger = logger;
        }

        protected override Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var factory = new ConnectionFactory
            {
                HostName = _options.Host,
                Port = _options.Port,
                UserName = _options.Username,
                Password = _options.Password,
                VirtualHost = _options.VirtualHost,
                DispatchConsumersAsync = true
            };

            _connection = factory.CreateConnection();
            _channel = _connection.CreateModel();

            _channel.ExchangeDeclare(_options.Exchange, ExchangeType.Topic, durable: true, autoDelete: false);

            const string queue = "order-service.inventory-outcomes";
            _channel.QueueDeclare(queue, durable: true, exclusive: false, autoDelete: false);
            _channel.QueueBind(queue, _options.Exchange, "order.events.inventory-reserved");
            _channel.QueueBind(queue, _options.Exchange, "order.events.inventory-rejected");
            _channel.BasicQos(0, 20, false);

            var consumer = new AsyncEventingBasicConsumer(_channel);
            consumer.Received += HandleAsync;
            _channel.BasicConsume(queue: queue, autoAck: false, consumer: consumer);

            _logger.LogInformation("OrderSagaConsumer started");
            return Task.CompletedTask;
        }

        private async Task HandleAsync(object sender, BasicDeliverEventArgs args)
        {
            if (_channel == null) return;

            var correlationId = ExtractCorrelationId(args.BasicProperties);
            try
            {
                using (LogContext.PushProperty("CorrelationId", correlationId))
                {
                    var body = Encoding.UTF8.GetString(args.Body.ToArray());

                    if (args.RoutingKey == "order.events.inventory-reserved")
                    {
                        var payload = JsonSerializer.Deserialize<InventoryReservedEvent>(body)
                            ?? throw new InvalidOperationException("Invalid inventory-reserved payload");
                        payload.CorrelationId = correlationId;
                        await ConfirmOrderAsync(payload);
                    }
                    else if (args.RoutingKey == "order.events.inventory-rejected")
                    {
                        var payload = JsonSerializer.Deserialize<InventoryRejectedEvent>(body)
                            ?? throw new InvalidOperationException("Invalid inventory-rejected payload");
                        payload.CorrelationId = correlationId;
                        await CompensateOrderAsync(payload);
                    }

                    _channel.BasicAck(args.DeliveryTag, multiple: false);
                }
            }
            catch (Exception ex)
            {
                using (LogContext.PushProperty("CorrelationId", correlationId))
                {
                    _logger.LogError(ex, "OrderSagaConsumer failed handling {RoutingKey}", args.RoutingKey);
                }
                _channel.BasicNack(args.DeliveryTag, multiple: false, requeue: true);
            }
        }

        private static string ExtractCorrelationId(IBasicProperties properties)
        {
            if (!string.IsNullOrWhiteSpace(properties.CorrelationId))
            {
                return properties.CorrelationId;
            }

            if (properties.Headers != null && properties.Headers.TryGetValue("CorrelationId", out var headerValue))
            {
                if (headerValue is byte[] bytes)
                {
                    return Encoding.UTF8.GetString(bytes);
                }

                if (headerValue is string value && !string.IsNullOrWhiteSpace(value))
                {
                    return value;
                }
            }

            return Guid.NewGuid().ToString("N");
        }

        private async Task ConfirmOrderAsync(InventoryReservedEvent payload)
        {
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<ICustomerRepository>();

            var ticket = await repository.GetTicketById(payload.TicketId);
            if (ticket == null) return;

            ticket.OrderStatus = "Confirmed";
            await repository.UpdateTicket(ticket);

            await _publisher.PublishOrderFinalizedAsync(new OrderFinalizedEvent
            {
                CorrelationId = payload.CorrelationId,
                SagaId = payload.SagaId,
                TicketId = payload.TicketId,
                GiftId = payload.GiftId,
                UserId = payload.UserId,
                Status = "Confirmed"
            });
        }

        private async Task CompensateOrderAsync(InventoryRejectedEvent payload)
        {
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<ICustomerRepository>();

            var ticket = await repository.GetTicketById(payload.TicketId);
            if (ticket != null)
            {
                await repository.DeleteTicket(ticket.Id);
            }

            await _publisher.PublishPurchaseFailedAsync(new PurchaseFailedEvent
            {
                CorrelationId = payload.CorrelationId,
                SagaId = payload.SagaId,
                TicketId = payload.TicketId,
                GiftId = payload.GiftId,
                UserId = payload.UserId,
                Reason = payload.Reason
            });

            await _publisher.PublishOrderFinalizedAsync(new OrderFinalizedEvent
            {
                CorrelationId = payload.CorrelationId,
                SagaId = payload.SagaId,
                TicketId = payload.TicketId,
                GiftId = payload.GiftId,
                UserId = payload.UserId,
                Status = "Compensated",
                Reason = payload.Reason
            });
        }

        public override void Dispose()
        {
            _channel?.Dispose();
            _connection?.Dispose();
            base.Dispose();
        }
    }
}