import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, TrendingUp } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MarketplaceListing } from "@shared/schema";

interface UpgradeListingModalProps {
  listing: MarketplaceListing;
  isOpen: boolean;
  onClose: () => void;
}

const tiers = [
  { 
    id: 'basic', 
    label: 'Basic', 
    price: 25, 
    description: 'Essential features for smaller listings',
    features: ['30-day listing', 'Basic visibility', 'Up to 3 images'] 
  },
  { 
    id: 'standard', 
    label: 'Standard', 
    price: 100, 
    description: 'Enhanced features for better exposure',
    features: ['30-day listing', 'Enhanced visibility', 'Up to 5 images', 'Featured badge'] 
  },
  { 
    id: 'premium', 
    label: 'Premium', 
    price: 250, 
    description: 'Maximum visibility and features',
    features: ['30-day listing', 'Top placement', 'Up to 10 images', 'Featured badge', 'Priority support'] 
  },
];

export function UpgradeListingModal({ listing, isOpen, onClose }: UpgradeListingModalProps) {
  const [selectedTier, setSelectedTier] = useState<string>('');
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const currentTier = tiers.find(t => t.id === listing.tier);
  const currentTierIndex = tiers.findIndex(t => t.id === listing.tier);
  const availableTiers = tiers.filter((_, index) => index > currentTierIndex);

  const upgradeMutation = useMutation({
    mutationFn: async (newTier: string) => {
      return await apiRequest("POST", `/api/marketplace/${listing.id}/upgrade`, {
        newTier,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace", listing.id] });
      toast({
        title: "Success",
        description: "Your listing has been upgraded successfully!",
      });
      onClose();
      navigate("/my-listings");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upgrade listing",
        variant: "destructive",
      });
    },
  });

  const handleUpgrade = () => {
    if (!selectedTier) {
      toast({
        title: "Select a tier",
        description: "Please select a tier to upgrade to",
        variant: "destructive",
      });
      return;
    }
    upgradeMutation.mutate(selectedTier);
  };

  const selectedTierData = tiers.find(t => t.id === selectedTier);
  const upgradeCost = selectedTierData ? selectedTierData.price - (currentTier?.price || 25) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Upgrade Your Listing
          </DialogTitle>
          <DialogDescription>
            Boost your listing's visibility and features by upgrading to a higher tier
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Current Tier</h3>
            <Badge variant="secondary" className="text-sm">
              {currentTier?.label} - ${currentTier?.price}/month
            </Badge>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-4">Available Upgrades</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableTiers.map((tier) => {
                const cost = tier.price - (currentTier?.price || 25);
                const isSelected = selectedTier === tier.id;
                
                return (
                  <Card 
                    key={tier.id}
                    className={`cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-primary ring-2 ring-primary' 
                        : 'hover-elevate'
                    }`}
                    onClick={() => setSelectedTier(tier.id)}
                    data-testid={`tier-option-${tier.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{tier.label}</CardTitle>
                          <CardDescription className="text-sm mt-1">
                            ${tier.price}/month
                          </CardDescription>
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <CardDescription className="mt-2">
                        {tier.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {tier.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-600" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium text-muted-foreground">
                          Upgrade cost: <span className="text-foreground">${cost}</span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {availableTiers.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  You're already at the highest tier! 🎉
                </p>
              </CardContent>
            </Card>
          )}

          {selectedTier && (
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Upgrade Summary</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentTier?.label} → {selectedTierData?.label}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">${upgradeCost}</p>
                  <p className="text-xs text-muted-foreground">one-time upgrade fee</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={upgradeMutation.isPending}
              data-testid="button-cancel-upgrade"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpgrade}
              disabled={!selectedTier || upgradeMutation.isPending}
              data-testid="button-confirm-upgrade"
            >
              {upgradeMutation.isPending ? "Upgrading..." : "Upgrade Now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
