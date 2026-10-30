# TeleShop Ethiopia — Marketplace Release Candidate

Vanilla HTML/CSS/JavaScript frontend + Node.js/Express + MongoDB backend. This bundle includes the existing seller tools, a customer storefront/cart/checkout, customer order history for signed-in checkouts, and a basic admin operations console.

## Features in this bundle
- Public product catalogue with search, category filtering, sorting, seller storefronts, and persistent browser cart.
- Server-calculated checkout totals; stock availability checks and stock decrement; multi-seller carts become separate seller orders.
- Guest checkout with cash on delivery (COD). Signed-in checkouts are linked to the account and appear in My Orders.
- Customer and seller account registration; admin role is assigned only by a project operator through the CLI.
- Seller product/store/order/customer/analytics tools from the existing dashboard.
- Admin overview, users, order list, product moderation (publish/hide), and account disable/enable controls. Commission estimates are calculated from completed orders using a configurable reporting rate.
- Helmet, request rate limiting, password hashing, JWT authentication, validation, and server-side role checks on seller/admin endpoints.

## Requirements
- Node.js 20+ recommended (your existing setup used Node 24).
- A MongoDB Atlas cluster or local MongoDB instance.
- VS Code with Live Server, or another static file server.

## Setup
1. Extract the ZIP.
2. Open `Teleshop-ethiopia/backend` in a terminal.
3. Run `npm install`.
4. Copy `.env.example` to `.env` and fill in your own `MONGODB_URI`; set `JWT_SECRET` to a random private value at least 32 characters long.
5. Run `npm start`. The API should answer at `http://localhost:3000/`.
6. Open `Frontend/storefront.html` using VS Code Live Server. Keep the backend running.
7. Register a seller account, sign in, create a product with a price and stock quantity, then open the marketplace in another tab and test guest checkout.
8. Register a customer account, sign in, and check out while signed in. The order should then appear in `Frontend/customer-orders.html`.

## Create the first administrator
1. Register a normal account with the email you want to use as administrator.
2. Stop only if needed; the backend may remain running in another terminal.
3. In a terminal inside `backend`, run:
   `npm run make-admin -- your-existing-email@example.com`
4. Sign out and sign back in. The login flow should open `Frontend/admin.html`.

The command updates an existing user in the `teleshop.users` collection. Never give administrator access to an email you do not control.

## Main pages
- `Frontend/storefront.html` — public marketplace
- `Frontend/checkout.html` — checkout
- `Frontend/register.html` and `Frontend/login.html` — account access
- `Frontend/dashboard.html` — seller console
- `Frontend/customer-orders.html` — signed-in customer's order history
- `Frontend/admin.html` — administrator console
- `Frontend/privacy.html` and `Frontend/terms.html` — draft policy templates; review and replace before launch
- `Frontend/tailor.html` — tailoring service placeholder linking to Fashion products

## Important limitations — read before public launch
This is a **local release candidate**, not a verified production deployment. You must test it against your own MongoDB data before accepting real orders. It currently supports COD only. Telebirr, Chapa, CBE Birr, bank integrations, payment verification/webhooks, email/SMS OTP, seller identity verification, delivery fee calculation, refunds, dispute handling, automated commission collection, audit logging, and production hosting are not live integrations in this bundle. The marketplace reports gross order value and an estimated commission on completed orders using `PLATFORM_COMMISSION_RATE` (default 0.05 = 5%); it does not automatically deduct or collect commission. Do not advertise digital payment methods until a provider is selected and its integration is tested.

Additional production work is required for transactional stock/order writes under concurrent load (MongoDB transactions require a replica set), formal privacy/terms policies, backups, monitoring, image upload/storage, abuse prevention, security review, and full end-to-end testing. Never commit or share `.env` or database credentials.

## Quick verification
From `backend`, run:
- `npm test` — syntax check of `server.js`
- `npm run make-admin -- existing-account@example.com` — promote an existing account after setup

The syntax check is not an integration test. A successful MongoDB connection and manual test orders are still required.
