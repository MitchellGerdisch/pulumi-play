/*
 * Using Pulumi, create and deploy a serverless application that processes uploads to a storage
 * bucket and builds an index of the files in a database table.
 * 
 * Plan:
 * - (DONE) Get s3 bucket configuration working.
 *  - (DONE) Have it push some files too. There's Pulumi example of doing that.
 * - (DONE) Get DynamoDB or similar working.
 * - Get Lambda working that reads S3 files and pushes data to DB
 *  - Detects files that are there
 *  - Detects new files as they are added
 * 
 */

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";


/**** S3 Bucket *****/
// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("serverless-app-bkt");

let filesDir = "samplefiles"; // directory for some files to load as part of the S3 set up.

// push each file to the S3 bucket
for (let item of require("fs").readdirSync(filesDir)) {
    let filePath = require("path").join(filesDir, item);
    let object = new aws.s3.BucketObject(item, {
      bucket: bucket,
      source: new pulumi.asset.FileAsset(filePath),     // use FileAsset to point to a file
    });
}


/**** DynamoDB *****/
const fileTable = new aws.dynamodb.Table("file-table", {
    attributes: [
        {
            name: "FileName",
            type: "S",
        },
        {
            name: "TimeStamp",
            type: "S",
        },
    ],
    billingMode: "PROVISIONED",
    hashKey: "FileName",
    rangeKey: "TimeStamp",
    readCapacity: 5,
    writeCapacity: 5,
    ttl: {
        attributeName: "TimeToExist",
        enabled: false,
    },
});

// Export the name of the bucket
export const bucketName = bucket.id;
export const table = fileTable.id;
