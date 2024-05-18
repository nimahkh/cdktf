import { Construct } from "constructs";
import * as aws from "@cdktf/provider-aws";
import { LOCAL } from "./const";
import { AssetType, Fn, TerraformAsset, TerraformIterator, TerraformLocal, TerraformOutput } from "cdktf";
import type { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront-distribution";

const FRONTEND_BUCKET = `frontend-bucket-${LOCAL.postfix}`;

export class FrontendStack extends Construct {
    public frontendCloudFront: CloudfrontDistribution;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        const fileTypes = new TerraformLocal(this, "file-types", {
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript",
            ".json": "application/json",
            ".svg": "image/svg+xml",
            ".html": "text/html; charset=utf-8",
            ".ico": "image/x-icon",
        })  

        const assets = new TerraformAsset(this, 'assets', {
            path: `${__dirname}/frontend/dist`,
            type: AssetType.DIRECTORY,
        });

        const forEach = TerraformIterator.fromList(Fn.fileset(assets.path, '**'))

        const frontendBucket = new aws.s3Bucket.S3Bucket(this, "FrontendBucket", {
            bucket: FRONTEND_BUCKET,
            tags: {
                name: FRONTEND_BUCKET
            },
            forceDestroy: true,
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
        
        // Upload frontend files to S3

        const s3BucketPublicAccessBlock = new aws.s3BucketPublicAccessBlock.S3BucketPublicAccessBlock(this, "S3BucketPublicAccess", {
            bucket: frontendBucket.bucket,
            blockPublicAcls: true,
            blockPublicPolicy: true,
            ignorePublicAcls: true,
            restrictPublicBuckets: true,
        })

        new aws.s3Object.S3Object(this, 'dynamic-assets-upload', {
            forEach,
            bucket: frontendBucket.bucket,
            forceDestroy: true,
            key: forEach.value,
            source: `${assets.path}/${forEach.value}`,
            etag: Fn.filemd5(`${assets.path}/${forEach.value}`),
            contentType: Fn.lookup(
                fileTypes.fqn,
                Fn.element(Fn.regexall("\.[^\.]+$", forEach.value), 0),
                "application/octet-stream"
            ),
            dependsOn: [s3BucketPublicAccessBlock]
        });

        new aws.s3BucketPolicy.S3BucketPolicy(this, "BucketPolicy", {
            bucket: frontendBucket.bucket,
            policy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Sid: "PublicReadGetObject",
                        Effect: "Allow",
                        Principal: "*",
                        Action: "s3:GetObject",
                        Resource: [`arn:aws:s3:::${frontendBucket.bucket}/*`, `arn:aws:s3:::${frontendBucket.bucket}`],
                    },
                ],
            }),
            dependsOn: [s3BucketPublicAccessBlock]
        });

        s3BucketPublicAccessBlock.blockPublicAcls = false;
        s3BucketPublicAccessBlock.blockPublicPolicy = false;
        s3BucketPublicAccessBlock.ignorePublicAcls = false;
        s3BucketPublicAccessBlock.restrictPublicBuckets = false;

        this.frontendCloudFront = new aws.cloudfrontDistribution.CloudfrontDistribution(this, "CloudFrontDistribution", {
            enabled: true,
            isIpv6Enabled: true,
            defaultRootObject: "index.html",
            origin: [
                {
                    originId: LOCAL.s3_origin_id,
                    domainName: frontendBucket.bucketRegionalDomainName,
                    s3OriginConfig: {
                        originAccessIdentity: originAccessIdentity.cloudfrontAccessIdentityPath
                    }
                }
            ],
            defaultCacheBehavior: {
                allowedMethods: ["GET", "HEAD", "OPTIONS"],
                cachedMethods: ["GET", "HEAD"],
                targetOriginId: LOCAL.s3_origin_id,
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

        new TerraformOutput(this, "FrontendEndpoint", {
            value: this.frontendCloudFront.domainName
        });
    }

}