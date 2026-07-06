using OrderService.Models;
using OrderService.Models.DTO;
using OrderService.Models.External;

namespace OrderService.Services.Interfaces
{
    public interface ICustomerService
    {
        Task<User> Register(UserDTO dto);
        Task<List<CatalogGift>> GetGifts(string? category, bool? sortPriceAsc);
        Task<List<CatalogGift>> GetCart(int userId);
        Task<List<Ticket>> GetUserTickets(int userId);
        Task AddToCart(int userId, int giftId);
        Task RemoveFromCart(int userId, int giftId);
        Task Purchase(int userId);
    }
}
