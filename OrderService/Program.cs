using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OrderService.Data;
using OrderService.Messaging;
using OrderService.Repositories;
using OrderService.Repositories.Interfaces;
using OrderService.Services;
using OrderService.Services.Interfaces;
using Serilog;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext());

// ── Database ─────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<OrderContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── DI ───────────────────────────────────────────────────────────────────────
builder.Services.AddScoped<ICustomerRepository, CustomerRepository>();
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.Configure<RabbitMqOptions>(builder.Configuration.GetSection("RabbitMQ"));
builder.Services.AddSingleton<IEventPublisher, RabbitMqEventPublisher>();
builder.Services.AddHostedService<OrderSagaConsumer>();
builder.Services.AddMemoryCache();
builder.Services.AddAutoMapper(AppDomain.CurrentDomain.GetAssemblies());

// ── HttpClients for inter-service communication ───────────────────────────────
builder.Services.AddHttpClient("CatalogClient", client =>
    client.BaseAddress = new Uri(builder.Configuration["Services:CatalogUrl"]!));

builder.Services.AddHttpClient("InventoryClient", client =>
    client.BaseAddress = new Uri(builder.Configuration["Services:InventoryUrl"]!));

// ── JWT Authentication ────────────────────────────────────────────────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });

// ── Swagger ───────────────────────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "OrderService API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter: Bearer {token}",
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);

builder.Services.AddCors(options =>
    options.AddPolicy("AllowAll",
        policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddHealthChecks();

var app = builder.Build();

// ── Ensure DB schema exists and seed manager user ─────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OrderContext>();
    db.Database.EnsureCreated();

    // Upgrade legacy DBs created before saga fields were added to Ticket.
    db.Database.ExecuteSqlRaw(@"
IF COL_LENGTH('Tickets', 'CorrelationId') IS NULL
    ALTER TABLE Tickets ADD CorrelationId nvarchar(64) NULL;
");

    db.Database.ExecuteSqlRaw(@"
IF COL_LENGTH('Tickets', 'CorrelationId') IS NOT NULL
    UPDATE Tickets
    SET CorrelationId = REPLACE(CONVERT(varchar(36), NEWID()), '-', '')
    WHERE CorrelationId IS NULL;
");

    db.Database.ExecuteSqlRaw(@"
IF COL_LENGTH('Tickets', 'CorrelationId') IS NOT NULL
   AND EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'IX_Tickets_CorrelationId'
        AND object_id = OBJECT_ID('Tickets')
   )
    DROP INDEX IX_Tickets_CorrelationId ON Tickets;
");

    db.Database.ExecuteSqlRaw(@"
IF COL_LENGTH('Tickets', 'CorrelationId') IS NOT NULL
    ALTER TABLE Tickets ALTER COLUMN CorrelationId nvarchar(64) NOT NULL;
");

    db.Database.ExecuteSqlRaw(@"
IF COL_LENGTH('Tickets', 'SagaId') IS NULL
    ALTER TABLE Tickets ADD SagaId nvarchar(128) NULL;
");

    db.Database.ExecuteSqlRaw(@"
IF COL_LENGTH('Tickets', 'SagaId') IS NOT NULL
    UPDATE Tickets
    SET SagaId = CONCAT('legacy-', CAST(Id AS varchar(20)))
    WHERE SagaId IS NULL;
");

    db.Database.ExecuteSqlRaw(@"
IF COL_LENGTH('Tickets', 'SagaId') IS NOT NULL
    ALTER TABLE Tickets ALTER COLUMN SagaId nvarchar(128) NOT NULL;
");

    db.Database.ExecuteSqlRaw(@"
IF COL_LENGTH('Tickets', 'OrderStatus') IS NULL
    ALTER TABLE Tickets ADD OrderStatus nvarchar(32) NULL;
");

    db.Database.ExecuteSqlRaw(@"
IF COL_LENGTH('Tickets', 'OrderStatus') IS NOT NULL
    UPDATE Tickets
    SET OrderStatus = 'Completed'
    WHERE OrderStatus IS NULL;
");

    db.Database.ExecuteSqlRaw(@"
IF COL_LENGTH('Tickets', 'OrderStatus') IS NOT NULL
    ALTER TABLE Tickets ALTER COLUMN OrderStatus nvarchar(32) NOT NULL;
");

    db.Database.ExecuteSqlRaw(@"
IF COL_LENGTH('Tickets', 'CorrelationId') IS NOT NULL
   AND NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'IX_Tickets_CorrelationId'
        AND object_id = OBJECT_ID('Tickets')
   )
    CREATE UNIQUE INDEX IX_Tickets_CorrelationId ON Tickets (CorrelationId);
");

    if (!db.Users.Any())
    {
        db.Users.Add(new OrderService.Models.User
        {
            Username = "Avigail Maayani",
            Email = "a0583290762@gmail.com",
            Phone = "0583290762",
            PasswordHash = "$2a$11$kWQWRcW0yZzTfcteU0tW4.hUxb6OWhRvLybxoCM21Sg4rEKnAvuO6",
            Role = "manager"
        });
        db.SaveChanges();
    }
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapHealthChecks("/health");
app.MapControllers();
app.Run();
