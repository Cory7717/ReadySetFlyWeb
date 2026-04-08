import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../styles/theme';

type CategoryCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
};

function CategoryCard({ icon, eyebrow, title, subtitle, accent, onPress }: CategoryCardProps) {
  return (
    <TouchableOpacity style={styles.categoryCard} onPress={onPress} activeOpacity={0.92}>
      <View style={[styles.categoryIconWrap, { backgroundColor: accent }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <Text style={styles.categoryEyebrow}>{eyebrow}</Text>
      <Text style={styles.categoryTitle}>{title}</Text>
      <Text style={styles.categorySubtitle}>{subtitle}</Text>
      <View style={styles.categoryFooter}>
        <Text style={styles.categoryAction}>Open</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

type RailProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
};

function ToolRail({ icon, title, subtitle, onPress }: RailProps) {
  return (
    <TouchableOpacity style={styles.railCard} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.railIconWrap}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.railText}>
        <Text style={styles.railTitle}>{title}</Text>
        <Text style={styles.railSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
    </TouchableOpacity>
  );
}

export default function PilotToolsScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>PILOT TOOLS</Text>
        <Text style={styles.heroTitle}>Curated for planning, weather, IFR, and cockpit decisions.</Text>
        <Text style={styles.heroSubtitle}>
          RSF organizes tools by mission so pilots can get in, get what they need, and move.
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tool Collections</Text>
          <Text style={styles.sectionSubtitle}>Start from the mission, not the menu.</Text>
        </View>

        <View style={styles.grid}>
          <CategoryCard
            icon="map-outline"
            eyebrow="PLANNING"
            title="Flight Planning"
            subtitle="Route building, filing prep, fuel logic, terrain review, and live route context."
            accent={colors.primary}
            onPress={() => navigation.navigate('FlightPlanner')}
          />
          <CategoryCard
            icon="cloud-outline"
            eyebrow="WEATHER"
            title="Weather Hub"
            subtitle="METARs, TAFs, hazards, winds aloft, and route-level weather review."
            accent={colors.info}
            onPress={() => navigation.navigate('AviationWeatherHub')}
          />
          <CategoryCard
            icon="navigate-outline"
            eyebrow="IFR"
            title="IFR & Plates"
            subtitle="Approach plates, TFRs, airport briefing, GPS sims, and IFR workflow tools."
            accent={colors.cockpit}
            onPress={() => navigation.navigate('IfrTools')}
          />
          <CategoryCard
            icon="calculator-outline"
            eyebrow="CALCULATORS"
            title="Performance"
            subtitle="Weight and balance, crosswind, density altitude, and ownership cost tools."
            accent={colors.accent}
            onPress={() => navigation.navigate('WeightBalance')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Launch</Text>
          <Text style={styles.sectionSubtitle}>Most-used tools for fast access on the ramp or in briefing.</Text>
        </View>
        <ToolRail
          icon="business-outline"
          title="Airport Briefing"
          subtitle="Runways, winds, NOTAMs, and airport context."
          onPress={() => navigation.navigate('AirportBriefing')}
        />
        <ToolRail
          icon="sparkles-outline"
          title="AI Weather Translator"
          subtitle="Plain-English weather translation from loaded METAR and TAF data."
          onPress={() => navigation.navigate('AviationWeatherHub')}
        />
        <ToolRail
          icon="document-text-outline"
          title="Approach Plates"
          subtitle="Search and pull FAA plates by airport."
          onPress={() => navigation.navigate('ApproachPlates')}
        />
        <ToolRail
          icon="warning-outline"
          title="TFRs"
          subtitle="Check temporary flight restrictions by airport."
          onPress={() => navigation.navigate('Tfrs')}
        />
        <ToolRail
          icon="radio-outline"
          title="Radio Comms Trainer"
          subtitle="Practice phraseology and scenario flow."
          onPress={() => navigation.navigate('RadioCommsTrainer')}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.memberPanel}>
          <Text style={styles.memberEyebrow}>RSF PRO TOOLS</Text>
          <Text style={styles.memberTitle}>Advanced calculators, history, and deeper pilot workflows.</Text>
          <Text style={styles.memberText}>
            The free layer stays useful, but membership turns RSF into a full pilot workspace.
          </Text>
          <TouchableOpacity
            style={styles.memberButton}
            onPress={() => navigation.navigate('LogbookPro')}
            activeOpacity={0.92}
          >
            <Text style={styles.memberButtonText}>View Membership</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 120 },
  hero: {
    backgroundColor: colors.cockpit,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.floating,
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
  },
  heroSubtitle: {
    ...typography.body,
    color: '#dbe4f0',
    marginTop: spacing.sm,
    maxWidth: 340,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionSubtitle: {
    ...typography.muted,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  categoryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  categoryEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.textSoft,
    textTransform: 'uppercase',
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
  },
  categorySubtitle: {
    ...typography.muted,
    marginTop: 6,
    minHeight: 72,
  },
  categoryFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryAction: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  railCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.surfaceTinted,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  memberEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  memberTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
    maxWidth: 280,
  },
  memberText: {
    ...typography.body,
    marginTop: spacing.sm,
    color: colors.textMuted,
  },
  memberButton: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  memberButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
