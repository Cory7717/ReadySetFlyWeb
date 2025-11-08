import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface FavoriteButtonProps {
  listingId: string;
  listingType: "marketplace" | "aircraft";
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function FavoriteButton({ 
  listingId, 
  listingType, 
  variant = "ghost", 
  size = "icon",
  className = "" 
}: FavoriteButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFavorited, setIsFavorited] = useState(false);

  // Check if listing is favorited
  const { data: favoriteStatus } = useQuery<{ isFavorited: boolean }>({
    queryKey: ["/api/favorites/check", listingType, listingId],
    queryFn: async () => {
      const response = await fetch(`/api/favorites/check/${listingType}/${listingId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to check favorite status");
      return response.json();
    },
    enabled: !!user,
  });

  // Update local state when query data changes
  useEffect(() => {
    if (favoriteStatus) {
      setIsFavorited(favoriteStatus.isFavorited);
    }
  }, [favoriteStatus]);

  // Add favorite mutation
  const addFavoriteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/favorites", {
        listingType,
        listingId,
      });
    },
    onSuccess: () => {
      setIsFavorited(true);
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites/check", listingType, listingId] });
      toast({
        title: "Added to favorites",
        description: "You can view your saved listings in the Favorites page",
      });
    },
    onError: () => {
      toast({
        title: "Failed to add favorite",
        description: "Please try again later",
        variant: "destructive",
      });
    },
  });

  // Remove favorite mutation
  const removeFavoriteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/favorites/${listingType}/${listingId}`, {});
    },
    onSuccess: () => {
      setIsFavorited(false);
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites/check", listingType, listingId] });
      toast({
        title: "Removed from favorites",
      });
    },
    onError: () => {
      toast({
        title: "Failed to remove favorite",
        description: "Please try again later",
        variant: "destructive",
      });
    },
  });

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from bubbling up (e.g., card click)
    
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save favorites",
      });
      return;
    }

    if (isFavorited) {
      removeFavoriteMutation.mutate();
    } else {
      addFavoriteMutation.mutate();
    }
  };

  if (!user) {
    return null; // Don't show favorite button for unauthenticated users
  }

  const isPending = addFavoriteMutation.isPending || removeFavoriteMutation.isPending;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggleFavorite}
      disabled={isPending}
      className={className}
      data-testid={`button-favorite-${listingType}-${listingId}`}
    >
      <Heart
        className={`h-5 w-5 ${isFavorited ? "fill-red-500 text-red-500" : ""}`}
      />
    </Button>
  );
}
