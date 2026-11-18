import React, { useMemo, useState } from 'react';
import { BookOpen, Check, X } from 'lucide-react';
import {
  ENEMIES,
  TARGETING_LABELS,
  TOWER_LIST,
  TOWER_SYNERGIES,
  TOWERS,
} from '../game/constants';
import { COLOSSUS_SPRITE_URL, TOWER_SPRITE_URLS } from '../game/sprites';
import { EnemyType, TowerLevelStats, TowerType } from '../game/types';

interface CommanderManualModalProps {
  open: boolean;
  onClose: () => void;
}

type ManualTab = 'towers' | 'compare' | 'synergies' | 'enemies';
type CompareMetric = 'dps' | 'damage' | 'range' | 'fireRate' | 'efficiency';

const METRIC_META: Record<
  CompareMetric,
  { label: string; unit: string; format: (v: number) => string }
> = {
  dps: {
    label: '单体秒伤 (DPS)',
    unit: 'DPS',
    format: (v) => v.toFixed(1).replace(/\.0$/, ''),
  },
  damage: {
    label: '单发伤害',
    unit: '伤害',
    format: (v) => String(Math.round(v)),
  },
  range: {
    label: '攻击射程',
    unit: '格',
    format: (v) => v.toFixed(1),
  },
  fireRate: {
    label: '攻击频率',
    unit: '/s',
    format: (v) => v.toFixed(2).replace(/0$/, ''),
  },
  efficiency: {
    label: '性价比 (每100金币DPS)',
    unit: 'DPS/100g',
    format: (v) => v.toFixed(1),
  },
};

function getCumulativeCosts(type: TowerType): [number, number, number] {
  const def = TOWERS[type];
  const c1 = def.cost;
  const c2 = c1 + (def.levels[0].upgradeCost ?? 0);
  const c3 = c2 + (def.levels[1].upgradeCost ?? 0);
  return [c1, c2, c3];
}

function getLevelMetricSeries(type: TowerType, metric: CompareMetric): [number, number, number] {
  const def = TOWERS[type];
  const costs = getCumulativeCosts(type);
  const vals = def.levels.map((lv: TowerLevelStats, idx: number) => {
    const dps = lv.damage * lv.fireRate;
    if (metric === 'dps') return Number(dps.toFixed(2));
    if (metric === 'damage') return lv.damage;
    if (metric === 'range') return lv.range;
    if (metric === 'fireRate') return lv.fireRate;
    return Number(((dps / costs[idx]) * 100).toFixed(2));
  });
  return [vals[0], vals[1], vals[2]];
}

function TowerGlyphFallbackSvg({ type }: { type: TowerType }) {
  if (type === 'gatling') {
    return (
      <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
        <rect x="4" y="4" width="28" height="28" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
        <rect x="18" y="13" width="13" height="3.5" fill="#CBD5E1" />
        <rect x="18" y="19.5" width="13" height="3.5" fill="#CBD5E1" />
        <circle cx="17" cy="18" r="7" fill="#F59E0B" stroke="#0F172A" strokeWidth="1.8" />
      </svg>
    );
  }
  if (type === 'cryo') {
    return (
      <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
        <rect x="4" y="4" width="28" height="28" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
        <polygon points="18,9 26,13.5 26,22.5 18,27 10,22.5 10,13.5" fill="#0284C7" stroke="#7DD3FC" strokeWidth="1.8" />
        <circle cx="18" cy="18" r="3.2" fill="#E0F2FE" />
      </svg>
    );
  }
  if (type === 'mortar') {
    return (
      <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
        <rect x="4" y="4" width="28" height="28" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
        <rect x="14" y="13.5" width="15" height="9" fill="#475569" stroke="#0F172A" strokeWidth="1.5" />
        <rect x="26" y="13" width="4" height="10" fill="#FB7185" />
        <circle cx="15" cy="18" r="6.5" fill="#FB7185" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
      <rect x="4" y="4" width="28" height="28" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="9" fill="none" stroke="#A78BFA" strokeWidth="1.8" />
      <circle cx="18" cy="18" r="5.5" fill="none" stroke="#A78BFA" strokeWidth="1.8" />
      <circle cx="18" cy="18" r="3" fill="#DDD6FE" />
    </svg>
  );
}

function TowerVisual({ type, sizeClass = 'w-9 h-9' }: { type: TowerType; sizeClass?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={`${sizeClass} shrink-0 rounded-lg overflow-hidden bg-[#1E293B] border border-slate-700/80 flex items-center justify-center`}
    >
      {failed ? (
        <TowerGlyphFallbackSvg type={type} />
      ) : (
        <img
          src={TOWER_SPRITE_URLS[type]}
          alt={TOWERS[type].name}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}

function EnemyGlyphVisual({ type, color }: { type: EnemyType; color: string }) {
  const [failed, setFailed] = useState(false);
  if (type === 'colossus' && !failed) {
    return (
      <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden bg-[#0F172A] border border-slate-700/80">
        <img
          src={COLOSSUS_SPRITE_URL}
          alt={ENEMIES.colossus.name}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <svg viewBox="0 0 36 36" className="w-9 h-9 shrink-0" aria-hidden="true">
      <rect x="4" y="4" width="28" height="28" rx="6" fill="#0F172A" stroke="#1E293B" strokeWidth="1.5" />
      {(type === 'scout' || type === 'sprinter') && (
        <polygon points="27,18 11,11 15,18 11,25" fill={color} stroke="#0F172A" strokeWidth="1.5" />
      )}
      {type === 'armored' && (
        <g>
          <rect x="9" y="11" width="18" height="14" rx="3" fill={color} stroke="#0F172A" strokeWidth="1.5" />
          <rect x="14" y="14" width="8" height="8" fill="#475569" />
        </g>
      )}
      {type === 'shielded' && (
        <g>
          <circle cx="18" cy="18" r="10.5" fill="none" stroke="#60A5FA" strokeWidth="1.5" />
          <polygon points="25,18 21.5,24 14.5,24 11,18 14.5,12 21.5,12" fill={color} stroke="#0F172A" strokeWidth="1.4" />
        </g>
      )}
      {type === 'colossus' && (
        <g>
          <circle cx="18" cy="18" r="12" fill="none" stroke="#60A5FA" strokeWidth="1.5" />
          <rect x="9" y="9.5" width="18" height="17" rx="4" fill={color} stroke="#0F172A" strokeWidth="1.6" />
          <circle cx="18" cy="18" r="4.5" fill="#7F1D1D" />
        </g>
      )}
    </svg>
  );
}

function ComparisonCurveChart({
  towers,
  metric,
  height = 220,
  compact = false,
}: {
  towers: TowerType[];
  metric: CompareMetric;
  height?: number;
  compact?: boolean;
}) {
  const meta = METRIC_META[metric];
  const W = compact ? 300 : 640;
  const H = height;
  const padL = compact ? 38 : 54;
  const padR = compact ? 22 : 34;
  const padT = compact ? 24 : 26;
  const padB = compact ? 28 : 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const seriesList = towers.map((t) => ({
    type: t,
    def: TOWERS[t],
    values: getLevelMetricSeries(t, metric),
  }));

  const allValues = seriesList.flatMap((s) => s.values);
  const rawMax = Math.max(1, ...allValues);
  const yMax = rawMax * 1.18;

  const getX = (idx: number) => padL + (idx / 2) * plotW;
  const getY = (val: number) => padT + plotH - (val / yMax) * plotH;

  const gridFractions = compact ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto block select-none"
      role="img"
      aria-label={`${meta.label} 对比曲线图`}
    >
      <defs>
        {seriesList.map((s) => (
          <linearGradient
            key={`grad-${metric}-${s.type}-${compact ? 'c' : 'm'}`}
            id={`grad-${metric}-${s.type}-${compact ? 'c' : 'm'}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={s.def.accentColor} stopOpacity="0.24" />
            <stop offset="100%" stopColor={s.def.accentColor} stopOpacity="0.01" />
          </linearGradient>
        ))}
      </defs>

      {/* Y-axis horizontal gridlines & labels */}
      {gridFractions.map((frac) => {
        const y = padT + plotH - frac * plotH;
        const tickVal = yMax * frac;
        return (
          <g key={frac}>
            <line
              x1={padL}
              y1={y}
              x2={W - padR}
              y2={y}
              stroke="rgba(148, 163, 184, 0.14)"
              strokeDasharray={frac === 0 ? undefined : '3 3'}
            />
            <text
              x={padL - 7}
              y={y + 3.5}
              textAnchor="end"
              fill="#94A3B8"
              fontSize={compact ? 9.5 : 10.5}
              fontFamily="JetBrains Mono, monospace"
            >
              {meta.format(tickVal)}
            </text>
          </g>
        );
      })}

      {/* X-axis level labels */}
      {[0, 1, 2].map((idx) => {
        const x = getX(idx);
        return (
          <g key={idx}>
            <line
              x1={x}
              y1={padT}
              x2={x}
              y2={padT + plotH}
              stroke="rgba(148, 163, 184, 0.08)"
            />
            <text
              x={x}
              y={H - (compact ? 8 : 10)}
              textAnchor="middle"
              fill="#CBD5E1"
              fontSize={compact ? 10 : 11.5}
              fontWeight="600"
              fontFamily="JetBrains Mono, monospace"
            >
              Lv.{idx + 1}
            </text>
          </g>
        );
      })}

      {/* Area fills */}
      {seriesList.map((s) => {
        const pts = s.values.map((v, i) => `${getX(i)},${getY(v)}`);
        const areaPoints = `${getX(0)},${padT + plotH} ${pts.join(' ')} ${getX(2)},${padT + plotH}`;
        return (
          <polygon
            key={`area-${s.type}`}
            points={areaPoints}
            fill={`url(#grad-${metric}-${s.type}-${compact ? 'c' : 'm'})`}
          />
        );
      })}

      {/* Curves & data points */}
      {seriesList.map((s, sIdx) => {
        const linePoints = s.values.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
        const other = seriesList.length === 2 ? seriesList[1 - sIdx] : null;
        return (
          <g key={`line-${s.type}`}>
            <polyline
              fill="none"
              stroke={s.def.accentColor}
              strokeWidth={compact ? 2.2 : 2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={linePoints}
            />
            {s.values.map((val, i) => {
              const cx = getX(i);
              const cy = getY(val);
              const otherVal = other ? other.values[i] : null;
              // Smart label offset so two curves never overlap text labels
              const placeAbove =
                otherVal === null
                  ? true
                  : val > otherVal
                    ? true
                    : val < otherVal
                      ? false
                      : sIdx === 0;
              const dy = placeAbove ? (compact ? -9 : -11) : compact ? 15 : 17;
              return (
                <g key={i}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={compact ? 3.8 : 4.8}
                    fill="#0F172A"
                    stroke={s.def.accentColor}
                    strokeWidth={compact ? 2 : 2.5}
                  />
                  <text
                    x={cx}
                    y={Math.max(12, Math.min(padT + plotH - 4, cy + dy))}
                    textAnchor="middle"
                    fill={s.def.accentColor}
                    fontSize={compact ? 9.5 : 11}
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {meta.format(val)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

const ENEMY_TACTICS: Record<
  EnemyType,
  { trait: string; weakness: string; counter: string }
> = {
  scout: {
    trait: '无护盾、标准移速、成群沿路线推进',
    weakness: '单体耐久低，无抗性减免',
    counter: '机枪哨塔低成本拦截',
  },
  sprinter: {
    trait: '极高移动速度（2.7 格/秒），擅长突防',
    weakness: '易逃离重炮抛射落点，受冰霜减速影响显著',
    counter: '寒冰棱镜控场 + 机枪哨塔点射',
  },
  armored: {
    trait: '重型装甲单位，基础生命值极高',
    weakness: '移动缓慢，易在拐角承受多轮重型火力',
    counter: '重炮要塞高额爆破 + 升级 Lv.2/3 集火',
  },
  shielded: {
    trait: '自带能量护盾，脱战 3.2 秒后自动充能再生',
    weakness: '对电弧线圈存在弱点（承受 2.0× 双倍破盾伤害）',
    counter: '电弧线圈破盾 + 高射速单位防止护盾再生',
  },
  colossus: {
    trait: '首领级单位，兼备高生命与能量护盾，失守扣 5 点耐久',
    weakness: '体型庞大且移动极慢，弱于电弧破盾与寒冰持续减速',
    counter: '寒冰减速 + 电弧破盾 + 满级重炮/机枪协同集火',
  },
};

export const CommanderManualModal: React.FC<CommanderManualModalProps> = ({ open, onClose }) => {
  const [tab, setTab] = useState<ManualTab>('towers');
  const [comparedTowers, setComparedTowers] = useState<TowerType[]>(['gatling', 'mortar']);
  const [activeMetric, setActiveMetric] = useState<CompareMetric>('dps');

  const toggleCompareTower = (type: TowerType) => {
    setComparedTowers((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      if (prev.length < 2) {
        return [...prev, type];
      }
      // Replace the older first slot so switching pairs takes one click
      return [prev[1], type];
    });
  };

  const matchedSynergy = useMemo(() => {
    if (comparedTowers.length !== 2) return null;
    const [a, b] = comparedTowers;
    return (
      TOWER_SYNERGIES.find(
        (s) => (s.pair[0] === a && s.pair[1] === b) || (s.pair[0] === b && s.pair[1] === a)
      ) ?? null
    );
  }, [comparedTowers]);

  if (!open) return null;

  const enemyList = Object.values(ENEMIES);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="指挥官手册"
    >
      <div className="w-full max-w-4xl bg-[#11192C] border border-slate-800 rounded-xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">指挥官战术手册</h2>
              <p className="text-xs text-slate-400 truncate">
                炮塔三阶数值 · 双塔对比曲线 · 协同增益搭配 · 敌军抗性参考
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setTab('towers')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  tab === 'towers'
                    ? 'bg-[#1A2744] text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                炮塔属性
              </button>
              <button
                type="button"
                onClick={() => setTab('compare')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  tab === 'compare'
                    ? 'bg-[#1A2744] text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                炮塔对比
              </button>
              <button
                type="button"
                onClick={() => setTab('synergies')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  tab === 'synergies'
                    ? 'bg-[#1A2744] text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                协同增益
              </button>
              <button
                type="button"
                onClick={() => setTab('enemies')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  tab === 'enemies'
                    ? 'bg-[#1A2744] text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                敌军抗性
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="关闭指挥官手册"
              className="h-9 w-9 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {tab === 'towers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TOWER_LIST.map((tower) => (
                <div
                  key={tower.type}
                  className="bg-[#151F34] border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <TowerVisual type={tower.type} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3
                            className="font-semibold text-base"
                            style={{ color: tower.accentColor }}
                          >
                            {tower.name}
                          </h3>
                          <span className="text-xs text-slate-400 font-mono-num">
                            [{tower.hotkey}]
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{tower.role} · {tower.shortDesc}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-slate-400">建造成本</div>
                      <div className="font-mono-num font-bold text-sm text-amber-400">
                        {tower.cost} 金币
                      </div>
                    </div>
                  </div>

                  {/* Level 1-3 Stats Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-t border-slate-800">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800/80">
                          <th className="py-1.5 font-medium">等级</th>
                          <th className="py-1.5 font-medium">单发伤害</th>
                          <th className="py-1.5 font-medium">射程</th>
                          <th className="py-1.5 font-medium">攻速</th>
                          <th className="py-1.5 font-medium">特性参数</th>
                          <th className="py-1.5 font-medium text-right">升级费</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono-num text-slate-200">
                        {tower.levels.map((lv, idx) => {
                          let special = `${Math.round(lv.damage * lv.fireRate)} DPS`;
                          if (tower.type === 'cryo') {
                            special = `减速 ${Math.round((lv.slowFactor ?? 0) * 100)}% / ${lv.splashRadius}格`;
                          } else if (tower.type === 'mortar') {
                            special = `溅射 ${lv.splashRadius}格`;
                          } else if (tower.type === 'tesla') {
                            special = `连锁 ${lv.chainCount}目标`;
                          }
                          return (
                            <tr key={idx}>
                              <td className="py-1.5 text-slate-300 font-semibold">Lv.{idx + 1}</td>
                              <td className="py-1.5">{lv.damage}</td>
                              <td className="py-1.5">{lv.range} 格</td>
                              <td className="py-1.5">{lv.fireRate}/s</td>
                              <td className="py-1.5 text-slate-300 font-sans">{special}</td>
                              <td className="py-1.5 text-right text-amber-400">
                                {lv.upgradeCost ? lv.upgradeCost : '满级'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Synergy Compatibility Annotation */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="text-slate-400">相邻协同:</span>
                    {TOWER_SYNERGIES.filter((s) => s.pair.includes(tower.type)).map((syn) => {
                      const partnerType =
                        syn.pair[0] === tower.type ? syn.pair[1] : syn.pair[0];
                      const partner = TOWERS[partnerType];
                      return (
                        <span key={syn.id} className="text-slate-200">
                          <span style={{ color: syn.accentColor }} className="font-medium">
                            {syn.name}
                          </span>
                          <span className="text-slate-400"> (+{partner.name})</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'compare' && (
            <div className="space-y-4">
              {/* Dual Tower Checkbox Selector */}
              <div className="bg-[#151F34] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">勾选两座炮塔进行实时对比</h3>
                    <p className="text-xs text-slate-400">
                      点击卡片勾选或切换对比组合，支持查看 Lv.1–Lv.3 成长曲线、总造价与每百金币输出效率。
                    </p>
                  </div>
                  <div className="text-xs font-mono-num text-amber-400 font-semibold">
                    已选 {comparedTowers.length} / 2 座
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {TOWER_LIST.map((tower) => {
                    const checked = comparedTowers.includes(tower.type);
                    return (
                      <button
                        key={tower.type}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggleCompareTower(tower.type)}
                        className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          checked
                            ? 'bg-[#1A2744] border-slate-500'
                            : 'bg-[#0F172A] border-slate-800 hover:border-slate-700 opacity-75'
                        }`}
                        style={checked ? { borderColor: tower.accentColor } : undefined}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <TowerVisual type={tower.type} sizeClass="w-8 h-8" />
                          <div className="min-w-0">
                            <div
                              className="text-xs font-semibold truncate"
                              style={{ color: checked ? tower.accentColor : '#E2E8F0' }}
                            >
                              {tower.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono-num">
                              {tower.cost} 金币
                            </div>
                          </div>
                        </div>
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                            checked
                              ? 'text-slate-950 border-transparent'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                          style={checked ? { backgroundColor: tower.accentColor } : undefined}
                          aria-hidden="true"
                        >
                          {checked && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {comparedTowers.length < 2 ? (
                <div className="bg-[#151F34] border border-slate-800 rounded-xl p-6 text-center text-sm text-slate-400">
                  请从上方至少勾选两座不同炮塔，以生成完整的 DPS 与属性增长曲线对比图。
                </div>
              ) : (
                <>
                  {/* Synergy Quick Banner when pair matches */}
                  {matchedSynergy && (
                    <div className="bg-[#151F34] border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">组合相邻协同:</span>
                        <span
                          className="font-semibold"
                          style={{ color: matchedSynergy.accentColor }}
                        >
                          {matchedSynergy.name}
                        </span>
                      </div>
                      <div className="text-slate-300 font-mono-num">
                        {TOWERS[comparedTowers[0]].name}:{' '}
                        {matchedSynergy.effectsByTower[comparedTowers[0]]} ·{' '}
                        {TOWERS[comparedTowers[1]].name}:{' '}
                        {matchedSynergy.effectsByTower[comparedTowers[1]]}
                      </div>
                    </div>
                  )}

                  {/* Primary Interactive Growth Curve Chart */}
                  <div className="bg-[#151F34] border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-4">
                        <h3 className="text-sm font-semibold text-white">
                          {METRIC_META[activeMetric].label} 成长曲线
                        </h3>
                        <div className="flex items-center gap-3 text-xs">
                          {comparedTowers.map((t) => {
                            const def = TOWERS[t];
                            const vals = getLevelMetricSeries(t, activeMetric);
                            const growthPct = Math.round(((vals[2] - vals[0]) / Math.max(0.01, vals[0])) * 100);
                            return (
                              <span key={t} className="flex items-center gap-1.5 whitespace-nowrap">
                                <span
                                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                                  style={{ backgroundColor: def.accentColor }}
                                />
                                <span className="text-slate-200 font-medium">{def.name}</span>
                                <span className="text-slate-400 font-mono-num">
                                  ({growthPct >= 0 ? `+${growthPct}%` : `${growthPct}%`})
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-lg">
                        {(
                          [
                            ['dps', 'DPS'],
                            ['damage', '伤害'],
                            ['range', '射程'],
                            ['fireRate', '攻速'],
                            ['efficiency', '性价比'],
                          ] as [CompareMetric, string][]
                        ).map(([mKey, label]) => (
                          <button
                            key={mKey}
                            type="button"
                            onClick={() => setActiveMetric(mKey)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                              activeMetric === mKey
                                ? 'bg-[#1A2744] text-amber-400'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <ComparisonCurveChart towers={comparedTowers} metric={activeMetric} height={215} />
                  </div>

                  {/* Secondary 3-Metric Growth Curves */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(['damage', 'range', 'fireRate'] as CompareMetric[]).map((mKey) => (
                      <div
                        key={mKey}
                        className="bg-[#151F34] border border-slate-800 rounded-xl p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200">
                            {METRIC_META[mKey].label}
                          </span>
                          <span className="text-slate-400 font-mono-num">
                            {METRIC_META[mKey].unit}
                          </span>
                        </div>
                        <ComparisonCurveChart
                          towers={comparedTowers}
                          metric={mKey}
                          height={138}
                          compact
                        />
                      </div>
                    ))}
                  </div>

                  {/* Detailed Side-by-Side Lv.1-Lv.3 Stat Breakdown */}
                  <div className="bg-[#151F34] border border-slate-800 rounded-xl p-4 overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800">
                          <th className="py-2 font-medium">对比项目</th>
                          {comparedTowers.map((t) => (
                            <th
                              key={t}
                              className="py-2 font-semibold"
                              style={{ color: TOWERS[t].accentColor }}
                            >
                              {TOWERS[t].name}
                            </th>
                          ))}
                          <th className="py-2 font-medium text-right">差值对比</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70 font-mono-num text-slate-200">
                        {(() => {
                          const [tA, tB] = comparedTowers;
                          const dpsA = getLevelMetricSeries(tA, 'dps');
                          const dpsB = getLevelMetricSeries(tB, 'dps');
                          const effA = getLevelMetricSeries(tA, 'efficiency');
                          const effB = getLevelMetricSeries(tB, 'efficiency');
                          const costA = getCumulativeCosts(tA);
                          const costB = getCumulativeCosts(tB);

                          const rows: {
                            label: string;
                            valA: string;
                            valB: string;
                            numA: number;
                            numB: number;
                            lowerBetter?: boolean;
                          }[] = [
                            {
                              label: 'Lv.1 单体 DPS',
                              valA: `${dpsA[0]}`,
                              valB: `${dpsB[0]}`,
                              numA: dpsA[0],
                              numB: dpsB[0],
                            },
                            {
                              label: 'Lv.2 单体 DPS',
                              valA: `${dpsA[1]}`,
                              valB: `${dpsB[1]}`,
                              numA: dpsA[1],
                              numB: dpsB[1],
                            },
                            {
                              label: 'Lv.3 满级 DPS',
                              valA: `${dpsA[2]}`,
                              valB: `${dpsB[2]}`,
                              numA: dpsA[2],
                              numB: dpsB[2],
                            },
                            {
                              label: 'DPS 满级增幅',
                              valA: `+${Math.round(((dpsA[2] - dpsA[0]) / dpsA[0]) * 100)}%`,
                              valB: `+${Math.round(((dpsB[2] - dpsB[0]) / dpsB[0]) * 100)}%`,
                              numA: (dpsA[2] - dpsA[0]) / dpsA[0],
                              numB: (dpsB[2] - dpsB[0]) / dpsB[0],
                            },
                            {
                              label: '满级累计投入金币',
                              valA: `${costA[2]} 金币`,
                              valB: `${costB[2]} 金币`,
                              numA: costA[2],
                              numB: costB[2],
                              lowerBetter: true,
                            },
                            {
                              label: '满级每百金币 DPS',
                              valA: `${effA[2]}`,
                              valB: `${effB[2]}`,
                              numA: effA[2],
                              numB: effB[2],
                            },
                          ];

                          return rows.map((row) => {
                            const aWins = row.lowerBetter
                              ? row.numA < row.numB
                              : row.numA > row.numB;
                            const bWins = row.lowerBetter
                              ? row.numB < row.numA
                              : row.numB > row.numA;
                            const diffPct =
                              row.numA === row.numB
                                ? 0
                                : Math.round(
                                    (Math.abs(row.numA - row.numB) /
                                      Math.max(0.01, Math.min(row.numA, row.numB))) *
                                      100
                                  );
                            const winnerName = aWins
                              ? TOWERS[tA].name
                              : bWins
                                ? TOWERS[tB].name
                                : '持平';
                            const winnerColor = aWins
                              ? TOWERS[tA].accentColor
                              : bWins
                                ? TOWERS[tB].accentColor
                                : '#94A3B8';

                            return (
                              <tr key={row.label}>
                                <td className="py-2 font-sans text-slate-300">{row.label}</td>
                                <td
                                  className="py-2 font-semibold"
                                  style={aWins ? { color: TOWERS[tA].accentColor } : undefined}
                                >
                                  {row.valA}
                                </td>
                                <td
                                  className="py-2 font-semibold"
                                  style={bWins ? { color: TOWERS[tB].accentColor } : undefined}
                                >
                                  {row.valB}
                                </td>
                                <td className="py-2 text-right font-sans">
                                  <span style={{ color: winnerColor }}>
                                    {diffPct === 0 ? '持平' : `${winnerName} 领先 ${diffPct}%`}
                                  </span>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'synergies' && (
            <div className="space-y-5">
              {/* Visual Adjacency Trigger Banner */}
              <div className="bg-[#151F34] border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">
                    相邻协同触发规则（八向邻格）
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    将可协同的两种炮塔放置在上下左右或斜角相邻格中，战场会自动建立能量连线并激活双方共享增益；同一炮塔可同时激活多种不同协同。
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs text-sky-300 font-mono-num">
                  <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
                    {[0, 1, 2].map((r) =>
                      [0, 1, 2].map((c) => {
                        const isCenter = r === 1 && c === 1;
                        return (
                          <rect
                            key={`${r}-${c}`}
                            x={c * 8 + 2}
                            y={r * 8 + 2}
                            width={6}
                            height={6}
                            rx={1}
                            fill={isCenter ? '#F59E0B' : '#38BDF8'}
                            opacity={isCenter ? 1 : 0.45}
                          />
                        );
                      })
                    )}
                  </svg>
                  <span>3×3 邻格生效</span>
                </div>
              </div>

              {/* 4 Pairwise Visual Synergy Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TOWER_SYNERGIES.map((syn) => {
                  const towerA = TOWERS[syn.pair[0]];
                  const towerB = TOWERS[syn.pair[1]];
                  return (
                    <div
                      key={syn.id}
                      className="bg-[#151F34] border border-slate-800 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <TowerVisual type={towerA.type} />
                          <svg width="34" height="14" viewBox="0 0 34 14" aria-hidden="true">
                            <line
                              x1="2"
                              y1="7"
                              x2="32"
                              y2="7"
                              stroke={syn.accentColor}
                              strokeWidth="2"
                            />
                            <polygon
                              points="17,2 22,7 17,12 12,7"
                              fill={syn.accentColor}
                            />
                          </svg>
                          <TowerVisual type={towerB.type} />
                        </div>

                        <div className="text-right min-w-0">
                          <div
                            className="text-sm font-bold"
                            style={{ color: syn.accentColor }}
                          >
                            {syn.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {towerA.name} + {towerB.name}
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">{syn.summary}</p>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                        <div>
                          <div className="font-medium" style={{ color: towerA.accentColor }}>
                            {towerA.name}
                          </div>
                          <div className="text-slate-200 font-mono-num mt-0.5">
                            {syn.effectsByTower[towerA.type]}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: towerB.accentColor }}>
                            {towerB.name}
                          </div>
                          <div className="text-slate-200 font-mono-num mt-0.5">
                            {syn.effectsByTower[towerB.type]}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tactical Notes */}
              <div className="bg-[#151F34] border border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <div className="font-semibold text-amber-400">集火策略配合</div>
                  <p className="text-slate-300 leading-relaxed">
                    支持切换四种目标优先级：
                    <span className="text-slate-100">
                      {' '}
                      {Object.values(TARGETING_LABELS).join(' / ')}
                    </span>
                    。电弧线圈建议设为「血量最高」优先破盾，机枪哨塔设为「优先最前」防止漏怪。
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-emerald-400">经济与高地布局</div>
                  <p className="text-slate-300 leading-relaxed">
                    提前出波每秒返还 2.5 金币；出售炮塔返还累计投入的 72% 金币，前期可在拐角枢纽先行铺设 1 级组合激活协同。
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'enemies' && (
            <div className="space-y-3">
              {enemyList.map((enemy) => {
                const tactics = ENEMY_TACTICS[enemy.type];
                return (
                  <div
                    key={enemy.type}
                    className="bg-[#151F34] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 md:w-5/12">
                      <EnemyGlyphVisual type={enemy.type} color={enemy.color} />
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-white">{enemy.name}</h3>
                          <span className="text-xs text-rose-400 font-mono-num">
                            突破扣 {enemy.coreDamage} 耐久
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {enemy.description}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono-num text-slate-300 pt-0.5">
                          <span>生命 {enemy.maxHp}</span>
                          <span>护盾 {enemy.maxShield > 0 ? enemy.maxShield : '无'}</span>
                          <span>移速 {enemy.speed} 格/秒</span>
                          <span className="text-amber-400">赏金 +{enemy.reward}</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:w-7/12 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
                      <div>
                        <div className="text-slate-400 mb-0.5">机制特性</div>
                        <div className="text-slate-200 leading-relaxed">{tactics.trait}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 mb-0.5">抗性与弱点</div>
                        <div className="text-slate-200 leading-relaxed">{tactics.weakness}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 mb-0.5">推荐对策</div>
                        <div className="text-emerald-400 font-medium leading-relaxed">
                          {tactics.counter}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
