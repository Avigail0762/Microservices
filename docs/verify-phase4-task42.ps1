$ErrorActionPreference = 'Stop'

Write-Host '== TASK 4.2 VERIFY: Start stack =='
docker compose down --remove-orphans | Out-Null
docker compose up --build -d | Out-Null

Write-Host '== STEP 1: Seed catalog =='
docker cp docs/seed-catalog.js microservices-mongodb-catalog-1:/tmp/seed-catalog.js | Out-Null
docker exec microservices-mongodb-catalog-1 mongosh --quiet /tmp/seed-catalog.js | Out-Null

Write-Host '== STEP 2: Register/login user =='
$registerBody = @{ username='phase42user'; email='phase42user@example.com'; phone='0500002222'; password='Pass123!' } | ConvertTo-Json
try { Invoke-RestMethod -Uri 'http://localhost:8080/api/customer/register' -Method Post -ContentType 'application/json' -Body $registerBody | Out-Null } catch { }
$loginBody = @{ username='phase42user'; password='Pass123!' } | ConvertTo-Json
$login = Invoke-RestMethod -Uri 'http://localhost:8080/api/auth/login' -Method Post -ContentType 'application/json' -Body $loginBody
$token = $login.token
$userId = $login.userId
$headers = @{ Authorization = "Bearer $token" }

Write-Host '== STEP 3: Place order (publishes OrderPlaced) =='
Invoke-RestMethod -Uri "http://localhost:8080/api/customer/cart/add?userId=$userId&giftId=1001" -Method Post -Headers $headers | Out-Null
Invoke-RestMethod -Uri "http://localhost:8080/api/customer/purchase?userId=$userId" -Method Post -Headers $headers | Out-Null

Write-Host '== STEP 4: Wait for saga convergence =='
$converged = $false
for ($i = 0; $i -lt 20; $i++) {
  $tickets = Invoke-RestMethod -Uri "http://localhost:8080/api/customer/tickets?userId=$userId" -Method Get -Headers $headers
  if ($tickets -and $tickets[0].orderStatus -eq 'Confirmed') {
    $converged = $true
    break
  }
  Start-Sleep -Seconds 2
}
if (-not $converged) { throw 'Saga did not reach Confirmed state in time' }

Write-Host '== STEP 5: Show event queues =='
docker exec microservices-rabbitmq-1 rabbitmqctl list_queues name messages_ready messages_unacknowledged

Write-Host 'PASS: Task 4.2 choreography path executed (OrderPlaced -> InventoryReserved -> Order finalized -> Notification triggered)'