const express = require("express");
const bodyParser = require("body-parser");
const {
    getEngines,
    getLocalAppBundles,
    getActivities,
    setup,
    deleteAccount,
} = require("../services/aps.js");

let router = express.Router();

router.use(bodyParser.json());

router.get("/api/engines", async function (req, res, next) {
    try {
        const engines = await getEngines();
        res.json(engines);
    } catch (err) {
        res.statusMessage = err;
        res.status(500).end();
    }
});

router.get("/api/appbundles", async function (req, res, next) {
    try {
        const appbundles = await getLocalAppBundles();
        res.json(appbundles);
    } catch (err) {
        res.statusMessage = err;
        res.status(500).end();
    }
});

router.get("/api/activities", async function (req, res, next) {
    try {
        const activities = await getActivities();
        res.json(activities);
    } catch (err) {
        res.statusMessage = err;
        res.status(500).end();
    }
});

router.post("/api/setup", async function (req, res, next) {
    try {
        const response = await setup(req.body);
        res.json(response);
    } catch (err) {
        res.statusMessage = err;
        res.status(500).end();
    }
});

router.delete("/api/account", async function (req, res, next) {
    try {
        await deleteAccount();
        res.end();
    } catch (err) {
        res.statusMessage = err;
        res.status(500).end();
    }
});

module.exports = router;
