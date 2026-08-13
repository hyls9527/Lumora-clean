/** Shape of the scoring explanation payload coming from the backend. */
export interface ExplanationTextInput {
  fileName: string;
  scoreLabel?: string;
  aestheticScore?: number;
  hpsScore?: number;
  hpsComparable?: boolean;
  hpsStyle?: string;
  percentile?: number;
  styleTotal: number;
}

/**
 * Format a scoring explanation.
 *
 * HPS v2 is a same-prompt preference logit with no absolute meaning, so it is
 * shown only when the backend confirms a same-prompt comparison exists
 * (`hpsComparable`); otherwise the number would mislead across prompts.
 */
export function formatScoreExplanation(e: ExplanationTextInput): string {
  const aesthetic = e.aestheticScore?.toFixed(1) ?? '—';
  const hps =
    e.hpsScore != null && e.hpsComparable
      ? `，组内 HPS ${e.hpsScore.toFixed(1)}（仅同 prompt 变体内可比）`
      : '';
  const classLabel = e.hpsStyle ?? '全库';
  const percentile =
    e.percentile != null
      ? `，在${classLabel}类里超过 ${Math.round(e.percentile)}% 的图（同类 ${e.styleTotal} 张）`
      : '';
  return `「${e.fileName}」是「${e.scoreLabel ?? '未评分'}」：美学 ${aesthetic}${hps}${percentile}`;
}
