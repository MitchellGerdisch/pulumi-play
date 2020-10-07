/*
 * This example code is inspired by the configuration documented in this guide: https://www.netlify.com/guides/creating-an-api-with-aws-lambda-dynamodb-and-api-gateway
 * Instead of manually building the API gateway and related parts step-by-step, this file leverages Pulumi infrastructure as code to deploy the system.
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

// Prepopulate with some data as per the guide.
// Although this is, arguably, throw-away code - the API could/would support a POST action to allow for populating the restaurants DB,
// it allows for quick testing and as a side effect, it further demonstrates the power of Pulumi IaC.
// For example, since you are using an actual programming language, you can write logic using for loops and other concepts like conditional assignment, etc.
const numPreItems = 3;
for (let i = 0; i < numPreItems; i++) {
  const randUuid = new random.RandomUuid('uuid' + i).result; // get a random UUID
  const randName = new random.RandomPet('name' + i).id; // get a random name
  const rating = new random.RandomInteger('rating' + i, { min: 1, max: 5 }).result; // get a random rating
  const freeDel = i % 2 == 0 ? true : false; // just flip flop free delivery setting
  const delTime = new random.RandomShuffle('delTime' + i, {
    inputs: ['10', '20', '30', '45', '60'],
    resultCount: 1,
  }).results; // get a random delivery time
  // other attributes like menu could also be programmatically added
  const item = pulumi.interpolate`{
        "id": {"S": "${randUuid}"},
        "name": {"S": "${randName}"},
        "freeDel": {"BOOL": ${freeDel}},
        "rating": {"N": "${rating}"},
        "delTime": {"N": "${delTime}"}
    }`;
  const tableItem = new aws.dynamodb.TableItem('TableItem' + i, {
    tableName: table.name,
    hashKey: table.hashKey,
    item: item,
  });
}

///// API Gateway and Lambda Event Handler //////
// This next part leverages Pulumi's Crosswalk for AWS (https://www.pulumi.com/docs/guides/crosswalk/aws/).
// In a nutshell, Crosswalk simplifies complex multistep resource configuration use-cases.

// This function is the event handler code that will be automatically pushed into Lambda as part of the API gateway declaration below.
// Of course, this function and additional handler functions for other API methods (e.g. POST method to add restaurants to the DB, or DELETE method to remove restaurants)
// could be stored and maintaned in a separate module file. But for the sake of readability it is kept in the main file.
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
  return {
    statusCode: 200,
    body: JSON.stringify(dbContents.Items),
  };
}

// Instantiate an API gateway and the related Lambda event handler.
// In keeping with the above referenced guide, the API is simple get-me-all-the-restaurants API.
// Of course additional routes and event handlers could be added to handle different methods and parameter options.
const api = new awsx.apigateway.API('restaurants-api', {
  routes: [
    {
      // GET method to retrieve all the restaurants
      path: '/restaurants',
      method: 'GET',
      apiKeyRequired: true,
      eventHandler: async (event) => {
        return await getRestaurants(tableName);
      },
    },
  ],
});

// Add a usage plan and api key as per the guide.
const apikeys = awsx.apigateway.createAssociatedAPIKeys('restaurant-api-keys', {
  apis: [api],
  apiKeys: [
    {
      name: 'restaurant-api-key',
    },
  ],
});

// Export the API call and API key for testing
// Although the API key is sensitive data, for this use-case it is exported to the command line for testing purposes.
// That said, Pulumi allows you avoid displaying sensitive data via its secrets support.
export const apiUrl = pulumi.interpolate`${api.stage.invokeUrl}/restaurants`;
export const apiKeyValue = apikeys.keys[0].apikey.value;

// At this point, these outputs are available to other systems to complete a pipeline.
// The guide uses the URL and key to configure Nuxt and Netlify. These values are programmatically accessible.
// Similarly, it may be possible to create a Pulumi provider that interacts with Netlify as well. In that scenario, this file would declare the Netlify resources and pass
// the URL and API key and whatever else accordingly. Thus giving you a full end-to-end deployment.
