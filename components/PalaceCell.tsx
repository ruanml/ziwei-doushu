'use client';
import { motion } from 'framer-motion';
import type { Palace, Star } from '@/lib/ziwei/types';
import { STEMS, BRANCHES } from '@/lib/ziwei/constants';
import clsx from 'clsx';

interface PalaceCellProps {
  palace: Palace;
  onClick?: () => void;
  onStarClick?: (star: Star) => void;
  isSelected?: boolean;
  isSanFang?: boolean;
  delay?: number;
  /** 叠加四化：星名 → 四化类型（'禄'/'权'/'科'/'忌'） */
  overlayStarSiHua?: Record<string, string>;
  /** 叠加标签：'年'（流年）或 '限'（大限） */
  overlayLabel?: string;
  /** 点击叠加四化 badge 回调 */
  onSiHuaClick?: (starName: string, siHua: string) => void;
}

const SIHUA_COLORS: Record<string, { bg: string; lightBg: string; border: string; text: string }> = {
  '禄': { bg: '#1f7a4c', lightBg: 'rgba(31,122,76,0.13)', border: 'rgba(31,122,76,0.45)', text: '#1f7a4c' },
  '权': { bg: '#1d5bbf', lightBg: 'rgba(29,91,191,0.13)', border: 'rgba(29,91,191,0.45)', text: '#1d5bbf' },
  '科': { bg: '#9a6b10', lightBg: 'rgba(154,107,16,0.15)', border: 'rgba(154,107,16,0.45)', text: '#8b5e0a' },
  '忌': { bg: '#b82e24', lightBg: 'rgba(184,46,36,0.13)', border: 'rgba(184,46,36,0.45)', text: '#b82e24' },
};

const SiHuaBadge = ({
  siHua,
  overlay,
  label,
  onClick,
}: {
  siHua: string;
  overlay?: boolean;
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
}) => {
  const c = SIHUA_COLORS[siHua] ?? SIHUA_COLORS['禄'];
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-1.5 py-px font-semibold leading-snug flex-shrink-0',
        onClick && 'cursor-pointer hover:opacity-90',
      )}
      style={
        overlay
          ? {
              fontSize: '10.5px',
              background: c.lightBg,
              border: `1px solid ${c.border}`,
              color: c.text,
            }
          : {
              fontSize: '11px',
              background: c.bg,
              color: '#ffffff',
            }
      }
      onClick={onClick}
    >
      {overlay && label && <span className="mr-px">{label}</span>}
      {siHua}
    </span>
  );
};

export default function PalaceCell({
  palace,
  onClick,
  onStarClick,
  isSelected,
  isSanFang,
  delay = 0,
  overlayStarSiHua,
  overlayLabel,
  onSiHuaClick,
}: PalaceCellProps) {
  const { branch, stem, name, stars, daXianAge, isCurrentDaXian, isMingGong, isShenGong } = palace;
  const ganzhi = `${STEMS[stem]}${BRANCHES[branch]}`;

  const majorStars = stars.filter(s => s.type === 'major');
  const luckyStars = stars.filter(s => s.type === 'lucky');
  const shaStars = stars.filter(s => s.type === 'sha');
  const minorStars = stars.filter(s => s.type === 'minor');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      onClick={onClick}
      className="palace-cell relative flex flex-col justify-between cursor-pointer transition-all duration-200 h-full"
      style={{
        minHeight: '138px',
        background: isSelected
          ? 'rgba(184,136,36,0.12)'
          : isSanFang
          ? 'rgba(29,91,191,0.06)'
          : isCurrentDaXian
          ? 'rgba(184,136,36,0.05)'
          : 'var(--t-bg)',
        boxShadow: isSelected
          ? 'inset 0 0 0 2px var(--t-gold)'
          : isSanFang
          ? 'inset 0 0 0 1.5px rgba(29,91,191,0.42)'
          : isCurrentDaXian
          ? 'inset 3px 0 0 var(--t-gold)'
          : 'none',
      }}
    >
      {/* ── 上半区：主星 + 辅煞杂曜 ── */}
      <div className="min-w-0 px-1 sm:px-2.5 pt-2.5 pb-1.5 flex flex-col gap-1.5 flex-1">
        {/* 主星列表 */}
        <div className="flex flex-col gap-1">
          {majorStars.length === 0 && (
            <span className="text-xs italic" style={{ color: 'var(--t-faint)' }}>
              空宫{palace.borrowedFromName ? `（借${palace.borrowedFromName}）` : ''}
            </span>
          )}
          {majorStars.map(star => {
            const overlaySiHua = overlayStarSiHua?.[star.name];
            return (
              <div
                key={star.name}
                className="flex items-center gap-1 flex-wrap"
                onClick={e => {
                  e.stopPropagation();
                  onStarClick?.(star);
                }}
              >
                <span
                  className={clsx(
                    'leading-tight font-bold tracking-wide cursor-pointer hover:brightness-110 transition-all',
                    star.brightness === 'bright'
                      ? 'text-amber-300'
                      : star.brightness === 'dim'
                      ? 'text-amber-700/80'
                      : 'text-amber-500',
                  )}
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '16px',
                  }}
                >
                  {star.name}
                </span>
                {star.brightnessRaw && (
                  <span
                    className="rounded px-1 py-px font-semibold leading-none"
                    style={{
                      fontSize: '10px',
                      background: star.brightness === 'dim' ? 'rgba(128,128,128,0.12)' : 'rgba(184,136,36,0.14)',
                      color: star.brightness === 'dim' ? 'var(--t-faint)' : 'var(--t-gold)',
                    }}
                  >
                    {star.brightnessRaw}
                  </span>
                )}
                {star.siHua && <SiHuaBadge siHua={star.siHua} />}
                {overlaySiHua && (
                  <SiHuaBadge
                    siHua={overlaySiHua}
                    overlay
                    label={overlayLabel}
                    onClick={e => {
                      e.stopPropagation();
                      onSiHuaClick?.(star.name, overlaySiHua);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* 辅星 / 煞星 / 杂曜 */}
        <div className="flex flex-col gap-0.5 mt-0.5">
          {luckyStars.length > 0 && (
            <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
              {luckyStars.map(s => {
                const overlaySiHua = overlayStarSiHua?.[s.name];
                return (
                  <span
                    key={s.name}
                    className="inline-flex items-center gap-0.5 text-xs font-medium leading-snug"
                    style={{ color: '#1d5bbf' }}
                  >
                    {s.name}
                    {s.siHua && <SiHuaBadge siHua={s.siHua} />}
                    {overlaySiHua && (
                      <SiHuaBadge
                        siHua={overlaySiHua}
                        overlay
                        label={overlayLabel}
                        onClick={e => {
                          e.stopPropagation();
                          onSiHuaClick?.(s.name, overlaySiHua);
                        }}
                      />
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {shaStars.length > 0 && (
            <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
              {shaStars.map(s => (
                <span
                  key={s.name}
                  className="inline-flex items-center gap-0.5 text-xs font-medium leading-snug"
                  style={{ color: '#b83227' }}
                >
                  {s.name}
                  {s.siHua && <SiHuaBadge siHua={s.siHua} />}
                </span>
              ))}
            </div>
          )}

          {minorStars.length > 0 && (
            <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
              {minorStars.map(s => (
                <span
                  key={s.name}
                  className="inline-flex items-center gap-0.5 text-[11.5px] leading-snug"
                  style={{ color: 'var(--t-text2)' }}
                >
                  {s.name}{s.brightnessRaw ? `[${s.brightnessRaw}]` : ''}
                  {s.siHua && <SiHuaBadge siHua={s.siHua} />}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 底部宫位信息栏（干支 · 大限 · 宫名） ── */}
      <div
        className="px-1 sm:px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1"
        style={{
          borderTop: '1px solid var(--t-border)',
          background: isMingGong
            ? 'rgba(184,136,36,0.14)'
            : isCurrentDaXian
            ? 'rgba(184,136,36,0.09)'
            : 'var(--t-surface)',
        }}
      >
        {/* 干支 */}
        <span className="text-xs font-mono font-semibold" style={{ color: 'var(--t-text2)' }}>
          {ganzhi}
        </span>

        {/* 大限年龄段 */}
        {daXianAge && (
          <span
            className="text-[11.5px] font-mono tabular-nums inline-flex flex-wrap items-center gap-1"
            style={{
              color: isCurrentDaXian ? 'var(--t-gold)' : 'var(--t-faint)',
              fontWeight: isCurrentDaXian ? 700 : 500,
            }}
          >
            {daXianAge[0]}–{daXianAge[1]}
            {isCurrentDaXian && (
              <span
                className="text-[9.5px] px-1 rounded font-sans font-semibold leading-tight"
                style={{
                  background: 'rgba(184,136,36,0.16)',
                  border: '1px solid var(--t-border-acc)',
                  color: 'var(--t-gold)',
                }}
              >
                大限
              </span>
            )}
          </span>
        )}

        {/* 命/身方印 + 宫名 */}
        <div className="flex items-center gap-1">
          {isMingGong && (
            <span
              className="text-[10px] px-1 rounded font-semibold leading-tight"
              style={{ background: '#a63429', color: '#ffffff' }}
            >
              命
            </span>
          )}
          {isShenGong && (
            <span
              className="text-[10px] px-1 rounded font-semibold leading-tight"
              style={{ background: '#1d5bbf', color: '#ffffff' }}
            >
              身
            </span>
          )}
          <span
            className="font-bold tracking-wide"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '13.5px',
              color: isMingGong ? 'var(--t-gold)' : 'var(--t-text)',
            }}
          >
            {name}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
