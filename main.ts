import { App, TerraformOutput, TerraformStack } from "cdktf";
import * as aws from "@cdktf/provider-aws";
import { DockerProvider } from "@cdktf/provider-docker/lib/provider";
import { Construct } from "constructs";

class MyStack extends TerraformStack {
    private local = {
        s3_origin_id: "S3Origin",
        frontend_bucket_name: "frontend-bucket",
        backend_bucket_name: "backend-bucket",
        vpc_cidr: "10.0.0.0/16",
        aws_region: "eu-west-1",
        ecr_repo_name: "backend-app-repo",
    };

    constructor(scope: Construct, name: string) {
        super(scope, name);

        // AWS Provider
        const primaryAwsProvider = new aws.provider.AwsProvider(this, "Aws", {
            region: `${this.local.aws_region}`,
            profile: "cdktf",
            accessKey: process.env.AWS_ACCESS_KEY_ID,
            secretKey: process.env.AWS_SECRET_ACCESS_KEY,
        });

        // Docker Provider
        new DockerProvider(this, "Docker", {});

        //FRONTEND 
        
        // Create an S3 bucket for the frontend files
        const frontendBucket = new aws.s3Bucket.S3Bucket(this, "FrontendBucket", {
            bucket: "frontend-bucket",
            tags: {
                name: 'frontend-bucket'
            },
        });

        new aws.s3BucketWebsiteConfiguration.S3BucketWebsiteConfiguration(this, "FrontendBucketWebsiteConfiguration", {
            bucket: frontendBucket.bucket,
            indexDocument: {
                suffix: "index.html"
            },
            errorDocument: {
                key: "index.html"
            },
        });

        new aws.s3BucketAcl.S3BucketAcl(this, "FrontendBucketAcl", {
            bucket: frontendBucket.bucket,
            acl: "private"
        });

        // Upload frontend files to S3
        new aws.s3Object.S3Object(this, "FrontendIndex", {
            bucket: frontendBucket.bucket,
            key: "index.html",
            source: "../frontend/dist/index.html",
        });

        // Create a CloudFront distribution for the frontend
        const originAccessIdentity =
            new aws.cloudfrontOriginAccessIdentity.CloudfrontOriginAccessIdentity(
                this,
                "OAI",
                {
                    comment: "Access Identity for CloudFront",
                }
            );

        const frontendCloudFront = new aws.cloudfrontDistribution.CloudfrontDistribution(this, "CloudFrontDistribution", {
            enabled: true,
            isIpv6Enabled: true,
            defaultRootObject: "index.html",
            loggingConfig: {
                bucket: "logs-bucket",
                includeCookies: false,
                prefix: "frontend/"
            },
            origin: [
                {
                    originId: this.local.s3_origin_id,
                    domainName: frontendBucket.bucketRegionalDomainName,
                    s3OriginConfig: {
                        originAccessIdentity: originAccessIdentity.cloudfrontAccessIdentityPath
                    }
                }
            ],
            defaultCacheBehavior: {
                allowedMethods: ["GET", "HEAD", "OPTIONS"],
                cachedMethods: ["GET", "HEAD"],
                targetOriginId: this.local.s3_origin_id,
                viewerProtocolPolicy: "redirect-to-https",
                forwardedValues: {
                    queryString: false,
                    cookies: {
                        forward: "none",
                    },
                },
            },
            restrictions: {
                geoRestriction: {
                    restrictionType: "none"
                }
            },
            viewerCertificate: {
                cloudfrontDefaultCertificate: true
            },
            dependsOn: [frontendBucket]
        });


        //Backend

        const vpc = new aws.vpc.Vpc(this, "Vpc", {
            cidrBlock: this.local.vpc_cidr,
            tags: {
                Name: "backend-vpc",
            },
        });

        const subnet1 = new aws.subnet.Subnet(this, "Subnet1", {
            vpcId: vpc.id,
            cidrBlock: "10.0.1.0/24",
            availabilityZone: `${this.local.aws_region}a`,
        });

        const subnet2 = new aws.subnet.Subnet(this, "Subnet2", {
            vpcId: vpc.id,
            cidrBlock: "10.0.2.0/24",
            availabilityZone: `${this.local.aws_region}b`,
        });

        const rdsSecurityGroup = new aws.securityGroup.SecurityGroup(this, "RDSSecurityGroup", {
            name: "backend-rds-sg",
            vpcId: vpc.id,
            ingress: [
                {
                    fromPort: 3306,
                    toPort: 3306,
                    protocol: "tcp",
                    cidrBlocks: [vpc.cidrBlock],
                },
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

        // Create an RDS instance for MySQL
        const rdsInstance = new aws.dbInstance.DbInstance(this, "RDSInstance", {
            identifier: 'backend-mysql',
            engine: "mysql",
            instanceClass: "db.t3.micro",
            allocatedStorage: 20,
            dbName: "test_db",
            username: "admin",
            password: "password",
            skipFinalSnapshot: true,
            publiclyAccessible: false,
            storageEncrypted: true,
            backupRetentionPeriod: 7,
            vpcSecurityGroupIds: [rdsSecurityGroup.id],
            dbSubnetGroupName: new aws.dbSubnetGroup.DbSubnetGroup(this, "DBSubnetGroup", {
                name: "backend-db-subnet-group",
                subnetIds: [subnet1.id, subnet2.id],
            }).name,
        });

        // Create an ECS cluster
        const ecsCluster = new aws.ecsCluster.EcsCluster(this, "EcsCluster", {
            name: "BackendCluster",
            provider: primaryAwsProvider,
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

        const backendTaskDefinition = new aws.ecsTaskDefinition.EcsTaskDefinition(this, "BackendTaskDefinition", {
            family: "backend",
            containerDefinitions: JSON.stringify([
                {
                    name: "backend",
                    image: `${this.local.ecr_repo_name}:latest`,
                    essential: true,
                    portMappings: [
                        {
                            containerPort: 5000,
                            hostPort: 5000,
                        },
                    ],
                    environment: [
                        { name: "DB_HOST", value: rdsInstance.endpoint },
                        { name: "DB_USER", value: "admin" },
                        { name: "DB_PASS", value: "password" },
                        { name: "DB_NAME", value: "test_db" },
                    ],
                },
            ]),
            networkMode: "awsvpc",
            requiresCompatibilities: ["FARGATE"],
            cpu: "256",
            memory: "512",
            executionRoleArn: ecsTaskExecutionRole.arn,
        });

        // Create a service for the backend
        new aws.ecsService.EcsService(this, "BackendService", {
            name: 'backend-ecs-service',
            cluster: ecsCluster.arn,
            taskDefinition: backendTaskDefinition.arn,
            desiredCount: 1,
            launchType: "FARGATE",
            networkConfiguration: {
                assignPublicIp: true,
                subnets: [subnet1.id, subnet2.id],
                securityGroups: [rdsSecurityGroup.id],
            },
        });

        new TerraformOutput(this, "frontend_url", {
            value: frontendCloudFront.domainName,
        });

        new TerraformOutput(this, "backend_url", {
            value: rdsInstance.endpoint,
        });
    }
}

const app = new App();
new MyStack(app, "full-stack-app");
app.synth();
