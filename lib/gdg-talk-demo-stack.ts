import cdk = require("@aws-cdk/core");
import { Function, Code, Runtime } from "@aws-cdk/aws-lambda";
import { Duration } from "@aws-cdk/core";
import { Table, AttributeType } from "@aws-cdk/aws-dynamodb";
import { RestApi, LambdaIntegration } from "@aws-cdk/aws-apigateway";
import {
  Cluster,
  FargateTaskDefinition,
  ContainerImage,
  AwsLogDriver
} from "@aws-cdk/aws-ecs";
import { Role, ServicePrincipal, PolicyStatement } from "@aws-cdk/aws-iam";

export class GdgTalkDemoStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a DynamoDB table

    const primaryKey = "itemId";
    const dynamoTable = new Table(this, "items", {
      partitionKey: {
        name: primaryKey,
        type: AttributeType.STRING
      },
      tableName: "items",
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Create two Lambda functions to interact with the table

    const dynamoPost = this.newFn("DynamoPost", "src/dynamo-post");
    const dynamoGet = this.newFn("DynamoGet", "src/dynamo-get");

    // Make sure the details of the table are available in the body of the Lambda functions

    [dynamoGet, dynamoPost].forEach((fn: Function) => {
      fn.addEnvironment("TABLE", dynamoTable.tableName);
      fn.addEnvironment("PRIMARY_KEY", primaryKey);
    });

    // Make sure the lambda functions have (only) the permissions required to do what they need to do

    dynamoTable.grantWriteData(dynamoPost);
    dynamoTable.grantReadData(dynamoGet);

    // Create a REST API and define the necessary paths/resources

    const api = new RestApi(this, "itemsApi", {
      restApiName: "Items Service"
    });

    const items = api.root.addResource("items");

    const itemId = items.addResource("{id}");

    // Specify which paths are handled by which Lambda functions

    items.addMethod("GET", new LambdaIntegration(dynamoGet));
    itemId.addMethod("POST", new LambdaIntegration(dynamoPost));

    // Create a Lambda function responsible for starting a containerized task

    const startTask = this.newFn("StartTask", "src/start-task");

    // Create all the resources necessary to run the containerized task

    this.createContainerTask(startTask);

    // Specify an API path to start the task, and assign the corresponding Lambda function

    const taskRsr = api.root.addResource("task");

    taskRsr.addMethod("POST", new LambdaIntegration(startTask));
  }

  /**
   * This function normalizes the creation of Lambda functions that are suitable for us, by setting some defaults
   */
  newFn = (name: string, source: string) =>
    new Function(this, name, {
      code: Code.fromAsset(source),
      handler: "app.handler",
      runtime: Runtime.NODEJS_10_X,
      timeout: Duration.seconds(10)
    });

  /**
   * This function helps us provision the resources necessary to create a containerized task
   */
  createContainerTask = (startTaskFn: Function) => {
    // Create an ECS cluster

    const cluster = new Cluster(this, "Cluster");

    // Create a task definition IAM role that will be assumed by the container

    const taskRole = new Role(this, `TaskDefinitionRole`, {
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com")
    });

    // Create the task definition
    const taskDefinition = new FargateTaskDefinition(this, "TaskDef", {
      taskRole
    });

    // Assign a container to the task and specify where it will get the container image

    const containerName = "LongRunningTask";
    taskDefinition.addContainer(containerName, {
      image: ContainerImage.fromAsset("src/task"),
      logging: new AwsLogDriver({
        streamPrefix: "gdg"
      })
    });

    // Some extra security stuff

    const executionRole = taskDefinition.obtainExecutionRole();
    executionRole.grantPassRole(new ServicePrincipal("lambda.amazonaws.com"));
    const clusterPolicy = new PolicyStatement({
      actions: ["ecs:RunTask"],
      resources: [taskDefinition.taskDefinitionArn]
    });
    const passRolePolicy = new PolicyStatement({
      actions: ["iam:PassRole"],
      resources: [executionRole.roleArn, taskRole.roleArn]
    });
    startTaskFn.addToRolePolicy(clusterPolicy);
    startTaskFn.addToRolePolicy(passRolePolicy);

    // Make sure the details of the task and the cluster are available in the body of the Lambda function

    startTaskFn.addEnvironment("CLUSTER_NAME", cluster.clusterName);
    startTaskFn.addEnvironment(
      "TASK_DEFINITION",
      taskDefinition.taskDefinitionArn
    );
    startTaskFn.addEnvironment("SUBNET", cluster.vpc.publicSubnets[0].subnetId);
  };
}
