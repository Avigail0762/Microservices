using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Models.DTO;
using OrderService.Services.Interfaces;

namespace OrderService.Controllers
{
    [ApiController]
    [Route("api/customer")]
    public class CustomerController : ControllerBase
    {
        private readonly ICustomerService _customerService;
        private readonly ILogger<CustomerController> _logger;

        public CustomerController(ICustomerService customerService, ILogger<CustomerController> logger)
        {
            _customerService = customerService;
            _logger = logger;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] UserDTO dto)
        {
            if (dto == null) return BadRequest("User data is required");
            try
            {
                var user = await _customerService.Register(dto);
                return Ok(user);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Registration error");
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("gifts")]
        public async Task<IActionResult> GetGifts([FromQuery] string? category, [FromQuery] bool? sortPriceAsc)
        {
            var gifts = await _customerService.GetGifts(category, sortPriceAsc);
            return Ok(gifts);
        }

        [HttpPost("cart/add")]
        [Authorize(Roles = "user")]
        public async Task<IActionResult> AddToCart([FromQuery] int userId, [FromQuery] int giftId)
        {
            try
            {
                await _customerService.AddToCart(userId, giftId);
                return Ok();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("cart/remove")]
        [Authorize(Roles = "user")]
        public async Task<IActionResult> RemoveFromCart([FromQuery] int userId, [FromQuery] int giftId)
        {
            await _customerService.RemoveFromCart(userId, giftId);
            return Ok();
        }

        [HttpGet("cart")]
        [Authorize(Roles = "user")]
        public async Task<IActionResult> GetCart([FromQuery] int userId)
        {
            if (userId <= 0) return BadRequest("Invalid user id");
            try
            {
                var cart = await _customerService.GetCart(userId);
                return Ok(cart);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("tickets")]
        [Authorize(Roles = "user")]
        public async Task<IActionResult> GetUserTickets([FromQuery] int userId)
        {
            if (userId <= 0) return BadRequest("Invalid user id");
            try
            {
                var tickets = await _customerService.GetUserTickets(userId);
                return Ok(tickets);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("purchase")]
        [Authorize(Roles = "user")]
        public async Task<IActionResult> Purchase([FromQuery] int userId)
        {
            if (userId <= 0) return BadRequest("Invalid user id");
            try
            {
                await _customerService.Purchase(userId);
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Purchase error. UserId={UserId}", userId);
                return BadRequest(ex.Message);
            }
        }
    }
}
