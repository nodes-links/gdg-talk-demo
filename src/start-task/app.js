const AWS = require('aws-sdk');
const ecs = new AWS.ECS();

exports.handler = async () => {
  await ecs
    .runTask({
      taskDefinition: process.env.TASK_DEFINITION,
      launchType: 'FARGATE',
      cluster: process.env.CLUSTER_NAME,
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: [process.env.SUBNET],
          assignPublicIp: 'ENABLED'
        }
      }
    })
    .promise();
  return { statusCode: 200, body: 'Task started!' };
};
