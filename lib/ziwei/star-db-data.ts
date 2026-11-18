/**
 * Compatibility view of the source-linked knowledge notes.
 * Original unverified drafts are archived in docs/knowledge-review/original-draft.json.
 * No unsourced fallback is allowed. Reviewed text inherits the source directory's license.
 */
import notes from '@/docs/tianji-ziwei/review/knowledge-notes.json';

const FIELDS = {
  overview: 'mingGong', personality: 'personality', family: 'xiongDi', love: 'fuQi',
  children: 'ziNv', wealth: 'caiBo', health: 'jiE', move: 'qianYi', friends: 'jiaoYou',
  career: 'guanLu', home: 'tianZhai', spirit: 'fuDe', parents: 'fuMu',
} as const;
export type StarProfileEntry = Record<(typeof FIELDS)[keyof typeof FIELDS], string>;
const database: Record<string, StarProfileEntry> = {};
for (const [key, page] of Object.entries(notes.pages)) {
  const [star, topic] = key.split('/') as [string, keyof typeof FIELDS];
  database[star] ??= Object.fromEntries(Object.values(FIELDS).map(field => [field, ''])) as StarProfileEntry;
  database[star][FIELDS[topic]] = [
    `**【一句话定调】**\n${page.claims[0].text}`,
    `**【核心论断】**\n${page.claims.map(claim => claim.text).join('\n')}`,
    `**【命盘依据】**\n${page.scope}`,
  ].join('\n\n');
}
export const GENERATED_STAR_DB = database;
