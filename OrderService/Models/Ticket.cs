using System.ComponentModel.DataAnnotations;

namespace OrderService.Models
{
    public class Ticket
    {
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        public User User { get; set; } = null!;

        /// <summary>
        /// References a gift in ProductCatalogService — no local FK constraint.
        /// </summary>
        [Required]
        public int GiftId { get; set; }

        public int TicketNumberForGift { get; set; }

        public int Quantity { get; set; } = 1;

        [Required]
        public string CorrelationId { get; set; } = Guid.NewGuid().ToString("N");

        [Required]
        public string SagaId { get; set; } = string.Empty;

        [Required]
        public string OrderStatus { get; set; } = "Pending";

        [Required]
        public DateTime PurchasedAt { get; set; } = DateTime.UtcNow;
    }
}
