let { APS_CLIENT_ID, APS_CLIENT_SECRET, PORT } = process.env;
if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
	console.warn("Missing some of the environment variables.");
	process.exit(1);
}
PORT = PORT || 8080;

DA_CLIENT_CONFIG = {
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
	DA_CLIENT_CONFIG,
};
