import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CommanderManualModal } from './components/CommanderManualModal';
import { GameHUD } from './components/GameHUD';
import { ResultModal } from './components/ResultModal';
import { TacticalDock } from './components/TacticalDock';
import { TitleScreen } from './components/TitleScreen';
import { WaveProgressBar } from './components/WaveProgressBar';
import {
  DIFFICULTIES,
  getMapById,
  GRID_COLS,
  GRID_ROWS,
  TOWER_LIST,
} from './game/constants';
import {
  ACHIEVEMENTS,
  evaluateAndPersistAchievements,
  loadUnlockedAchievementIds,
} from './game/achievements';
import {
  createSimulation,
  getEffectiveTowerStats,
  getHudSnapshot,
  getRunSummaryStats,
  placeTower,
  renderGameCanvas,
  sellTower,
  setTowerTargeting,
  SimulationState,
  startNextWave,
  updateSimulation,
  upgradeTower,
} from './game/engine';
import { sound } from './game/sound';
import {
  Difficulty,
  EarnedAchievement,
  GameState,
  GridPoint,
  HudSnapshot,
  MapId,
  TargetingMode,
  TowerEntity,
  TowerType,
} from './game/types';

const BEST_SCORE_KEY = 'bastion_td_best_score_v1';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [selectedMap, setSelectedMap] = useState<MapId>('gorge');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('standard');
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(BEST_SCORE_KEY);
      return saved ? Number(saved) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 2>(1);
  const [showAllRanges, setShowAllRanges] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(() => sound.isMuted());
  const [volume, setVolume] = useState<number>(() => sound.getVolume());
  const [buildTowerType, setBuildTowerType] = useState<TowerType | null>(null);
  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const manualOpenRef = useRef(false);
  const [earnedAchievements, setEarnedAchievements] = useState<EarnedAchievement[]>([]);
  const [unlockedAchievementCount, setUnlockedAchievementCount] = useState<number>(
    () => loadUnlockedAchievementIds().size
  );

  const simRef = useRef<SimulationState>(createSimulation('gorge', 'standard'));
  const [hud, setHud] = useState<HudSnapshot>(() => getHudSnapshot(simRef.current));
  const [selectedTowerSnapshot, setSelectedTowerSnapshot] = useState<TowerEntity | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasSizeRef = useRef<{ width: number; height: number }>({ width: 960, height: 540 });
  const hoverTileRef = useRef<GridPoint | null>(null);

  // Refs synced for rAF loop
  const gameStateRef = useRef<GameState>(gameState);
  const speedRef = useRef<1 | 2>(speedMultiplier);
  const showAllRangesRef = useRef<boolean>(showAllRanges);
  const buildTypeRef = useRef<TowerType | null>(buildTowerType);
  const selectedTowerIdRef = useRef<string | null>(selectedTowerId);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    speedRef.current = speedMultiplier;
  }, [speedMultiplier]);

  useEffect(() => {
    showAllRangesRef.current = showAllRanges;
  }, [showAllRanges]);

  useEffect(() => {
    buildTypeRef.current = buildTowerType;
  }, [buildTowerType]);

  useEffect(() => {
    manualOpenRef.current = manualOpen;
  }, [manualOpen]);

  useEffect(() => {
    selectedTowerIdRef.current = selectedTowerId;
    const found = selectedTowerId
      ? simRef.current.towers.find((t) => t.id === selectedTowerId) ?? null
      : null;
    setSelectedTowerSnapshot(found ? { ...found } : null);
  }, [selectedTowerId]);

  const syncUiFromSim = useCallback(() => {
    const sim = simRef.current;
    setHud(getHudSnapshot(sim));
    const selId = selectedTowerIdRef.current;
    if (selId) {
      const found = sim.towers.find((t) => t.id === selId) ?? null;
      setSelectedTowerSnapshot(found ? { ...found } : null);
      if (!found) setSelectedTowerId(null);
    } else {
      setSelectedTowerSnapshot(null);
    }
  }, []);

  const startFreshGame = useCallback(
    (mapId: MapId, difficulty: Difficulty) => {
      sound.unlock();
      const fresh = createSimulation(mapId, difficulty);
      simRef.current = fresh;
      setBuildTowerType(null);
      setSelectedTowerId(null);
      setEarnedAchievements([]);
      setSpeedMultiplier(1);
      setGameState('PLAYING');
      setHud(getHudSnapshot(fresh));
      setSelectedTowerSnapshot(null);
      sound.playSelect();
      sound.setAmbientPaused(false);
      sound.startMapAmbience(mapId);
    },
    []
  );

  // Sync map ambient soundscape with gameState & selectedMap
  useEffect(() => {
    if (gameState === 'PLAYING') {
      sound.setAmbientPaused(false);
      sound.startMapAmbience(selectedMap);
    } else if (gameState === 'PAUSED') {
      sound.setAmbientPaused(true);
    } else {
      sound.stopMapAmbience();
    }
  }, [gameState, selectedMap]);

  useEffect(() => {
    return () => {
      sound.stopMapAmbience();
    };
  }, []);

  // Observe canvas container resize
  useEffect(() => {
    if (gameState === 'TITLE_MENU') return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(240, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvasSizeRef.current = { width: w, height: h };
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [gameState]);

  // Main 60fps requestAnimationFrame loop
  useEffect(() => {
    if (gameState === 'TITLE_MENU') return;

    let rafId = 0;
    let lastTime = performance.now();
    let hudAccumulator = 0;

    const frame = (now: number) => {
      const rawDt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      const sim = simRef.current;
      if (gameStateRef.current === 'PLAYING' && !manualOpenRef.current) {
        const dt = rawDt * speedRef.current;
        updateSimulation(sim, dt);

        if (sim.outcome === 'victory' || sim.outcome === 'gameover') {
          const result = evaluateAndPersistAchievements(getRunSummaryStats(sim));
          setEarnedAchievements(result.earned);
          setUnlockedAchievementCount(result.totalUnlockedCount);
          setGameState(sim.outcome === 'victory' ? 'VICTORY' : 'GAME_OVER');
          syncUiFromSim();
        }
      }

      if (sim.score > bestScore) {
        setBestScore(sim.score);
        try {
          localStorage.setItem(BEST_SCORE_KEY, String(sim.score));
        } catch {
          // ignore storage errors
        }
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        const { width, height } = canvasSizeRef.current;
        renderGameCanvas(ctx, width, height, sim, {
          hoverTile: hoverTileRef.current,
          buildTowerType: buildTypeRef.current,
          selectedTowerId: selectedTowerIdRef.current,
          showAllRanges: showAllRangesRef.current,
        });
      }

      hudAccumulator += rawDt;
      if (hudAccumulator >= 0.1) {
        hudAccumulator = 0;
        syncUiFromSim();
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [gameState, bestScore, syncUiFromSim]);

  // Map client pointer coordinates to grid cell
  const getTileFromPointer = useCallback((clientX: number, clientY: number): GridPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { width, height } = canvasSizeRef.current;
    const tile = Math.min(width / GRID_COLS, height / GRID_ROWS);
    const offsetX = (width - tile * GRID_COLS) / 2;
    const offsetY = (height - tile * GRID_ROWS) / 2;

    const c = Math.floor((clientX - rect.left - offsetX) / tile);
    const r = Math.floor((clientY - rect.top - offsetY) / tile);
    if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return null;
    return { c, r };
  }, []);

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      hoverTileRef.current = getTileFromPointer(e.clientX, e.clientY);
    },
    [getTileFromPointer]
  );

  const handleCanvasPointerLeave = useCallback(() => {
    hoverTileRef.current = null;
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (gameStateRef.current !== 'PLAYING') return;
      const pt = getTileFromPointer(e.clientX, e.clientY);
      if (!pt) return;

      const sim = simRef.current;
      const existing = sim.towers.find((t) => t.c === pt.c && t.r === pt.r);

      if (existing) {
        setBuildTowerType(null);
        setSelectedTowerId(existing.id);
        sound.playSelect();
        return;
      }

      if (buildTypeRef.current) {
        sound.unlock();
        const placed = placeTower(sim, buildTypeRef.current, pt.c, pt.r);
        if (placed) {
          syncUiFromSim();
        } else {
          // Provide clear canvas & audio feedback if tile is invalid or insufficient gold
          sound.playError();
          const def = TOWER_LIST.find((t) => t.type === buildTypeRef.current);
          if (def && sim.gold < def.cost) {
            sim.floatingTexts.push({
              x: pt.c + 0.5,
              y: pt.r + 0.4,
              vy: -0.6,
              text: '金币不足',
              color: '#FB7185',
              life: 0.8,
              maxLife: 0.8,
            });
          }
        }
        return;
      }

      setSelectedTowerId(null);
    },
    [getTileFromPointer, syncUiFromSim]
  );

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (buildTypeRef.current || selectedTowerIdRef.current) {
      sound.playSelect();
    }
    setBuildTowerType(null);
    setSelectedTowerId(null);
  }, []);

  const handleSelectBuildTower = useCallback((type: TowerType | null) => {
    sound.unlock();
    sound.playSelect();
    setBuildTowerType(type);
    if (type) setSelectedTowerId(null);
  }, []);

  const handleUpgradeTower = useCallback(
    (id: string) => {
      sound.unlock();
      if (upgradeTower(simRef.current, id)) {
        syncUiFromSim();
      } else {
        sound.playError();
      }
    },
    [syncUiFromSim]
  );

  const handleSellTower = useCallback(
    (id: string) => {
      sound.unlock();
      if (sellTower(simRef.current, id)) {
        setSelectedTowerId(null);
        syncUiFromSim();
      }
    },
    [syncUiFromSim]
  );

  const handleChangeTargeting = useCallback(
    (id: string, mode: TargetingMode) => {
      sound.unlock();
      setTowerTargeting(simRef.current, id, mode);
      sound.playSelect();
      syncUiFromSim();
    },
    [syncUiFromSim]
  );

  const handleStartNextWave = useCallback(() => {
    sound.unlock();
    if (startNextWave(simRef.current)) {
      syncUiFromSim();
    }
  }, [syncUiFromSim]);

  const handleTogglePause = useCallback(() => {
    sound.unlock();
    sound.playSelect();
    setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : prev === 'PAUSED' ? 'PLAYING' : prev));
  }, []);

  const handleToggleMute = useCallback(() => {
    sound.unlock();
    setMuted((prev) => {
      const next = !prev;
      sound.setMuted(next);
      if (!next) {
        if (sound.getVolume() <= 0.01) {
          sound.setVolume(0.8);
          setVolume(0.8);
        }
        sound.playSelect();
      }
      return next;
    });
  }, []);

  const handleChangeVolume = useCallback((nextVol: number) => {
    sound.unlock();
    sound.setVolume(nextVol);
    setVolume(nextVol);
    setMuted(nextVol <= 0.001);
  }, []);

  const handleToggleShowRanges = useCallback(() => {
    sound.unlock();
    sound.playSelect();
    setShowAllRanges((prev) => !prev);
  }, []);

  const handleOpenManual = useCallback(() => {
    sound.unlock();
    sound.playSelect();
    setManualOpen(true);
  }, []);

  const handleCloseManual = useCallback(() => {
    sound.playSelect();
    setManualOpen(false);
  }, []);

  // Keyboard shortcuts during play & manual modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') {
        setManualOpen((prev) => !prev);
        sound.playSelect();
        return;
      }
      if (manualOpenRef.current) {
        if (e.key === 'Escape') {
          setManualOpen(false);
          sound.playSelect();
        }
        return;
      }
      if (gameState === 'TITLE_MENU') return;
      if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
        const idx = Number(e.key) - 1;
        const target = TOWER_LIST[idx];
        if (target) {
          handleSelectBuildTower(buildTypeRef.current === target.type ? null : target.type);
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        handleTogglePause();
      } else if (e.key === 'Escape') {
        setBuildTowerType(null);
        setSelectedTowerId(null);
      } else if (e.key.toLowerCase() === 'r') {
        handleToggleShowRanges();
      } else if (e.key.toLowerCase() === 'n') {
        if (gameStateRef.current === 'PLAYING') {
          handleStartNextWave();
        }
      } else if (e.key.toLowerCase() === 'u') {
        if (gameStateRef.current === 'PLAYING' && selectedTowerIdRef.current) {
          handleUpgradeTower(selectedTowerIdRef.current);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (gameStateRef.current === 'PLAYING' && selectedTowerIdRef.current) {
          handleSellTower(selectedTowerIdRef.current);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, handleSelectBuildTower, handleTogglePause, handleToggleShowRanges, handleStartNextWave, handleUpgradeTower, handleSellTower]);

  if (gameState === 'TITLE_MENU') {
    return (
      <>
        <TitleScreen
          selectedMap={selectedMap}
          selectedDifficulty={selectedDifficulty}
          bestScore={bestScore}
          unlockedAchievementCount={unlockedAchievementCount}
          totalAchievementCount={ACHIEVEMENTS.length}
          onSelectMap={setSelectedMap}
          onSelectDifficulty={setSelectedDifficulty}
          onStartGame={() => startFreshGame(selectedMap, selectedDifficulty)}
          onOpenManual={handleOpenManual}
        />
        <CommanderManualModal open={manualOpen} onClose={handleCloseManual} />
      </>
    );
  }

  const activeMap = getMapById(selectedMap);
  const activeDiff = DIFFICULTIES[selectedDifficulty];

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0B1120] text-slate-100 flex flex-col select-none">
      <GameHUD
        mapName={activeMap.name}
        difficultyName={activeDiff.name}
        hud={hud}
        gameState={gameState}
        speedMultiplier={speedMultiplier}
        showAllRanges={showAllRanges}
        muted={muted}
        volume={volume}
        onStartNextWave={handleStartNextWave}
        onTogglePause={handleTogglePause}
        onToggleSpeed={() => {
          sound.unlock();
          sound.playSelect();
          setSpeedMultiplier((prev) => (prev === 1 ? 2 : 1));
        }}
        onToggleShowRanges={handleToggleShowRanges}
        onToggleMute={handleToggleMute}
        onChangeVolume={handleChangeVolume}
        onOpenManual={handleOpenManual}
        onExitToMenu={() => setGameState('TITLE_MENU')}
      />

      <WaveProgressBar hud={hud} />

      {/* Tactical Canvas Arena */}
      <main className="flex-1 min-h-0 w-full p-3 bg-[#0B1120]">
        <div
          ref={containerRef}
          className="w-full h-full relative flex items-center justify-center"
        >
          <canvas
            ref={canvasRef}
            onPointerMove={handleCanvasPointerMove}
            onPointerLeave={handleCanvasPointerLeave}
            onClick={handleCanvasClick}
            onContextMenu={handleCanvasContextMenu}
            className={`block rounded-lg border border-slate-800/80 ${
              buildTowerType ? 'cursor-crosshair' : 'cursor-pointer'
            }`}
          />
        </div>
      </main>

      <TacticalDock
        gold={hud.gold}
        wave={hud.wave}
        totalWaves={hud.totalWaves}
        waveActive={hud.waveActive}
        waveCountdown={hud.waveCountdown}
        buildTowerType={buildTowerType}
        selectedTower={selectedTowerSnapshot}
        selectedTowerEffective={
          selectedTowerSnapshot
            ? getEffectiveTowerStats(
                simRef.current.towers,
                selectedTowerSnapshot,
                hud.weather.type
              )
            : null
        }
        onSelectBuildTower={handleSelectBuildTower}
        onUpgradeTower={handleUpgradeTower}
        onSellTower={handleSellTower}
        onChangeTargeting={handleChangeTargeting}
        onDeselectTower={() => setSelectedTowerId(null)}
      />

      <ResultModal
        gameState={gameState}
        hud={hud}
        mapName={activeMap.name}
        earnedAchievements={earnedAchievements}
        totalUnlockedAchievements={unlockedAchievementCount}
        totalAchievementCount={ACHIEVEMENTS.length}
        onResume={() => setGameState('PLAYING')}
        onRestart={() => startFreshGame(selectedMap, selectedDifficulty)}
        onExitToMenu={() => setGameState('TITLE_MENU')}
      />

      <CommanderManualModal open={manualOpen} onClose={handleCloseManual} />
    </div>
  );
}
