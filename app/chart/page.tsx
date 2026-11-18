'use client';
import { useState, useEffect } from 'react';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel, { type Message as InsightMessage } from '@/components/InsightPanel';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart, Palace } from '@/lib/ziwei/types';

const SAVED_CHARTS_KEY = 'ziwei_saved_chart_sessions_v1';
const MAX_SAVED_CHARTS = 12;
const BRANCH_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const STEM_NAMES = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// 当用户已在我们的确认框里点过“确定”时，跳过浏览器 beforeunload，避免 Chrome 二次弹窗
let bypassBeforeUnload = false;

interface SavedChartSession {
  id: string;
  label: string;
  subLabel: string;
  birthInfo: BirthInfo;
  messages: InsightMessage[];
  updatedAt: number;
}

function makeSessionId(b: BirthInfo): string {
  return `${b.year}-${b.month}-${b.day}-${b.hour}-${b.gender}-${b.name || ''}`;
}

function readSavedSessions(): SavedChartSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_CHARTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessionToStorage(targetChart: ZiweiChart, msgs: InsightMessage[]): SavedChartSession[] {
  const b = targetChart.birthInfo;
  const id = makeSessionId(b);
  const mingPalace = targetChart.palaces.find(p => p.isMingGong);
  const mingMajor = mingPalace?.stars.filter(s => s.type === 'major').map(s => s.name).join('·') || '空宫';
  const label = [
    b.name || '未署名',
    `${b.year}年${b.month}月${b.day}日 ${BRANCH_NAMES[b.hour] ?? ''}时`,
    b.gender === 'male' ? '男' : '女',
  ].join(' · ');
  const subLabel = `${targetChart.wuxingJuName} · 命宫${BRANCH_NAMES[targetChart.mingGongBranch] ?? ''}（${mingMajor}）`;

  const prev = readSavedSessions();
  const existing = prev.find(s => s.id === id);
  const finalMessages = msgs.length > 0 ? msgs : (existing?.messages ?? []);
  const entry: SavedChartSession = {
    id,
    label,
    subLabel,
    birthInfo: b,
    messages: finalMessages,
    updatedAt: Date.now(),
  };
  const updated = [entry, ...prev.filter(s => s.id !== id)].slice(0, MAX_SAVED_CHARTS);
  try {
    localStorage.setItem(SAVED_CHARTS_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
  return updated;
}

function formatChartMarkdown(chart: ZiweiChart, messages: InsightMessage[]): string {
  const b = chart.birthInfo;
  const l = chart.lunarInfo;
  const lines: string[] = [];
  const titleName = b.name ? `${b.name}的` : '';
  lines.push(`# ${titleName}紫微斗数命盘与 AI 解读报告`);
  lines.push('');
  lines.push('## 一、命盘基本信息');
  lines.push(`- **性别**：${chart.yinYangGender ?? (b.gender === 'male' ? '男' : '女')}`);
  lines.push(`- **公历（排盘日）**：${b.year}年${b.month}月${b.day}日 ${BRANCH_NAMES[b.hour] ?? ''}时${b.province || b.city ? `（${b.province ?? ''}${b.city ?? ''}）` : ''}`);
  lines.push(`- **农历**：${l.lunarYear}年${l.isLeapMonth ? '闰' : ''}${Math.abs(l.lunarMonth)}月${l.lunarDay}日`);
  if (l.fourPillars?.length) lines.push(`- **四柱**：${l.fourPillars.join(' ')}`);
  lines.push(`- **五行局**：${chart.wuxingJuName}`);
  lines.push(`- **命宫 / 身宫**：命宫在${BRANCH_NAMES[chart.mingGongBranch] ?? ''}，身宫在${BRANCH_NAMES[chart.shenGongBranch] ?? ''}`);
  if (chart.mingZhu || chart.shenZhu) {
    lines.push(`- **命主 / 身主**：命主 ${chart.mingZhu ?? '-'}，身主 ${chart.shenZhu ?? '-'}`);
  }
  const curDx = chart.daXians?.[chart.currentDaXianIndex];
  if (curDx) {
    lines.push(`- **当前虚岁与大限**：${chart.currentAge} 岁（${curDx.startAge}–${curDx.endAge} 岁行运【${curDx.palaceName}】）`);
  }
  lines.push('');
  lines.push('## 二、本命十二宫星曜排布');
  for (const p of chart.palaces) {
    const major = p.stars.filter(s => s.type === 'major').map(s => `${s.name}${s.brightnessRaw ? `(${s.brightnessRaw})` : ''}${s.siHua ? `[化${s.siHua}]` : ''}`).join('、') || (p.isEmpty ? `空宫（借${p.borrowedFromName ?? '对宫'}）` : '无');
    const minor = p.stars.filter(s => s.type !== 'major').map(s => `${s.name}${s.siHua ? `[化${s.siHua}]` : ''}`).join('、');
    const tags = [p.isMingGong ? '命宫' : '', p.isShenGong ? '身宫' : '', p.isCurrentDaXian ? '当前大限' : ''].filter(Boolean).join('/');
    lines.push(`- **${p.name}（${STEM_NAMES[p.stem] ?? ''}${BRANCH_NAMES[p.branch] ?? ''}）**${tags ? `【${tags}】` : ''}：主星 ${major}${minor ? `；辅煞 ${minor}` : ''}`);
  }
  lines.push('');
  lines.push('## 三、AI 命理解读记录');
  const visibleMsgs = messages.filter(m => m.content.trim());
  if (visibleMsgs.length === 0) {
    lines.push('（暂无解读记录）');
  } else {
    for (const m of visibleMsgs) {
      if (m.role === 'user') {
        lines.push('');
        lines.push(`### 提问：${m.hidden ? '（专题/宫位解读）' : m.content}`);
      } else {
        lines.push('');
        lines.push(m.content);
      }
    }
  }
  lines.push('');
  return lines.join('\n');
}

/** 子组件：负责监听浏览器返回键（popstate）与刷新（beforeunload）防误退 */
function ChartNavigationGuard({ onConfirmBack }: { onConfirmBack: () => void }) {
  useEffect(() => {
    bypassBeforeUnload = false;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bypassBeforeUnload) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const handlePopState = () => {
      const ok = window.confirm('当前命盘与 AI 解读正在查看中，确定要返回上一页吗？（已生成的解读已自动保存在本机记录中）');
      if (ok) {
        bypassBeforeUnload = true;
        onConfirmBack();
      } else {
        try {
          window.history.pushState({ ziweiChartActive: true }, '');
        } catch { /* ignore */ }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onConfirmBack]);
  return null;
}

/** 子组件：在未起盘页加载并展示本机保存的命盘与解读记录 */
function SavedChartsPanel({ onRestore }: { onRestore: (s: SavedChartSession) => void }) {
  const [sessions, setSessions] = useState<SavedChartSession[]>([]);

  useEffect(() => {
    setSessions(readSavedSessions());
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    try {
      localStorage.setItem(SAVED_CHARTS_KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
  };

  if (sessions.length === 0) return null;

  return (
    <div
      style={{
        marginBottom: 20,
        background: 'var(--bg-card)',
        border: '1px solid var(--bdr-med)',
        borderRadius: '16px',
        padding: '18px 20px',
        boxShadow: 'var(--sh-xs)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.16em',
            color: 'var(--ac)',
          }}
        >
          ✦ 已保存的命盘与解读（{sessions.length}）
        </span>
        <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>点击直接恢复命盘与已生成的解读</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sessions.map(s => {
          const aiCount = s.messages?.filter(m => m.role === 'assistant' && m.content.trim()).length ?? 0;
          return (
            <div
              key={s.id}
              onClick={() => onRestore(s)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid var(--bdr)',
                background: 'var(--bg-0)',
                cursor: 'pointer',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-0)', marginBottom: 2 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>
                  {s.subLabel} · {aiCount > 0 ? `含 ${aiCount} 段 AI 解读` : '仅命盘'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: 'var(--ac)', fontWeight: 500 }}>查看 →</span>
                <button
                  type="button"
                  onClick={e => handleDelete(s.id, e)}
                  aria-label="删除记录"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: '1px solid var(--bdr)',
                    background: 'transparent',
                    color: 'var(--tx-3)',
                    fontSize: 12,
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [sessionMessages, setSessionMessages] = useState<InsightMessage[]>([]);
  const [saveNotice, setSaveNotice] = useState<string>('');

  const handleStartChart = (info: BirthInfo) => {
    const nextChart = generateChart(info);
    const id = makeSessionId(nextChart.birthInfo);
    const existing = readSavedSessions().find(s => s.id === id);
    const restoredMsgs = existing?.messages ?? [];
    setSessionMessages(restoredMsgs);
    setSelectedPalace(null);
    setChart(nextChart);
    saveSessionToStorage(nextChart, restoredMsgs);
    try {
      window.history.pushState({ ziweiChartActive: true }, '');
    } catch { /* ignore */ }
  };

  const handleRestoreSession = (session: SavedChartSession) => {
    const nextChart = generateChart(session.birthInfo);
    setSessionMessages(session.messages ?? []);
    setSelectedPalace(null);
    setChart(nextChart);
    try {
      window.history.pushState({ ziweiChartActive: true }, '');
    } catch { /* ignore */ }
  };

  const handleMessagesChange = (msgs: InsightMessage[]) => {
    setSessionMessages(msgs);
    if (chart) {
      saveSessionToStorage(chart, msgs);
    }
  };

  const confirmLeaveIfActive = (e?: React.MouseEvent): boolean => {
    if (!chart) return true;
    const ok = window.confirm('当前命盘与 AI 解读正在查看中，确定要离开当前页面吗？（记录已自动保存在本机）');
    if (ok) {
      bypassBeforeUnload = true;
    } else if (e) {
      e.preventDefault();
    }
    return ok;
  };

  const handleExportReport = () => {
    if (!chart) return;
    const md = formatChartMarkdown(chart, sessionMessages);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const b = chart.birthInfo;
    const namePart = b.name ? `${b.name}_` : '';
    a.href = url;
    a.download = `紫微命盘与解读_${namePart}${b.year}-${b.month}-${b.day}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSaveNotice('已导出报告');
    setTimeout(() => setSaveNotice(''), 2200);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--tx-1)' }}>
      {/* 顶栏 */}
      <header
        className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:flex-nowrap sm:px-6"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'color-mix(in srgb, var(--bg-0) 90%, transparent)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid var(--bdr-med)',
        }}
      >
        <a
          className="shrink-0 whitespace-nowrap"
          href="/"
          onClick={e => { confirmLeaveIfActive(e); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '13px',
            color: 'var(--tx-2)',
            textDecoration: 'none',
          }}
        >
          <span>‹</span>
          <span>首页</span>
        </a>
        <div style={{ width: '1px', height: '16px', background: 'var(--bdr-med)' }} />
        <span
          className="whitespace-nowrap"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--ac)',
            letterSpacing: '0.18em',
          }}
        >
          ✦ 紫微斗数排盘
        </span>
        <div className={`ml-auto flex flex-wrap items-center justify-end gap-2 whitespace-nowrap sm:w-auto sm:flex-nowrap sm:gap-3 ${chart ? 'w-full' : ''}`}>
          {chart && (
            <>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--tx-3)',
                  alignItems: 'center',
                  gap: '4px',
                }}
                className="hidden sm:inline-flex"
              >
                ✓ {saveNotice || '已自动保存'}
              </span>
              <button
                type="button"
                onClick={handleExportReport}
                style={{
                  padding: '5px 13px',
                  cursor: 'pointer',
                  border: '1px solid var(--ac-bdr)',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--ac-bg)',
                  color: 'var(--ac)',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                <span className="sm:hidden">⬇ 保存报告</span>
                <span className="hidden sm:inline">⬇ 保存命盘与解读</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmLeaveIfActive()) {
                    setChart(null);
                    setSelectedPalace(null);
                  }
                }}
                style={{
                  padding: '5px 13px',
                  cursor: 'pointer',
                  border: '1px solid var(--bdr-med)',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--bg-card)',
                  color: 'var(--tx-1)',
                  fontSize: '12px',
                }}
              >
                重新起盘
              </button>
            </>
          )}
          <a
            href="/heming"
            onClick={e => { confirmLeaveIfActive(e); }}
            style={{
              padding: '5px 13px',
              borderRadius: 'var(--r-pill)',
              border: '1px solid var(--bdr-med)',
              background: 'transparent',
              color: 'var(--tx-2)',
              fontSize: '12px',
              textDecoration: 'none',
            }}
          >
            双人合盘 →
          </a>
        </div>
      </header>

      {/* ── 未起盘：展示出生信息表单 + 已保存的命盘与解读记录 ── */}
      {!chart ? (
        <main style={{ maxWidth: 640, margin: '0 auto', padding: '44px 20px 72px' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.38em', color: 'var(--ac)', opacity: 0.8, marginBottom: 8 }}>
              ✦ 紫微斗数 · 倪海厦体系 ✦
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 28,
                fontWeight: 600,
                color: 'var(--ac)',
                letterSpacing: '0.16em',
                marginBottom: 8,
              }}
            >
              命盘排演
            </h1>
            <p style={{ color: 'var(--tx-2)', fontSize: 13, lineHeight: 1.75, margin: 0 }}>
              输入出生年月日时与出生地，排定本命十二宫并获取 AI 深度命理解读
            </p>
          </div>

          <SavedChartsPanel onRestore={handleRestoreSession} />

          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--bdr-med)',
              borderRadius: '16px',
              padding: '28px 24px',
              boxShadow: 'var(--sh-sm)',
            }}
          >
            <BirthForm onSubmit={handleStartChart} />
          </div>
        </main>
      ) : (
        /* ── 已起盘：命盘 + 解读（桌面端左右等高对齐） ── */
        <main className="mx-auto w-full max-w-screen-xl px-2 pt-5 pb-12 sm:px-4">
          <ChartNavigationGuard
            onConfirmBack={() => {
              setChart(null);
              setSelectedPalace(null);
            }}
          />
          <div
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,430px)]"
            style={{ gap: 20 }}
          >
            <ChartBoard chart={chart} onPalaceSelect={setSelectedPalace} />
            <div className="lg:relative min-h-0 min-w-0">
              <InsightPanel
                key={makeSessionId(chart.birthInfo)}
                chart={chart}
                selectedPalace={selectedPalace}
                initialMessages={sessionMessages}
                onMessagesChange={handleMessagesChange}
              />
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
