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

router.get("/api/setup/engines", async function (req, res, next) {
    try {
        const engines = await getEngines();
        res.json(engines);
    } catch (err) {
        next(err);
    }
});

router.get("/api/setup/appbundles", async function (req, res, next) {
    try {
        const appbundles = await getLocalAppBundles();
        res.json(appbundles);
    } catch (err) {
        next(err);
    }
});

router.get("/api/setup/activities", async function (req, res, next) {
    try {
        const activities = await getActivities();
        res.json(activities);
    } catch (err) {
        next(err);
    }
});

router.post("/api/setup", async function (req, res, next) {
    try {
        const zipFileName = req.body.zipFileName;
        const engineName = req.body.engine;
        const response = await setup(engineName, zipFileName);
        res.json(response);
    } catch (err) {
        next(err);
    }
});

router.delete("/api/setup/account", async function (req, res, next) {
    try {
        await deleteAccount();
        res.end();
    } catch (err) {
        next(err);
    }
});

module.exports = router;
