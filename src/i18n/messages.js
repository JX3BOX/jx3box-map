import messages from "./messages.json";

export const JX3BOX_MAP_I18N_NAMESPACE = "jx3boxMap";

export const jx3boxMapMessages = messages;

export function normalizeJx3boxMapLocale(locale) {
    const value = String(locale || "").trim().toLowerCase();
    if (value.startsWith("zh-tw") || value.startsWith("zh-hk") || value.startsWith("zh-hant")) return "zh-TW";
    if (value.startsWith("en")) return "en-US";
    if (value.startsWith("vi")) return "vi";
    return "zh-CN";
}

export function interpolateJx3boxMapMessage(message, params = {}) {
    return String(message || "").replace(/\{(\w+)\}/g, (_, key) => {
        const value = params[key];
        return value === undefined || value === null ? "" : String(value);
    });
}

export function createJx3boxMapTranslator(locale, messages = {}) {
    const normalizedLocale = normalizeJx3boxMapLocale(locale);
    const localeMessages = {
        ...jx3boxMapMessages["zh-CN"],
        ...(jx3boxMapMessages[normalizedLocale] || {}),
        ...(messages["zh-CN"] || {}),
        ...(messages[normalizedLocale] || {}),
    };
    return (key, params) => interpolateJx3boxMapMessage(localeMessages[key] || key, params);
}
