/*
 * Using Pulumi, create an abstraction for a “web server fleet” that supports at least two operating
 * systems. Your application should accept the following (pseudocode) as input and provision
 * virtual machines as defined by the inputs.
 * 
 */

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { WebServerFleet, DeploymentArgs } from "./WebServerFleet";
//import { DeploymentArgs } from "./WebServerFleet";

let machines: DeploymentArgs[] = [
    {os: "amazon", count: 1, size: "small"},
    {nameBase: "web", os: "ubuntu", count: 1, size: "small"},
]
let fleet = new WebServerFleet("fleet", machines)
//let fleet = new WebServerFleet("fleet", [])

export const VMs = fleet.vmsInfo;