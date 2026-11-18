import Link from 'next/link';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata = pageMetadata({
  path: '/about',
  title: '关于本站与内容整理方法 · 紫微命盘',
  description: '了解紫微命盘的内容来源、整理方法，以及传统命理解释、原文引证和 AI 回答的区别。',
});

export default function AboutPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12" style={{ color: 'var(--tx-0)' }}>
      <Link href="/">← 首页</Link>
      <h1 className="text-3xl font-bold mt-8 mb-6">关于本站与内容整理方法</h1>
      <div className="space-y-6 leading-loose">
        <p>紫微命盘是独立的排盘与传统文化学习网站，以“紫微命盘”作为本站整理内容的署名，不代表倪海厦先生本人、其机构或权利方的官方发布。</p>
        <section>
          <h2 className="text-xl font-semibold">内容从哪里来</h2>
          <p>排盘引擎与网站基础源自 <a href="https://github.com/Renhuai123/ziwei-doushu" className="underline">ziwei-doushu 开源项目</a>。知识专题是在现有资料基础上的学习整理，参考课程与古籍；已发布的知识专题按整理句分别列出出处，并保留案例与组合条件。</p>
          <p>课程定位信息参考 <a href="https://github.com/Renhuai123/nihai-tianji-corpus" className="underline">天纪结构化语料库</a>。其语料采用 CC BY-NC-SA 许可；本站的课程摘意整理标注改写并沿用该许可，页面提供原课程及转录条目链接。</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">如何区分原文、解释与 AI 回答</h2>
          <p>知识页中的概述和分析是整理文字，不应当作倪师逐字原话。课程入口保留分集和时间位置，方便读者回看。本轮对照的是仓库转录文本与古籍电子录文，尚未回听原视频或校对影印底本。182 个原专题中，66 个改为逐句列源笔记，116 个以「未确认」标记展示原稿摘要及正文。完整原稿和首轮校订记录保留在仓库供复查。</p>
          <p>古籍库目前是仓库收录的精选材料，尚未完成底本、版本和逐字校勘，不能替代可靠的古籍影印本。AI 解读由模型结合命盘数据生成，可能存在遗漏或错误，也不等同于课程原文。</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">阅读与使用范围</h2>
          <p>本站按传统文化学习的范围介绍命理观点，不把它们视为科学验证的事件预测。健康、财务与关系专题不能替代相应专业判断，也不宜据此作出重大决定。</p>
          <p>文章更新时同步记录修改日期。未核实的原话不以直接引文呈现；后续校订需要回到具体原文、课程位置和适用条件。</p>
        </section>
        <p><Link href="/knowledge">浏览星曜知识库 →</Link></p>
      </div>
    </main>
  );
}
