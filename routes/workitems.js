const express = require("express");
const {
    startWorkItem,
    getWorkItem,
    getDownloadUrl,
} = require("../services/aps.js");

const multer = require("multer");

let router = express.Router();

router.post(
    "/api/workitems",
    multer({
        dest: "uploads/",
    }).single("inputFile"),
    async function (req, res, next) {
        try {
            const workItem = await startWorkItem(req.body, req.file);
            res.json(workItem);
        } catch (err) {
            res.statusMessage = err;
            res.status(500).end();
        }
    }
);

router.get("/api/workitems/:id", async function (req, res, next) {
    try {
        const workItem = await getWorkItem(req.params.id);
        res.json(workItem);
    } catch (err) {
        res.statusMessage = err;
        res.status(500).end();
    }
});

router.get("/api/files/:name/url", async function (req, res, next) {
    try {
        const file = await getDownloadUrl(req.params.name);
        res.json(file);
    } catch (err) {
        res.statusMessage = err;
        res.status(500).end();
    }
});

module.exports = router;
