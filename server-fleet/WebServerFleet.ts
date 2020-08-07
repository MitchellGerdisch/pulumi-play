import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export interface DeploymentArgs {
    [index:number]: {
        /* base name for the VM. 
         * An index will be added to each VM in the given gaggle.
         * default: ws
         */
        nameBase: pulumi.Input<string>.
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
    }
}

export interface VMsInfo {
    [index:number]: {
        readonly vmName: pulumi.Output<string>,
        readonly vmDns: aws.ec2.publicDns,
    }
}

// Get the id for the latest Amazon Linux AMI
let amazon_ami = aws.getAmi({
    filters: [
        { name: "name", values: ["amzn-ami-hvm-*-x86_64-ebs"] },
    ],
    owners: ["137112412989"], // Amazon
    mostRecent: true,
}, { async: true }).then(result => result.id);

// Get the id for the latest Ubuntu AMI
let ubuntu_ami = aws.getAmi({
    filters: [
        { name: "name", values: ["ubuntu/images/ubuntu-*-*-amd64-server-*"]},
    ],
    owners: ["099720109477"], // canonical
    mostRecent: true,
}, { async: true }).then(result => result.id);


const size_opts = {
    "small": "t3.small",
    "medium": "t3.medium",
    "large": "t3.large"
}

const os_opts = {
    "ubuntu": ubuntu_ami,
    "amazon": amazon_ami,
}


// Where the magic happens
export class WebServerFleet extends pulumi.ComponentResource {
    public readonly vmsInfo: VMsInfo

    constructor(name: string, args: DeploymentArgs) {

        for (let arg or args) {
            let nameBase = arg.nameBase || "ws";
            let os = arg.os || "ubuntu";
            let size = arg.size || "small"

        let nameBase = arg
        



        super("WebServerFleet", name);

        // VPC 
        let fleetVpc = new awsx.ec2.Vpc(nameBase, {
            cidrBlock : vpcCidr,
            subnets: [ 
                {type: "public"},
            ],
            numberOfNatGateways: 0, // I don't think this is needed since I'm not doing any private subnets, but better cheap than sorry.
            tags: { "Name": nameBase }
        });





        this.networkInterface = new azure.network.NetworkInterface(`${name}-nic`, {
            resourceGroupName: args.resourceGroupName,
            ipConfigurations: [{
                name: "webserveripcfg",
                subnetId: args.subnetId,
                privateIpAddressAllocation: "Dynamic",
                publicIpAddressId: this.publicIp.id,
            }],
        }, { parent: this });

        // Now create the VM, using the resource group and NIC allocated above.
        this.vm = new azure.compute.VirtualMachine(`${name}-vm`, {
            resourceGroupName: args.resourceGroupName,
            networkInterfaceIds: [this.networkInterface.id],
            vmSize: args.vmSize || "Standard_A0",
            deleteDataDisksOnTermination: true,
            deleteOsDiskOnTermination: true,
            osProfile: {
                computerName: "hostname",
                adminUsername: args.username,
                adminPassword: args.password,
                customData: args.bootScript,
            },
            osProfileLinuxConfig: {
                disablePasswordAuthentication: false,
            },
            storageOsDisk: {
                createOption: "FromImage",
                name: `${name}-osdisk1`,
            },
            storageImageReference: {
                publisher: "canonical",
                offer: "UbuntuServer",
                sku: "16.04-LTS",
                version: "latest",
            },
        }, { parent: this });
    }

    public getIpAddress(): pulumi.Output<string> {
        // The public IP address is not allocated until the VM is running, so wait for that
        // resource to create, and then lookup the IP address again to report its public IP.
        const ready = pulumi.all({ _: this.vm.id, name: this.publicIp.name, resourceGroupName: this.publicIp.resourceGroupName });
        return ready.apply(d =>
            azure.network.getPublicIP({
                name: d.name,
                resourceGroupName: d.resourceGroupName,
            }, { async: true }).then(ip => ip.ipAddress));
    }
}