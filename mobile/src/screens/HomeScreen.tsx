import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, Image } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsAuthenticated } from '../utils/auth';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

const ACTIVE_FLIGHT_KEY = 'rsf_active_flight_v1';
const ACTIVE_FLIGHT_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

const WINGTIP_IMAGE = require('../../assets/wingtip.jpg');
const LOGO_IMAGE = require('../../assets/logo.png');

type ShortcutCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
};

function ShortcutCard({ icon, title, subtitle, accent, onPress }: ShortcutCardProps) {
  return (
    <TouchableOpacity style={styles.shortcutCard} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.shortcutIconWrap, { backgroundColor: accent }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <Text style={styles.shortcutTitle}>{title}</Text>
      <Text style={styles.shortcutSubtitle}>{subtitle}</Text>
      <View style={styles.shortcutFooter}>
        <Text style={styles.shortcutAction}>Open</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

type RailCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function RailCard({ icon, title, subtitle, onPress }: RailCardProps) {
  return (
    <TouchableOpacity style={styles.railCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.railIconWrap}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.railText}>
        <Text style={styles.railTitle}>{title}</Text>
        <Text style={styles.railSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
    </TouchableOpacity>
  );
}

type ActiveFlight = {
  departure: string | null;
  destination: string | null;
  waypoints: string | null;
  plannedAltitude: string | null;
  cruiseKtas: string | null;
  savedAt: number;
};

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user, isLoading } = useIsAuthenticated();
  const entitlements = (user as any)?.entitlements;
  const membershipTier = entitlements?.tier || 'free';
  const membershipLabel =
    membershipTier === 'pro_plus' ? 'Pro+' : membershipTier === 'pro' ? 'Pro' : 'Free';

  const [activeFlight, setActiveFlight] = useState<ActiveFlight | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_FLIGHT_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as ActiveFlight;
          const age = Date.now() - (parsed.savedAt || 0);
          if (age < ACTIVE_FLIGHT_MAX_AGE_MS) {
            setActiveFlight(parsed);
          } else {
            AsyncStorage.removeItem(ACTIVE_FLIGHT_KEY).catch(() => undefined);
          }
        } catch {
          // ignore malformed
        }
      })
      .catch(() => undefined);
  }, []);

  const resumeActiveFlight = () => {
    if (!activeFlight) return;
    navigation.navigate('Profile', {
      screen: 'FlightDeck',
      params: {
        departure: activeFlight.departure ?? undefined,
        destination: activeFlight.destination ?? undefined,
        waypoints: activeFlight.waypoints ?? undefined,
        plannedAltitude: activeFlight.plannedAltitude ?? undefined,
        cruiseKtas: activeFlight.cruiseKtas ?? undefined,
        mode: 'flight',
      },
    });
  };

  const dismissActiveFlight = () => {
    setActiveFlight(null);
    AsyncStorage.removeItem(ACTIVE_FLIGHT_KEY).catch(() => undefined);
  };

  const handleLogin = () => {
    navigation.navigate('Profile', { screen: 'Auth' });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
    >
      <ImageBackground source={WINGTIP_IMAGE} style={styles.hero} imageStyle={styles.heroImage}>
        <View style={[styles.heroOverlay, { paddingTop: Math.max(52, insets.top + 20) }]}>
          <View style={styles.heroTopRow}>
            <View style={styles.brandRow}>
              <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
              <View>
                <Text style={styles.brandEyebrow}>READY SET FLY</Text>
                <Text style={styles.brandTitle}>Plan on the web. Fly in the app.</Text>
              </View>
            </View>
            <View style={styles.membershipPill}>
              <Text style={styles.membershipPillText}>{membershipLabel}</Text>
            </View>
          </View>

          <Text style={styles.heroHeadline}>
            {isAuthenticated && user?.firstName
              ? `Good to see you, ${user.firstName}.`
              : 'Built for pilots who want one connected workflow.'}
          </Text>
          <Text style={styles.heroSubtitle}>
            Flight planning, live cockpit tools, rentals, training, and pilot utilities without the clutter.
          </Text>

          <View style={styles.heroActionRow}>
            <TouchableOpacity
              style={styles.primaryHeroButton}
              onPress={() => navigation.navigate('Profile', { screen: 'FlightPlanner' })}
              activeOpacity={0.9}
            >
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={styles.primaryHeroButtonText}>Open Flight Planner</Text>
            </TouchableOpacity>

            {!isAuthenticated && !isLoading ? (
              <TouchableOpacity
                style={styles.secondaryHeroButton}
                onPress={handleLogin}
                activeOpacity={0.9}
              >
                <Ionicons name="log-in-outline" size={18} color={colors.text} />
                <Text style={styles.secondaryHeroButtonText}>Sign In</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.secondaryHeroButton}
                onPress={() => navigation.navigate('Profile', { screen: 'Logbook' })}
                activeOpacity={0.9}
              >
                <Ionicons name="book-outline" size={18} color={colors.text} />
                <Text style={styles.secondaryHeroButtonText}>Open Logbook</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.statusGrid}>
            <View style={styles.statusTile}>
              <Text style={styles.statusLabel}>Mode</Text>
              <Text style={styles.statusValue}>Preflight + Cockpit</Text>
            </View>
            <View style={styles.statusTile}>
              <Text style={styles.statusLabel}>Membership</Text>
              <Text style={styles.statusValue}>{membershipLabel}</Text>
            </View>
            <View style={styles.statusTile}>
              <Text style={styles.statusLabel}>Best Surface</Text>
              <Text style={styles.statusValue}>Tablet App</Text>
            </View>
          </View>
        </View>
      </ImageBackground>

      {activeFlight ? (
        <View style={styles.resumeCard}>
          <View style={styles.resumeCardLeft}>
            <View style={styles.resumeIconWrap}>
              <Ionicons name="radio-outline" size={18} color="#fff" />
            </View>
            <View style={styles.resumeText}>
              <Text style={styles.resumeTitle}>Active Flight</Text>
              <Text style={styles.resumeSubtitle} numberOfLines={1}>
                {activeFlight.departure && activeFlight.destination
                  ? `${activeFlight.departure} to ${activeFlight.destination}`
                  : activeFlight.departure || activeFlight.destination || 'No route loaded'}
              </Text>
            </View>
          </View>
          <View style={styles.resumeActions}>
            <TouchableOpacity style={styles.resumeButton} onPress={resumeActiveFlight} activeOpacity={0.85}>
              <Text style={styles.resumeButtonText}>Return to Deck</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resumeDismiss} onPress={dismissActiveFlight} activeOpacity={0.85}>
              <Ionicons name="close" size={16} color={colors.textSoft} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mission Control</Text>
          <Text style={styles.sectionSubtitle}>The fastest way into RSF's core workflows.</Text>
        </View>
        <View style={styles.shortcutGrid}>
          <ShortcutCard
            icon="map-outline"
            title="Plan"
            subtitle="Build routes, weather, filing, and terrain review."
            accent={colors.primary}
            onPress={() => navigation.navigate('Profile', { screen: 'FlightPlanner' })}
          />
          <ShortcutCard
            icon="radio-outline"
            title="Fly"
            subtitle="Receiver-backed traffic, live map, and diversions."
            accent={colors.cockpit}
            onPress={() => navigation.navigate('Profile', { screen: 'FlightDeck', params: { mode: 'flight' } })}
          />
          <ShortcutCard
            icon="airplane-outline"
            title="Rent"
            subtitle="Browse aircraft and move straight into booking."
            accent={colors.info}
            onPress={() => navigation.navigate('Rentals')}
          />
          <ShortcutCard
            icon="book-outline"
            title="Log"
            subtitle="Track time, currency, and member-only history."
            accent={colors.accent}
            onPress={() => navigation.navigate('Profile', { screen: 'Logbook' })}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pilot Tools</Text>
          <Text style={styles.sectionSubtitle}>Quick-launch the tools pilots use most.</Text>
        </View>
        <View style={styles.pillRow}>
          <TouchableOpacity style={styles.toolPill} onPress={() => navigation.navigate('Profile', { screen: 'AviationWeatherHub' })}>
            <Ionicons name="cloud-outline" size={16} color={colors.primary} />
            <Text style={styles.toolPillText}>Weather</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolPill} onPress={() => navigation.navigate('Profile', { screen: 'AirportBriefing' })}>
            <Ionicons name="business-outline" size={16} color={colors.primary} />
            <Text style={styles.toolPillText}>Airport Briefing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolPill} onPress={() => navigation.navigate('Profile', { screen: 'ApproachPlates' })}>
            <Ionicons name="document-text-outline" size={16} color={colors.primary} />
            <Text style={styles.toolPillText}>Plates</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolPill} onPress={() => navigation.navigate('Profile', { screen: 'Tfrs' })}>
            <Ionicons name="warning-outline" size={16} color={colors.primary} />
            <Text style={styles.toolPillText}>TFRs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolPill} onPress={() => navigation.navigate('Profile', { screen: 'PilotTools' })}>
            <Ionicons name="grid-outline" size={16} color={colors.primary} />
            <Text style={styles.toolPillText}>All Tools</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Training & Growth</Text>
          <Text style={styles.sectionSubtitle}>Student, recurrent, and proficiency workflows.</Text>
        </View>
        <RailCard
          icon="school-outline"
          title="Student Pilot Hub"
          subtitle="Roadmaps, wizard flow, syllabi, and study support."
          onPress={() => navigation.navigate('Profile', { screen: 'StudentHub' })}
        />
        <RailCard
          icon="radio-outline"
          title="Radio Comms Trainer"
          subtitle="Practice phraseology with guided scenario work."
          onPress={() => navigation.navigate('Profile', { screen: 'RadioCommsTrainer' })}
        />
        <RailCard
          icon="navigate-circle-outline"
          title="GPS & VOR Training"
          subtitle="Structured nav training for procedural confidence."
          onPress={() => navigation.navigate('Profile', { screen: 'GpsSimsHub' })}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.memberPanel}>
          <View style={styles.memberPanelHeader}>
            <View>
              <Text style={styles.memberPanelEyebrow}>RSF MEMBERSHIP</Text>
              <Text style={styles.memberPanelTitle}>Monthly, flexible, and synced across web + app.</Text>
            </View>
            <View style={styles.memberTierChip}>
              <Text style={styles.memberTierChipText}>{membershipLabel}</Text>
            </View>
          </View>
          <Text style={styles.memberPanelBody}>
            Free users can plan and explore. Pro unlocks deeper history, calculators, alerts, and advanced workflows.
          </Text>
          <TouchableOpacity
            style={styles.memberPanelButton}
            onPress={() => navigation.navigate('Profile', { screen: 'LogbookPro' })}
            activeOpacity={0.9}
          >
            <Text style={styles.memberPanelButtonText}>
              {membershipTier === 'free' ? 'View Membership Options' : 'Open Membership Dashboard'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 120,
  },
  hero: {
    minHeight: 430,
  },
  heroImage: {
    opacity: 0.95,
  },
  heroOverlay: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 52,
    paddingBottom: spacing.xl,
    backgroundColor: 'rgba(11, 20, 34, 0.76)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  logo: {
    width: 52,
    height: 52,
  },
  brandEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#cbd5e1',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 4,
  },
  membershipPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  membershipPillText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  heroHeadline: {
    ...typography.display,
    color: '#fff',
    marginTop: 28,
    maxWidth: 320,
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 330,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  primaryHeroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  primaryHeroButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryHeroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
  secondaryHeroButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statusTile: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#bfdbfe',
    textTransform: 'uppercase',
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  shortcutCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  shortcutIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  shortcutTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  shortcutSubtitle: {
    ...typography.muted,
    marginTop: 6,
    minHeight: 54,
  },
  shortcutFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shortcutAction: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  toolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  railCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  railIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  railTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  railSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  memberPanel: {
    backgroundColor: colors.cockpit,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.card,
  },
  memberPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  memberPanelEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#93c5fd',
    textTransform: 'uppercase',
  },
  memberPanelTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
    maxWidth: 250,
  },
  memberTierChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
  },
  memberTierChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  memberPanelBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#dbe4f0',
    marginTop: spacing.md,
  },
  memberPanelButton: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
  memberPanelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  resumeCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    backgroundColor: colors.cockpit,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadow.card,
  },
  resumeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  resumeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  resumeText: {
    flex: 1,
  },
  resumeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E8EDF4',
    letterSpacing: 0.3,
  },
  resumeSubtitle: {
    fontSize: 12,
    color: 'rgba(232,237,244,0.7)',
    marginTop: 2,
  },
  resumeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  resumeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  resumeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  resumeDismiss: {
    padding: 6,
  },
});
