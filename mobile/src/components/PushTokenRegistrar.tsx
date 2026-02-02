import { useEffect } from 'react';
import { Platform } from 'react-native';
import { api } from '../services/api';
import { useIsAuthenticated } from '../utils/auth';
import { registerForPushNotificationsAsync } from '../utils/pushNotifications';

export default function PushTokenRegistrar() {
  const { isAuthenticated, user } = useIsAuthenticated();

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let active = true;

    registerForPushNotificationsAsync()
      .then((token) => {
        if (!active || !token) return;
        return api.post('/api/notifications/push-token', {
          token,
          platform: Platform.OS,
        });
      })
      .catch(() => {
        // Ignore push registration failures; user can still use the app.
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.id]);

  return null;
}
