const { SdkManagerBuilder } = require("@aps_sdk/autodesk-sdkmanager");

const {
    OssClient,
    PolicyKey,
    Region,
} = require("@aps_sdk/oss");
const {
    APS_BUCKET,
} = require("../config.js");
const {
    getInternalToken,
} = require("./aps.auth.js");

const sdk = SdkManagerBuilder.create().build();
const ossClient = new OssClient(sdk);

const service = (module.exports = {});

service.ensureBucketExists = async (bucketKey) => {
    const { access_token } = await getInternalToken();
    try {
        await ossClient.getBucketDetails(bucketKey, { accessToken: access_token });
    } catch (err) {
        if (err.axiosError.response.status === 404) {
            await ossClient.createBucket(
                Region.Us,
                {
                    bucketKey: bucketKey,
                    policyKey: PolicyKey.Transient,
                },
                {
                    accessToken: access_token,
                }
            );
        } else {
            throw err;
        }
    }
};

service.getObjectId = async (bucketKey, objectKey, file) => {
    try {
        const { access_token } = await getInternalToken();
        //uploadResources takes an Object or Object array of resource to uplaod with their parameters,
        //we are just passing only one object.
        let uploadResponse = await ossClient.uploadObject(bucketKey, objectKey, file.path, { accessToken: access_token });
        //lets check for the first and only entry.
        console.log(uploadResponse.objectId);
        return uploadResponse.objectId;
    } catch (err) {
        console.error("Failed to create ObjectID\n", err);
        throw err;
    }
};

service.getDownloadUrl = async (fileName) => {
    const { access_token } = await getInternalToken();

    try {
        //create a S3 presigned URL and send to client
        let response = await ossClient.createSignedResource(APS_BUCKET, fileName, {
            access: "read",
            useCdn: true,
            accessToken: access_token,
        });

        return {
            url: response.signedUrl,
        };
    } catch (err) {
        console.error(err);
        throw err;
    }
};