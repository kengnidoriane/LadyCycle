/**
 * WellnessScreen — conseils de bien-être adaptés à la phase et au mode de suivi.
 *
 * Restylé avec le système de design. Conseils triés par priorité, filtrables
 * par catégorie, première carte dépliée par défaut.
 *
 * Exigences : 11.1, 11.2, 11.3, 11.4, 11.5
 */

import React, { useState } from 'react'
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useWellness, getCategoryLabel, getCategoryColor } from './useWellness'
import { Screen, AppText, Card, Button, Badge, Icon } from '../components'
import { colors, spacing, radii } from '../theme'
import { PHASE_META } from '../shared/phaseMeta'
import { useI18n } from '../i18n/I18nContext'
import type { Advice } from '../../domain/wellness/types'
import type { CyclePhase } from '../../domain/cycle/types'

const TRACKING_MODE_LABELS: Record<string, string> = {
  general: 'Suivi général',
  trying_to_conceive: 'Essai bébé',
  natural_contraception: 'Contraception naturelle',
}

export function WellnessScreen(): React.JSX.Element {
  const { advices, currentPhase, trackingMode, isLoading, error, refresh } = useWellness()
  const { t } = useI18n()
  const [activeCategory, setActiveCategory] = useState<Advice['category'] | null>(null)

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (error !== null) {
    return (
      <Screen scroll={false} contentStyle={styles.centered}>
        <AppText variant="body" tone="secondary" center>
          {error}
        </AppText>
        <View style={{ height: spacing.lg }} />
        <Button label="Réessayer" onPress={refresh} fullWidth={false} />
      </Screen>
    )
  }

  const filteredAdvices =
    activeCategory !== null ? advices.filter((a) => a.category === activeCategory) : advices
  const availableCategories = Array.from(new Set(advices.map((a) => a.category))) as Advice['category'][]
  const phaseMeta = currentPhase ? PHASE_META[currentPhase as CyclePhase] : null

  return (
    <Screen>
      <AppText variant="h1" style={styles.title} accessibilityRole="header">
        Bien-être
      </AppText>

      {phaseMeta && currentPhase ? (
        <Card tint={phaseMeta.soft} style={styles.phaseCard}>
          <View style={styles.phaseHeader}>
            <View style={[styles.phaseIcon, { backgroundColor: colors.surface }]}>
              <Icon name={phaseMeta.icon} size={22} color={phaseMeta.main} />
            </View>
            <View style={styles.phaseText}>
              <AppText variant="h3" style={{ color: phaseMeta.text }}>
                {t(phaseMeta.labelKey)}
              </AppText>
              <AppText variant="caption" style={{ color: phaseMeta.text, opacity: 0.85 }}>
                {TRACKING_MODE_LABELS[trackingMode] ?? 'Suivi général'}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" style={{ color: phaseMeta.text, opacity: 0.9 }}>
            {t(phaseMeta.descKey)}
          </AppText>
        </Card>
      ) : (
        <Card tint={colors.primarySoft} style={styles.phaseCard}>
          <View style={styles.emptyPhase}>
            <Icon name="flower" size={36} color={colors.primary} />
            <AppText variant="h3" center style={styles.emptyTitle}>
              Commence ton suivi
            </AppText>
            <AppText variant="caption" tone="secondary" center>
              Enregistre tes règles pour recevoir des conseils adaptés à ton cycle.
            </AppText>
          </View>
        </Card>
      )}

      {/* Filtres par catégorie */}
      {availableCategories.length > 1 && (
        <View style={styles.filters}>
          <CategoryChip
            label="Tous"
            active={activeCategory === null}
            color={colors.primary}
            onPress={() => setActiveCategory(null)}
          />
          {availableCategories.map((category) => (
            <CategoryChip
              key={category}
              label={getCategoryLabel(category)}
              active={activeCategory === category}
              color={getCategoryColor(category)}
              onPress={() => setActiveCategory((prev) => (prev === category ? null : category))}
            />
          ))}
        </View>
      )}

      {/* Conseils */}
      <View style={styles.advices}>
        {filteredAdvices.length === 0 ? (
          <Card>
            <AppText variant="caption" tone="secondary" center>
              Aucun conseil disponible pour le moment.
            </AppText>
          </Card>
        ) : (
          filteredAdvices.map((advice, index) => (
            <AdviceCard key={advice.id} advice={advice} isFirst={index === 0} />
          ))
        )}
      </View>
    </Screen>
  )
}

function CategoryChip({
  label,
  active,
  color,
  onPress,
}: {
  label: string
  active: boolean
  color: string
  onPress: () => void
}): React.JSX.Element {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.chip,
        active && { borderColor: color, backgroundColor: color + '14' },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
    >
      <AppText
        variant="caption"
        style={active ? { color, fontWeight: '700' } : { color: colors.textSecondary }}
      >
        {label}
      </AppText>
    </TouchableOpacity>
  )
}

function AdviceCard({ advice, isFirst }: { advice: Advice; isFirst: boolean }): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(isFirst)
  const categoryColor = getCategoryColor(advice.category)
  const categoryLabel = getCategoryLabel(advice.category)

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setIsExpanded((prev) => !prev)}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
      accessibilityLabel={`${categoryLabel}. ${advice.title}. ${isExpanded ? advice.content : 'Appuyez pour lire.'}`}
      style={[styles.adviceCard, { borderLeftColor: categoryColor }]}
    >
      <View style={styles.adviceHeader}>
        <View style={styles.adviceMeta}>
          <Badge label={categoryLabel} color={categoryColor} background={categoryColor + '18'} />
          {advice.priority === 'high' && (
            <Badge
              label="Prioritaire"
              icon="sparkles"
              color={colors.phase.ovulation.text}
              background={colors.phase.ovulation.soft}
            />
          )}
        </View>
        <Icon name={isExpanded ? 'chevronRight' : 'chevronRight'} size={18} color={colors.textTertiary} />
      </View>

      <AppText variant="bodyStrong" style={styles.adviceTitle}>
        {advice.title}
      </AppText>

      {isExpanded && (
        <AppText variant="body" tone="secondary" style={styles.adviceContent}>
          {advice.content}
        </AppText>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: spacing.lg,
  },
  phaseCard: {
    marginBottom: spacing.lg,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  phaseIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseText: {
    flex: 1,
  },
  emptyPhase: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  emptyTitle: {
    marginTop: spacing.xs,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  advices: {
    gap: spacing.md,
  },
  adviceCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: spacing.lg,
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  adviceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    flexWrap: 'wrap',
  },
  adviceTitle: {
    lineHeight: 20,
  },
  adviceContent: {
    marginTop: spacing.sm,
    lineHeight: 21,
  },
})
