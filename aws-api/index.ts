/*
 * This example code mirrors the example documented in this guide here: https://www.netlify.com/guides/creating-an-api-with-aws-lambda-dynamodb-and-api-gateway
 * Hence you'll see comments that reflect the sections of that guide.
 */
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as random from '@pulumi/random';
import { RandomUuid } from '@pulumi/random';

// Let's build a DynamoDB
const tableName = 'Restaurants';
const table = new aws.dynamodb.Table(tableName, {
  attributes: [
    {
      name: 'Id',
      type: 'S',
    },
  ],
  billingMode: 'PROVISIONED',
  hashKey: 'Id',
  readCapacity: 10,
  writeCapacity: 5,
  name: tableName,
});

// Let's prepopulate with some data.
// This is not necessary in general since external systems will likely be the ones populating data, but the guide included some prepopulation of entries.
// Plus it shows some fun bits of Pulumi IaC - namely, being able to use natural language for loops and other concepts like conditional assignment, etc.
// This leverages the Random provider which includes a RandomPet to create somewhat normal sounding names instead of random strings of characters.
const numPreItems = 3;
for (let i = 0; i < numPreItems; i++) {
  const randUuid = new random.RandomUuid('uuid' + i);
  const randName = new random.RandomPet('name' + i);
  const freeDel = i % 2 == 0 ? true : false;
  const item = pulumi.interpolate`{
        "Id": {"S": "${randUuid.result}"},
        "Name": {"S": "${randName.id}"},
        "FreeDelivery": {"BOOL": ${freeDel}}
    }`;
  const tableItem = new aws.dynamodb.TableItem('TableItem' + i, {
    tableName: table.name,
    hashKey: table.hashKey,
    item: item,
  });
}
