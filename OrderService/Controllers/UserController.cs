using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrderService.Data;

namespace OrderService.Controllers
{
    /// <summary>
    /// Internal endpoint — called by InventoryService to resolve user details for lottery.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        private readonly OrderContext _context;
        private readonly IConfiguration _config;

        public UserController(OrderContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        /// <summary>
        /// Returns public user info by id. Accessible to any valid JWT or via internal secret header.
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            // Allow calls carrying the internal service secret (service-to-service)
            var internalHeader = Request.Headers["x-internal-secret"].FirstOrDefault();
            if (internalHeader != _config["InternalSecret"])
            {
                // Fall back to requiring any authenticated user
                if (!User.Identity?.IsAuthenticated ?? true)
                    return Unauthorized();
            }

            var user = await _context.Users
                .AsNoTracking()
                .Where(u => u.Id == id)
                .Select(u => new { u.Id, u.Username, u.Email, u.Phone, u.Role })
                .FirstOrDefaultAsync();

            if (user == null) return NotFound();
            return Ok(user);
        }
    }
}
