require("dotenv").config();

let { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_NICKNAME, APS_BUCKET, PORT } =
    process.env;
if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
    console.warn("Missing some of the environment variables.");
    process.exit(1);
}
APS_BUCKET = APS_BUCKET || `${APS_NICKNAME.toLowerCase()}-designautomation`;
APS_ALIAS = 'dev';
PORT = PORT || 8080;

APS_DA_CLIENT_CONFIG = {
    circuitBreaker: {
        threshold: 11,
        interval: 1200,
    },
    retry: {
        maxNumberOfRetries: 7,
        backoffDelay: 4000,
        backoffPolicy: "exponentialBackoffWithJitter",
    },
    requestTimeout: 13000,
};

module.exports = {
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    PORT,
    APS_DA_CLIENT_CONFIG,
    APS_NICKNAME,
    APS_ALIAS,
    APS_BUCKET
};
