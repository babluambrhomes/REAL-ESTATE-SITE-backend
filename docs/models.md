# DATABASE MODELS — Real Estate Backend (Prisma)

> Har model: kya karta hai, table name (`@map`), key fields, aur relations.
> Prisma multi-file schema — files `prisma/models/` aur `prisma/property/` me split hain.

---

## 📊 TABLE OF MODELS (25 models)

| # | Model | Table | Kaam | File |
|---|-------|-------|------|------|
| 1 | `User` | `users` | Login/auth account | `models/auth/user.prisma` |
| 2 | `Person` | `persons` | User ki personal info (1-to-1) | `models/Person.prisma` |
| 3 | `BuyerProfile` | `buyer_profiles` | Buyer ki profile (register pe auto) | `models/Buyer.prisma` |
| 4 | `SellerProfile` | `seller_profiles` | Uniform seller profile (IND/ORG) | `models/seller/Seller.prisma` |
| 5 | `Organization` | `organizations` | Company — seller ke sirf extras | `models/organization/Organization.prisma` |
| 6 | `SellerCategory` | `seller_categories` | Seller category (Builder/Broker...) | `models/seller/SellerCategory.prisma` |
| 7 | `SellerVerificationDocument` | `seller_verification_documents` | KYC docs (dual context) | `models/seller/SellerVerificationDocument.prisma` |
| 8 | `SellerRating` | `seller_ratings` | Seller ratings/reviews | `models/seller/SellerRating.prisma` |
| 9 | `SellerFollow` | `seller_follows` | Followers | `models/seller/SellerFollow.prisma` |
| 10 | `SellerFaq` | `seller_faqs` | Seller profile FAQ | `models/seller/SellerFaq.prisma` |
| 11 | `SellerEnquiry` | `seller_enquiries` | Lead/contact form | `models/seller/SellerEnquiry.prisma` |
| 12 | `SellerBlogPost` | `seller_blog_posts` | Seller blog posts | `models/seller/SellerBlogPost.prisma` |
| 13 | `SellerBlogInteraction` | `seller_blog_interactions` | Blog like/dislike/comment (1 table) | `models/seller/SellerBlogInteraction.prisma` |
| 14 | `Property` | `properties` | Property listing (shared data) | `property/Property.prisma` |
| 15 | `PropertyVariant` | `property_variants` | BHK configs (price/specs) | `property/PropertyVariant.prisma` |
| 16 | `PropertyFaq` | `property_faqs` | Property FAQ | `property/PropertyFaq.prisma` |
| 17 | `PropertyLike` | `property_likes` | Property like/wishlist | `property/PropertyLike.prisma` |
| 18 | `PropertyRating` | `property_ratings` | Property rating + comment | `property/PropertyRating.prisma` |
| 19 | `Permission` | `permissions` | RBAC master list (seed) | `models/rbac/Permission.prisma` |
| 20 | `Role` | `roles` | RBAC role templates | `models/rbac/Role.prisma` |
| 21 | `RolePermission` | `role_permissions` | Role↔Permission junction | `models/rbac/RolePermission.prisma` |
| 22 | `Member` | `members` | User → Role assignment (org/staff) | `models/Member.prisma` |
| 23 | `Invitation` | `invitations` | Invite flow (org/staff) | `models/Invitation.prisma` |
| 24 | `RefreshToken` | `refresh_tokens` | Refresh/session tokens | `models/auth/RefreshToken.prisma` |
| 25 | `Otp` | `otps` | One-time passwords | `models/auth/OTP.prisma` |

---

## 🏗️ CORE / AUTH MODELS

### 1. `User` → `users`
Login/auth account. `email` / `phone` / `googleId` unique (dono optional — Google login me phone nahi).
`hasPassword` string hai (NULL = Google-only account).

**Relations:**
- 1-to-1 → `Person`, `BuyerProfile`, `SellerProfile`
- 1-to-Many → `RefreshToken[]`, `Otp[]`, `Member[]`, `Invitation[]` (2: invitedBy + acceptedBy)
- 1-to-Many → `SellerRating[]` (ratings diye), `SellerFollow[]` (follow kiye), `SellerEnquiry[]` (leads bheje)
- 1-to-Many → `SellerBlogPost[]` (author), `SellerBlogInteraction[]`
- 1-to-Many → `PropertyLike[]`, `PropertyRating[]`
- Verified wale: `verifiedProperties[]`, `verifiedOrganizations[]`, `verifiedSellerProfiles[]`, `verifiedSellerDocuments[]`

### 2. `Person` → `persons`
User ki personal info (naam, avatar, DOB, gender, address). Auth se alag — profile info baar-baar badalti hai, auth nahi.
**Relation:** 1-to-1 → `User`.

### 3. `BuyerProfile` → `buyer_profiles`
Register hote hi auto-create. Har user by default buyer. Preferences JSONB (`budget`, `cities`, `property_types`).
**Relation:** 1-to-1 → `User`.

### 4. `SellerProfile` → `seller_profiles`
**Core table.** "Become Seller" pe create. INDIVIDUAL (`organizationId = NULL`) ya ORGANIZATION (`organizationId` linked).
Uniform shape — dono types ki public profile same. Organization ke common keys bhi yahi hain.

**Key fields:** `referenceCode` (SELL-XXXX), `slug` (URL), `sellerType`, `categoryId`, KYC scalars (`panNumber`/`aadhaarNumber`/`reraNumber` — INDIVIDUAL only, API pe masked), `headline/about/experienceYears`, `specializations[]`/`languages[]`, `logoUrl/coverPhotoUrl`, address, `happyClientsCount`, `videos[]`, `locations[]`, `bankApprovalList[]`, `achievements[]`, `socialLinks[]`, `contactPhone/Email`, `verificationStatus`.

**Relations:** 1-to-1 → `User`; Many-to-1 → `Organization` (optional), `SellerCategory` (optional); 1-to-Many → `verificationDocuments[]`, `ratings[]`, `properties[]`, `followers[]`, `faqs[]`, `enquiries[]`, `blogPosts[]`.

### 5. `Organization` → `organizations`
Company. **Sirf extras** — `name/description/registrationNumber/website/gstNumber/yearEstablished/employeeCount` + org-level `verificationStatus`. Common seller keys (slug, address, metrics, followers) SellerProfile pe hain.
Create hote hi 3 cheezein: Organization + Owner role (system) + Owner Member.

**Relations:** Many-to-1 → `User` (createdBy); 1-to-Many → `sellerProfiles[]`, `members[]`, `roles[]`, `invitations[]`, `verificationDocuments[]` (company docs yahan), `properties[]`.

### 6. `SellerCategory` → `seller_categories`
Seller category (Builder/Broker/Consultant...). **Self-referencing** — `parentId` se parent/child hierarchy (Real Estate → Builder). Platform admin manage karta hai.

**Relations:** 1-to-Many → `sellerProfiles[]`; self → `parent` + `children[]`.

### 24. `RefreshToken` → `refresh_tokens`
Login session token (long-lived, DB me store). Hashed store. **Family** = ek login session ki token chain (theft detection — rotated token dubara use pe puri family revoke). `deviceInfo/ipAddress/userAgent` = active sessions UI.

**Relations:** Many-to-1 → `User`.

### 25. `Otp` → `otps`
Email/phone verify, password reset, 2FA, passwordless login. `code` hashed, `identifier` = email/phone, `attempts/maxAttempts` brute-force protection, `purpose` + `status`.

**Relations:** Many-to-1 → `User` (optional — registration se pehle userId NULL).

---

## 🏢 SELLER MODELS

### 7. `SellerVerificationDocument` → `seller_verification_documents`
KYC proofs. **Dual context — ek central table:**
- INDIVIDUAL seller → `sellerId` (PAN, Aadhaar, RERA)
- ORGANIZATION → `organizationId` (GST, Company Registration, Office Proof)

`@@unique([sellerId, docType])` + `@@unique([organizationId, docType])` — ek doc type ka ek hi record (reject pe dobara upload = UPDATE).

**Relations:** Many-to-1 → `SellerProfile` (opt), `Organization` (opt), `User` (verifiedBy).

### 8. `SellerRating` → `seller_ratings`
Rating 1-5 + optional comment, ek row me. Moderation: `RatingStatus PENDING → PUBLISHED/HIDDEN`. Ek buyer ek seller ek rating (`@@unique([sellerId, buyerId])`).

**Relations:** Many-to-1 → `SellerProfile`, `User` (buyerId).

### 9. `SellerFollow` → `seller_follows`
Follower count **derived** from `_count` (kabhi out-of-sync nahi). Ek user ek seller ek follow (`@@unique([followerId, sellerId])`).

**Relations:** Many-to-1 → `User` (follower), `SellerProfile`.

### 10. `SellerFaq` → `seller_faqs`
Profile FAQ — question + answer + displayOrder.

**Relations:** Many-to-1 → `SellerProfile`.

### 11. `SellerEnquiry` → `seller_enquiries`
Contact/lead form (buyer → seller). `propertyId` optional (kis property me interest). Status `NEW → CONTACTED → CLOSED`.

**Relations:** Many-to-1 → `SellerProfile` (required), `User` (opt buyer), `Property` (opt).

### 12. `SellerBlogPost` → `seller_blog_posts`
Blog post. `authorId` = User (ORG seller me different members likhte hain). Status `DRAFT → PUBLISHED/ARCHIVED`, `viewsCount` counter.

**Relations:** Many-to-1 → `SellerProfile`, `User` (author); 1-to-Many → `interactions[]`.

### 13. `SellerBlogInteraction` → `seller_blog_interactions`
**Sab ek table me** — LIKE / DISLIKE / COMMENT:
- `type = LIKE/DISLIKE` → `content = NULL`, `reactionKey = "${blogPostId}|${userId}"` (unique) → ek user ek reaction
- `type = COMMENT` → `content = "text"`, `reactionKey = NULL` → multiple comments allowed
- `parentId` self-relation → replies; `status` → comment moderation

**Relations:** Many-to-1 → `SellerBlogPost`, `User`; self → `parent`/`replies[]`.

---

## 🏠 PROPERTY MODELS

### 14. `Property` → `properties`
Listing ka **shared** data (configs me common):
- Basic: `title/slug/description`, `transactionType` (SALE/RENT), `propertyType`, `propertyStatus`
- Location: `addressLine/city/state/country/pincode/lat/lng/googleMapLink`
- Shared: `ownershipType`, `listedBy`, `ageOfProperty`, `amenities[]` (society), `nearbyPlaces[]`, `societyInfo{}` (towers/units/acres)
- Media: `images[]`, `videoUrl`, `virtualTourUrl`
- Legal: `reraNumber/registrationNumber/taxAssessment/encumbrance`
- Contact: `contactName/Phone/Email`
- Engagement counters: `viewsCount/likesCount/sharesCount/ratingCount/averageRating`
- `isFeatured/isActive/isVerified` + `verifiedBy`

**Relations:** Many-to-1 → `SellerProfile` (required), `Organization` (opt), `User` (verifiedBy); 1-to-Many → `variants[]` (BHK), `faqs[]`, `likes[]`, `ratings[]`, `enquiries[]`.

### 15. `PropertyVariant` → `property_variants`
**BHK configuration** — 1 Property ke andar 2/3/4 BHK alag price/specs:
- `variantName` ("2 BHK", "3 BHK"...), `bedrooms/bathrooms/balconies`
- Pricing: `price`, `mrpPrice` (strike/discount), `pricePerSqft`
- Area: `totalArea+unit`, `carpetArea`, `superBuiltUpArea`, `plotArea`
- Floor/avail: `floorNumber/totalFloors`, `availabilityStatus` (READY_TO_MOVE/UNDER_CONSTRUCTION/NEW_LAUNCH), `possessionDate`, `isAvailable`, `inventoryCount`
- Furnishing: `furnishingStatus`, `furnishingItems[]` (rental `{item, count}`)
- Media: `images[]`, `brochure` (PDF link)

**Relations:** Many-to-1 → `Property` (Cascade). `@@unique([propertyId, variantName])`.

### 16. `PropertyFaq` → `property_faqs`
Property ke sawaal-jawaab (possession/RERA/maintenance).

**Relations:** Many-to-1 → `Property`.

### 17. `PropertyLike` → `property_likes`
Like = wishlist/saved. Ek user ek property ek like (`@@unique([userId, propertyId])`). Like → insert, unlike → delete + `Property.likesCount` sync.

**Relations:** Many-to-1 → `Property`, `User`.

### 18. `PropertyRating` → `property_ratings`
Rating 1-5 + optional comment (seller jaisa single table). Koi bhi user. Moderation `RatingStatus`. Ek user ek property ek rating (`@@unique([propertyId, userId])`). `Property.ratingCount/averageRating` sync transactionally.

**Relations:** Many-to-1 → `Property`, `User`.

---

## 🔐 RBAC MODELS (Permission System)

**Flow:** `Member → Role → RolePermission → Permission`

### 19. `Permission` → `permissions`
Master list — kya kya possible hai (`resource` + `action`). **Developer seed karta hai**, users nahi. `@@unique([scope, resource, action])`.

### 20. `Role` → `roles`
Permission ka template. Owner/SuperAdmin naye roles banate hain. `scope` ORGANIZATION (contextId = org) ya PLATFORM (contextId NULL). `isSystemRole` (Owner/SuperAdmin — delete nahi ho sakta), `isDefault`. `@@unique([scope, contextId, roleName])`.

### 21. `RolePermission` → `role_permissions`
Junction (many-to-many). Role → permissions mapping. `@@unique([roleId, permissionId])`.

### 22. `Member` → `members`
Kaun kahan kis role me kaam karta hai. `scope` ORGANIZATION (contextId = org) ya PLATFORM (contextId NULL). `@@unique([scope, contextId, userId])` — ek user ek context me ek baar.

### 23. `Invitation` → `invitations`
Invite flow. `invitationType` ORGANIZATION_MEMBER ya PLATFORM_STAFF. `token` unique, `expiresAt`. Accept pe: registered user → sirf Member; naya user → User + Person + Member. `status PENDING → ACCEPTED/DECLINED/EXPIRED/CANCELLED`.

---

## 🔗 RELATION MAP (ERD text)

```
User 1─1 Person
User 1─1 BuyerProfile
User 1─1 SellerProfile
User 1─N RefreshToken / Otp / Member / Invitation / SellerRating / SellerFollow
User 1─N SellerEnquiry / SellerBlogPost(author) / SellerBlogInteraction
User 1─N PropertyLike / PropertyRating
User 1─N Property(verifiedBy) / Organization(createdBy+verifiedBy) / SellerProfile(verifiedBy) / SellerVerificationDocument(verifiedBy)

SellerCategory 1─N SellerProfile  ─┐
Organization   1─N SellerProfile ─┴─→ 1 User

SellerProfile 1─N SellerVerificationDocument (IND)
Organization  1─N SellerVerificationDocument (ORG)
SellerProfile 1─N SellerRating / SellerFollow / SellerFaq / SellerEnquiry / SellerBlogPost
SellerBlogPost 1─N SellerBlogInteraction (self: replies)

SellerProfile 1─N Property ──→ 1 Organization(opt) / 1 User(verifiedBy)
Property 1─N PropertyVariant (BHK configs)
Property 1─N PropertyFaq / PropertyLike / PropertyRating / SellerEnquiry

Organization 1─N Role ──N RolePermission──N Permission
Organization 1─N Member / Invitation
Role 1─N Member / Invitation / RolePermission
```

---

## 🔢 ENUMS (`prisma/enums.prisma`)

| Enum | Values | Use |
|------|--------|-----|
| `AccountOrigin` | SELF_REGISTERED, INVITED | User account kaise bana |
| `UserStatus` | PENDING, ACTIVE, SUSPENDED, DEACTIVATED | User account status |
| `SellerType` | INDIVIDUAL, ORGANIZATION | Seller type |
| `VerificationStatus` | PENDING, VERIFIED, REJECTED | Seller/Org/doc verification |
| `OrganizationStatus` | ACTIVE, SUSPENDED, DEACTIVATED | Org status |
| `PermissionScope` | ORGANIZATION, PLATFORM | Permission context |
| `RoleScope` | ORGANIZATION, PLATFORM | Role context |
| `MemberScope` | ORGANIZATION, PLATFORM | Member context |
| `MemberStatus` | PENDING, ACTIVE, SUSPENDED, REMOVED | Member status |
| `InvitationType` | ORGANIZATION_MEMBER, PLATFORM_STAFF | Invite type |
| `InvitationStatus` | PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED | Invite status |
| `OtpPurpose` | EMAIL_VERIFICATION, PHONE_VERIFICATION, PASSWORD_RESET, LOGIN_2FA, LOGIN_PASSWORDLESS, ACCOUNT_DELETION | OTP kaam |
| `OtpStatus` | ACTIVE, USED, EXPIRED | OTP status |
| `TokenStatus` | ACTIVE, REVOKED, EXPIRED, ROTATED | Refresh token |
| `Gender` | MALE, FEMALE, OTHER | Person |
| `PropertyType` | APARTMENT, HOUSE, VILLA, PLOT, COMMERCIAL_SHOP, COMMERCIAL_OFFICE, COMMERCIAL_BUILDING, FARM_HOUSE, PENTHOUSE, STUDIO | Property type |
| `TransactionType` | SALE, RENT | Sale/rent |
| `PropertyStatus` | AVAILABLE, UNDER_OFFER, SOLD, RENTED, LEASED, WITHDRAWN, DRAFT | Listing status |
| `FurnishingStatus` | FURNISHED, SEMI_FURNISHED, UNFURNISHED | Furnishing |
| `OwnershipType` | FREEHOLD, LEASEHOLD, CO_OPERATIVE | Ownership |
| `ListedBy` | OWNER, AGENT, BUILDER | Kaun listed |
| `AvailabilityStatus` | READY_TO_MOVE, UNDER_CONSTRUCTION, NEW_LAUNCH | Variant availability |
| `SellerDocumentType` | PAN_CARD, AADHAAR_CARD, GST_CERTIFICATE, COMPANY_REGISTRATION, RERA_CERTIFICATE, OFFICE_ADDRESS_PROOF, OTHER | KYC doc types |
| `RatingStatus` | PENDING, PUBLISHED, HIDDEN | Rating moderation |
| `EnquiryStatus` | NEW, CONTACTED, CLOSED | Lead status |
| `BlogStatus` | DRAFT, PUBLISHED, ARCHIVED | Blog status |
| `SellerBlogInteractionType` | LIKE, DISLIKE, COMMENT | Blog interaction |
| `BlogCommentStatus` | PENDING, PUBLISHED, HIDDEN | Comment moderation |

---

## ⚠️ IMPORTANT PATTERNS

1. **Dual-context KYC** — `SellerVerificationDocument`: exactly one of `sellerId`/`organizationId` set hoga (app layer validate).
2. **Scalar vs Proof** — `panNumber`/`aadhaarNumber`/`gstNumber` = claim; documents table = proof. PAN/Aadhaar public API pe **masked**.
3. **Counter sync** — `Property.viewsCount/likesCount/sharesCount/ratingCount/averageRating` denormalized hain — updates transactionally with related rows.
4. **Derived counts** — followers, blog views, engagement `_count` se derived (koi field nahi, out-of-sync nahi hota).
5. **ReactionKey trick** — blog reactions: unique string key only for LIKE/DISLIKE, NULL for COMMENT (multiple comments allowed).
6. **Soft delete** — `deletedAt` on `SellerProfile`, `Property`, `SellerBlogPost`. Queries me filter `deletedAt = null`.
7. **RBAC scope** — `contextId` (org_id) shared concept: Organization/Platform dono same `Role`/`Member` tables.
8. **JSONB flexible fields** — `amenities`, `nearbyPlaces`, `societyInfo`, `locations`, `bankApprovalList`, `furnishingItems`, `images`, `tags`, `preferences` — structure app layer me validated.
