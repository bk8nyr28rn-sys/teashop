import { describe, expect, it, vi } from "vitest";
import { htmlLang } from "@/i18n/config";
import { negotiateLocale, readCookie } from "@/i18n/negotiate";

vi.mock("server-only", () => ({}));
const { detectLang, ugc } = await import("@/lib/content-lang");

describe("negotiateLocale", () => {
  it("prefers the page the user is on, then the remembered choice", () => {
    expect(negotiateLocale({ explicit: "zh", cookie: "en", acceptLanguage: "en" })).toBe("zh");
    expect(negotiateLocale({ cookie: "zh", acceptLanguage: "en-US,en" })).toBe("zh");
  });

  it("ignores unknown or tampered values", () => {
    expect(negotiateLocale({ explicit: "xx", cookie: "../../etc", acceptLanguage: "en" })).toBe("en");
  });

  it("matches regional variants on the base language", () => {
    for (const tag of ["zh-TW", "zh-HK", "zh-Hant", "zh-CN", "zh"]) {
      expect(negotiateLocale({ acceptLanguage: `${tag},en;q=0.5` }), tag).toBe("zh");
    }
    expect(negotiateLocale({ acceptLanguage: "en-GB" })).toBe("en");
  });

  it("walks the browser's languages in order of preference", () => {
    expect(negotiateLocale({ acceptLanguage: "es-ES,es;q=0.9,zh;q=0.8,en;q=0.5" })).toBe("zh");
    expect(negotiateLocale({ acceptLanguage: "ja,fr;q=0.8" })).toBe("en");
    expect(negotiateLocale({ acceptLanguage: null })).toBe("en");
  });

  it("reads a cookie from a raw header", () => {
    expect(readCookie("a=1; locale=zh; b=2", "locale")).toBe("zh");
    expect(readCookie("xlocale=zh", "locale")).toBeNull();
    expect(readCookie(undefined, "locale")).toBeNull();
  });

  it("tags the Chinese UI as Simplified", () => {
    expect(htmlLang("zh")).toBe("zh-Hans");
    expect(htmlLang("en")).toBe("en");
  });
});

describe("detectLang", () => {
  it.each([
    ["今天和姐姐出柜了", "zh"],
    ["我總是想法變來變去，搞得自己很焦慮。", "zh"],
    ["今日は姉にカミングアウトしました。", "ja"],
    ["오늘 언니에게 커밍아웃했어요", "ko"],
    ["วันนี้ฉันเปิดตัวกับพี่สาว", "th"],
    ["Hola, ¿cómo estás? Me siento muy solo últimamente y no sé con quién hablar.", "es"],
    ["Eu me assumi para minha mãe ontem e ela chorou muito, mas depois me abraçou.", "pt"],
    ["Not sure if I'm bi — is that normal? I keep changing my mind about it.", "en"],
    ["Ich habe mich gestern bei meinen Eltern geoutet und es lief besser als gedacht.", "de"],
    ["Сьогодні я нарешті розповів мамі, що я гей, і вона мене обійняла.", "uk"],
    ["Сегодня я рассказал маме о себе.", "ru"],
    // Misread as French by a simpler trigram detector; must be Spanish.
    ["Hoy por fin le conté a mi madre que soy gay y me abrazó muy fuerte.", "es"],
    ["Je ne sais pas comment le dire à mes parents.", "fr"],
    ["Ciao a tutti, sono nuovo qui e un po timido.", "it"],
    ["Merhaba, burada yeniyim ve biraz utangacım.", "tr"],
  ])("%s → %s", (text, lang) => {
    expect(detectLang(text)).toBe(lang);
  });

  it("leaves short or ambiguous text untagged rather than guessing", () => {
    for (const text of ["ok", "Thanks!!", "Hola amigos", "Merci!", "lol same", "💜💜💜", "", null]) {
      expect(detectLang(text), String(text)).toBeUndefined();
    }
  });

  it("ignores links, nicknames and codes when detecting", () => {
    expect(detectLang("@river_fox https://example.com/some/long/english/path 谢谢你的建议")).toBe("zh");
  });

  it("goes by the dominant script in mixed text", () => {
    expect(detectLang("我今天去了 coming-out 小组，大家都很友善，聊了很久")).toBe("zh");
  });

  it("always sets dir=auto so right-to-left posts display correctly", () => {
    expect(ugc("ok")).toEqual({ dir: "auto" });
    expect(ugc("今天和姐姐出柜了")).toEqual({ lang: "zh", dir: "auto" });
  });
});
