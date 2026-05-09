/**
 * WellnessScreen — Écran des conseils de bien-être personnalisés.
 *
 * Affiche :
 * - La phase actuelle du cycle avec son emoji et sa couleur
 * - Les conseils du jour via GetDailyAdviceUseCase, adaptés à la phase et au mode
 * - Les conseils triés par priorité (high → medium → low)
 * - Les catégories de conseils (nutrition, exercice, bien-être, santé)
 * - Un message adapté au mode de suivi (essai bébé, contraception, général)
 *
 * Ce composant ne contient aucune logique métier — tout est délégué à
 * useWellness() qui orchestre GetDailyAdviceUseCase.
 *
 * Exigences : 11.1, 11.2, 11.3, 11.4, 11.5
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import { useWellness, getPhaseInfo, getCategoryLabel, getCategoryColor } from './useWellness'
import type { Advice } from '../../domain/wellness/types'

// ─── Labels du mode de suivi ──────────────────────────────────────────────────

const TRACKING_MODE_LABELS: Record<string, string> = {
  general: 'Suivi général',
  trying_to_conceive: 'Essai bébé',
  natural_contraception: 'Contraception naturelle',
}

const TRACKING_MODE_DESCRIPTIONS: Record<string, string> = {
  general: 'Conseils équilibrés pour toutes les phases de votre cycle.',
  trying_to_conceive: 'Conseils axés sur la fertilité et la conception.',
  natural_contraception: 'Conseils incluant les avertissements sur les jours à risque.',
}

// ─── Composant ────────────────────────────────────────────────────────────────

/**
 * Écran principal des conseils de bien-être.
 *
 * Structure :
 * 1. En-tête : phase actuelle + mode de suivi
 * 2. Filtre par catégorie (optionnel)
 * 3. Liste des conseils du jour triés par priorité
 * 4. État vide si aucun cycle enregistré
 */
export function WellnessScreen(): React.JSX.Element {
  const { advices, currentPhase, trackingMode, isLoading, error, refresh } = useWellness()

  // Filtre de catégorie actif (null = toutes les catégories)
  const [activeCategory, setActiveCategory] = useState<Advice['category'] | null>(null)

  // ── Rendu états de chargement / erreur ────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator
          size="large"
          color="#E91E63"
          accessibilityLabel="Chargement des conseils de bien-être"
        />
        <Text style={styles.loadingText}>Chargement…</Text>
      </SafeAreaView>
    )
  }

  if (error !== null) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={refresh}
          accessibilityLabel="Réessayer le chargement"
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  // ── Filtrage des conseils ─────────────────────────────────────────────────

  const filteredAdvices = activeCategory !== null
    ? advices.filter(a => a.category === activeCategory)
    : advices

  // Catégories présentes dans les conseils du jour
  const availableCategories = Array.from(
    new Set(advices.map(a => a.category)),
  ) as Advice['category'][]

  // ── Infos de phase ────────────────────────────────────────────────────────

  const phaseInfo = currentPhase !== null ? getPhaseInfo(currentPhase) : null

  // ── Rendu principal ───────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── En-tête ────────────────────────────────────────────────────── */}
        <Text style={styles.screenTitle} accessibilityRole="header">
          Bien-être
        </Text>

        {/* ── Carte de phase actuelle ─────────────────────────────────────── */}
        {phaseInfo !== null ? (
          <View
            style={[styles.phaseCard, { backgroundColor: phaseInfo.backgroundColor }]}
            accessible={true}
            accessibilityLabel={`Phase actuelle : ${phaseInfo.label}`}
            accessibilityRole="text"
          >
            <View style={styles.phaseCardHeader}>
              <Text style={styles.phaseEmoji} accessibilityElementsHidden={true}>
                {phaseInfo.emoji}
              </Text>
              <View style={styles.phaseCardText}>
                <Text style={[styles.phaseLabel, { color: phaseInfo.color }]}>
                  {phaseInfo.label}
                </Text>
                <Text style={[styles.phaseSubLabel, { color: phaseInfo.color }]}>
                  {TRACKING_MODE_LABELS[trackingMode] ?? 'Suivi général'}
                </Text>
              </View>
            </View>
            <Text
              style={[styles.phaseDescription, { color: phaseInfo.color }]}
              accessibilityElementsHidden={true}
            >
              {TRACKING_MODE_DESCRIPTIONS[trackingMode] ?? ''}
            </Text>
          </View>
        ) : (
          /* ── État vide : aucun cycle enregistré ─────────────────────── */
          <View style={styles.emptyPhaseCard}>
            <Text style={styles.emptyPhaseEmoji} accessibilityElementsHidden={true}>
              🌸
            </Text>
            <Text style={styles.emptyPhaseTitle}>
              Commencez votre suivi
            </Text>
            <Text style={styles.emptyPhaseDescription}>
              Enregistrez vos règles depuis le calendrier pour recevoir des conseils
              personnalisés adaptés à votre cycle.
            </Text>
          </View>
        )}

        {/* ── Filtres par catégorie ───────────────────────────────────────── */}
        {availableCategories.length > 1 && (
          <View
            style={styles.categoryFilters}
            accessible={true}
            accessibilityLabel="Filtrer les conseils par catégorie"
          >
            {/* Bouton "Tous" */}
            <TouchableOpacity
              style={[
                styles.categoryChip,
                activeCategory === null && styles.categoryChipActive,
              ]}
              onPress={() => setActiveCategory(null)}
              accessibilityRole="radio"
              accessibilityState={{ checked: activeCategory === null }}
              accessibilityLabel={`Tous les conseils${activeCategory === null ? ', sélectionné' : ''}`}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  activeCategory === null && styles.categoryChipTextActive,
                ]}
              >
                Tous
              </Text>
            </TouchableOpacity>

            {/* Boutons par catégorie */}
            {availableCategories.map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  activeCategory === category && styles.categoryChipActive,
                  activeCategory === category && {
                    borderColor: getCategoryColor(category),
                    backgroundColor: getCategoryColor(category) + '15',
                  },
                ]}
                onPress={() =>
                  setActiveCategory(prev => (prev === category ? null : category))
                }
                accessibilityRole="radio"
                accessibilityState={{ checked: activeCategory === category }}
                accessibilityLabel={`${getCategoryLabel(category)}${activeCategory === category ? ', sélectionné' : ''}`}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    activeCategory === category && {
                      color: getCategoryColor(category),
                      fontWeight: '700',
                    },
                  ]}
                >
                  {getCategoryLabel(category)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Liste des conseils ──────────────────────────────────────────── */}
        <View style={styles.advicesSection}>
          {filteredAdvices.length === 0 ? (
            <View style={styles.emptyAdvices}>
              <Text style={styles.emptyAdvicesText}>
                {activeCategory !== null
                  ? `Aucun conseil de type "${getCategoryLabel(activeCategory)}" pour cette phase.`
                  : 'Aucun conseil disponible pour le moment.'}
              </Text>
            </View>
          ) : (
            filteredAdvices.map((advice, index) => (
              <AdviceCard
                key={advice.id}
                advice={advice}
                isFirst={index === 0}
              />
            ))
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Composant AdviceCard ─────────────────────────────────────────────────────

interface AdviceCardProps {
  advice: Advice
  isFirst: boolean
}

/**
 * Carte affichant un conseil de bien-être.
 *
 * Affiche :
 * - La catégorie avec son emoji et sa couleur
 * - Le badge de priorité (uniquement pour les conseils "high")
 * - Le titre et le contenu du conseil
 *
 * Accessibilité : le contenu complet est annoncé par les lecteurs d'écran.
 */
function AdviceCard({ advice, isFirst }: AdviceCardProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(isFirst)
  const categoryColor = getCategoryColor(advice.category)
  const categoryLabel = getCategoryLabel(advice.category)

  const accessibilityLabel =
    `${categoryLabel}. ${advice.title}. ${isExpanded ? advice.content : 'Appuyez pour lire le conseil complet.'}`

  return (
    <TouchableOpacity
      style={[styles.adviceCard, { borderLeftColor: categoryColor }]}
      onPress={() => setIsExpanded(prev => !prev)}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint={isExpanded ? 'Appuyez pour réduire' : 'Appuyez pour lire le conseil complet'}
      accessibilityState={{ expanded: isExpanded }}
    >
      {/* En-tête de la carte */}
      <View style={styles.adviceCardHeader}>
        <View style={styles.adviceCardMeta}>
          {/* Badge catégorie */}
          <View
            style={[styles.categoryBadge, { backgroundColor: categoryColor + '18' }]}
            accessibilityElementsHidden={true}
          >
            <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>
              {categoryLabel}
            </Text>
          </View>

          {/* Badge priorité haute */}
          {advice.priority === 'high' && (
            <View style={styles.priorityBadge} accessibilityElementsHidden={true}>
              <Text style={styles.priorityBadgeText}>★ Prioritaire</Text>
            </View>
          )}
        </View>

        {/* Chevron d'expansion */}
        <Text
          style={[styles.expandChevron, isExpanded && styles.expandChevronOpen]}
          accessibilityElementsHidden={true}
        >
          ›
        </Text>
      </View>

      {/* Titre */}
      <Text style={styles.adviceTitle}>{advice.title}</Text>

      {/* Contenu (conditionnel) */}
      {isExpanded && (
        <Text style={styles.adviceContent} accessibilityElementsHidden={true}>
          {advice.content}
        </Text>
      )}
    </TouchableOpacity>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#757575',
  },
  errorText: {
    fontSize: 15,
    color: '#EF5350',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#E91E63',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  // ── Carte de phase ──────────────────────────────────────────────────────
  phaseCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  phaseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  phaseEmoji: {
    fontSize: 28,
  },
  phaseCardText: {
    flex: 1,
  },
  phaseLabel: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  phaseSubLabel: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.8,
  },
  phaseDescription: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.85,
  },
  // ── État vide (aucun cycle) ─────────────────────────────────────────────
  emptyPhaseCard: {
    backgroundColor: '#FCE4EC',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  emptyPhaseEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyPhaseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#880E4F',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyPhaseDescription: {
    fontSize: 13,
    color: '#AD1457',
    textAlign: 'center',
    lineHeight: 18,
  },
  // ── Filtres par catégorie ───────────────────────────────────────────────
  categoryFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  categoryChipActive: {
    borderColor: '#E91E63',
    backgroundColor: '#FCE4EC',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#616161',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#880E4F',
    fontWeight: '700',
  },
  // ── Section conseils ────────────────────────────────────────────────────
  advicesSection: {
    gap: 10,
  },
  emptyAdvices: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyAdvicesText: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 20,
  },
  // ── Carte de conseil ────────────────────────────────────────────────────
  adviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  adviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  adviceCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  priorityBadge: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityBadgeText: {
    fontSize: 11,
    color: '#F57F17',
    fontWeight: '600',
  },
  expandChevron: {
    fontSize: 20,
    color: '#BDBDBD',
    fontWeight: '300',
    transform: [{ rotate: '0deg' }],
    marginLeft: 8,
  },
  expandChevronOpen: {
    transform: [{ rotate: '90deg' }],
  },
  adviceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    lineHeight: 20,
  },
  adviceContent: {
    marginTop: 10,
    fontSize: 14,
    color: '#424242',
    lineHeight: 21,
  },
  bottomSpacer: {
    height: 24,
  },
})
