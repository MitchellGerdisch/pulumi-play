/*
 * Builds the following:
 * - VPC
 * - EKS cluster
 * 
 */

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import { Cluster } from "@pulumi/aws/cloudhsmv2";

export class K8sCluster extends pulumi.ComponentResource {

    public kubeConfig: pulumi.Output<any>;
    public provider: k8s.Provider;

    constructor(name: string, nameBase: string, vpcCidr: string, opts: pulumi.ComponentResourceOptions = {}) {

        // Register this component 
        super("exercise:K8sCluster", name, opts);

        // VPC 
        let kavpc = new awsx.ec2.Vpc(nameBase, {
            cidrBlock : vpcCidr,
            subnets: [ 
                {type: "public"},
            ],
            numberOfNatGateways: 0, // I don't think this is needed since I'm not doing any private subnets, but better cheap than sorry.
            tags: { "Name": nameBase }
        });

        // K8s cluster using EKS
        let cluster = new eks.Cluster(nameBase, {
            vpcId: kavpc.id,
            subnetIds: kavpc.publicSubnetIds,
            desiredCapacity: 2,
            minSize: 1,
            maxSize: 2,
            storageClasses: "gp2",
            deployDashboard: false,
        }, {parent: this});

        this.kubeConfig = cluster.kubeconfig;
        this.provider = cluster.provider;

        // For dependency tracking, register output properties for this component
        this.registerOutputs({
            kubeConfig: this.kubeConfig,
            provider: this.provider,
        });
    };
};