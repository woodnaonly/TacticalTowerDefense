import {
  buildPathTilesSet,
  DIFFICULTIES,
  DYNAMIC_WEATHER_POOL,
  ENEMIES,
  getMapById,
  getWaveDefinition,
  getWaveHpMultiplier,
  GRID_COLS,
  GRID_ROWS,
  TOWER_SYNERGIES,
  TOWERS,
  WEATHER_DEFINITIONS,
} from './constants';
import { ParticleManager } from './particles';
import { sound } from './sound';
import { getColossusSpriteCanvas, getTowerSpriteCanvas, preloadGameSprites } from './sprites';
import {
  Difficulty,
  EffectiveTowerStats,
  EnemyEntity,
  EnemyType,
  FloatingTextEntity,
  GridPoint,
  HudSnapshot,
  LightningArc,
  MapConfig,
  MapId,
  ProjectileEntity,
  SynergyId,
  TargetingMode,
  TowerEntity,
  TowerSynergyDefinition,
  TowerType,
  WeatherSnapshot,
  WeatherType,
} from './types';

interface ScheduledSpawn {
  timeOffset: number;
  type: EnemyType;
  pathIndex: number;
}

export interface SimulationState {
  map: MapConfig;
  difficulty: Difficulty;
  pathTiles: Set<string>;
  blockedSet: Set<string>;
  gold: number;
  lives: number;
  maxLives: number;
  wave: number;
  totalWaves: number;
  score: number;
  waveActive: boolean;
  waveCountdown: number;
  waveElapsed: number;
  waveTotalEnemies: number;
  spawnQueue: ScheduledSpawn[];
  towers: TowerEntity[];
  enemies: EnemyEntity[];
  projectiles: ProjectileEntity[];
  lightningArcs: LightningArc[];
  particleManager: ParticleManager;
  floatingTexts: FloatingTextEntity[];
  enemiesDefeated: number;
  towersBuilt: number;
  totalGoldSpent: number;
  towersBuiltByType: Record<TowerType, number>;
  damageByType: Record<TowerType, number>;
  maxTowerLevelReached: number;
  earlyWavesSent: number;
  bossesDefeated: number;
  weather: WeatherSnapshot;
  corePulse: number;
  time: number;
  nextId: number;
  outcome: 'none' | 'victory' | 'gameover';
}

export function createSimulation(mapId: MapId, difficulty: Difficulty): SimulationState {
  preloadGameSprites();
  const map = getMapById(mapId);
  const diff = DIFFICULTIES[difficulty];
  const pathTiles = buildPathTilesSet(map.paths);
  const blockedSet = new Set(map.blockedTiles.map((p) => `${p.c},${p.r}`));

  return {
    map,
    difficulty,
    pathTiles,
    blockedSet,
    gold: map.startingGold,
    lives: map.startingLives,
    maxLives: map.startingLives,
    wave: 0,
    totalWaves: diff.totalWaves,
    score: 0,
    waveActive: false,
    waveCountdown: 0,
    waveElapsed: 0,
    waveTotalEnemies: 0,
    spawnQueue: [],
    towers: [],
    enemies: [],
    projectiles: [],
    lightningArcs: [],
    particleManager: new ParticleManager(),
    floatingTexts: [],
    enemiesDefeated: 0,
    towersBuilt: 0,
    totalGoldSpent: 0,
    towersBuiltByType: { gatling: 0, cryo: 0, mortar: 0, tesla: 0 },
    damageByType: { gatling: 0, cryo: 0, mortar: 0, tesla: 0 },
    maxTowerLevelReached: 0,
    earlyWavesSent: 0,
    bossesDefeated: 0,
    weather: { type: 'clear', remaining: 0, duration: 0 },
    corePulse: 0,
    time: 0,
    nextId: 1,
    outcome: 'none',
  };
}

export function getRunSummaryStats(sim: SimulationState) {
  return {
    outcome: sim.outcome,
    difficulty: sim.difficulty,
    wave: sim.wave,
    lives: sim.lives,
    maxLives: sim.maxLives,
    totalGoldSpent: sim.totalGoldSpent,
    towersBuilt: sim.towersBuilt,
    towersBuiltByType: { ...sim.towersBuiltByType },
    damageByType: { ...sim.damageByType },
    maxTowerLevelReached: sim.maxTowerLevelReached,
    earlyWavesSent: sim.earlyWavesSent,
    bossesDefeated: sim.bossesDefeated,
  };
}

export function getHudSnapshot(sim: SimulationState): HudSnapshot {
  return {
    gold: sim.gold,
    lives: sim.lives,
    maxLives: sim.maxLives,
    wave: sim.wave,
    totalWaves: sim.totalWaves,
    score: sim.score,
    waveActive: sim.waveActive,
    waveCountdown: sim.waveCountdown,
    enemiesRemaining: sim.enemies.length + sim.spawnQueue.length,
    waveTotalEnemies: sim.waveTotalEnemies,
    enemiesDefeated: sim.enemiesDefeated,
    towersBuilt: sim.towersBuilt,
    weather: { ...sim.weather },
  };
}

export function canPlaceTower(sim: SimulationState, c: number, r: number): boolean {
  if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return false;
  const key = `${c},${r}`;
  if (sim.pathTiles.has(key)) return false;
  if (sim.blockedSet.has(key)) return false;
  if (sim.towers.some((t) => t.c === c && t.r === r)) return false;
  return true;
}

export function areTowersAdjacent(
  a: { c: number; r: number },
  b: { c: number; r: number }
): boolean {
  return Math.abs(a.c - b.c) <= 1 && Math.abs(a.r - b.r) <= 1 && !(a.c === b.c && a.r === b.r);
}

export function findMatchingSynergy(
  typeA: TowerType,
  typeB: TowerType
): TowerSynergyDefinition | null {
  if (typeA === typeB) return null;
  for (const syn of TOWER_SYNERGIES) {
    if (
      (syn.pair[0] === typeA && syn.pair[1] === typeB) ||
      (syn.pair[0] === typeB && syn.pair[1] === typeA)
    ) {
      return syn;
    }
  }
  return null;
}

export function getEffectiveTowerStats(
  towers: TowerEntity[],
  tower: TowerEntity,
  weather: WeatherType = 'clear'
): EffectiveTowerStats {
  const base = TOWERS[tower.type].levels[tower.level - 1];
  let damage = base.damage;
  let range = base.range;
  let fireRate = base.fireRate;
  let splashRadius = base.splashRadius ?? 0;
  let slowFactor = base.slowFactor ?? 0;
  let slowDuration = base.slowDuration ?? 0;
  let chainCount = base.chainCount ?? 0;

  const activeMap = new Map<SynergyId, TowerSynergyDefinition>();
  for (const other of towers) {
    if (other.id === tower.id) continue;
    if (!areTowersAdjacent(tower, other)) continue;
    const syn = findMatchingSynergy(tower.type, other.type);
    if (syn && !activeMap.has(syn.id)) {
      activeMap.set(syn.id, syn);
    }
  }

  for (const syn of activeMap.values()) {
    if (syn.id === 'cryo_mortar') {
      if (tower.type === 'cryo') {
        slowFactor = Math.min(0.85, Number((slowFactor + 0.1).toFixed(2)));
      } else if (tower.type === 'mortar') {
        splashRadius = Number((splashRadius + 0.45).toFixed(2));
        damage = Math.round(damage * 1.12);
      }
    } else if (syn.id === 'cryo_tesla') {
      if (tower.type === 'cryo') {
        slowFactor = Math.min(0.85, Number((slowFactor + 0.15).toFixed(2)));
        splashRadius = Number((splashRadius + 0.3).toFixed(2));
      } else if (tower.type === 'tesla') {
        chainCount += 1;
      }
    } else if (syn.id === 'mortar_gatling') {
      if (tower.type === 'mortar') {
        fireRate = Number((fireRate * 1.2).toFixed(2));
        splashRadius = Number((splashRadius + 0.3).toFixed(2));
      } else if (tower.type === 'gatling') {
        fireRate = Number((fireRate * 1.18).toFixed(2));
      }
    } else if (syn.id === 'tesla_gatling') {
      if (tower.type === 'tesla') {
        damage = Math.round(damage * 1.18);
      } else if (tower.type === 'gatling') {
        damage = Math.round(damage * 1.22);
        range = Number((range + 0.35).toFixed(2));
      }
    }
  }

  // Global dynamic weather modifiers
  if (weather === 'sandstorm') {
    range = Number((range * 0.82).toFixed(2));
  } else if (weather === 'thunderstorm' && tower.type === 'tesla') {
    damage = Math.round(damage * 1.25);
    fireRate = Number((fireRate * 1.15).toFixed(2));
  } else if (weather === 'blizzard' && tower.type === 'cryo') {
    slowFactor = Math.min(0.85, Number((slowFactor + 0.1).toFixed(2)));
    slowDuration = Number((slowDuration * 1.35).toFixed(2));
  } else if (weather === 'tailwind' && (tower.type === 'gatling' || tower.type === 'mortar')) {
    fireRate = Number((fireRate * 1.15).toFixed(2));
  }

  return {
    damage,
    range,
    fireRate,
    splashRadius,
    slowFactor,
    slowDuration,
    chainCount,
    activeSynergies: Array.from(activeMap.values()),
  };
}

export function placeTower(
  sim: SimulationState,
  type: TowerType,
  c: number,
  r: number
): TowerEntity | null {
  const def = TOWERS[type];
  if (sim.gold < def.cost) return null;
  if (!canPlaceTower(sim, c, r)) return null;

  sim.gold -= def.cost;
  sim.totalGoldSpent += def.cost;
  sim.towersBuilt += 1;
  sim.towersBuiltByType[type] += 1;
  sim.maxTowerLevelReached = Math.max(sim.maxTowerLevelReached, 1);

  const tower: TowerEntity = {
    id: `tw_${sim.nextId++}`,
    type,
    c,
    r,
    level: 1,
    targeting: 'first',
    angle: -Math.PI / 2,
    cooldown: 0.15,
    recoil: 0,
    totalDamage: 0,
    kills: 0,
    investedGold: def.cost,
  };
  sim.towers.push(tower);

  // Notify newly formed adjacent synergies
  const triggered = new Set<string>();
  for (const other of sim.towers) {
    if (other.id === tower.id || !areTowersAdjacent(tower, other)) continue;
    const syn = findMatchingSynergy(tower.type, other.type);
    if (syn && !triggered.has(syn.id)) {
      triggered.add(syn.id);
      sim.floatingTexts.push({
        x: c + 0.5,
        y: r + 0.15 - (triggered.size - 1) * 0.32,
        vy: -0.55,
        text: `协同: ${syn.name}`,
        color: syn.accentColor,
        life: 1.25,
        maxLife: 1.25,
      });
    }
  }

  sim.particleManager.spawnBurst(c + 0.5, r + 0.5, def.accentColor, 10, 1.4);
  sound.playPlace();
  return tower;
}

export function upgradeTower(sim: SimulationState, towerId: string): boolean {
  const tower = sim.towers.find((t) => t.id === towerId);
  if (!tower || tower.level >= 3) return false;
  const def = TOWERS[tower.type];
  const currentStats = def.levels[tower.level - 1];
  const cost = currentStats.upgradeCost;
  if (!cost || sim.gold < cost) return false;

  sim.gold -= cost;
  sim.totalGoldSpent += cost;
  tower.investedGold += cost;
  tower.level = (tower.level + 1) as 1 | 2 | 3;
  sim.maxTowerLevelReached = Math.max(sim.maxTowerLevelReached, tower.level);
  sim.particleManager.spawnBurst(tower.c + 0.5, tower.r + 0.5, '#FBBF24', 14, 1.8);
  sim.floatingTexts.push({
    x: tower.c + 0.5,
    y: tower.r + 0.25,
    vy: -0.7,
    text: `Lv.${tower.level}`,
    color: '#FBBF24',
    life: 0.9,
    maxLife: 0.9,
  });
  sound.playUpgrade();
  return true;
}

export function getTowerSellValue(tower: TowerEntity): number {
  return Math.round(tower.investedGold * 0.72);
}

export function sellTower(sim: SimulationState, towerId: string): boolean {
  const idx = sim.towers.findIndex((t) => t.id === towerId);
  if (idx === -1) return false;
  const tower = sim.towers[idx];
  const refund = getTowerSellValue(tower);
  sim.gold += refund;
  sim.towers.splice(idx, 1);

  sim.particleManager.spawnTowerSell(tower);
  sim.floatingTexts.push({
    x: tower.c + 0.5,
    y: tower.r + 0.3,
    vy: -0.7,
    text: `+${refund}`,
    color: '#F59E0B',
    life: 0.9,
    maxLife: 0.9,
  });
  sound.playSell();
  return true;
}

export function setTowerTargeting(
  sim: SimulationState,
  towerId: string,
  targeting: TargetingMode
): void {
  const tower = sim.towers.find((t) => t.id === towerId);
  if (tower) {
    tower.targeting = targeting;
  }
}

export function startNextWave(sim: SimulationState): boolean {
  if (sim.outcome !== 'none' || sim.waveActive) return false;
  if (sim.totalWaves > 0 && sim.wave >= sim.totalWaves) return false;

  // Early send bonus when countdown is active between waves
  if (sim.wave > 0 && sim.waveCountdown > 0.5) {
    const bonus = Math.max(5, Math.round(sim.waveCountdown * 2.5));
    sim.gold += bonus;
    sim.score += bonus * 2;
    sim.earlyWavesSent += 1;
    const entry = sim.map.paths[0][0];
    sim.floatingTexts.push({
      x: entry.c + 0.7,
      y: entry.r + 0.4,
      vy: -0.6,
      text: `提前出波 +${bonus}`,
      color: '#10B981',
      life: 1.2,
      maxLife: 1.2,
    });
  }

  sim.wave += 1;
  sim.waveActive = true;
  sim.waveCountdown = 0;
  sim.waveElapsed = 0;

  const waveDef = getWaveDefinition(sim.wave);
  const queue: ScheduledSpawn[] = [];
  let cursor = 0.25;
  let laneRoundRobin = 0;
  const numPaths = sim.map.paths.length;

  for (const group of waveDef.groups) {
    for (let i = 0; i < group.count; i++) {
      const pathIndex =
        group.laneIndex !== undefined
          ? group.laneIndex % numPaths
          : laneRoundRobin % numPaths;
      laneRoundRobin += 1;
      queue.push({
        timeOffset: cursor,
        type: group.type,
        pathIndex,
      });
      cursor += group.interval;
    }
    cursor += group.delayAfter ?? 0.65;
  }

  sim.spawnQueue = queue;
  sim.waveTotalEnemies = queue.length;
  sound.playWaveStart();
  return true;
}

function spawnEnemy(sim: SimulationState, type: EnemyType, pathIndex: number): void {
  const def = ENEMIES[type];
  const path = sim.map.paths[pathIndex] ?? sim.map.paths[0];
  const start = path[0];
  const next = path[1] ?? start;
  const hpMult = getWaveHpMultiplier(sim.wave, sim.difficulty);

  const maxHp = Math.round(def.maxHp * hpMult);
  const maxShield = Math.round(def.maxShield * (1 + (sim.wave - 1) * 0.06));
  const reward = Math.max(
    4,
    Math.round(def.reward * DIFFICULTIES[sim.difficulty].goldMultiplier)
  );

  sim.enemies.push({
    id: `en_${sim.nextId++}`,
    type,
    pathIndex,
    waypointIndex: 1,
    x: start.c + 0.5,
    y: start.r + 0.5,
    angle: Math.atan2(next.r - start.r, next.c - start.c),
    hp: maxHp,
    maxHp,
    shield: maxShield,
    maxShield,
    shieldRegenDelay: 0,
    baseSpeed: def.speed,
    slowFactor: 0,
    slowTimer: 0,
    distanceTraveled: 0,
    reward,
    coreDamage: def.coreDamage,
    hitFlash: 0,
  });
}



function applyDamage(
  sim: SimulationState,
  enemy: EnemyEntity,
  rawDamage: number,
  sourceTowerId: string,
  options?: { isElectric?: boolean; slowFactor?: number; slowDuration?: number }
): void {
  if (enemy.hp <= 0) return;

  let remaining = rawDamage;
  let actualDealt = 0;

  if (enemy.shield > 0) {
    const shieldMult = options?.isElectric ? 2.0 : 1.0;
    const shieldDmg = remaining * shieldMult;
    if (enemy.shield >= shieldDmg) {
      enemy.shield -= shieldDmg;
      actualDealt += shieldDmg;
      remaining = 0;
    } else {
      actualDealt += enemy.shield;
      const usedRatio = enemy.shield / shieldDmg;
      remaining = remaining * (1 - usedRatio);
      enemy.shield = 0;
    }
    enemy.shieldRegenDelay = 3.2;
  }

  if (remaining > 0) {
    const hpDmg = Math.min(enemy.hp, remaining);
    enemy.hp -= hpDmg;
    actualDealt += hpDmg;
  }

  enemy.hitFlash = 0.12;

  if (options?.slowFactor && options?.slowDuration) {
    if (options.slowFactor >= enemy.slowFactor || enemy.slowTimer <= 0) {
      enemy.slowFactor = options.slowFactor;
      enemy.slowTimer = options.slowDuration;
    } else {
      enemy.slowTimer = Math.max(enemy.slowTimer, options.slowDuration * 0.7);
    }
  }

  const tower = sim.towers.find((t) => t.id === sourceTowerId);
  if (tower) {
    const rounded = Math.round(actualDealt);
    tower.totalDamage += rounded;
    sim.damageByType[tower.type] += rounded;
  }

  if (enemy.hp <= 0) {
    sim.gold += enemy.reward;
    sim.score += enemy.reward * 10 + (enemy.type === 'colossus' ? 250 : 0);
    sim.enemiesDefeated += 1;
    if (enemy.type === 'colossus') sim.bossesDefeated += 1;
    if (tower) tower.kills += 1;

    const def = ENEMIES[enemy.type];
    sim.particleManager.spawnBurst(
      enemy.x,
      enemy.y,
      def.color,
      enemy.type === 'colossus' ? 20 : 10,
      1.3
    );
    sim.floatingTexts.push({
      x: enemy.x,
      y: enemy.y - 0.15,
      vy: -0.65,
      text: `+${enemy.reward}`,
      color: '#FBBF24',
      life: 0.75,
      maxLife: 0.75,
    });
    sound.playEnemyDie(enemy.type === 'colossus');
  }
}

function pickTarget(tower: TowerEntity, enemies: EnemyEntity[], range: number): EnemyEntity | null {
  const tx = tower.c + 0.5;
  const ty = tower.r + 0.5;
  let best: EnemyEntity | null = null;
  let bestMetric = -Infinity;

  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const dist = Math.hypot(e.x - tx, e.y - ty);
    if (dist > range) continue;

    let metric = 0;
    if (tower.targeting === 'first') {
      metric = e.distanceTraveled;
    } else if (tower.targeting === 'strongest') {
      metric = e.hp + e.shield;
    } else if (tower.targeting === 'weakest') {
      metric = -(e.hp + e.shield);
    } else {
      metric = -dist;
    }

    if (metric > bestMetric) {
      bestMetric = metric;
      best = e;
    }
  }
  return best;
}

export function updateSimulation(sim: SimulationState, dt: number): void {
  if (sim.outcome !== 'none') return;

  sim.time += dt;
  sim.corePulse = Math.max(0, sim.corePulse - dt * 2.2);

  // 0. Global Dynamic Weather Countdown
  if (sim.weather.type !== 'clear') {
    sim.weather.remaining = Math.max(0, sim.weather.remaining - dt);
    if (sim.weather.remaining <= 0) {
      sim.weather = { type: 'clear', remaining: 0, duration: 0 };
      const core = sim.map.paths[0][sim.map.paths[0].length - 1];
      sim.floatingTexts.push({
        x: core.c + 0.5,
        y: Math.max(0.8, core.r - 0.5),
        vy: -0.45,
        text: '天气转晴',
        color: '#CBD5E1',
        life: 1.4,
        maxLife: 1.4,
      });
    }
  }

  // 1. Wave Spawning & Inter-wave countdown
  if (sim.waveActive) {
    sim.waveElapsed += dt;
    while (sim.spawnQueue.length > 0 && sim.spawnQueue[0].timeOffset <= sim.waveElapsed) {
      const item = sim.spawnQueue.shift()!;
      spawnEnemy(sim, item.type, item.pathIndex);
    }

    if (sim.spawnQueue.length === 0 && sim.enemies.length === 0) {
      sim.waveActive = false;
      const waveDef = getWaveDefinition(sim.wave);
      sim.gold += waveDef.clearBonus;
      sim.score += waveDef.clearBonus * 5 + sim.wave * 40;

      const core = sim.map.paths[0][sim.map.paths[0].length - 1];
      sim.floatingTexts.push({
        x: core.c + 0.5,
        y: core.r + 0.1,
        vy: -0.5,
        text: `波次奖励 +${waveDef.clearBonus}`,
        color: '#34D399',
        life: 1.4,
        maxLife: 1.4,
      });

      if (sim.totalWaves > 0 && sim.wave >= sim.totalWaves) {
        sim.outcome = 'victory';
        sound.playVictory();
        return;
      }

      sound.playWaveClear();
      sim.waveCountdown = 12;

      // Randomly trigger a global dynamic weather event between waves
      if (sim.weather.type === 'clear') {
        const shouldTrigger = sim.wave === 2 || Math.random() < 0.7;
        if (shouldTrigger) {
          const picked =
            DYNAMIC_WEATHER_POOL[Math.floor(Math.random() * DYNAMIC_WEATHER_POOL.length)];
          const wDef = WEATHER_DEFINITIONS[picked];
          const duration = Math.round(
            wDef.minDuration + Math.random() * (wDef.maxDuration - wDef.minDuration)
          );
          sim.weather = { type: picked, remaining: duration, duration };
          sim.floatingTexts.push({
            x: GRID_COLS / 2,
            y: 1.2,
            vy: -0.35,
            text: `气象变更: ${wDef.name} (${wDef.shortEffect})`,
            color: wDef.accentColor,
            life: 2.2,
            maxLife: 2.2,
          });
        }
      }
    }
  } else if (sim.wave > 0) {
    sim.waveCountdown -= dt;
    if (sim.waveCountdown <= 0) {
      startNextWave(sim);
    }
  }

  // 2. Move Enemies
  for (let i = sim.enemies.length - 1; i >= 0; i--) {
    const e = sim.enemies[i];
    if (e.hp <= 0) {
      sim.enemies.splice(i, 1);
      continue;
    }

    e.hitFlash = Math.max(0, e.hitFlash - dt);

    if (e.slowTimer > 0) {
      e.slowTimer -= dt;
      if (e.slowTimer <= 0) {
        e.slowFactor = 0;
      }
    }

    if (e.maxShield > 0 && e.shield < e.maxShield) {
      if (e.shieldRegenDelay > 0) {
        e.shieldRegenDelay -= dt;
      } else {
        e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.12 * dt);
      }
    }

    const path = sim.map.paths[e.pathIndex] ?? sim.map.paths[0];
    const weatherSpeedMult = sim.weather.type === 'blizzard' ? 0.92 : 1;
    const effectiveSpeed = e.baseSpeed * (1 - e.slowFactor) * weatherSpeedMult;
    let stepDist = effectiveSpeed * dt;

    while (stepDist > 0 && e.waypointIndex < path.length) {
      const wp = path[e.waypointIndex];
      const wx = wp.c + 0.5;
      const wy = wp.r + 0.5;
      const dx = wx - e.x;
      const dy = wy - e.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= stepDist) {
        e.x = wx;
        e.y = wy;
        e.distanceTraveled += dist;
        stepDist -= dist;
        e.waypointIndex += 1;
      } else {
        const nx = dx / dist;
        const ny = dy / dist;
        e.x += nx * stepDist;
        e.y += ny * stepDist;
        e.angle = Math.atan2(ny, nx);
        e.distanceTraveled += stepDist;
        stepDist = 0;
      }
    }

    if (e.waypointIndex >= path.length) {
      // Reached Core
      sim.lives = Math.max(0, sim.lives - e.coreDamage);
      sim.corePulse = 1;
      sim.particleManager.spawnBurst(e.x, e.y, '#EF4444', 14, 1.5);
      sim.floatingTexts.push({
        x: e.x,
        y: e.y - 0.2,
        vy: -0.7,
        text: `-${e.coreDamage} 核心`,
        color: '#EF4444',
        life: 1.0,
        maxLife: 1.0,
      });
      sim.enemies.splice(i, 1);
      sound.playCoreHit();

      if (sim.lives <= 0) {
        sim.outcome = 'gameover';
        sound.playGameOver();
        return;
      }
    }
  }

  // 3. Towers Acquire & Fire
  for (const tower of sim.towers) {
    const stats = getEffectiveTowerStats(sim.towers, tower, sim.weather.type);
    tower.recoil = Math.max(0, tower.recoil - dt * 5.5);
    tower.cooldown = Math.max(0, tower.cooldown - dt);

    const target = pickTarget(tower, sim.enemies, stats.range);
    if (!target) continue;

    const tx = tower.c + 0.5;
    const ty = tower.r + 0.5;
    const desiredAngle = Math.atan2(target.y - ty, target.x - tx);

    // Smooth shortest-angle turn
    let diff = desiredAngle - tower.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    tower.angle += diff * Math.min(1, dt * 16);

    if (tower.cooldown > 0) continue;

    tower.cooldown = 1 / stats.fireRate;
    tower.recoil = 1;
    sound.playShoot(tower.type);

    if (tower.type === 'tesla') {
      // Chain lightning
      const hitIds = new Set<string>();
      const arcPoints: { x: number; y: number }[] = [{ x: tx, y: ty }];
      let current: EnemyEntity | null = target;
      const maxChain = stats.chainCount ?? 3;

      for (let c = 0; c < maxChain && current; c++) {
        hitIds.add(current.id);
        arcPoints.push({ x: current.x, y: current.y });
        const dmgScale = Math.pow(0.82, c);
        applyDamage(sim, current, stats.damage * dmgScale, tower.id, {
          isElectric: true,
        });

        // Find next closest enemy within 1.85 tiles
        let nextTarget: EnemyEntity | null = null;
        let nextBestDist = 1.9;
        for (const candidate of sim.enemies) {
          if (candidate.hp <= 0 || hitIds.has(candidate.id)) continue;
          const d = Math.hypot(candidate.x - current.x, candidate.y - current.y);
          if (d < nextBestDist) {
            nextBestDist = d;
            nextTarget = candidate;
          }
        }
        current = nextTarget;
      }

      sim.lightningArcs.push({
        points: arcPoints,
        life: 0.18,
        maxLife: 0.18,
      });
    } else if (tower.type === 'cryo') {
      // Cryo pulse nova around target
      const splash = stats.splashRadius ?? 1.4;
      sim.particleManager.spawnRing(target.x, target.y, splash, '#38BDF8', 0.34);
      sim.lightningArcs.push({
        points: [
          { x: tx, y: ty },
          { x: target.x, y: target.y },
        ],
        life: 0.12,
        maxLife: 0.12,
      });

      for (const e of sim.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - target.x, e.y - target.y);
        if (d <= splash) {
          applyDamage(sim, e, stats.damage, tower.id, {
            slowFactor: stats.slowFactor ?? 0.45,
            slowDuration: stats.slowDuration ?? 2.2,
          });
        }
      }
    } else {
      // Projectile (gatling or mortar)
      const muzzleDist = tower.type === 'mortar' ? 0.25 : 0.34;
      const sx = tx + Math.cos(tower.angle) * muzzleDist;
      const sy = ty + Math.sin(tower.angle) * muzzleDist;

      sim.projectiles.push({
        id: `pr_${sim.nextId++}`,
        towerType: tower.type,
        x: sx,
        y: sy,
        startX: sx,
        startY: sy,
        targetId: target.id,
        targetX: target.x,
        targetY: target.y,
        progress: 0,
        speed: tower.type === 'mortar' ? 4.4 : 14.5,
        damage: stats.damage,
        splashRadius: stats.splashRadius ?? 0,
        slowFactor: 0,
        slowDuration: 0,
        sourceTowerId: tower.id,
      });
    }
  }

  // 4. Update Projectiles
  for (let i = sim.projectiles.length - 1; i >= 0; i--) {
    const p = sim.projectiles[i];
    const target = sim.enemies.find((e) => e.id === p.targetId && e.hp > 0);
    if (target) {
      p.targetX = target.x;
      p.targetY = target.y;
    }

    if (p.towerType === 'mortar') {
      const totalDist = Math.max(0.5, Math.hypot(p.targetX - p.startX, p.targetY - p.startY));
      p.progress += (p.speed * dt) / totalDist;
      if (p.progress >= 1) {
        // Mortar explosion
        sim.particleManager.spawnRing(p.targetX, p.targetY, p.splashRadius, '#FB7185', 0.34);
        sim.particleManager.spawnBurst(p.targetX, p.targetY, '#F97316', 12, 1.5);
        sound.playExplosion();

        for (const e of sim.enemies) {
          if (e.hp <= 0) continue;
          const dist = Math.hypot(e.x - p.targetX, e.y - p.targetY);
          if (dist <= p.splashRadius) {
            const falloff = 1 - (dist / p.splashRadius) * 0.35;
            applyDamage(sim, e, p.damage * falloff, p.sourceTowerId);
          }
        }
        sim.projectiles.splice(i, 1);
      } else {
        p.x = p.startX + (p.targetX - p.startX) * p.progress;
        p.y = p.startY + (p.targetY - p.startY) * p.progress;
      }
    } else {
      // Direct kinetic bullet
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (dist <= step + 0.14) {
        if (target) {
          applyDamage(sim, target, p.damage, p.sourceTowerId);
        }
        sim.particleManager.spawnBurst(p.targetX, p.targetY, '#FCD34D', 4, 0.7);
        sim.projectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
      }
    }
  }

  // Clean up dead enemies right after projectiles
  for (let i = sim.enemies.length - 1; i >= 0; i--) {
    if (sim.enemies[i].hp <= 0) {
      sim.enemies.splice(i, 1);
    }
  }

  // 5. Update FX
  for (let i = sim.lightningArcs.length - 1; i >= 0; i--) {
    sim.lightningArcs[i].life -= dt;
    if (sim.lightningArcs[i].life <= 0) sim.lightningArcs.splice(i, 1);
  }

  sim.particleManager.update(dt);

  for (let i = sim.floatingTexts.length - 1; i >= 0; i--) {
    const ft = sim.floatingTexts[i];
    ft.life -= dt;
    if (ft.life <= 0) {
      sim.floatingTexts.splice(i, 1);
      continue;
    }
    ft.y += ft.vy * dt;
  }
}

export interface RenderOptions {
  hoverTile: GridPoint | null;
  buildTowerType: TowerType | null;
  selectedTowerId: string | null;
  showAllRanges: boolean;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function renderGameCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sim: SimulationState,
  opts: RenderOptions
): void {
  const tile = Math.min(width / GRID_COLS, height / GRID_ROWS);
  const offsetX = (width - tile * GRID_COLS) / 2;
  const offsetY = (height - tile * GRID_ROWS) / 2;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(offsetX, offsetY);

  // 1. Tactical Grid Floor
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const isAlt = (c + r) % 2 === 0;
      ctx.fillStyle = isAlt ? '#111A2E' : '#131E35';
      ctx.fillRect(c * tile, r * tile, tile, tile);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
      ctx.lineWidth = 1;
      ctx.strokeRect(c * tile + 0.5, r * tile + 0.5, tile - 1, tile - 1);
    }
  }

  // 2. Road Path Rendering
  for (const path of sim.map.paths) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer shoulder
    ctx.beginPath();
    path.forEach((p, idx) => {
      const px = (p.c + 0.5) * tile;
      const py = (p.r + 0.5) * tile;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = '#25334C';
    ctx.lineWidth = tile * 0.72;
    ctx.stroke();

    // Inner track
    ctx.strokeStyle = '#192438';
    ctx.lineWidth = tile * 0.52;
    ctx.stroke();

    // Subtle directional dashes
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 2;
    ctx.setLineDash([tile * 0.14, tile * 0.22]);
    ctx.lineDashOffset = -sim.time * tile * 0.45;
    ctx.stroke();
    ctx.restore();
  }

  // 3. Blocked Rock Monoliths
  for (const blk of sim.map.blockedTiles) {
    const cx = (blk.c + 0.5) * tile;
    const cy = (blk.r + 0.5) * tile;
    const pad = tile * 0.14;
    ctx.fillStyle = '#28354D';
    ctx.strokeStyle = '#3B4D6B';
    ctx.lineWidth = 1.5;
    roundRect(ctx, blk.c * tile + pad, blk.r * tile + pad, tile - pad * 2, tile - pad * 2, tile * 0.12);
    ctx.fill();
    ctx.stroke();

    // Inner bevel diamond
    ctx.beginPath();
    ctx.moveTo(cx, cy - tile * 0.18);
    ctx.lineTo(cx + tile * 0.18, cy);
    ctx.lineTo(cx, cy + tile * 0.18);
    ctx.lineTo(cx - tile * 0.18, cy);
    ctx.closePath();
    ctx.fillStyle = '#1E293B';
    ctx.fill();
  }

  // 4. Spawn Portals & Defense Core
  const drawnEntries = new Set<string>();
  for (const path of sim.map.paths) {
    const entry = path[0];
    const key = `${entry.c},${entry.r}`;
    if (!drawnEntries.has(key)) {
      drawnEntries.add(key);
      const ex = (entry.c + 0.5) * tile;
      const ey = (entry.r + 0.5) * tile;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(sim.time * 0.9);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, tile * 0.3, 0, Math.PI * 1.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, tile * 0.18, Math.PI, Math.PI * 2.45);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Core (at end of path 0)
  const coreTile = sim.map.paths[0][sim.map.paths[0].length - 1];
  const coreX = (coreTile.c + 0.5) * tile;
  const coreY = (coreTile.r + 0.5) * tile;
  ctx.save();
  ctx.translate(coreX, coreY);
  const coreColor = sim.corePulse > 0.1 ? '#EF4444' : '#10B981';
  const pulseRadius = tile * (0.34 + Math.sin(sim.time * 3) * 0.025 + sim.corePulse * 0.08);
  ctx.fillStyle = sim.corePulse > 0.1 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.18)';
  ctx.beginPath();
  ctx.arc(0, 0, pulseRadius * 1.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const rx = Math.cos(a) * tile * 0.32;
    const ry = Math.sin(a) * tile * 0.32;
    if (i === 0) ctx.moveTo(rx, ry);
    else ctx.lineTo(rx, ry);
  }
  ctx.closePath();
  ctx.fillStyle = '#0F172A';
  ctx.fill();
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.arc(0, 0, tile * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 5. Build Hover Preview
  if (opts.hoverTile && opts.buildTowerType) {
    const { c, r } = opts.hoverTile;
    if (c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS) {
      const valid = canPlaceTower(sim, c, r);
      const def = TOWERS[opts.buildTowerType];
      let previewRange = def.levels[0].range;
      const cx = (c + 0.5) * tile;
      const cy = (r + 0.5) * tile;

      // Preview synergy links & range bonus when hovering valid tile
      if (valid) {
        for (const other of sim.towers) {
          if (!areTowersAdjacent({ c, r }, other)) continue;
          const syn = findMatchingSynergy(opts.buildTowerType, other.type);
          if (syn) {
            if (syn.id === 'tesla_gatling' && opts.buildTowerType === 'gatling') {
              previewRange = Number((def.levels[0].range + 0.35).toFixed(2));
            }
            const ox = (other.c + 0.5) * tile;
            const oy = (other.r + 0.5) * tile;
            ctx.save();
            ctx.strokeStyle = hexToRgba(syn.accentColor, 0.85);
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(ox, oy);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // Range circle (factoring in active weather range modifier)
      const effectivePreviewRange =
        sim.weather.type === 'sandstorm'
          ? Number((previewRange * 0.82).toFixed(2))
          : previewRange;
      ctx.beginPath();
      ctx.arc(cx, cy, effectivePreviewRange * tile, 0, Math.PI * 2);
      ctx.fillStyle = valid ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)';
      ctx.fill();
      ctx.strokeStyle = valid ? 'rgba(245, 158, 11, 0.55)' : 'rgba(239, 68, 68, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tile highlight
      ctx.fillStyle = valid ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(c * tile + 2, r * tile + 2, tile - 4, tile - 4);
      ctx.strokeStyle = valid ? '#10B981' : '#EF4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(c * tile + 2, r * tile + 2, tile - 4, tile - 4);
    }
  }

  // 5b. All Placed Tower Ranges (when tactical overlay is enabled)
  if (opts.showAllRanges) {
    for (const tower of sim.towers) {
      if (tower.id === opts.selectedTowerId) continue;
      const def = TOWERS[tower.type];
      const stats = getEffectiveTowerStats(sim.towers, tower, sim.weather.type);
      const cx = (tower.c + 0.5) * tile;
      const cy = (tower.r + 0.5) * tile;

      ctx.beginPath();
      ctx.arc(cx, cy, stats.range * tile, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(def.accentColor, 0.045);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(def.accentColor, 0.45);
      ctx.lineWidth = 1.25;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 6. Selected Tower Range Ring
  const selectedTower = opts.selectedTowerId
    ? sim.towers.find((t) => t.id === opts.selectedTowerId) ?? null
    : null;
  if (selectedTower) {
    const stats = getEffectiveTowerStats(sim.towers, selectedTower, sim.weather.type);
    const cx = (selectedTower.c + 0.5) * tile;
    const cy = (selectedTower.r + 0.5) * tile;

    ctx.beginPath();
    ctx.arc(cx, cy, stats.range * tile, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      selectedTower.c * tile + 2,
      selectedTower.r * tile + 2,
      tile - 4,
      tile - 4
    );
  }

  // 6b. Active Synergy Connection Links
  const boostedTowerIds = new Set<string>();
  for (let i = 0; i < sim.towers.length; i++) {
    for (let j = i + 1; j < sim.towers.length; j++) {
      const a = sim.towers[i];
      const b = sim.towers[j];
      if (!areTowersAdjacent(a, b)) continue;
      const syn = findMatchingSynergy(a.type, b.type);
      if (!syn) continue;
      boostedTowerIds.add(a.id);
      boostedTowerIds.add(b.id);

      const ax = (a.c + 0.5) * tile;
      const ay = (a.r + 0.5) * tile;
      const bx = (b.c + 0.5) * tile;
      const by = (b.r + 0.5) * tile;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;

      ctx.save();
      ctx.strokeStyle = hexToRgba(syn.accentColor, 0.55);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.fillStyle = syn.accentColor;
      ctx.beginPath();
      ctx.moveTo(mx, my - 3.5);
      ctx.lineTo(mx + 3.5, my);
      ctx.lineTo(mx, my + 3.5);
      ctx.lineTo(mx - 3.5, my);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // 7. Render Towers
  for (const tower of sim.towers) {
    drawTower(ctx, tower, tile, sim.time, boostedTowerIds.has(tower.id));
  }

  // 8. Render Enemies
  for (const enemy of sim.enemies) {
    drawEnemy(ctx, enemy, tile);
  }

  // 9. Render Projectiles
  for (const p of sim.projectiles) {
    if (p.towerType === 'mortar') {
      const groundX = p.x * tile;
      const groundY = p.y * tile;
      const arcHeight = Math.sin(p.progress * Math.PI) * tile * 0.85;

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(groundX, groundY, tile * 0.11, tile * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shell
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.arc(groundX, groundY - arcHeight, tile * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFF1F2';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(p.x * tile, p.y * tile, tile * 0.065, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 10. Lightning Arcs & Cryo Beams
  for (const arc of sim.lightningArcs) {
    const alpha = Math.max(0, arc.life / arc.maxLife);
    ctx.save();
    ctx.strokeStyle =
      arc.points.length > 2
        ? `rgba(167, 139, 250, ${alpha})`
        : `rgba(56, 189, 248, ${alpha})`;
    ctx.lineWidth = arc.points.length > 2 ? 2.5 : 2;
    ctx.beginPath();
    arc.points.forEach((pt, idx) => {
      const px = pt.x * tile;
      const py = pt.y * tile;
      if (idx === 0) {
        ctx.moveTo(px, py);
      } else {
        const prev = arc.points[idx - 1];
        const midX = ((prev.x + pt.x) / 2) * tile + (Math.random() - 0.5) * tile * 0.18;
        const midY = ((prev.y + pt.y) / 2) * tile + (Math.random() - 0.5) * tile * 0.18;
        ctx.lineTo(midX, midY);
        ctx.lineTo(px, py);
      }
    });
    ctx.stroke();
    ctx.restore();
  }

  // 11. Particles, Shockwave Rings & Tower Sell Animations
  sim.particleManager.render(ctx, tile);

  // 11b. Global Atmospheric Weather Overlay
  renderWeatherOverlay(ctx, tile, sim.weather.type, sim.time);

  // 12. Floating Combat / Reward Texts
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `600 ${Math.max(11, Math.round(tile * 0.22))}px "JetBrains Mono", "Noto Sans SC", sans-serif`;
  for (const ft of sim.floatingTexts) {
    const alpha = Math.min(1, ft.life / (ft.maxLife * 0.5));
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = '#0F172A';
    ctx.fillText(ft.text, ft.x * tile + 1, ft.y * tile + 1);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x * tile, ft.y * tile);
  }
  ctx.restore();

  ctx.restore();
}

function renderWeatherOverlay(
  ctx: CanvasRenderingContext2D,
  tile: number,
  weather: WeatherType,
  time: number
): void {
  if (weather === 'clear') return;

  const mapW = GRID_COLS * tile;
  const mapH = GRID_ROWS * tile;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, mapW, mapH);
  ctx.clip();

  if (weather === 'sandstorm') {
    ctx.fillStyle = 'rgba(217, 119, 6, 0.08)';
    ctx.fillRect(0, 0, mapW, mapH);

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 34; i++) {
      const seed = i * 173.3;
      const x = ((seed + time * 260) % (mapW + 120)) - 60;
      const y = ((i * 89.7 + Math.sin(time * 2 + i) * 14) % mapH);
      const len = 24 + (i % 4) * 12;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + len * 0.14);
      ctx.stroke();
    }
  } else if (weather === 'thunderstorm') {
    const flashCycle = (time * 0.45) % 1;
    const flashAlpha = flashCycle > 0.96 ? (1 - flashCycle) * 4.5 * 0.16 : 0;
    ctx.fillStyle = flashAlpha > 0 ? `rgba(196, 181, 253, ${flashAlpha})` : 'rgba(30, 58, 138, 0.09)';
    ctx.fillRect(0, 0, mapW, mapH);

    ctx.strokeStyle = 'rgba(147, 197, 253, 0.26)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 48; i++) {
      const x = ((i * 97.1 + time * 140) % (mapW + 80)) - 40;
      const y = ((i * 61.3 + time * 420) % (mapH + 60)) - 30;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 7, y + 18);
      ctx.stroke();
    }
  } else if (weather === 'blizzard') {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.075)';
    ctx.fillRect(0, 0, mapW, mapH);

    ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
    for (let i = 0; i < 42; i++) {
      const x = ((i * 113.7 + time * 95 + Math.sin(time * 1.5 + i) * 18) % mapW + mapW) % mapW;
      const y = ((i * 71.9 + time * 120) % mapH);
      const r = 1.4 + (i % 3) * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (weather === 'tailwind') {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.045)';
    ctx.fillRect(0, 0, mapW, mapH);

    ctx.strokeStyle = 'rgba(110, 231, 183, 0.22)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 24; i++) {
      const x = ((i * 151.3 + time * 320) % (mapW + 140)) - 70;
      const y = (i * 53.9) % mapH;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 36, y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawTower(
  ctx: CanvasRenderingContext2D,
  tower: TowerEntity,
  tile: number,
  time: number,
  hasSynergy = false
): void {
  const cx = (tower.c + 0.5) * tile;
  const cy = (tower.r + 0.5) * tile;
  const def = TOWERS[tower.type];

  // Base pad
  const pad = tile * 0.1;
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = hasSynergy ? '#38BDF8' : '#334155';
  ctx.lineWidth = hasSynergy ? 1.8 : 1.5;
  roundRect(ctx, tower.c * tile + pad, tower.r * tile + pad, tile - pad * 2, tile - pad * 2, tile * 0.16);
  ctx.fill();
  ctx.stroke();

  if (hasSynergy) {
    const sx = tower.c * tile + tile - pad - 4;
    const sy = tower.r * tile + pad + 4;
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 3);
    ctx.lineTo(sx + 3, sy);
    ctx.lineTo(sx, sy + 3);
    ctx.lineTo(sx - 3, sy);
    ctx.closePath();
    ctx.fill();
  }

  // Level pips along bottom edge of pad
  for (let i = 0; i < tower.level; i++) {
    const pipW = tile * 0.14;
    const gap = tile * 0.05;
    const totalW = tower.level * pipW + (tower.level - 1) * gap;
    const startX = cx - totalW / 2;
    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(startX + i * (pipW + gap), tower.r * tile + tile - pad - 4, pipW, 3);
  }

  ctx.save();
  ctx.translate(cx, cy);

  const sprite = getTowerSpriteCanvas(tower.type);
  if (sprite) {
    const spriteSize = tile * (0.86 + (tower.level - 1) * 0.055);
    if (tower.type === 'gatling' || tower.type === 'mortar') {
      ctx.rotate(tower.angle);
      const kick = tower.recoil * tile * (tower.type === 'mortar' ? 0.075 : 0.05);
      ctx.translate(-kick, 0);
    } else if (tower.type === 'cryo') {
      ctx.rotate(time * (0.45 + tower.level * 0.16));
    } else if (tower.type === 'tesla') {
      const pulse = 1 + Math.sin(time * 7) * 0.03;
      ctx.scale(pulse, pulse);
    }

    ctx.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);

    // Subtle upgrade glow halo for Lv.2 and Lv.3
    if (tower.level > 1) {
      ctx.strokeStyle =
        tower.level === 3 ? 'rgba(251, 191, 36, 0.45)' : 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, spriteSize * 0.44, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (tower.type === 'gatling') {
    ctx.rotate(tower.angle);
    const kick = tower.recoil * tile * 0.07;

    // Barrels (1/2/3+ based on level)
    ctx.fillStyle = '#CBD5E1';
    if (tower.level === 1) {
      ctx.fillRect(0 - kick, -tile * 0.045, tile * 0.36, tile * 0.09);
    } else if (tower.level === 2) {
      ctx.fillRect(0 - kick, -tile * 0.09, tile * 0.38, tile * 0.06);
      ctx.fillRect(0 - kick, tile * 0.03, tile * 0.38, tile * 0.06);
    } else {
      ctx.fillRect(0 - kick, -tile * 0.11, tile * 0.4, tile * 0.055);
      ctx.fillRect(0 - kick, -tile * 0.028, tile * 0.43, tile * 0.056);
      ctx.fillRect(0 - kick, tile * 0.055, tile * 0.4, tile * 0.055);
    }

    // Turret housing
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(0, 0, tile * (0.19 + tower.level * 0.02), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (tower.type === 'cryo') {
    ctx.rotate(time * (0.8 + tower.level * 0.25));
    const sides = tower.level + 4;
    const r = tile * (0.22 + tower.level * 0.02);
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = ((Math.PI * 2) / sides) * i;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#0284C7';
    ctx.fill();
    ctx.strokeStyle = '#7DD3FC';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#E0F2FE';
    ctx.beginPath();
    ctx.arc(0, 0, tile * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else if (tower.type === 'mortar') {
    ctx.rotate(tower.angle);
    const kick = tower.recoil * tile * 0.09;

    // Thick cannon tube
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-tile * 0.08 - kick, -tile * 0.11, tile * 0.4, tile * 0.22);
    ctx.strokeRect(-tile * 0.08 - kick, -tile * 0.11, tile * 0.4, tile * 0.22);

    // Muzzle ring
    ctx.fillStyle = def.accentColor;
    ctx.fillRect(tile * 0.24 - kick, -tile * 0.125, tile * 0.08, tile * 0.25);

    // Breech
    ctx.fillStyle = '#FB7185';
    ctx.beginPath();
    ctx.arc(-tile * 0.04, 0, tile * (0.18 + tower.level * 0.018), 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Tesla coil
    ctx.strokeStyle = '#A78BFA';
    ctx.lineWidth = 2;
    for (let ring = 0; ring < tower.level + 1; ring++) {
      ctx.beginPath();
      ctx.arc(0, 0, tile * (0.12 + ring * 0.055), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#DDD6FE';
    ctx.beginPath();
    ctx.arc(0, 0, tile * (0.09 + Math.sin(time * 8) * 0.015), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyEntity, tile: number): void {
  const def = ENEMIES[enemy.type];
  const ex = enemy.x * tile;
  const ey = enemy.y * tile;
  const r = def.radius * tile;

  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(enemy.angle);

  const bodyColor =
    enemy.hitFlash > 0
      ? '#FFFFFF'
      : enemy.slowTimer > 0
        ? '#38BDF8'
        : def.color;

  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.8;

  if (enemy.type === 'colossus') {
    const bossSprite = getColossusSpriteCanvas();
    if (bossSprite) {
      const size = r * 2.55;
      ctx.drawImage(bossSprite, -size / 2, -size / 2, size, size);
      if (enemy.hitFlash > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemy.slowTimer > 0) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      roundRect(ctx, -r, -r * 0.9, r * 2, r * 1.8, r * 0.28);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#7F1D1D';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.46, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (enemy.type === 'scout' || enemy.type === 'sprinter') {
    // Winged recon/interceptor hull + engine exhaust + canopy
    ctx.beginPath();
    ctx.moveTo(r * 1.2, 0);
    ctx.lineTo(-r * 0.75, -r * 0.88);
    ctx.lineTo(-r * 0.35, -r * 0.25);
    ctx.lineTo(-r * 0.9, 0);
    ctx.lineTo(-r * 0.35, r * 0.25);
    ctx.lineTo(-r * 0.75, r * 0.88);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = enemy.type === 'sprinter' ? '#ECFDF5' : '#FEF3C7';
    ctx.beginPath();
    ctx.ellipse(r * 0.25, 0, r * 0.32, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.type === 'armored') {
    // Treads
    ctx.fillStyle = '#334155';
    ctx.fillRect(-r * 0.95, -r * 0.95, r * 1.9, r * 0.28);
    ctx.fillRect(-r * 0.95, r * 0.67, r * 1.9, r * 0.28);
    // Hull
    ctx.fillStyle = bodyColor;
    roundRect(ctx, -r * 0.92, -r * 0.74, r * 1.84, r * 1.48, r * 0.22);
    ctx.fill();
    ctx.stroke();
    // Turret hatch & forward gun
    ctx.fillStyle = '#475569';
    ctx.fillRect(r * 0.1, -r * 0.14, r * 0.95, r * 0.28);
    ctx.beginPath();
    ctx.arc(-r * 0.08, 0, r * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // Shielded hex drone with central emitter core
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#DBEAFE';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Energy shield ring
  if (enemy.shield > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, ey, r * 1.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Overhead HP & Shield bar
  const barW = Math.max(tile * 0.46, r * 2.1);
  const barH = 4;
  const barX = ex - barW / 2;
  const barY = ey - r - 10;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

  const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
  ctx.fillStyle = hpRatio > 0.5 ? '#10B981' : hpRatio > 0.25 ? '#F59E0B' : '#EF4444';
  ctx.fillRect(barX, barY, barW * hpRatio, barH);

  if (enemy.maxShield > 0 && enemy.shield > 0) {
    const shRatio = Math.max(0, enemy.shield / enemy.maxShield);
    ctx.fillStyle = '#60A5FA';
    ctx.fillRect(barX, barY - 3, barW * shRatio, 2);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
