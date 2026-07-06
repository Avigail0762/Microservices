using Microsoft.EntityFrameworkCore;
using OrderService.Data;
using OrderService.Models;
using OrderService.Repositories.Interfaces;

namespace OrderService.Repositories
{
    public class CustomerRepository : ICustomerRepository
    {
        private readonly OrderContext _context;

        public CustomerRepository(OrderContext context)
        {
            _context = context;
        }

        // ── Users ────────────────────────────────────────────────────────────

        public async Task<User?> GetUserByEmail(string email)
            => await _context.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Email == email);

        public async Task<User?> GetUserById(int id)
            => await _context.Users.FindAsync(id);

        public async Task<User> AddUser(User user)
        {
            await _context.Users.AddAsync(user);
            await _context.SaveChangesAsync();
            return user;
        }

        public async Task UpdateUser(User user)
        {
            var existing = await _context.Users.FindAsync(user.Id)
                ?? throw new Exception("User not found");
            existing.ShoppingCart = user.ShoppingCart;
            await _context.SaveChangesAsync();
        }

        // ── Tickets ──────────────────────────────────────────────────────────

        public async Task<Ticket> AddTicket(Ticket ticket)
        {
            await _context.Tickets.AddAsync(ticket);
            await _context.SaveChangesAsync();
            return ticket;
        }

        public async Task<Ticket?> GetTicketById(int ticketId)
            => await _context.Tickets.FirstOrDefaultAsync(t => t.Id == ticketId);

        public async Task UpdateTicket(Ticket ticket)
        {
            var existing = await _context.Tickets.FirstOrDefaultAsync(t => t.Id == ticket.Id)
                ?? throw new Exception("Ticket not found");
            existing.Quantity = ticket.Quantity;
            existing.TicketNumberForGift = ticket.TicketNumberForGift;
            existing.CorrelationId = ticket.CorrelationId;
            existing.SagaId = ticket.SagaId;
            existing.OrderStatus = ticket.OrderStatus;
            await _context.SaveChangesAsync();
        }

        public async Task DeleteTicket(int ticketId)
        {
            var ticket = await _context.Tickets.FirstOrDefaultAsync(t => t.Id == ticketId)
                ?? throw new Exception("Ticket not found");
            _context.Tickets.Remove(ticket);
            await _context.SaveChangesAsync();
        }

        public async Task<List<Ticket>> GetTicketsByGiftAndUser(int giftId, int userId)
            => await _context.Tickets.AsNoTracking()
                .Where(t => t.GiftId == giftId && t.UserId == userId)
                .ToListAsync();

        public async Task<Ticket?> GetTicketByCorrelationId(string correlationId)
            => await _context.Tickets.AsNoTracking()
                .FirstOrDefaultAsync(t => t.CorrelationId == correlationId);

        public async Task<List<Ticket>> GetTicketsByUser(int userId)
            => await _context.Tickets.AsNoTracking()
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.PurchasedAt)
                .ToListAsync();

        public async Task<int> GetTicketCountByGift(int giftId)
            => await _context.Tickets.CountAsync(t => t.GiftId == giftId);
    }
}
