/*
 * This example code mirrors the example documented in this guide here: https://www.netlify.com/guides/creating-an-api-with-aws-lambda-dynamodb-and-api-gateway
 * Hence you'll see comments that reflect the sections of that guide.
 */
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as random from '@pulumi/random';
import * as AWS from 'aws-sdk';

///// DynamoDB Set Up //////

// Create a DynamoDB table
const tableName = 'Restaurants';
const table = new aws.dynamodb.Table(tableName, {
  attributes: [
    {
      name: 'id',
      type: 'S',
    },
  ],
  billingMode: 'PROVISIONED',
  hashKey: 'id',
  readCapacity: 10,
  writeCapacity: 5,
  name: tableName,
});

// Prepopulate with some data.
// This is generally not necessary since external systems will likely be the ones populating data, but for the sake of showing examples in the guide, let's add some random-ish data.
// Plus it shows some fun bits of Pulumi IaC - namely, being able to use natural language for loops and other concepts like conditional assignment, etc.
// This leverages the Random provider to create the UUID and Name.
const numPreItems = 3;
for (let i = 0; i < numPreItems; i++) {
  const randUuid = new random.RandomUuid('uuid' + i);
  const randName = new random.RandomPet('name' + i);
  const freeDel = i % 2 == 0 ? true : false;
  const item = pulumi.interpolate`{
        "id": {"S": "${randUuid.result}"},
        "name": {"S": "${randName.id}"},
        "freeDelivery": {"BOOL": ${freeDel}}
    }`;
  const tableItem = new aws.dynamodb.TableItem('TableItem' + i, {
    tableName: table.name,
    hashKey: table.hashKey,
    item: item,
  });
}

///// API Gateway and Lambda Event Handler //////
// This next part leverages Pulumi's Crosswalk for AWS (https://www.pulumi.com/docs/guides/crosswalk/aws/).
// In a nutshell, Crosswalk simplifies complex multistep and resource configuration use-cases.

// Helper function to retrieve specific customer data from DB
async function getRestaurants(dbName: string) {
  const dbClient = new AWS.DynamoDB.DocumentClient();
  // DynamoDB entry
  let dbParams = {
    TableName: dbName,
  };

  const dbContents = await dbClient
    .scan(dbParams, (err, data) => {
      if (err) {
        console.log(err);
      } else {
        console.log('Success', data.Items);
      }
    })
    .promise();
  return dbContents.Items;
}

const api = new awsx.apigateway.API('restaurants-api', {
  routes: [
    {
      path: '/restaurants',
      method: 'GET',
      eventHandler: async (event) => {
        const result = await getRestaurants(tableName);
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*',
            'Access-Control-Allow-Credentials': '*',
          },
          body: JSON.stringify(result),
        };
      },
    },
  ],
});

// Export the API call for quick testing
// This can also be passed into the application, etc as per the guide
export const apiUrl = pulumi.interpolate`${api.stage.invokeUrl}/restaurants`;
