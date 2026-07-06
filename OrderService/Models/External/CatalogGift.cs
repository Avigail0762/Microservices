namespace OrderService.Models.External
{
    /// <summary>
    /// DTO for gift data received from ProductCatalogService.
    /// </summary>
    public class CatalogGift
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public int DonorId { get; set; }
        public int Price { get; set; }
        public int BuyersNumber { get; set; }
        public string? Category { get; set; }
        public int? WinnerTicketId { get; set; }
        public bool IsDrawn { get; set; }
    }
}
