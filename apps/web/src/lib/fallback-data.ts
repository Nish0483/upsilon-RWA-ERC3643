import type { PlatformStats, Property } from "./api";

// Bundled snapshot of the catalog so the site still renders when the API is
// unreachable (e.g. on Vercel where the Express API isn't deployed).
export const fallbackProperties: Property[] = [
  {
    id: "prop-001",
    slug: "koramangala-skyrise",
    name: "Koramangala Skyrise",
    location: "Koramangala, Bangalore",
    type: "residential",
    totalValue: 85_000_000,
    tokenSymbol: "KORA",
    tokenPrice: 10,
    totalSupply: 1_000_000,
    availableTokens: 750_000,
    expectedYield: 7.2,
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80",
    description:
      "Premium 120-unit apartment tower near Forum Mall and Sony World Signal. Fully leased with institutional property management and quarterly dividend distributions.",
    features: ["120 units", "96% occupancy", "Class A", "Quarterly dividends"],
    status: "active",
  },
  {
    id: "prop-002",
    slug: "ub-city-tower",
    name: "UB City Tower",
    location: "Vittal Mallya Road, Bangalore",
    type: "commercial",
    totalValue: 210_000_000,
    tokenSymbol: "UBCT",
    tokenPrice: 25,
    totalSupply: 980_000,
    availableTokens: 420_000,
    expectedYield: 8.1,
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80",
    description:
      "Grade-A office space in Bangalore's CBD with blue-chip tenant roster. Long weighted average lease term with built-in rent escalations.",
    features: ["28 floors", "LEED Gold", "Anchor tenants", "CBD location"],
    status: "active",
  },
  {
    id: "prop-003",
    slug: "whitefield-tech-park",
    name: "Whitefield Tech Park",
    location: "Whitefield, Bangalore",
    type: "commercial",
    totalValue: 58_000_000,
    tokenSymbol: "WHTF",
    tokenPrice: 5,
    totalSupply: 1_360_000,
    availableTokens: 0,
    expectedYield: 6.8,
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
    description:
      "IT park campus near ITPL and Phoenix Marketcity. Multi-tenant office blocks with stable tech-sector occupancy and professional facilities management.",
    features: ["6 blocks", "Fully funded", "6.8% yield", "IT corridor"],
    status: "funded",
  },
  {
    id: "prop-004",
    slug: "manyata-embassy-hub",
    name: "Manyata Embassy Hub",
    location: "Hebbal, Bangalore",
    type: "commercial",
    totalValue: 155_000_000,
    tokenSymbol: "MNTH",
    tokenPrice: 20,
    totalSupply: 910_000,
    availableTokens: 910_000,
    expectedYield: 9.0,
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80",
    description:
      "Large-format logistics and office campus near Outer Ring Road and Nagawara. Triple-net lease with investment-grade operator.",
    features: ["380K sqft", "NNN lease", "Investment grade", "9.0% cap rate"],
    status: "pending",
  },
];

export const fallbackStats: PlatformStats = {
  totalProperties: fallbackProperties.length,
  totalValue: fallbackProperties.reduce((sum, p) => sum + p.totalValue, 0),
  activeOfferings: fallbackProperties.filter((p) => p.status === "active").length,
  totalInvestors: 1247,
  avgYield: 7.8,
};
