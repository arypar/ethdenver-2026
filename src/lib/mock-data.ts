function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const triggerReasons = [
  'Large swap detected: $2.4M WETH → USDC',
  'Price impact exceeded 3.2% threshold',
  'Swap count surged to 85 in 5m window',
  'Notional swap exceeded $500K on UNI/ETH',
];

const suggestedActions = [
  'Swap 50% WETH → USDC to reduce exposure',
  'Tighten position range on WETH/USDC',
  'Review portfolio — high volatility detected',
  'Consider limit order at support level',
];

export function generateTriggerData(ruleName: string, pool: string) {
  const seed = hashString(`${ruleName}-${Date.now()}`);
  const rand = seededRandom(seed);
  const idx = Math.floor(rand() * triggerReasons.length);
  return {
    triggerReason: triggerReasons[idx],
    suggestedAction: suggestedActions[idx],
    conditionsMet: [
      `Notional USD > $100K`,
      `Price Impact > 1.5%`,
      `Within 15m window`,
    ].slice(0, 1 + Math.floor(rand() * 3)),
    proposedActions: [suggestedActions[idx]],
  };
}
