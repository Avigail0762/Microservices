using System.ComponentModel.DataAnnotations;

namespace OrderService.Models
{
    public class User
    {
        public int Id { get; set; }

        [Required]
        [StringLength(30, MinimumLength = 3)]
        public string Username { get; set; } = null!;

        [Phone]
        [MaxLength(20)]
        public string? Phone { get; set; }

        [Required]
        [EmailAddress]
        [StringLength(100)]
        public string Email { get; set; } = null!;

        [Required]
        public string PasswordHash { get; set; } = null!;

        public List<int> ShoppingCart { get; set; } = new List<int>();

        public string Role { get; set; } = "user";
    }
}
