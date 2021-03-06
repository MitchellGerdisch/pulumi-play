# Creating an API with AWS: Lambda, DynamoDB and API Gateway

This folder contains [Pulumi](https://www.pulumi.com/) infrastructure as code that stands up the environment described in [Lambda, DynamoDB, and API Gateway for your Jamstack App](https://www.netlify.com/guides/creating-an-api-with-aws-lambda-dynamodb-and-api-gateway).

Although this example ends with making the API URL and Key available, it wouldn't be very difficult to extend the example to push the information to Netlify to complete the pipeline.

## Basic Architecture

- Deploy DynamoDB
  - Prepopulate it with some data
- Deploy API gateway
  - Define a route for the GET method as described in the guide.
  - Use a Lambda event handler to process the API request and interact with the DynamoDB backend.
  - Enable an API key
