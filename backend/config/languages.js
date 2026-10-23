
const supportedLanguages = {
    javascript: {
        label: "JavaScript",
        compiler: "Node.js 22",
        judge0LanguageId: 63
    },

    python: {
        label: "Python",
        compiler: "Python 3",
        judge0LanguageId: 71
    },

    java: {
        label: "Java",
        compiler: "OpenJDK 21 (javac)",
        judge0LanguageId: 62
    },

    cpp: {
        label: "C++",
        compiler: "G++ 13.3",
        judge0LanguageId: 54
    },

    c: {
        label: "C",
        compiler: "GCC 13.3",
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