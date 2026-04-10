// Protocol Intelligence Engine
// Peptide interaction rules, stack analysis, and suggestions

export const COMPOUND_RULES = {
  // ── GH Secretagogue ──
  ipamorelin: [
    {
      targetId: 'cjc_nodac',
      type: 'synergy',
      severity: 'info',
      note: 'GHRH + GHRP pulse. Ideal combination for natural GH release.',
      source: 'Clinical protocol'
    },
    {
      targetId: 'hgh',
      type: 'redundant',
      severity: 'warning',
      note: 'Exogenous GH makes secretagogues redundant.',
      source: 'Pharmacology'
    },
    {
      targetId: '_self',
      type: 'timing',
      severity: 'info',
      note: 'Empty stomach required. Food insulin response blunts GH pulse.',
      source: 'Pharmacokinetics'
    }
  ],
  cjc_nodac: [
    {
      targetId: 'hgh',
      type: 'redundant',
      severity: 'warning',
      note: 'Exogenous GH makes secretagogues redundant.',
      source: 'Pharmacology'
    },
    {
      targetId: '_self',
      type: 'timing',
      severity: 'info',
      note: 'Empty stomach required. Food insulin response blunts GH pulse.',
      source: 'Pharmacokinetics'
    }
  ],
  cjc_dac: [
    {
      targetId: 'hgh',
      type: 'redundant',
      severity: 'warning',
      note: 'Exogenous GH makes secretagogues redundant.',
      source: 'Pharmacology'
    }
  ],
  tesamorelin: [
    {
      targetId: 'hgh',
      type: 'redundant',
      severity: 'warning',
      note: 'Exogenous GH makes secretagogues redundant.',
      source: 'Pharmacology'
    }
  ],
  ghrp2: [
    {
      targetId: 'ghrp6',
      type: 'redundant',
      severity: 'warning',
      note: 'Same mechanism class (GHRP). Choose one.',
      source: 'Pharmacology'
    },
    {
      targetId: 'hgh',
      type: 'redundant',
      severity: 'warning',
      note: 'Exogenous GH makes secretagogues redundant.',
      source: 'Pharmacology'
    }
  ],
  ghrp6: [
    {
      targetId: 'ghrp2',
      type: 'redundant',
      severity: 'warning',
      note: 'Same mechanism class (GHRP). Choose one.',
      source: 'Pharmacology'
    },
    {
      targetId: 'hgh',
      type: 'redundant',
      severity: 'warning',
      note: 'Exogenous GH makes secretagogues redundant.',
      source: 'Pharmacology'
    }
  ],
  hexarelin: [
    {
      targetId: 'hexarelin',
      type: 'cycling',
      severity: 'warning',
      note: 'Desensitization after 4 weeks continuous use. Cycle 4 weeks on, 4 weeks off.',
      source: 'Receptor pharmacology'
    },
    {
      targetId: 'hgh',
      type: 'redundant',
      severity: 'warning',
      note: 'Exogenous GH makes secretagogues redundant.',
      source: 'Pharmacology'
    }
  ],
  sermorelin: [
    {
      targetId: 'hgh',
      type: 'redundant',
      severity: 'warning',
      note: 'Exogenous GH makes secretagogues redundant.',
      source: 'Pharmacology'
    }
  ],
  gh_blend: [
    {
      targetId: 'hgh',
      type: 'redundant',
      severity: 'warning',
      note: 'Exogenous GH makes secretagogues redundant.',
      source: 'Pharmacology'
    },
    {
      targetId: '_self',
      type: 'timing',
      severity: 'info',
      note: 'Empty stomach nightly. Food blunts GH release.',
      source: 'Pharmacokinetics'
    }
  ],
  igf1_lr3: [
    {
      targetId: 'igf1_lr3',
      type: 'cycling',
      severity: 'warning',
      note: '2 weeks on, 2 weeks off mandatory. Receptor downregulation.',
      source: 'Clinical protocol'
    }
  ],

  // ── GLP-1 / Fat Loss ──
  semaglutide: [
    {
      targetId: 'tirzepatide',
      type: 'conflict',
      severity: 'danger',
      note: 'Never combine GLP-1 agonists. Severe GI risk.',
      source: 'FDA guidance'
    },
    {
      targetId: 'retatrutide',
      type: 'conflict',
      severity: 'danger',
      note: 'Never combine GLP-1 agonists. Severe GI risk.',
      source: 'FDA guidance'
    }
  ],
  tirzepatide: [
    {
      targetId: 'semaglutide',
      type: 'conflict',
      severity: 'danger',
      note: 'Never combine GLP-1 agonists. Severe GI risk.',
      source: 'FDA guidance'
    },
    {
      targetId: 'retatrutide',
      type: 'conflict',
      severity: 'danger',
      note: 'Never combine GLP-1 agonists. Severe GI risk.',
      source: 'FDA guidance'
    }
  ],
  retatrutide: [
    {
      targetId: 'semaglutide',
      type: 'conflict',
      severity: 'danger',
      note: 'Never combine GLP-1 agonists. Severe GI risk.',
      source: 'FDA guidance'
    },
    {
      targetId: 'tirzepatide',
      type: 'conflict',
      severity: 'danger',
      note: 'Never combine GLP-1 agonists. Severe GI risk.',
      source: 'FDA guidance'
    },
    {
      targetId: '_self',
      type: 'timing',
      severity: 'info',
      note: 'Weekly same day. Consistent timing improves tolerance.',
      source: 'Clinical protocol'
    }
  ],
  melanotan2: [
    {
      targetId: 'retatrutide',
      type: 'caution',
      severity: 'warning',
      note: 'Both suppress appetite. Monitor caloric intake carefully.',
      source: 'Clinical observation'
    }
  ],
  aod9604: [
    {
      targetId: 'semaglutide',
      type: 'synergy',
      severity: 'info',
      note: 'Complementary fat loss mechanisms. GH fragment + GLP-1.',
      source: 'Protocol stacking'
    },
    {
      targetId: 'tirzepatide',
      type: 'synergy',
      severity: 'info',
      note: 'Complementary fat loss mechanisms. GH fragment + GLP-1.',
      source: 'Protocol stacking'
    },
    {
      targetId: 'retatrutide',
      type: 'synergy',
      severity: 'info',
      note: 'Complementary fat loss mechanisms. GH fragment + GLP-1.',
      source: 'Protocol stacking'
    },
    {
      targetId: '_self',
      type: 'timing',
      severity: 'info',
      note: 'Must be taken fasted. Insulin blunts lipolytic effect.',
      source: 'Pharmacokinetics'
    }
  ],
  hgh: [
    {
      targetId: 'retatrutide',
      type: 'synergy',
      severity: 'warning',
      note: 'Powerful recomp but monitor blood glucose carefully.',
      source: 'Metabolic interaction'
    }
  ],

  // ── Hormonal ──
  test_cyp: [
    {
      targetId: 'kisspeptin',
      type: 'caution',
      severity: 'warning',
      note: 'TRT suppresses HPG axis. Kisspeptin less effective on TRT.',
      source: 'Endocrinology'
    },
    {
      targetId: 'hcg',
      type: 'synergy',
      severity: 'info',
      note: 'HCG maintains testicular function and fertility on TRT.',
      source: 'TRT protocol standard'
    },
    {
      targetId: 'enclomiphene',
      type: 'redundant',
      severity: 'warning',
      note: 'Enclomiphene for natural axis support only. Unnecessary on TRT.',
      source: 'Endocrinology'
    }
  ],
  test_enth: [
    {
      targetId: 'kisspeptin',
      type: 'caution',
      severity: 'warning',
      note: 'TRT suppresses HPG axis. Kisspeptin less effective on TRT.',
      source: 'Endocrinology'
    },
    {
      targetId: 'hcg',
      type: 'synergy',
      severity: 'info',
      note: 'HCG maintains testicular function and fertility on TRT.',
      source: 'TRT protocol standard'
    },
    {
      targetId: 'enclomiphene',
      type: 'redundant',
      severity: 'warning',
      note: 'Enclomiphene for natural axis support only. Unnecessary on TRT.',
      source: 'Endocrinology'
    }
  ],
  kisspeptin: [
    {
      targetId: 'kisspeptin',
      type: 'cycling',
      severity: 'warning',
      note: 'EOD dosing required to prevent receptor desensitization.',
      source: 'Receptor pharmacology'
    }
  ],
  gonadorelin: [
    {
      targetId: 'hcg',
      type: 'redundant',
      severity: 'warning',
      note: 'Both stimulate testosterone. Redundant without clinical guidance.',
      source: 'Endocrinology'
    }
  ],
  enclomiphene: [
    {
      targetId: 'kisspeptin',
      type: 'synergy',
      severity: 'info',
      note: 'Complementary HPG axis stimulation via different mechanisms.',
      source: 'Endocrinology'
    }
  ],

  // ── Cognitive ──
  semax: [
    {
      targetId: 'selank',
      type: 'synergy',
      severity: 'info',
      note: 'BDNF elevation + anxiolytic. Classic nootropic stack.',
      source: 'Russian clinical'
    },
    {
      targetId: 'cortagen',
      type: 'synergy',
      severity: 'info',
      note: 'Semax BDNF + Cortagen cortex restoration. Powerful cognitive stack.',
      source: 'Bioregulator protocol'
    }
  ],
  methylene_blue: [
    {
      targetId: 'selank',
      type: 'caution',
      severity: 'warning',
      note: 'Both affect serotonin pathways. Monitor mood carefully.',
      source: 'Pharmacology'
    }
  ],
  dihexa: [
    {
      targetId: 'dihexa',
      type: 'caution',
      severity: 'danger',
      note: 'Extremely potent. Start at lowest dose. HGF/c-Met pathway.',
      source: 'Safety protocol'
    }
  ],

  // ── Recovery ──
  bpc157: [
    {
      targetId: 'tb500',
      type: 'synergy',
      severity: 'info',
      note: 'Local + systemic healing. Gold standard recovery stack.',
      source: 'Protocol standard'
    }
  ],
  ghkcu: [
    {
      targetId: 'll37',
      type: 'synergy',
      severity: 'info',
      note: 'Collagen synthesis + antimicrobial regeneration. Skin healing.',
      source: 'Wound healing'
    }
  ],
  foxo4dri: [
    {
      targetId: 'bpc157',
      type: 'caution',
      severity: 'warning',
      note: 'BPC-157 promotes cell survival. May counteract senolytic effect. Space apart.',
      source: 'Mechanistic conflict'
    }
  ],

  // ── Metabolic ──
  nad_iv: [
    {
      targetId: 'nmn',
      type: 'redundant',
      severity: 'info',
      note: 'Both raise NAD+ levels. Choose one or alternate. Injectable more acute.',
      source: 'Biochemistry'
    },
    {
      targetId: 'amino1mq',
      type: 'synergy',
      severity: 'info',
      note: 'NNMT inhibition + NAD+ replenishment. Strong metabolic combination.',
      source: 'Biochemistry'
    }
  ],
  motsc: [
    {
      targetId: 'retatrutide',
      type: 'synergy',
      severity: 'info',
      note: 'MOTS-c insulin sensitivity + GLP-1 appetite suppression. Powerful metabolic combo.',
      source: 'Metabolic synergy'
    },
    {
      targetId: 'humanin',
      type: 'synergy',
      severity: 'info',
      note: 'Both mitochondrial-derived peptides. Complementary longevity stack.',
      source: 'Mitochondrial biology'
    }
  ],

  // ── Bioregulator Cycling ──
  thymalin: [
    {
      targetId: 'thymalin',
      type: 'cycling',
      severity: 'warning',
      note: 'Bioregulator protocol: 10 days on, 4-6 months off.',
      source: 'Khavinson protocol'
    },
    {
      targetId: 'thymosin_a1',
      type: 'synergy',
      severity: 'info',
      note: 'Both support thymic immune function via different mechanisms.',
      source: 'Immune protocol'
    }
  ],
  pinealon: [
    {
      targetId: 'pinealon',
      type: 'cycling',
      severity: 'warning',
      note: 'Bioregulator protocol: 10 days on, 4-6 months off.',
      source: 'Khavinson protocol'
    }
  ],
  cortagen: [
    {
      targetId: 'cortagen',
      type: 'cycling',
      severity: 'warning',
      note: 'Bioregulator protocol: 10 days on, 4-6 months off.',
      source: 'Khavinson protocol'
    }
  ],
  epithalon: [
    {
      targetId: 'epithalon',
      type: 'cycling',
      severity: 'warning',
      note: 'Bioregulator protocol: 10 days on, 4-6 months off.',
      source: 'Khavinson protocol'
    },
    {
      targetId: 'pinealon',
      type: 'synergy',
      severity: 'info',
      note: 'Both support pineal function. Classic anti-aging combination.',
      source: 'Khavinson protocol'
    }
  ],
  anastrozole: [
    {
      targetId: 'test_cyp',
      type: 'synergy',
      severity: 'info',
      note: 'AI controls estrogen on TRT. Only use if labs confirm elevated E2.',
      source: 'TRT protocol'
    },
    {
      targetId: 'enclomiphene',
      type: 'caution',
      severity: 'warning',
      note: 'AI + SERM is rarely needed. Different mechanisms — monitor E2 carefully.',
      source: 'Endocrinology'
    }
  ],
  dsip: [
    {
      targetId: 'selank',
      type: 'synergy',
      severity: 'info',
      note: 'DSIP sleep promotion + Selank anxiolytic. Complementary evening stack.',
      source: 'Peptide protocol'
    },
    {
      targetId: 'ipamorelin',
      type: 'synergy',
      severity: 'info',
      note: 'Both benefit from pre-bed dosing. DSIP may enhance nocturnal GH pulse.',
      source: 'Sleep/GH research'
    }
  ],
  klow_blend: [
    {
      targetId: 'bpc157',
      type: 'synergy',
      severity: 'info',
      note: 'KPV anti-inflammatory + BPC-157 tissue repair. Strong recovery combination.',
      source: 'Recovery protocol'
    }
  ],
  pt141: [
    {
      targetId: 'melanotan2',
      type: 'redundant',
      severity: 'warning',
      note: 'Both are melanocortin agonists. MT2 is longer acting. Do not combine.',
      source: 'Pharmacology'
    }
  ]
};

const GOAL_COMPOUNDS = {
  fat_loss: ['aod9604', 'retatrutide', 'semaglutide', 'tirzepatide', 'amino1mq'],
  recomp: ['aod9604', 'tesamorelin', 'ipamorelin', 'cjc_nodac', 'hgh', 'test_cyp'],
  performance: ['ipamorelin', 'cjc_nodac', 'bpc157', 'tb500', 'semax'],
  recovery: ['bpc157', 'tb500', 'ghkcu', 'kpv', 'll37'],
  cognitive: ['semax', 'selank', 'dihexa', 'cortagen', 'pinealon', 'methylene_blue'],
  longevity: ['epithalon', 'humanin', 'motsc', 'nad_iv', 'foxo4dri', 'thymalin'],
  health: ['epithalon', 'thymalin', 'bpc157', 'nad_iv', 'humanin', 'ghkcu']
};

export function analyzeStack(stack, lib) {
  const synergies = [];
  const warnings = [];
  const timingNotes = [];
  const cyclingRequired = [];

  const stackIds = stack
    .map((item) => {
      const libEntry = lib.find((l) => l.id === item.libId);
      return libEntry ? libEntry.id : null;
    })
    .filter(Boolean);

  const stackIdSet = new Set(stackIds);

  // Check each compound's rules against the stack
  for (const compoundId of stackIds) {
    const rules = COMPOUND_RULES[compoundId];
    if (!rules) continue;

    for (const rule of rules) {
      // Timing rules - apply to self
      if (rule.type === 'timing' && rule.targetId === '_self') {
        timingNotes.push({
          compoundId,
          note: rule.note,
          source: rule.source
        });
        continue;
      }

      // Cycling rules - apply to self
      if (rule.type === 'cycling' && rule.targetId === compoundId) {
        cyclingRequired.push({
          compoundId,
          note: rule.note,
          source: rule.source
        });
        continue;
      }

      // Caution rules that target self (like dihexa)
      if (rule.targetId === compoundId && rule.type === 'caution') {
        warnings.push({
          from: compoundId,
          to: compoundId,
          type: rule.type,
          severity: rule.severity,
          note: rule.note,
          source: rule.source
        });
        continue;
      }

      // Interaction rules - check if target is in stack
      if (rule.targetId !== '_self' && rule.targetId !== compoundId && stackIdSet.has(rule.targetId)) {
        const entry = {
          from: compoundId,
          to: rule.targetId,
          type: rule.type,
          severity: rule.severity,
          note: rule.note,
          source: rule.source
        };

        if (rule.type === 'synergy') {
          synergies.push(entry);
        } else {
          warnings.push(entry);
        }
      }
    }
  }

  // Calculate score
  let score = 70;
  const synergyBonus = Math.min(synergies.length * 5, 20);
  score += synergyBonus;

  for (const w of warnings) {
    if (w.severity === 'danger') {
      score -= 10;
    } else if (w.type === 'redundant') {
      score -= 3;
    } else {
      score -= 5;
    }
  }

  if (timingNotes.length > 0) {
    score += 3;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    synergies,
    warnings,
    timingNotes,
    cyclingRequired,
    score
  };
}

export function getCompoundInsights(compoundId, stack, lib) {
  const insights = [];

  const stackIds = stack
    .map((item) => {
      const libEntry = lib.find((l) => l.id === item.libId);
      return libEntry ? libEntry.id : null;
    })
    .filter(Boolean);

  const stackIdSet = new Set(stackIds);

  // Rules from this compound
  const rules = COMPOUND_RULES[compoundId];
  if (rules) {
    for (const rule of rules) {
      if (rule.targetId === '_self' || rule.targetId === compoundId) {
        insights.push({ ...rule, from: compoundId });
      } else if (stackIdSet.has(rule.targetId)) {
        insights.push({ ...rule, from: compoundId });
      }
    }
  }

  // Rules from other compounds targeting this one
  for (const otherId of stackIds) {
    if (otherId === compoundId) continue;
    const otherRules = COMPOUND_RULES[otherId];
    if (!otherRules) continue;

    for (const rule of otherRules) {
      if (rule.targetId === compoundId) {
        insights.push({ ...rule, from: otherId });
      }
    }
  }

  return insights;
}

export function getSuggestedAdditions(stack, lib, goal) {
  const candidates = GOAL_COMPOUNDS[goal];
  if (!candidates) return [];

  const stackIds = new Set(
    stack
      .map((item) => {
        const libEntry = lib.find((l) => l.id === item.libId);
        return libEntry ? libEntry.id : null;
      })
      .filter(Boolean)
  );

  const suggestions = [];

  for (const candidateId of candidates) {
    if (stackIds.has(candidateId)) continue;

    const libEntry = lib.find((l) => l.id === candidateId);
    if (!libEntry) continue;

    // Check for synergies with current stack
    let reason = null;

    // Check if candidate has synergy rules targeting stack items
    const candidateRules = COMPOUND_RULES[candidateId];
    if (candidateRules) {
      for (const rule of candidateRules) {
        if (rule.type === 'synergy' && stackIds.has(rule.targetId)) {
          reason = rule.note;
          break;
        }
      }
    }

    // Check if any stack item has synergy rules targeting candidate
    if (!reason) {
      for (const stackId of stackIds) {
        const stackRules = COMPOUND_RULES[stackId];
        if (!stackRules) continue;
        for (const rule of stackRules) {
          if (rule.type === 'synergy' && rule.targetId === candidateId) {
            reason = rule.note;
            break;
          }
        }
        if (reason) break;
      }
    }

    if (!reason) {
      reason = 'Recommended for ' + goal.replace('_', ' ') + ' protocols.';
    }

    suggestions.push({
      compound: libEntry,
      reason
    });

    if (suggestions.length >= 3) break;
  }

  return suggestions;
}
