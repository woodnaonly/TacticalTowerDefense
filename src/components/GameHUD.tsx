import React from 'react';
import {
  BookOpen,
  CloudLightning,
  FastForward,
  Home,
  Pause,
  Play,
  Radar,
  Send,
  Snowflake,
  Sun,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { WEATHER_DEFINITIONS } from '../game/constants';
import { GameState, HudSnapshot, WeatherType } from '../game/types';

function WeatherIcon({ type, className }: { type: WeatherType; className?: string }) {
  if (type === 'sandstorm') return <Wind className={className} />;
  if (type === 'thunderstorm') return <CloudLightning className={className} />;
  if (type === 'blizzard') return <Snowflake className={className} />;
  if (type === 'tailwind') return <Wind className={className} />;
  return <Sun className={className} />;
}

interface GameHUDProps {
  mapName: string;
  difficultyName: string;
  hud: HudSnapshot;
  gameState: GameState;
  speedMultiplier: 1 | 2;
  showAllRanges: boolean;
  muted: boolean;
  volume: number;
  onStartNextWave: () => void;
  onTogglePause: () => void;
  onToggleSpeed: () => void;
  onToggleShowRanges: () => void;
  onToggleMute: () => void;
  onChangeVolume: (volume: number) => void;
  onOpenManual: () => void;
  onExitToMenu: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  mapName,
  difficultyName,
  hud,
  gameState,
  speedMultiplier,
  showAllRanges,
  muted,
  volume,
  onStartNextWave,
  onTogglePause,
  onToggleSpeed,
  onToggleShowRanges,
  onToggleMute,
  onChangeVolume,
  onOpenManual,
  onExitToMenu,
}) => {
  const hpRatio = hud.maxLives > 0 ? hud.lives / hud.maxLives : 0;
  const hpStatusText = hpRatio > 0.6 ? '稳固' : hpRatio > 0.3 ? '警戒' : '危急';
  const hpColor =
    hpRatio > 0.6 ? 'text-emerald-400' : hpRatio > 0.3 ? 'text-amber-400' : 'text-rose-400';

  const waveLabel =
    hud.totalWaves > 0 ? `第 ${hud.wave} / ${hud.totalWaves} 波` : `第 ${hud.wave} 波`;

  const weatherDef = WEATHER_DEFINITIONS[hud.weather.type];
  const isSpecialWeather = hud.weather.type !== 'clear' && hud.weather.remaining > 0;
  const weatherProgress =
    isSpecialWeather && hud.weather.duration > 0
      ? Math.max(0, Math.min(100, (hud.weather.remaining / hud.weather.duration) * 100))
      : 0;

  const canSendNext =
    gameState === 'PLAYING' &&
    !hud.waveActive &&
    (hud.totalWaves === 0 || hud.wave < hud.totalWaves);

  const earlyBonus =
    hud.wave > 0 && hud.waveCountdown > 0.5 ? Math.max(5, Math.round(hud.waveCountdown * 2.5)) : 0;

  return (
    <header className="h-14 px-4 bg-[#11192C] border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
      {/* Left: Map & Core Stats + Global Weather State */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-baseline gap-2 shrink-0">
          <span className="font-semibold text-slate-100 whitespace-nowrap">{mapName}</span>
          <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline">
            {difficultyName}
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden sm:block" aria-hidden="true" />

        <div className="flex items-center gap-4 text-sm whitespace-nowrap">
          <div className="flex items-baseline gap-1.5">
            <span className="text-slate-400 text-xs">波次</span>
            <span className="font-mono-num font-semibold text-slate-100">{waveLabel}</span>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-slate-400 text-xs">金币</span>
            <span className="font-mono-num font-semibold text-amber-400">{hud.gold}</span>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-slate-400 text-xs">核心</span>
            <span className={`font-mono-num font-semibold ${hpColor}`}>
              {hud.lives}/{hud.maxLives} · {hpStatusText}
            </span>
          </div>

          <div className="hidden lg:flex items-baseline gap-1.5">
            <span className="text-slate-400 text-xs">得分</span>
            <span className="font-mono-num font-semibold text-slate-200">
              {hud.score.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden md:block" aria-hidden="true" />

        {/* Global Dynamic Weather Indicator */}
        <div
          title={`${weatherDef.name}：${weatherDef.effectText}`}
          className="hidden md:flex flex-col justify-center gap-0.5 min-w-0 shrink-0"
        >
          <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
            <span style={{ color: weatherDef.accentColor }} className="shrink-0">
              <WeatherIcon type={hud.weather.type} className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold" style={{ color: weatherDef.accentColor }}>
              {weatherDef.name}
            </span>
            <span className="text-slate-400 hidden xl:inline">· {weatherDef.shortEffect}</span>
            {isSpecialWeather && (
              <span className="font-mono-num font-semibold text-slate-200">
                {Math.ceil(hud.weather.remaining)}s
              </span>
            )}
          </div>
          {isSpecialWeather && (
            <div className="w-full h-0.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full transition-[width] duration-150"
                style={{
                  width: `${weatherProgress}%`,
                  backgroundColor: weatherDef.accentColor,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right: Tactical Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {canSendNext ? (
          <button
            type="button"
            onClick={onStartNextWave}
            className="h-9 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {hud.wave === 0
                ? '开始首波'
                : earlyBonus > 0
                  ? `提前出波 (+${earlyBonus})`
                  : '下一波'}
            </span>
          </button>
        ) : (
          <div className="h-9 px-3 rounded-lg bg-slate-800/70 text-slate-300 text-xs flex items-center whitespace-nowrap shrink-0 font-mono-num">
            {hud.waveActive ? `敌军剩余 ${hud.enemiesRemaining}` : '波次准备中'}
          </div>
        )}

        <button
          type="button"
          onClick={onToggleShowRanges}
          title="显示全部炮塔射程 (R)"
          aria-pressed={showAllRanges}
          className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            showAllRanges
              ? 'bg-sky-500/20 border-sky-400/60 text-sky-300'
              : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:text-white'
          }`}
        >
          <Radar className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">射程</span>
        </button>

        <button
          type="button"
          onClick={onToggleSpeed}
          title="切换战斗倍速"
          className={`h-9 px-3 rounded-lg border text-xs font-mono-num font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            speedMultiplier === 2
              ? 'bg-sky-500/20 border-sky-400/60 text-sky-300'
              : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:text-white'
          }`}
        >
          <FastForward className="w-3.5 h-3.5" />
          <span>{speedMultiplier}x</span>
        </button>

        <button
          type="button"
          onClick={onTogglePause}
          title={gameState === 'PAUSED' ? '继续游戏 (空格)' : '暂停游戏 (空格)'}
          className="h-9 px-3 rounded-lg bg-slate-800/60 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {gameState === 'PAUSED' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          <span>{gameState === 'PAUSED' ? '继续' : '暂停'}</span>
        </button>

        <div className="h-9 px-2 rounded-lg bg-slate-800/60 border border-slate-700 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            title={muted ? '开启音效与背景音乐' : '静音'}
            aria-label={muted ? '开启音效与背景音乐' : '静音'}
            className="text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            {muted || volume <= 0.01 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={muted ? 0 : Math.round(volume * 100)}
            onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
            aria-label="音量调节"
            title={`音量 ${muted ? 0 : Math.round(volume * 100)}%`}
            className="hidden sm:block w-16 accent-amber-400 cursor-pointer h-1.5"
          />
        </div>

        <button
          type="button"
          onClick={onOpenManual}
          title="指挥官手册 (H)"
          className="h-9 px-3 rounded-lg bg-slate-800/60 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden lg:inline">手册</span>
        </button>

        <button
          type="button"
          onClick={onExitToMenu}
          title="返回主菜单"
          aria-label="返回主菜单"
          className="h-9 w-9 rounded-lg bg-slate-800/60 border border-slate-700 hover:border-slate-600 text-slate-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
        >
          <Home className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
