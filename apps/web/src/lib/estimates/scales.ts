/**
 * Estimate scales — Plane-style.
 *
 * A project may pick a single active estimate system. The system is composed of
 * a high-level {@link EstimateKind} (points, categories, time) and a concrete
 * {@link EstimateSubKind} which selects a preset or a custom user-defined list.
 */

export type EstimateKind = 'points' | 'categories' | 'time';

export type EstimateSubKind =
  | 'points-linear'
  | 'points-fibonacci'
  | 'points-squares'
  | 'points-custom'
  | 'categories-tshirt'
  | 'categories-difficulty'
  | 'categories-custom'
  | 'time-preset'
  | 'time-custom';

export interface EstimateScale {
  kind: EstimateKind;
  subKind: EstimateSubKind;
  /** Displayed values, in order. */
  values: string[];
}

/**
 * Built-in preset scales keyed by {@link EstimateSubKind}. A value of `null`
 * signals a custom scale whose values are supplied by the user at runtime.
 */
export const PRESET_SCALES: Record<EstimateSubKind, EstimateScale | null> = {
  'points-linear': {
    kind: 'points',
    subKind: 'points-linear',
    values: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  },
  'points-fibonacci': {
    kind: 'points',
    subKind: 'points-fibonacci',
    values: ['1', '2', '3', '5', '8', '13', '21'],
  },
  'points-squares': {
    kind: 'points',
    subKind: 'points-squares',
    values: ['1', '4', '9', '16', '25'],
  },
  'points-custom': null,
  'categories-tshirt': {
    kind: 'categories',
    subKind: 'categories-tshirt',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
  'categories-difficulty': {
    kind: 'categories',
    subKind: 'categories-difficulty',
    values: ['Easy', 'Medium', 'Hard', 'Very Hard'],
  },
  'categories-custom': null,
  'time-preset': {
    kind: 'time',
    subKind: 'time-preset',
    values: ['1h', '2h', '3h', '4h', '5h 30m', '6h 30m'],
  },
  'time-custom': null,
};

/** Construct a custom (user-authored) scale for a given kind. */
export function makeCustomScale(kind: EstimateKind, values: string[]): EstimateScale {
  return {
    kind,
    subKind: `${kind}-custom` as EstimateSubKind,
    values,
  };
}

/** Return the `EstimateKind` that a given sub-kind belongs to. */
export function kindOfSubKind(subKind: EstimateSubKind): EstimateKind {
  return subKind.split('-')[0] as EstimateKind;
}

/** True when the sub-kind represents a custom, user-authored scale. */
export function isCustomSubKind(subKind: EstimateSubKind): boolean {
  return subKind.endsWith('-custom');
}

/** Ordered list of sub-kinds per kind, for stable UI ordering. */
export const SUBKINDS_BY_KIND: Record<EstimateKind, EstimateSubKind[]> = {
  points: ['points-linear', 'points-fibonacci', 'points-squares', 'points-custom'],
  categories: ['categories-tshirt', 'categories-difficulty', 'categories-custom'],
  time: ['time-preset', 'time-custom'],
};

/** Human-readable display names for each sub-kind. */
export const SUBKIND_LABELS: Record<EstimateSubKind, string> = {
  'points-linear': 'Linear',
  'points-fibonacci': 'Fibonacci',
  'points-squares': 'Squares',
  'points-custom': 'Custom points',
  'categories-tshirt': 'T-shirt sizes',
  'categories-difficulty': 'Difficulty',
  'categories-custom': 'Custom categories',
  'time-preset': 'Preset hours',
  'time-custom': 'Custom time',
};
