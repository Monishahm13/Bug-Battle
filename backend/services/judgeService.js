
const axios = require("axios");

const getJudgeConfig = () => {
    const baseURL = process.env.JUDGE0_URL;
    const apiKey = process.env.JUDGE0_API_KEY;

    if (!baseURL) {
        throw new Error("JUDGE0_URL is not configured");
    }

    return {
        baseURL: baseURL.replace(/\/+$/, ""),
        apiKey
    };
};

const getHeaders = (apiKey) => {
    const headers = {
        "Content-Type": "application/json"
    };

    if (apiKey) {
        headers["X-Auth-Token"] = apiKey;
    }

    return headers;
};

const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

const submitToJudge = async ({
    sourceCode,
    languageId,
    stdin = "",
    expectedOutput = ""
}) => {
    if (!sourceCode || !sourceCode.trim()) {
        throw new Error("Source code cannot be empty");
    }

    const { baseURL, apiKey } = getJudgeConfig();
    const headers = getHeaders(apiKey);

    // Submit the source code without waiting for execution.
    const submissionResponse = await axios.post(
        `${baseURL}/submissions?base64_encoded=false&wait=false`,
        {
            source_code: sourceCode,
            language_id: languageId,
            stdin,
            expected_output: expectedOutput
        },
        {
            headers,
            timeout: 15000
        }
    );

    const token = submissionResponse.data.token;

    if (!token) {
        throw new Error("Judge0 did not return a submission token");
    }

    // Poll until execution finishes or the time limit is reached.
    const maxAttempts = 20;
    const pollInterval = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await sleep(pollInterval);

        const resultResponse = await axios.get(
            `${baseURL}/submissions/${token}?base64_encoded=false`,
            {
                headers,
                timeout: 10000
            }
        );

        const result = resultResponse.data;
        const statusId = result.status?.id;

        // IDs 1 and 2 mean In Queue and Processing.
        if (statusId !== 1 && statusId !== 2) {
            return result;
        }
    }

    throw new Error("Code execution timed out while waiting for Judge0");
};

module.exports = {
    submitToJudge
};
