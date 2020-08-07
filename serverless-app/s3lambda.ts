/*
 * Builds the following:
 * - S3 bucket to which files are uploaded.
 * - Lambda function triggered by S3 file uploads that writes file name and timestamp to provided DynamoDB table.
 * 
 * TODO:
 * - Currently have to keep this code and the DyanmoDB code in synch since they both need to know table schema. 
 *   Would be neat to be able to pass that information into here. I'm thinking there's a way to evaluate parameters and use them as the schema keys.
 * 
 */

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as AWS  from 'aws-sdk'
import { output } from "@pulumi/aws/types";

export class S3LambdaDynamo extends pulumi.ComponentResource {

    public bucketName: pulumi.Output<string>;

    constructor(name: string, dbTableName: string, opts: pulumi.ComponentResourceOptions = {}) {

        // Register this component 
        super("exercise:S3LambdaDynamo", name, opts);

        /**** S3 Bucket *****/
        // Create an AWS resource (S3 Bucket)
        let bucket = new aws.s3.Bucket("serverless-app-bkt", {
            forceDestroy: true, // destroys bucket even if there are files in there
        }, {parent: this});

        // Create a property for the bucket name that was created
        this.bucketName = bucket.id;

        // For dependency tracking, register output properties for this component
        this.registerOutputs({
            bucketName: this.bucketName,
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
            console.log("S3 Create event:\n", event);
            for (const record of event.Records || [])  {
                const cleanKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
                const eventTime = record.eventTime;
                pushItem(dbTableName, cleanKey, eventTime);
            };
        });

        // When bucket objects are deleted this will invoke the defined (lambda) function to remove the item from the DB.
        bucket.onObjectRemoved("deleteObjectLambda", event => {
            // Read options from the event parameter.
            console.log("S3 Delete event:\n", event);
            for (const record of event.Records || [])  {
                const cleanKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
                deleteItem(dbTableName, cleanKey);
            };
        });
    };
};
