/**
 * SEED DATA ONLY — koi bhi DB call yahan nahi hai.
 *
 * Ye seller categories ka default catalogue hai. Iska upyog
 * scripts/bootstrap.ts karta hai. Data aur logic alag isliye rakhe hain
 * taaki "kaunsi categories seed honi chahiye" aur "unhe kaise seed karein"
 * dono alag jagah clear rahein.
 *
 * slug UNIQUE hai, isliye upsert slug par hota hai — dobara chalane par
 * duplicate categories nahi banti, aur existing category ka name/description
 * update ho jata hai. isActive true isliye hai kyunki inactive category seller
 * profile me select nahi ho sakti (sellerProfileData.helper.ts).
 */
export interface SellerCategorySeed {
  name: string;
  slug: string;
  description: string;
  isActive: true;
}

export const SELLER_CATEGORIES: SellerCategorySeed[] = [
  {
    name: "Builder",
    slug: "builder",
    description: "Builders and construction companies launching new projects",
    isActive: true,
  },
  {
    name: "Broker",
    slug: "broker",
    description: "Property brokers dealing in resale and rental listings",
    isActive: true,
  },
  {
    name: "Consultant",
    slug: "consultant",
    description: "Real estate consultants and advisors",
    isActive: true,
  },
  {
    name: "Developer",
    slug: "developer",
    description: "Large-scale property developers and land developers",
    isActive: true,
  },
  {
    name: "Agent",
    slug: "agent",
    description: "Individual real estate agents representing buyers and sellers",
    isActive: true,
  },
];
