const APS = require("forge-apis");
const DA = require("autodesk.forge.designautomation");
const {
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    APS_DA_CLIENT_CONFIG,
    APS_NICKNAME,
} = require("../config.js");

const path = require("path");
const fs = require("fs");
const url = require("url");

const formdata = require("form-data");
const http = require("https");

let internalAuthClient = new APS.AuthClientTwoLegged(
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    [
        "bucket:read",
        "bucket:create",
        "data:read",
        "data:write",
        "data:create",
        "code:all",
    ],
    true
);

const service = (module.exports = {});

service.getEngines = async () => {
    let allEngines = [];
    let paginationToken = null;
    try {
        const api = await Utils.getAPI();
        while (true) {
            let engines = await api.getEngines(
                paginationToken ? { page: paginationToken } : {}
            );
            allEngines = allEngines.concat(engines.data);
            if (engines.paginationToken == null) break;
            paginationToken = engines.paginationToken;
        }
        return allEngines.sort(); // return list of engines
    } catch (err) {
        console.error(err);
        throw "Failed to get engines list" + (err ? ": " + err : "");
    }
};

service.getLocalAppBundles = async () => {
    let bundles = await Utils.findFiles(Utils.LocalBundlesFolder, ".zip");
    bundles = bundles.map((fn) => path.basename(fn, ".zip"));
    return bundles;
};

service.getActivities = async () => {
    const api = await Utils.getAPI();
    // filter list of
    let activities = null;
    try {
        activities = await api.getActivities();
    } catch (err) {
        console.error(err);
        throw "Failed to get Activity list" + (err ? ": " + err : "");
    }
    let definedActivities = [];
    for (let i = 0; i < activities.data.length; i++) {
        let activity = activities.data[i];
        if (
            activity.startsWith(Utils.NickName) &&
            activity.indexOf("$LATEST") === -1
        )
            definedActivities.push(activity.replace(Utils.NickName + ".", ""));
    }

    return definedActivities;
};

service.setup = async (engineName, zipFileName) => {
    const appBundle = await createAppBundle(engineName, zipFileName);
    const activity = await createActivity(engineName, zipFileName);
    return {
        ...appBundle,
        ...activity,
    };
};

service.deleteAccount = async () => {
    let api = await Utils.getAPI();
    // clear account
    await api.deleteForgeApp("me");
};

service.startWorkItem = async (activityName, widthParam, heigthParam, file) => {
    const qualifiedActivityId = `${Utils.NickName}.${activityName}`;
    // upload file to OSS Bucket
    // 1. ensure bucket existis
    const bucketKey = Utils.NickName.toLowerCase() + "-designautomation";
    try {
        let payload = new APS.PostBucketsPayload();
        payload.bucketKey = bucketKey;
        payload.policyKey = "transient"; // expires in 24h
        await new APS.BucketsApi().createBucket(
            payload,
            {},
            null,
            await getInternalToken()
        );
    } catch (err) {
        // in case bucket already exists
    }
    // 2. upload inputFile
    const inputFileNameOSS = `${new Date()
        .toISOString()
        .replace(/[-T:\.Z]/gm, "")
        .substring(0, 14)}_input_${path.basename(file.originalname)}`; // avoid overriding
    // prepare workitem arguments
    const token = await getInternalToken();
    const bearerToken = ["Bearer", token.access_token].join(" ");
    // 1. input file
    const inputFileArgument = {
        url: await Utils.getObjectId(bucketKey, inputFileNameOSS, file),
        headers: { Authorization: bearerToken },
    };
    // 2. input json
    const inputJson = {
        width: widthParam,
        height: heigthParam,
    };
    const inputJsonArgument = {
        url:
            "data:application/json, " +
            JSON.stringify(inputJson).replace(/"/g, "'"),
    };
    // 3. output file
    const outputFileNameOSS = `${new Date()
        .toISOString()
        .replace(/[-T:\.Z]/gm, "")
        .substring(0, 14)}_output_${path.basename(file.originalname)}`; // avoid overriding
    const outputFileArgument = {
        url: await Utils.getObjectId(bucketKey, outputFileNameOSS, file),
        verb: DA.Verb.put,
        headers: { Authorization: bearerToken },
    };

    // prepare & submit workitem
    const workItemSpec = {
        activityId: qualifiedActivityId,
        arguments: {
            inputFile: inputFileArgument,
            inputJson: inputJsonArgument,
            outputFile: outputFileArgument,
        },
    };
    let workItemStatus = null;
    try {
        const api = await Utils.getAPI();
        workItemStatus = await api.createWorkItem(workItemSpec);
    } catch (err) {
        console.error(err);
        throw "Failed to create a Work Item";
    }
    return {
        workItemId: workItemStatus.id,
        fileName: outputFileNameOSS,
    };
};

service.getWorkItem = async (id) => {
    const api = await Utils.getAPI();

    try {
        const job = await api.getWorkitemStatus(id);
        return job;
    } catch (err) {
        console.error(err);
        throw "Failed to get Work Item info";
    }
};

service.getDownloadUrl = async (fileName) => {
    const objectsApi = new APS.ObjectsApi();
    const bucketKey = Utils.NickName.toLowerCase() + "-designautomation";

    try {
        //create a S3 presigned URL and send to client
        let response = await objectsApi.getS3DownloadURL(
            bucketKey,
            fileName,
            { useAcceleration: false, minutesExpiration: 15 },
            null,
            await getInternalToken()
        );

        return {
            url: response.body.url,
        };
    } catch (err) {
        console.error(err);
        throw err;
    }
};

async function getInternalToken() {
    if (!internalAuthClient.isAuthorized()) {
        await internalAuthClient.authenticate();
    }
    return internalAuthClient.getCredentials();
}

async function getAppBundles() {
    // get defined app bundles
    const api = await Utils.getAPI();
    try {
        const appBundles = await api.getAppBundles();
        return appBundles;
    } catch (err) {
        console.error(err);
        throw "Failed to get the Bundle list";
    }
}

async function createAppBundle(engineName, zipFileName) {
    // standard name for this sample
    const appBundleName = zipFileName + "AppBundle";

    // check if ZIP with bundle is here
    const packageZipPath = path.join(
        Utils.LocalBundlesFolder,
        zipFileName + ".zip"
    );

    const appBundles = await getAppBundles();

    const api = await Utils.getAPI();

    // check if app bundle is already define
    let newAppVersion = null;
    const qualifiedAppBundleId = `${Utils.NickName}.${appBundleName}+${Utils.Alias}`;
    if (!appBundles.data.includes(qualifiedAppBundleId)) {
        // create an appbundle (version 1)
        const appBundleSpec = DA.AppBundle.constructFromObject({
            package: appBundleName,
            engine: engineName,
            id: appBundleName,
            description: `Description for ${appBundleName}`,
        });
        try {
            newAppVersion = await api.createAppBundle(appBundleSpec);
        } catch (err) {
            console.error(err.toString());
            const error = err?.response?.error?.text;
            throw "Cannot create new App Bundle" + (error ? ": " + error : "");
        }

        // create alias pointing to v1
        const aliasSpec = {
            id: Utils.Alias,
            version: 1,
        };
        try {
            await api.createAppBundleAlias(appBundleName, aliasSpec);
        } catch (err) {
            console.error(err.toString());
            const error = err?.response?.error?.text;
            throw "Failed to create an Alias" + (error ? ": " + error : "");
        }
    } else {
        // create new version
        const appBundleSpec = {
            engine: engineName,
            description: appBundleName,
        };
        try {
            newAppVersion = await api.createAppBundleVersion(
                appBundleName,
                appBundleSpec
            );
        } catch (err) {
            console.error(err.toString());
            const error = err?.response?.error?.text;
            throw "Cannot create new version" + (error ? ": " + error : "");
        }

        // update alias pointing to v+1
        const aliasSpec = {
            version: newAppVersion.version,
        };
        try {
            await api.modifyAppBundleAlias(
                appBundleName,
                Utils.Alias,
                aliasSpec
            );
        } catch (err) {
            console.error(err.toString());
            const error = err?.response?.error?.text;
            throw "Failed to create an Alias" + (error ? ": " + error : "");
        }
    }

    // upload the zip with .bundle
    try {
        // curl https://bucketname.s3.amazonaws.com/
        // -F key = apps/myApp/myfile.zip
        // -F content-type = application/octet-stream
        // -F policy = eyJleHBpcmF0aW9uIjoiMjAxOC0wNi0yMVQxMzo...(trimmed)
        // -F x-amz-signature = 800e52d73579387757e1c1cd88762...(trimmed)
        // -F x-amz-credential = AKIAIOSFODNN7EXAMPLE/20180621/us-west-2/s3/aws4_request/
        // -F x-amz-algorithm = AWS4-HMAC-SHA256
        // -F x-amz-date = 20180621T091656Z
        // -F file=@E:myfile.zip
        //
        // The ‘file’ field must be at the end, all fields after ‘file’ will be ignored.
        await Utils.uploadFormDataWithFile(
            packageZipPath,
            newAppVersion.uploadParameters.endpointURL,
            newAppVersion.uploadParameters.formData
        );
    } catch (err) {
        console.error(err.toString());
        const error = err?.response?.error?.text;
        throw "Failed to upload App Bundle on S3" + (error ? ": " + error : "");
    }

    return {
        appBundle: qualifiedAppBundleId,
        version: newAppVersion.version,
    };
}

async function createActivity(engineName, zipFileName) {
    // standard name for this sample
    const appBundleName = zipFileName + "AppBundle";
    const activityName = zipFileName + "Activity";

    // get defined activities
    const api = await Utils.getAPI();
    let activities = null;
    try {
        activities = await api.getActivities();
    } catch (err) {
        console.error(err);
        throw "Failed to get Activity list";
    }
    const qualifiedActivityId = `${Utils.NickName}.${activityName}+${Utils.Alias}`;
    if (!activities.data.includes(qualifiedActivityId)) {
        // define the activity
        // ToDo: parametrize for different engines...
        const engineAttributes = Utils.getEngineAttributes(engineName);
        const commandLine = engineAttributes.commandLine.replace(
            "{0}",
            appBundleName
        );
        const activitySpec = {
            id: activityName,
            appbundles: [`${Utils.NickName}.${appBundleName}+${Utils.Alias}`],
            commandLine: [commandLine],
            engine: engineName,
            parameters: {
                inputFile: {
                    description: "input file",
                    localName: "$(inputFile)",
                    ondemand: false,
                    required: true,
                    verb: DA.Verb.get,
                    zip: false,
                },
                inputJson: {
                    description: "input json",
                    localName: "params.json",
                    ondemand: false,
                    required: false,
                    verb: DA.Verb.get,
                    zip: false,
                },
                outputFile: {
                    description: "output file",
                    localName: "outputFile." + engineAttributes.extension,
                    ondemand: false,
                    required: true,
                    verb: DA.Verb.put,
                    zip: false,
                },
            },
            settings: {
                script: {
                    value: engineAttributes.script,
                },
            },
        };
        try {
            await api.createActivity(activitySpec);
        } catch (err) {
            console.error(err);
            throw "Failed to create new Activity";
        }
        // specify the alias for this Activity
        const aliasSpec = {
            id: Utils.Alias,
            version: 1,
        };
        try {
            await api.createActivityAlias(activityName, aliasSpec);
        } catch (err) {
            console.error(err);
            throw "Failed to create new Alias for Activity";
        }

        return {
            activity: qualifiedActivityId,
        };
    }

    // as this activity points to a AppBundle "dev" alias (which points to the last version of the bundle),
    // there is no need to update it (for this sample), but this may be extended for different contexts
    return {
        activity: "Activity already defined",
    };
}

// Static instance of the DA API
let daInstance = null;

class Utils {
    static get Instance() {
        if (daInstance === null) {
            // Here it is ok to not await since we awaited in the call router.use()
            daInstance = new DA.AutodeskForgeDesignAutomationClient(
                APS_DA_CLIENT_CONFIG
            );
            let fetchRefresh = async (data) => {
                // data is undefined in a fetch, but contains the old credentials in a refresh
                let credentials = await getInternalToken();
                // The line below is for testing
                //credentials.expires_in = 30; credentials.expires_at = new Date(Date.now() + credentials.expires_in * 1000);
                return credentials;
            };
            daInstance.authManager.authentications["2-legged"].fetchToken =
                fetchRefresh;
            daInstance.authManager.authentications["2-legged"].refreshToken =
                fetchRefresh;
        }
        return daInstance;
    }

    /// <summary>
    /// Returns the directory where bindles are stored on the local machine.
    /// </summary>
    static get LocalBundlesFolder() {
        return path.resolve(path.join(__dirname, "../", "bundles"));
    }

    /// <summary>
    /// Prefix for AppBundles and Activities
    /// </summary>
    static get NickName() {
        return APS_NICKNAME;
    }

    /// <summary>
    /// Alias for the app (e.g. DEV, STG, PROD). This value may come from an environment variable
    /// </summary>
    static get Alias() {
        return "dev";
    }

    /// <summary>
    /// Search files in a folder and filter them.
    /// </summary>
    static async findFiles(dir, filter) {
        return new Promise((resolve, reject) => {
            fs.readdir(dir, (err, files) => {
                if (err) return reject(err);

                files = files.filter((file) => {
                    return path.extname(file) === filter;
                });

                resolve(files);
            });
        });
    }

    /// <summary>
    /// Create a new DA client/API with default settings
    /// </summary>
    static async getAPI() {
        // There is 2 alternatives to setup an API instance, providing the access_token directly
        // let apiClient2 = new DA.AutodeskForgeDesignAutomationClient(/*config.client*/);
        // apiClient2.authManager.authentications['2-legged'].accessToken = oauth2.access_token;
        //return (new DA.AutodeskForgeDesignAutomationApi(apiClient));

        // Or use the Auto-Refresh feature
        let apiClient = await Utils.Instance;
        return new DA.AutodeskForgeDesignAutomationApi(apiClient);
    }

    /// <summary>
    /// Helps identify the engine
    /// </summary>
    static getEngineAttributes(engine) {
        if (engine.includes("3dsMax"))
            return {
                commandLine:
                    '$(engine.path)\\3dsmaxbatch.exe -sceneFile "$(args[inputFile].path)" "$(settings[script].path)"',
                extension: "max",
                script: "da = dotNetClass('Autodesk.Forge.Sample.DesignAutomation.Max.RuntimeExecute')\nda.ModifyWindowWidthHeight()\n",
            };
        if (engine.includes("AutoCAD"))
            return {
                commandLine:
                    '$(engine.path)\\accoreconsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[{0}].path)" /s "$(settings[script].path)"',
                extension: "dwg",
                script: "UpdateParam\n",
            };
        if (engine.includes("Inventor"))
            return {
                commandLine:
                    '$(engine.path)\\InventorCoreConsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[{0}].path)"',
                extension: "ipt",
                script: "",
            };
        if (engine.includes("Revit"))
            return {
                commandLine:
                    '$(engine.path)\\revitcoreconsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[{0}].path)"',
                extension: "rvt",
                script: "",
            };

        throw new Error("Invalid engine");
    }

    static getFormDataLength(form) {
        return new Promise((fulfill, reject) => {
            form.getLength((err, length) => {
                if (err) return reject(err);
                fulfill(length);
            });
        });
    }

    /// <summary>
    /// Upload a file
    /// </summary>
    static uploadFormDataWithFile(filepath, endpoint, params = null) {
        return new Promise(async (resolve, reject) => {
            const fileStream = fs.createReadStream(filepath);

            const form = new formdata();
            if (params) {
                const keys = Object.keys(params);
                for (let i = 0; i < keys.length; i++)
                    form.append(keys[i], params[keys[i]]);
            }
            form.append("file", fileStream);

            let headers = form.getHeaders();
            headers["Cache-Control"] = "no-cache";
            headers["Content-Length"] = await Utils.getFormDataLength(form);

            const urlinfo = url.parse(endpoint);
            const postReq = http.request(
                {
                    host: urlinfo.host,
                    port:
                        urlinfo.port ||
                        (urlinfo.protocol === "https:" ? 443 : 80),
                    path: urlinfo.pathname,
                    method: "POST",
                    headers: headers,
                },
                (response) => {
                    resolve(response.statusCode);
                },
                (err) => {
                    reject(err);
                }
            );

            form.pipe(postReq);
        });
    }

    static async getObjectId(bucketKey, objectKey, file) {
        try {
            let contentStream = fs.createReadStream(file.path);

            //uploadResources takes an Object or Object array of resource to uplaod with their parameters,
            //we are just passing only one object.
            let uploadResponse = await new APS.ObjectsApi().uploadResources(
                bucketKey,
                [
                    {
                        objectKey: objectKey,
                        data: contentStream,
                        length: file.size,
                    },
                ],
                {
                    useAcceleration: false, //Whether or not to generate an accelerated signed URL
                    minutesExpiration: 20, //The custom expiration time within the 1 to 60 minutes range, if not specified, default is 2 minutes
                    onUploadProgress: (data) => console.warn(data), // function (progressEvent) => {}
                },
                null,
                await getInternalToken()
            );
            //lets check for the first and only entry.
            if (
                uploadResponse[0].hasOwnProperty("error") &&
                uploadResponse[0].error
            ) {
                throw new Error(uploadResponse[0].completed.reason);
            }
            console.log(uploadResponse[0].completed.objectId);
            return uploadResponse[0].completed.objectId;
        } catch (err) {
            console.error("Failed to create ObjectID\n", err);
            throw ex;
        }
    }
}
