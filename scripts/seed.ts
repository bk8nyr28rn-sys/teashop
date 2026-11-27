import "./load-env";
import { createDb } from "../src/db";
import { circle, type CircleVisibility, type LocalizedText } from "../src/db/schema";

/** Starter circles — edit freely. Idempotent: existing slugs are left untouched. */
const CIRCLES: {
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  visibility: CircleVisibility;
  minTrustLevel?: number;
}[] = [
  {
    slug: "lounge",
    name: { en: "Lounge", zh: "大厅" },
    description: { en: "Say hi and chat about anything.", zh: "打个招呼，随便聊聊。" },
    visibility: "open",
  },
  {
    slug: "questioning",
    name: { en: "Questioning", zh: "探索中" },
    description: { en: "Still figuring things out? You're welcome here.", zh: "还在探索自己？这里欢迎你。" },
    visibility: "open",
  },
  {
    slug: "coming-out",
    name: { en: "Coming Out Support", zh: "出柜互助" },
    description: { en: "Share experiences and support each other.", zh: "分享经历，互相支持。" },
    visibility: "approval",
    minTrustLevel: 1,
  },
  {
    slug: "trans",
    name: { en: "Trans & Non-binary", zh: "跨性别与非二元" },
    description: {
      en: "A moderated space for trans and non-binary members.",
      zh: "为跨性别与非二元成员设立的审核制空间。",
    },
    visibility: "approval",
    minTrustLevel: 1,
  },
  {
    slug: "sapphic",
    name: { en: "Sapphic", zh: "女同与女性向" },
    description: { en: "For women and non-binary people who love women.", zh: "爱女性的女性与非二元朋友。" },
    visibility: "approval",
    minTrustLevel: 1,
  },
  {
    slug: "gay-bi-men",
    name: { en: "Gay & Bi Men", zh: "男同与双性恋男性" },
    description: { en: "For gay, bi and queer men.", zh: "男同、双性恋及酷儿男性。" },
    visibility: "approval",
    minTrustLevel: 1,
  },
  {
    slug: "bi-plus",
    name: { en: "Bi+ & Pan", zh: "双性恋+与泛性恋" },
    description: {
      en: "Bi, pan, and everyone attracted to more than one gender.",
      zh: "双性恋、泛性恋，以及被不止一种性别吸引的人。",
    },
    visibility: "approval",
    minTrustLevel: 1,
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const { db, client } = createDb(url);
  try {
    for (const c of CIRCLES) {
      await db
        .insert(circle)
        .values({ id: crypto.randomUUID(), minTrustLevel: 0, ...c })
        .onConflictDoNothing({ target: circle.slug });
    }
    console.log(`Seeded ${CIRCLES.length} circles (existing ones kept).`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
