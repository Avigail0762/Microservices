using System.ComponentModel.DataAnnotations;

namespace OrderService.Models.DTO
{
    public class UserDTO
    {
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
        [MinLength(6, ErrorMessage = "Password must be at least 6 characters")]
        [MaxLength(100)]
        public string Password { get; set; } = null!;
    }
}
