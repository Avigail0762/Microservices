using OrderService.Models;

namespace OrderService.Repositories.Interfaces
{
    public interface ICustomerRepository
    {
        Task<User?> GetUserByEmail(string email);
        Task<User?> GetUserById(int id);
        Task<User> AddUser(User user);
        Task UpdateUser(User user);

        Task<Ticket> AddTicket(Ticket ticket);
        Task<Ticket?> GetTicketById(int ticketId);
        Task UpdateTicket(Ticket ticket);
        Task DeleteTicket(int ticketId);
        Task<List<Ticket>> GetTicketsByGiftAndUser(int giftId, int userId);
        Task<Ticket?> GetTicketByCorrelationId(string correlationId);
        Task<List<Ticket>> GetTicketsByUser(int userId);
        Task<int> GetTicketCountByGift(int giftId);
    }
}
