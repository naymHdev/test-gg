# FinderQ — Software Requirements Specification (SRS)
**Version:** 1.0 | **Date:** 2026-06-19 | **Status:** Draft


<!-- -------------------------- DEW Works -------------------------- -->
<!-- 
1. Media page users profile details ✅
2. Fetch My Tournaments
3. Voice channel group messaging image message option update need!
4. Media: https://finderq.gg/euw -- profile reputation update need ✅
 -->
<!-- -------------------------- END -------------------------- -->

---

## TABLE OF CONTENTS
1. System Overview
2. Entity Relationships
3. User Roles & Permissions
4. Authentication Module
5. Player Search Module
6. Media Module
7. Tournaments Module
8. Challenges & Rewards Module
9. Messaging & Friends Module
10. Support Chat Module
11. Reporting System
12. Owner/Admin Panel
13. Premium Subscription
14. Wallet Module
15. Notifications
16. File Upload
17. Legal & Static Pages
18. API Reference Summary
19. Database Schema
20. Error Handling

---

## 1. SYSTEM OVERVIEW

FinderQ is a League of Legends community platform enabling players to:
- Find teammates via regional announcements
- Share media (screenshots, clips, memes)
- Compete in community-run tournaments
- Complete challenges and earn rewards
- Communicate in real time

**Tech Stack (Backend Recommendation):**
- REST API + WebSocket (Socket.io) for real-time
- PostgreSQL for relational data
- Redis for sessions, presence, rate limiting
- S3-compatible storage for media uploads
- Stripe for payment processing

---

## 2. ENTITY RELATIONSHIPS

```
User
├── has one Profile
├── has one Wallet
├── has many Posts (per region)
├── has many FriendRequests (sent/received)
├── has many Friends
├── has many Messages
├── has many Reports (filed/received)
├── has many TournamentRegistrations
├── has many ChallengeEnrollments
├── has one Subscription (Premium)
└── belongs to many Teams

Post
├── belongs to User
├── belongs to Region
├── has many Tags
└── has many Reports

Tournament
├── has many Teams
├── has many Matches
├── belongs to User (creator)
└── has one Prize Pool

Team
├── belongs to Tournament
├── has many Members (Users)
└── has one Captain (User)

Match
├── belongs to Tournament
├── has two Teams
└── has one Winner (Team)

Challenge
├── has many Enrollments (Users)
└── has many Completions

Wallet
├── belongs to User
└── has many Transactions

Report
├── belongs to User (reporter)
├── belongs to User (reported)
└── polymorphic: target (Post | Profile)
```

---

## 3. USER ROLES & PERMISSIONS

### 3.1 Role Hierarchy
```
Owner > Administrator > Moderator > Premium User > User > Guest
```

### 3.2 Role Definitions

| Role | Description |
|---|---|
| **Guest** | Unauthenticated visitor |
| **User** | Registered, verified account |
| **Premium User** | Paid subscription, enhanced features |
| **Moderator** | Staff with owner-assigned granular permissions |
| **Administrator** | Elevated staff with broad moderation capabilities |
| **Owner** | Full platform control |

### 3.3 Permission Matrix

| Permission ID | Description | Who can grant |
|---|---|---|
| `manage_users` | CRUD on user accounts, role changes | Owner |
| `ban_users` | Ban/unban accounts | Owner |
| `warn_users` | Issue warnings | Owner |
| `timeout_users` | Temporary mute (1h/5h) | Owner |
| `delete_content` | Delete posts/comments | Owner |
| `manage_posts` | Approve/reject posts | Owner |
| `manage_reports` | View & resolve reports | Owner |
| `view_warnings` | View warning history | Owner |
| `view_activity` | View activity logs | Owner |
| `view_support` | Access support chat | Owner |
| `view_banned` | View banned accounts list | Owner |
| `manage_tournaments` | Approve tournaments, declare winners | Owner |
| `manage_challenges` | Add/edit/delete challenges & rewards | Owner |
| `manage_settings` | Platform configuration | Owner |

### 3.4 Permission Assignment Flow
```
1. Owner opens Owner Panel → Role Management
2. Finds target user → expands permissions panel
3. Toggles individual permissions ON/OFF
4. Changes saved immediately to DB
5. Moderator's panel tabs update in real time on next load
```

---

## 4. AUTHENTICATION MODULE

### 4.1 Registration

**Endpoint:** `POST /api/auth/register`

**Input:**
```json
{
  "username": "string (3-20 chars, alphanumeric+underscore, unique)",
  "email": "string (valid email, unique)",
  "password": "string (min 8 chars, 1 uppercase, 1 number)",
  "region": "euw|eune|na|kr|br|lan_las|oce|tr|jp|me_sea",
  "language": "en|ro|pl|tr|fr|de|es|it|pt|ru|el|hu|cs|sk|nl|sv|da|no|fi|bg|uk|sr|hr|sl",
  "agreedToTerms": true,
  "agreedToPrivacy": true
}
```

**Validation Rules:**
- Username: unique (case-insensitive), 3–20 chars, no spaces
- Email: RFC 5322 format, unique
- Password: min 8 chars
- Language: required, cannot be changed after registration
- Both agreement flags must be `true`

**Flow:**
```
1. Validate input → return 400 with field errors if invalid
2. Check username uniqueness → 409 if taken
3. Check email uniqueness → 409 if taken
4. Hash password (bcrypt, cost 12)
5. Generate 6-digit OTP, store in Redis with 10min TTL
6. Send OTP to email (SendGrid/SMTP)
7. Return 200 with pendingToken (JWT, 15min TTL)
8. User submits OTP → verify against Redis
9. Create User record in DB
10. Create Profile, Wallet records
11. Delete OTP from Redis
12. Return accessToken (JWT, 7d) + refreshToken (JWT, 30d)
```

**Edge Cases:**
- OTP expired → resend endpoint, new OTP generated, old invalidated
- 5 failed OTP attempts → 15min lockout
- Email already registered → 409 with message "Email already in use"

---

### 4.2 Login

**Endpoint:** `POST /api/auth/login`

**Input:**
```json
{
  "email": "string",
  "password": "string",
  "stayLoggedIn": "boolean"
}
```

**Flow:**
```
1. Find user by email → 404 if not found
2. Check account status:
   - status = "banned" → 403 with banReason, banDate
   - status = "suspended" → 403 with suspendedUntil timestamp
3. Verify password hash
4. Generate OTP → send to email
5. Return pendingToken
6. User submits OTP → verify
7. If stayLoggedIn=true: refreshToken TTL = 30d, else 24h
8. Return accessToken + refreshToken + userRole + permissions[]
```

**Ban Response (403):**
```json
{
  "error": "ACCOUNT_BANNED",
  "banReason": "string",
  "banDate": "ISO8601",
  "appealEmail": "FinderQ@yahoo.com"
}
```

---

### 4.3 Token Management

- **Access Token:** JWT, 15min TTL, contains: userId, role, permissions[]
- **Refresh Token:** Stored in HttpOnly cookie + DB, rotated on use
- **Endpoint:** `POST /api/auth/refresh`
- **Logout:** `POST /api/auth/logout` → invalidate refresh token in DB

---

### 4.4 Password Reset

```
1. POST /api/auth/forgot-password { email }
2. Generate reset token (UUID), store in Redis 30min TTL
3. Send email with reset link
4. PUT /api/auth/reset-password { token, newPassword }
5. Verify token → update password hash → invalidate all refresh tokens
```

---

## 5. PLAYER SEARCH MODULE

### 5.1 Data Model — Post

```sql
posts (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  region      VARCHAR(20),
  content     TEXT (max 500 chars),
  image_url   TEXT,
  language    VARCHAR(5),  -- immutable, from user.accountLanguage
  tags        JSONB,       -- [{text, bg, color}]
  types       TEXT[],      -- ['Ranked Solo/Duo', 'Clash', ...]
  ranks       TEXT[],
  roles       TEXT[],
  is_verified BOOLEAN,
  is_premium  BOOLEAN,
  trophy_earnings DECIMAL,
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP,
  deleted_at  TIMESTAMP    -- soft delete
)
```

### 5.2 CRUD Operations

**Create Post**
- `POST /api/posts`
- Auth required, User role minimum
- Rate limit: 3 posts per hour per user
- Validates: content not empty, region valid, max 6 tags

**Read Posts**
- `GET /api/posts?region=euw&language=ro&page=1&limit=20`
- Filter by: region (required), language (from user session), types[], ranks[], roles[]
- Sorted by: created_at DESC
- Returns: posts with author profile snapshot

**Update Post**
- `PUT /api/posts/:id`
- Owner of post only (or admin with `manage_posts`)
- Cannot change region after creation

**Delete Post**
- `DELETE /api/posts/:id`
- Soft delete (deleted_at timestamp)
- Owner of post, or admin with `delete_content`, or moderator with `delete_content`

### 5.3 Language Filtering Logic
```
GET /api/posts?region=euw
→ Backend filters: posts.language = user.accountLanguage (from JWT)
→ Frontend language selector changes user.preferredLanguage (UI only)
→ Separate param: GET /api/posts?region=euw&language=ro
  (language param = top-right selector value, defaults to user.accountLanguage)
```

### 5.4 Public Profile View

**Endpoint:** `GET /api/users/:username/profile`

**Returns:**
```json
{
  "username": "string",
  "avatar": "url",
  "banner": "url",
  "region": "string",
  "language": "string",
  "riotVerified": "boolean",
  "isPremium": "boolean",
  "rank": "string",
  "lp": "number",
  "tournamentEarnings": "number",
  "joinDate": "ISO8601",
  "reputation": { "positive": 0, "negative": 0 },
  "seasonHistory": []
}
```

---

## 6. MEDIA MODULE

### 6.1 Data Model — MediaPost

```sql
media_posts (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  title       VARCHAR(200),
  description TEXT,
  image_url   TEXT,
  category    ENUM('screenshot','clip','meme'),
  language    VARCHAR(5),
  likes       INTEGER DEFAULT 0,
  views       INTEGER DEFAULT 0,
  is_premium  BOOLEAN,
  created_at  TIMESTAMP,
  deleted_at  TIMESTAMP
)

media_comments (
  id            UUID PRIMARY KEY,
  media_post_id UUID REFERENCES media_posts(id),
  user_id       UUID REFERENCES users(id),
  content       TEXT (max 300 chars),
  created_at    TIMESTAMP
)

media_likes (
  user_id       UUID REFERENCES users(id),
  media_post_id UUID REFERENCES media_posts(id),
  type          ENUM('like','dislike'),
  PRIMARY KEY (user_id, media_post_id)
)
```

### 6.2 CRUD Operations

**Create:** `POST /api/media` — multipart/form-data or JSON with image URL
**Read:** `GET /api/media?category=screenshot&language=ro&page=1`
**Like:** `POST /api/media/:id/like` `{ type: 'like'|'dislike' }`
**Comment:** `POST /api/media/:id/comments` `{ content }`
**Delete:** `DELETE /api/media/:id` — owner or admin

### 6.3 File Upload Flow (for future image upload)
```
1. Client requests upload URL: POST /api/upload/presign { type: 'media', contentType: 'image/jpeg' }
2. Server generates S3 presigned PUT URL (15min TTL), returns { uploadUrl, publicUrl }
3. Client uploads directly to S3
4. Client confirms: POST /api/media { imageUrl: publicUrl, ... }
5. Server validates image exists in S3 before saving
```

**Validation:**
- Max file size: 10MB
- Allowed types: image/jpeg, image/png, image/gif, image/webp
- Video: max 50MB, mp4 only (for clips)

---

## 7. TOURNAMENTS MODULE

### 7.1 Data Models

```sql
tournaments (
  id              UUID PRIMARY KEY,
  creator_id      UUID REFERENCES users(id),
  name            VARCHAR(200),
  region          VARCHAR(20),
  game_mode       VARCHAR(50),
  format          ENUM('single_elimination','round_robin'),
  max_teams       INTEGER,
  entry_fee       DECIMAL(10,2),
  prize_pool      DECIMAL(10,2),
  start_date      TIMESTAMP,
  status          ENUM('pending','approved','registration_open','active','completed','cancelled'),
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMP,
  created_at      TIMESTAMP
)

teams (
  id              UUID PRIMARY KEY,
  tournament_id   UUID REFERENCES tournaments(id),
  name            VARCHAR(100),
  captain_id      UUID REFERENCES users(id),
  created_at      TIMESTAMP
)

team_members (
  team_id         UUID REFERENCES teams(id),
  user_id         UUID REFERENCES users(id),
  role            ENUM('captain','member'),
  joined_at       TIMESTAMP,
  PRIMARY KEY (team_id, user_id)
)

matches (
  id              UUID PRIMARY KEY,
  tournament_id   UUID REFERENCES tournaments(id),
  team_a_id       UUID REFERENCES teams(id),
  team_b_id       UUID REFERENCES teams(id),
  winner_id       UUID REFERENCES teams(id),
  round           INTEGER,
  match_index     INTEGER,
  declared_by     UUID REFERENCES users(id),
  declared_at     TIMESTAMP,
  created_at      TIMESTAMP
)
```

### 7.2 Tournament Lifecycle State Machine

```
PENDING ──(admin approves)──→ REGISTRATION_OPEN
                              ──(registration closes / admin action)──→ ACTIVE
                              ──(all matches completed)──→ COMPLETED
PENDING ──(admin rejects)──→ CANCELLED
REGISTRATION_OPEN ──(admin rejects)──→ CANCELLED
```

### 7.3 Prize Distribution Flow
```
1. Admin declares match winner: PUT /api/matches/:id/winner { teamId }
2. System checks if this match is the final
3. If final:
   a. Tournament status → COMPLETED
   b. Identify winner team members
   c. Calculate prize per member: prizePool / teamSize
   d. POST /api/wallet/credit for each member
   e. Create transaction records
   f. Send notification to each winner
   g. Award TrophyBadge if earnings threshold reached
4. WebSocket event: tournament:completed { tournamentId, winnerId, prizePerMember }
```

### 7.4 Registration Rules
- User can register only 1 team per tournament
- Cannot register after tournament status = ACTIVE
- Captain creates team, invites members
- Min team size enforced by tournament settings

---

## 8. CHALLENGES & REWARDS MODULE

### 8.1 Data Models

```sql
challenges (
  id          UUID PRIMARY KEY,
  title       VARCHAR(200),
  description TEXT,
  difficulty  ENUM('easy','medium','hard','legendary'),
  type        VARCHAR(50),     -- 'wins', 'games_played', 'custom'
  total       INTEGER,         -- target count
  reward_pts  INTEGER,
  xp          INTEGER,
  is_premium  BOOLEAN DEFAULT FALSE,
  created_by  UUID REFERENCES users(id),
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP
)

challenge_enrollments (
  id            UUID PRIMARY KEY,
  challenge_id  UUID REFERENCES challenges(id),
  user_id       UUID REFERENCES users(id),
  progress      INTEGER DEFAULT 0,
  completed     BOOLEAN DEFAULT FALSE,
  enrolled_at   TIMESTAMP,
  completed_at  TIMESTAMP,
  UNIQUE(challenge_id, user_id)
)

rewards (
  id          UUID PRIMARY KEY,
  title       VARCHAR(200),
  description TEXT,
  icon        VARCHAR(10),     -- emoji
  cost        INTEGER,         -- in points
  type        VARCHAR(50),
  active      BOOLEAN DEFAULT TRUE,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMP
)

reward_purchases (
  id          UUID PRIMARY KEY,
  reward_id   UUID REFERENCES rewards(id),
  user_id     UUID REFERENCES users(id),
  cost_paid   INTEGER,
  purchased_at TIMESTAMP
)

user_points (
  user_id     UUID PRIMARY KEY REFERENCES users(id),
  balance     INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  level       INTEGER DEFAULT 1,
  xp          INTEGER DEFAULT 0
)
```

### 8.2 Challenge Completion Flow
```
1. User enrolls: POST /api/challenges/:id/enroll
2. Progress updated via: PUT /api/challenges/:id/progress { increment: 1 }
   (triggered by game events or manual admin action)
3. If progress >= total:
   a. Mark enrollment.completed = true
   b. Credit reward_pts to user_points.balance
   c. Add xp to user_points.xp
   d. Check level-up threshold
   e. Send notification: "Challenge completed!"
4. If challenge is Premium and user is not premium → 403
```

### 8.3 Reward Purchase Flow
```
1. User clicks Redeem: POST /api/rewards/:id/purchase
2. Check user_points.balance >= reward.cost → 402 if insufficient
3. Deduct points: UPDATE user_points SET balance = balance - cost
4. Create reward_purchase record
5. Return success + new balance
6. If points insufficient: return 402 { error: 'INSUFFICIENT_POINTS', required, current }
```

### 8.4 Admin Challenge Management (requires `manage_challenges`)
- `POST /api/challenges` — create
- `PUT /api/challenges/:id` — edit
- `DELETE /api/challenges/:id` — soft delete (active=false)
- `POST /api/rewards` — add reward
- `PUT /api/rewards/:id` — edit reward
- `DELETE /api/rewards/:id` — remove reward

---

## 9. MESSAGING & FRIENDS MODULE

### 9.1 Data Models

```sql
friends (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  friend_id   UUID REFERENCES users(id),
  status      ENUM('pending','accepted','blocked'),
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP,
  UNIQUE(user_id, friend_id)
)

messages (
  id          UUID PRIMARY KEY,
  sender_id   UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  content     TEXT (max 2000 chars),
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP,
  deleted_at  TIMESTAMP
)
```

### 9.2 Friend Request Flow
```
1. Send request: POST /api/friends/request { targetUserId }
   → Creates friends record { status: 'pending' }
   → WebSocket event to target: friend_request:received { from }
2. Accept: PUT /api/friends/:requestId/accept
   → Updates status → 'accepted'
   → Creates reverse record (bidirectional)
   → WebSocket: friend_request:accepted
3. Decline: DELETE /api/friends/:requestId
   → Deletes record
4. Block: PUT /api/friends/:userId/block
   → status → 'blocked'
   → Blocked user cannot send messages or friend requests
```

### 9.3 Messaging
- `GET /api/messages/:userId?page=1&limit=50` — paginated conversation
- `POST /api/messages` `{ receiverId, content }` — send message
- WebSocket event: `message:new { messageId, senderId, content, timestamp }`
- Max 3 simultaneous chat windows (enforced client-side)
- Messages marked read: `PUT /api/messages/read { senderId }` when chat opened

### 9.4 Online Presence
- User connects WebSocket → status = 'online' in Redis (TTL 30s, heartbeat every 20s)
- User sets status manually → stored in DB user.status
- `GET /api/users/presence?userIds[]=` — batch presence check
- WebSocket: `presence:update { userId, status }` broadcast to friends

---

## 10. SUPPORT CHAT MODULE

### 10.1 Data Models

```sql
support_conversations (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  status      ENUM('open','closed'),
  opened_at   TIMESTAMP,
  closed_at   TIMESTAMP,
  closed_by   UUID REFERENCES users(id)
)

support_messages (
  id              UUID PRIMARY KEY,
  conversation_id UUID REFERENCES support_conversations(id),
  sender_id       UUID REFERENCES users(id),
  sender_type     ENUM('user','support','system'),
  content         TEXT,
  created_at      TIMESTAMP
)
```

### 10.2 Flow
```
User opens chat:
1. Check if open conversation exists → reuse
2. If none / all closed → create new conversation
3. Messages sent: POST /api/support/messages { conversationId, content }
4. WebSocket: support:message { conversationId, message }
5. Admin sees all conversations in Owner Panel → Support tab
6. Admin replies: same endpoint with sender_type = 'support'
7. Admin closes conversation → status = 'closed', system message added
8. User sees "Conversation Closed" state, can start new one
```

---

## 11. REPORTING SYSTEM

### 11.1 Data Model

```sql
reports (
  id            UUID PRIMARY KEY,
  reporter_id   UUID REFERENCES users(id),
  reported_user_id UUID REFERENCES users(id),
  target_type   ENUM('post','profile','media_post'),
  target_id     UUID,
  reason        VARCHAR(100),
  details       TEXT (mandatory, min 10 chars),
  status        ENUM('pending','resolved','dismissed'),
  resolved_by   UUID REFERENCES users(id),
  resolved_at   TIMESTAMP,
  snapshot      JSONB,  -- content snapshot at time of report
  created_at    TIMESTAMP
)
```

### 11.2 Report Flow
```
1. User submits report: POST /api/reports
   { targetType, targetId, reason, details }
2. Validate: details required (min 10 chars), reason required
3. Snapshot saved: copy of post content / profile avatar+banner at report time
4. Rate limit: max 5 reports per user per hour
5. Admin sees in Owner Panel → Reports tab
6. Admin resolves: PUT /api/reports/:id { status: 'resolved' | 'dismissed', note }
7. Optional: auto-warn or auto-ban on threshold (e.g., 5+ pending reports on same user)
```

### 11.3 Report Thresholds (Auto-Action)
- 3 reports on same post → flag for priority review
- 5 pending reports on same user → automatic warning issued, notify admin

---

## 12. OWNER/ADMIN PANEL

### 12.1 Ban Flow

**Endpoint:** `POST /api/admin/users/:id/ban`

**Required:** `manage_users` permission

**Input:**
```json
{
  "reason": "string (category)",
  "details": "string (mandatory, min 20 chars)"
}
```

**Flow:**
```
1. Validate reason + details both provided
2. Update user.status = 'banned'
3. Store ban record: { userId, reason, details, bannedBy, bannedAt }
4. Invalidate all user sessions (delete refresh tokens from DB)
5. Log to activity_logs
6. Return 200
```

**Unban:** `DELETE /api/admin/users/:id/ban`
- Updates user.status = 'active'
- Logs action

### 12.2 Warning Flow

**Endpoint:** `POST /api/admin/users/:id/warn`

```
1. Create warning record { reason, issuedBy, date }
2. Increment user.warningCount
3. If warningCount >= 5 → auto-ban with reason "Auto-Ban: 5 warnings reached"
4. Send notification to user
5. Log to activity_logs
```

### 12.3 Timeout Flow

**Endpoint:** `POST /api/admin/users/:id/timeout`

**Input:** `{ hours: 1 | 5 }`

```
1. Set user.timeoutUntil = now + hours
2. During timeout: user cannot post or send messages
3. Return 403 on post/message endpoints if current time < timeoutUntil
4. Auto-expires (no action needed)
```

### 12.4 Activity Logs

```sql
activity_logs (
  id          UUID PRIMARY KEY,
  actor_id    UUID REFERENCES users(id),
  action      VARCHAR(100),  -- 'banned_user', 'resolved_report', etc.
  target_type VARCHAR(50),
  target_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMP
)
```

Every admin action writes a log entry.

---

## 13. PREMIUM SUBSCRIPTION

### 13.1 Data Model

```sql
subscriptions (
  id            UUID PRIMARY KEY,
  user_id       UUID REFERENCES users(id),
  status        ENUM('active','cancelled','expired'),
  plan          VARCHAR(50),        -- 'monthly', 'yearly'
  price         DECIMAL(10,2),
  currency      VARCHAR(3),
  stripe_sub_id VARCHAR(200),
  current_period_start TIMESTAMP,
  current_period_end   TIMESTAMP,
  cancelled_at  TIMESTAMP,
  created_at    TIMESTAMP
)
```

### 13.2 Subscription Flow

```
1. User clicks "Upgrade to Premium"
2. POST /api/premium/create-checkout
3. Server creates Stripe Checkout Session
4. Redirect to Stripe hosted page
5. On success: Stripe webhook → POST /api/webhooks/stripe
   Event: customer.subscription.created
   → Update user.isPremium = true
   → Create subscription record
   → Return to app with success state
6. On cancel: user returned to app, no change
```

### 13.3 Stripe Webhook Events

| Event | Action |
|---|---|
| `customer.subscription.created` | Activate premium |
| `customer.subscription.deleted` | Deactivate premium |
| `customer.subscription.updated` | Update period dates |
| `invoice.payment_failed` | Notify user, grace period 3 days |

### 13.4 Cancel Subscription
```
1. POST /api/premium/cancel
2. Call Stripe API: cancel at period end
3. Update subscription.status = 'cancelled'
4. User retains premium until current_period_end
5. At period end (webhook): user.isPremium = false
```

### 13.5 Premium Benefits Implementation

| Benefit | Backend Enforcement |
|---|---|
| Custom post border | Post.border field, served in API |
| Premium badge | user.isPremium flag in all profile APIs |
| Priority in search | ORDER BY isPremium DESC in posts query |
| Exclusive challenges | challenges.is_premium = true, check in enroll endpoint |

---

## 14. WALLET MODULE

### 14.1 Data Model

```sql
wallets (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id) UNIQUE,
  balance     DECIMAL(10,2) DEFAULT 0,
  currency    VARCHAR(3) DEFAULT 'EUR',
  updated_at  TIMESTAMP
)

wallet_transactions (
  id          UUID PRIMARY KEY,
  wallet_id   UUID REFERENCES wallets(id),
  type        ENUM('credit','debit'),
  amount      DECIMAL(10,2),
  reason      VARCHAR(200),
  reference_id UUID,          -- tournamentId, etc.
  created_at  TIMESTAMP
)
```

### 14.2 Credit Flow (Tournament Prize)
```
1. Tournament match declared final winner
2. System calculates: prizePool / winningTeam.memberCount
3. For each winning team member:
   POST /api/wallet/credit { userId, amount, reason: 'Tournament prize', referenceId: tournamentId }
4. Atomic transaction:
   - INSERT wallet_transactions
   - UPDATE wallets SET balance = balance + amount
5. Return updated balance
6. Send notification to each credited user
```

### 14.3 Withdrawal (Future)
- Not implemented in V1
- Placeholder: `POST /api/wallet/withdraw-request` → manual review

---

## 15. NOTIFICATIONS

### 15.1 Notification Types

| Type | Trigger | Delivery |
|---|---|---|
| `friend_request` | Someone sends friend request | WebSocket + in-app |
| `friend_accepted` | Request accepted | WebSocket + in-app |
| `message_new` | New message received | WebSocket badge |
| `tournament_approved` | Tournament approved by admin | in-app |
| `tournament_winner` | User's team wins | WebSocket + in-app |
| `wallet_credited` | Prize added to wallet | in-app |
| `challenge_completed` | Challenge finished | in-app |
| `warning_issued` | Admin issued warning | in-app |
| `account_banned` | Account banned | Email |
| `report_resolved` | Report action taken | in-app |

### 15.2 Real-Time Events (WebSocket)

**Events emitted by server:**
```
friend_request:received   { from: { username, avatar } }
friend_request:accepted   { by: { username } }
message:new               { conversationId, message }
support:message           { conversationId, message }
presence:update           { userId, status }
tournament:winner         { tournamentId, prize }
notification:new          { type, title, body, data }
```

**Client emits:**
```
presence:heartbeat        {} (every 20s)
presence:status_change    { status: 'online'|'busy'|'offline' }
message:read              { senderId }
```

---

## 16. FILE UPLOAD WORKFLOW

### 16.1 Avatar Upload
```
1. POST /api/upload/presign { type: 'avatar', contentType: 'image/jpeg' }
2. Server: generate S3 presigned URL, key = users/{userId}/avatar/{uuid}.jpg
3. Client: PUT directly to S3 URL
4. Client: PUT /api/profile { avatar: publicUrl }
5. Server: validate URL domain matches S3 bucket
6. Update user.avatar in DB
```

### 16.2 Banner Upload
Same flow, key = `users/{userId}/banner/{uuid}.jpg`

### 16.3 Constraints
- Avatar: max 5MB, 1:1 aspect ratio recommended, min 100x100px
- Banner: max 10MB, 3:1 aspect ratio recommended
- Media posts: max 10MB images, 50MB videos
- Accepted: image/jpeg, image/png, image/webp, image/gif, video/mp4

---

## 17. LEGAL & STATIC PAGES

- Served as static content (no API needed)
- Privacy Policy, Terms of Service: versioned, stored in DB for audit trail
- `GET /api/legal/privacy-policy?version=latest`
- `GET /api/legal/terms?version=latest`
- Versions linked to user acceptance at registration time

---

## 18. API REFERENCE SUMMARY

### Auth
```
POST   /api/auth/register
POST   /api/auth/verify-otp
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
POST   /api/auth/forgot-password
PUT    /api/auth/reset-password
POST   /api/auth/google
```

### Users
```
GET    /api/users/:username/profile
PUT    /api/profile
PUT    /api/profile/avatar
PUT    /api/profile/banner
GET    /api/users/presence
```

### Posts (Find Players)
```
GET    /api/posts
POST   /api/posts
PUT    /api/posts/:id
DELETE /api/posts/:id
```

### Media
```
GET    /api/media
POST   /api/media
DELETE /api/media/:id
POST   /api/media/:id/like
GET    /api/media/:id/comments
POST   /api/media/:id/comments
```

### Tournaments
```
GET    /api/tournaments
POST   /api/tournaments
PUT    /api/tournaments/:id/approve
PUT    /api/tournaments/:id/reject
POST   /api/tournaments/:id/teams
PUT    /api/matches/:id/winner
```

### Challenges
```
GET    /api/challenges
POST   /api/challenges           (manage_challenges)
PUT    /api/challenges/:id       (manage_challenges)
DELETE /api/challenges/:id       (manage_challenges)
POST   /api/challenges/:id/enroll
PUT    /api/challenges/:id/progress
GET    /api/rewards
POST   /api/rewards              (manage_challenges)
PUT    /api/rewards/:id          (manage_challenges)
DELETE /api/rewards/:id          (manage_challenges)
POST   /api/rewards/:id/purchase
```

### Friends & Messages
```
GET    /api/friends
POST   /api/friends/request
PUT    /api/friends/:id/accept
DELETE /api/friends/:id
PUT    /api/friends/:userId/block
GET    /api/messages/:userId
POST   /api/messages
PUT    /api/messages/read
```

### Reports
```
POST   /api/reports
GET    /api/reports              (manage_reports)
PUT    /api/reports/:id          (manage_reports)
```

### Admin
```
GET    /api/admin/users          (manage_users)
PUT    /api/admin/users/:id/role (manage_users)
PUT    /api/admin/users/:id/permissions (Owner only)
POST   /api/admin/users/:id/ban  (ban_users)
DELETE /api/admin/users/:id/ban  (ban_users)
POST   /api/admin/users/:id/warn (warn_users)
POST   /api/admin/users/:id/timeout (timeout_users)
GET    /api/admin/activity-logs  (view_activity)
```

### Support
```
GET    /api/support/conversations (view_support)
POST   /api/support/messages
PUT    /api/support/conversations/:id/close (view_support)
PUT    /api/support/conversations/:id/reopen (view_support)
```

### Wallet
```
GET    /api/wallet
GET    /api/wallet/transactions
```

### Premium
```
POST   /api/premium/create-checkout
POST   /api/premium/cancel
POST   /api/webhooks/stripe
```

### Upload
```
POST   /api/upload/presign
```

---

## 19. DATABASE SCHEMA (Key Tables)

```sql
-- Core user record
users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(20) UNIQUE NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('user','moderator','admin','owner') DEFAULT 'user',
  status          ENUM('active','warned','suspended','banned') DEFAULT 'active',
  region          VARCHAR(20) NOT NULL,
  account_language VARCHAR(5) NOT NULL,  -- immutable
  ui_language     VARCHAR(5) DEFAULT 'en',
  is_premium      BOOLEAN DEFAULT FALSE,
  is_riot_verified BOOLEAN DEFAULT FALSE,
  riot_account    JSONB,
  warning_count   INTEGER DEFAULT 0,
  timeout_until   TIMESTAMP,
  ban_reason      TEXT,
  ban_details     TEXT,
  banned_by       UUID REFERENCES users(id),
  banned_at       TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  last_active_at  TIMESTAMP
)

-- Profile (extended user info)
profiles (
  user_id         UUID PRIMARY KEY REFERENCES users(id),
  avatar_url      TEXT,
  banner_url      TEXT,
  background      VARCHAR(200),
  border_style    VARCHAR(200),
  name_color      VARCHAR(200),
  bio             TEXT,
  rank            VARCHAR(50),
  lp              INTEGER,
  tournament_earnings DECIMAL(10,2) DEFAULT 0,
  updated_at      TIMESTAMP
)

-- User permissions (for moderators)
user_permissions (
  user_id         UUID REFERENCES users(id),
  permission      VARCHAR(50),
  granted_by      UUID REFERENCES users(id),
  granted_at      TIMESTAMP,
  PRIMARY KEY (user_id, permission)
)
```

---

## 20. ERROR HANDLING

### HTTP Status Codes

| Code | Meaning | Example |
|---|---|---|
| 200 | Success | Request completed |
| 201 | Created | Resource created |
| 400 | Bad Request | Validation failed |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions / banned |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Username/email already taken |
| 422 | Unprocessable | Business logic violation |
| 429 | Rate Limited | Too many requests |
| 500 | Server Error | Unexpected failure |

### Standard Error Response
```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "field": "username",       // optional, for validation errors
  "details": {}              // optional extra context
}
```

### Key Error Codes
```
AUTH_INVALID_CREDENTIALS
AUTH_OTP_EXPIRED
AUTH_OTP_INVALID
AUTH_ACCOUNT_BANNED
AUTH_ACCOUNT_SUSPENDED
USERNAME_TAKEN
EMAIL_TAKEN
INSUFFICIENT_PERMISSIONS
INSUFFICIENT_POINTS
POST_RATE_LIMIT_EXCEEDED
REPORT_RATE_LIMIT_EXCEEDED
TOURNAMENT_REGISTRATION_CLOSED
TEAM_ALREADY_REGISTERED
PREMIUM_REQUIRED
FILE_TOO_LARGE
FILE_TYPE_NOT_ALLOWED
```

### Rate Limits
| Endpoint | Limit |
|---|---|
| POST /api/auth/login | 5/min per IP |
| POST /api/auth/verify-otp | 5 attempts, then 15min lockout |
| POST /api/posts | 3/hour per user |
| POST /api/reports | 5/hour per user |
| POST /api/messages | 30/min per user |
| POST /api/upload/presign | 10/hour per user |

---

*Document end. Version 1.0 — FinderQ SRS*
