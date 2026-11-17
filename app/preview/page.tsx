'use client';
import { useState } from 'react';
import { generateChart } from '@/lib/ziwei/algorithm';
import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import type { Palace, Star, ZiweiChart } from '@/lib/ziwei/types';
import { getYearStemIndex, buildSiHuaOverlay } from '@/components/TimeNav';

// 生成与截图一致的真实命盘（1990年农历六月初八 戌时 → 命宫戊寅 太阳巨门、身宫戊子 夫妻宫、土五局）
const DEMO_CHART: ZiweiChart = generateChart({
  year: 1990,
  month: 7,
  day: 29,
  hour: 10,
  gender: 'male',
  name: '示例命盘',
});

const BRANCH_GRID_POS: Record<number, [number, number]> = {
  5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4],
  4: [2, 1], 9: [2, 4],
  3: [3, 1], 10: [3, 4],
  2: [4, 1], 1: [4, 2], 0: [4, 3], 11: [4, 4],
};

const ORDER = [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4];

// 大限叠加四化（演示截图中的「限禄 / 限权 / 限科 / 限忌」效果）
function getDemoOverlay(chart: ZiweiChart): Record<string, string> {
  const dx = chart.daXians[chart.currentDaXianIndex];
  if (!dx) return {};
  const p = chart.palaces.find(pal => pal.branch === dx.palaceBranch);
  return p ? buildSiHuaOverlay(p.stem) : {};
}

const SIHUA_SOLID_COLOR: Record<string, { bg: string; text: string; border: string; lightBg: string }> = {
  '禄': { bg: '#1f7a4c', text: '#ffffff', border: '#1f7a4c', lightBg: 'rgba(31,122,76,0.12)' },
  '权': { bg: '#1d5bbf', text: '#ffffff', border: '#1d5bbf', lightBg: 'rgba(29,91,191,0.12)' },
  '科': { bg: '#9a6b10', text: '#ffffff', border: '#9a6b10', lightBg: 'rgba(154,107,16,0.14)' },
  '忌': { bg: '#b82e24', text: '#ffffff', border: '#b82e24', lightBg: 'rgba(184,46,36,0.12)' },
};

// ═══════════════════════════════════════════════════════════════════════
// 方案一：古籍雅印 · 经典增强版（底栏式宫名干支 + 16px 大字主星 + 实心本命四化章）
// ═══════════════════════════════════════════════════════════════════════
function DesignOneBoard({ chart, overlay }: { chart: ZiweiChart; overlay: Record<string, string> }) {
  const [selected, setSelected] = useState<number | null>(2); // 默认选中命宫寅
  const palaceMap: Record<number, Palace> = {};
  chart.palaces.forEach(p => { palaceMap[p.branch] = p; });
  const dx = chart.daXians[chart.currentDaXianIndex];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '1px',
        background: '#c9b382',
        border: '2px solid #b89b5e',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(120,85,20,0.12)',
      }}
    >
      {ORDER.map(branch => {
        const [row, col] = BRANCH_GRID_POS[branch];
        const p = palaceMap[branch];
        if (!p) return null;
        const isSel = selected === branch;
        const major = p.stars.filter(s => s.type === 'major');
        const lucky = p.stars.filter(s => s.type === 'lucky');
        const sha = p.stars.filter(s => s.type === 'sha');
        const minor = p.stars.filter(s => s.type === 'minor');
        const ganzhi = `${STEMS[p.stem]}${BRANCHES[p.branch]}`;

        return (
          <div
            key={branch}
            onClick={() => setSelected(branch)}
            style={{
              gridRow: row,
              gridColumn: col,
              minHeight: '148px',
              background: isSel
                ? '#fdf5df'
                : p.isCurrentDaXian
                ? '#fcf7ea'
                : '#fffdf8',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              boxShadow: isSel
                ? 'inset 0 0 0 2px #9a6a10'
                : p.isCurrentDaXian
                ? 'inset 3px 0 0 #b8861b'
                : 'none',
            }}
          >
            {/* 上部：主星 + 四化 */}
            <div style={{ padding: '10px 10px 6px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                {major.length === 0 ? (
                  <span style={{ fontSize: '13px', color: '#9e927d', fontStyle: 'italic' }}>
                    空宫{p.borrowedFromName ? `（借${p.borrowedFromName}）` : ''}
                  </span>
                ) : (
                  major.map(star => {
                    const ov = overlay[star.name];
                    return (
                      <div key={star.name} style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-serif)',
                            fontSize: '16px',
                            fontWeight: 700,
                            color: star.brightness === 'dim' ? '#78623a' : '#5c3704',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {star.name}
                        </span>
                        {star.brightnessRaw && (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 4px',
                              borderRadius: '3px',
                              background: star.brightness === 'dim' ? 'rgba(0,0,0,0.06)' : 'rgba(154,106,16,0.12)',
                              color: star.brightness === 'dim' ? '#7a7265' : '#8b5e0a',
                              fontWeight: 600,
                            }}
                          >
                            {star.brightnessRaw}
                          </span>
                        )}
                        {star.siHua && (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: SIHUA_SOLID_COLOR[star.siHua].bg,
                              color: '#fff',
                              fontWeight: 600,
                              lineHeight: 1.3,
                            }}
                          >
                            {star.siHua}
                          </span>
                        )}
                        {ov && (
                          <span
                            style={{
                              fontSize: '10.5px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: SIHUA_SOLID_COLOR[ov].lightBg,
                              border: `1px solid ${SIHUA_SOLID_COLOR[ov].border}`,
                              color: SIHUA_SOLID_COLOR[ov].bg,
                              fontWeight: 600,
                              lineHeight: 1.25,
                            }}
                          >
                            限{ov}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* 中部：吉星 / 煞星 / 杂曜 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {lucky.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {lucky.map(s => {
                      const ov = overlay[s.name];
                      return (
                        <span key={s.name} style={{ fontSize: '12px', color: '#1b5dab', fontWeight: 500 }}>
                          {s.name}
                          {s.siHua && (
                            <span style={{ marginLeft: 2, fontSize: '10px', padding: '0 4px', borderRadius: 3, background: SIHUA_SOLID_COLOR[s.siHua].bg, color: '#fff' }}>
                              {s.siHua}
                            </span>
                          )}
                          {ov && (
                            <span style={{ marginLeft: 2, fontSize: '10px', padding: '0 4px', borderRadius: 3, border: `1px solid ${SIHUA_SOLID_COLOR[ov].border}`, color: SIHUA_SOLID_COLOR[ov].bg }}>
                              限{ov}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
                {sha.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {sha.map(s => (
                      <span key={s.name} style={{ fontSize: '12px', color: '#b83227', fontWeight: 500 }}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
                {minor.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {minor.map(s => (
                      <span key={s.name} style={{ fontSize: '11.5px', color: '#6e6454' }}>
                        {s.name}{s.brightnessRaw ? `[${s.brightnessRaw}]` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 底部宫位信息栏（干支 · 大限 · 宫名清晰分栏） */}
            <div
              style={{
                padding: '5px 10px',
                borderTop: '1px solid rgba(184,155,94,0.28)',
                background: p.isMingGong
                  ? 'rgba(184,136,36,0.14)'
                  : p.isCurrentDaXian
                  ? 'rgba(184,136,36,0.09)'
                  : 'rgba(235,225,202,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#5c5242', fontWeight: 600 }}>
                {ganzhi}
              </span>
              {p.daXianAge && (
                <span
                  style={{
                    fontSize: '11.5px',
                    fontFamily: 'var(--font-mono)',
                    color: p.isCurrentDaXian ? '#8b5e0a' : '#736754',
                    fontWeight: p.isCurrentDaXian ? 700 : 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  {p.daXianAge[0]}–{p.daXianAge[1]}
                  {p.isCurrentDaXian && (
                    <span
                      style={{
                        fontSize: '9.5px',
                        padding: '0 4px',
                        borderRadius: '3px',
                        background: 'rgba(154,106,16,0.16)',
                        border: '1px solid rgba(154,106,16,0.38)',
                        color: '#784c04',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      大限
                    </span>
                  )}
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                {p.isMingGong && (
                  <span style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', background: '#a63429', color: '#fff', fontWeight: 600 }}>
                    命
                  </span>
                )}
                {p.isShenGong && (
                  <span style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', background: '#1d5bbf', color: '#fff', fontWeight: 600 }}>
                    身
                  </span>
                )}
                <span
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    color: p.isMingGong ? '#854d06' : '#262118',
                  }}
                >
                  {p.name}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* 中宫信息区 */}
      <div
        style={{
          gridRow: '2 / 4',
          gridColumn: '2 / 4',
          background: '#faf5e8',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 700, letterSpacing: '0.25em', color: '#785008' }}>
          ✦ 紫微斗数命盘 ✦
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, auto)',
            gap: '8px 18px',
            fontSize: '13px',
            color: '#3d3528',
            background: '#fffdf8',
            border: '1px solid rgba(184,155,94,0.35)',
            borderRadius: '8px',
            padding: '10px 18px',
          }}
        >
          <div>五行局：<strong style={{ color: '#785008' }}>{chart.wuxingJuName}</strong></div>
          <div>命宫：<strong style={{ color: '#785008' }}>{BRANCHES[chart.mingGongBranch]}宫</strong></div>
          <div>身宫：<strong style={{ color: '#1d5bbf' }}>{BRANCHES[chart.shenGongBranch]}宫</strong></div>
          <div>命主：<strong>{chart.mingZhu ?? '-'}</strong></div>
          <div>身主：<strong>{chart.shenZhu ?? '-'}</strong></div>
          <div>虚岁：<strong>{chart.currentAge}岁</strong></div>
        </div>
        {dx && (
          <div
            style={{
              border: '1px solid rgba(154,106,16,0.38)',
              background: 'rgba(184,136,36,0.10)',
              borderRadius: '8px',
              padding: '7px 18px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '12.5px', color: '#784c04', fontWeight: 600 }}>
              当前大限：{dx.startAge}–{dx.endAge} 岁 · 行运【{dx.palaceName}】
            </span>
          </div>
        )}
        <div style={{ fontSize: '12px', color: '#6e6350', fontFamily: 'var(--font-mono)' }}>
          农历 {chart.lunarInfo.lunarYear}年{chart.lunarInfo.lunarMonth}月{chart.lunarInfo.lunarDay}日
          {chart.lunarInfo.fourPillars ? ` · 四柱 ${chart.lunarInfo.fourPillars.join(' ')}` : ''}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 方案二：传统排盘室 · 左右分栏+三格底栏版（主星与辅煞左右分列，底部三格表头）
// ═══════════════════════════════════════════════════════════════════════
function DesignTwoBoard({ chart, overlay }: { chart: ZiweiChart; overlay: Record<string, string> }) {
  const palaceMap: Record<number, Palace> = {};
  chart.palaces.forEach(p => { palaceMap[p.branch] = p; });
  const dx = chart.daXians[chart.currentDaXianIndex];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '1px',
        background: '#8c734b',
        border: '2px solid #755c34',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      {ORDER.map(branch => {
        const [row, col] = BRANCH_GRID_POS[branch];
        const p = palaceMap[branch];
        if (!p) return null;
        const major = p.stars.filter(s => s.type === 'major');
        const lucky = p.stars.filter(s => s.type === 'lucky');
        const sha = p.stars.filter(s => s.type === 'sha');
        const minor = p.stars.filter(s => s.type === 'minor');
        const ganzhi = `${STEMS[p.stem]}${BRANCHES[p.branch]}`;

        return (
          <div
            key={branch}
            style={{
              gridRow: row,
              gridColumn: col,
              minHeight: '152px',
              background: p.isCurrentDaXian ? '#f6f1fc' : '#fbf8f1',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* 上部：左主星、右辅煞杂曜 */}
            <div style={{ padding: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', flex: 1 }}>
              {/* 左栏：主星 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderRight: '1px dashed rgba(140,115,75,0.22)', paddingRight: '6px' }}>
                {major.length === 0 ? (
                  <span style={{ fontSize: '13px', color: '#9c907e' }}>空宫</span>
                ) : (
                  major.map(star => {
                    const ov = overlay[star.name];
                    return (
                      <div key={star.name}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '16.5px', fontWeight: 700, color: '#6b3e06' }}>
                            {star.name}
                          </span>
                          {star.brightnessRaw && (
                            <span style={{ fontSize: '11px', color: '#8a6d3b', fontWeight: 600 }}>
                              {star.brightnessRaw}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '3px', marginTop: '2px', flexWrap: 'wrap' }}>
                          {star.siHua && (
                            <span style={{ fontSize: '10.5px', padding: '0 4px', borderRadius: 2, background: SIHUA_SOLID_COLOR[star.siHua].bg, color: '#fff', fontWeight: 600 }}>
                              生{star.siHua}
                            </span>
                          )}
                          {ov && (
                            <span style={{ fontSize: '10.5px', padding: '0 4px', borderRadius: 2, border: `1px solid ${SIHUA_SOLID_COLOR[ov].border}`, color: SIHUA_SOLID_COLOR[ov].bg, fontWeight: 600 }}>
                              限{ov}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 右栏：吉煞杂曜 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignContent: 'start' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {lucky.map(s => (
                    <span key={s.name} style={{ fontSize: '12px', color: '#1858a8', fontWeight: 600 }}>
                      {s.name}{s.siHua ? `[${s.siHua}]` : ''}
                    </span>
                  ))}
                  {sha.map(s => (
                    <span key={s.name} style={{ fontSize: '12px', color: '#b52b21', fontWeight: 600 }}>
                      {s.name}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                  {minor.map(s => (
                    <span key={s.name} style={{ fontSize: '11.5px', color: '#665c4c' }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 底部传统三格栏：[干支] | [大限] | [宫名] */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '48px 1fr 64px',
                borderTop: '1px solid #b59e78',
                background: p.isMingGong ? '#f2e2be' : '#efe8d8',
                fontSize: '12px',
                textAlign: 'center',
              }}
            >
              <div style={{ padding: '4px 2px', borderRight: '1px solid #c9b694', fontWeight: 600, color: '#4a3f2f' }}>
                {ganzhi}
              </div>
              <div style={{ padding: '4px 2px', borderRight: '1px solid #c9b694', fontFamily: 'var(--font-mono)', fontWeight: p.isCurrentDaXian ? 700 : 500, color: p.isCurrentDaXian ? '#6d28d9' : '#574c3b' }}>
                {p.daXianAge ? `${p.daXianAge[0]}–${p.daXianAge[1]}岁` : ''}
              </div>
              <div style={{ padding: '4px 2px', fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '13px', color: p.isMingGong ? '#96291e' : p.isShenGong ? '#1858a8' : '#241e16' }}>
                {p.name}{p.isMingGong ? '·命' : p.isShenGong ? '·身' : ''}
              </div>
            </div>
          </div>
        );
      })}

      {/* 中宫 */}
      <div
        style={{
          gridRow: '2 / 4',
          gridColumn: '2 / 4',
          background: '#f7f1e3',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
        }}
      >
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 700, letterSpacing: '0.3em', color: '#4a3310', borderBottom: '2px double #b59e78', paddingBottom: '6px' }}>
          紫微斗数命盘
        </div>
        <div style={{ fontSize: '13.5px', lineHeight: 1.9, color: '#382f22', textAlign: 'center' }}>
          <div><strong>{chart.wuxingJuName}</strong> · 命宫在<strong>{BRANCHES[chart.mingGongBranch]}</strong> · 身宫在<strong>{BRANCHES[chart.shenGongBranch]}</strong></div>
          <div>命主：<strong>{chart.mingZhu ?? '-'}</strong> ／ 身主：<strong>{chart.shenZhu ?? '-'}</strong></div>
          {dx && <div style={{ color: '#6d28d9', fontWeight: 600 }}>现行大限：{dx.startAge}–{dx.endAge}岁（{dx.palaceName}）</div>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 方案三：现代高对比卡片版（顶部宫名色带 + 17px 超大主星 + 胶囊分组）
// ═══════════════════════════════════════════════════════════════════════
function DesignThreeBoard({ chart, overlay }: { chart: ZiweiChart; overlay: Record<string, string> }) {
  const palaceMap: Record<number, Palace> = {};
  chart.palaces.forEach(p => { palaceMap[p.branch] = p; });
  const dx = chart.daXians[chart.currentDaXianIndex];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '6px',
        background: '#ebe1cc',
        padding: '8px',
        borderRadius: '16px',
        border: '1px solid rgba(160,120,30,0.3)',
      }}
    >
      {ORDER.map(branch => {
        const [row, col] = BRANCH_GRID_POS[branch];
        const p = palaceMap[branch];
        if (!p) return null;
        const major = p.stars.filter(s => s.type === 'major');
        const lucky = p.stars.filter(s => s.type === 'lucky');
        const sha = p.stars.filter(s => s.type === 'sha');
        const minor = p.stars.filter(s => s.type === 'minor');
        const ganzhi = `${STEMS[p.stem]}${BRANCHES[p.branch]}`;

        return (
          <div
            key={branch}
            style={{
              gridRow: row,
              gridColumn: col,
              minHeight: '150px',
              background: '#ffffff',
              borderRadius: '10px',
              border: p.isMingGong
                ? '1.5px solid #c28b22'
                : p.isCurrentDaXian
                ? '1.5px solid #8b5cf6'
                : '1px solid rgba(160,120,30,0.22)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 顶部宫位头色带 */}
            <div
              style={{
                padding: '6px 10px',
                background: p.isMingGong
                  ? 'linear-gradient(90deg, rgba(194,139,34,0.18), rgba(194,139,34,0.06))'
                  : p.isCurrentDaXian
                  ? 'linear-gradient(90deg, rgba(139,92,246,0.15), rgba(139,92,246,0.04))'
                  : '#f7f3ea',
                borderBottom: '1px solid rgba(160,120,30,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f1c16' }}>{p.name}</span>
                {p.isMingGong && (
                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '99px', background: '#b87a08', color: '#fff', fontWeight: 600 }}>
                    命
                  </span>
                )}
                {p.isShenGong && (
                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '99px', background: '#1d5bbf', color: '#fff', fontWeight: 600 }}>
                    身
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
                {p.daXianAge && (
                  <span style={{ color: p.isCurrentDaXian ? '#6d28d9' : '#6e6454', fontWeight: 600 }}>
                    {p.daXianAge[0]}–{p.daXianAge[1]}
                  </span>
                )}
                <span style={{ color: '#8a7e6a' }}>{ganzhi}</span>
              </div>
            </div>

            {/* 星曜主体 */}
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {major.length === 0 ? (
                  <span style={{ fontSize: '13px', color: '#a39784' }}>空宫</span>
                ) : (
                  major.map((star: Star) => {
                    const ov = overlay[star.name];
                    return (
                      <div key={star.name} style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '17px', fontWeight: 700, color: '#784b04' }}>{star.name}</span>
                        {star.brightnessRaw && (
                          <span style={{ fontSize: '11px', color: '#9a7430', fontWeight: 600 }}>({star.brightnessRaw})</span>
                        )}
                        {star.siHua && (
                          <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '99px', background: SIHUA_SOLID_COLOR[star.siHua].bg, color: '#fff', fontWeight: 600 }}>
                            化{star.siHua}
                          </span>
                        )}
                        {ov && (
                          <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '99px', background: SIHUA_SOLID_COLOR[ov].lightBg, color: SIHUA_SOLID_COLOR[ov].bg, border: `1px solid ${SIHUA_SOLID_COLOR[ov].border}`, fontWeight: 600 }}>
                            大限{ov}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* 辅煞胶囊 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {lucky.map(s => (
                  <span key={s.name} style={{ fontSize: '11.5px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(29,91,191,0.08)', color: '#1850a0', fontWeight: 500 }}>
                    {s.name}
                  </span>
                ))}
                {sha.map(s => (
                  <span key={s.name} style={{ fontSize: '11.5px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(184,46,36,0.08)', color: '#b0281e', fontWeight: 500 }}>
                    {s.name}
                  </span>
                ))}
                {minor.map(s => (
                  <span key={s.name} style={{ fontSize: '11px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(0,0,0,0.04)', color: '#635a4c' }}>
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* 中宫 */}
      <div
        style={{
          gridRow: '2 / 4',
          gridColumn: '2 / 4',
          background: '#fffdf9',
          borderRadius: '10px',
          border: '1px solid rgba(160,120,30,0.22)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#784b04', letterSpacing: '0.18em' }}>
          紫微斗数命盘
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '13px', color: '#3b3326' }}>
          <span style={{ padding: '4px 12px', borderRadius: '99px', background: '#f5efe0', fontWeight: 600 }}>{chart.wuxingJuName}</span>
          <span style={{ padding: '4px 12px', borderRadius: '99px', background: '#f5efe0' }}>命宫：{BRANCHES[chart.mingGongBranch]}</span>
          <span style={{ padding: '4px 12px', borderRadius: '99px', background: '#f5efe0' }}>身宫：{BRANCHES[chart.shenGongBranch]}</span>
        </div>
        {dx && (
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#6d28d9' }}>
            当前大限：{dx.startAge}–{dx.endAge}岁（{dx.palaceName}）
          </div>
        )}
      </div>
    </div>
  );
}

export default function PreviewPage() {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const overlay = getDemoOverlay(DEMO_CHART);

  const tabs = [
    {
      id: 1 as const,
      name: '方案一：古籍雅印 · 底栏增强版（推荐）',
      desc: '主星放大至 16px 并附庙旺利陷标签；本命四化用实心印章（红忌/绿禄/蓝权/金科），运限四化用描边章；宫名、干支、大限统一收拢在宫格底部分隔栏，层次极清楚。',
    },
    {
      id: 2 as const,
      name: '方案二：传统排盘室 · 左右分列版',
      desc: '采用专业命理盘布局：上半区左列排主星与四化、右列排吉煞杂曜（虚线分隔）；底部采用传统三格表头「[干支] | [大限] | [宫名]」，一眼扫尽全局。',
    },
    {
      id: 3 as const,
      name: '方案三：现代高对比 · 独立卡片版',
      desc: '十二宫各自独立成圆角卡片，顶部带宫位标题色带，17px 超大主星配胶囊式辅煞标签，现代感与对比度最强。',
    },
  ];

  const currentTab = tabs.find(t => t.id === activeTab)!;

  return (
    <div style={{ minHeight: '100vh', background: '#f5efe0', color: '#1a1d24', padding: '28px 20px 64px' }}>
      <div style={{ maxWidth: '1060px', margin: '0 auto' }}>
        {/* 顶部切换栏 */}
        <div
          style={{
            background: 'rgba(255,253,247,0.92)',
            border: '1px solid rgba(160,120,30,0.28)',
            borderRadius: '14px',
            padding: '20px 24px',
            marginBottom: '20px',
            boxShadow: '0 4px 20px rgba(140,100,20,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', letterSpacing: '0.3em', color: '#8b6410', marginBottom: '4px' }}>
                ✦ 命盘 UI 视觉重构 · 三套实盘设计稿对比 ✦
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: '#241e14', margin: 0 }}>
                点击下方按钮切换查看 3 套命盘设计稿
              </h1>
            </div>
            <a
              href="/chart"
              style={{
                padding: '6px 14px',
                borderRadius: '99px',
                border: '1px solid rgba(160,120,30,0.35)',
                color: '#8b6410',
                fontSize: '12px',
                textDecoration: 'none',
              }}
            >
              返回排盘页 →
            </a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            {tabs.map(t => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    padding: '11px 16px',
                    borderRadius: '10px',
                    border: active ? '2px solid #8b6410' : '1px solid rgba(160,120,30,0.25)',
                    background: active ? 'linear-gradient(135deg, #6a4206, #9a6810)' : '#fffdf8',
                    color: active ? '#fff8e8' : '#3d3426',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {t.name}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: '13px', color: '#594e3c', background: '#f7f1e1', padding: '10px 14px', borderRadius: '8px' }}>
            <strong>当前展示说明：</strong>{currentTab.desc}
          </div>
        </div>

        {/* 命盘渲染区 */}
        {activeTab === 1 && <DesignOneBoard chart={DEMO_CHART} overlay={overlay} />}
        {activeTab === 2 && <DesignTwoBoard chart={DEMO_CHART} overlay={overlay} />}
        {activeTab === 3 && <DesignThreeBoard chart={DEMO_CHART} overlay={overlay} />}
      </div>
    </div>
  );
}
