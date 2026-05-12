# Smart Order Fulfillment System

A polyglot microservice architecture designed for a smart order fulfillment system.

## Architecture Overview

The system is built using a modern microservice architecture, separating concerns across multiple specialized services. It uses a polyglot approach, leveraging the strengths of different programming languages for specific tasks.

### Tech Stack

*   **Frontend:** React (Vite)
*   **Backend Services (Java/Spring Boot):**
    *   `api-gateway`: Routes incoming traffic to the appropriate microservice. Also handles initial CORS configurations.
    *   `auth-service`: Manages user authentication and JWT token generation.
    *   `inventory-service`: Manages product inventory and stock levels.
    *   `order-service`: Handles order creation and lifecycle management.
*   **Backend Services (Go):**
    *   `delivery-service`: Manages the delivery logistics of orders.
    *   `notification-service`: Sends notifications (e.g., email) to users.
    *   `warehouse-service`: Manages warehouse operations.
*   **Databases:** PostgreSQL (hosted on Neon.tech in development)
*   **Infrastructure & Deployment:**
    *   Kubernetes (Minikube for local development)
    *   Ansible (Configuration management and secret injection)
    *   Jenkins (CI/CD pipeline)
    *   Docker (Containerization)
    *   Kustomize (Kubernetes manifest management)

## Running the Project Locally (Kubernetes/Minikube)

We have recently migrated from Docker Compose to a full Kubernetes-native deployment using Minikube and Ansible.

### Prerequisites

1.  **Minikube** installed and running.
2.  **Docker** installed.
3.  **Ansible** installed (with `kubernetes.core` collection: `ansible-galaxy collection install kubernetes.core`).
4.  **kubectl** installed.

### Setup Steps

1.  **Start Minikube:**
    Ensure your Minikube cluster is running.
    ```bash
    minikube start
    ```

2.  **Configure Secrets:**
    The project uses Ansible Vault for secret management. For local development, copy the `.env` template and set your actual database credentials.
    ```bash
    cp k8s/.env ansible/group_vars/dev/vault.yml
    ```
    *Note: Ensure the keys in `vault.yml` are prefixed with `vault_` (e.g., `vault_jwt_secret`).*

3.  **Deploy via Ansible:**
    Run the Ansible playbook to set up namespaces, inject secrets, apply Kustomize manifests, and deploy the services.
    ```bash
    ANSIBLE_CONFIG=ansible/ansible.cfg ansible-playbook -i ansible/inventories/dev/hosts.yml ansible/playbooks/deploy-k8s.yml -e target_env=dev -e image_tag=latest -e '{"project_src_dir": "/home/vishnu-dholu/Code/Smart Order"}' -e 'ansible_become=false'
    ```

4.  **Wait for Pods:**
    Check the status of your pods and wait for them to enter the `Running` state.
    ```bash
    kubectl get pods -n smart-order
    ```

5.  **Access the Application:**
    Since `minikube tunnel` can sometimes face issues binding to port 80 without `sudo`, the recommended way to access the frontend and API Gateway locally is by port-forwarding the Nginx Ingress Controller to a free port (e.g., `8888`).
    
    In a separate terminal, run:
    ```bash
    kubectl port-forward service/ingress-nginx-controller 8888:80 -n ingress-nginx
    ```
    
    Now open your browser and navigate to:
    **http://localhost:8888**

    *(The Ingress controller will route `/api/*` to the API Gateway and everything else to the React frontend).*

## CI/CD Pipeline

The project includes a `Jenkinsfile` that orchestrates the build and deployment process.
*   It builds Docker images for all services.
*   It loads the images directly into Minikube (`minikube image load`).
*   It executes the Ansible playbook to roll out the new images to the Kubernetes cluster.
