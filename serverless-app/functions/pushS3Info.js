/* 
 * Lambda function that writes file name and timestamp to DynamoDb for S3 objects.
 */
 
 // dependencies
const AWS = require('aws-sdk');
const util = require('util');

// get reference to S3 client
const dbClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event, context, callback) => {

    // Read options from the event parameter.
    console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));
    const bucket = event.Records[0].s3.bucket.name;
    // Object key may have spaces or unicode non-ASCII characters.
    const objectKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    const eventTimestamp = event.Records[0].eventTime
    const eventType = event.Records[0].eventName

    const dbTable = "s3object-table"

    // Upload the thumbnail image to the destination bucket
    const dbParams = {
        Item: {
            ObjectKey: objectKey,
            TimeStamp: eventTimestamp, 
        },
        TableName: dbTable,
    };

    dbClient.put(dbParams, function(err, data) {
        if (err) {
            console.log(err);
            callback(err, null)
        } else {
            callback(null, data)
        }
    });
        
    console.log('Pushed to DynamoDB table, ' + dbTable + ' - Key: ' + objectKey + '; Timestamp: ' + eventTimestamp);
};