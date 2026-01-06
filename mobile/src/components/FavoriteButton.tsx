import { useState, useEffect } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tantml:react-query';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';

interface FavoriteButtonProps {
  listingType: 'aircraft' | 'marketplace';
  listingId: string;
  size?: number;
  onToggle?: (isFavorited: boolean) => void;
}

export function FavoriteButton({ 
  listingType, 
  listingId, 
  size = 24,
  onToggle 
}: FavoriteButtonProps) {
  const { isAuthenticated } = useIsAuthenticated();
  const [isFavorited, setIsFavorited] = useState(false);
  const queryClient = useQueryClient();

  // Check if item is favorited
  const { data: favoriteStatus } = useQuery({
    queryKey: ['/api/favorites/check', listingType, listingId],
    queryFn: async () => {
      const response = await api.get(`/api/favorites/check/${listingType}/${listingId}`);
      return response.data;
    },
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (favoriteStatus) {
      setIsFavorited(favoriteStatus.isFavorited);
    }
  }, [favoriteStatus]);

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/favorites', {
        listingType,
        listingId,
      });
      return response.data;
    },
    onSuccess: (data) => {
      const newStatus = data.action === 'added';
      setIsFavorited(newStatus);
      queryClient.invalidateQueries({ queryKey: ['/api/favorites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/favorites/check', listingType, listingId] });
      onToggle?.(newStatus);
    },
  });

  if (!isAuthenticated) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={() => toggleFavoriteMutation.mutate()}
      disabled={toggleFavoriteMutation.isPending}
      style={styles.button}
    >
      <Ionicons
        name={isFavorited ? 'heart' : 'heart-outline'}
        size={size}
        color={isFavorited ? '#ef4444' : '#6b7280'}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
  },
});
