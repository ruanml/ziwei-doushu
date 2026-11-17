'use client';
import { useLayoutEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import StarField from '@/components/StarField';
import { useTheme, type Theme } from '@/components/ThemeProvider';

// ─── 主题切换按钮（延续 ziwei.muryu.com 流金拨杆设计）────────
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <motion.button
      onClick={toggle}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.95 }}
      aria-label={isDark ? '切换亮色主题' : '切换暗色主题'}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
      style={{
        borderColor: isDark ? 'rgba(212,168,67,0.32)' : 'rgba(140,100,20,0.36)',
        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,252,242,0.88)',
        transition: 'background 0.35s ease, border-color 0.35s ease',
      }}
    >
      <div
        className="relative w-10 h-5 rounded-full flex-shrink-0"
        style={{
          background: isDark ? 'rgba(12,24,64,0.95)' : 'rgba(230,195,80,0.55)',
          transition: 'background 0.35s ease',
        }}
      >
        <motion.div
          animate={{ x: isDark ? 2 : 22 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="absolute top-1 w-3.5 h-3.5 rounded-full"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #b8a050, #e8d090)'
              : 'linear-gradient(135deg, #e89010, #f8d050)',
          }}
        />
      </div>
      <span
        className="text-[11px] font-medium tracking-wide select-none"
        style={{
          color: isDark ? 'rgba(212,180,100,0.88)' : 'rgba(110,72,8,0.85)',
          transition: 'color 0.35s ease',
        }}
      >
        {isDark ? '暗色' : '亮色'}
      </span>
    </motion.button>
  );
}

// ─── 主题色彩（严格对齐 ziwei.muryu.com 金色体系）─────────
function useColors(theme: Theme) {
  const d = theme === 'dark';
  return {
    bgBase:     d ? '#020810'                        : '#f5efe0',
    navBg:      d ? 'rgba(2,8,16,0.90)'              : 'rgba(245,239,224,0.92)',
    navBorder:  d ? 'rgba(212,168,67,0.16)'          : 'rgba(160,120,30,0.22)',
    goldSolid:  d ? '#d4a843'                        : '#8b6410',
    goldLine:   d ? 'rgba(212,168,67,0.40)'          : 'rgba(140,100,20,0.40)',
    goldFaint:  d ? 'rgba(212,168,67,0.16)'          : 'rgba(140,100,20,0.18)',
    tagText:    d ? 'rgba(212,168,67,0.72)'          : 'rgba(120,80,10,0.75)',
    textPrimary:d ? '#e8eef6'                        : '#1a1d24',
    textSecond: d ? '#b8c6df'                        : '#3a352c',
    textMuted:  d ? '#9db0d0'                        : '#6b604c',
    cardBg:     d ? 'rgba(255,255,255,0.04)'         : 'rgba(255,253,247,0.86)',
    cardBorder: d ? 'rgba(212,168,67,0.20)'          : 'rgba(180,135,35,0.28)',
    cardShadow: d ? '0 4px 32px rgba(0,0,0,0.5)'    : '0 4px 24px rgba(140,100,20,0.10)',
    glowTint:   d ? 'rgba(212,168,67,0.08)'          : 'rgba(190,145,35,0.09)',
    starBg:     d ? 'rgba(255,255,255,0.04)'         : 'rgba(255,253,246,0.78)',
    starBorder: d ? 'rgba(212,168,67,0.24)'          : 'rgba(160,120,30,0.34)',
    starText:   d ? 'rgba(212,168,67,0.85)'          : 'rgba(115,76,8,0.88)',
    ctaBg:      d ? 'linear-gradient(135deg,#b8892a,#f0d070,#b8892a)'
                  : 'linear-gradient(135deg,#6a4206,#9a6810,#6a4206)',
    ctaText:    d ? '#08080a'                        : '#f8f3e8',
    altSection: d ? 'rgba(212,168,67,0.025)'         : 'rgba(255,252,244,0.45)',
    footerText: d ? 'rgba(212,180,100,0.42)'         : 'rgba(120,85,20,0.62)',
  };
}

// ─── 十四主星（严格 2 行 × 7 列）─────────────────────────
const STARS = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府',
  '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
];

const STAR_BRIEF: Record<string, { attr: string; brief: string }> = {
  '紫微': { attr: '戊土 · 帝王星', brief: '北斗主星，统御众曜。坐命者自重有威，具统帅全局之气度，喜左辅右弼相佐。' },
  '天机': { attr: '乙木 · 智慧星', brief: '南斗益算之星，主智谋与机变。思虑周密，擅策划参谋、技艺研发。' },
  '太阳': { attr: '丙火 · 官禄主', brief: '中天主星，主光明与贵显。慷慨磊落，入庙则功名显达，照亮三方。' },
  '武曲': { attr: '辛金 · 财帛主', brief: '北斗正财星，主决断与执行。刚毅果决，重信守诺，利财经、实业与军警。' },
  '天同': { attr: '壬水 · 福德主', brief: '南斗福星，主温良与福泽。性情谦和，知足常乐，有逢凶化吉之气。' },
  '廉贞': { attr: '丁火 · 次桃花', brief: '北斗五星，主清白与才艺。文武兼备，敢爱敢恨，宜公职、律法与艺术创作。' },
  '天府': { attr: '戊土 · 财库主', brief: '南斗统领，主库藏与稳重。宽厚守成，善调理钱谷与大局，为命盘安定之锚。' },
  '太阴': { attr: '癸水 · 田宅主', brief: '中天主星，主富足与内敛。温婉细腻，重家庭与不动产积蓄，夜生人尤佳。' },
  '贪狼': { attr: '甲木 · 桃花主', brief: '北斗解厄之星，主欲望与交际。多才善交，长袖善舞，午宫入庙反成武贵。' },
  '巨门': { attr: '癸水 · 是非星', brief: '北斗暗曜，主口才与思辨。洞察幽微，以言立身，得太阳庙旺即可化暗为明。' },
  '天相': { attr: '壬水 · 印绶星', brief: '南斗司爵之星，主辅佐与信义。行事端方，长于协调折冲，贵人缘深。' },
  '天梁': { attr: '戊土 · 父母主', brief: '南斗延寿之星，主清高与荫庇。老成持重，慈悲济世，宜医道、教化与监察。' },
  '七杀': { attr: '庚金 · 将星', brief: '南斗大将，主肃杀与开创。临危不惧，独当一面，成败起伏中见英雄本色。' },
  '破军': { attr: '癸水 · 耗星', brief: '北斗先锋，主破旧立新。不拘陈规，勇于开辟无人之境，先破而后立。' },
};

// ─── 核心法门卡片 ──────────────────────────────────────
const FEATURES = [
  {
    glyph: '盘',
    subtitle: '十四主星 · 四化飞星',
    title: '正宗三合派起盘',
    desc: '依倪海厦《天纪》规则纳音起局，逆数命宫、顺推身宫。支持出生地真太阳时与历史夏令时校正，同屏呈现本命、大限、流年四化叠层与三方四正连线。',
    tags: ['真太阳时校正', '三方四正连线', '11 种经典格局检测'],
    href: '/chart',
    action: '进入排盘 →',
  },
  {
    glyph: '解',
    subtitle: '实盘推演 · 知行合一',
    title: 'AI 深度命理解读',
    desc: '将十二宫星曜、庙旺利陷、宫干自化与格局完整注入模型，按命格、感情、事业、财运、健康、性格六大维度逐层剖析，并支持点击任意宫位自由追问。',
    tags: ['六大维度总览', '点选宫位即问', '流式即时推演'],
    href: '/chart',
    action: '开始解盘 →',
  },
  {
    glyph: '合',
    subtitle: '三宫联参 · 飞化互参',
    title: '紫微双人合盘',
    desc: '恪守「看婚姻必同看福德宫」之要诀，由引擎精确比对双方命宫、夫妻宫、福德宫主星呼应，推算生年干与命宫干四化飞入对方盘中的落宫，详参婚恋与合伙。',
    tags: ['命夫福三宫联参', '生年四化互飞', '感情与合伙追问'],
    href: '/heming',
    action: '双人合盘 →',
  },
];

// ─── 倪师核心教义 ──────────────────────────────────────
const NI_TEACHINGS = [
  {
    num: '壹',
    title: '命宫为本，三方为用',
    body: '看命必先立命宫。命宫主星决定先天格局与心性底色，财帛、官禄、迁移三方则决定此人后天的「用武之地」，四正三方联动方为完整人生图景。',
  },
  {
    num: '贰',
    title: '对宫借星，不可忽视',
    body: '本宫若为空宫，须借对宫星曜论断。命宫与迁移宫遥相对望，一主内在禀赋、一主外在际遇，动静互参，方不失偏颇。',
  },
  {
    num: '叁',
    title: '四化才是命运的手',
    body: '星曜为体，四化（化禄、化权、化科、化忌）为用。同一颗主星，逢化禄或逢化忌，际遇判若云泥。不参四化，命盘只解了一半。',
  },
  {
    num: '肆',
    title: '大限十年，运势有节',
    body: '人生划分为十二大限，每限统管十年。唯有明晰当下行运落于何宫、会照何星，方能顺天应时，在进退取舍之间把握良机。',
  },
];

// ─── 中式对称金线标题头 ────────────────────────────────
function SectionHeader({
  label,
  title,
  desc,
  theme,
  c,
}: {
  label: string;
  title: string;
  desc?: string;
  theme: Theme;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <div className="text-center mb-12">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="h-px w-12" style={{ background: `linear-gradient(to right, transparent, ${c.goldLine})` }} />
        <span className="text-[11px] tracking-[0.42em]" style={{ color: c.tagText }}>
          {label}
        </span>
        <div className="h-px w-12" style={{ background: `linear-gradient(to left, transparent, ${c.goldLine})` }} />
      </div>
      <h2
        className={`grad-text ${theme === 'dark' ? 'grad-text-dark' : 'grad-text-light'} font-bold tracking-[0.14em] mb-3`}
        style={{ fontSize: 'clamp(26px, 3.6vw, 40px)', fontFamily: 'var(--font-serif)' }}
      >
        {title}
      </h2>
      {desc && (
        <p className="text-xs sm:text-sm max-w-xl mx-auto leading-relaxed tracking-wide" style={{ color: c.textMuted }}>
          {desc}
        </p>
      )}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = useColors(theme);
  const [selectedStar, setSelectedStar] = useState<string | null>('紫微');

  useLayoutEffect(() => {
    document.documentElement.style.background = c.bgBase;
    document.body.style.background = c.bgBase;
    return () => {
      document.documentElement.style.background = '';
      document.body.style.background = '';
    };
  }, [c.bgBase]);

  return (
    <div style={{ background: c.bgBase, transition: 'background 0.35s ease' }} className="min-h-screen overflow-x-hidden relative">
      {/* 流金星尘粒子背景 */}
      <StarField />

      {/* 顶部柔和金色背光 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[880px] h-[480px] rounded-full"
          style={{ background: `radial-gradient(ellipse, ${c.glowTint} 0%, transparent 70%)` }}
        />
      </div>

      {/* ── 顶部导航 ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 py-3.5 gap-2"
        style={{
          background: c.navBg,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${c.navBorder}`,
        }}
      >
        <div
          className="text-xs sm:text-sm tracking-[0.35em] font-semibold flex items-center gap-2 flex-shrink-0"
          style={{ color: c.goldSolid, fontFamily: 'var(--font-serif)' }}
        >
          <span className="opacity-75">✦</span>
          <span>紫微命盘</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <ThemeToggle />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push('/heming')}
            className="text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 rounded-full transition-all duration-300"
            style={{ border: `1px solid ${c.goldLine}`, color: c.goldSolid, background: 'transparent' }}
          >
            合盘
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push('/chart')}
            className="text-[11px] sm:text-xs px-3.5 sm:px-4 py-1.5 rounded-full font-medium transition-all duration-300"
            style={{ background: c.ctaBg, color: c.ctaText }}
          >
            立即起盘
          </motion.button>
        </div>
      </nav>

      {/* ══ 首屏 HERO ══════════════════════════════════════ */}
      <section className="relative z-10 pt-28 pb-16 sm:pt-32 sm:pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* 对称金线标签 */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-12" style={{ background: `linear-gradient(to right, transparent, ${c.goldLine})` }} />
            <span className="text-[11px] tracking-[0.45em]" style={{ color: c.tagText }}>
              紫微斗数 · 倪海厦《天纪》体系
            </span>
            <div className="h-px w-12" style={{ background: `linear-gradient(to left, transparent, ${c.goldLine})` }} />
          </div>

          {/* 流金渐变主标题 */}
          <h1
            className={`grad-text ${theme === 'dark' ? 'grad-text-dark' : 'grad-text-light'} font-bold leading-none mb-5`}
            style={{
              fontSize: 'clamp(52px, 9vw, 96px)',
              letterSpacing: '0.12em',
              fontFamily: 'var(--font-serif)',
            }}
          >
            紫微命盘
          </h1>

          <p
            className="text-base sm:text-lg tracking-[0.22em] mb-2"
            style={{ color: c.textSecond, fontWeight: 500, fontFamily: 'var(--font-serif)' }}
          >
            紫微为门 · 天地人为路 · 倪海厦为师
          </p>
          <p className="text-xs sm:text-sm tracking-[0.3em] mb-6" style={{ color: c.goldSolid }}>
            古法排盘 · 四化飞星 · AI 答疑
          </p>
          <p className="text-sm max-w-lg mx-auto leading-relaxed mb-9" style={{ color: c.textMuted }}>
            输入出生年月日时，即刻排定本命十二宫、十四主星与四化格局，
            由 AI 依倪海厦《天纪》口径为您深度解盘与合盘参断。
          </p>

          {/* 双按钮 */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <motion.button
              whileHover={{ y: -2, filter: 'brightness(1.06)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/chart')}
              className="px-10 py-3.5 font-semibold text-sm sm:text-base tracking-[0.2em] rounded-full"
              style={{
                background: c.ctaBg,
                color: c.ctaText,
                boxShadow: '0 4px 20px rgba(140,100,20,0.25)',
              }}
            >
              立即起盘
            </motion.button>
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/heming')}
              className="px-9 py-3.5 font-medium text-sm sm:text-base tracking-[0.2em] rounded-full"
              style={{
                background: c.starBg,
                border: `1px solid ${c.goldLine}`,
                color: c.goldSolid,
              }}
            >
              双人合盘
            </motion.button>
          </div>

          {/* ── 十四主星：严格 2 行 × 7 列 等宽整齐排列（可点击查看星性） ── */}
          <div className="mt-12 max-w-[600px] mx-auto">
            <div className="text-[10px] tracking-[0.35em] mb-3" style={{ color: c.tagText }}>
              ✦ 十四主星 · 点击星曜览读星性 ✦
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: '8px',
              }}
            >
              {STARS.map(name => {
                const active = selectedStar === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedStar(active ? null : name)}
                    className="py-2 rounded-lg text-center transition-all duration-200 cursor-pointer"
                    style={{
                      background: active
                        ? (theme === 'dark' ? 'rgba(212,168,67,0.18)' : 'rgba(180,130,25,0.15)')
                        : c.starBg,
                      border: `1px solid ${active ? c.goldSolid : c.starBorder}`,
                      color: active ? c.goldSolid : c.starText,
                      fontWeight: active ? 600 : 500,
                      fontFamily: 'var(--font-serif)',
                      fontSize: '13px',
                      letterSpacing: '0.1em',
                      boxShadow: active ? `0 2px 10px ${c.goldFaint}` : 'none',
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>

            {/* 星曜释义小笺 */}
            <AnimatePresence mode="wait">
              {selectedStar && STAR_BRIEF[selectedStar] && (
                <motion.div
                  key={selectedStar}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="mt-3 rounded-xl px-5 py-3.5 text-left"
                  style={{
                    background: c.cardBg,
                    border: `1px solid ${c.cardBorder}`,
                    boxShadow: c.cardShadow,
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className="text-sm font-semibold tracking-widest"
                      style={{ color: c.goldSolid, fontFamily: 'var(--font-serif)' }}
                    >
                      【{selectedStar}】
                    </span>
                    <span
                      className="text-[11px] px-2.5 py-0.5 rounded-full"
                      style={{ color: c.tagText, border: `1px solid ${c.goldLine}`, background: c.starBg }}
                    >
                      {STAR_BRIEF[selectedStar].attr}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed m-0" style={{ color: c.textSecond }}>
                    {STAR_BRIEF[selectedStar].brief}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ══ 核心功能（排盘 · 解盘 · 合盘） ═════════════════ */}
      <section className="relative z-10 py-16 sm:py-20 px-6" style={{ background: c.altSection }}>
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            label="核心法门 · 排盘与参断"
            title="排盘 · 解盘 · 合盘"
            desc="摒弃繁琐玄虚，以清晰可复核的宫位、星曜与四化结构推演命局"
            theme={theme}
            c={c}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURES.map(item => (
              <motion.div
                key={item.title}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.18 }}
                onClick={() => router.push(item.href)}
                className="rounded-2xl p-6 sm:p-7 flex flex-col justify-between cursor-pointer relative overflow-hidden"
                style={{
                  background: c.cardBg,
                  border: `1px solid ${c.cardBorder}`,
                  boxShadow: c.cardShadow,
                }}
              >
                {/* 背景水印汉字 */}
                <span
                  className="absolute -right-2 -top-3 select-none pointer-events-none font-bold"
                  style={{
                    fontSize: '88px',
                    color: c.goldSolid,
                    opacity: theme === 'dark' ? 0.05 : 0.06,
                    fontFamily: 'var(--font-serif)',
                    lineHeight: 1,
                  }}
                >
                  {item.glyph}
                </span>

                <div>
                  <div className="text-[10px] tracking-[0.28em] mb-2" style={{ color: c.tagText }}>
                    {item.subtitle}
                  </div>
                  <h3
                    className="text-lg font-bold tracking-[0.1em] mb-3"
                    style={{ color: c.goldSolid, fontFamily: 'var(--font-serif)' }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-xs leading-relaxed mb-5" style={{ color: c.textSecond }}>
                    {item.desc}
                  </p>
                </div>

                <div>
                  <div className="flex flex-wrap gap-1.5 mb-4 pt-3" style={{ borderTop: `1px solid ${c.navBorder}` }}>
                    {item.tags.map(tag => (
                      <span
                        key={tag}
                        className="text-[10px] px-2.5 py-0.5 rounded-full"
                        style={{
                          background: c.starBg,
                          border: `1px solid ${c.goldFaint}`,
                          color: c.textMuted,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs font-semibold tracking-widest" style={{ color: c.goldSolid }}>
                    {item.action}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 倪海厦论命四要 ════════════════════════════════ */}
      <section className="relative z-10 py-16 sm:py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            label="天纪心法 · 论命纲领"
            title="看盘四要"
            desc="以命宫为体、三方为用、四化为纲、大限为节"
            theme={theme}
            c={c}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {NI_TEACHINGS.map(teaching => (
              <div
                key={teaching.num}
                className="rounded-xl p-6"
                style={{
                  background: c.cardBg,
                  border: `1px solid ${c.cardBorder}`,
                  boxShadow: c.cardShadow,
                }}
              >
                <div className="flex items-center gap-3 mb-2.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-semibold"
                    style={{
                      border: `1px solid ${c.goldLine}`,
                      background: c.starBg,
                      color: c.goldSolid,
                      fontFamily: 'var(--font-serif)',
                    }}
                  >
                    {teaching.num}
                  </div>
                  <h3
                    className="text-sm sm:text-base font-semibold tracking-wider"
                    style={{ color: c.goldSolid, fontFamily: 'var(--font-serif)' }}
                  >
                    {teaching.title}
                  </h3>
                </div>
                <p className="text-xs leading-relaxed pl-9 m-0" style={{ color: c.textSecond }}>
                  {teaching.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 页脚 ── */}
      <footer
        className="relative z-10 py-8 px-6 text-center"
        style={{ borderTop: `1px solid ${c.navBorder}` }}
      >
        <p className="text-[11px] tracking-widest mb-2" style={{ color: c.footerText }}>
          紫微命盘 · 基于倪海厦《天纪》紫微斗数体系 · 命盘仅供传统文化研究参考，命运掌握在自己手中
        </p>
        <p className="text-[11px] tracking-wider" style={{ color: c.footerText }}>
          <a href="/chart" style={{ color: c.goldSolid, textDecoration: 'none' }}>单人排盘</a>
          {' · '}
          <a href="/heming" style={{ color: c.goldSolid, textDecoration: 'none' }}>双人合盘</a>
          {' · '}
          <a href="/terms" style={{ color: c.footerText, textDecoration: 'underline' }}>服务条款</a>
          {' · '}
          <a href="/privacy" style={{ color: c.footerText, textDecoration: 'underline' }}>隐私政策</a>
        </p>
      </footer>
    </div>
  );
}
