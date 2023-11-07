const express = require("express");
const { PORT } = require("./config.js");

let app = express();
app.use(express.static("wwwroot"));
app.use(require("./routes/workitems.js"));
app.use(require("./routes/setup.js"));
app.listen(PORT, function () {
	console.log(`Server listening on port ${PORT}...`);
});
