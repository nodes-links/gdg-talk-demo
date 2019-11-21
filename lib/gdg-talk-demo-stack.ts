import cdk = require("@aws-cdk/core");
import { Function, Code, Runtime } from "@aws-cdk/aws-lambda";
import { Duration } from "@aws-cdk/core";
import { Table, AttributeType } from "@aws-cdk/aws-dynamodb";
import { RestApi, LambdaIntegration } from "@aws-cdk/aws-apigateway";
import {
  Cluster,
  Ec2TaskDefinition,
  FargateTaskDefinition,
  ContainerImage,
  AwsLogDriver
} from "@aws-cdk/aws-ecs";
import { Vpc } from "@aws-cdk/aws-ec2";
import { Role, ServicePrincipal, PolicyStatement } from "@aws-cdk/aws-iam";

export class GdgTalkDemoStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const primaryKey = "itemId";
    const dynamoTable = new Table(this, "items", {
      partitionKey: {
        name: primaryKey,
        type: AttributeType.STRING
      },
      tableName: "items",
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const dynamoPost = this.newFn("DynamoPost", "src/dynamo-post");
    const dynamoGet = this.newFn("DynamoGet", "src/dynamo-get");

    [dynamoGet, dynamoPost].forEach((fn: Function) => {
      fn.addEnvironment("TABLE", dynamoTable.tableName);
      fn.addEnvironment("PRIMARY_KEY", primaryKey);
    });

    dynamoTable.grantWriteData(dynamoPost);
    dynamoTable.grantReadData(dynamoGet);

    const api = new RestApi(this, "itemsApi", {
      restApiName: "Items Service"
    });

    const items = api.root.addResource("items");

    const itemId = items.addResource("{id}");

    items.addMethod("GET", new LambdaIntegration(dynamoGet));
    itemId.addMethod("POST", new LambdaIntegration(dynamoPost));

    const startTask = this.newFn("StartTask", "src/start-task");

    this.createContainerTask(startTask);

    const taskRsr = api.root.addResource("task");

    taskRsr.addMethod("POST", new LambdaIntegration(startTask));
  }
  newFn = (name: string, source: string) =>
    new Function(this, name, {
      code: Code.fromAsset(source),
      handler: "app.handler",
      runtime: Runtime.NODEJS_10_X,
      timeout: Duration.seconds(10)
    });

  createContainerTask = (startTaskFn: Function) => {
    const cluster = new Cluster(this, "Cluster");
    const taskRole = new Role(this, `TaskDefinitionRole`, {
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com")
    });
    const taskDefinition = new FargateTaskDefinition(this, "TaskDef", {
      taskRole
    });
    const containerName = "LongRunningTask";
    taskDefinition.addContainer(containerName, {
      image: ContainerImage.fromAsset("src/task"),
      logging: new AwsLogDriver({
        streamPrefix: "gdg"
      })
    });
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
    startTaskFn.addEnvironment("CLUSTER_NAME", cluster.clusterName);
    startTaskFn.addEnvironment(
      "TASK_DEFINITION",
      taskDefinition.taskDefinitionArn
    );
    startTaskFn.addEnvironment("SUBNET", cluster.vpc.publicSubnets[0].subnetId);
  };
}
