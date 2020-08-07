#!/bin./sh
# A little script to handle the set up for kubectl.
# Assumes kubectl already installed.
#
# USAGE: 
# . ./set_kubectl_env.sh
#

pulumi stack output kubeconfig > $PWD/kubeconfig
export KUBECONFIG=$PWD/kubeconfig

namespace=`kubectl get namespaces | grep "kub-app" | sed 's/  */;/g'|cut -d";" -f1`
kubectl config set-context --current --namespace=${namespace}
