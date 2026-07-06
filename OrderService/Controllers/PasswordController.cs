using Microsoft.AspNetCore.Mvc;

namespace OrderService.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PasswordController : ControllerBase
    {
        [HttpGet("{pass}")]
        public string Get(string pass) => BCrypt.Net.BCrypt.HashPassword(pass);
    }
}
