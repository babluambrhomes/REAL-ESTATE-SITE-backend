# Backend — Real Estate Site

## API Base URL
`http://localhost:PORT/api/v1`

---

## Dummy Test Users

Register/login karne ke liye niche diye gaye dummy credentials use karein. Ye koi seed nahi hain — aapko inhe manually register karna hoga, aur verification status (seller verification / org verification) khud change karni hogi.

> Phone unique hona chahiye, email unique hona chahiye — ek hi account pe dono se login kar sakte hain.

| # | User Type | Name | Email | Phone | Password |
|---|---|---|---|---|---|
| 1 | Platform Super Admin (seed) | Platform Admin | `admin@ambrhomes.com` | `9870000000` | `Admin@123456` |
| 2 | Platform Staff | Nikhil Joshi | `staff@ambrhomes.com` | `9870000001` | `Test@12345` |
| 2 | Platform Staff | Pooja Nair | `pooja.staff@test.com` | `9870000009` | `Test@12345` |

| 3 | Buyer (default role) | Rahul Verma | `rahul.buyer@test.com` | `9870000002` | `Test@12345` |
| 4 | Seller (Individual) — VERIFIED | Amit Sharma | `amit.seller@test.com` | `9870000003` | `Test@12345` |
| 5 | Seller (Individual) — PENDING | Suresh Kumar | `suresh.seller@test.com` | `9870000004` | `Test@12345` |
| 6 | Seller (Individual) — REJECTED | Vikram Singh | `vikram.seller@test.com` | `9870000005` | `Test@12345` |
| 7 | Seller (Organization) — VERIFIED | Priya Mehta | `priya.org@test.com` | `9870000006` | `Test@12345` |
| 8 | Seller (Organization) — PENDING | Rohan Gupta | `rohan.org@test.com` | `9870000007` | `Test@12345` |
| 9 | Buyer (default role) | Ananya Desai | `ananya.buyer@test.com` | `9870000008` | `Test@12345` |


### Kaise validate karein

1. **Super Admin / Staff** → `admin@ambrhomes.com` / `staff@ambrhomes.com` / `pooja.staff@test.com`
   - Property verify (`PATCH /properties/:id/verify`)
   - Property active toggle (`PATCH /properties/:id/toggle-active`)
   - Admin property list (`GET /properties/admin`)

2. **Verified Seller (Individual)** (`amit.seller@test.com`) → property create/update allowed
   - `POST /properties` → 201

3. **Unverified Seller (Individual)** (`suresh.seller@test.com` / `vikram.seller@test.com`) → property create blocked
   - `POST /properties` → `403 Seller verification required for this action`

4. **Verified Organization Seller** (`priya.org@test.com`) → property create allowed
   - `POST /properties` → 201

5. **Pending Organization Seller** (`rohan.org@test.com`) → property create blocked
   - `POST /properties` → `403 Organization verification required for this action`

> Note: Seller ka `verificationStatus` (Individual) ya Organization ka `verificationStatus` (Org seller) ko database me `VERIFIED` set karna hoga taaki create/update/delete routes pe allowed mile.