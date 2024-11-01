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
            const workItemData = JSON.parse(req.body.data);
            const widthParam = parseFloat(workItemData.width);
            const heigthParam = parseFloat(workItemData.height);
            const activityName = workItemData.activityName;
            const workItem = await startWorkItem(
                activityName,
                widthParam,
                heigthParam,
                req.file
            );
            res.json(workItem);
        } catch (err) {
            next(err);
        }
    }
);

router.get("/api/workitems/:id", async function (req, res, next) {
    try {
        const workItem = await getWorkItem(req.params.id);
        res.json(workItem);
    } catch (err) {
        next(err);
    }
});

router.get("/api/files/:name/url", async function (req, res, next) {
    try {
        const file = await getDownloadUrl(req.params.name);
        res.json(file);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
