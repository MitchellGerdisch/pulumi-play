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
    forceDestroy: true, // destroys bucket even if there are files in there
});

/**** DynamoDB *****/
const dbTableName = "s3object-table" 
const fileTable = new aws.dynamodb.Table(dbTableName, {
    attributes: [
        {
            name: "ObjectKey",
            type: "S",
        },
        /*
        {
            name: "TimeStamp",
            type: "S",
        },
        */
    ],
    billingMode: "PROVISIONED",
    hashKey: "ObjectKey",
    //rangeKey: "TimeStamp",
    readCapacity: 5,
    writeCapacity: 5,
    ttl: {
        attributeName: "TimeToExist",
        enabled: false,
    },
    name: dbTableName, // assures the table name is known. to-do: figure out how to use generated table name in the magic function.
});

/***** Lambda via magic function love *****/
// Helper function that the magic function calls to push the item.
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
    console.log("Push dbParams",dbParams)

    // Push the DB entry
    await dbClient.put(dbParams, function(err, data) {
        if (err) {
            console.log("DB PUT ERROR",err);
        } else {
            console.log("DB PUT SUCCESS", "TABLE: "+dbTableName, "KEY: "+cleanKey, "TIME: "+eventTime);
        };
    });
}

// Deletes item from DB - called when a file is removed from S3
async function deleteItem(dbName: string, cleanKey: string) {
    const dbClient = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'})
    // DynamoDB entry
    let dbParams = {
        Key: {
            ObjectKey: cleanKey
        },
        TableName: dbTableName,
    }
    console.log("Delete dbParams",dbParams)

    // delete the DB entry
    await dbClient.delete(dbParams, function(err, data) {
        if (err) {
            console.log("DB DELETE ERROR",err);
        } else {
            console.log("DB DELETE SUCCESS", "TABLE: "+dbTableName, "KEY: "+cleanKey);
        };
    });
}


// When bucket objects are created (e.g. a file is uploaded) this will invoke the defined (lambda) function to add the item to the DB.
bucket.onObjectCreated("addObjectLambda", event => {
    // Read options from the event parameter.
    console.log("S3 Create event:\n", util.inspect(event, {depth: 5}));
    for (const record of event.Records || [])  {
        const cleanKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
        const eventTime = record.eventTime;
        pushItem(dbTableName, cleanKey, eventTime);
    };
});

// When bucket objects are deleted this will invoke the defined (lambda) function to remove the item from the DB.
bucket.onObjectRemoved("deleteObjectLambda", event => {
    // Read options from the event parameter.
    console.log("S3 Delete event:\n", util.inspect(event, {depth: 5}));
    for (const record of event.Records || [])  {
        const cleanKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
        deleteItem(dbTableName, cleanKey);
    };
});

// push some sample files to the S3 bucket after everything is set up.
/*** doesn't work currently due to parallell processing. maybe component resource stuff will fix it automagically.
let filesDir = "samplefiles"; // directory for some files to load as part of the S3 set up.
for (let item of require("fs").readdirSync(filesDir)) {
    let filePath = require("path").join(filesDir, item);
    let object = new aws.s3.BucketObject(item, {
      bucket: bucket,
      source: new pulumi.asset.FileAsset(filePath),     // use FileAsset to point to a file
    });
}
***/

// Export some data
export const S3bucket = bucket.id;
export const DynamoDbTable = fileTable.id;
