const express = require("express");
const { PORT } = require("./config.js");

let app = express();

app.use(express.static("wwwroot"));
app.use(require("./routes/workitems.js"));
app.use(require("./routes/setup.js"));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.statusMessage = err;
    res.status(500).end();
});

app.listen(PORT, function () {
    console.log(`Server listening on port ${PORT}...`);
});
