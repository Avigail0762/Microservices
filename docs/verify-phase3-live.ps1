$ErrorActionPreference = 'Stop'

Write-Host '== STEP 1: Check exposed ports (gateway only) =='
$psOut = docker compose ps
$psOut
if ($psOut -match '0\.0\.0\.0:8080->8080/tcp' -and $psOut -notmatch '0\.0\.0\.0:8081->' -and $psOut -notmatch '0\.0\.0\.0:8082->' -and $psOut -notmatch '0\.0\.0\.0:8083->' -and $psOut -notmatch '0\.0\.0\.0:8084->') {
  Write-Host 'PASS: only gateway is published to host'
} else {
  Write-Host 'WARN: unexpected published backend ports detected'
}

Write-Host '== STEP 2: Gateway health (with readiness retries) =='
$health = $null
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 750
  $health = curl.exe -s -i http://localhost:8080/health
  if ($health -match '200 OK') { break }
}
$health
if ($health -match '200 OK') { Write-Host 'PASS: gateway health OK' } else { throw 'Gateway health failed after retries' }

Write-Host '== STEP 3: Seed catalog data =='
docker cp docs/seed-catalog.js microservices-mongodb-catalog-1:/tmp/seed-catalog.js | Out-Null
docker exec microservices-mongodb-catalog-1 mongosh --quiet /tmp/seed-catalog.js
$giftResp = curl.exe -s -i http://localhost:8080/api/gift/1001
$giftResp
if ($giftResp -match '200 OK' -and $giftResp -match 'X-Container-Id:') { Write-Host 'PASS: catalog reachable via gateway with container header' } else { throw 'Catalog gateway route/header failed' }

Write-Host '== STEP 4: Register/login/purchase/BFF aggregation =='
$registerBody = @{ username='phase3user'; email='phase3user@example.com'; phone='0500000000'; password='Pass123!' } | ConvertTo-Json
try { Invoke-RestMethod -Uri 'http://localhost:8080/api/customer/register' -Method Post -ContentType 'application/json' -Body $registerBody | Out-Null } catch { }
$loginBody = @{ username='phase3user'; password='Pass123!' } | ConvertTo-Json
$login = Invoke-RestMethod -Uri 'http://localhost:8080/api/auth/login' -Method Post -ContentType 'application/json' -Body $loginBody
$token = $login.token
$userId = $login.userId
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:8080/api/customer/cart/add?userId=$userId&giftId=1001" -Method Post -Headers $headers | Out-Null
Invoke-RestMethod -Uri "http://localhost:8080/api/customer/purchase?userId=$userId" -Method Post -Headers $headers | Out-Null
$bff = Invoke-RestMethod -Uri "http://localhost:8080/api/bff/user/$userId/order-details" -Method Get -Headers $headers
$bffJson = $bff | ConvertTo-Json -Depth 8
Write-Output ("USER_ID=" + $userId)
Write-Output $bffJson
if ($bff.itemCount -ge 1 -and $bff.items[0].ticket -and $bff.items[0].gift) { Write-Host 'PASS: BFF aggregates order+catalog data' } else { throw 'BFF aggregation failed' }

Write-Host '== STEP 5: Load balancing header sampling =='
$ids = @()
1..10 | ForEach-Object {
  $resp = & curl.exe -s -D - -o NUL http://localhost:8080/api/gift/1001
  $line = ($resp | Select-String -Pattern '^X-Container-Id:' | Select-Object -First 1)
  if ($line) { $ids += (($line.ToString()) -replace 'X-Container-Id:\s*','').Trim() }
}
$distinctBefore = $ids | Sort-Object -Unique
Write-Output ('IDS_BEFORE=' + ($ids -join ','))
Write-Output ('DISTINCT_BEFORE=' + ($distinctBefore -join ','))
if ($distinctBefore.Count -ge 1) { Write-Host 'PASS: container header captured' } else { throw 'No container header values captured' }

Write-Host '== STEP 6: Failover test (kill one replica) =='
$toKill = (docker ps --format '{{.Names}}' | Select-String 'microservices-product-catalog-service-' | Select-Object -First 1).ToString().Trim()
docker stop $toKill | Out-Null
Start-Sleep -Seconds 2
$afterStatuses = @()
$idsAfter = @()
1..6 | ForEach-Object {
  $resp = & curl.exe -s -i http://localhost:8080/api/gift/1001
  if ($resp -match 'HTTP/1\.1 200 OK') { $afterStatuses += '200' }
  $line = ($resp | Select-String -Pattern '^X-Container-Id:' | Select-Object -First 1)
  if ($line) { $idsAfter += (($line.ToString()) -replace 'X-Container-Id:\s*','').Trim() }
}
$distinctAfter = $idsAfter | Sort-Object -Unique
Write-Output ('KILLED=' + $toKill)
Write-Output ('AFTER_STATUS_CODES=' + ($afterStatuses -join ','))
Write-Output ('DISTINCT_AFTER=' + ($distinctAfter -join ','))
if ($afterStatuses.Count -eq 6) { Write-Host 'PASS: system continues serving after replica kill' } else { throw 'Failover check failed' }

Write-Host '== FINAL RESULT: Phase 3 runtime checks completed =='
