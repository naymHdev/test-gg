# FinderQ Backend — Architecture & API Design || awa-test repo dekho
Built on the exact layered pattern used in `awa-test` (adaora-server): Express + Prisma + Zod, module-per-feature, `catchAsync` / `sendResponse` / `AppError` / `QueryBuilder` / role-based `auth()` middleware.

---

## 1. Folder Structure

```
src/
├── app.ts
├── server.ts
├── app/
│   ├── builder/QueryBuilder.ts
│   ├── config/index.ts
│   ├── constants/
│   ├── error/{AppError,ZodError,MulterError,handlePrismaError}.ts
│   ├── helpers/
│   ├── interface/
│   ├── middleware/
│   │   ├── auth.ts              → role gate (existing pattern)
│   │   ├── authorize.ts         → NEW: granular permission gate (Owner-assigned)
│   │   ├── optionalAuth.ts      → guest-allowed routes (public feed)
│   │   ├── validateRequest.ts
│   │   └── globalErrorhandler.ts
│   ├── modules/
│   │   ├── auth/          otp/           user/
│   │   ├── post/          media/         tournament/  team/  match/
│   │   ├── challenge/     reward/
│   │   ├── friend/        message/       support/
│   │   ├── report/        admin/
│   │   ├── subscription/  wallet/        notification/
│   │   └── upload/        legal/
│   ├── routes/index.ts    → aggregates web routes + /admin/* dashboard routes
│   └── utils/{catchAsync,sendResponse,mailSender,s3,...}.ts
├── lib/
│   ├── stripe/            (client, webhook, handlers — same as adaora-server)
│   └── socket/            (Socket.io singleton + event emitters)
└── shared/{prisma.ts, redis.ts}
```

Each module keeps the same 5 files as `auth/` in the reference repo:
`*.routes.ts → *.controller.ts → *.service.ts`, plus `*.validation.ts` (Zod) and `*.interface.ts` (types). I've fully implemented `auth` and `post` as reference modules — copy that shape for the rest.

---

## 2. Database — Prisma Multi-File Schema

Files delivered in `/prisma/`:

| File | Models |
|---|---|
| `schema.prisma` | generator + datasource |
| `enums.prisma` | all enums (Role, Permission, Region, Language, statuses...) |
| `user.prisma` | User, Profile, UserPermission, RefreshToken |
| `post.prisma` | Post |
| `media.prisma` | MediaPost, MediaComment, MediaLike |
| `tournament.prisma` | Tournament, Team, TeamMember, Match |
| `challenge.prisma` | Challenge, ChallengeEnrollment, Reward, RewardPurchase, UserPoints |
| `social.prisma` | Friend, Message |
| `support.prisma` | SupportConversation, SupportMessage |
| `report.prisma` | Report (polymorphic via `targetType` + nullable `postId`/`mediaPostId`) |
| `admin.prisma` | ActivityLog |
| `subscription.prisma` | Subscription |
| `wallet.prisma` | Wallet, WalletTransaction |
| `notification.prisma` | Notification, LegalDocument |

**Key design decisions (deviations from the raw SRS table, on purpose):**
- `Role` enum dropped `Premium User` as a role — it's a **flag** (`user.isPremium`), not a role, since permissions are role+grant based (matches SRS §3.3 permission matrix which only lists Owner as the granter, never Premium).
- `Report.targetType` stays polymorphic, but I added **real FKs** `postId` / `mediaPostId` (nullable) next to it instead of a bare UUID — lets you `include: { post: true }` directly instead of a manual second query, while still supporting `Profile` reports (no FK, targetId = userId already covered by `reportedUserId`).
- `UserPoints` is a **singleton-per-user row** (`userId` is the `@id`), upserted exactly like your commission-rate singleton pattern — never inserted twice.
- Soft delete (`deletedAt`) on `Post`, `MediaPost`, `Message` — hard delete nowhere, since Reports snapshot content and need the row's history.
- `RefreshToken` persisted in Postgres (not just JWT-stateless) so `/logout` and password-reset can actually invalidate sessions — this is what `handleRefreshToken`/ban flows in the SRS require ("Invalidate all user sessions").

---

## 3. Middleware Layer

| Middleware | Purpose |
|---|---|
| `auth(...roles)` | Existing pattern — verifies JWT, loads user from DB, checks `status`, attaches `req.user = { id, role, permissions }` |
| `authorize(...permissions)` | **New.** Sits after `auth()` for Moderator/Admin routes. Owner bypasses. Checks `UserPermission` rows (SRS §3.4 grant flow) |
| `optionalAuth` | For guest-readable endpoints (`GET /posts`, `GET /media`) — never throws, sets `req.user = null` |
| `validateRequest(schema)` | Unchanged — Zod `parseAsync` on `req.body` |
| rate limiters | `express-rate-limit` instances per route, matching SRS §20 table exactly (login 5/min, posts 3/hr, reports 5/hr, messages 30/min, presign 10/hr) |

`req.user.permissions` is populated inside `auth()` by joining `UserPermission` when role is `Moderator`/`Admin` (Owner needs none — always full access).

---

## 4. Web vs Dashboard — how they share code

**They are not separate backends.** Same `service` layer, different `controller`/`routes` files where the shape of the response or the auth gate differs:

```
modules/user/
  user.routes.ts          → GET /api/users/:username/profile   (public)
  user.admin.routes.ts    → GET /api/admin/users                (auth(Admin,Owner)+authorize(manage_users))
  user.controller.ts      → thin, calls user.service
  user.admin.controller.ts→ thin, calls the SAME user.service functions
  user.service.ts         → all DB logic lives ONCE here
```

`routes/index.ts` mounts web modules under `/api/*` and admin modules under `/api/admin/*` in the same array-loop pattern already used (see delivered `routes/index.ts`). One Express app, one Prisma client, two route trees.

---

## 5. Module-by-Module API Reference

Legend: **A** = `auth()` role gate · **P** = `authorize()` permission · **O** = `optionalAuth` · 🌐 = web · 🛠 = dashboard

### auth / otp *(fully implemented — see `src/app/modules/auth`)*
| Method | Path | Gate | Controller → Service |
|---|---|---|---|
| POST | /api/auth/register | rate-limit | `register` → `registerIntoDB` (stashes hashed payload in Redis, sends OTP) |
| POST | /api/auth/verify-otp | — | `verifyOtp` → `verifyRegisterOtp` \| `verifyLoginOtp` (branch on `purpose`) |
| POST | /api/auth/login | 5/min | `login` → `loginWithCredentials` |
| POST | /api/auth/refresh | — | `refresh` → `refreshAccessToken` (rotates token) |
| POST | /api/auth/logout | — | `logout` → revokes `RefreshToken` row |
| POST | /api/auth/forgot-password | — | `forgotPassword` → Redis reset token, 30min TTL |
| PUT | /api/auth/reset-password | — | `resetPassword` → updates hash, revokes all sessions |

### user
| Method | Path | Gate | Notes |
|---|---|---|---|
| GET | /api/users/:username/profile | O | joins `Profile`, computed `reputation` from resolved reports |
| PUT | /api/profile | A(User+) | zod-validated partial `Profile` update |
| PUT | /api/profile/avatar, /banner | A(User+) | body = `{ url }` returned from `/upload/presign` confirm step |
| GET | /api/users/presence | A(User+) | batch-reads Redis presence keys |
| 🛠 GET | /api/admin/users | A(Admin,Owner)+P(manage_users) | `QueryBuilder` search+filter+paginate over `User` |
| 🛠 PUT | /api/admin/users/:id/role | A(Owner) | Owner-only, no `authorize` needed |
| 🛠 PUT | /api/admin/users/:id/permissions | A(Owner) | upserts `UserPermission` rows |

### post *(fully implemented — see `src/app/modules/post`)*
| Method | Path | Gate | Notes |
|---|---|---|---|
| GET | /api/posts | O | `QueryBuilder.search(["content"]).filter().sort().paginate()`, forces `isPremium desc` first, `language`/`region` come through `filter()` as plain query params |
| POST | /api/posts | A(User+), 3/hr | snapshots `language`, `isVerified`, `isPremium` from author at creation time |
| PUT | /api/posts/:id | A(User+) | owner-only in service (region immutable, excluded from validation schema) |
| DELETE | /api/posts/:id | A(User+) | owner OR `delete_content` permission — soft delete |

### media
| Method | Path | Gate | Notes |
|---|---|---|---|
| GET | /api/media | O | `QueryBuilder` on `MediaPost`, filter by `category`,`language` |
| POST | /api/media | A(User+) | `imageUrl` comes from presign flow, not multipart |
| POST | /api/media/:id/like | A(User+) | `prisma.mediaLike.upsert()` on composite PK — flips like↔dislike atomically, then recompute `likesCount`/`dislikesCount` via `$transaction` |
| POST | /api/media/:id/comments | A(User+) | simple create, 300-char zod max |
| DELETE | /api/media/:id | A(User+) | owner or `delete_content` |

### tournament / team / match
| Method | Path | Gate | Notes |
|---|---|---|---|
| GET | /api/tournaments | O | filter by `status`,`region` |
| POST | /api/tournaments | A(User+) | creates with `status: Pending` |
| 🛠 PUT | /api/admin/tournaments/:id/approve | A+P(manage_tournaments) | `Pending → RegistrationOpen`, sets `approvedById/At` |
| 🛠 PUT | /api/admin/tournaments/:id/reject | A+P(manage_tournaments) | `→ Cancelled` |
| POST | /api/tournaments/:id/teams | A(User+) | service enforces **one team per tournament per user** via `TeamMember` unique-lookup before create (transaction) |
| PUT | /api/matches/:id/winner | A+P(manage_tournaments) | see **Prize distribution** below — this is the heaviest service function in the whole system |

**Prize distribution flow (`match.service.ts`), one Prisma `$transaction`:**
```
1. update Match { winnerId, declaredById, declaredAt }
2. if this match is the tournament final:
     a. Tournament.status → Completed
     b. fetch TeamMember[] of winning team
     c. prizePerMember = tournament.prizePool / members.length
     d. for each member: WalletTransaction(Credit) + Wallet.balance += amount
     e. Notification.create({ type: tournament_winner }) per member
3. emit socket event tournament:completed { tournamentId, winnerId, prizePerMember }
```
All DB writes in one `$transaction` — if the socket emit is fire-and-forget it happens *after* the transaction commits, never inside it.

### challenge / reward
| Method | Path | Gate | Notes |
|---|---|---|---|
| GET | /api/challenges | O | `active: true` filter default |
| POST | /api/challenges/:id/enroll | A(User+) | 403 if `challenge.isPremium && !user.isPremium` |
| PUT | /api/challenges/:id/progress | A(User+) or system/internal key | on `progress >= total` → transaction: `completed=true`, `UserPoints.balance += rewardPts`, `xp += xp`, level-up check, `Notification.create` |
| POST | /api/rewards/:id/purchase | A(User+) | `UserPoints.balance >= cost` else `402 INSUFFICIENT_POINTS`; deduct + `RewardPurchase.create` in one transaction |
| 🛠 POST/PUT/DELETE | /api/challenges, /api/rewards | A+P(manage_challenges) | plain CRUD, `active=false` for delete |

### friend / message
| Method | Path | Gate | Notes |
|---|---|---|---|
| POST | /api/friends/request | A(User+) | create `Friend{status:Pending}` + socket `friend_request:received` |
| PUT | /api/friends/:id/accept | A(User+) | update to `Accepted` **and** create the reverse row in the same transaction (bidirectional) |
| DELETE | /api/friends/:id | A(User+) | decline — hard delete of the pending row only |
| PUT | /api/friends/:userId/block | A(User+) | status → `Blocked`; message/friend-request services must check this before allowing new sends |
| GET | /api/messages/:userId | A(User+) | `QueryBuilder.paginate()`, ordered `createdAt desc`, filtered to the two-user pair |
| POST | /api/messages | A(User+), 30/min | blocked-check → create → socket `message:new` |
| PUT | /api/messages/read | A(User+) | `updateMany({ senderId, receiverId: me, read:false }, { read:true })` |

### support
| Method | Path | Gate | Notes |
|---|---|---|---|
| POST | /api/support/messages | A(User+) | service: find open conversation for user or create one, then append message |
| 🛠 GET | /api/admin/support/conversations | A+P(view_support) | list all, filterable by `status` |
| 🛠 PUT | /api/admin/support/conversations/:id/close | A+P(view_support) | sets `Closed`, appends a `System` message |

### report
| Method | Path | Gate | Notes |
|---|---|---|---|
| POST | /api/reports | A(User+), 5/hr | zod: `details` min 10 chars; service copies a `snapshot` JSON of the target row before it can be edited/deleted |
| 🛠 GET | /api/admin/reports | A+P(manage_reports) | `QueryBuilder` filter by `status` |
| 🛠 PUT | /api/admin/reports/:id | A+P(manage_reports) | resolve/dismiss; **auto-warn hook**: after resolve, count `Report.count({reportedUserId, status:'Pending'})` — if ≥5, auto-call the same service function `admin/user.service.ts#warnUser` |

### admin (users/ban/warn/timeout/activity)
| Method | Path | Gate | Notes |
|---|---|---|---|
| POST | /api/admin/users/:id/ban | A(Admin,Owner)+P(ban_users) | update `status=Banned`, revoke all `RefreshToken`s, write `ActivityLog`, send `account_banned` email notification |
| DELETE | /api/admin/users/:id/ban | A+P(ban_users) | `status=Active`, log |
| POST | /api/admin/users/:id/warn | A+P(warn_users) | `warningCount++`; if `>=5` → chain into ban service function internally (reuse, don't duplicate) |
| POST | /api/admin/users/:id/timeout | A+P(timeout_users) | sets `timeoutUntil`; **enforced** by a tiny checkTimeout middleware placed before `post.routes`/`message.routes` write endpoints, not inside `auth()` itself (keeps `auth()` single-purpose) |
| GET | /api/admin/activity-logs | A+P(view_activity) | `QueryBuilder` on `ActivityLog` |

Every admin mutating endpoint above ends with one extra `prisma.activityLog.create()` call — put this inside a shared `helpers/logActivity.ts` and call it from each admin service, not from the controller (keeps controllers uniform).

### subscription (premium) + Stripe
Reuses `lib/stripe/*` from the reference repo almost as-is (`stripe.client.ts`, `stripe.webhook.ts`, `stripe.handlers.ts`).
| Method | Path | Gate | Notes |
|---|---|---|---|
| POST | /api/premium/create-checkout | A(User+) | creates Stripe Checkout Session, `client_reference_id = userId` |
| POST | /api/premium/cancel | A(User+) | Stripe "cancel at period end" + `Subscription.status=Cancelled` (premium kept until period end) |
| POST | /api/webhooks/stripe | raw body, no auth | `stripe.webhook.ts` verifies signature, dispatches to `stripe.handlers.ts`: `customer.subscription.created/deleted/updated`, `invoice.payment_failed` → matches SRS §13.3 table exactly |

### wallet
| Method | Path | Gate | Notes |
|---|---|---|---|
| GET | /api/wallet | A(User+) | own wallet only |
| GET | /api/wallet/transactions | A(User+) | `QueryBuilder.paginate()` |
| *(internal)* `wallet.service.ts#credit()` | — | called by match/reward services, never exposed directly as a public write route except the admin-triggered prize flow |

### notification
No dedicated CRUD routes in the SRS beyond delivery — `Notification.create()` is called from inside other services (friend, tournament, wallet, challenge, admin/ban). Expose:
| Method | Path | Gate |
|---|---|---|
| GET | /api/notifications | A(User+) |
| PUT | /api/notifications/:id/read | A(User+) |

### upload
| Method | Path | Gate | Notes |
|---|---|---|---|
| POST | /api/upload/presign | A(User+), 10/hr | reuses `utils/s3.ts` pattern — generates presigned PUT, key = `users/{userId}/{type}/{uuid}.{ext}`; validates `contentType` against the SRS §16.3 whitelist before signing |

### legal
| Method | Path | Gate |
|---|---|---|
| GET | /api/legal/privacy-policy?version=latest | O |
| GET | /api/legal/terms?version=latest | O |

---

## 6. Real-time Layer (Socket.io)

`src/lib/socket/index.ts` exports a singleton `io` (same idea as `shared/prisma.ts`), initialized once in `server.ts` alongside `app.listen`. Services never import socket handlers directly from routes — they call a thin emitter helper:

```ts
// lib/socket/emit.ts
export const emitToUser = (userId: string, event: string, payload: unknown) => {
  io.to(`user:${userId}`).emit(event, payload);
};
```

Each authenticated socket connection joins room `user:{userId}` right after handshake JWT verification (same `access_secret` used by `auth()`). This keeps all real-time fan-out (`friend_request:received`, `message:new`, `tournament:winner`, `notification:new`, `presence:update`) as one-line calls from inside the existing services — no separate real-time service layer to maintain.

Presence (`presence:heartbeat` every 20s) writes directly to Redis (`shared/redis.ts`) with a 30s TTL key `presence:{userId}`, read by `GET /api/users/presence`.

---

## 7. Error Handling
Unchanged from the reference repo's `globalErrorHandler` — it already branches on `PrismaClientKnownRequestError` (P2002 unique / P2025 not-found), `ZodError`, `MulterError`, `AppError`. Add one more branch for Stripe signature errors in `stripe.webhook.ts` itself (return 400 before it ever reaches Express's error handler, since Stripe needs a fast plain response).

Map the SRS's custom error codes (`AUTH_ACCOUNT_BANNED`, `INSUFFICIENT_POINTS`, etc.) as the **message** string on `AppError` — the global handler already forwards `err.message` untouched, so `throw new AppError(402, "INSUFFICIENT_POINTS")` reaches the client exactly as specified in SRS §20.

---

## 8. Build Order (suggested)

1. `user` + `auth` + `otp` (done here — copy the pattern)
2. `upload` (everything else needs image URLs)
3. `post` (done here) + `media`
4. `friend` + `message` (+ socket wiring)
5. `wallet` + `notification` (needed by everything downstream)
6. `tournament` + `team` + `match` (heaviest business logic, depends on wallet+notification)
7. `challenge` + `reward` (depends on wallet's `UserPoints` pattern)
8. `report` + `admin` (ban/warn/timeout) + `support`
9. `subscription` (Stripe) + `legal`

This order matches dependency direction — nothing above depends on anything below it.
