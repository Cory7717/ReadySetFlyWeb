import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { apiEndpoints } from '../services/api';

export function PromoBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));

  // Fetch active promo alerts with auto-refresh every 30 seconds
  const { data: promoAlerts } = useQuery({
    queryKey: ['/api/promo-alerts'],
    queryFn: async () => {
      const response = await apiEndpoints.promoAlerts.getActive();
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds to get new promos from admin
  });

  // Get the first active alert
  const activeAlert = promoAlerts && promoAlerts.length > 0 ? promoAlerts[0] : null;

  useEffect(() => {
    // Reset dismissed state when alert changes
    if (activeAlert) {
      setDismissed(false);
      fadeAnim.setValue(1);
    }
  }, [activeAlert?.id]);

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setDismissed(true);
    });
  };

  if (!activeAlert || dismissed) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.banner}>
        <View style={styles.iconContainer}>
          <Ionicons name="megaphone" size={24} color="#fff" />
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title}>{activeAlert.title}</Text>
          <Text style={styles.message}>{activeAlert.message}</Text>
          {activeAlert.promoCode && (
            <View style={styles.promoCodeContainer}>
              <Text style={styles.promoCodeLabel}>Use code:</Text>
              <View style={styles.promoCodeBadge}>
                <Text style={styles.promoCode}>{activeAlert.promoCode}</Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity 
          onPress={handleDismiss}
          style={styles.dismissButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          data-testid="button-dismiss-promo"
        >
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  banner: {
    backgroundColor: '#1e40af',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#dbeafe',
    lineHeight: 20,
  },
  promoCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  promoCodeLabel: {
    fontSize: 13,
    color: '#dbeafe',
    marginRight: 8,
  },
  promoCodeBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  promoCode: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
    letterSpacing: 1,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
});
