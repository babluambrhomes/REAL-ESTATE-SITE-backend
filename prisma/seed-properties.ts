import slugify from "slugify";
import prisma from "../src/config/prisma";

// ============================================================
// DEMO PROPERTIES SEED (20 listings)
// Idempotent: seed-marked properties delete + recreate hoti hain.
// Sellers (users + profiles) upsert hote hain.
// ============================================================

const SEED_PROPERTY_CODE_PREFIX = "SP-";

const SEED_SELLERS = [
  {
    email: "estatehub@ambrdemo.com",
    phone: "+919810000101",
    referenceCode: "SELL-ESTHUB1",
    slug: "estatehub-realty",
    sellerType: "INDIVIDUAL" as const,
    headline: "Trusted real estate partner across Delhi NCR",
    city: "Gurugram",
    state: "Haryana",
    verificationStatus: "VERIFIED" as const,
  },
  {
    email: "skyline@ambrdemo.com",
    phone: "+919810000102",
    referenceCode: "SELL-SKYLIN1",
    slug: "skyline-developers",
    sellerType: "INDIVIDUAL" as const,
    headline: "Premium residential & commercial projects in India",
    city: "Hyderabad",
    state: "Telangana",
    verificationStatus: "VERIFIED" as const,
  },
];

const seedVariants = (
  configs: Array<{
    variantName: string;
    bedrooms: number;
    bathrooms: number;
    balconies: number;
    price: number;
    mrpPrice?: number;
    totalArea: number;
    carpetArea: number;
    floorNumber?: number;
    totalFloors?: number;
    availabilityStatus: "READY_TO_MOVE" | "UNDER_CONSTRUCTION" | "NEW_LAUNCH";
    furnishingStatus: "FURNISHED" | "SEMI_FURNISHED" | "UNFURNISHED";
    possessionDate?: string;
    inventoryCount?: number;
  }>
) =>
  configs.map((c, idx) => ({
    ...c,
    variantCode: `${SEED_PROPERTY_CODE_PREFIX}V-${idx + 1}`,
    pricePerSqft: Math.round(c.price / c.totalArea),
    isAvailable: true,
    possessionDate: c.possessionDate ? new Date(c.possessionDate) : undefined,
  }));

interface SeedPropertyInput {
  seller?: string;
  title: string;
  transactionType: "SALE" | "RENT";
  propertyType:
    | "APARTMENT"
    | "HOUSE"
    | "VILLA"
    | "PLOT"
    | "COMMERCIAL_SHOP"
    | "COMMERCIAL_OFFICE"
    | "COMMERCIAL_BUILDING"
    | "FARM_HOUSE"
    | "PENTHOUSE"
    | "STUDIO";
  propertyStatus?: "AVAILABLE" | "UNDER_OFFER" | "SOLD";
  description: string;
  addressLine: string;
  city: string;
  state: string;
  country?: string;
  pincode: string;
  latitude: number;
  longitude: number;
  ownershipType: "FREEHOLD" | "LEASEHOLD" | "CO_OPERATIVE";
  listedBy?: "OWNER" | "AGENT" | "BUILDER";
  ageOfProperty?: number;
  amenities: string[];
  nearbyPlaces: string[];
  reraNumber?: string;
  isFeatured?: boolean;
  viewsCount?: number;
  likesCount?: number;
  variants: ReturnType<typeof seedVariants>;
}

const PROPERTIES: SeedPropertyInput[] = [
  {
    seller: "estatehub-realty",
    title: "2 BHK Furnished Apartment in Noida Sector 62",
    transactionType: "SALE",
    propertyType: "APARTMENT",
    description:
      "Well-maintained 2 BHK apartment in a gated society at Noida Sector 62. Close to Metro station, schools and offices. Fully ventilated rooms with modern modular kitchen.",
    addressLine: "Tower B, Palm Grove Residency, Sector 62",
    city: "Noida",
    state: "Uttar Pradesh",
    pincode: "201301",
    latitude: 28.6146,
    longitude: 77.3702,
    ownershipType: "FREEHOLD",
    listedBy: "AGENT",
    ageOfProperty: 8,
    amenities: ["gym", "car_parking", "lift", "power_backup", "security", "clubhouse"],
    nearbyPlaces: ["Noida City Center Metro", "Fortis Hospital", "DLF Mall of India"],
    reraNumber: "UP-RERA-2019-000123",
    isFeatured: true,
    viewsCount: 340,
    likesCount: 28,
    variants: seedVariants([
      {
        variantName: "2 BHK",
        bedrooms: 2,
        bathrooms: 2,
        balconies: 1,
        price: 9800000,
        mrpPrice: 10500000,
        totalArea: 1250,
        carpetArea: 1050,
        floorNumber: 7,
        totalFloors: 18,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "SEMI_FURNISHED",
      },
    ]),
  },
  {
    seller: "estatehub-realty",
    title: "3 BHK Apartment in Noida Sector 150",
    transactionType: "SALE",
    propertyType: "APARTMENT",
    description:
      "Brand new 3 BHK apartment in Sector 150 Noida with great connectivity to expressways. High-end fixtures, spacious balconies and premium club amenities.",
    addressLine: "Aster Court, Sector 150",
    city: "Noida",
    state: "Uttar Pradesh",
    pincode: "201310",
    latitude: 28.4641,
    longitude: 77.4225,
    ownershipType: "FREEHOLD",
    listedBy: "AGENT",
    ageOfProperty: 3,
    amenities: ["swimming_pool", "gym", "car_parking", "jogging_track", "children_park", "cctv"],
    nearbyPlaces: ["Noida-Greater Noida Expressway", "Sector 144 Metro", "Yatharth Hospital"],
    reraNumber: "UP-RERA-2021-000456",
    isFeatured: true,
    viewsCount: 512,
    likesCount: 44,
    variants: seedVariants([
      {
        variantName: "3 BHK",
        bedrooms: 3,
        bathrooms: 3,
        balconies: 2,
        price: 18500000,
        mrpPrice: 19800000,
        totalArea: 1680,
        carpetArea: 1420,
        floorNumber: 12,
        totalFloors: 22,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "UNFURNISHED",
      },
      {
        variantName: "3 BHK + Study",
        bedrooms: 3,
        bathrooms: 3,
        balconies: 2,
        price: 20500000,
        totalArea: 1820,
        carpetArea: 1560,
        floorNumber: 14,
        totalFloors: 22,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "UNFURNISHED",
        inventoryCount: 4,
      },
    ]),
  },
  {
    seller: "estatehub-realty",
    title: "4 BHK Luxury Apartment in South City II Gurugram",
    transactionType: "SALE",
    propertyType: "APARTMENT",
    description:
      "Spacious 4 BHK duplex apartment in an established South City II address. Corner unit with open terraces, premium woodwork and dedicated servant room view.",
    addressLine: "The Residences, South City II",
    city: "Gurugram",
    state: "Haryana",
    pincode: "122018",
    latitude: 28.4344,
    longitude: 77.0701,
    ownershipType: "FREEHOLD",
    listedBy: "AGENT",
    ageOfProperty: 6,
    amenities: ["swimming_pool", "gym", "jacuzzi", "home_theatre", "garden", "servant_room"],
    nearbyPlaces: ["South City Mall", "Fortis Hospital", "Golf Course Road"],
    reraNumber: "HRERA-2017-GGM-0002210",
    isFeatured: true,
    viewsCount: 489,
    likesCount: 61,
    variants: seedVariants([
      {
        variantName: "4 BHK",
        bedrooms: 4,
        bathrooms: 4,
        balconies: 3,
        price: 32000000,
        totalArea: 3100,
        carpetArea: 2700,
        floorNumber: 15,
        totalFloors: 25,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "SEMI_FURNISHED",
      },
    ]),
  },
  {
    seller: "estatehub-realty",
    title: "3 BHK Semi-Furnished Apartment on Golf Course Extension",
    transactionType: "SALE",
    propertyType: "APARTMENT",
    description:
      "Corner 3 BHK with beautiful greenside views on Golf Course Extension Road. Features imported modular kitchen, wooden flooring and 24x7 concierge.",
    addressLine: "Sunteck City, Golf Course Extension Road",
    city: "Gurugram",
    state: "Haryana",
    pincode: "122102",
    latitude: 28.4132,
    longitude: 77.0451,
    ownershipType: "FREEHOLD",
    listedBy: "AGENT",
    ageOfProperty: 4,
    amenities: ["gym", "swimming_pool", "car_parking", "security", "clubhouse", "ice_skating"],
    nearbyPlaces: ["Unitech Cyber Park", "Medanta Hospital", "Golf Course Road"],
    reraNumber: "HRERA-2019-GGM-0003321",
    viewsCount: 356,
    likesCount: 31,
    variants: seedVariants([
      {
        variantName: "3 BHK",
        bedrooms: 3,
        bathrooms: 3,
        balconies: 2,
        price: 24000000,
        totalArea: 1900,
        carpetArea: 1620,
        floorNumber: 9,
        totalFloors: 19,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "SEMI_FURNISHED",
      },
    ]),
  },
  {
    seller: "estatehub-realty",
    title: "1 BHK Fully Furnished Service Apartment in DLF Cyber City",
    transactionType: "RENT",
    propertyType: "APARTMENT",
    description:
      "Corporate-ready fully furnished 1 BHK in walking distance of DLF Cyber City. Includes high-speed wifi, housekeeping and club membership.",
    addressLine: "Vipul World, Golf Course Road",
    city: "Gurugram",
    state: "Haryana",
    pincode: "122002",
    latitude: 28.4905,
    longitude: 77.0881,
    ownershipType: "LEASEHOLD",
    listedBy: "AGENT",
    ageOfProperty: 5,
    amenities: ["wifi", "housekeeping", "gym", "car_parking", "power_backup", "maid"],
    nearbyPlaces: ["DLF Cyber City", "Ambience Mall", "MG Road Metro"],
    viewsCount: 623,
    likesCount: 87,
    variants: seedVariants([
      {
        variantName: "1 BHK",
        bedrooms: 1,
        bathrooms: 1,
        balconies: 1,
        price: 55000,
        totalArea: 720,
        carpetArea: 620,
        floorNumber: 11,
        totalFloors: 15,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "FURNISHED",
      },
    ]),
  },
  {
    seller: "estatehub-realty",
    title: "Commercial Shop on Rent in Rajouri Garden",
    transactionType: "RENT",
    propertyType: "COMMERCIAL_SHOP",
    description:
      "High-footfall ground floor shop in the heart of Rajouri Garden market. Ideal for retail, showroom or food outlet with glass facade.",
    addressLine: "Main Market, Rajouri Garden",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110027",
    latitude: 28.6384,
    longitude: 77.1201,
    ownershipType: "FREEHOLD",
    listedBy: "AGENT",
    ageOfProperty: 15,
    amenities: ["100a_power", "shopfront", "washroom"],
    nearbyPlaces: ["Rajouri Garden Metro", "Pacific Mall", "District Centre"],
    viewsCount: 278,
    likesCount: 19,
    variants: seedVariants([
      {
        variantName: "Ground Floor Shop",
        bedrooms: 0,
        bathrooms: 1,
        balconies: 0,
        price: 85000,
        totalArea: 450,
        carpetArea: 420,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "UNFURNISHED",
      },
    ]),
  },
  {
    seller: "estatehub-realty",
    title: "Commercial Office Space for Sale in Saket",
    transactionType: "SALE",
    propertyType: "COMMERCIAL_OFFICE",
    description:
      "Prime office space in Saket office district with corporate lobby, false ceiling, HVAC and 4 dedicated parking slots. Great for corporates and clinics.",
    addressLine: "Sunny Plaza, Saket",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110017",
    latitude: 28.5245,
    longitude: 77.2064,
    ownershipType: "FREEHOLD",
    listedBy: "AGENT",
    ageOfProperty: 10,
    amenities: ["hvac", "lobby", "car_parking", "lift", "cctv"],
    nearbyPlaces: ["Saket Metro", "Select Citywalk", "Fortis Hospital"],
    reraNumber: "DL-RERA-2018-C-000789",
    viewsCount: 411,
    likesCount: 26,
    variants: seedVariants([
      {
        variantName: "Office Space 1800 sqft",
        bedrooms: 0,
        bathrooms: 2,
        balconies: 0,
        price: 65000000,
        totalArea: 1800,
        carpetArea: 1500,
        floorNumber: 4,
        totalFloors: 7,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "FURNISHED",
      },
    ]),
  },
  {
    seller: "estatehub-realty",
    title: "Residential Plot in Greater Noida West",
    transactionType: "SALE",
    propertyType: "PLOT",
    description:
      "Fully fenced residential plot in a developing sector of Greater Noida West. Clear title, gated community with boundary wall and internal roads.",
    addressLine: "Sector 12, Greater Noida West",
    city: "Greater Noida",
    state: "Uttar Pradesh",
    pincode: "201310",
    latitude: 28.5547,
    longitude: 77.4778,
    ownershipType: "FREEHOLD",
    listedBy: "OWNER",
    ageOfProperty: 2,
    amenities: ["boundary_wall", "road", "street_lighting"],
    nearbyPlaces: ["Noida-Greater Noida Expressway", "Paramount Golf Foreste", "WHO City"],
    reraNumber: "UP-RERA-2020-000654",
    viewsCount: 198,
    likesCount: 12,
    variants: seedVariants([
      {
        variantName: "120 sqyd Plot",
        bedrooms: 0,
        bathrooms: 0,
        balconies: 0,
        price: 7500000,
        totalArea: 1080,
        carpetArea: 1080,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "UNFURNISHED",
      },
      {
        variantName: "200 sqyd Plot",
        bedrooms: 0,
        bathrooms: 0,
        balconies: 0,
        price: 12300000,
        totalArea: 1800,
        carpetArea: 1800,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "UNFURNISHED",
        inventoryCount: 3,
      },
    ]),
  },
  {
    seller: "estatehub-realty",
    title: "3 BHK Sea-Facing Penthouse in Bandra West",
    transactionType: "SALE",
    propertyType: "PENTHOUSE",
    description:
      "Rare sea-facing penthouse on the 32nd floor at Bandra West with private terrace and stunning Arabian Sea views. Designer interiors and smart home automation.",
    addressLine: "Ocean Heights, Bandstand, Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
    latitude: 19.0416,
    longitude: 72.8273,
    ownershipType: "CO_OPERATIVE",
    listedBy: "AGENT",
    ageOfProperty: 6,
    amenities: ["private_terrace", "sea_view", "home_automation", "servant_room", "3car_parking", "clubhouse"],
    nearbyPlaces: ["Bandra Fort", "Linking Road", "Hilton Hotel"],
    reraNumber: "MahaRERA-P51800001234",
    isFeatured: true,
    viewsCount: 871,
    likesCount: 118,
    variants: seedVariants([
      {
        variantName: "3 BHK Penthouse",
        bedrooms: 3,
        bathrooms: 3,
        balconies: 2,
        price: 85000000,
        totalArea: 3600,
        carpetArea: 3100,
        floorNumber: 32,
        totalFloors: 32,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "FURNISHED",
      },
    ]),
  },
  {
    seller: "estatehub-realty",
    title: "Studio Apartment for Rent in Powai",
    transactionType: "RENT",
    propertyType: "STUDIO",
    description:
      "Compact studio apartment in a premium Powai high-rise with facilities like rooftop pool and gymnasium. Perfect for professionals working in MIDC.",
    addressLine: "Indiabulls Greens, Powai",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400076",
    latitude: 19.1136,
    longitude: 72.8697,
    ownershipType: "LEASEHOLD",
    listedBy: "AGENT",
    ageOfProperty: 4,
    amenities: ["rooftop_pool", "gym", "cafeteria", "security", "car_parking"],
    nearbyPlaces: ["Hiranandani Gardens", "Phoenix Palladium", "IIT Bombay"],
    viewsCount: 447,
    likesCount: 52,
    variants: seedVariants([
      {
        variantName: "Studio",
        bedrooms: 1,
        bathrooms: 1,
        balconies: 0,
        price: 42000,
        totalArea: 520,
        carpetArea: 450,
        floorNumber: 18,
        totalFloors: 27,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "FURNISHED",
      },
    ]),
  },
  {
    seller: "skyline-developers",
    title: "2 BHK Under Construction Apartment in Hinjewadi",
    transactionType: "SALE",
    propertyType: "APARTMENT",
    description:
      "Modern 2 BHK in a new IT-corridor township at Hinjewadi Phase 3. RERA approved with possession in 2026. Ideal for IT professionals investing early.",
    addressLine: "Forest Greens, Hinjewadi Phase 3",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411057",
    latitude: 18.5818,
    longitude: 73.6831,
    ownershipType: "FREEHOLD",
    listedBy: "BUILDER",
    ageOfProperty: 0,
    amenities: ["gym", "swimming_pool", "clubhouse", "cricket_pitch", "cafeteria", "parking"],
    nearbyPlaces: ["Infosys Campus", "Wipro Campus", "Hinjewadi Phase 3 Station"],
    reraNumber: "P52100045221",
    isFeatured: true,
    viewsCount: 709,
    likesCount: 95,
    variants: seedVariants([
      {
        variantName: "2 BHK",
        bedrooms: 2,
        bathrooms: 2,
        balconies: 1,
        price: 12000000,
        mrpPrice: 13100000,
        totalArea: 1100,
        carpetArea: 920,
        floorNumber: 5,
        totalFloors: 16,
        availabilityStatus: "UNDER_CONSTRUCTION",
        furnishingStatus: "UNFURNISHED",
        possessionDate: "2026-08-01",
        inventoryCount: 12,
      },
    ]),
  },
  {
    seller: "skyline-developers",
    title: "3 BHK Independent House in Gachibowli",
    transactionType: "SALE",
    propertyType: "HOUSE",
    description:
      "Standalone 3 BHK family house with own compound in Gachibowli. Car porch, power backup and pure 24x7 water supply. Close to Financial District.",
    addressLine: "Sy No 32, Gachibowli",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500032",
    latitude: 17.4401,
    longitude: 78.3489,
    ownershipType: "FREEHOLD",
    listedBy: "BUILDER",
    ageOfProperty: 5,
    amenities: ["car_porch", "power_backup", "borewell", "compound_wall", "terrace"],
    nearbyPlaces: ["Financial District", "Aparna Sarovar", "HCU"],
    reraNumber: "HY-RERA-2019-003421",
    viewsCount: 268,
    likesCount: 22,
    variants: seedVariants([
      {
        variantName: "3 BHK",
        bedrooms: 3,
        bathrooms: 3,
        balconies: 2,
        price: 21000000,
        totalArea: 2600,
        carpetArea: 2200,
        floorNumber: 1,
        totalFloors: 2,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "SEMI_FURNISHED",
      },
    ]),
  },
  {
    seller: "skyline-developers",
    title: "4 BHK Luxury Villa in Kokapet",
    transactionType: "SALE",
    propertyType: "VILLA",
    description:
      "New launch luxury gated villas at Kokapet Neopolis. Each villa has private garden, smart home setup and resort-style community amenities.",
    addressLine: "Neopolis Boulevard, Kokapet",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500075",
    latitude: 17.3871,
    longitude: 78.3058,
    ownershipType: "FREEHOLD",
    listedBy: "BUILDER",
    ageOfProperty: 0,
    amenities: ["private_garden", "smart_home", "clubhouse", "swimming_pool", "security", "kids_pool"],
    nearbyPlaces: ["Villa Valet", "IKEA Hyderabad", "Gachibowli"],
    reraNumber: "HY-RERA-2023-004812",
    isFeatured: true,
    viewsCount: 944,
    likesCount: 142,
    variants: seedVariants([
      {
        variantName: "4 BHK Villa",
        bedrooms: 4,
        bathrooms: 5,
        balconies: 2,
        price: 69000000,
        mrpPrice: 73000000,
        totalArea: 4200,
        carpetArea: 3600,
        floorNumber: 2,
        totalFloors: 3,
        availabilityStatus: "NEW_LAUNCH",
        furnishingStatus: "UNFURNISHED",
        possessionDate: "2027-03-01",
        inventoryCount: 8,
      },
    ]),
  },
  {
    seller: "skyline-developers",
    title: "5 BHK Luxury Farmhouse near Jaipur",
    transactionType: "SALE",
    propertyType: "FARM_HOUSE",
    description:
      "Palatial farmhouse on 1.2 acres of lush farmland near Jaipur. Main house with 5 bedrooms, servants quarters, borewell and orchard.",
    addressLine: "Village Kanota, Agra Road",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "303001",
    latitude: 26.9124,
    longitude: 75.7873,
    ownershipType: "FREEHOLD",
    listedBy: "OWNER",
    ageOfProperty: 9,
    amenities: ["orchard", "servant_quarters", "borewell", "own_compound", "lawn", "party_lawn"],
    nearbyPlaces: ["Kanota Fort", "Jaipur-Agra Highway", "Airport Road"],
    viewsCount: 321,
    likesCount: 38,
    variants: seedVariants([
      {
        variantName: "5 BHK Farmhouse",
        bedrooms: 5,
        bathrooms: 5,
        balconies: 1,
        price: 120000000,
        mrpPrice: 130000000,
        totalArea: 5400,
        carpetArea: 4700,
        floorNumber: 2,
        totalFloors: 2,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "FURNISHED",
      },
    ]),
  },
  {
    seller: "skyline-developers",
    title: "2 BHK Apartment in Whitefield Bengaluru",
    transactionType: "SALE",
    propertyType: "APARTMENT",
    description:
      "Resale-ready 2 BHK in Whitefield with excellent rental yield. Club house society with everything an IT couple needs nearby.",
    addressLine: "Sunrise County, Whitefield Main Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560066",
    latitude: 12.9698,
    longitude: 77.7500,
    ownershipType: "FREEHOLD",
    listedBy: "BUILDER",
    ageOfProperty: 3,
    amenities: ["gym", "swimming_pool", "badminton", "car_parking", "24x7_security"],
    nearbyPlaces: ["ITPL", "Phoenix Marketcity", "Whitefield Metro"],
    reraNumber: "PRM/KA/RERA/1251/306/2020",
    viewsCount: 379,
    likesCount: 41,
    variants: seedVariants([
      {
        variantName: "2 BHK",
        bedrooms: 2,
        bathrooms: 2,
        balconies: 1,
        price: 14000000,
        totalArea: 1150,
        carpetArea: 980,
        floorNumber: 6,
        totalFloors: 14,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "SEMI_FURNISHED",
      },
      {
        variantName: "3 BHK",
        bedrooms: 3,
        bathrooms: 2,
        balconies: 2,
        price: 17200000,
        totalArea: 1480,
        carpetArea: 1260,
        floorNumber: 8,
        totalFloors: 14,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "UNFURNISHED",
        inventoryCount: 2,
      },
    ]),
  },
  {
    seller: "skyline-developers",
    title: "1 BHK Apartment for Rent in Koramangala",
    transactionType: "RENT",
    propertyType: "APARTMENT",
    description:
      "Affordable 1 BHK in Koramangala 4th Block, a backpacker and startup favourite. Unfurnished with modular kitchen and covered parking.",
    addressLine: "Brigade Gardenia, Koramangala 4th Block",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560034",
    latitude: 12.9352,
    longitude: 77.6245,
    ownershipType: "FREEHOLD",
    listedBy: "BUILDER",
    ageOfProperty: 7,
    amenities: ["car_parking", "gym", "housekeeping", "cctv"],
    nearbyPlaces: ["Forum Mall", "Koramangala Club", "majestic city"],
    viewsCount: 504,
    likesCount: 66,
    variants: seedVariants([
      {
        variantName: "1 BHK",
        bedrooms: 1,
        bathrooms: 1,
        balconies: 1,
        price: 28000,
        totalArea: 620,
        carpetArea: 540,
        floorNumber: 3,
        totalFloors: 9,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "UNFURNISHED",
      },
    ]),
  },
  {
    seller: "skyline-developers",
    title: "Commercial Showroom on CG Road Ahmedabad",
    transactionType: "SALE",
    propertyType: "COMMERCIAL_SHOP",
    description:
      "Prestigious ground floor showroom on CG Road - one of Ahmedabad's most coveted retail strips. Around-the-clock security and premium glass facade.",
    addressLine: "Shop 102, Pariseema Complex, CG Road",
    city: "Ahmedabad",
    state: "Gujarat",
    pincode: "380009",
    latitude: 23.0225,
    longitude: 72.5714,
    ownershipType: "FREEHOLD",
    listedBy: "BUILDER",
    ageOfProperty: 12,
    amenities: ["3_phase_power", "glass_facade", "washroom", "cctv"],
    nearbyPlaces: ["Ahmedabad One Mall", "Law Garden", "Nehru Bridge"],
    viewsCount: 254,
    likesCount: 21,
    variants: seedVariants([
      {
        variantName: "Showroom 1300 sqft",
        bedrooms: 0,
        bathrooms: 2,
        balconies: 0,
        price: 38000000,
        totalArea: 1300,
        carpetArea: 1150,
        floorNumber: 1,
        totalFloors: 12,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "UNFURNISHED",
      },
    ]),
  },
  {
    seller: "skyline-developers",
    title: "3 BHK Apartment in Anna Nagar Chennai",
    transactionType: "SALE",
    propertyType: "APARTMENT",
    description:
      "Spacious 3 BHK in the heart of Anna Nagar with premium interior work. Vastu-friendly layout, community hall and senior-friendly amenities.",
    addressLine: "Shanthi Colony, Anna Nagar",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600040",
    latitude: 13.0827,
    longitude: 80.2707,
    ownershipType: "CO_OPERATIVE",
    listedBy: "BUILDER",
    ageOfProperty: 5,
    amenities: ["community_hall", "gym", "parking", "power_backup", "lift"],
    nearbyPlaces: ["Anna Nagar Tower", "VR Chennai Mall", "Amma Kada"],
    reraNumber: "TN-RERA-002190",
    viewsCount: 301,
    likesCount: 34,
    variants: seedVariants([
      {
        variantName: "3 BHK",
        bedrooms: 3,
        bathrooms: 3,
        balconies: 2,
        price: 26000000,
        totalArea: 1950,
        carpetArea: 1700,
        floorNumber: 4,
        totalFloors: 11,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "SEMI_FURNISHED",
      },
    ]),
  },
  {
    seller: "skyline-developers",
    title: "2 BHK Semi-Furnished Apartment for Rent in Kothrud",
    transactionType: "RENT",
    propertyType: "APARTMENT",
    description:
      "Prompt-possession 2 BHK in Kothrud with wooden wardrobes and modular kitchen. Walking distance to Pune University area and big IT parks.",
    addressLine: "Gokhale Nagar, Kothrud",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411038",
    latitude: 18.5074,
    longitude: 73.8077,
    ownershipType: "LEASEHOLD",
    listedBy: "AGENT",
    ageOfProperty: 6,
    amenities: ["modular_kitchen", "car_parking", "power_backup", "cctv"],
    nearbyPlaces: ["Pune University", "Phoenix Marketcity", "Kothrud Depot"],
    viewsCount: 589,
    likesCount: 71,
    variants: seedVariants([
      {
        variantName: "2 BHK",
        bedrooms: 2,
        bathrooms: 2,
        balconies: 1,
        price: 30000,
        totalArea: 980,
        carpetArea: 850,
        floorNumber: 3,
        totalFloors: 8,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "SEMI_FURNISHED",
      },
    ]),
  },
  {
    seller: "skyline-developers",
    title: "4 BHK Independent House in Banjara Hills",
    transactionType: "SALE",
    propertyType: "HOUSE",
    description:
      "Elegant independent house in Banjara Hills Road 12 with a landscaped front lawn and turret-style architecture. Premium fixtures throughout.",
    addressLine: "Road 12, Banjara Hills",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500034",
    latitude: 17.4147,
    longitude: 78.4405,
    ownershipType: "FREEHOLD",
    listedBy: "OWNER",
    ageOfProperty: 11,
    amenities: ["front_lawn", "servant_room", "3car_parking", "borewell", "intercom", "terrace"],
    nearbyPlaces: ["City Centre Mall", "Taj Krishna", "Jubilee Hills Road No 36"],
    viewsCount: 462,
    likesCount: 55,
    variants: seedVariants([
      {
        variantName: "4 BHK",
        bedrooms: 4,
        bathrooms: 4,
        balconies: 1,
        price: 44000000,
        totalArea: 3400,
        carpetArea: 2900,
        floorNumber: 2,
        totalFloors: 2,
        availabilityStatus: "READY_TO_MOVE",
        furnishingStatus: "FURNISHED",
      },
    ]),
  },
];

// ============================================================
// SEED HELPERS
// ============================================================

const seedSellers = async () => {
  const builderCategory = await prisma.sellerCategory.findFirst({
    where: { slug: "builder" },
    select: { id: true },
  });

  const sellers = [];

  for (const s of SEED_SELLERS) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { status: "ACTIVE", emailVerified: true },
      create: {
        email: s.email,
        phone: s.phone,
        emailVerified: true,
        status: "ACTIVE",
        accountOrigin: "SELF_REGISTERED",
      },
    });

    const seller = await prisma.sellerProfile.upsert({
      where: { slug: s.slug },
      update: {
        headline: s.headline,
        verificationStatus: s.verificationStatus,
        city: s.city,
        state: s.state,
      },
      create: {
        userId: user.id,
        referenceCode: s.referenceCode,
        slug: s.slug,
        sellerType: s.sellerType,
        headline: s.headline,
        city: s.city,
        state: s.state,
        verificationStatus: s.verificationStatus,
        categoryId: builderCategory?.id ?? null,
        isAvailable: true,
        showContactToBuyers: true,
        contactPhone: s.phone,
        contactEmail: s.email,
      },
    });

    sellers.push(seller);
  }

  return sellers;
};

const sellerBySlug = (sellers: { slug: string; id: string }[]) =>
  new Map(sellers.map((s) => [s.slug, s.id]));

const clearSeedProperties = async (sellerIds: string[]) => {
  const { count } = await prisma.property.deleteMany({
    where: { sellerId: { in: sellerIds } },
  });
  if (count > 0) console.log(`Deleted ${count} previous seed properties`);
};

const seedProperties = async (sellers: { slug: string; id: string }[]) => {
  const idBySlug = sellerBySlug(sellers);

  for (let i = 0; i < PROPERTIES.length; i++) {
    const p = PROPERTIES[i];
    const idx = i + 1;
    const sellerId = idBySlug.get(p.seller ?? sellers[0].slug);

    const baseSlug = slugify(p.title, { lower: true, strict: true }) || "seed-property";
    const slug = `${baseSlug}-seed${idx}`;
    const baseCode = `${SEED_PROPERTY_CODE_PREFIX}${idx}`;

    await prisma.$transaction(async (tx) => {
      const property = await tx.property.create({
        data: {
          title: p.title,
          slug,
          propertyCode: `${baseCode}${Date.now()}`,
          sellerId,
          transactionType: p.transactionType,
          propertyType: p.propertyType,
          propertyStatus: p.propertyStatus ?? "AVAILABLE",
          description: p.description,
          addressLine: p.addressLine,
          city: p.city,
          state: p.state,
          country: p.country ?? "India",
          pincode: p.pincode,
          latitude: p.latitude,
          longitude: p.longitude,
          ownershipType: p.ownershipType,
          listedBy: p.listedBy ?? "AGENT",
          ageOfProperty: p.ageOfProperty ?? null,
          amenities: p.amenities,
          nearbyPlaces: p.nearbyPlaces ?? [],
          societyInfo: {},
          images: [
            { url: `/uploads/seed/property-${idx}.jpg`, isFeatured: true },
            { url: `/uploads/seed/property-${idx}-2.jpg` },
            { url: `/uploads/seed/property-${idx}-3.jpg` },
          ],
          reraNumber: p.reraNumber ?? null,
          contactName: "Ambr Homes Support",
          contactPhone: "+91-98100-00000",
          contactEmail: "support@ambrhomes.com",
          isFeatured: p.isFeatured ?? false,
          isActive: true,
          isVerified: true,
          viewsCount: p.viewsCount ?? 100,
          likesCount: p.likesCount ?? 5,
          averageRating: Math.round((4 + Math.random()) * 10) / 10,
          ratingCount: Math.floor(1 + Math.random() * 20),
          metaTitle: p.title,
          metaDescription: p.description.slice(0, 160),
          metaKeywords: `${p.city}, ${p.propertyType.toLowerCase()}, real estate`,
        },
        select: { id: true },
      });

      const variants = p.variants.map((v) => ({
        propertyId: property.id,
        variantName: v.variantName,
        variantCode: `${baseCode}-${v.variantName.replace(/[^A-Za-z0-9]/g, "").toLowerCase()}-${idx}`,
        bedrooms: v.bedrooms,
        bathrooms: v.bathrooms,
        balconies: v.balconies,
        price: v.price,
        mrpPrice: v.mrpPrice ?? null,
        pricePerSqft: Math.round((v.price / v.totalArea) * 100) / 100,
        totalArea: v.totalArea,
        totalAreaUnit: "sqft",
        carpetArea: v.carpetArea,
        carpetAreaUnit: "sqft",
        floorNumber: v.floorNumber ?? null,
        totalFloors: v.totalFloors ?? null,
        availabilityStatus:
          v.availabilityStatus as "READY_TO_MOVE" | "UNDER_CONSTRUCTION" | "NEW_LAUNCH",
        possessionDate: v.possessionDate ?? null,
        isAvailable: true,
        inventoryCount: v.inventoryCount ?? 1,
        furnishingStatus:
          v.furnishingStatus as "FURNISHED" | "SEMI_FURNISHED" | "UNFURNISHED",
        furnishingItems: [],
        images: [
          { url: `/uploads/seed/property-${idx}.jpg`, isFeatured: true },
          { url: `/uploads/seed/property-${idx}-2.jpg` },
        ],
        isActive: true,
        displayOrder: 0,
      }));

      await tx.propertyVariant.createMany({ data: variants });
    });

    console.log(`Seeded property ${idx}/${PROPERTIES.length}: ${p.title}`);
  }
};

// ============================================================
// MAIN
// ============================================================

const main = async () => {
  const sellers = await seedSellers();
  await clearSeedProperties(sellers.map((s) => s.id));
  await seedProperties(sellers);

  console.log("\n20 demo properties seeded successfully");
};

main()
  .catch((error) => {
    console.error("Property seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });