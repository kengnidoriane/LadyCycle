/**
 * OvulationBlurZone — fenêtre d'ovulation présentée avec honnêteté.
 *
 * L'ovulation est biologiquement instable : afficher une date précise serait
 * mentir sur la certitude. On réduit donc l'opacité de la date estimée et on
 * affiche un « ± quelques jours » assumé. Cohérent avec la philosophie de
 * l'app : pas de fausse précision.
 *
 * Exigence 2.6.
 */

import React from 'react'
import { View, StyleSheet } from 'react-native'
import type { OvulationWindow, ConfidenceResult } from '../../domain/cycle/types'
import { AppText, Card, Badge, Icon } from '../components'
import { colors, spacing, radii } from '../theme'
import { confidenceMeta } from '../shared/phaseMeta'

interface OvulationBlurZoneProps {
  ovulation: OvulationWindow
  confidence: ConfidenceResult
  lang?: 'fr' | 'en'
}

function formatDate(date: string, lang: 'fr' | 'en'): string {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

const CONF_LABEL: Record<string, Record<'fr' | 'en', string>> = {
  low: { fr: 'Confiance faible', en: 'Low confidence' },
  medium: { fr: 'Confiance moyenne', en: 'Medium confidence' },
  high: { fr: 'Confiance élevée', en: 'High confidence' },
}

export function OvulationBlurZone({
  ovulation,
  confidence,
  lang = 'fr',
}: OvulationBlurZoneProps): React.JSX.Element {
  const fertileStart = formatDate(ovulation.fertileWindowStart, lang)
  const fertileEnd = formatDate(ovulation.fertileWindowEnd, lang)
  const estimatedDate = formatDate(ovulation.estimatedDate, lang)
  const ov = colors.phase.ovulation
  const conf = confidenceMeta(confidence.level)

  const accessibilityLabel =
    lang === 'fr'
      ? `Ovulation estimée le ${estimatedDate}. Période féconde du ${fertileStart} au ${fertileEnd}. Cette date est une estimation — la biologie est variable.`
      : `Estimated ovulation on ${estimatedDate}. Fertile window from ${fertileStart} to ${fertileEnd}. This date is an estimate — biology varies.`

  return (
    <Card
      tint={ov.soft}
      accent={ov.main}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.header}>
        <Icon name="flower" size={18} color={ov.text} />
        <AppText variant="bodyStrong" style={{ color: ov.text }}>
          {lang === 'fr' ? 'Ovulation estimée' : 'Estimated ovulation'}
        </AppText>
      </View>

      {/* Date floue (opacité réduite = incertitude assumée) */}
      <View style={styles.blurZone} accessibilityElementsHidden>
        <AppText variant="h1" style={[styles.estimatedDate, { color: ov.text }]}>
          {estimatedDate}
        </AppText>
        <AppText variant="caption" style={[styles.note, { color: ov.text }]}>
          {lang === 'fr' ? '± quelques jours' : '± a few days'}
        </AppText>
      </View>

      {/* Période féconde */}
      <View style={[styles.fertileRow, { backgroundColor: colors.surface }]}>
        <AppText variant="caption" tone="secondary">
          {lang === 'fr' ? 'Période féconde' : 'Fertile window'}
        </AppText>
        <AppText variant="bodyStrong" style={{ color: ov.text }}>
          {fertileStart} → {fertileEnd}
        </AppText>
      </View>

      <View style={styles.badgeRow}>
        <Badge
          label={CONF_LABEL[confidence.level][lang]}
          color={conf.text}
          background={colors.surface}
        />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  blurZone: {
    alignItems: 'center',
    marginBottom: spacing.md,
    opacity: 0.72,
  },
  estimatedDate: {
    marginBottom: 2,
  },
  note: {
    fontStyle: 'italic',
  },
  fertileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
  },
})
