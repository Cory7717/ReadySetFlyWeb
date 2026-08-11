import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsAuthenticated, useLogout } from '../utils/auth';
import { api } from '../services/api';
import { ConfirmDeletionModal } from '../components/ConfirmDeletionModal';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const certificationTypes = ['PPL', 'IR', 'CPL', 'Multi-Engine', 'ATP', 'CFI', 'CFII', 'MEI'];

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  danger,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, danger && styles.menuRowDanger]}
      onPress={onPress}
      activeOpacity={0.92}
      data-testid={testID}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      <Text style={[styles.menuRowText, danger && styles.menuRowTextDanger]}>{label}</Text>
      <Ionicons name={danger ? 'open-outline' : 'chevron-forward'} size={18} color={danger ? colors.danger : colors.textSoft} />
    </TouchableOpacity>
  );
}

function CommandCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.commandCard} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.commandIconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.commandTitle}>{title}</Text>
      <Text style={styles.commandSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user, isLoading } = useIsAuthenticated();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [totalHours, setTotalHours] = useState('0');
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
      Alert.alert('Account Deleted', 'Your account and all associated data have been permanently deleted.', [
        {
          text: 'OK',
          onPress: () => logout.mutate(undefined),
        },
      ]);
    },
    onError: (error: any) => {
      setShowDeleteModal(false);
      Alert.alert('Error', error.response?.data?.error || 'Failed to delete account. Please try again.');
    },
  });

  const handleOpenPrivacyPolicy = () => Linking.openURL('https://readysetfly.us/privacy-policy');
  const handleOpenTermsOfService = () => Linking.openURL('https://readysetfly.us/terms-of-service');
  const handleOpenVerification = () => Linking.openURL('https://readysetfly.us/verify-identity');

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
            if (aircraft?.id) nextMap[aircraft.id] = aircraft;
          });
          if (isMounted) setAircraftMap(nextMap);
        } else if (isMounted) {
          setAircraftMap({});
        }
      } catch {
        if (!isMounted) return;
        setOwnerRentals([]);
        setRenterRentals([]);
        setReviews([]);
        setAircraftMap({});
      } finally {
        if (isMounted) setIsLoadingActivity(false);
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

  const totalRentalCount = ownerRentals.length + renterRentals.length;
  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1)
      : '—';
  const membershipLabel = (user as any)?.entitlements?.tier === 'premium'
    ? 'RSF Premium'
    : 'Free';

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, spacing.sm), paddingBottom: 120 + insets.bottom },
        ]}
      >
        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View style={styles.guestAvatar}>
              <Ionicons name="person-outline" size={38} color="#93c5fd" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>PROFILE</Text>
              <Text style={styles.heroTitle}>Sign in to unlock your pilot workspace.</Text>
              <Text style={styles.heroSubtitle}>
                Keep planning, rentals, activity, verification, and member tools tied to one RSF account.
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <SummaryTile label="Workspace" value="Guest" />
            <SummaryTile label="Profile sync" value="Locked" />
            <SummaryTile label="Membership" value="Available" />
          </View>

          <TouchableOpacity style={styles.heroPrimaryAction} onPress={handleLogin} activeOpacity={0.92} data-testid="button-sign-in">
            <Ionicons name="log-in-outline" size={18} color="#fff" />
            <Text style={styles.heroPrimaryActionText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <SectionCard
          title="What unlocks after sign in"
          subtitle="One account keeps your pilot data and workflows connected across web and mobile."
        >
          <View style={styles.commandGrid}>
            <CommandCard
              icon="airplane-outline"
              title="Plan & file"
              subtitle="Keep routes, filing, and saved plans under one account."
              onPress={handleLogin}
            />
            <CommandCard
              icon="book-outline"
              title="Log & track"
              subtitle="Bring logbook, member tools, and activity into one workspace."
              onPress={handleLogin}
            />
          </View>

          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>Save rentals, listings, and profile details in one workspace.</Text>
            <Text style={styles.bulletItem}>Track verification, activity history, and account preferences.</Text>
            <Text style={styles.bulletItem}>Use member features like logbook, billing, and connected planning tools.</Text>
          </View>
        </SectionCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, spacing.sm), paddingBottom: 120 + insets.bottom },
      ]}
    >
      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View style={styles.avatarWrap}>
            {user?.profileImageUrl ? (
              <Image source={{ uri: user.profileImageUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={34} color="#93c5fd" />
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>PROFILE</Text>
            <Text style={styles.heroTitle}>
              {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'RSF Pilot' : 'RSF Pilot'}
            </Text>
            <Text style={styles.heroSubtitle}>{user?.email || 'Ready Set Fly account'}</Text>
          </View>

          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>
              {user?.identityVerified ? 'Verified' : 'Needs review'}
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryTile label="Hours" value={String(user?.totalFlightHours || 0)} />
          <SummaryTile label="Certs" value={String(user?.certifications?.length || 0)} />
          <SummaryTile label="Rentals" value={String(totalRentalCount)} />
        </View>

        <View style={styles.statusStrip}>
          <View style={styles.statusPill}>
            <Ionicons name="card-outline" size={14} color="#bfdbfe" />
            <Text style={styles.statusPillText}>{membershipLabel}</Text>
          </View>
          <View style={styles.statusPill}>
            <Ionicons name="star-outline" size={14} color="#bfdbfe" />
            <Text style={styles.statusPillText}>{reviews.length ? `${averageRating}/5 rating` : 'No reviews yet'}</Text>
          </View>
        </View>

        <View style={styles.verificationBadgeRow}>
          {verificationBadges.map((badge) => (
            <View key={badge.label} style={[styles.verificationBadge, badge.ok ? styles.verificationBadgeOk : styles.verificationBadgeMuted]}>
              <Text style={[styles.verificationBadgeText, badge.ok ? styles.verificationBadgeTextOk : styles.verificationBadgeTextMuted]}>
                {badge.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <SectionCard
        title="Mission Control"
        subtitle="The fastest path into your most-used account workflows."
      >
        <View style={styles.commandGrid}>
          <CommandCard
            icon="shield-checkmark-outline"
            title="Verification"
            subtitle="Review identity, FAA, and document status."
            onPress={() => navigation.navigate('Verification')}
          />
          <CommandCard
            icon="airplane-outline"
            title="My Rentals"
            subtitle="Manage active, pending, and completed bookings."
            onPress={() => navigation.navigate('MyRentals')}
          />
          <CommandCard
            icon="list-outline"
            title="My Listings"
            subtitle="Track live rental or marketplace inventory."
            onPress={() => navigation.navigate('MyListings')}
          />
          <CommandCard
            icon="card-outline"
            title="Membership"
            subtitle="View RSF Premium status, billing, and upgrades."
            onPress={() => navigation.navigate('LogbookPro')}
          />
        </View>
      </SectionCard>

      <SectionCard
        title="Pilot Identity"
        subtitle="Keep your identity, hours, and certification baseline current."
        action={
          <TouchableOpacity onPress={() => setIsEditing((prev) => !prev)} activeOpacity={0.92}>
            <Text style={styles.linkText}>{isEditing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        }
      >
        {isEditing ? (
          <View>
            <Text style={styles.inputLabel}>First Name</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="First name" />

            <Text style={styles.inputLabel}>Last Name</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Last name" />

            <Text style={styles.inputLabel}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="(555) 123-4567" />

            <Text style={styles.inputLabel}>Total Flight Hours</Text>
            <TextInput style={styles.input} value={totalHours} onChangeText={setTotalHours} placeholder="0" keyboardType="numeric" />

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
                    activeOpacity={0.92}
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
              activeOpacity={0.92}
            >
              <Text style={styles.primaryButtonText}>
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.detailGrid}>
            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{user?.phone || 'Not set'}</Text>
            </View>
            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Hours</Text>
              <Text style={styles.detailValue}>{user?.totalFlightHours || 0}</Text>
            </View>
            <View style={styles.detailCardFull}>
              <Text style={styles.detailLabel}>Certifications</Text>
              <Text style={styles.detailValue}>{(user?.certifications || []).join(', ') || 'None yet'}</Text>
            </View>
          </View>
        )}
      </SectionCard>

      <SectionCard
        title="Verification & Documents"
        subtitle="This is the trust layer behind rentals, marketplace actions, and compliance workflows."
      >
        <View style={styles.detailGrid}>
          <View style={styles.detailCard}>
            <Text style={styles.detailLabel}>Pilot License</Text>
            <Text style={styles.detailValue}>{user?.pilotLicenseUrl ? 'On file' : 'Missing'}</Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailLabel}>Insurance</Text>
            <Text style={styles.detailValue}>{user?.insuranceUrl ? 'On file' : 'Missing'}</Text>
          </View>
          <View style={styles.detailCardFull}>
            <Text style={styles.detailLabel}>FAA Verification</Text>
            <Text style={styles.detailValue}>{user?.faaVerified ? 'Verified' : 'Pending'}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.outlineButton} onPress={handleOpenVerification} activeOpacity={0.92}>
          <Text style={styles.outlineButtonText}>Upload or Update Documents</Text>
        </TouchableOpacity>
      </SectionCard>

      <SectionCard
        title="Workspace Links"
        subtitle="Account, rentals, listings, reviews, and cash flow all from one hub."
      >
        <MenuRow icon="shield-checkmark-outline" label="Verification Status" onPress={() => navigation.navigate('Verification')} testID="button-verification-status" />
        <MenuRow icon="wallet-outline" label="Balance & Withdrawals" onPress={() => navigation.navigate('Balance')} testID="button-balance" />
        <MenuRow icon="airplane-outline" label="My Rentals" onPress={() => navigation.navigate('MyRentals')} testID="button-my-rentals" />
        <MenuRow icon="heart-outline" label="Favorites" onPress={() => navigation.navigate('Favorites')} testID="button-favorites" />
        <MenuRow icon="list-outline" label="My Listings" onPress={() => navigation.navigate('MyListings')} testID="button-my-listings" />
        <MenuRow icon="star-outline" label="Reviews" onPress={() => navigation.navigate('Reviews')} testID="button-reviews" />
      </SectionCard>

      <SectionCard
        title="Activity Snapshot"
        subtitle="A quick read on your rental history, pilot reputation, and recent movement."
      >
        {isLoadingActivity ? (
          <Text style={styles.placeholderText}>Loading activity...</Text>
        ) : (
          <>
            <View style={styles.summaryRowLight}>
              <SummaryTileLight label="Owner rentals" value={String(ownerRentals.length)} />
              <SummaryTileLight label="Renter rentals" value={String(renterRentals.length)} />
              <SummaryTileLight label="Reviews" value={String(reviews.length)} />
            </View>

            <View style={styles.activityHeadlineRow}>
              <View style={styles.activityHeadlineCard}>
                <Text style={styles.activityHeadlineLabel}>Average rating</Text>
                <Text style={styles.activityHeadlineValue}>{averageRating}</Text>
              </View>
              <View style={styles.activityHeadlineCard}>
                <Text style={styles.activityHeadlineLabel}>Current mode</Text>
                <Text style={styles.activityHeadlineValue}>
                  {ownerRentals.length > renterRentals.length ? 'Owner-led' : renterRentals.length > 0 ? 'Flying renter' : 'Building activity'}
                </Text>
              </View>
            </View>

            <View style={styles.miniSection}>
              <Text style={styles.miniSectionTitle}>Recent rental history</Text>
              {totalRentalCount === 0 ? (
                <Text style={styles.placeholderText}>No rentals yet.</Text>
              ) : (
                [...ownerRentals, ...renterRentals].slice(0, 4).map((rental: any) => {
                  const aircraft = rental.aircraftId ? aircraftMap[rental.aircraftId] : null;
                  return (
                    <View key={rental.id} style={styles.listRow}>
                      <View style={styles.listRowMain}>
                        <Text style={styles.listRowTitle}>
                          {aircraft ? `${aircraft.make} ${aircraft.model}` : rental.aircraftName || rental.aircraftId || 'Rental'}
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

            <View style={styles.miniSection}>
              <Text style={styles.miniSectionTitle}>Recent reviews</Text>
              {reviews.length === 0 ? (
                <Text style={styles.placeholderText}>No reviews yet.</Text>
              ) : (
                reviews.slice(0, 3).map((review: any) => (
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
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Settings & Support"
        subtitle="Notifications, billing, policies, and help surfaces that support the whole account."
      >
        <MenuRow icon="notifications-outline" label="Notifications" onPress={() => navigation.navigate('Notifications')} testID="button-notifications" />
        <MenuRow icon="help-circle-outline" label="Help & Support" onPress={() => navigation.navigate('HelpSupport')} testID="button-help" />
        <MenuRow icon="chatbox-ellipses-outline" label="FAQ" onPress={() => navigation.navigate('FAQ')} testID="button-faq" />
        <MenuRow icon="mail-outline" label="Contact Us" onPress={() => navigation.navigate('ContactUs')} testID="button-contact-us" />
        <MenuRow icon="card-outline" label="Membership & Billing" onPress={() => navigation.navigate('LogbookPro')} testID="button-manage-subscription" />
        <MenuRow icon="shield-outline" label="Privacy Policy" onPress={handleOpenPrivacyPolicy} testID="button-privacy-policy" />
        <MenuRow icon="document-text-outline" label="Terms of Service" onPress={handleOpenTermsOfService} testID="button-terms-of-service" />
      </SectionCard>

      <SectionCard
        title="Danger Zone"
        subtitle="Destructive account actions live here and should be used carefully."
      >
        <MenuRow
          icon="trash-outline"
          label={deleteAccountMutation.isPending ? 'Deleting...' : 'Delete Account'}
          onPress={() => setShowDeleteModal(true)}
          danger
          testID="button-delete-account"
        />
        <MenuRow
          icon="trash-bin-outline"
          label="Delete Account (web)"
          onPress={() => Linking.openURL('https://readysetfly.us/delete-account')}
          danger
          testID="button-delete-account-web"
        />
      </SectionCard>

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleLogout}
        disabled={logout.isPending}
        activeOpacity={0.92}
        data-testid="button-sign-out"
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.signOutButtonText}>{logout.isPending ? 'Signing out...' : 'Sign Out'}</Text>
      </TouchableOpacity>

      <ConfirmDeletionModal
        visible={showDeleteModal}
        onConfirm={() => deleteAccountMutation.mutate()}
        onCancel={() => setShowDeleteModal(false)}
        isLoading={deleteAccountMutation.isPending}
      />
    </ScrollView>
  );
}

function SummaryTileLight({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTileLight}>
      <Text style={styles.summaryTileLightLabel}>{label}</Text>
      <Text style={styles.summaryTileLightValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.sm,
    paddingBottom: 120,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  heroPanel: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.cockpit,
    ...shadow.floating,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  guestAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#93c5fd',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#fff',
    marginTop: 10,
    maxWidth: 300,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 330,
  },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statusStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dbeafe',
  },
  summaryTile: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#bfdbfe',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  summaryRowLight: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryTileLight: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTileLightLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.textSoft,
    textTransform: 'uppercase',
  },
  summaryTileLightValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  verificationBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  verificationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  verificationBadgeOk: {
    backgroundColor: 'rgba(34,197,94,0.18)',
  },
  verificationBadgeMuted: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  verificationBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  verificationBadgeTextOk: {
    color: '#bbf7d0',
  },
  verificationBadgeTextMuted: {
    color: '#dbe4f0',
  },
  heroPrimaryAction: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.lg,
    paddingVertical: 15,
    backgroundColor: colors.primary,
  },
  heroPrimaryActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  sectionContent: {
    marginTop: spacing.md,
  },
  commandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  commandCard: {
    width: '48%',
    minHeight: 124,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commandIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  commandTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.sm,
  },
  commandSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 6,
  },
  linkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
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
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    fontWeight: '800',
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailCard: {
    width: '48%',
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailCardFull: {
    width: '100%',
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.textSoft,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  outlineButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuRowDanger: {
    borderColor: '#fecaca',
    backgroundColor: '#fff6f6',
  },
  menuRowText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    marginLeft: spacing.sm,
    fontWeight: '700',
  },
  menuRowTextDanger: {
    color: colors.danger,
  },
  miniSection: {
    marginTop: spacing.md,
  },
  activityHeadlineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  activityHeadlineCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityHeadlineLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.textSoft,
    textTransform: 'uppercase',
  },
  activityHeadlineValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginTop: 6,
  },
  miniSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  placeholderText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  bulletList: {
    gap: spacing.sm,
  },
  bulletItem: {
    ...typography.body,
    color: colors.textMuted,
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
    fontWeight: '800',
    color: colors.text,
  },
  listRowMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  listRowAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#fecaca',
    ...shadow.card,
  },
  signOutButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.danger,
    marginLeft: spacing.sm,
  },
});
