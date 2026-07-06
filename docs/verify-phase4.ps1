$ErrorActionPreference = 'Stop'

Write-Host '== PHASE 4 VERIFY: Recreate stack with RabbitMQ =='
docker compose down --remove-orphans | Out-Null
docker compose up --build -d --scale product-catalog-service=2 | Out-Null

Write-Host '== STEP 1: RabbitMQ health =='
$rabbit = docker compose ps rabbitmq
$rabbit
$rabbitStatus = docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" microservices-rabbitmq-1
if ($rabbitStatus -ne 'healthy') {
  throw "RabbitMQ is not healthy (status=$rabbitStatus)"
}
Write-Host 'PASS: RabbitMQ healthy'

Write-Host '== STEP 2: Seed catalog data =='
docker cp docs/seed-catalog.js microservices-mongodb-catalog-1:/tmp/seed-catalog.js | Out-Null
docker exec microservices-mongodb-catalog-1 mongosh --quiet /tmp/seed-catalog.js | Out-Null

# Wait for gateway readiness after stack recreation.
$gatewayOk = $false
for ($i = 0; $i -lt 30; $i++) {
  $healthResp = curl.exe -s -i http://localhost:8080/health
  if ($healthResp -match '200 OK') {
    $gatewayOk = $true
    break
  }
  Start-Sleep -Milliseconds 500
}
if (-not $gatewayOk) { throw 'Gateway did not become ready in time' }

$giftResp = $null
$statusLine = ''
for ($i = 0; $i -lt 60; $i++) {
  $giftResp = curl.exe -s -i http://localhost:8080/api/gift/1001
  $statusLine = (($giftResp | Select-Object -First 1) -as [string])
  if ($statusLine -match '200 OK') { break }
  Start-Sleep -Milliseconds 1000
}
if ($statusLine -notmatch '200 OK') {
  throw "Catalog seed or route failed (lastStatus=$statusLine)"
}
Write-Host 'PASS: Catalog seeded and reachable'

Write-Host '== STEP 3: Register/login/purchase =='
$runId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$phase4Username = "phase4user$runId"
$phase4Email = "phase4user$runId@example.com"
$registerBody = @{ username=$phase4Username; email=$phase4Email; phone='0500001111'; password='Pass123!' } | ConvertTo-Json
$registered = $false
for ($i = 0; $i -lt 40; $i++) {
  try {
    Invoke-RestMethod -Uri 'http://localhost:8080/api/customer/register' -Method Post -ContentType 'application/json' -Body $registerBody | Out-Null
    $registered = $true
    break
  } catch {
    Start-Sleep -Milliseconds 750
  }
}
if (-not $registered) {
  throw 'Customer register did not become ready in time'
}
$loginBody = @{ username=$phase4Username; password='Pass123!' } | ConvertTo-Json
$login = $null
for ($i = 0; $i -lt 30; $i++) {
  try {
    $login = Invoke-RestMethod -Uri 'http://localhost:8080/api/auth/login' -Method Post -ContentType 'application/json' -Body $loginBody
    if ($login -and $login.token -and $login.userId) { break }
  } catch {
    Start-Sleep -Milliseconds 750
  }
}
if (-not $login -or -not $login.token -or -not $login.userId) {
  throw 'Auth login did not become ready in time'
}
$token = $login.token
$userId = $login.userId
$headers = @{ Authorization = "Bearer $token" }

Invoke-RestMethod -Uri "http://localhost:8080/api/customer/cart/add?userId=$userId&giftId=1001" -Method Post -Headers $headers | Out-Null
Invoke-RestMethod -Uri "http://localhost:8080/api/customer/purchase?userId=$userId" -Method Post -Headers $headers | Out-Null
Write-Host 'PASS: Purchase request accepted'

Write-Host '== STEP 4: Eventually consistent projection check =='
$found = $false
for ($i = 0; $i -lt 15; $i++) {
  $bff = Invoke-RestMethod -Uri "http://localhost:8080/api/bff/user/$userId/order-details" -Method Get -Headers $headers
  if ($bff.itemCount -ge 1 -and $bff.items[0].ticket -and $bff.items[0].gift) {
    $found = $true
    break
  }
  Start-Sleep -Seconds 2
}
if (-not $found) { throw 'BFF projection did not converge in time' }
Write-Host 'PASS: Async side effects converged'

Write-Host '== STEP 5: RabbitMQ queue visibility =='
$queues = docker exec microservices-rabbitmq-1 rabbitmqctl list_queues name messages_ready messages_unacknowledged
$queues
# Catalog queue name changed from old gift-purchased to inventory-reserved in current choreography.
$catalogQueueFound = ($queues -match 'product-catalog.gift-purchased') -or ($queues -match 'product-catalog.inventory-reserved')
$inventoryQueueFound = ($queues -match 'inventory.gift-purchased') -or ($queues -match 'inventory.order-placed')
if (-not $catalogQueueFound -or -not $inventoryQueueFound) {
  throw 'Expected queues not found (catalog or inventory queue missing)'
}
Write-Host 'PASS: Expected queues exist'

Write-Host '== STEP 6: Cache-aside verification (MISS -> HIT -> INVALIDATE -> MISS) =='

# Reset target key so MISS -> HIT is deterministic across repeated runs.
docker exec microservices-redis-1 redis-cli DEL productcatalog:gift:id:1001 | Out-Null

# 1) Warm read twice and verify logs include both MISS and HIT
curl.exe -s http://localhost:8080/api/gift/1001 | Out-Null
curl.exe -s http://localhost:8080/api/gift/1001 | Out-Null

$cacheLogs = docker compose logs product-catalog-service --tail 400
if ($cacheLogs -notmatch 'CACHE_MISS context=giftRepository.getById key=productcatalog:gift:id:1001') {
  throw 'Expected CACHE_MISS log for gift 1001 not found'
}
if ($cacheLogs -notmatch 'CACHE_HIT context=giftRepository.getById key=productcatalog:gift:id:1001') {
  throw 'Expected CACHE_HIT log for gift 1001 not found'
}

# 2) Update gift through manager route and verify invalidation + miss after update
$managerRegBody = @{ username='phase4manager'; email='phase4manager@example.com'; phone='0500002222'; password='Pass123!'; role='manager' } | ConvertTo-Json
try { Invoke-RestMethod -Uri 'http://localhost:8080/api/customer/register' -Method Post -ContentType 'application/json' -Body $managerRegBody | Out-Null } catch { }
$managerLoginBody = @{ username='phase4manager'; password='Pass123!' } | ConvertTo-Json
$managerLogin = Invoke-RestMethod -Uri 'http://localhost:8080/api/auth/login' -Method Post -ContentType 'application/json' -Body $managerLoginBody
$managerToken = $managerLogin.token
$managerHeaders = @{ Authorization = "Bearer $managerToken" }

$existingGift = Invoke-RestMethod -Uri 'http://localhost:8080/api/gift/1001' -Method Get
$updatedGiftBody = @{
  name = $existingGift.name
  description = $existingGift.description
  donorId = $existingGift.donorId
  price = [decimal]$existingGift.price
  buyersNumber = [int]$existingGift.buyersNumber
  category = $existingGift.category
  winnerTicketId = $existingGift.winnerTicketId
  isDrawn = [bool]$existingGift.isDrawn
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:8080/api/gift/1001' -Method Put -Headers $managerHeaders -ContentType 'application/json' -Body $updatedGiftBody | Out-Null

curl.exe -s http://localhost:8080/api/gift/1001 | Out-Null
$cacheLogsAfterUpdate = docker compose logs product-catalog-service --tail 600
if ($cacheLogsAfterUpdate -notmatch 'CACHE_INVALIDATE') {
  throw 'Expected cache invalidation log not found after update'
}
if ($cacheLogsAfterUpdate -notmatch 'gift_updated') {
  throw 'Expected gift_updated invalidation reason not found'
}
if ($cacheLogsAfterUpdate -notmatch 'CACHE_MISS context=giftRepository.getById key=productcatalog:gift:id:1001') {
  throw 'Expected CACHE_MISS log after update not found'
}

Write-Host 'PASS: Cache hit/miss and invalidation behavior verified'

Write-Host '== FINAL RESULT: Phase 4.1 runtime checks completed =='
