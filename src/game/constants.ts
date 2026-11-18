import {
  Difficulty,
  EnemyDefinition,
  EnemyType,
  GridPoint,
  MapConfig,
  MapId,
  TargetingMode,
  TowerDefinition,
  TowerSynergyDefinition,
  TowerType,
  WaveDefinition,
  WaveGroup,
  WeatherDefinition,
  WeatherType,
} from './types';

export const GRID_COLS = 16;
export const GRID_ROWS = 9;

export const DIFFICULTIES: Record<
  Difficulty,
  {
    id: Difficulty;
    name: string;
    description: string;
    hpMultiplier: number;
    goldMultiplier: number;
    totalWaves: number; // 0 = endless
  }
> = {
  standard: {
    id: 'standard',
    name: '标准防线',
    description: '12 波战术攻防，适合熟悉炮塔搭配与地形节奏。',
    hpMultiplier: 1.0,
    goldMultiplier: 1.0,
    totalWaves: 12,
  },
  veteran: {
    id: 'veteran',
    name: '老兵模式',
    description: '15 波高强度进攻，敌方生命值 +30%，考验经济与升级时机。',
    hpMultiplier: 1.3,
    goldMultiplier: 0.92,
    totalWaves: 15,
  },
  endless: {
    id: 'endless',
    name: '无尽试炼',
    description: '无限波次递增强化，挑战你的防线极限与最高得分。',
    hpMultiplier: 1.05,
    goldMultiplier: 1.0,
    totalWaves: 0,
  },
};

export const TARGETING_LABELS: Record<TargetingMode, string> = {
  first: '优先最前',
  strongest: '血量最高',
  weakest: '血量最低',
  closest: '距离最近',
};

export const TOWERS: Record<TowerType, TowerDefinition> = {
  gatling: {
    type: 'gatling',
    name: '机枪哨塔',
    shortDesc: '高射速单体动能点射',
    role: '高频单体输出',
    cost: 60,
    hotkey: '1',
    accentColor: '#F59E0B',
    levels: [
      { damage: 16, range: 2.8, fireRate: 3.4, upgradeCost: 55 },
      { damage: 26, range: 3.1, fireRate: 4.3, upgradeCost: 95 },
      { damage: 42, range: 3.5, fireRate: 5.4 },
    ],
  },
  cryo: {
    type: 'cryo',
    name: '寒冰棱镜',
    shortDesc: '脉冲减速并附带冰霜伤害',
    role: '范围减速控制',
    cost: 85,
    hotkey: '2',
    accentColor: '#38BDF8',
    levels: [
      { damage: 12, range: 2.4, fireRate: 1.15, splashRadius: 1.35, slowFactor: 0.42, slowDuration: 2.2, upgradeCost: 75 },
      { damage: 20, range: 2.7, fireRate: 1.35, splashRadius: 1.6, slowFactor: 0.52, slowDuration: 2.8, upgradeCost: 120 },
      { damage: 32, range: 3.0, fireRate: 1.6, splashRadius: 1.9, slowFactor: 0.62, slowDuration: 3.4 },
    ],
  },
  mortar: {
    type: 'mortar',
    name: '重炮要塞',
    shortDesc: '远程抛射榴弹造成溅射爆炸',
    role: '重型范围爆破',
    cost: 120,
    hotkey: '3',
    accentColor: '#FB7185',
    levels: [
      { damage: 58, range: 3.8, fireRate: 0.62, splashRadius: 1.15, upgradeCost: 105 },
      { damage: 95, range: 4.2, fireRate: 0.72, splashRadius: 1.4, upgradeCost: 170 },
      { damage: 155, range: 4.7, fireRate: 0.85, splashRadius: 1.7 },
    ],
  },
  tesla: {
    type: 'tesla',
    name: '电弧线圈',
    shortDesc: '链式闪电穿透护盾与多目标',
    role: '破盾连锁伤害',
    cost: 155,
    hotkey: '4',
    accentColor: '#A78BFA',
    levels: [
      { damage: 40, range: 2.6, fireRate: 1.2, chainCount: 3, upgradeCost: 135 },
      { damage: 66, range: 2.9, fireRate: 1.35, chainCount: 4, upgradeCost: 210 },
      { damage: 105, range: 3.2, fireRate: 1.55, chainCount: 5 },
    ],
  },
};

export const TOWER_LIST: TowerDefinition[] = [
  TOWERS.gatling,
  TOWERS.cryo,
  TOWERS.mortar,
  TOWERS.tesla,
];

export const TOWER_SYNERGIES: TowerSynergyDefinition[] = [
  {
    id: 'cryo_mortar',
    name: '低温破片',
    pair: ['cryo', 'mortar'],
    accentColor: '#38BDF8',
    summary: '寒冰棱镜与重炮要塞相邻部署，冰霜聚怪配合大口径破片冲击。',
    effectsByTower: {
      cryo: '减速效果 +10%',
      mortar: '溅射范围 +0.45 格 · 伤害 +12%',
    },
  },
  {
    id: 'cryo_tesla',
    name: '超导冰域',
    pair: ['cryo', 'tesla'],
    accentColor: '#A78BFA',
    summary: '寒冰棱镜与电弧线圈相邻部署，低温导流强化冰霜覆盖与电弧跳跃。',
    effectsByTower: {
      cryo: '减速效果 +15% · 冰霜范围 +0.3 格',
      tesla: '连锁目标 +1',
    },
  },
  {
    id: 'mortar_gatling',
    name: '弹幕压制',
    pair: ['mortar', 'gatling'],
    accentColor: '#FB7185',
    summary: '重炮要塞与机枪哨塔相邻部署，共享弹药装填与校射指引。',
    effectsByTower: {
      mortar: '攻速 +20% · 溅射范围 +0.3 格',
      gatling: '攻速 +18%',
    },
  },
  {
    id: 'tesla_gatling',
    name: '电磁增幅',
    pair: ['tesla', 'gatling'],
    accentColor: '#F59E0B',
    summary: '电弧线圈与机枪哨塔相邻部署，高压线圈赋能射控雷达与动能弹丸。',
    effectsByTower: {
      tesla: '电弧伤害 +18%',
      gatling: '伤害 +22% · 射程 +0.35 格',
    },
  },
];

export const WEATHER_DEFINITIONS: Record<WeatherType, WeatherDefinition> = {
  clear: {
    type: 'clear',
    name: '晴朗',
    effectText: '全图视野清晰 · 炮塔按标准参数运行',
    shortEffect: '标准气象',
    accentColor: '#94A3B8',
    minDuration: 0,
    maxDuration: 0,
  },
  sandstorm: {
    type: 'sandstorm',
    name: '沙尘暴',
    effectText: '能见度骤降 · 全图炮塔射程 -18%',
    shortEffect: '全图射程 -18%',
    accentColor: '#F59E0B',
    minDuration: 28,
    maxDuration: 38,
  },
  thunderstorm: {
    type: 'thunderstorm',
    name: '雷暴',
    effectText: '大气电离充能 · 电弧线圈伤害 +25% 攻速 +15%',
    shortEffect: '电弧威力 +25%',
    accentColor: '#A78BFA',
    minDuration: 30,
    maxDuration: 42,
  },
  blizzard: {
    type: 'blizzard',
    name: '暴雪',
    effectText: '寒冰棱镜减速持久 +35% · 敌军移速 -8%',
    shortEffect: '冰霜强化 · 敌缓速',
    accentColor: '#38BDF8',
    minDuration: 28,
    maxDuration: 40,
  },
  tailwind: {
    type: 'tailwind',
    name: '强风',
    effectText: '高空顺风弹道 · 机枪与重炮攻速 +15%',
    shortEffect: '动能/火炮攻速 +15%',
    accentColor: '#34D399',
    minDuration: 28,
    maxDuration: 38,
  },
};

export const DYNAMIC_WEATHER_POOL: WeatherType[] = [
  'sandstorm',
  'thunderstorm',
  'blizzard',
  'tailwind',
];

export const ENEMIES: Record<EnemyType, EnemyDefinition> = {
  scout: {
    type: 'scout',
    name: '斥候无人机',
    description: '轻型侦察单位，移动稳定，成群推进。',
    maxHp: 65,
    maxShield: 0,
    speed: 1.75,
    reward: 10,
    coreDamage: 1,
    radius: 0.24,
    color: '#FBBF24',
  },
  sprinter: {
    type: 'sprinter',
    name: '疾风突袭者',
    description: '高速突防单位，需要寒冰棱镜或高射速机枪拦截。',
    maxHp: 52,
    maxShield: 0,
    speed: 2.7,
    reward: 11,
    coreDamage: 1,
    radius: 0.21,
    color: '#34D399',
  },
  armored: {
    type: 'armored',
    name: '装甲履带车',
    description: '厚重装甲单位，移动缓慢但生命值极高。',
    maxHp: 230,
    maxShield: 0,
    speed: 0.95,
    reward: 20,
    coreDamage: 2,
    radius: 0.31,
    color: '#F97316',
  },
  shielded: {
    type: 'shielded',
    name: '能量护盾兵',
    description: '配备可再生能量护盾，电弧线圈可造成双倍破盾伤害。',
    maxHp: 130,
    maxShield: 110,
    speed: 1.35,
    reward: 22,
    coreDamage: 2,
    radius: 0.27,
    color: '#60A5FA',
  },
  colossus: {
    type: 'colossus',
    name: '攻城巨兽',
    description: '高威胁首领单位，突破防线会造成巨大核心损伤。',
    maxHp: 1150,
    maxShield: 240,
    speed: 0.68,
    reward: 95,
    coreDamage: 5,
    radius: 0.4,
    color: '#EF4444',
  },
};

export const MAPS: MapConfig[] = [
  {
    id: 'gorge',
    name: '回旋隘口',
    subtitle: '单线迂回地形',
    description: '敌军沿多层折返峡谷推进，中央高地可实现跨通道交叉火力覆盖。',
    difficultyLabel: '入门推荐',
    startingGold: 220,
    startingLives: 20,
    paths: [
      [
        { c: 0, r: 1 },
        { c: 4, r: 1 },
        { c: 4, r: 6 },
        { c: 8, r: 6 },
        { c: 8, r: 2 },
        { c: 12, r: 2 },
        { c: 12, r: 7 },
        { c: 15, r: 7 },
      ],
    ],
    blockedTiles: [
      { c: 2, r: 3 },
      { c: 2, r: 4 },
      { c: 6, r: 3 },
      { c: 10, r: 4 },
      { c: 14, r: 4 },
    ],
  },
  {
    id: 'twin_lanes',
    name: '双线夹击',
    subtitle: '双通道合流防线',
    description: '南北两条通道在中部汇合，前期需兼顾分路拦截与合流点重火力布防。',
    difficultyLabel: '战术进阶',
    startingGold: 250,
    startingLives: 20,
    paths: [
      [
        { c: 0, r: 1 },
        { c: 5, r: 1 },
        { c: 5, r: 4 },
        { c: 15, r: 4 },
      ],
      [
        { c: 0, r: 7 },
        { c: 5, r: 7 },
        { c: 5, r: 4 },
        { c: 15, r: 4 },
      ],
    ],
    blockedTiles: [
      { c: 3, r: 4 },
      { c: 8, r: 2 },
      { c: 8, r: 6 },
      { c: 13, r: 2 },
      { c: 13, r: 6 },
    ],
  },
  {
    id: 'spiral',
    name: '核心迷宫',
    subtitle: '螺旋内环防线',
    description: '敌军从外围盘旋逼近中央能源核心，内环狭长走廊极具溅射与连锁潜力。',
    difficultyLabel: '高难挑战',
    startingGold: 240,
    startingLives: 18,
    paths: [
      [
        { c: 0, r: 1 },
        { c: 14, r: 1 },
        { c: 14, r: 7 },
        { c: 2, r: 7 },
        { c: 2, r: 3 },
        { c: 11, r: 3 },
        { c: 11, r: 5 },
        { c: 7, r: 5 },
      ],
    ],
    blockedTiles: [
      { c: 1, r: 4 },
      { c: 12, r: 4 },
      { c: 0, r: 8 },
      { c: 15, r: 0 },
    ],
  },
];

export function getMapById(id: MapId): MapConfig {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}

export function buildPathTilesSet(paths: GridPoint[][]): Set<string> {
  const set = new Set<string>();
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const dc = Math.sign(b.c - a.c);
      const dr = Math.sign(b.r - a.r);
      let c = a.c;
      let r = a.r;
      set.add(`${c},${r}`);
      while (c !== b.c || r !== b.r) {
        c += dc;
        r += dr;
        set.add(`${c},${r}`);
      }
    }
  }
  return set;
}

const PRESET_WAVES: WaveDefinition[] = [
  {
    waveNumber: 1,
    groups: [{ type: 'scout', count: 8, interval: 0.9 }],
    clearBonus: 30,
  },
  {
    waveNumber: 2,
    groups: [
      { type: 'scout', count: 8, interval: 0.8 },
      { type: 'sprinter', count: 4, interval: 0.75, delayAfter: 1.0 },
    ],
    clearBonus: 35,
  },
  {
    waveNumber: 3,
    groups: [
      { type: 'scout', count: 6, interval: 0.75 },
      { type: 'armored', count: 3, interval: 1.5 },
    ],
    clearBonus: 40,
  },
  {
    waveNumber: 4,
    groups: [
      { type: 'sprinter', count: 10, interval: 0.55 },
      { type: 'armored', count: 4, interval: 1.35 },
    ],
    clearBonus: 45,
  },
  {
    waveNumber: 5,
    groups: [
      { type: 'scout', count: 8, interval: 0.6 },
      { type: 'shielded', count: 4, interval: 1.2 },
      { type: 'colossus', count: 1, interval: 1.5 },
    ],
    clearBonus: 70,
  },
  {
    waveNumber: 6,
    groups: [
      { type: 'shielded', count: 7, interval: 0.95 },
      { type: 'sprinter', count: 10, interval: 0.5 },
    ],
    clearBonus: 55,
  },
  {
    waveNumber: 7,
    groups: [
      { type: 'armored', count: 8, interval: 1.1 },
      { type: 'shielded', count: 6, interval: 0.95 },
    ],
    clearBonus: 65,
  },
  {
    waveNumber: 8,
    groups: [
      { type: 'sprinter', count: 16, interval: 0.42 },
      { type: 'armored', count: 6, interval: 1.0 },
      { type: 'shielded', count: 6, interval: 0.9 },
    ],
    clearBonus: 75,
  },
  {
    waveNumber: 9,
    groups: [
      { type: 'armored', count: 10, interval: 0.95 },
      { type: 'shielded', count: 8, interval: 0.85 },
    ],
    clearBonus: 85,
  },
  {
    waveNumber: 10,
    groups: [
      { type: 'sprinter', count: 14, interval: 0.45 },
      { type: 'shielded', count: 8, interval: 0.8 },
      { type: 'colossus', count: 2, interval: 3.2 },
    ],
    clearBonus: 110,
  },
  {
    waveNumber: 11,
    groups: [
      { type: 'armored', count: 12, interval: 0.85 },
      { type: 'shielded', count: 10, interval: 0.75 },
      { type: 'sprinter', count: 15, interval: 0.38 },
    ],
    clearBonus: 115,
  },
  {
    waveNumber: 12,
    groups: [
      { type: 'shielded', count: 10, interval: 0.7 },
      { type: 'armored', count: 10, interval: 0.8 },
      { type: 'colossus', count: 3, interval: 2.6 },
    ],
    clearBonus: 150,
  },
];

export function getWaveDefinition(waveNumber: number): WaveDefinition {
  if (waveNumber <= PRESET_WAVES.length) {
    return PRESET_WAVES[waveNumber - 1];
  }

  // Procedural scaling for Veteran (13-15) and Endless (13+)
  const extra = waveNumber - PRESET_WAVES.length;
  const groups: WaveGroup[] = [
    {
      type: 'sprinter',
      count: Math.min(28, 12 + extra * 2),
      interval: Math.max(0.26, 0.45 - extra * 0.015),
    },
    {
      type: 'armored',
      count: Math.min(24, 8 + Math.floor(extra * 1.5)),
      interval: Math.max(0.55, 0.85 - extra * 0.02),
    },
    {
      type: 'shielded',
      count: Math.min(22, 8 + Math.floor(extra * 1.4)),
      interval: Math.max(0.5, 0.75 - extra * 0.02),
    },
  ];

  if (waveNumber % 2 === 0 || waveNumber >= 15) {
    groups.push({
      type: 'colossus',
      count: Math.min(6, 1 + Math.floor(extra / 2)),
      interval: 2.2,
    });
  }

  return {
    waveNumber,
    groups,
    clearBonus: 120 + extra * 20,
  };
}

export function getWaveHpMultiplier(waveNumber: number, difficulty: Difficulty): number {
  const base = DIFFICULTIES[difficulty].hpMultiplier;
  if (waveNumber <= 12) {
    return base * (1 + (waveNumber - 1) * 0.07);
  }
  const extra = waveNumber - 12;
  return base * (1.77 * Math.pow(1.14, extra));
}

export function getWaveBossCount(waveNumber: number): number {
  if (waveNumber < 1) return 0;
  const def = getWaveDefinition(waveNumber);
  return def.groups.reduce(
    (sum, g) => (g.type === 'colossus' ? sum + g.count : sum),
    0
  );
}

export function isBossWave(waveNumber: number): boolean {
  return getWaveBossCount(waveNumber) > 0;
}
