export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';

export type MapId = 'gorge' | 'twin_lanes' | 'spiral';

export type Difficulty = 'standard' | 'veteran' | 'endless';

export type TowerType = 'gatling' | 'cryo' | 'mortar' | 'tesla';

export type TargetingMode = 'first' | 'strongest' | 'weakest' | 'closest';

export type EnemyType = 'scout' | 'armored' | 'sprinter' | 'shielded' | 'colossus';

export interface GridPoint {
  c: number;
  r: number;
}

export interface TowerLevelStats {
  damage: number;
  range: number; // in grid tiles
  fireRate: number; // shots per second
  splashRadius?: number; // in grid tiles (mortar)
  slowFactor?: number; // e.g. 0.45 means 45% slow (cryo)
  slowDuration?: number; // seconds (cryo)
  chainCount?: number; // number of targets chained (tesla)
  upgradeCost?: number; // cost to reach next level
}

export interface TowerDefinition {
  type: TowerType;
  name: string;
  shortDesc: string;
  role: string;
  cost: number;
  hotkey: string;
  accentColor: string;
  levels: [TowerLevelStats, TowerLevelStats, TowerLevelStats];
}

export type SynergyId = 'cryo_mortar' | 'cryo_tesla' | 'mortar_gatling' | 'tesla_gatling';

export interface TowerSynergyDefinition {
  id: SynergyId;
  name: string;
  pair: [TowerType, TowerType];
  accentColor: string;
  summary: string;
  effectsByTower: Partial<Record<TowerType, string>>;
}

export interface EffectiveTowerStats {
  damage: number;
  range: number;
  fireRate: number;
  splashRadius: number;
  slowFactor: number;
  slowDuration: number;
  chainCount: number;
  activeSynergies: TowerSynergyDefinition[];
}

export interface EnemyDefinition {
  type: EnemyType;
  name: string;
  description: string;
  maxHp: number;
  maxShield: number;
  speed: number; // grid tiles per second
  reward: number;
  coreDamage: number;
  radius: number; // normalized fraction of tile size
  color: string;
}

export interface WaveGroup {
  type: EnemyType;
  count: number;
  interval: number; // seconds between spawns
  laneIndex?: number;
  delayAfter?: number; // pause after this group
}

export interface WaveDefinition {
  waveNumber: number;
  groups: WaveGroup[];
  clearBonus: number;
}

export interface MapConfig {
  id: MapId;
  name: string;
  subtitle: string;
  description: string;
  difficultyLabel: string;
  startingGold: number;
  startingLives: number;
  paths: GridPoint[][];
  blockedTiles: GridPoint[];
}

export interface TowerEntity {
  id: string;
  type: TowerType;
  c: number;
  r: number;
  level: 1 | 2 | 3;
  targeting: TargetingMode;
  angle: number; // radians
  cooldown: number;
  recoil: number; // 0..1 visual recoil
  totalDamage: number;
  kills: number;
  investedGold: number;
}

export interface EnemyEntity {
  id: string;
  type: EnemyType;
  pathIndex: number;
  waypointIndex: number;
  x: number; // grid coordinates (e.g. 4.5)
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  shieldRegenDelay: number;
  baseSpeed: number;
  slowFactor: number;
  slowTimer: number;
  distanceTraveled: number;
  reward: number;
  coreDamage: number;
  hitFlash: number;
}

export interface ProjectileEntity {
  id: string;
  towerType: TowerType;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetId: string;
  targetX: number;
  targetY: number;
  progress: number; // 0..1 for arcing mortar, or speed-based for bullet
  speed: number; // tiles per second
  damage: number;
  splashRadius: number;
  slowFactor: number;
  slowDuration: number;
  sourceTowerId: string;
}

export interface LightningArc {
  points: { x: number; y: number }[];
  life: number;
  maxLife: number;
}

export type ParticleKind = 'dot' | 'ring' | 'shard';

export interface ParticleEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  ring?: boolean;
  kind?: ParticleKind;
  angle?: number;
  angularVelocity?: number;
  drag?: number;
  lineWidth?: number;
}

export interface TowerSellAnimation {
  type: TowerType;
  c: number;
  r: number;
  level: 1 | 2 | 3;
  angle: number;
  life: number;
  maxLife: number;
}

export interface FloatingTextEntity {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export type WeatherType = 'clear' | 'sandstorm' | 'thunderstorm' | 'blizzard' | 'tailwind';

export interface WeatherDefinition {
  type: WeatherType;
  name: string;
  effectText: string;
  shortEffect: string;
  accentColor: string;
  minDuration: number;
  maxDuration: number;
}

export interface WeatherSnapshot {
  type: WeatherType;
  remaining: number;
  duration: number;
}

export interface HudSnapshot {
  gold: number;
  lives: number;
  maxLives: number;
  wave: number;
  totalWaves: number;
  score: number;
  waveActive: boolean;
  waveCountdown: number;
  enemiesRemaining: number;
  waveTotalEnemies: number;
  enemiesDefeated: number;
  towersBuilt: number;
  weather: WeatherSnapshot;
}

export type AchievementTone = 'amber' | 'emerald' | 'sky' | 'rose' | 'violet';

export type AchievementIconKey =
  | 'shield'
  | 'coins'
  | 'gatling'
  | 'cryo'
  | 'mortar'
  | 'tesla'
  | 'layers'
  | 'upgrade'
  | 'boss'
  | 'crown'
  | 'timer'
  | 'heart';

export interface RunSummaryStats {
  outcome: 'none' | 'victory' | 'gameover';
  difficulty: Difficulty;
  wave: number;
  lives: number;
  maxLives: number;
  totalGoldSpent: number;
  towersBuilt: number;
  towersBuiltByType: Record<TowerType, number>;
  damageByType: Record<TowerType, number>;
  maxTowerLevelReached: number;
  earlyWavesSent: number;
  bossesDefeated: number;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  tone: AchievementTone;
  icon: AchievementIconKey;
  check: (stats: RunSummaryStats) => boolean;
}

export interface EarnedAchievement {
  id: string;
  title: string;
  description: string;
  tone: AchievementTone;
  icon: AchievementIconKey;
  isNew: boolean;
}
