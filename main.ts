import { App, TerraformStack } from "cdktf";
import * as aws from "@cdktf/provider-aws";
import { DockerProvider } from "@cdktf/provider-docker/lib/provider";
import { Construct } from "constructs";
import { FrontendStack } from "./frontend";
import { BackendStack } from "./backend";

class MyStack extends TerraformStack {
    private local = {
        s3_origin_id: "S3Origin",
        frontend_bucket_name: "frontend-bucket",
        backend_bucket_name: "backend-bucket",
        vpc_cidr: "10.0.0.0/16",
        aws_region: "eu-west-1",
        ecr_repo_name: "backend-app-repo",
        postfix: new Date().valueOf()
    };

    constructor(scope: Construct, name: string) {
        super(scope, name);

        // AWS Provider
        const primaryAwsProvider = new aws.provider.AwsProvider(this, "Aws", {
            region: `${this.local.aws_region}`,
            accessKey: process.env.AWS_ACCESS_KEY_ID,
            secretKey: process.env.AWS_SECRET_ACCESS_KEY,
        });

        // Docker Provider
        new DockerProvider(this, "Docker", {});

        //FRONTEND 
        const frontendStack = new FrontendStack(this, "FrontendStack");

        //Backend
        new BackendStack(this, "BackendStack", {
            primaryAwsProvider,
            frontendCloudFront: frontendStack.frontendCloudFront,
        });        
    }
}

const app = new App();
new MyStack(app, "full-stack-app");
app.synth();
