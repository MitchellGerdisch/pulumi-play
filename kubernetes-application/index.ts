/*
 * Kubernetes Application Exercise
 * Using Pulumi, create and deploy a web application running in Kubernetes. The web application
 * should display a customized web page that returns a configurable value in its web page
 * response.
 *
 * Plan:
 * - DONE Get basic docker image creation working.
 * - DONE Get kubernetes cluster creation working.
 * - DONE Figure out how to deploy image to cluster.
 * - Add in logic to allow config changes to drive contents of the web page.
 * - Move some parts to a Component Resource.
 */

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as docker from "@pulumi/docker";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";


/**** Docker Image Build and Push *****/
const config = new pulumi.Config();
const dockerUser = config.require("dockeruser")
const dockerRegistry = config.require("dockerregistry")
const dockerToken = config.requireSecret("dockertoken")

const dockerImage = "kub-app";

// Get the hello world add on text from config 
const helloWorldText = config.require("helloworldtext")

// A thing of beauty this is.
const kaImage = new docker.Image(dockerImage, {
    imageName: pulumi.interpolate`${dockerUser}/${dockerImage}:v1.0.0`,
    build: {
        context: `./${dockerImage}`,
        args: { 
            HELLOWORLD_ARG: helloWorldText,
        },
    },
    registry: {
        server: dockerRegistry,
        username: dockerUser,
        password: dockerToken,
    },
});

/***** Kubernetes Cluster Set Up *****/
// VPC and Security Group
const nameBase = "kub-app";
const vpcCidr = "10.0.0.0/16";
const reg = "us-east-1";
const az1 = reg+"a";
const az2 = reg+"b";

let kavpc = new awsx.ec2.Vpc(nameBase, {
    cidrBlock : vpcCidr,
    subnets: [ 
        {type: "public"},
    ],
    numberOfNatGateways: 0,
    tags: { "Name": nameBase }
});

// K8s cluster using EKS
const cluster = new eks.Cluster(nameBase, {
    vpcId: kavpc.id,
    subnetIds: kavpc.publicSubnetIds,
    desiredCapacity: 2,
    minSize: 1,
    maxSize: 2,
    storageClasses: "gp2",
    deployDashboard: false,
});

// Export the clusters' kubeconfig.
export const kubeconfig = cluster.kubeconfig;

// Create a Kubernetes Namespace
const ns = new k8s.core.v1.Namespace(nameBase, {}, { provider: cluster.provider });

// Export the Namespace name
const namespaceName = ns.metadata.name;

// Deploy the image we built above
const appLabels = { appClass: nameBase};
const deployment = new k8s.apps.v1.Deployment(nameBase,
    {
        metadata: {
            namespace: namespaceName,
            labels: appLabels,
        },
        spec: {
            replicas: 1,
            selector: { matchLabels: appLabels },
            template: {
                metadata: {
                    labels: appLabels,
                },
                spec: {
                    containers: [
                        {
                            name: nameBase,
                            image: kaImage.baseImageName, // Stand up the image created above
                            ports: [{ name: "http", containerPort: 8080 }], // match the setting in Dockerfile
                            imagePullPolicy: "Always", // this way if I tinker with the image and restart the deployment using kubectl it'll grab the newly created image.
                        },
                    ],
                },
            },
        },
    },
    {
        provider: cluster.provider,
    },
);

// Export the Deployment name
const deploymentName = deployment.metadata.name;

// Create a LoadBalancer Service for the Hello-World image Deployment
const service = new k8s.core.v1.Service(nameBase,
    {
        metadata: {
            labels: appLabels,
            namespace: namespaceName,
        },
        spec: {
            type: "LoadBalancer",
            ports: [{ port: 80, targetPort: "http" }],
            selector: appLabels,
        },
    },
    {
        provider: cluster.provider,
    },
);

// Export the Service name and public LoadBalancer Endpoint
export const CLICK_HERE = pulumi.interpolate `http://${service.status.loadBalancer.ingress[0].hostname}`;

