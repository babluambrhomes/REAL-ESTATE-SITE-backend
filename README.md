backend server in node js

## Bootstrap / Seed data

Fresh DB ke saath app chalane se pehle ye setup karna zaroori hai.

**Kyun?** Migrations sirf tables banati hain, unme master data nahi dalati.
RBAC data-driven hai (`User → Member → Role → RolePermission → Permission`),
isliye permissions DB me na hon to organization/seller create fail hota hai.
Seller/profile create ke liye kam se kam ek active category bhi chahiye.

**Structure**

- `src/seed/` — sirf seed **data** (permissions catalog, categories catalog).
- `scripts/` — executable logic: `bootstrap.ts` aur pehle se maujood `verifyPermissions.ts`.
- `prisma/seed.ts` use nahi hota; `npm run prisma:seed` ab `scripts/bootstrap.ts` chalata hai.

### Fresh DB order

```bash
npm run prisma:generate
npm run prisma:migrate      # dev; production me: npx prisma migrate deploy
npm run prisma:seed         # permissions -> categories -> role names -> platform admin
```

Seed idempotent hai — dobara chalane par duplicate nahi bante.

### Categories seeded

`builder`, `broker`, `consultant`, `developer`, `agent` (sab active).

System role names catalog se aate hain:

- `PLATFORM_ROLE_NAME` = `Platform Owner`
- `OWNER_ROLE_NAME` = `Organization Owner`
- `INDIVIDUAL_ROLE_NAME` = `Individual`

`npm run prisma:seed` purane system role names (`Supper Admin`, `Owner`,
`Individual Seller`) ko in naye names par rename karta hai. Sirf
`isSystemRole: true` wale roles change hote hain; custom roles aur data delete
nahi hote.

### Dummy admin credentials (local development only)

Maine ye **dummy** values `.env` me daalne ke liye README me mention ki hain
(unhe `scripts/bootstrap.ts` local me fallback ke taur par bhi use karta hai):

```env
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=change-me-local-only
BOOTSTRAP_ADMIN_NAME=Platform Admin
```

Ye sirf local development ke liye hain. Production me `NODE_ENV=production`
hone par ye dummy values **kaam nahi karengi** — real env vars dena zaroori hoga.
Password kisi source file me store nahi hai aur log bhi nahi hota.

### Verify

```bash
npm run prisma:verify-permissions   # catalog aur route guards ka static check
npm run typecheck
```

