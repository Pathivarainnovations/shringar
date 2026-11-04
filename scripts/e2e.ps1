<#
.SYNOPSIS
  End-to-end API test for Shringar, written for Windows PowerShell 5.1 and PowerShell 7.

.DESCRIPTION
  By default the script is self-contained and never touches your real database:
    1. creates a temporary database folder,
    2. loads the reference data (backend\scripts\init-reference-data.js),
    3. starts a temporary backend on -Port with ADMIN_EMAIL = -AdminEmail,
    4. runs the whole scenario below through the HTTP API (Invoke-RestMethod, one web session per user),
    5. stops the backend and deletes the temporary files.

  Scenario: admin bootstrap by emailed code -> customer and provider sign up -> provider applies, admin approves ->
  provider sets a price, adds staff and a promotion -> customer books -> provider accepts, sends a location ->
  customer reads tracking -> provider marks done and cash received -> customer reviews -> admin sees the
  statistics and commission -> role (401/403) checks -> rate limiting.

.PARAMETER BaseUrl
  Test an already running backend instead (for example http://localhost:4000/api). That backend must be on a
  FRESH database, started with ADMIN_EMAIL = -AdminEmail, NODE_ENV not "production", with the reference data
  loaded. Nothing is started or deleted in this mode.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\e2e.ps1
#>
[CmdletBinding()]
param(
  [string]$BaseUrl = "",
  [int]$Port = 4188,
  [string]$AdminEmail = "owner@example.com"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"

$script:Pass = 0
$script:Fail = New-Object System.Collections.ArrayList
$script:Sessions = @{}
$script:Api = ""

# ----------------------------------------------------------------------------- helpers
function Call {
  param([string]$Who, [string]$Method, [string]$Path, $Body = $null)
  $params = @{ Uri = ($script:Api + $Path); Method = $Method; ErrorAction = "Stop" }
  if ($null -ne $Body) {
    $params.Body = ConvertTo-Json -InputObject $Body -Depth 8 -Compress
    $params.ContentType = "application/json"
  }
  if ($script:Sessions.ContainsKey($Who)) { $params.WebSession = $script:Sessions[$Who] }
  else { $params.SessionVariable = "newSession" }
  try {
    $data = Invoke-RestMethod @params
    if (-not $script:Sessions.ContainsKey($Who) -and $newSession) { $script:Sessions[$Who] = $newSession }
    return [pscustomobject]@{ Status = 200; Data = $data; Raw = "" }   # any 2xx
  } catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    $text = ""
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $text = $_.ErrorDetails.Message }
    $obj = $null
    try { $obj = $text | ConvertFrom-Json } catch { }
    return [pscustomobject]@{ Status = $status; Data = $obj; Raw = $text }
  }
}

function Check {
  param([string]$Name, [bool]$Condition, $Detail = "")
  if ($Condition) {
    $script:Pass++
    Write-Host ("  PASS  " + $Name) -ForegroundColor Green
  } else {
    [void]$script:Fail.Add($Name)
    Write-Host ("  FAIL  " + $Name + "   -> " + $Detail) -ForegroundColor Red
  }
}

# Expect an HTTP status (200 stands for "any 2xx") and, optionally, a condition on the response data.
function Expect {
  param([string]$Name, $Res, [int]$Status, [scriptblock]$Test = $null)
  $ok = ($Res.Status -eq $Status)
  $detail = "HTTP " + $Res.Status + " " + $Res.Raw
  if ($ok -and $Test) {
    $d = $Res.Data
    $passed = $false
    try { $passed = [bool](& $Test $d) } catch { $detail = "check threw: " + $_.Exception.Message }
    if (-not $passed) { $ok = $false; $detail = "unexpected data: " + (ConvertTo-Json -InputObject $Res.Data -Depth 4 -Compress) }
  }
  Check -Name ($Name + " [HTTP " + $Status + "]") -Condition $ok -Detail $detail
  return $Res.Data
}

function Section([string]$Title) { Write-Host ""; Write-Host ("== " + $Title) -ForegroundColor Cyan }

function SignUp {
  param([string]$Who, [string]$Email, [string]$Name)
  $a = Call $Who POST "/auth/signup" @{ email = $Email }
  return (Call $Who POST "/auth/signup/verify" @{ email = $Email; code = $a.Data.devCode; name = $Name; password = "password123" })
}

# ----------------------------------------------------------------------------- start a temporary backend
$proc = $null
$tmp = $null
$envNames = @("DB_FILE", "PORT", "ADMIN_EMAIL", "ADMIN_NAME", "FRONTEND_ORIGIN", "NODE_ENV", "SMTP_HOST", "RESEND_API_KEY")
$envBackup = @{}

try {
  if ($BaseUrl) {
    $script:Api = $BaseUrl.TrimEnd("/")
    Write-Host ("Testing the backend that is already running at " + $script:Api)
  } else {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "node was not found on PATH. Install Node.js 20 or newer." }
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("shringar-e2e-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    foreach ($n in $envNames) { $envBackup[$n] = [Environment]::GetEnvironmentVariable($n) }
    $env:DB_FILE = Join-Path $tmp "e2e.db"
    $env:PORT = [string]$Port
    $env:ADMIN_EMAIL = $AdminEmail
    $env:ADMIN_NAME = "E2E Admin"
    $env:FRONTEND_ORIGIN = "http://localhost:3000"
    $env:NODE_ENV = "development"   # sign-in codes are returned in the API response (never in production)
    $env:SMTP_HOST = ""             # empty (not unset) so a real backend\.env cannot send real email
    $env:RESEND_API_KEY = ""

    Push-Location $backend
    try {
      & node scripts/init-reference-data.js | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "init-reference-data.js failed" }
    } finally { Pop-Location }

    $proc = Start-Process -FilePath "node" -ArgumentList "src/server.js" -WorkingDirectory $backend -PassThru -NoNewWindow `
      -RedirectStandardOutput (Join-Path $tmp "server.out.log") -RedirectStandardError (Join-Path $tmp "server.err.log")
    $script:Api = "http://localhost:$Port/api"

    $up = $false
    for ($i = 0; $i -lt 60 -and -not $up; $i++) {
      Start-Sleep -Milliseconds 250
      try { $h = Invoke-RestMethod -Uri ($script:Api + "/health") -ErrorAction Stop; if ($h.ok) { $up = $true } } catch { }
    }
    if (-not $up) { throw "The temporary backend did not start on port $Port (is the port free?). See $tmp\server.err.log" }
    Write-Host ("Temporary backend running on port " + $Port + " with a fresh database in " + $tmp)
  }

  # ------------------------------------------------------------------------- 1. auth
  Section "1. Admin bootstrap and authentication"
  $a = Call anon POST "/auth/request-otp" @{ email = $AdminEmail }
  Check "OTP code returned in development" ([bool]$a.Data.devCode) $a.Raw
  $r = Call admin POST "/auth/verify-otp" @{ email = $AdminEmail; code = $a.Data.devCode }
  [void](Expect "admin signs in with the emailed code (account was bootstrapped from ADMIN_EMAIL)" $r 200 { param($d) $d.user.role -eq "admin" })
  $me = Call admin GET "/auth/me"
  Check "/auth/me never exposes a password hash" ((ConvertTo-Json -InputObject $me.Data -Depth 5) -cnotmatch 'password_hash|"password"') ""
  [void](Expect "customer signs up (email code + password)" (SignUp cust "asha@example.com" "Asha Rai") 200 { param($d) $d.user.role -eq "customer" -and $d.user.referralCode -like "SHR*" })
  [void](Expect "second customer signs up (used for ownership checks)" (SignUp cust2 "other@example.com" "Other Person") 200)
  [void](Expect "provider-to-be signs up as a normal customer first" (SignUp prov "sita@example.com" "Sita Rai") 200)
  [void](Expect "password login works" (Call tmp1 POST "/auth/login" @{ email = "asha@example.com"; password = "password123" }) 200)
  [void](Expect "wrong password is refused" (Call tmp2 POST "/auth/login" @{ email = "asha@example.com"; password = "not-the-password" }) 401)

  # ------------------------------------------------------------------------- 2. onboarding
  Section "2. Provider applies, admin approves"
  [void](Expect "anonymous application is refused" (Call anon POST "/partner/apply" @{ name = "x" }) 401)
  [void](Expect "provider applies as a salon (signed in)" (Call prov POST "/partner/apply" @{ name = "Sita Salon"; phone = "9841000001"; type = "salon"; service = "Haircut"; area = "Thamel"; idNote = "CTZ 12-34" }) 200)
  [void](Expect "a second pending application is refused" (Call prov POST "/partner/apply" @{ name = "Sita Salon"; phone = "9841000001"; type = "salon"; service = "Haircut"; area = "Thamel"; idNote = "again" }) 409)
  $apps = (Call admin GET "/admin/applications").Data.applications
  $app = @($apps) | Where-Object { $_.name -eq "Sita Salon" } | Select-Object -First 1
  Check "admin sees the pending application" ($null -ne $app -and $app.status -eq "pending") ""
  [void](Expect "a customer cannot approve applications" (Call cust PATCH ("/admin/applications/" + $app.id) @{ status = "approved" }) 403)
  [void](Expect "admin approves the application" (Call admin PATCH ("/admin/applications/" + $app.id) @{ status = "approved" }) 200)
  [void](Expect "approving twice is refused" (Call admin PATCH ("/admin/applications/" + $app.id) @{ status = "approved" }) 409)
  [void](Expect "the applicant's own account became a provider (no placeholder user)" (Call prov GET "/auth/me") 200 { param($d) $d.user.role -eq "provider" })

  # ------------------------------------------------------------------------- 3. provider setup
  Section "3. Provider sets up services, staff, promotion, travel fee, availability"
  $services = @((Call anon GET "/services").Data.services)
  Check "reference data loaded: 8 catalogue services" ($services.Count -eq 8) ("found " + $services.Count)
  [void](Expect "a negative price is refused" (Call prov PUT "/provider/services/1" @{ price = -5 }) 400)
  [void](Expect "provider prices service 1 at NPR 1200" (Call prov PUT "/provider/services/1" @{ price = 1200 }) 200)
  [void](Expect "provider prices service 2 at NPR 1800" (Call prov PUT "/provider/services/2" @{ price = 1800 }) 200)
  [void](Expect "provider adds a staff member" (Call prov POST "/provider/staff" @{ name = "Maya"; specialty = "Hair" }) 200 { param($d) $d.staff.name -eq "Maya" })
  [void](Expect "provider creates promotion PROV10 (10%)" (Call prov POST "/provider/promotions" @{ code = "prov10"; percent = 10; minAmount = 0 }) 200 { param($d) $d.promotion.code -eq "PROV10" -and $d.promotion.usedCount -eq 0 })
  [void](Expect "a 90% promotion is refused" (Call prov POST "/provider/promotions" @{ code = "HUGE"; percent = 90 }) 400)
  [void](Expect "provider sets travel fee 300 and phone" (Call prov POST "/provider/profile" @{ travelFee = 300; travelRadius = 10; phone = "9841000001" }) 200 { param($d) $d.provider.travel_fee -eq 300 -and $null -eq $d.provider.rating })
  [void](Expect "provider saves weekly availability" (Call prov PUT "/provider/availability" @{ days = @(@{ dayOfWeek = 1; start = "10:00"; end = "18:00" }, @{ dayOfWeek = 2; start = "10:00"; end = "18:00" }) }) 200)
  [void](Expect "availability with end before start is refused" (Call prov PUT "/provider/availability" @{ days = @(@{ dayOfWeek = 1; start = "18:00"; end = "10:00" }) }) 400)
  $pub = @((Call anon GET "/providers").Data.providers) | Where-Object { $_.name -eq "Sita Salon" } | Select-Object -First 1
  Check "public list shows the provider with their own lowest price and no rating yet" ($pub.priceFrom -eq 1200 -and $null -eq $pub.rating -and -not ($pub.PSObject.Properties.Name -contains "phone")) ""

  # ------------------------------------------------------------------------- 4. booking
  Section "4. Customer books (provider's own prices, first-booking discount)"
  $q = (Call cust POST "/bookings/price" @{ serviceIds = @(1, 2); mode = "home"; providerId = $pub.id }).Data
  Check "quote: 3000 services + 300 travel - 600 first-booking (20%) = 2700" ($q.servicesTotal -eq 3000 -and $q.travelFee -eq 300 -and $q.discount -eq 600 -and $q.total -eq 2700) (ConvertTo-Json -InputObject $q -Compress)
  [void](Expect "a service the provider does not offer is refused" (Call cust POST "/bookings/price" @{ serviceIds = @(3); mode = "home"; providerId = $pub.id }) 409)
  [void](Expect "an unknown coupon is refused" (Call cust POST "/bookings" @{ serviceIds = @(1); mode = "home"; startHour = 11; address = "Thamel 5"; providerId = $pub.id; couponCode = "NOPE" }) 400)
  [void](Expect "a non-numeric hour is refused" (Call cust POST "/bookings" @{ serviceIds = @(1); mode = "home"; startHour = "abc"; address = "x"; providerId = $pub.id }) 400)
  [void](Expect "a guest cannot book" (Call anon POST "/bookings" @{ serviceIds = @(1); mode = "home"; startHour = 11; address = "x"; providerId = $pub.id }) 401)
  $b = Expect "customer books home visits with the provider (total 2700)" (Call cust POST "/bookings" @{ serviceIds = @(1, 2); mode = "home"; startHour = 11; address = "House 7, Thamel, Kathmandu"; providerId = $pub.id }) 200 { param($d) $d.booking.total -eq 2700 -and $d.booking.status -eq "requested" }
  $bid = $b.booking.id
  [void](Expect "another customer cannot read the booking (404, existence not leaked)" (Call cust2 GET ("/bookings/" + $bid)) 404)

  # ------------------------------------------------------------------------- 5. provider handles it, tracking
  Section "5. Provider accepts, tracking, done, cash received"
  $reqs = (Call prov GET "/provider/requests").Data.requests
  $mine = @($reqs) | Where-Object { $_.id -eq $bid } | Select-Object -First 1
  Check "provider sees the request: customer first name only, their own price" ($mine.customerName -eq "Asha" -and $mine.yourPrice -eq 2700 -and -not ($mine.PSObject.Properties.Name -contains "userId")) ""
  [void](Expect "a status cannot jump from requested to done" (Call prov POST ("/bookings/" + $bid + "/status") @{ status = "done" }) 409)
  $staffId = (Call prov GET "/provider/staff").Data.staff[0].id
  [void](Expect "provider accepts and assigns Maya" (Call prov POST ("/bookings/" + $bid + "/accept") @{ staffId = $staffId }) 200 { param($d) $d.booking.status -eq "accepted" -and $d.booking.staffId -eq $staffId })
  [void](Expect "accepting twice is refused" (Call prov POST ("/bookings/" + $bid + "/accept") @{}) 409)
  [void](Expect "wallet payment with no balance is refused" (Call cust POST ("/bookings/" + $bid + "/pay") @{ method = "wallet" }) 409)
  [void](Expect "an unsupported payment method is refused" (Call cust POST ("/bookings/" + $bid + "/pay") @{ method = "esewa" }) 400)
  [void](Expect "customer chooses cash" (Call cust POST ("/bookings/" + $bid + "/pay") @{ method = "cash" }) 200 { param($d) $d.booking.payStatus -eq "cash_due" })
  [void](Expect "customer messages the provider" (Call cust POST ("/bookings/" + $bid + "/messages") @{ body = "See you at 11" }) 200)
  [void](Expect "provider reads and replies" (Call prov POST ("/bookings/" + $bid + "/messages") @{ body = "On my way soon" }) 200)
  [void](Expect "a stranger cannot read the chat" (Call cust2 GET ("/bookings/" + $bid + "/messages")) 404)
  [void](Expect "no live location before the trip starts" (Call cust GET ("/tracking/" + $bid)) 200 { param($d) $null -eq $d.tracking })
  [void](Expect "a location cannot be sent before the trip starts" (Call prov POST "/tracking/location" @{ bookingId = $bid; lat = 27.7; lng = 85.3 }) 409)
  [void](Expect "provider starts the trip" (Call prov POST ("/bookings/" + $bid + "/status") @{ status = "on_the_way" }) 200)
  [void](Expect "an impossible latitude is refused" (Call prov POST "/tracking/location" @{ bookingId = $bid; lat = 999; lng = 85.3 }) 400)
  [void](Expect "provider sends a location" (Call prov POST "/tracking/location" @{ bookingId = $bid; lat = 27.7172; lng = 85.324; etaMinutes = 12 }) 200)
  [void](Expect "customer reads the live position" (Call cust GET ("/tracking/" + $bid)) 200 { param($d) $d.tracking.lat -eq 27.7172 -and $d.tracking.lng -eq 85.324 -and $d.tracking.etaMinutes -eq 12 -and $d.tracking.status -eq "on_the_way" })
  [void](Expect "a stranger cannot read the position" (Call cust2 GET ("/tracking/" + $bid)) 404)
  [void](Expect "admin sees the provider on the live map" (Call admin GET "/admin/live-locations") 200 { param($d) @($d.locations).Count -eq 1 -and $d.locations[0].providerName -eq "Sita Salon" })
  [void](Expect "customer cannot cancel once the provider is on the way" (Call cust POST ("/bookings/" + $bid + "/cancel") @{}) 409)
  [void](Expect "provider marks arrived" (Call prov POST ("/bookings/" + $bid + "/status") @{ status = "arrived" }) 200)
  [void](Expect "provider starts the service" (Call prov POST ("/bookings/" + $bid + "/status") @{ status = "in_progress" }) 200)
  [void](Expect "provider marks done: commission = 15% of (2700 - 300 travel) = 360" (Call prov POST ("/bookings/" + $bid + "/status") @{ status = "done" }) 200 { param($d) $d.booking.status -eq "done" -and $d.booking.commissionAmount -eq 360 -and $d.booking.providerEarning -eq 2340 })
  [void](Expect "tracking is hidden after completion" (Call cust GET ("/tracking/" + $bid)) 200 { param($d) $null -eq $d.tracking })
  [void](Expect "provider records cash received" (Call prov POST ("/bookings/" + $bid + "/cash-received") @{}) 200 { param($d) $d.booking.payStatus -eq "paid" -and $d.booking.paidMethod -eq "cash" })
  [void](Expect "cash received twice is refused" (Call prov POST ("/bookings/" + $bid + "/cash-received") @{}) 409)

  # ------------------------------------------------------------------------- 6. review
  Section "6. Review, promotion, cancellation"
  [void](Expect "a stranger cannot review" (Call cust2 POST "/reviews" @{ bookingId = $bid; stars = 5 }) 404)
  [void](Expect "5+ stars are refused" (Call cust POST "/reviews" @{ bookingId = $bid; stars = 9 }) 400)
  [void](Expect "customer reviews the completed booking" (Call cust POST "/reviews" @{ bookingId = $bid; stars = 4; text = "Lovely work" }) 200)
  [void](Expect "a second review is refused" (Call cust POST "/reviews" @{ bookingId = $bid; stars = 5 }) 409)
  [void](Expect "provider sees the review and a real average" (Call prov GET "/provider/reviews") 200 { param($d) $d.rating -eq 4 -and $d.reviewCount -eq 1 })
  $b2 = Expect "second booking with PROV10: 10% of 3000 = 300 off (not a first booking)" (Call cust POST "/bookings" @{ serviceIds = @(1, 2); mode = "home"; startHour = 14; address = "Thamel 9"; providerId = $pub.id; couponCode = "PROV10" }) 200 { param($d) $d.booking.discount -eq 300 -and $d.booking.total -eq 3000 -and $d.booking.couponCode -eq "PROV10" }
  $promo = @((Call prov GET "/provider/promotions").Data.promotions) | Where-Object { $_.code -eq "PROV10" } | Select-Object -First 1
  Check "promotion used_count incremented to 1" ($promo.usedCount -eq 1) ("usedCount=" + $promo.usedCount)
  [void](Expect "customer cancels the not-yet-accepted booking" (Call cust POST ("/bookings/" + $b2.booking.id + "/cancel") @{ reason = "changed my mind" }) 200 { param($d) $d.booking.status -eq "cancelled" })
  $promo = @((Call prov GET "/provider/promotions").Data.promotions) | Where-Object { $_.code -eq "PROV10" } | Select-Object -First 1
  Check "promotion used_count returned to 0 after the cancellation" ($promo.usedCount -eq 0) ("usedCount=" + $promo.usedCount)

  # ------------------------------------------------------------------------- 7. admin numbers
  Section "7. Admin: statistics, commission, settlement"
  $st = (Call admin GET "/admin/stats").Data.stats
  Check "Total Users counts every role (admin 1 + providers 1 + customers 2 = 4)" ($st.users.total -eq 4 -and $st.users.byRole.admin -eq 1 -and $st.users.byRole.provider -eq 1 -and $st.users.byRole.customer -eq 2) (ConvertTo-Json -InputObject $st.users -Compress)
  Check "revenue comes from the completed booking: gross 2700, commission 360, provider 2340" ($st.revenue.gross -eq 2700 -and $st.revenue.commission -eq 360 -and $st.revenue.providerEarnings -eq 2340 -and $st.revenue.completedBookings -eq 1) (ConvertTo-Json -InputObject $st.revenue -Compress)
  Check "booking counts by status are real (1 done, 1 cancelled)" ($st.bookings.total -eq 2 -and $st.bookings.byStatus.done -eq 1 -and $st.bookings.byStatus.cancelled -eq 1) (ConvertTo-Json -InputObject $st.bookings -Compress)
  Check "providers: 1 active, 0 pending applications" ($st.providers.active -eq 1 -and $st.providers.pendingApplications -eq 0) (ConvertTo-Json -InputObject $st.providers -Compress)
  $cm = (Call admin GET "/admin/commission").Data
  $row = @($cm.providers) | Where-Object { $_.name -eq "Sita Salon" } | Select-Object -First 1
  Check "commission ledger: rate 15%, the provider (who holds the cash) owes NPR 360" ($cm.rate -eq 15 -and $row.cashCommission -eq 360 -and $row.balance -eq 360) (ConvertTo-Json -InputObject $row -Compress)
  [void](Expect "settling more than is owed is refused" (Call admin POST "/admin/settlements" @{ providerId = $pub.id; direction = "provider_paid"; amount = 999 }) 409)
  [void](Expect "a provider cannot record settlements" (Call prov POST "/admin/settlements" @{ providerId = $pub.id; direction = "provider_paid"; amount = 360 }) 403)
  [void](Expect "admin records the provider's NPR 360 payment" (Call admin POST "/admin/settlements" @{ providerId = $pub.id; direction = "provider_paid"; amount = 360 }) 200 { param($d) $d.ledger.balance -eq 0 })
  [void](Expect "provider earnings page: keeps 2340" (Call prov GET "/provider/earnings") 200 { param($d) $d.ledger.earning -eq 2340 -and @($d.bookings).Count -eq 1 })
  [void](Expect "admin user search never returns password data" (Call admin GET "/admin/users?q=asha") 200 { param($d) $d.total -eq 1 -and (ConvertTo-Json -InputObject $d -Depth 4) -cnotmatch 'password' })
  [void](Expect "admin reports list the top provider" (Call admin GET "/admin/reports?days=7") 200 { param($d) $d.topProviders[0].name -eq "Sita Salon" })
  [void](Expect "admin announcement reaches both providers and nobody else" (Call admin POST "/admin/announcements" @{ title = "Festival season"; body = "Expect more bookings"; audience = "providers" }) 200 { param($d) $d.recipients -eq 1 })
  [void](Expect "the provider got the announcement" (Call prov GET "/notifications") 200 { param($d) @($d.notifications | Where-Object { $_.type -eq "announcement" }).Count -eq 1 })
  [void](Expect "the customer did not" (Call cust GET "/notifications") 200 { param($d) @($d.notifications | Where-Object { $_.type -eq "announcement" }).Count -eq 0 })

  # ------------------------------------------------------------------------- 8. roles
  Section "8. Wrong role / not signed in"
  [void](Expect "anonymous -> customer bookings" (Call anon GET "/bookings") 401)
  [void](Expect "anonymous -> admin stats" (Call anon GET "/admin/stats") 401)
  [void](Expect "customer -> admin stats" (Call cust GET "/admin/stats") 403)
  [void](Expect "customer -> admin settings" (Call cust PUT "/admin/settings" @{ commission_rate = 1 }) 403)
  [void](Expect "customer -> provider requests" (Call cust GET "/provider/requests") 403)
  [void](Expect "provider -> admin stats" (Call prov GET "/admin/stats") 403)
  [void](Expect "provider -> customer booking list" (Call prov GET "/bookings") 403)
  [void](Expect "provider cannot create bookings" (Call prov POST "/bookings" @{ serviceIds = @(1); mode = "home"; startHour = 11; address = "x"; providerId = $pub.id }) 403)
  [void](Expect "another customer cannot answer someone else's offer" (Call cust2 PATCH "/offers/OFR-NOPE" @{ status = "accepted" }) 404)
  [void](Expect "no self-service wallet top-up route" (Call cust POST "/wallet" @{ amount = 5000 }) 404)
  [void](Expect "the old public coupon list is gone" (Call anon GET "/coupons") 404)
  [void](Expect "admin can read settings" (Call admin GET "/admin/settings") 200 { param($d) $d.settings.commission_rate -eq 15 })
  [void](Expect "admin rejects an invalid setting" (Call admin PUT "/admin/settings" @{ commission_rate = -5 }) 400)
  [void](Expect "malformed input does not crash the server" (Call anon POST "/auth/login" $null) 400)

  # ------------------------------------------------------------------------- 9. rate limiting
  Section "9. Rate limiting and code lockout"
  $codes = @()
  for ($i = 1; $i -le 7; $i++) { $codes += (Call spam POST "/auth/request-otp" @{ email = "spam@example.com" }).Status }
  Check "request-otp: 5 allowed, then 429 (statuses: $($codes -join ','))" ($codes[4] -eq 200 -and $codes[5] -eq 429 -and $codes[6] -eq 429) ""
  $t = Call brute POST "/auth/request-otp" @{ email = "brute@example.com" }
  $wrong = if ($t.Data.devCode -eq "000000") { "111111" } else { "000000" }
  $res = @(); for ($i = 1; $i -le 6; $i++) { $res += (Call brute POST "/auth/verify-otp" @{ email = "brute@example.com"; code = $wrong }).Status }
  Check "5 wrong codes are refused, the 6th attempt is locked (statuses: $($res -join ','))" ($res[0] -eq 400 -and $res[4] -eq 400 -and $res[5] -eq 429) ""
  [void](Expect "the correct code no longer works after the lockout" (Call brute POST "/auth/verify-otp" @{ email = "brute@example.com"; code = $t.Data.devCode }) 400)
  $lg = @(); for ($i = 1; $i -le 10; $i++) { $lg += (Call lim POST "/auth/login" @{ email = "ratelimit@example.com"; password = "wrongwrong" }).Status }
  Check "login: 8 failures answered 401, then 429 (statuses: $($lg -join ','))" ($lg[7] -eq 401 -and $lg[8] -eq 429) ""

  # ------------------------------------------------------------------------- 10. session
  Section "10. Logout"
  [void](Expect "logout" (Call cust POST "/auth/logout") 200)
  [void](Expect "after logout the session is gone" (Call cust GET "/auth/me") 200 { param($d) $null -eq $d.user })

} catch {
  Write-Host ""
  Write-Host ("ABORTED: " + $_.Exception.Message) -ForegroundColor Red
  [void]$script:Fail.Add("script aborted: " + $_.Exception.Message)
} finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 400 }
  foreach ($n in $envBackup.Keys) { [Environment]::SetEnvironmentVariable($n, $envBackup[$n]) }
  if ($tmp -and (Test-Path $tmp)) {
    if ($script:Fail.Count -gt 0 -and (Test-Path (Join-Path $tmp "server.err.log"))) {
      $errText = Get-Content (Join-Path $tmp "server.err.log") -Raw
      if ($errText) { Write-Host "--- backend stderr:"; Write-Host $errText }
    }
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  }
}

Write-Host ""
Write-Host ("RESULT: " + $script:Pass + " passed, " + $script:Fail.Count + " failed")
foreach ($f in $script:Fail) { Write-Host ("  FAILED: " + $f) -ForegroundColor Red }
if ($script:Fail.Count -gt 0) { exit 1 } else { exit 0 }
