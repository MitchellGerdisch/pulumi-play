/*
 * Kubernetes Application Exercise
 * Using Pulumi, create and deploy a web application running in Kubernetes. The web application
 * should display a customized web page that returns a configurable value in its web page
 * response.
 * 
 * TODOS: 
 * - Is there a way to prompt the user during a pulumi up? The idea being to use that prompt for the hello world addon text
 *   instead of using the config mechanism.
 *
 */

import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as k8s from "@pulumi/kubernetes";
import { K8sCluster } from './k8scluster'

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

/***** Kubernetes cluster and related VPC set up *****/
const nameBase = "kub-app";
const vpcCidr = "10.0.0.0/16";
const cluster = new K8sCluster(nameBase+"k8s", nameBase, vpcCidr, {});

// Export the clusters' kubeconfig.
export const kubeconfig = cluster.kubeConfig;

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
export const website = pulumi.interpolate `http://${service.status.loadBalancer.ingress[0].hostname}`;

