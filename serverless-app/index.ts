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

/**** DynamoDB *****/
const fileTable = new aws.dynamodb.Table("s3object-table", {
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
    ttl: {
        attributeName: "TimeToExist",
        enabled: false,
    },
});

/***** Lambda function *****/
const lambdaRole = new aws.iam.Role("lambdaRole", {
    assumeRolePolicy: {
       Version: "2012-10-17",
       Statement: [{
          Action: "sts:AssumeRole",
          Principal: {
             Service: "lambda.amazonaws.com",
          },
          Effect: "Allow",
          Sid: "",
       }],
    },
 });
 new aws.iam.RolePolicyAttachment("lambdaRoleAttach", {
    role: lambdaRole,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaFullAccess,
 });
 
 // Create the lambda function using the function in our functions directory
 const  lambdaFunc = new aws.lambda.Function("lambdaFunc", {
   code: new pulumi.asset.AssetArchive({
        ".": new pulumi.asset.FileArchive("./functions"),
    }),
    handler: "pushS3Info.handler",
    runtime: "nodejs12.x",
    role: lambdaRole.arn,
 });
 
 bucket.onObjectCreated("lambdaFunc", lambdaFunc);

// push some sample files to the S3 bucket after everything is set up.
let filesDir = "samplefiles"; // directory for some files to load as part of the S3 set up.
for (let item of require("fs").readdirSync(filesDir)) {
    let filePath = require("path").join(filesDir, item);
    let object = new aws.s3.BucketObject(item, {
      bucket: bucket,
      source: new pulumi.asset.FileAsset(filePath),     // use FileAsset to point to a file
    });
}


// Export some data
export const S3bucket = bucket.id;
export const DynamoDbTable = fileTable.id;
export const LambdaFunc = lambdaFunc.id;
