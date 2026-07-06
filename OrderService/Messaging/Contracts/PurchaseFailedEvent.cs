namespace OrderService.Messaging.Contracts
{
    public class PurchaseFailedEvent
    {
        public string EventId { get; set; } = Guid.NewGuid().ToString("N");
        public string CorrelationId { get; set; } = string.Empty;
        public string SagaId { get; set; } = string.Empty;
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
        public string SourceService { get; set; } = "OrderService";
        public string SchemaVersion { get; set; } = "1.0";

        public int TicketId { get; set; }
        public int GiftId { get; set; }
        public int UserId { get; set; }
        public string Reason { get; set; } = string.Empty;
    }
}