# Microsoft owner login and background notifications

Status: background Web Push can run with the existing portal admin login, without
Azure. Microsoft login remains optional and inactive unless explicitly configured.

## Trial without Azure

The portal's existing `DATABASE_URL` and `RENDER_EXTERNAL_URL` are sufficient.
Log in as admin on the phone, open `/__access/approvals`, select
**Aktifkan notifikasi HP**, and grant notification permission. Use
**Kirim notifikasi uji** to verify receipt. On iPhone, add the approval page to
Home Screen and open it from its icon before enrolling. After enrollment the
page can be closed; phone/browser permissions and connectivity still apply.
Only authenticated admin sessions can enroll or disable subscriptions. Viewer
sessions cannot use any push-management API. The trial is protected by the
portal admin credentials, not by a Microsoft account restriction.

When Microsoft registration is completed later, all three Microsoft owner
variables switch enrollment and approvals to the pinned Microsoft owner.
The tests simulate delivery; final phone delivery still requires enrollment.

The existing admin/password and viewer request flow remains active until all three
Microsoft owner environment variables are configured. With them configured,
approval and notification subscription require the pinned Microsoft identity;
an ordinary portal admin session cannot approve requests through that interface.
Microsoft authentication grants approval access only, not customer-data admin access.

## Registration and activation

1. Register a Microsoft application supporting personal Microsoft accounts.
   App registration requires access to an Azure/Entra directory. A personal Outlook
   account alone may encounter AADSTS50020 in the management portal. Do not enable
   a paid subscription as a workaround without the owner's explicit authorization.
2. Add a Web redirect URI:
   `https://portal-nasabah-mandiri-ttnu.onrender.com/__access/microsoft/callback`.
3. Create a client secret and store its value only in Render environment settings.
   The app requests only `openid profile email`; no mail, files or Graph data access.
4. Set `MS_OWNER_CLIENT_ID`, `MS_OWNER_CLIENT_SECRET` and
   `PORTAL_PUBLIC_URL=https://portal-nasabah-mandiri-ttnu.onrender.com`.
5. With an existing portal admin session, open `/__access/microsoft/login`.
   The account owner completes Microsoft sign-in and consent themselves.
   Setup returns the signed identity's immutable `MS_OWNER_SUBJECT` but grants
   no owner session. Confirm the intended account before pinning this value.
6. Set `MS_OWNER_SUBJECT` in Render. After restart only that signed subject from
   Microsoft's consumer issuer can approve requests. No authorization relies on email.
7. On the owner's phone, open `/__access/approvals`, sign in to Microsoft,
   then select **Aktifkan notifikasi HP**. The phone owner grants browser permission.
   On iOS, first add the portal to the Home Screen and launch it from that icon.
8. Verify a request from a second browser arrives after closing the owner's page,
   tap it, and approve. Verify the requesting browser receives viewer access only.

The portal uses browser Web Push, not Microsoft Authenticator push. Authenticator
may verify Microsoft's sign-in according to the account's authentication settings.
Notification delivery depends on phone/browser support, connectivity and OS settings.

## Storage and lifetime

Web Push subscriptions and VAPID keys are stored privately in dedicated Neon tables
`portal_owner_push` and `portal_owner_settings`. Customer snapshots are not changed.
Keys and subscriptions are never committed. A maximum of ten subscriptions are kept.
Expired push endpoints are removed on delivery errors 404/410. The owner can disable
all registered notifications from the approval page and sign out independently.

Owner sessions and OAuth states remain in server memory: owner sessions last up to
30 days but restart requires login again. Requests still expire after five minutes;
restart clears them and users must request again. No service worker caches portal
pages, account tokens or customer data. Notifications show a generic access request;
approval always requires opening the authenticated page and matching the code.

## Checks

`node tests/owner-access.cjs` verifies signatures, issuer, audience, nonce, expiry,
PKCE/state and unauthenticated push API rejection plus endpoint restrictions.
`node tests/access-approval.cjs` verifies existing approval security, browser binding,
single redemption, denial, expiry and 30-minute viewer sessions.

`node tests/owner-push.cjs` covers the admin-based trial, CSRF, key reuse,
persisted subscriptions after restart, delivery calls, rate limiting and unsubscribe.

Real Microsoft login, phone subscription and background delivery cannot be verified
until application registration and owner phone enrollment are completed.
