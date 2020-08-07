import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";





/*** Constructor for the fleet. ***/
/* Builds a VPC with a couple of public subnets.
 * Builds the sets of VMs.
 */
export class WebServerFleet extends pulumi.ComponentResource {
    public readonly vmsInfo: VMsInfo[];

    constructor(name: string, args: DeploymentArgs[]) {
        super("WebServerFleet", name);

        // Build the VPC to spread the instances across.
        // Creates 2 public subnets (default)
        const netName = "fleet"
        const vpcCidr = "10.0.0.0/16"
        const vpcName = netName+"-vpc"
        const sgName = netName+"-sg"
        let fleetvpc = new awsx.ec2.Vpc(vpcName, {
            cidrBlock : vpcCidr,
            subnets: [ 
                {type: "public"},
            ],
            numberOfNatGateways: 0, // I don't think this is needed since I'm not doing any private subnets, but better cheap than sorry.
            tags: { "Name": vpcName}
        });
        // Not sure this is the best way to get these subnets. But it was the only way I could get it to work.
        let az1_pub_subnet = pulumi.output(fleetvpc.publicSubnetIds.then(ids => ids[0])) 
        let az2_pub_subnet = pulumi.output(fleetvpc.publicSubnetIds.then(ids => ids[1])) 
        let subnets = [az1_pub_subnet, az2_pub_subnet];

        // Allocate a security group and some access rules 
        let fleetSg = new awsx.ec2.SecurityGroup(sgName, { vpc: fleetvpc });
        // Inbound HTTP traffic on port 80 from anywhere
        fleetSg.createIngressRule("https-access", {
            location: new awsx.ec2.AnyIPv4Location(),
            ports: new awsx.ec2.TcpPorts(80),
            description: "allow HTTP access from anywhere",
        });
        // Outbound TCP traffic on any port to anywhere
        fleetSg.createEgressRule("outbound-access", {
            location: new awsx.ec2.AnyIPv4Location(),
            ports: new awsx.ec2.AllTcpPorts(),
            description: "allow outbound access to anywhere",
        });

        // A bit of user data to launch a simple webserver.

        // Initialize our VMs info array
        this.vmsInfo = [];

        // Some userdata to launch a web server
        let ubuntu_userData =
        `#!/bin/bash
        sudo apt update
        sudo apt install -y nginx`;
        let centos_userData =
        `#!/bin/bash
        sudo yum update
        sudo yum install -y nginx`;

        // Check if going with defaults across the board
        // If so, then at least create one entry to drive instance creation.
        if (args.length == 0) {
            args = [{nameBase: "ws"}]
        }

        // Launch the instances of various types and counts.
        for (let arg of args) {
            let nameBase = arg.nameBase || "ws";
            let os = arg.os || "ubuntu";
            console.log("OS: "+os)
            let size = arg.size || "small";
            let count = arg.count || 1;
            let ami = getAmi(os); // I wanted to just use a hash to get the ami, but I hit some issues and went with a function.
            let type = getInstanceType(size); // ditto. though I think it was just type casting issues ... this will have to do for now.

            for (let x = 0; x < count; x++) {
                let vmName = nameBase + "-" + x;
                let subnetId = subnets[(x%2)] // two subnets, cycle through them

                // Build the instance
                let instance = new aws.ec2.Instance(vmName, {
                    ami: ami,
                    instanceType: type,
                    associatePublicIpAddress: true,
                    subnetId: subnetId,
                    vpcSecurityGroupIds: [fleetSg.id],
                    userData: (os == "ubuntu" ? ubuntu_userData : centos_userData),
                    tags: {
                        "Name": vmName,
                    },
                    keyName: "mitch-new_sshkey",
                });

                this.vmsInfo.push({
                    vmName: vmName,
                    vmUrl: pulumi.interpolate `http://${instance.publicDns}`,
                })
            }
        }

        // For dependency tracking, register output properties for this component
        this.registerOutputs({
            vmsInfo: this.vmsInfo
        });
    }
}
/*** INPUTS AND OUTPUTS TYPES ****/
// Inputs
export interface DeploymentArgs {
        /* base name for the VM. 
         * An index will be added to each VM in the given gaggle.
         * default: ws
         */
        nameBase?: pulumi.Input<string>,
        /* t-shirt size for the instance
         * options: small, medium, large
         * default: small
         */
        size?: pulumi.Input<string>,
        /* os choice for the instance
         * keeping it simple with ubuntu and amazon linux choices to avoid having to approve the os in AWS.
         * options: ubuntu, amazon 
         * default: ubuntu
         */
        os?: pulumi.Input<string>,
        /* how many of the given configuration to build?
         * default: 1
         */
        count?: pulumi.Input<Number>,
}

// Output providing the VM name and public DNS
export interface VMsInfo {
        readonly vmName: string,
        readonly vmUrl: pulumi.Output<string>,
}

/*** Helper Functions ***/
/*** Mapping of input choinces to cloud-specific options. ***/
function getInstanceType(size:pulumi.Input<string>) {
    let type:aws.ec2.InstanceType = "t3.small";
    if (size == "medium") {
        type = "t3.medium";
    } else if (size == "large") {
        type = "t3.large";
    }
    return type;
}

function getAmi(os:pulumi.Input<string>) {
    let ami = ubuntu_ami;
    if (os == "amazon") {
        ami = amazon_ami
    } 
    return ami
}

/*** Find the AMIs to go along with the os input ***/
// Get the id for the latest Amazon Linux AMI
let amazon_ami = aws.getAmi({
    filters: [
        { name: "name", values: ["amzn-ami-hvm-*-x86_64-ebs"] },
        { name: "root-device-type", values: ["ebs"] },
    ],
    owners: ["137112412989"], // Amazon
    mostRecent: true,
}, { async: true }).then(result => result.id);

// Get the id for the latest Ubuntu Bionic AMI that supports EBS since instance types require EBS.
let ubuntu_ami = aws.getAmi({
    filters: [
        { name: "name", values: ["ubuntu/images/*/ubuntu-bionic-*-amd64-server-*"]},
        { name: "root-device-type", values: ["ebs"] },
    ],
    owners: ["099720109477"], // canonical
    mostRecent: true,
}, { async: true }).then(result => result.id);

