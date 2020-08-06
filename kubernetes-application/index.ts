/*
 * Kubernetes Application Exercise
 * Using Pulumi, create and deploy a web application running in Kubernetes. The web application
 * should display a customized web page that returns a configurable value in its web page
 * response.
 *
 * Plan:
 * - Get basic docker image creation working.
 * - Get kubernetes cluster creation working.
 * - Figure out how to deploy image to cluster.
 * - Add in logic to allow config changes to drive contents of the web page.
 * - Move some parts to a Component Resource.
 */

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

