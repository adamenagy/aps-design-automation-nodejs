document.getElementById("configure").onclick = function (button) {
    document.getElementById("configureDialog").showModal();
};

document.getElementById("clearAccount").onclick = async function (button) {
    if (
        !confirm(
            "Clear existing activities & app bundles before start. " +
                "This is useful if you believe there are wrong settings on your account." +
                "\n\nYou cannot undo this operation. Proceed?"
        )
    )
        return;

    try {
        const response = await fetch("/api/account", { method: "DELETE" });
        if (response.ok) {
            writeLog("Account cleared, all app bundles & activities deleted");
            list("activities");
        } else {
            throw "Account clear failed: " + response.statusText;
        }
    } catch (err) {
        writeLog(err);
    }
};

document.getElementById("createUpdate").onclick = async function (button) {
    try {
        writeLog(
            "Defining App Bundle and Activity for " +
                document.getElementById("engines").value
        );

        const response = await fetch("/api/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                zipFileName: document.getElementById("localBundles").value,
                engine: document.getElementById("engines").value,
            }),
        });

        if (response.ok) {
            const res = await response.json();
            writeLog("AppBundle: " + res.appBundle + ", v" + res.version);
            writeLog("Activity: " + res.activity);
            addItem("activities", res.activity.split(".")[1]);
        } else {
            throw "Setup failed: " + response.statusText;
        }
    } catch (err) {
        writeLog(err);
    }
};

document.getElementById("startWorkItem").onclick = async function (button) {
    try {
        const inputFileField = document.getElementById("inputFile");
        if (inputFileField.files.length === 0) {
            alert("Please select an input file");
            return;
        }
        if (document.getElementById("activities").value === "") {
            alert("Please select an activity");
            return;
        }

        const file = inputFileField.files[0];
        const formData = new FormData();
        formData.append("inputFile", file);
        formData.append(
            "data",
            JSON.stringify({
                width: document.getElementById("width").value,
                height: document.getElementById("height").value,
                activityName: document.getElementById("activities").value,
            })
        );
        writeLog("Uploading input file ...");
        const response = await fetch("/api/workitems", {
            body: formData,
            method: "POST",
        });

        if (response.ok) {
            const res = await response.json();
            writeLog("Work item started: " + res.workItemId);
            monitorWorkItem(res.workItemId, res.fileName);
        } else {
            throw "Work item failed: " + response.statusText;
        }
    } catch (err) {
        writeLog(err);
    }
};

prepareLists();

function prepareLists() {
    list("activities", "/api/activities");
    list("engines", "/api/engines");
    list("localBundles", "/api/appbundles");
}

async function list(id, endpoint) {
    try {
        const element = document.getElementById(id);
        element.innerHTML = "";

        let json = [];
        if (endpoint) {
            const response = await fetch(endpoint);
            if (!response.ok) throw "List failed: " + response.statusText;

            json = await response.json();
        }

        if (json.length === 0) {
            const option = document.createElement("option");
            element.disabled = true;
            option.text = "Nothing found";
            element.append(option);
            return;
        }

        for (const item of json) {
            addItem(id, item);
        }
        element.disabled = false;
    } catch (err) {
        writeLog(err);
    }
}

function addItem(id, item) {
    if (!item) return;

    const element = document.getElementById(id);
    const option = document.createElement("option");
    option.value = item;
    option.text = item;

    if (element.disabled) element.innerHTML = "";

    element.append(option);
    element.disabled = false;
}

function monitorWorkItem(workItemId, fileName) {
    const interval = setInterval(async function () {
        const response = await fetch("/api/workitems/" + workItemId);
        const json = await response.json();
        if (json.status === "success") {
            clearInterval(interval);
            writeLog("Work item finished: " + json.status);
            await printReport(json.reportUrl);
            downloadResult(fileName);
        } else if (json.status.includes("failed")) {
            clearInterval(interval);
            writeLog("Work item failed: " + json.status);
            printReport(json.reportUrl);
        } else {
            writeLog("Work item status: " + json.status);
        }
    }, 2000);
}

async function downloadResult(fileName) {
    const response = await fetch("/api/files/" + fileName + "/url");
    const json = await response.json();

    writeLog('<a href="' + json.url + '">Download result file here</a>');
}

async function printReport(url) {
    const res = await fetch(url);
    const text = await res.text();
    writeLog(text);
}

function writeLog(text) {
    var elem = document.getElementById("outputlog");
    elem.innerHTML +=
        '<div style="border-top: 1px dashed #C0C0C0">' + text + "</div>";
    elem.scrollTop = elem.scrollHeight;
}
