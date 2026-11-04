# 0003: Optional phone/password accounts with SMS confirmation

Status: Accepted for development. Public phone authentication is not release-ready.

Allow a phone number as an alternative to email when creating an account.
The approved flow confirms the number with an SMS code, then uses the phone
number and password for subsequent sign-ins. Passwordless SMS on every sign-in
was considered but is not the selected experience.

Use Supabase Auth behind the existing same-origin server API and HttpOnly SSR
cookies. Shared contracts accept exactly one contact identifier. Server session
and private-data checks accept a non-anonymous, provider-confirmed email or
phone; sign-in requires confirmation of its chosen identifier. Ownership and
local drafts stay scoped by user ID, with no implicit linking or project transfer.

Gate phone actions with `PHONE_AUTH_ENABLED=false` by default until a supported
SMS provider is configured. Verification is an explicit six-digit-code form;
send failures, expired codes, and provider rate limits remain visible. Sending
an SMS never proves that the account is verified or the message was delivered.

Phone password recovery verifies an SMS OTP requested with account creation
disabled, then uses the existing authenticated password-change endpoint.
Like email recovery, successful verification grants a session. A lost or
reassigned number can therefore give its new holder access to an old account.
MFA and a reviewed lost-number recovery policy remain prerequisites for public
use, not capabilities supplied by this change. CAPTCHA integration, provider
spending/destination controls, regional compliance, and real SMS/provider
acceptance are also required before public signup.

No SMS service is provisioned by application code. Local route, browser and
built SDK fixtures establish app behavior, not hosted delivery or production
security. Existing email/password flows remain available and unchanged.
