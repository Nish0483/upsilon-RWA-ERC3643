import { fetchProperty } from "@/lib/api";
import { PropertyDetail } from "@/components/PropertyDetail";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const property = await fetchProperty(slug);
    return { title: `${property.name} — Upsilon` };
  } catch {
    return { title: "Property — Upsilon" };
  }
}

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const property = await fetchProperty(slug);
    return <PropertyDetail property={property} />;
  } catch {
    notFound();
  }
}
