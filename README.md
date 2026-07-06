# Microservices Project

## Project Overview
This repository contains a containerized microservices system for a sale and ticketing workflow.

Architecture is service-oriented with an API Gateway as the single external entry point. Business capabilities are separated by bounded context:

- GatewayService: reverse proxy and policy enforcement for external HTTP traffic.
- BffService: aggregation layer for composite client-facing responses.
- OrderService: authentication, user/customer operations, and transactional order data.
- ProductCatalogService: catalog and donor domain data.
- InventoryService: ticket projections, inventory workflows, and lottery-related operations.
- NotificationService: outbound notification workflows.

The stack runs with Docker Compose and includes supporting infrastructure services (SQL Server, MongoDB, RabbitMQ, Redis, Seq). Inter-service communication uses HTTP and event-driven messaging, while external access is consolidated through the API Gateway on port 8080.

## Prerequisites
- Docker Desktop (or Docker Engine) with Docker Compose v2 support
- Postman (for API validation)

## One-Command Startup
Run the complete environment from the repository root:

```bash
docker compose up --build
```

Expected result:
- All application and infrastructure containers are created and started.
- API Gateway is reachable at `http://localhost:8080`.

Optional stop command:

```bash
docker compose down
```

## Service Map and Gateway Endpoints
Base URL (external):

```text
http://localhost:8080Please generate a professional root README.md file for my microservices project repository based on the instructor's requirements: 'Git repository — all services, docker-compose.yml, and a root README.md with one-command startup instructions.'

The project structure includes the following services: GatewayService, BffService, OrderService, ProductCatalogService, InventoryService, and NotificationService, with a docker-compose.yml file at the root.

The README should include:

Project Overview: A brief technical description of the system architecture.

Prerequisites: Tools needed to run the project (Docker, Docker Compose, Postman).

One-Command Startup Instructions: Clear steps on how to build and run the entire stack using docker compose up --build.

Service Map / Endpoints: A concise list of the key external endpoints available via the API Gateway (port 8080), specifically highlighting the Register and Login routes (POST /api/customer/register and POST /api/auth/login).

Make the document dry, technical, and clean using standard Markdown formatting."
```

Key externally available routes via GatewayService:

| Method | Route | Description | Auth |
| --- | --- | --- | --- |
| POST | /api/customer/register | Register new customer account | No |
| POST | /api/auth/login | Authenticate and obtain JWT token | No |
| GET, POST, PATCH, DELETE | /api/customer/{**catch-all} | Customer operations (excluding explicit public routes) | Yes |
| GET, POST, PATCH, DELETE | /api/inventory/{**catch-all} | Inventory/ticket operations | Yes |
| GET, POST, PATCH, DELETE | /api/lottery/{**catch-all} | Lottery operations | Yes |
| GET, POST, PATCH, DELETE | /api/purchases/{**catch-all} | Purchase reporting/query operations | Yes |
| GET | /api/gift, /api/gift/{**catch-all} | Public catalog routes | No |
| GET, POST, PATCH, DELETE | /api/donor/{**catch-all} | Donor operations | Yes |
| GET, POST | /api/notification/{**catch-all} | Notification endpoints | Yes |
| GET | /api/bff/{**catch-all} | Aggregated BFF endpoints | Yes |

Authentication for protected routes uses Bearer JWT in the `Authorization` header.

## Quick Verification
1. Start all services:

   ```bash
   docker compose up --build
   ```

2. Verify gateway health:

   ```text
   GET http://localhost:8080/health
   ```

3. Verify authentication flow through gateway:
- Register: `POST /api/customer/register`
- Login: `POST /api/auth/login`
- Use returned JWT token on a protected route (for example, `/api/customer/{...}`).