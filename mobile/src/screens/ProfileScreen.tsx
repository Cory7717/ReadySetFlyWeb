import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsAuthenticated, useLogin, useLogout } from '../utils/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { ConfirmDeletionModal } from '../components/ConfirmDeletionModal';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';
const certificationTypes = ['PPL', 'IR', 'CPL', 'Multi-Engine', 'ATP', 'CFI', 'CFII', 'MEI'];

export default function ProfileScreen({ navigation }: any) {
  const { isAuthenticated, user, isLoading } = useIsAuthenticated();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [totalHours, setTotalHours] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [ownerRentals, setOwnerRentals] = useState<any[]>([]);
  const [renterRentals, setRenterRentals] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [aircraftMap, setAircraftMap] = useState<Record<string, any>>({});

  const handleLogin = () => {
    navigation.navigate('Auth');
  };

  const handleLogout = async () => {
    try {
      await logout.mutateAsync(undefined);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete('/api/auth/user');
      return response.data;
    },
    onSuccess: () => {
      setShowDeleteModal(false);
      Alert.alert(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted.',
        [
          {
            text: 'OK',
            onPress: () => logout.mutate(undefined),
          },
        ]
      );
    },
    onError: (error: any) => {
      setShowDeleteModal(false);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to delete account. Please try again.'
      );
    },
  });

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    deleteAccountMutation.mutate();
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

  const handleOpenPrivacyPolicy = () => {
    Linking.openURL('https://readysetfly.us/privacy-policy');
  };

  const handleOpenTermsOfService = () => {
    Linking.openURL('https://readysetfly.us/terms-of-service');
  };

  const handleOpenVerification = () => {
    Linking.openURL('https://readysetfly.us/verify-identity');
  };

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setPhone(user.phone || '');
    setTotalHours(user.totalFlightHours ? String(user.totalFlightHours) : '0');
    setCertifications(user.certifications || []);
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    let isMounted = true;
    const fetchActivity = async () => {
      try {
        setIsLoadingActivity(true);
        const [ownerRes, renterRes, reviewsRes] = await Promise.all([
          api.get(`/api/rentals/owner/${user.id}`),
          api.get(`/api/rentals/renter/${user.id}`),
          api.get(`/api/reviews/user/${user.id}`),
        ]);
        if (!isMounted) return;
        const ownerData = Array.isArray(ownerRes.data) ? ownerRes.data : [];
        const renterData = Array.isArray(renterRes.data) ? renterRes.data : [];
        setOwnerRentals(ownerData);
        setRenterRentals(renterData);
        setReviews(Array.isArray(reviewsRes.data) ? reviewsRes.data : []);

        const aircraftIds = Array.from(
          new Set([...ownerData, ...renterData].map((rental) => rental.aircraftId).filter(Boolean))
        );
        if (aircraftIds.length > 0) {
          const aircraftResponses = await Promise.all(
            aircraftIds.map((id) => api.get(`/api/aircraft/${id}`).then((res) => res.data).catch(() => null))
          );
          const nextMap: Record<string, any> = {};
          aircraftResponses.forEach((aircraft) => {
            if (aircraft?.id) {
              nextMap[aircraft.id] = aircraft;
            }
          });
          if (isMounted) setAircraftMap(nextMap);
        } else if (isMounted) {
          setAircraftMap({});
        }
      } catch (error) {
        if (!isMounted) return;
        setOwnerRentals([]);
        setRenterRentals([]);
        setReviews([]);
        setAircraftMap({});
      } finally {
        if (isMounted) {
          setIsLoadingActivity(false);
        }
      }
    };
    fetchActivity();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.id]);

  const verificationBadges = useMemo(() => {
    if (!user) return [] as { label: string; ok: boolean }[];
    return [
      { label: 'Identity', ok: !!user.identityVerified },
      { label: 'FAA Cert', ok: !!user.faaVerified },
      { label: 'License', ok: !!user.pilotLicenseUrl },
      { label: 'Insurance', ok: !!user.insuranceUrl },
      { label: 'Email', ok: !!user.emailVerified },
    ];
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Missing user');
      const updates = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
        totalFlightHours: Number(totalHours || '0'),
        certifications,
      };
      const response = await api.patch(`/api/users/${user.id}`, updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mobile/auth/me'] });
      Alert.alert('Profile updated', 'Your profile details were saved.');
      setIsEditing(false);
    },
    onError: (error: any) => {
      Alert.alert('Update failed', error?.response?.data?.error || 'Unable to update profile.');
    },
  });

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user?.profileImageUrl ? (
            <Image source={{ uri: user.profileImageUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons 
              name={isAuthenticated ? 'person' : 'person-outline'} 
              size={48} 
              color="#1e40af" 
            />
          )}
        </View>
        <Text style={styles.userName}>
          {isAuthenticated && user ? `${user.firstName} ${user.lastName}` : 'Guest User'}
        </Text>
        <Text style={styles.userEmail}>
          {isAuthenticated && user ? user.email : 'Sign in to view your profile'}
        </Text>
        {isAuthenticated && (
          <View style={styles.badgeRow}>
            {verificationBadges.map((badge) => (
              <View
                key={badge.label}
                style={[styles.badge, badge.ok ? styles.badgeOk : styles.badgeMuted]}
              >
                <Text style={[styles.badgeText, badge.ok ? styles.badgeTextOk : styles.badgeTextMuted]}>
                  {badge.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {isAuthenticated && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile Overview</Text>
            <View style={styles.overviewRow}>
              <View style={styles.overviewCard}>
                <Text style={styles.overviewLabel}>Total Hours</Text>
                <Text style={styles.overviewValue}>{user?.totalFlightHours || 0}</Text>
              </View>
              <View style={styles.overviewCard}>
                <Text style={styles.overviewLabel}>Certifications</Text>
                <Text style={styles.overviewValue}>{user?.certifications?.length || 0}</Text>
              </View>
              <View style={styles.overviewCard}>
                <Text style={styles.overviewLabel}>Status</Text>
                <Text style={[styles.overviewValue, user?.identityVerified ? styles.textSuccess : styles.textWarning]}>
                  {user?.identityVerified ? 'Verified' : 'Unverified'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Profile Details</Text>
              <TouchableOpacity onPress={() => setIsEditing((prev) => !prev)}>
                <Text style={styles.linkText}>{isEditing ? 'Cancel' : 'Edit'}</Text>
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <View style={styles.card}>
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                />
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                />
                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(555) 123-4567"
                />
                <Text style={styles.inputLabel}>Total Flight Hours</Text>
                <TextInput
                  style={styles.input}
                  value={totalHours}
                  onChangeText={setTotalHours}
                  placeholder="0"
                  keyboardType="numeric"
                />
                <Text style={styles.inputLabel}>Certifications</Text>
                <View style={styles.certGrid}>
                  {certificationTypes.map((cert) => {
                    const selected = certifications.includes(cert);
                    return (
                      <TouchableOpacity
                        key={cert}
                        style={[styles.certChip, selected && styles.certChipActive]}
                        onPress={() => {
                          setCertifications((prev) =>
                            prev.includes(cert) ? prev.filter((item) => item !== cert) : [...prev, cert]
                          );
                        }}
                      >
                        <Text style={[styles.certChipText, selected && styles.certChipTextActive]}>{cert}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => updateProfileMutation.mutate()}
                  disabled={updateProfileMutation.isPending}
                >
                  <Text style={styles.primaryButtonText}>
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.detailText}>Phone: {user?.phone || 'Not set'}</Text>
                <Text style={styles.detailText}>Hours: {user?.totalFlightHours || 0}</Text>
                <Text style={styles.detailText}>Certs: {(user?.certifications || []).join(', ') || 'None yet'}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verification & Documents</Text>
            <View style={styles.card}>
              <View style={styles.docRow}>
                <Text style={styles.docLabel}>Pilot License</Text>
                <Text style={styles.docValue}>{user?.pilotLicenseUrl ? 'On file' : 'Missing'}</Text>
              </View>
              <View style={styles.docRow}>
                <Text style={styles.docLabel}>Insurance</Text>
                <Text style={styles.docValue}>{user?.insuranceUrl ? 'On file' : 'Missing'}</Text>
              </View>
              <View style={styles.docRow}>
                <Text style={styles.docLabel}>FAA Verification</Text>
                <Text style={styles.docValue}>{user?.faaVerified ? 'Verified' : 'Pending'}</Text>
              </View>
              <TouchableOpacity style={styles.outlineButton} onPress={handleOpenVerification}>
                <Text style={styles.outlineButtonText}>Upload/Update Documents</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('Verification')}
              data-testid="button-verification-status"
            >
              <Ionicons name="shield-checkmark-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Verification Status</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('Balance')}
              data-testid="button-balance"
            >
              <Ionicons name="wallet-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Balance & Withdrawals</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Activity</Text>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('MyRentals')}
              data-testid="button-my-rentals"
            >
              <Ionicons name="airplane-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>My Rentals</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('Favorites')}
              data-testid="button-favorites"
            >
              <Ionicons name="heart-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Favorites</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('MyListings')}
              data-testid="button-my-listings"
            >
              <Ionicons name="list-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>My Listings</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Reviews')}
              data-testid="button-reviews"
            >
              <Ionicons name="star-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Reviews</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aircraft Types Flown</Text>
            <View style={styles.card}>
              {(user?.aircraftTypesFlown || []).length > 0 ? (
                <View style={styles.certGrid}>
                  {user?.aircraftTypesFlown?.map((type: string) => (
                    <View key={type} style={styles.certChip}>
                      <Text style={styles.certChipText}>{type}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.detailText}>No aircraft types added yet.</Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rental History</Text>
            <View style={styles.card}>
              {isLoadingActivity ? (
                <Text style={styles.detailText}>Loading rentals...</Text>
              ) : ownerRentals.length + renterRentals.length === 0 ? (
                <Text style={styles.detailText}>No rentals yet.</Text>
              ) : (
                [...ownerRentals, ...renterRentals].slice(0, 5).map((rental: any) => {
                  const aircraft = rental.aircraftId ? aircraftMap[rental.aircraftId] : null;
                  return (
                    <View key={rental.id} style={styles.listRow}>
                      <View style={styles.listRowMain}>
                        <Text style={styles.listRowTitle}>
                          {aircraft ? `${aircraft.make} ${aircraft.model}` : (rental.aircraftName || rental.aircraftId || 'Rental')}
                        </Text>
                        <Text style={styles.listRowMeta}>
                          {aircraft?.category ? `${aircraft.category} · ` : ''}
                          {rental.startDate ? String(rental.startDate).slice(0, 10) : 'Date'} · {rental.status || 'pending'}
                        </Text>
                      </View>
                      <Text style={styles.listRowAmount}>${rental.totalCost || rental.hourlyRate || '-'}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <View style={styles.card}>
              {isLoadingActivity ? (
                <Text style={styles.detailText}>Loading reviews...</Text>
              ) : reviews.length === 0 ? (
                <Text style={styles.detailText}>No reviews yet.</Text>
              ) : (
                reviews.slice(0, 4).map((review: any) => (
                  <View key={review.id} style={styles.listRow}>
                    <View style={styles.listRowMain}>
                      <Text style={styles.listRowTitle}>{review.reviewerName || 'Pilot'}</Text>
                      <Text style={styles.listRowMeta}>{review.comment || 'No comment'}</Text>
                    </View>
                    <Text style={styles.listRowAmount}>{review.rating ? `${review.rating}/5` : '-'}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Notifications')}
              data-testid="button-notifications"
            >
              <Ionicons name="notifications-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Notifications</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('HelpSupport')}
              data-testid="button-help"
            >
              <Ionicons name="help-circle-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Help & Support</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('FAQ')}
              data-testid="button-faq"
            >
              <Ionicons name="chatbox-ellipses-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>FAQ</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('ContactUs')}
              data-testid="button-contact-us"
            >
              <Ionicons name="mail-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Contact Us</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('LogbookPro')}
              data-testid="button-manage-subscription"
            >
              <Ionicons name="card-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Membership & Billing</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleOpenPrivacyPolicy}
              data-testid="button-privacy-policy"
            >
              <Ionicons name="shield-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleOpenTermsOfService}
              data-testid="button-terms-of-service"
            >
              <Ionicons name="document-text-outline" size={24} color="#1e40af" />
              <Text style={styles.menuText}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            
            <TouchableOpacity 
              style={styles.deleteAccountButton}
              onPress={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending}
              data-testid="button-delete-account"
            >
              <Ionicons name="trash-outline" size={24} color="#ef4444" />
              <Text style={styles.deleteAccountText}>
                {deleteAccountMutation.isPending ? 'Deleting...' : 'Delete Account'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#ef4444" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { borderColor: '#fecaca' }]}
              onPress={() => Linking.openURL('https://readysetfly.us/delete-account')}
              data-testid="button-delete-account-web"
            >
              <Ionicons name="trash-bin-outline" size={24} color="#ef4444" />
              <Text style={[styles.menuText, { color: '#ef4444' }]}>Delete Account (web)</Text>
              <Ionicons name="open-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.signOutButton}
            onPress={handleLogout}
            disabled={logout.isPending}
            data-testid="button-sign-out"
          >
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.signOutButtonText}>
              {logout.isPending ? 'Signing out...' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {!isAuthenticated && (
        <View style={styles.signInContainer}>
          <Ionicons name="lock-closed-outline" size={64} color="#9ca3af" />
          <Text style={styles.signInPrompt}>Sign in to access your profile</Text>
          <TouchableOpacity 
            style={styles.signInButton}
            onPress={handleLogin}
            data-testid="button-sign-in"
          >
            <Ionicons name="log-in-outline" size={20} color="#fff" />
            <Text style={styles.signInButtonText}>
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Account Deletion Confirmation Modal */}
      <ConfirmDeletionModal
        visible={showDeleteModal}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isLoading={deleteAccountMutation.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  header: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginRight: spacing.xs,
    marginTop: spacing.xs,
  },
  badgeOk: {
    backgroundColor: '#dcfce7',
  },
  badgeMuted: {
    backgroundColor: '#e2e8f0',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextOk: {
    color: '#166534',
  },
  badgeTextMuted: {
    color: colors.textMuted,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overviewLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  textSuccess: {
    color: colors.success,
  },
  textWarning: {
    color: colors.warning,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
  },
  certGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  certChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  certChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  certChipText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  certChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  detailText: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 6,
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  docLabel: {
    fontSize: 13,
    color: colors.text,
  },
  docValue: {
    fontSize: 13,
    color: colors.textMuted,
  },
  outlineButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  linkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listRowMain: {
    flex: 1,
    marginRight: spacing.sm,
  },
  listRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  listRowMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  listRowAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  signInContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  signInPrompt: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginVertical: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  signOutButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.danger,
    marginLeft: spacing.sm,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteAccountText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.danger,
    marginLeft: spacing.sm,
  },
});
