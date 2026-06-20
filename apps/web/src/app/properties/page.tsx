import { fetchProperties } from "@/lib/api";
import { PropertyCard } from "@/components/PropertyCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Properties — Upsilon" };

export default async function PropertiesPage() {
  const properties = await fetchProperties();

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-zinc-100">Properties</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Tokenized real estate offerings · ERC-3643 security tokens
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map((p) => (
          <PropertyCard key={p.id} property={p} />
        ))}
      </div>
    </div>
  );
}
