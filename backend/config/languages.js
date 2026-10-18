
const supportedLanguages = {
    javascript: {
        label: "JavaScript",
        judge0LanguageId: 63
    },

    python: {
        label: "Python",
        judge0LanguageId: 71
    },

    java: {
        label: "Java",
        judge0LanguageId: 62
    },

    cpp: {
        label: "C++",
        judge0LanguageId: 54
    },

    c: {
        label: "C",
        judge0LanguageId: 50
    }
};

const getLanguageConfig = (language) => {
    if (!language || typeof language !== "string") {
        return null;
    }

    return supportedLanguages[language.toLowerCase()] || null;
};

module.exports = {
    supportedLanguages,
    getLanguageConfig
};