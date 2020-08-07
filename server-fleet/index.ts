/*
 * Using Pulumi, create an abstraction for a “web server fleet” that supports at least two operating
 * systems. Your application should accept the following (pseudocode) as input and provision
 * virtual machines as defined by the inputs.
 * 
 * Plan:
 * - create the component resource that creates:
 *  - vpc
 *  - servers with nginx installed
 *  - interface spec
 *      - name base
 *      - VPC CIDR
 *      - subnet choice
 *      - instance size choices
 *      - OS choices (ubuntu or amazon to avoid having to approve)
 * - create index.ts that takes config elements or defaults to deploy
 * 
 */



import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { WebServerFleet, DeploymentArgs } from "./WebServerFleet";
//import { DeploymentArgs } from "./WebServerFleet";

let os_choice: pulumi.Input<string> = "amazon"
let machines: DeploymentArgs[] = [
    {os: os_choice}
]
let fleet = new WebServerFleet("fleet", machines)
//let fleet = new WebServerFleet("fleet", [])

export const VMs = fleet.vmsInfo;