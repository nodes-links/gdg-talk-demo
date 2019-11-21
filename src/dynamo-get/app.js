const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();

exports.handler = async () => {
  items = (await db.scan({ TableName: process.env.TABLE }).promise()).Items;
  return { statusCode: 200, body: JSON.stringify(items) };
};
