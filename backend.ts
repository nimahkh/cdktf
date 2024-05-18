import { Construct } from "constructs";
import * as aws from "@cdktf/provider-aws";
import { LOCAL } from "./const";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront-distribution";
import { TerraformOutput } from "cdktf";

export class BackendStack extends Construct {
    constructor(scope: Construct, id: string, props: { primaryAwsProvider: AwsProvider, frontendCloudFront: CloudfrontDistribution }) {
        super(scope, id);

        const vpc = new aws.vpc.Vpc(this, "Vpc", {
            cidrBlock: LOCAL.vpc_cidr,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            tags: {
                Name: "backend-vpc",
            },
        });

        const internetGateway = new aws.internetGateway.InternetGateway(this, "InternetGateway", {
            vpcId: vpc.id,
        });

        const routeTable = new aws.routeTable.RouteTable(this, "RouteTable", {
            vpcId: vpc.id,
            route: [{
                cidrBlock: "0.0.0.0/0",
                gatewayId: internetGateway.id,
            }],
        });

        const subnet1 = new aws.subnet.Subnet(this, "Subnet1", {
            vpcId: vpc.id,
            cidrBlock: "10.0.1.0/24",
            availabilityZone: `${LOCAL.aws_region}a`,
            mapPublicIpOnLaunch: true,
        });

        const subnet2 = new aws.subnet.Subnet(this, "Subnet2", {
            vpcId: vpc.id,
            cidrBlock: "10.0.2.0/24",
            availabilityZone: `${LOCAL.aws_region}b`,
            mapPublicIpOnLaunch: true,
        });

        new aws.routeTableAssociation.RouteTableAssociation(this, "Subnet1Association", {
            subnetId: subnet1.id,
            routeTableId: routeTable.id,
        });

        new aws.routeTableAssociation.RouteTableAssociation(this, "Subnet2Association", {
            subnetId: subnet2.id,
            routeTableId: routeTable.id,
        });

        const ecsSecurityGroup = new aws.securityGroup.SecurityGroup(this, "EcsSecurityGroup", {
            name: "backend-ecs-sg",
            vpcId: vpc.id,
            ingress: [
                {
                    fromPort: 5001,
                    toPort: 5001,
                    protocol: "tcp",
                    cidrBlocks: ["0.0.0.0/0"],
                }
            ],
            egress: [
                {
                    fromPort: 0,
                    toPort: 0,
                    protocol: "-1",
                    cidrBlocks: ["0.0.0.0/0"],
                },
            ],
        });

        // const rdsSecurityGroup: SecurityGroup = new aws.securityGroup.SecurityGroup(this, "RDSSecurityGroup", {
        //     name: "backend-rds-sg",
        //     vpcId: vpc.id,
        //     ingress: [
        //         {
        //             fromPort: 3306,
        //             toPort: 3306,
        //             protocol: "tcp",
        //             cidrBlocks: [vpc.cidrBlock],
        //             securityGroups: [ecsSecurityGroup.id]
        //         },
        //     ],
        //     egress: [
        //         {
        //             fromPort: 0,
        //             toPort: 0,
        //             protocol: "-1",
        //             cidrBlocks: ["0.0.0.0/0"],
        //         },
        //     ],
        // });

        // const databaseSubnetGroups = new aws.dbSubnetGroup.DbSubnetGroup(this, "DBSubnetGroup", {
        //     name: "backend-db-subnet-group",
        //     subnetIds: [subnet1.id, subnet2.id],
        // });

        // const rdsInstance = new aws.dbInstance.DbInstance(this, "RDSInstance", {
        //     identifier: 'backend-mysql',
        //     engine: "mysql",
        //     multiAz: false,
        //     instanceClass: "db.t3.micro",
        //     allocatedStorage: 20,
        //     dbName: "test_db",
        //     username: "admin",
        //     password: "password",
        //     skipFinalSnapshot: true,
        //     publiclyAccessible: true,
        //     storageEncrypted: true,
        //     backupRetentionPeriod: 7,
        //     vpcSecurityGroupIds: [rdsSecurityGroup.id],
        //     dbSubnetGroupName: databaseSubnetGroups.name,
        //     availabilityZone: `${LOCAL.aws_region}a`,
        // });

        const ecsCluster = new aws.ecsCluster.EcsCluster(this, "EcsCluster", {
            name: "BackendCluster",
            provider: props.primaryAwsProvider,
        });

        const ecsTaskExecutionRole = new aws.iamRole.IamRole(this, "ECSTaskExecutionRole", {
            name: "ecs-task-execution-role",
            assumeRolePolicy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Action: "sts:AssumeRole",
                        Effect: "Allow",
                        Principal: {
                            Service: "ecs-tasks.amazonaws.com",
                        },
                    },
                ],
            }),
        });

        new aws.iamRolePolicyAttachment.IamRolePolicyAttachment(this, "ECSTaskExecutionPolicy", {
            role: ecsTaskExecutionRole.name,
            policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
        });

        new aws.iamRolePolicy.IamRolePolicy(this, "ECSTaskExecutionRolePolicy", {
            name: "ecs-task-execution-role-policy",
            role: ecsTaskExecutionRole.name,
            policy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: [
                            "logs:CreateLogGroup",
                            "logs:CreateLogStream",
                            "logs:PutLogEvents"
                        ],
                        Resource: "*"
                    }
                ]
            })
        });

        const logGroup = new aws.cloudwatchLogGroup.CloudwatchLogGroup(this, "LogGroup", {
            name: "/ecs/backend",
            retentionInDays: 7,
        });

        const backendTaskDefinition = new aws.ecsTaskDefinition.EcsTaskDefinition(this, "BackendTaskDefinition", {
            family: "backend",
            containerDefinitions: JSON.stringify([
                {
                    name: "backend",
                    image: `339712737352.dkr.ecr.eu-west-1.amazonaws.com/${LOCAL.ecr_repo_name}:latest`,
                    essential: true,
                    logConfiguration: {
                        logDriver: "awslogs",
                        options: {
                            "awslogs-group": logGroup.name,
                            "awslogs-region": LOCAL.aws_region,
                            "awslogs-stream-prefix": "ecs"
                        }
                    },
                    portMappings: [
                        {
                            containerPort: 5001,
                            hostPort: 5001,
                        },
                    ],
                    memory: 512,
                    cpu: 256,
                    // environment: [
                    //     { name: "DB_HOST", value: rdsInstance.endpoint },
                    //     { name: "DB_PORT", value: "3306" },
                    //     { name: "DB_USER", value: "admin" },
                    //     { name: "DB_PASS", value: "password" },
                    //     { name: "DB_NAME", value: "test_db" },
                    // ],
                },
            ]),
            networkMode: "awsvpc",
            requiresCompatibilities: ["FARGATE"],
            cpu: "256",
            memory: "512",
            executionRoleArn: ecsTaskExecutionRole.arn,
        });

        //Load balancer

        const ecsService = new aws.ecsService.EcsService(this, "BackendService", {
            name: 'backend-ecs-service',
            cluster: ecsCluster.arn,
            taskDefinition: backendTaskDefinition.arn,
            desiredCount: 1,
            launchType: "FARGATE",
            networkConfiguration: {
                assignPublicIp: true,
                subnets: [subnet1.id, subnet2.id],
                securityGroups: [ecsSecurityGroup.id],
            },
        });

        new TerraformOutput(this, "BackendApiEndpoint", {
            value: ecsService
        });
    }
}
