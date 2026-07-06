using AutoMapper;
using Microsoft.Extensions.Caching.Memory;
using OrderService.Messaging;
using OrderService.Messaging.Contracts;
using OrderService.Models;
using OrderService.Models.DTO;
using OrderService.Models.External;
using OrderService.Repositories.Interfaces;
using OrderService.Services.Interfaces;
using System.Net.Http.Json;

namespace OrderService.Services
{
    public class CustomerService : ICustomerService
    {
        private readonly ICustomerRepository _repository;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IEventPublisher _eventPublisher;
        private readonly IMemoryCache _cache;
        private readonly IMapper _mapper;
        private readonly ILogger<CustomerService> _logger;

        public CustomerService(
            ICustomerRepository repository,
            IHttpClientFactory httpClientFactory,
            IEventPublisher eventPublisher,
            IMemoryCache cache,
            IMapper mapper,
            ILogger<CustomerService> logger)
        {
            _repository = repository;
            _httpClientFactory = httpClientFactory;
            _eventPublisher = eventPublisher;
            _cache = cache;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<User> Register(UserDTO dto)
        {
            _logger.LogInformation("Register started. Email={Email}", dto.Email);

            if (await _repository.GetUserByEmail(dto.Email) != null)
                throw new Exception("Email already exists");

            var user = _mapper.Map<User>(dto);
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

            var created = await _repository.AddUser(user);
            _logger.LogInformation("Register completed. UserId={UserId}", created.Id);
            return created;
        }

        public async Task<List<CatalogGift>> GetGifts(string? category, bool? sortPriceAsc)
        {
            var client = _httpClientFactory.CreateClient("CatalogClient");

            string url = "/api/gift";
            if (category != null)
                url = $"/api/gift/category/{Uri.EscapeDataString(category)}";
            else if (sortPriceAsc != null)
                url = $"/api/gift/sorted?ascending={sortPriceAsc.Value.ToString().ToLower()}";

            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return new List<CatalogGift>();

            return await response.Content.ReadFromJsonAsync<List<CatalogGift>>()
                ?? new List<CatalogGift>();
        }

        public async Task<List<CatalogGift>> GetCart(int userId)
        {
            var user = await _repository.GetUserById(userId)
                ?? throw new Exception("User not found");

            if (user.ShoppingCart == null || !user.ShoppingCart.Any())
                return new List<CatalogGift>();

            var client = _httpClientFactory.CreateClient("CatalogClient");
            var result = new List<CatalogGift>();

            foreach (var giftId in user.ShoppingCart)
            {
                var gift = await GetCatalogGiftWithCacheAsync(client, giftId);
                if (gift != null) result.Add(gift);
            }

            return result;
        }

        public async Task<List<Ticket>> GetUserTickets(int userId)
        {
            var user = await _repository.GetUserById(userId)
                ?? throw new Exception("User not found");

            return await _repository.GetTicketsByUser(user.Id);
        }

        public async Task AddToCart(int userId, int giftId)
        {
            var user = await _repository.GetUserById(userId)
                ?? throw new Exception("User not found");

            var client = _httpClientFactory.CreateClient("CatalogClient");
            var gift = await GetCatalogGiftWithCacheAsync(client, giftId)
                ?? throw new Exception("Gift not found");

            if (gift.IsDrawn) throw new Exception("Cannot add a drawn gift to cart");

            user.ShoppingCart ??= new List<int>();
            user.ShoppingCart.Add(giftId);
            await _repository.UpdateUser(user);

            _logger.LogInformation("Gift {GiftId} added to cart for user {UserId}", giftId, userId);
        }

        public async Task RemoveFromCart(int userId, int giftId)
        {
            var user = await _repository.GetUserById(userId)
                ?? throw new Exception("User not found");

            user.ShoppingCart?.Remove(giftId);
            await _repository.UpdateUser(user);
        }

        public async Task Purchase(int userId)
        {
            _logger.LogInformation("Purchase started. UserId={UserId}", userId);

            var user = await _repository.GetUserById(userId)
                ?? throw new Exception("User not found");

            if (user.ShoppingCart == null || !user.ShoppingCart.Any())
                throw new Exception("Shopping cart is empty");

            var catalogClient = _httpClientFactory.CreateClient("CatalogClient");
            var correlationId = Guid.NewGuid().ToString("N");
            foreach (var giftId in user.ShoppingCart.ToList())
            {
                var sagaId = $"purchase-{userId}-{giftId}";

                // 1. Validate gift from ProductCatalogService
                var gift = await GetCatalogGiftWithCacheAsync(catalogClient, giftId)
                    ?? throw new Exception($"Gift {giftId} not found in catalog");
                if (gift!.IsDrawn)
                    throw new Exception($"Gift {giftId} has already been drawn");

                // 2. Find or create ticket in local SQL Server
                var existingTickets = await _repository.GetTicketsByGiftAndUser(giftId, userId);
                Ticket ticket;

                if (existingTickets.Count > 0)
                {
                    ticket = existingTickets.First();
                    ticket.Quantity++;
                    ticket.CorrelationId = correlationId;
                    ticket.SagaId = sagaId;
                    await _repository.UpdateTicket(ticket);
                }
                else
                {
                    int ticketCount = await _repository.GetTicketCountByGift(giftId);
                    ticket = new Ticket
                    {
                        UserId = userId,
                        GiftId = giftId,
                        TicketNumberForGift = ticketCount + 1,
                        Quantity = 1,
                        CorrelationId = correlationId,
                        SagaId = sagaId,
                        PurchasedAt = DateTime.UtcNow
                    };
                    ticket = await _repository.AddTicket(ticket);
                }

                // 3. Publish async event instead of sync side effects.
                try
                {
                    await _eventPublisher.PublishOrderPlacedAsync(new OrderPlacedEvent
                    {
                        CorrelationId = correlationId,
                        SagaId = sagaId,
                        TicketId = ticket.Id,
                        GiftId = ticket.GiftId,
                        UserId = ticket.UserId,
                        TicketNumberForGift = ticket.TicketNumberForGift,
                        Quantity = ticket.Quantity,
                        PurchasedAt = ticket.PurchasedAt
                    });

                    await _eventPublisher.PublishGiftPurchasedAsync(new GiftPurchasedEvent
                    {
                        CorrelationId = correlationId,
                        SagaId = sagaId,
                        TicketId = ticket.Id,
                        GiftId = ticket.GiftId,
                        UserId = ticket.UserId,
                        TicketNumberForGift = ticket.TicketNumberForGift,
                        Quantity = ticket.Quantity,
                        PurchasedAt = ticket.PurchasedAt
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to publish GiftPurchased event. UserId={UserId}, GiftId={GiftId}", userId, giftId);
                    await _eventPublisher.PublishPurchaseFailedAsync(new PurchaseFailedEvent
                    {
                        CorrelationId = correlationId,
                        SagaId = sagaId,
                        TicketId = ticket.Id,
                        GiftId = ticket.GiftId,
                        UserId = ticket.UserId,
                        Reason = ex.Message
                    });
                    throw;
                }
            }

            // 5. Clear cart
            user.ShoppingCart = new List<int>();
            await _repository.UpdateUser(user);

            _logger.LogInformation("Purchase completed. UserId={UserId}", userId);
        }

        private async Task<CatalogGift?> GetCatalogGiftWithCacheAsync(HttpClient client, int giftId)
        {
            var cacheKey = $"catalog-gift:{giftId}";
            if (_cache.TryGetValue(cacheKey, out CatalogGift? cachedGift) && cachedGift != null)
            {
                return cachedGift;
            }

            var response = await client.GetAsync($"/api/gift/{giftId}");
            if (!response.IsSuccessStatusCode) return null;

            var gift = await response.Content.ReadFromJsonAsync<CatalogGift>();
            if (gift != null)
            {
                _cache.Set(cacheKey, gift, TimeSpan.FromSeconds(20));
            }

            return gift;
        }
    }
}
