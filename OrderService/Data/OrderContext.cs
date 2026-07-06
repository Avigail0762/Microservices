using Microsoft.EntityFrameworkCore;
using OrderService.Models;

namespace OrderService.Data
{
    public class OrderContext : DbContext
    {
        public DbSet<User> Users { get; set; }
        public DbSet<Ticket> Tickets { get; set; }

        public OrderContext(DbContextOptions<OrderContext> options) : base(options) { }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Ticket>()
                .HasOne(t => t.User)
                .WithMany()
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            // GiftId is a reference to ProductCatalogService — no local FK constraint.
            modelBuilder.Entity<Ticket>()
                .Property(t => t.GiftId)
                .IsRequired();

            modelBuilder.Entity<Ticket>()
                .HasIndex(t => t.CorrelationId)
                .IsUnique();

            base.OnModelCreating(modelBuilder);
        }
    }
}
