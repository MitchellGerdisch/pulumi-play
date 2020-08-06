/*
 * Kubernetes Application Exercise
 * Using Pulumi, create and deploy a web application running in Kubernetes. The web application
 * should display a customized web page that returns a configurable value in its web page
 * response.
 *
 * Plan:
 * - DONE Get basic docker image creation working.
 * - Get kubernetes cluster creation working.
 * - Figure out how to deploy image to cluster.
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
const dockeruser = config.require("dockeruser")
const dockerregistry = config.require("dockerregistry")
const dockertoken = config.requireSecret("dockertoken")
const dockerImage = "kub-app";


// A thing of beauty this is.
const myImage = new docker.Image(dockerImage, {
    imageName: pulumi.interpolate`${dockeruser}/${dockerImage}:v1.0.0`,
    build: {
        context: `./${dockerImage}`,
    },
    registry: {
        server: dockerregistry,
        username: dockeruser,
        password: dockertoken,
    },
});

/***** Kubernetes Cluster Set Up *****/
// VPC and Security Group
const name_base = "kub-app";
const vpc_cidr = "10.0.0.0/16";
const reg = "us-east-1";
const az1 = reg+"a";
const az2 = reg+"b";

let kavpc = new awsx.ec2.Vpc(name_base, {
    cidrBlock : vpc_cidr,
    subnets: [ 
        {type: "public"},
    ],
    numberOfNatGateways: 0,
    tags: { "Name": name_base }
});

// Allocate a security group and then a series of rules:
let mysg = new awsx.ec2.SecurityGroup(name_base+"-sg", { vpc: kavpc });

// inbound HTTP traffic on port 80 from anywhere
mysg.createIngressRule("https-access", {
    location: new awsx.ec2.AnyIPv4Location(),
    ports: new awsx.ec2.TcpPorts(80),
    description: "allow HTTP access from anywhere",
});

// 3) outbound TCP traffic on any port to anywhere
mysg.createEgressRule("outbound-access", {
    location: new awsx.ec2.AnyIPv4Location(),
    ports: new awsx.ec2.AllTcpPorts(),
    description: "allow outbound access to anywhere",
});

