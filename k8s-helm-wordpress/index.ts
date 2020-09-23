import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { ManagedGkeCluster } from './GkeCluster';

const gkeCluster = new ManagedGkeCluster(pulumi.getProject());
export const gkeKubeConfig = gkeCluster.GkeKubeConfig;
