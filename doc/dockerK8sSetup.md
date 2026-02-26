# Docker + Kubernetes setup

This guide helps to deploy the full `real-state-fizgon` system in Kubernetes (K8S), using `kind` as reference baseline but keeping runtime operations in `kubectl` terms so it also fits `minikube` or other K8S distributions. It is aligned with:
- [Software architecture](architecture/property-scraper-architecture.png)
- [Manual setup](manualSetup.md)

Target K8S namespace: `real-state-fizgon`.
Public DNS domain base: `<yourDomain>`.

## 1. Prerequisites

## 1.1 Install Docker

Install Docker Desktop (macOS) or Docker Engine (Linux).

On MacOS need to install the `Docker desktop` app.

On Linux Ubuntu:

```bash
sudo apt update
sudo apt install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## 1.2 Install kubectl

```bash
# On MacOS
brew install kubectl
# On Ubuntu
curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/<architecture>/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```
where `architecture` is `amd64` or `arm64`.

## 1.3 Install kind

macOS (Homebrew):

```bash
brew update
brew install kind
```

Ubuntu Linux:

```bash
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.29.0/kind-linux-<architecture>

chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
kind version
```

## 1.4 Install k9s

```bash
# On MacOS
brew install k9s

# On Ubuntu
curl -sS https://webinstall.dev/k9s | bash
```

## 2. Kubernetes setup

## 2.1 Optional Cleanup (kind + Docker)

Use this section when you want to fully reset a previous local installation and recover disk space.

Warning:
- These commands delete local kind clusters, local project images, stopped containers, dangling images, build cache, and unused volumes/networks.
- Do not run on shared Docker hosts.

```bash
# Delete kind cluster (if present)
kind delete cluster --name real-state-fizgon || true

# Remove local project images used in this guide
docker rmi property-listing-idealista-scraper:local 2>/dev/null || true
docker rmi property-detail-idealista-scraper:local 2>/dev/null || true
docker rmi notification-message-sender:local 2>/dev/null || true

# Remove kind node image and registry image (optional)
docker rmi kindest/node 2>/dev/null || true
docker rmi registry:2 2>/dev/null || true

# Global Docker cleanup
docker container prune -f
docker image prune -af
docker volume prune -f
docker network prune -f
docker builder prune -af
docker system df
```

## 2.2 Create cluster and namespace

Create your cluster with your preferred local K8S provider:

```bash
# Kind example, should work with minikube or other K8S implementations
kind create cluster --name real-state-fizgon
```

Then continue with generic Kubernetes commands:

```bash
kubectl create namespace real-state-fizgon
kubectl config set-context --current --namespace=real-state-fizgon
```

## 2.3 DNS records for internet exposure

Create DNS records so every subdomain resolves to the public IP of your main K8S ingress entrypoint (`<yourDomain>`).

Recommended records:
- `rabbitmq.<yourDomain>` -> `<yourDomain>`
- `prometheus.<yourDomain>` -> `<yourDomain>`
- `grafana.<yourDomain>` -> `<yourDomain>`
- `mongodb.<yourDomain>` -> `<yourDomain>`
- `notification.<yourDomain>` -> `<yourDomain>`
- `idealistalist.<yourDomain>` -> `<yourDomain>`
- `idealistadetail.<yourDomain>` -> `<yourDomain>`

`mongodb` and AMQP (`rabbitmq` on port `5672`) are TCP services, so clients must connect with explicit port:
- `mongodb.<yourDomain>:27017`
- `rabbitmq.<yourDomain>:5672`

## 2.4 Kind image loading workflow

For local development with `kind`, do not use `localhost:5001` image tags in Deployments.
Build images locally and copy them into the kind node with `kind load docker-image`.

Current project Deployments are configured with:
- image names without registry prefix (for example `property-listing-idealista-scraper:local`)
- `imagePullPolicy: Never`

That ensures Kubernetes uses only images already present in the kind node.

## 3. Deploy external services required by setup

## 3.1 RabbitMQ (with management plugin)

```bash
kubectl apply -f k8s/rabbitmq.yaml
```

Initialize queue/users as in `doc/manualSetup.md`:

```bash
# Obtain the name of the RabbitMQ pod
RABBIT_POD=$(kubectl -n real-state-fizgon get pod -l app=rabbitmq -o jsonpath='{.items[0].metadata.name}')

# User creation for micro services
kubectl -n real-state-fizgon exec -it "$RABBIT_POD" -- rabbitmqctl add_user propertylist_user '<some password1>'
kubectl -n real-state-fizgon exec -it "$RABBIT_POD" -- rabbitmqctl add_user propertydetail_user '<some password2>'
kubectl -n real-state-fizgon exec -it "$RABBIT_POD" -- rabbitmqctl set_permissions -p dev propertylist_user ".*" ".*" ".*"
kubectl -n real-state-fizgon exec -it "$RABBIT_POD" -- rabbitmqctl set_permissions -p dev propertydetail_user ".*" ".*" ".*"
kubectl -n real-state-fizgon exec -it "$RABBIT_POD" -- rabbitmqctl set_user_tags propertylist_user management
kubectl -n real-state-fizgon exec -it "$RABBIT_POD" -- rabbitmqctl set_user_tags propertydetail_user management

# User creation for admin
echo "Enter new password for RabbitMQ admin user:"
read -r -s RABBIT_ADMIN_PASSWORD
echo
export RABBIT_ADMIN_PASSWORD
kubectl -n real-state-fizgon exec -it "$RABBIT_POD" -- rabbitmqctl change_password admin "$RABBIT_ADMIN_PASSWORD"
```

Expose management UI locally:

```bash
kubectl -n real-state-fizgon port-forward svc/rabbitmq 15672:15672
```

## 3.2 MongoDB (StatefulSet + persistent volume)

MongoDB is intentionally persistent (not volatile) in this setup.

```bash
kubectl apply -f k8s/mongodb.yaml
```

Create app DB user (matches `propertyDetailIdealistaScraper/secrets.json`):

```bash
MONGO_POD=$(kubectl -n real-state-fizgon get pod -l app=mongodb -o jsonpath='{.items[0].metadata.name}')

echo "Enter MongoDB password for user propertydetail_user:"
read -r -s MONGODB_PROPERTYDETAIL_PASSWORD
echo
export MONGODB_PROPERTYDETAIL_PASSWORD
kubectl -n real-state-fizgon exec -it "$MONGO_POD" -- mongosh --eval "use idealistaScraper; db.createUser({user:\"propertydetail_user\", pwd:\"$MONGODB_PROPERTYDETAIL_PASSWORD\", roles:[{role:\"readWrite\", db:\"idealistaScraper\"}]});"
```

## 3.3 Prometheus

First create `web.yml` (Prometheus web auth config), then create the K8S secret.

Generate your own bcrypt hash and store it in an environment variable (aligned with `doc/manualSetup.md`):

```bash
sudo apt-get install python3-bcrypt
export PROMETHEUS_GRAFANA_BCRYPT_HASH="$(python3 - <<'PY'
import getpass, bcrypt
password = getpass.getpass("Prometheus password for grafana: ").encode("utf-8")
print(bcrypt.hashpw(password, bcrypt.gensalt()).decode("utf-8"))
PY
)"
echo "$PROMETHEUS_GRAFANA_BCRYPT_HASH"
```

Then write it into `./web.yml`:

```bash
cat > ./web.yml <<EOF
basic_auth_users:
  grafana: ${PROMETHEUS_GRAFANA_BCRYPT_HASH}
EOF
chmod 600 ./web.yml
```

Create K8S secret:

```bash
kubectl -n real-state-fizgon create secret generic prometheus-web-config \
  --from-file=web.yml=./web.yml \
  --dry-run=client -o yaml | kubectl apply -f -
```

Deploy Prometheus:

```bash
kubectl apply -f k8s/prometheus.yaml
```

## 3.4 Grafana

```bash
kubectl apply -f k8s/grafana.yaml
```

Port-forward local access:

```bash
kubectl -n real-state-fizgon port-forward svc/prometheus 9090:9090
kubectl -n real-state-fizgon port-forward svc/grafana 3000:3000
```

## 4. Deploy current project micro services

## 4.1 Prepare secrets.json for each microservice

Each service reads `secrets.json` from `/app/secrets.json`.
`Dockerfile.local` includes `secrets-example.json`, but production credentials must be injected as Kubernetes Secret.

1. Update local files:
- `propertyListingIdealistaScraper/secrets.json`
- `propertyDetailIdealistaScraper/secrets.json`
- `notificationMessageSender/secrets.json`

2. Create K8S secrets:

```bash
kubectl -n real-state-fizgon create secret generic property-listing-secrets \
  --from-file=secrets.json=propertyListingIdealistaScraper/secrets.json \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n real-state-fizgon create secret generic property-detail-secrets \
  --from-file=secrets.json=propertyDetailIdealistaScraper/secrets.json \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n real-state-fizgon create secret generic notification-message-sender-secrets \
  --from-file=secrets.json=notificationMessageSender/secrets.json \
  --dry-run=client -o yaml | kubectl apply -f -
```

## 4.2 Build, load, deploy, and restart each microservice

If you rebuild an image, run the matching `kind load docker-image ...` again before `kubectl rollout restart`.

## 4.2.1 propertyListingIdealistaScraper

```bash
docker build -t property-listing-idealista-scraper:local -f propertyListingIdealistaScraper/Dockerfile.local propertyListingIdealistaScraper
kind load docker-image property-listing-idealista-scraper:local --name real-state-fizgon
kubectl apply -f propertyListingIdealistaScraper/k8s/propertyListingIdealistaScraper.yaml
kubectl -n real-state-fizgon rollout restart deployment/property-listing-idealista-scraper
```

The first time pod will not have access to RabbitMQ. Double check that `rabbitmq` is the host on `secrets.json`, and check again the credentials. Then load:

```bash
kubectl -n real-state-fizgon create secret generic property-listing-secrets   --from-file=secrets.json=propertyListingIdealistaScraper/secrets.json --dry-run=client -o yaml | kubectl apply -f -
kubectl -n real-state-fizgon rollout restart deployment/property-listing-idealista-scraper
```

By this point the first scraper should be running and queue `property-listing-urls` should be receiving messages. Use RabbitMQ web UI at port `:15672` of rabbitmq pod to verify it.

## 4.2.2 Set up an NFS shared folder in system host

Prepare host NFS export first (required for `/app/output/images` persistence):

```bash
# Install NFS server in the host
sudo apt-get update
sudo apt-get install -y nfs-kernel-server

# Use host network gateway as NFS server IP (host-side reachable by kind nodes)
export NFS_SERVER_IP="$(docker network inspect kind -f '{{(index .IPAM.Config 0).Gateway}}')"
echo "NFS_SERVER_IP=${NFS_SERVER_IP}"

# Read NFS settings from propertyDetailIdealistaScraper/secrets.json
export NFS_SERVER="$(jq -r '.nfs.server // empty' propertyDetailIdealistaScraper/secrets.json)"
export NFS_SHARED_FOLDER="$(jq -r '.nfs.sharedFolder // empty' propertyDetailIdealistaScraper/secrets.json)"
NFS_CONFIG_VALID=true

if [ -z "$NFS_SERVER" ] || [ -z "$NFS_SHARED_FOLDER" ]; then
  echo "ERROR: nfs.server or nfs.sharedFolder is empty in propertyDetailIdealistaScraper/secrets.json"
  NFS_CONFIG_VALID=false
fi

if [ "$NFS_CONFIG_VALID" = true ]; then
  case "$NFS_SHARED_FOLDER" in
    /*) ;;
    *)
      echo "ERROR: nfs.sharedFolder must be an absolute path"
      NFS_CONFIG_VALID=false
      ;;
  esac
fi

if [ "$NFS_CONFIG_VALID" = true ]; then
  echo "NFS_SERVER=${NFS_SERVER}"
  echo "NFS_SHARED_FOLDER=${NFS_SHARED_FOLDER}"

  # propertyDetailIdealistaScraper runs with UID/GID 1001 in K8S.
  # Ensure the shared folder is writable by that user/group.
  sudo mkdir -p "${NFS_SHARED_FOLDER}"
  sudo chown -R 1001:1001 "${NFS_SHARED_FOLDER}"
  sudo chmod -R ug+rwX "${NFS_SHARED_FOLDER}"

  # Get kind network subnet used by kind nodes and export it
  export KIND_SUBNET="$(docker network inspect kind -f '{{(index .IPAM.Config 0).Subnet}}')"
  echo "KIND_SUBNET=${KIND_SUBNET}"
else
  echo "NFS config is invalid. Skipping /etc/exports update commands."
fi
```

Write `/etc/exports` using that environment variable:

```bash
if [ "$NFS_CONFIG_VALID" = true ] && [ -n "$KIND_SUBNET" ]; then
  echo "${NFS_SHARED_FOLDER} ${KIND_SUBNET}(rw,sync,no_subtree_check)" | sudo tee /etc/exports > /dev/null
else
  echo "ERROR: KIND_SUBNET is empty or NFS config is invalid. /etc/exports not updated."
fi
```

Then reload exports:

```bash
if [ "$NFS_CONFIG_VALID" = true ] && [ -n "$KIND_SUBNET" ]; then
  sudo exportfs -a
  sudo exportfs -v
else
  echo "Skipping exportfs because NFS config validation failed."
fi
```

Warning:
- The subnet returned by Docker can be IPv6 in some environments.
- If it is IPv6, use that IPv6 subnet in `/etc/exports` instead of an IPv4 CIDR.
- The shared folder must be writable for UID `1001` and GID `1001` because `propertyDetailIdealistaScraper` runs with that identity in K8S.

## 4.2.3 Set up K8S Persistent Volume (PV) with mounted NFS shared folder

Set up PV/PVC for image download persistence:
- Define `nfs.server` and `nfs.sharedFolder` in `propertyDetailIdealistaScraper/secrets.json`.
- This mount persists downloaded images (`/app/output/images`) outside volatile pods.
- `propertyDetailIdealistaScraper/k8s/propertyDetailIdealistaScraper.yaml` uses `storageClassName: ""` for both PV and PVC, so pre-bound static volumes work correctly without storage class mismatch.

```bash
export NFS_SERVER="$(jq -er '.nfs.server' propertyDetailIdealistaScraper/secrets.json)"
export NFS_SHARED_FOLDER="$(jq -er '.nfs.sharedFolder' propertyDetailIdealistaScraper/secrets.json)"
envsubst '${NFS_SERVER} ${NFS_SHARED_FOLDER}' < propertyDetailIdealistaScraper/k8s/propertyDetailIdealistaScraper.yaml \
| awk 'BEGIN { RS="---"; ORS="---\n" } NR<=2 { print }' \
| kubectl apply -f -
```

Review the PV:

```bash
kubectl get pv
kubectl describe pv property-detail-images-pv
```

## 4.2.4 Deploy propertyDetailIdealistaScraper service pod

```bash
docker build -t property-detail-idealista-scraper:local -f propertyDetailIdealistaScraper/Dockerfile.local propertyDetailIdealistaScraper
kind load docker-image property-detail-idealista-scraper:local --name real-state-fizgon

NFS_SERVER="$(jq -er '.nfs.server' propertyDetailIdealistaScraper/secrets.json)" \
NFS_SHARED_FOLDER="$(jq -er '.nfs.sharedFolder' propertyDetailIdealistaScraper/secrets.json)" \
envsubst '${NFS_SERVER} ${NFS_SHARED_FOLDER}' < propertyDetailIdealistaScraper/k8s/propertyDetailIdealistaScraper.yaml \
| awk 'BEGIN { RS="---"; ORS="---\n" } NR==3 { print }' \
| kubectl apply -f -

kubectl -n real-state-fizgon rollout restart deployment/property-detail-idealista-scraper
```

## 4.2.5 notificationMessageSender

```bash
docker build -t notification-message-sender:local -f notificationMessageSender/Dockerfile.local notificationMessageSender
kind load docker-image notification-message-sender:local --name real-state-fizgon
kubectl apply -f notificationMessageSender/k8s/notificationMessageSender.yaml
kubectl -n real-state-fizgon rollout restart deployment/notification-message-sender
```

## 5. Configure Ingress (HTTP + TCP) for public subdomains

Install ingress-nginx controller:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller
```

Enable TCP routing map for non-HTTP services (`RabbitMQ AMQP` and `MongoDB`):

```bash
kubectl apply -f k8s/ingress-nginx-tcp-services.yaml
kubectl -n ingress-nginx patch deployment ingress-nginx-controller --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--tcp-services-configmap=ingress-nginx/tcp-services"}]'
```

Expose TCP ports through ingress-nginx Service:

```bash
kubectl -n ingress-nginx patch service ingress-nginx-controller --type='json' -p='[
  {"op":"add","path":"/spec/ports/-","value":{"name":"amqp-5672","port":5672,"targetPort":5672,"protocol":"TCP"}},
  {"op":"add","path":"/spec/ports/-","value":{"name":"mongodb-27017","port":27017,"targetPort":27017,"protocol":"TCP"}}
]'
```

Apply HTTP host-based ingress rules:

```bash
# Set your DNS base domain
export DNS_REAL_STATE_FIZGON_DOMAIN="<yourDomain>"

# Render template + apply
envsubst < k8s/ingress-http.yaml | kubectl apply -f -
```

Check ingress resources:

```bash
kubectl -n ingress-nginx get svc ingress-nginx-controller
kubectl -n real-state-fizgon get ingress
```

Important:
- In cloud Kubernetes, use a `LoadBalancer` service for ingress-nginx and point DNS records to that external IP.
- In bare-metal/local clusters, ingress is usually `NodePort`. Publish ports `80`, `443`, `5672`, and `27017` from the host/router/firewall to the node where ingress-nginx runs.
- HTTP host-based ingress applies to HTTP services only (`rabbitmq` management UI, `prometheus`, `grafana`, `notification` endpoints). `mongodb` and AMQP are exposed through TCP ports.
- `k8s/ingress-http.yaml` is a template and uses `${DNS_REAL_STATE_FIZGON_DOMAIN}`. If `envsubst` is missing, install `gettext` (`brew install gettext` on macOS, `sudo apt-get install gettext-base` on Ubuntu).

## 6. Rollout restart commands

Use after updating image tags or secrets:

```bash
kubectl -n real-state-fizgon rollout restart deployment/property-listing-idealista-scraper
kubectl -n real-state-fizgon rollout restart deployment/property-detail-idealista-scraper
kubectl -n real-state-fizgon rollout restart deployment/notification-message-sender
kubectl -n real-state-fizgon rollout restart deployment/rabbitmq
kubectl -n real-state-fizgon rollout restart deployment/prometheus
kubectl -n real-state-fizgon rollout restart deployment/grafana
kubectl -n real-state-fizgon rollout restart statefulset/mongodb
kubectl -n ingress-nginx rollout restart deployment/ingress-nginx-controller
```

## 7. Validation checklist

```bash
kubectl -n real-state-fizgon get pods
kubectl -n real-state-fizgon get svc
kubectl -n real-state-fizgon get pvc
kubectl -n real-state-fizgon get ingress
kubectl -n ingress-nginx get svc ingress-nginx-controller
```

Tail logs:

```bash
kubectl -n real-state-fizgon logs deploy/property-listing-idealista-scraper -f
kubectl -n real-state-fizgon logs deploy/property-detail-idealista-scraper -f
kubectl -n real-state-fizgon logs deploy/notification-message-sender -f
```

Validate metrics endpoint from inside cluster:

```bash
kubectl -n real-state-fizgon run metrics-test --rm -it --image=curlimages/curl -- \
  curl -s http://notification-message-sender:9464/metrics | head
```

## 8. Notes on architecture mapping

- `propertyListingIdealistaScraper` publishes property URLs to RabbitMQ queue `property-listing-urls`.
- `propertyDetailIdealistaScraper` consumes those URLs, stores property data in MongoDB, and publishes notification payloads to `outgoing-notification-messages`.
- `notificationMessageSender` consumes outgoing notifications and sends WhatsApp messages.
- Prometheus scrapes service metrics; Grafana visualizes them.

This mirrors the flow defined in `doc/architecture/property-scraper-architecture.dot` and operational requirements from `doc/manualSetup.md`.
