namespace OrderService.Messaging
{
    public interface IEventPublisher
    {
        Task PublishOrderPlacedAsync(Contracts.OrderPlacedEvent payload, CancellationToken cancellationToken = default);
        Task PublishInventoryReservedAsync(Contracts.InventoryReservedEvent payload, CancellationToken cancellationToken = default);
        Task PublishInventoryRejectedAsync(Contracts.InventoryRejectedEvent payload, CancellationToken cancellationToken = default);
        Task PublishOrderFinalizedAsync(Contracts.OrderFinalizedEvent payload, CancellationToken cancellationToken = default);
        Task PublishGiftPurchasedAsync(Contracts.GiftPurchasedEvent payload, CancellationToken cancellationToken = default);
        Task PublishPurchaseFailedAsync(Contracts.PurchaseFailedEvent payload, CancellationToken cancellationToken = default);
    }
}