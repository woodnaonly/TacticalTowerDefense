import { AchievementDefinition, EarnedAchievement, RunSummaryStats, TowerType } from './types';

const ACHIEVEMENTS_STORAGE_KEY = 'bastion_td_achievements_v1';

function onlyUsedTowerType(stats: RunSummaryStats, target: TowerType): boolean {
  if (stats.towersBuiltByType[target] <= 0) return false;
  return (Object.keys(stats.towersBuiltByType) as TowerType[]).every(
    (type) => type === target || stats.towersBuiltByType[type] === 0
  );
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'zero_damage',
    title: '铜墙铁壁',
    description: '能源核心零损伤通关',
    tone: 'emerald',
    icon: 'shield',
    check: (s) => s.outcome === 'victory' && s.lives === s.maxLives,
  },
  {
    id: 'frugal_commander',
    title: '精打细算',
    description: '总投入不超过 750 金币完成通关',
    tone: 'amber',
    icon: 'coins',
    check: (s) => s.outcome === 'victory' && s.totalGoldSpent <= 750,
  },
  {
    id: 'last_stand',
    title: '绝地反击',
    description: '核心耐久低于 3 点时惊险通关',
    tone: 'rose',
    icon: 'heart',
    check: (s) => s.outcome === 'victory' && s.lives > 0 && s.lives <= 3,
  },
  {
    id: 'gatling_specialist',
    title: '钢铁弹幕',
    description: '仅使用机枪哨塔守住至少 6 波进攻',
    tone: 'amber',
    icon: 'gatling',
    check: (s) => s.wave >= 6 && onlyUsedTowerType(s, 'gatling'),
  },
  {
    id: 'cryo_master',
    title: '绝对零度',
    description: '部署至少 3 座寒冰棱镜并抵达第 8 波',
    tone: 'sky',
    icon: 'cryo',
    check: (s) => s.towersBuiltByType.cryo >= 3 && s.wave >= 8,
  },
  {
    id: 'mortar_barrage',
    title: '重炮洗地',
    description: '单局重炮要塞累计伤害达到 4,000',
    tone: 'rose',
    icon: 'mortar',
    check: (s) => s.damageByType.mortar >= 4000,
  },
  {
    id: 'tesla_network',
    title: '雷霆矩阵',
    description: '单局电弧线圈累计伤害达到 4,000',
    tone: 'violet',
    icon: 'tesla',
    check: (s) => s.damageByType.tesla >= 4000,
  },
  {
    id: 'combined_arms',
    title: '协同防线',
    description: '单局内建造全部 4 种类型炮塔',
    tone: 'emerald',
    icon: 'layers',
    check: (s) =>
      s.towersBuiltByType.gatling > 0 &&
      s.towersBuiltByType.cryo > 0 &&
      s.towersBuiltByType.mortar > 0 &&
      s.towersBuiltByType.tesla > 0,
  },
  {
    id: 'max_upgrade',
    title: '终极改造',
    description: '将至少一座炮塔升级至 Lv.3',
    tone: 'amber',
    icon: 'upgrade',
    check: (s) => s.maxTowerLevelReached >= 3,
  },
  {
    id: 'colossus_slayer',
    title: '巨兽猎手',
    description: '单局内击毁至少 3 台攻城巨兽',
    tone: 'rose',
    icon: 'boss',
    check: (s) => s.bossesDefeated >= 3,
  },
  {
    id: 'early_caller',
    title: '疾风指挥官',
    description: '单局累计提前出波至少 4 次',
    tone: 'sky',
    icon: 'timer',
    check: (s) => s.earlyWavesSent >= 4,
  },
  {
    id: 'endurance_hero',
    title: '不朽堡垒',
    description: '老兵模式通关或无尽试炼达到第 15 波',
    tone: 'amber',
    icon: 'crown',
    check: (s) =>
      (s.difficulty === 'veteran' && s.outcome === 'victory') ||
      (s.difficulty === 'endless' && s.wave >= 15),
  },
];

export function loadUnlockedAchievementIds(): Set<string> {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((item): item is string => typeof item === 'string'));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

export function evaluateAndPersistAchievements(stats: RunSummaryStats): {
  earned: EarnedAchievement[];
  totalUnlockedCount: number;
} {
  const previouslyUnlocked = loadUnlockedAchievementIds();
  const nextUnlocked = new Set(previouslyUnlocked);
  const earned: EarnedAchievement[] = [];

  for (const def of ACHIEVEMENTS) {
    if (def.check(stats)) {
      const isNew = !previouslyUnlocked.has(def.id);
      nextUnlocked.add(def.id);
      earned.push({
        id: def.id,
        title: def.title,
        description: def.description,
        tone: def.tone,
        icon: def.icon,
        isNew,
      });
    }
  }

  // Sort newly unlocked badges first
  earned.sort((a, b) => Number(b.isNew) - Number(a.isNew));

  try {
    localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(Array.from(nextUnlocked)));
  } catch {
    // ignore storage quota errors
  }

  return {
    earned,
    totalUnlockedCount: nextUnlocked.size,
  };
}
