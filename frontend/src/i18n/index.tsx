import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "qrmenu_lang";
const DEFAULT_LANG = "hy";

export const LANGUAGES = [
  { code: "hy", label: "Հայերեն" },
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
] as const;

type LangCode = (typeof LANGUAGES)[number]["code"];

const DICT: Record<LangCode, Record<string, string>> = {
  hy: {
    "app.brand": "QR Մենյու",
    "app.tagline": "Ռեստորանների համար՝ պարզ, վստահելի և գեղեցիկ",

    "nav.dashboard": "Վահանակ",
    "nav.restaurants": "Ռեստորաններ",
    "nav.categories": "Կատեգորիաներ",
    "nav.dishes": "Ուտեստներ",
    "nav.tables": "Սեղաններ",
    "nav.users": "Օգտատերեր",
    "nav.publicPreview": "Հանրային մենյու",

    "auth.login.title": "Մուտք",
    "auth.login.subtitle": "Կառավարեք QR մենյուն, սեղանները և թիմը",
    "auth.identifier": "Էլ․ փոստ կամ օգտանուն",
    "auth.password": "Գաղտնաբառ",
    "auth.signin": "Մուտք գործել",
    "auth.signout": "Ելք",

    "common.search": "Որոնել…",
    "common.searchDish": "Փնտրել ուտեստ…",
    "common.create": "Ավելացնել",
    "common.save": "Պահել",
    "common.cancel": "Չեղարկել",
    "common.edit": "Խմբագրել",
    "common.delete": "Ջնջել",
    "common.close": "Փակել",
    "common.loading": "Բեռնում…",
    "common.error": "Սխալ",
    "common.retry": "Կրկին փորձել",
    "common.actions": "Գործողություններ",
    "common.status": "Կարգավիճակ",
    "common.yes": "Այո",
    "common.no": "Ոչ",
    "common.optional": "ընտրովի",
    "common.selectRestaurant": "Ընտրեք ռեստորանը",
    "common.open": "Բացել",
    "common.send": "Ուղարկել",
    "common.toggleTheme": "Փոխել թեման",
    "toast.welcome": "Բարի գալուստ",
    "toast.saved": "Պահպանված է",
    "toast.updated": "Թարմացված է",
    "toast.deleted": "Ջնջված է",
    "toast.loggedOut": "Դուրս եկաք համակարգից",

    "admin.restaurants.title": "Ռեստորաններ",
    "admin.restaurants.create.title": "Նոր ռեստորան",
    "admin.restaurants.empty.title": "Դեռ ռեստորան չկա",
    "admin.restaurants.empty.desc": "Ստեղծեք առաջին ռեստորանը և կազմեք QR մենյուն։",

    "admin.manage.title": "Կառավարում",
    "admin.categories.title": "Կատեգորիաներ",
    "admin.dishes.title": "Ուտեստներ",
    "admin.tables.title": "Սեղաններ",
    "admin.users.title": "Օգտատերեր",
    "admin.activeRestaurant": "Ակտիվ ռեստորան",
    "admin.selectRestaurant": "Ընտրեք ռեստորանը՝ շարունակելու համար։",
    "admin.dishes.needCategory": "Սկզբում ստեղծեք կատեգորիա՝ ուտեստ ավելացնելու համար։",

    "restaurant.name": "Անուն",
    "restaurant.slug": "Slug",
    "restaurant.description": "Նկարագրություն",
    "restaurant.logo": "Լոգո",
    "restaurant.theme": "Թեմա",
    "restaurant.menuFont": "Տառատեսակ",

    "category.name": "Կատեգորիայի անուն",
    "category.icon": "Icon (Lucide անուն)",

    "dish.name": "Ուտեստի անուն",
    "dish.description": "Նկարագրություն",
    "dish.price": "Գին",
    "dish.currency": "Արժույթ",
    "dish.category": "Կատեգորիա",
    "dish.image": "Նկար",
    "dish.available": "Առկա է",
    "dish.isSpicy": "Կծու",
    "dish.isVegan": "Վեգան",
    "dish.badge.spicy": "Կծու",
    "dish.badge.vegan": "Վեգան",
    "dish.badge.unavailable": "Չկա",
    "dish.noImage": "Պատկեր չկա",
    "dish.priceLabel": "Գին",
    "dish.favorite.add": "Սիրել",
    "dish.favorite.remove": "Հանել սիրվածներից",
    "dish.favorite.addAria": "Ավելացնել սիրվածների մեջ",
    "dish.favorite.removeAria": "Հանել սիրվածներից",

    "table.number": "Սեղանի համար",
    "table.occupied": "Զբաղված",
    "table.free": "Ազատ",

    "public.welcome": "Բարի գալուստ",
    "public.categories": "Կատեգորիաներ",
    "public.favorites": "Սիրվածներ",
    "public.cart": "Զամբյուղ",
    "public.cart.open": "Բացել զամբյուղը",
    "public.cart.empty": "Զամբյուղը դատարկ է",
    "public.cart.clear": "Մաքրել",
    "public.cart.total": "Ընդամենը",
    "public.toTop": "Վերև",
    "public.table": "Սեղան",
    "public.callWaiter": "Կանչել մատուցողին",
    "public.callWaiter.sent": "Հարցումը ուղարկվեց։",
    "public.callWaiter.failed": "Չհաջողվեց ուղարկել։",
    "public.callWaiter.note": "Նշում",
    "public.callWaiter.notePlaceholder": "Օր․՝ մանկական աթոռ, սառույց…",
    "public.callWaiter.water": "Ջուր",
    "public.callWaiter.bill": "Հաշիվ",
    "public.callWaiter.help": "Օգնություն",

    "public.menu.emptyAll.title": "Մենյուն դեռ դատարկ է",
    "public.menu.emptyAll.desc": "Մի քիչ հետո կրկին փորձեք։",
    "public.menu.noResults.title": "Չկա արդյունք",
    "public.menu.noResults.desc": "Փորձեք փոխել որոնումը կամ ընտրել այլ կատեգորիա։",
    "public.menu.loadFailed": "Չհաջողվեց բեռնել մենյուն։",

    "qr.resolving": "Բացում ենք մենյուն…",
    "qr.notFound": "QR կոդը չի գտնվել",
    "qr.hint": "Եթե ավտոմատ չբացվեց՝ թարմացրեք էջը։",
  },
  ru: {
    "app.brand": "QR Меню",
    "app.tagline": "Для ресторанов — просто, надёжно и красиво",
    "nav.publicPreview": "Публичное меню",
    "admin.dishes.needCategory": "Сначала создайте категорию, чтобы добавить блюдо.",
    "common.searchDish": "Поиск блюда…",
    "common.cancel": "Отмена",
    "common.close": "Закрыть",
    "common.loading": "Загрузка…",
    "common.error": "Ошибка",
    "common.optional": "необязательно",
    "common.send": "Отправить",
    "common.toggleTheme": "Переключить тему",
    "public.welcome": "Добро пожаловать",
    "public.favorites": "Избранное",
    "public.cart": "Корзина",
    "public.cart.open": "Открыть корзину",
    "public.cart.empty": "Корзина пустая",
    "public.cart.clear": "Очистить",
    "public.cart.total": "Итого",
    "public.toTop": "Наверх",
    "public.table": "Стол",
    "public.callWaiter": "Позвать официанта",
    "public.callWaiter.sent": "Запрос отправлен.",
    "public.callWaiter.failed": "Не удалось отправить.",
    "public.callWaiter.note": "Заметка",
    "public.callWaiter.notePlaceholder": "Например: детский стул, лёд…",
    "public.callWaiter.water": "Вода",
    "public.callWaiter.bill": "Счёт",
    "public.callWaiter.help": "Помощь",
    "public.menu.emptyAll.title": "Меню пока пустое",
    "public.menu.emptyAll.desc": "Попробуйте позже.",
    "public.menu.noResults.title": "Ничего не найдено",
    "public.menu.noResults.desc": "Попробуйте изменить поиск или выбрать другую категорию.",
    "public.menu.loadFailed": "Не удалось загрузить меню.",
    "dish.favorite.add": "В избранное",
    "dish.favorite.remove": "Убрать",
    "toast.welcome": "Բարի գալուստ",
    "toast.saved": "Պահպանված է",
    "toast.updated": "Թարմացված է",
    "toast.deleted": "Ջնջված է",
    "toast.loggedOut": "Դուրս եկաք համակարգից",
    "qr.resolving": "Открываем меню…",
    "qr.notFound": "QR код не найден",
    "qr.hint": "Если не открылось автоматически — обновите страницу.",
  },
  en: {
    "app.brand": "QR Menu",
    "app.tagline": "For restaurants — simple, trustworthy, beautiful",
    "common.searchDish": "Search dishes…",
    "admin.dishes.needCategory": "Create a category first to add a dish.",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.loading": "Loading…",
    "common.error": "Error",
    "common.toggleTheme": "Toggle theme",
    "public.welcome": "Welcome",
    "public.favorites": "Favorites",
    "public.cart": "Cart",
    "public.cart.open": "Open cart",
    "public.cart.empty": "Cart is empty",
    "public.cart.clear": "Clear",
    "public.cart.total": "Total",
    "public.toTop": "Top",
    "public.table": "Table",
    "public.callWaiter": "Call waiter",
    "public.callWaiter.sent": "Sent.",
    "public.callWaiter.failed": "Failed.",
    "public.callWaiter.note": "Note",
    "public.callWaiter.notePlaceholder": "E.g. high chair, ice…",
    "public.callWaiter.water": "Water",
    "public.callWaiter.bill": "Bill",
    "public.callWaiter.help": "Help",
    "public.menu.emptyAll.title": "Menu is empty",
    "public.menu.emptyAll.desc": "Try later.",
    "public.menu.noResults.title": "No results",
    "public.menu.noResults.desc": "Try changing search or category.",
    "public.menu.loadFailed": "Failed to load menu.",
    "dish.favorite.add": "Favorite",
    "dish.favorite.remove": "Unfavorite",
    "toast.welcome": "Welcome",
    "toast.saved": "Saved",
    "toast.updated": "Updated",
    "toast.deleted": "Deleted",
    "toast.loggedOut": "Signed out",
    "qr.resolving": "Opening menu…",
    "qr.notFound": "QR not found",
    "qr.hint": "If it doesn't open, refresh the page.",
  },
};

function interpolate(template: string, vars?: Record<string, unknown>) {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ""));
}

function getInitialLang(): LangCode {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && LANGUAGES.some((l) => l.code === saved)) return saved as LangCode;
  return DEFAULT_LANG;
}

type I18nValue = {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  t: (key: string, vars?: Record<string, unknown>) => string;
  languages: typeof LANGUAGES;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<LangCode>(getInitialLang);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useMemo(() => {
    return (key: string, vars?: Record<string, unknown>) => {
      const value = DICT[lang]?.[key] ?? DICT[DEFAULT_LANG]?.[key] ?? key;
      return interpolate(value, vars);
    };
  }, [lang]);

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, t]);
  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
