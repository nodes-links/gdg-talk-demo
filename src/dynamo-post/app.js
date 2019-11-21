const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();

exports.handler = async event => {
  await db
    .put({ TableName: process.env.TABLE, Item: { [process.env.PRIMARY_KEY]: event.pathParameters.id } })
    .promise();
  return { statusCode: 200, body: 'done!' };
};
