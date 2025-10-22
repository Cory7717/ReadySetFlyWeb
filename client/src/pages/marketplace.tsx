import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import type { MarketplaceListing } from "@shared/schema";
import { MarketplaceCard } from "@/components/marketplace-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const categories = [
  { id: "aircraft-sale", label: "Aircraft For Sale", fee: "$40-125/mo" },
  { id: "job", label: "Aviation Jobs", fee: "$25/mo" },
  { id: "cfi", label: "CFIs", fee: "$40/mo" },
  { id: "flight-school", label: "Flight Schools", fee: "$175/mo" },
  { id: "mechanic", label: "Mechanics", fee: "$40/mo" },
  { id: "charter", label: "Charter Services", fee: "$250/mo" },
];

export default function Marketplace() {
  const [selectedCategory, setSelectedCategory] = useState("aircraft-sale");
  const [, navigate] = useLocation();

  const { data: allListings = [], isLoading } = useQuery<MarketplaceListing[]>({
    queryKey: ["/api/marketplace"],
  });

  const categoryListings = allListings.filter(
    (listing) => listing.category === selectedCategory
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-muted py-12">
        <div className="container mx-auto px-4">
          <h1 className="font-display text-4xl font-bold mb-4" data-testid="text-marketplace-title">
            Aviation Marketplace
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Connect with the aviation community. Buy, sell, and find professional services.
          </p>
        </div>
      </section>

      {/* Category Navigation */}
      <section className="border-b bg-background sticky top-16 z-40">
        <div className="container mx-auto px-4">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 py-4">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.id)}
                  className="rounded-full shrink-0"
                  data-testid={`button-category-${category.id}`}
                >
                  {category.label}
                  <span className="ml-2 text-xs opacity-70">{category.fee}</span>
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </section>

      {/* Listings */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display text-2xl font-bold mb-1">
              {categories.find(c => c.id === selectedCategory)?.label}
            </h2>
            <p className="text-muted-foreground">
              <span data-testid="text-marketplace-count">{categoryListings.length}</span> active listings
            </p>
          </div>
          <Button 
            variant="default" 
            className="bg-accent text-accent-foreground hover:bg-accent" 
            onClick={() => navigate("/create-marketplace-listing")}
            data-testid="button-create-listing"
          >
            Create Listing
          </Button>
        </div>

        {/* Results Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : categoryListings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No listings in this category yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoryListings.map((listing) => (
              <MarketplaceCard
                key={listing.id}
                id={listing.id}
                category={listing.category}
                title={listing.title}
                description={listing.description}
                price={listing.price ? `$${parseFloat(listing.price).toLocaleString()}` : ""}
                location={listing.location || "N/A"}
                image={listing.images?.[0]}
                images={listing.images?.length || 0}
                tier={listing.tier || undefined}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
