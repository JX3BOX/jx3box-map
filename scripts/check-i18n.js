const messages = require("../src/i18n/messages.json");

const locales = ["zh-CN", "zh-TW", "en-US", "vi"];
const fallbackLocale = "zh-CN";
const placeholderPattern = /\{(\w+)\}/g;

function placeholders(value) {
    return [...String(value).matchAll(placeholderPattern)].map((match) => match[1]).sort();
}

const referenceKeys = Object.keys(messages[fallbackLocale]).sort();
const errors = [];

for (const locale of locales) {
    const localeMessages = messages[locale];
    if (!localeMessages) {
        errors.push(`${locale}: missing locale`);
        continue;
    }

    const localeKeys = Object.keys(localeMessages).sort();
    if (JSON.stringify(localeKeys) !== JSON.stringify(referenceKeys)) {
        errors.push(`${locale}: key structure does not match ${fallbackLocale}`);
    }

    for (const key of referenceKeys) {
        const expected = placeholders(messages[fallbackLocale][key]);
        const actual = placeholders(localeMessages[key]);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            errors.push(`${locale}.${key}: placeholders ${actual.join(",")} do not match ${expected.join(",")}`);
        }
    }
}

if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
} else {
    console.log(`i18n check passed: ${locales.length} locales, ${referenceKeys.length} keys`);
}
