import ar from '../../locales/ar.json';
import bg from '../../locales/bg.json';
import cs from '../../locales/cs.json';
import da from '../../locales/da.json';
import de from '../../locales/de.json';
import el from '../../locales/el.json';
import en from '../../locales/en.json';
import es from '../../locales/es.json';
import fi from '../../locales/fi.json';
import fr from '../../locales/fr.json';
import he from '../../locales/he.json';
import hi from '../../locales/hi.json';
import hu from '../../locales/hu.json';
import id from '../../locales/id.json';
import it from '../../locales/it.json';
import ja from '../../locales/ja.json';
import ko from '../../locales/ko.json';
import nb from '../../locales/nb.json';
import nl from '../../locales/nl.json';
import pl from '../../locales/pl.json';
import pt from '../../locales/pt.json';
import ro from '../../locales/ro.json';
import ru from '../../locales/ru.json';
import sv from '../../locales/sv.json';
import th from '../../locales/th.json';
import tr from '../../locales/tr.json';
import uk from '../../locales/uk.json';
import vi from '../../locales/vi.json';
import zhCN from '../../locales/zh-CN.json';
import zhTW from '../../locales/zh-TW.json';

export const locales = [
  'en',
  'tr',
  'de',
  'es',
  'fr',
  'it',
  'pt',
  'nl',
  'pl',
  'ru',
  'uk',
  'cs',
  'sv',
  'da',
  'fi',
  'nb',
  'ro',
  'hu',
  'el',
  'bg',
  'zh-CN',
  'zh-TW',
  'ja',
  'ko',
  'hi',
  'id',
  'th',
  'vi',
  'ar',
  'he',
] as const;

export type Locale = (typeof locales)[number];

export type Messages = typeof en;

export const defaultLocale: Locale = 'en';

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  tr: 'Türkçe',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  ru: 'Русский',
  uk: 'Українська',
  cs: 'Čeština',
  sv: 'Svenska',
  da: 'Dansk',
  fi: 'Suomi',
  nb: 'Norsk Bokmål',
  ro: 'Română',
  hu: 'Magyar',
  el: 'Ελληνικά',
  bg: 'Български',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  ko: '한국어',
  hi: 'हिन्दी',
  id: 'Bahasa Indonesia',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  ar: 'العربية',
  he: 'עברית',
};

const englishResource = { translation: en };
const translatedResources: Record<Locale, { translation: Messages }> = {
  ar: { translation: ar },
  bg: { translation: bg },
  cs: { translation: cs },
  da: { translation: da },
  de: { translation: de },
  el: { translation: el },
  en: englishResource,
  es: { translation: es },
  fi: { translation: fi },
  fr: { translation: fr },
  he: { translation: he },
  hi: { translation: hi },
  hu: { translation: hu },
  id: { translation: id },
  it: { translation: it },
  ja: { translation: ja },
  ko: { translation: ko },
  nb: { translation: nb },
  nl: { translation: nl },
  pl: { translation: pl },
  pt: { translation: pt },
  ro: { translation: ro },
  ru: { translation: ru },
  sv: { translation: sv },
  th: { translation: th },
  tr: { translation: tr },
  uk: { translation: uk },
  vi: { translation: vi },
  'zh-CN': { translation: zhCN },
  'zh-TW': { translation: zhTW },
};

export const resources = Object.fromEntries(
  locales.map((locale) => [locale, translatedResources[locale]]),
) as Record<Locale, { translation: Messages }>;

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && locales.includes(value as Locale));
}
