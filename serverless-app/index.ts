/*
 * Using Pulumi, create and deploy a serverless application that processes uploads to a storage
 * bucket and builds an index of the files in a database table.
 * 
 * TODOs
 * - Figure out how to get the file generation stuff to run after the magic functions are created and ready.
 * - Maybe change things from using two different triggers (create and delete) and functions to one trigger (any event) and
 *   one function that handles the different events (e.g. not just create and delete but update)
 */

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as util from 'util';
import * as AWS  from 'aws-sdk';
import { S3LambdaDynamo } from './s3lambda'

/**** DynamoDB *****/
const dbTableName = "s3object-table" 
const fileTable = new aws.dynamodb.Table(dbTableName, {
    attributes: [
        {
            name: "ObjectKey",
            type: "S",
        },
    ],
    billingMode: "PROVISIONED",
    hashKey: "ObjectKey",
    readCapacity: 5,
    writeCapacity: 5,
    ttl: {
        attributeName: "TimeToExist",
        enabled: false,
    },
    name: dbTableName, // assures the table name is known. to-do: figure out how to use generated table name in the magic function.
});

const s3lambdaComplex = new S3LambdaDynamo("s3lambdaComplex", dbTableName, {})

/* This doesn't work.
 * It seems to continue the moment the first element of S3LambdaDynamo is ready and doesn't wait until all the elements -
 * specifically the lambda functions are done.
 * So the file creations are not processed .... hmmmmm
 * 
// push some sample files to the S3 bucket after everything is set up.
let filesDir = "samplefiles"; // directory for some files to load as part of the S3 set up.
for (let item of require("fs").readdirSync(filesDir)) {
    let filePath = require("path").join(filesDir, item);
    let object = new aws.s3.BucketObject(item, {
      bucket: s3lambdaComplex.bucketName,
      source: new pulumi.asset.FileAsset(filePath),     // use FileAsset to point to a file
    }, {dependsOn: [s3lambdaComplex, fileTable]});
}
*/

// Export some data
export const S3bucket = s3lambdaComplex.bucketName;
export const DynamoDbTable = fileTable.id;