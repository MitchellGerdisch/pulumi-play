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
import * as util from 'util';
import * as AWS  from 'aws-sdk';

/**** S3 Bucket *****/
// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("serverless-app-bkt", {
    forceDestroy: true,
});

/**** DynamoDB *****/
const dbTableName = "s3object-table" 
const fileTable = new aws.dynamodb.Table(dbTableName, {
    attributes: [
        {
            name: "ObjectKey",
            type: "S",
        },
        {
            name: "TimeStamp",
            type: "S",
        },
    ],
    billingMode: "PROVISIONED",
    hashKey: "ObjectKey",
    rangeKey: "TimeStamp",
    readCapacity: 5,
    writeCapacity: 5,
    /*
    ttl: {
        attributeName: "TimeToExist",
        enabled: false,
    },
    */
    name: dbTableName, // could not get dynamic name of table into magic function and so essentially hardcoding the table name for now.
});

/***** Lambda via magic function love *****/
async function pushItem(dbName: string, cleanKey: string, eventTime: string) {
        const dbClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'})
        // DynamoDB entry
        let dbParams = {
            Item: {
                ObjectKey: cleanKey,
                TimeStamp: eventTime,
            },
            TableName: dbTableName,
        }
        console.log("dbParams",dbParams)
    
        // Push the DB entry
        await dbClient.put(dbParams, function(err, data) {
            console.log("processing result from dbClient")
            if (err) {
                console.log("DB PUT ERROR",err);
            } else {
                console.log("DB PUT SUCCESS");
            };
        });
            
        console.log('Pushed to DynamoDB table, ' +  dbTableName + ': Key: ' + cleanKey + '; Timestamp: ' + eventTime);
}
bucket.onObjectCreated("lambdaFunc", event => {

    // Read options from the event parameter.
    console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));
    for (const record of event.Records || [])  {
        const cleanKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
        const eventTime = record.eventTime;
        pushItem(dbTableName, cleanKey, eventTime);
    };
});

/**** this doesn't really work as expected so not bothering for now 
// push some sample files to the S3 bucket after everything is set up.
let filesDir = "samplefiles"; // directory for some files to load as part of the S3 set up.
for (let item of require("fs").readdirSync(filesDir)) {
    let filePath = require("path").join(filesDir, item);
    let object = new aws.s3.BucketObject(item, {
      bucket: bucket,
      source: new pulumi.asset.FileAsset(filePath),     // use FileAsset to point to a file
    });
}
*****8*/

// Export some data
export const S3bucket = bucket.id;
export const DynamoDbTable = fileTable.id;
