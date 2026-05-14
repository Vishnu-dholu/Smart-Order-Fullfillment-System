def springServices = ['api-gateway', 'auth-service', 'inventory-service', 'order-service']
def goServices = ['warehouse-service', 'delivery-service', 'notification-service']
def allServices = ['frontend'] + springServices + goServices

pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '30'))
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 60, unit: 'MINUTES')
    }

    triggers {
        githubPush()
    }

    parameters {
        choice(name: 'DEPLOY_ENV', choices: ['dev', 'stage', 'prod'], description: 'Target deployment environment')
        booleanParam(name: 'SKIP_TESTS', defaultValue: false, description: 'Skip test stages')
        booleanParam(name: 'ROLLBACK_ONLY', defaultValue: false, description: 'Run rollback playbook only')
    }

    environment {
        REGISTRY = 'vishnudholu'
        ANSIBLE_CONFIG = 'ansible/ansible.cfg'
        ANSIBLE_INVENTORY = "ansible/inventories/${params.DEPLOY_ENV}/hosts.yml"
    }

    stages {
        stage('01 - Checkout') {
            steps {
                checkout scm
                sh 'git rev-parse --short HEAD'
            }
        }

        stage('02 - Prepare Build Metadata') {
            when {
                expression { !params.ROLLBACK_ONLY }
            }
            steps {
                script {
                    env.IMAGE_TAG = "${env.BUILD_NUMBER}-${(env.GIT_COMMIT ?: 'manual').take(7)}"
                    writeFile file: 'build.env', text: """
REGISTRY=${env.REGISTRY}
IMAGE_TAG=${env.IMAGE_TAG}
DEPLOY_ENV=${params.DEPLOY_ENV}
BUILD_NUMBER=${env.BUILD_NUMBER}
GIT_COMMIT=${env.GIT_COMMIT}
""".trim() + '\n'
                }
                stash includes: 'build.env', name: 'build-metadata'
            }
        }

        stage('03 - Build Images (Sequential)') {
            when {
                expression { !params.ROLLBACK_ONLY }
            }
            stages {
                stage('03.1 - Build Frontend') {
                    steps {
                        sh """
                          set -e
                          docker build --network=host \
                            --build-arg BUILDKIT_INLINE_CACHE=1 \
                            --build-arg VITE_API_GATEWAY_URL="" \
                            -t ${env.REGISTRY}/frontend:${env.IMAGE_TAG} \
                            -f frontend/Dockerfile frontend
                        """
                    }
                }
                stage('03.2 - Build Spring Services') {
                    steps {
                        sh "docker build --network=host --build-arg BUILDKIT_INLINE_CACHE=1 -t ${env.REGISTRY}/api-gateway:${env.IMAGE_TAG} -f services/spring/api-gateway/Dockerfile services/spring/api-gateway"
                        sh "docker build --network=host --build-arg BUILDKIT_INLINE_CACHE=1 -t ${env.REGISTRY}/auth-service:${env.IMAGE_TAG} -f services/spring/auth-service/Dockerfile services/spring/auth-service"
                        sh "docker build --network=host --build-arg BUILDKIT_INLINE_CACHE=1 -t ${env.REGISTRY}/inventory-service:${env.IMAGE_TAG} -f services/spring/inventory-service/Dockerfile services/spring/inventory-service"
                        sh "docker build --network=host --build-arg BUILDKIT_INLINE_CACHE=1 -t ${env.REGISTRY}/order-service:${env.IMAGE_TAG} -f services/spring/order-service/Dockerfile services/spring/order-service"
                    }
                }
                stage('03.3 - Build Go Services') {
                    steps {
                        sh "docker build --network=host --build-arg BUILDKIT_INLINE_CACHE=1 -t ${env.REGISTRY}/warehouse-service:${env.IMAGE_TAG} -f services/go/warehouse-service/Dockerfile services/go/warehouse-service"
                        sh "docker build --network=host --build-arg BUILDKIT_INLINE_CACHE=1 -t ${env.REGISTRY}/delivery-service:${env.IMAGE_TAG} -f services/go/delivery-service/Dockerfile services/go/delivery-service"
                        sh "docker build --network=host --build-arg BUILDKIT_INLINE_CACHE=1 -t ${env.REGISTRY}/notification-service:${env.IMAGE_TAG} -f services/go/notification-service/Dockerfile services/go/notification-service"
                    }
                }
            }
        }

        stage('04 - Unit & Integration Tests (Sequential)') {
            when {
                allOf {
                    expression { !params.ROLLBACK_ONLY }
                    expression { !params.SKIP_TESTS }
                }
            }
            stages {
                stage('04.1 - Frontend Tests') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci --no-audit --no-fund'
                            sh 'npm run build'
                        }
                    }
                }
                stage('04.2 - Spring Tests') {
                    steps {
                        dir('services/spring/auth-service') { sh './mvnw -B -ntp test' }
                        dir('services/spring/inventory-service') { sh './mvnw -B -ntp test' }
                        dir('services/spring/order-service') { sh './mvnw -B -ntp test' }
                        dir('services/spring/api-gateway') { sh '[ -x ./mvnw ] && ./mvnw -B -ntp test || mvn -B -ntp test' }
                    }
                }
                stage('04.3 - Go Tests') {
                    steps {
                        dir('services/go/warehouse-service') { sh 'go test ./... -count=1' }
                        dir('services/go/delivery-service') { sh 'go test ./... -count=1' }
                        dir('services/go/notification-service') { sh 'go test ./... -count=1' }
                    }
                }
            }
        }

        stage('05 - Push Images to Registry') {
            when {
                expression { !params.ROLLBACK_ONLY }
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'DockerHubCred', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
                    script {
                        allServices.each { svc ->
                            // Retry up to 3 times to handle transient Docker Hub blob upload errors
                            retry(3) {
                                sh """
                                  docker push ${env.REGISTRY}/${svc}:${env.IMAGE_TAG} || (sleep 10 && exit 1)
                                """
                            }
                            sh "docker tag ${env.REGISTRY}/${svc}:${env.IMAGE_TAG} ${env.REGISTRY}/${svc}:latest-ci"
                            retry(3) {
                                sh """
                                  docker push ${env.REGISTRY}/${svc}:latest-ci || (sleep 10 && exit 1)
                                """
                            }
                        }
                    }
                }
            }
        }

        stage('06 - Load Images into Minikube') {
            when {
                expression { !params.ROLLBACK_ONLY }
            }
            steps {
                withCredentials([sshUserPrivateKey(credentialsId: 'ANSIBLE_SSH_KEY', keyFileVariable: 'ANSIBLE_KEY')]) {
                    script {
                        allServices.each { svc ->
                            sh "ssh -o StrictHostKeyChecking=no -i \$ANSIBLE_KEY vishnu-dholu@127.0.0.1 \"minikube image load ${env.REGISTRY}/${svc}:${env.IMAGE_TAG}\" || true"
                        }
                    }
                }
            }
        }

        stage('07 - Deploy to Kubernetes via Ansible') {
            steps {
                script {
                    withCredentials([
                        file(credentialsId: 'ANSIBLE_VAULT_PASSWORD_FILE', variable: 'VAULT_FILE'),
                        sshUserPrivateKey(credentialsId: 'ANSIBLE_SSH_KEY', keyFileVariable: 'ANSIBLE_KEY'),
                        string(credentialsId: 'JWT_SECRET', variable: 'JWT_SECRET'),
                        string(credentialsId: 'INTERNAL_SERVICE_TOKEN', variable: 'INTERNAL_SERVICE_TOKEN'),
                        string(credentialsId: 'AUTH_DB_URL', variable: 'AUTH_DB_URL'),
                        string(credentialsId: 'ORDER_DB_URL', variable: 'ORDER_DB_URL'),
                        string(credentialsId: 'INVENTORY_DB_URL', variable: 'INVENTORY_DB_URL'),
                        string(credentialsId: 'WAREHOUSE_DB_URL', variable: 'WAREHOUSE_DB_URL'),
                        string(credentialsId: 'DELIVERY_DB_URL', variable: 'DELIVERY_DB_URL'),
                        string(credentialsId: 'NOTIFICATION_DB_URL', variable: 'NOTIFICATION_DB_URL'),
                        string(credentialsId: 'SMTP_EMAIL', variable: 'SMTP_EMAIL'),
                        string(credentialsId: 'SMTP_PASSWORD', variable: 'SMTP_PASSWORD')
                    ]) {
                        sh """
                          set +x
                          cat > ansible/group_vars/${params.DEPLOY_ENV}/vault.yml <<'EOF'
vault_jwt_secret: "${JWT_SECRET}"
vault_internal_service_token: "${INTERNAL_SERVICE_TOKEN}"
vault_auth_db_url: "${AUTH_DB_URL}"
vault_order_db_url: "${ORDER_DB_URL}"
vault_inventory_db_url: "${INVENTORY_DB_URL}"
vault_warehouse_db_url: "${WAREHOUSE_DB_URL}"
vault_delivery_db_url: "${DELIVERY_DB_URL}"
vault_notification_db_url: "${NOTIFICATION_DB_URL}"
vault_smtp_email: "${SMTP_EMAIL}"
vault_smtp_password: "${SMTP_PASSWORD}"
EOF
                          ansible-vault encrypt --vault-password-file "\$VAULT_FILE" ansible/group_vars/${params.DEPLOY_ENV}/vault.yml
                        """

                        try {
                            if (params.ROLLBACK_ONLY) {
                                sh """
                                  ansible-playbook -i ${env.ANSIBLE_INVENTORY} ansible/playbooks/rollback-k8s.yml \
                                    -e target_env=${params.DEPLOY_ENV} \
                                    -e project_src_dir=\$PWD \
                                    --vault-password-file "\$VAULT_FILE" \
                                    --private-key "\$ANSIBLE_KEY" -u "vishnu-dholu"
                                """
                            } else {
                                if (!env.IMAGE_TAG?.trim()) {
                                    error('IMAGE_TAG is not set. Ensure stage "02 - Prepare Build Metadata" ran (ROLLBACK_ONLY must be false for full deploy).')
                                }
                                sh """
                                  ansible-playbook -i ${env.ANSIBLE_INVENTORY} ansible/playbooks/deploy-k8s.yml \
                                    -e target_env=${params.DEPLOY_ENV} \
                                    -e image_tag=${env.IMAGE_TAG} \
                                    -e project_src_dir=\$PWD \
                                    -e k8s_registry=${env.REGISTRY} \
                                    --vault-password-file "\$VAULT_FILE" \
                                    --private-key "\$ANSIBLE_KEY" -u "vishnu-dholu"
                                """
                            }
                        } finally {
                            sh "rm -f ansible/group_vars/${params.DEPLOY_ENV}/vault.yml || true"
                        }
                    }
                }
            }
        }

        stage('08 - Verify (Ansible Health Checks)') {
            when {
                expression { !params.ROLLBACK_ONLY }
            }
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: 'ANSIBLE_SSH_KEY', keyFileVariable: 'ANSIBLE_KEY')
                ]) {
                    sh """
                      ansible-playbook -i ${env.ANSIBLE_INVENTORY} ansible/playbooks/verify-k8s.yml \
                        -e target_env=${params.DEPLOY_ENV} \
                        -e project_src_dir=\$PWD \
                        --private-key "\$ANSIBLE_KEY" -u "vishnu-dholu"
                    """
                }
            }
        }
    }

    post {
        failure {
            script {
                echo 'Pipeline failed. Attempting Kubernetes rollback via Ansible...'
                withCredentials([
                    file(credentialsId: 'ANSIBLE_VAULT_PASSWORD_FILE', variable: 'VAULT_FILE'),
                    sshUserPrivateKey(credentialsId: 'ANSIBLE_SSH_KEY', keyFileVariable: 'ANSIBLE_KEY'),
                    string(credentialsId: 'JWT_SECRET', variable: 'JWT_SECRET'),
                    string(credentialsId: 'INTERNAL_SERVICE_TOKEN', variable: 'INTERNAL_SERVICE_TOKEN'),
                    string(credentialsId: 'AUTH_DB_URL', variable: 'AUTH_DB_URL'),
                    string(credentialsId: 'ORDER_DB_URL', variable: 'ORDER_DB_URL'),
                    string(credentialsId: 'INVENTORY_DB_URL', variable: 'INVENTORY_DB_URL'),
                    string(credentialsId: 'WAREHOUSE_DB_URL', variable: 'WAREHOUSE_DB_URL'),
                    string(credentialsId: 'DELIVERY_DB_URL', variable: 'DELIVERY_DB_URL'),
                    string(credentialsId: 'NOTIFICATION_DB_URL', variable: 'NOTIFICATION_DB_URL'),
                    string(credentialsId: 'SMTP_EMAIL', variable: 'SMTP_EMAIL'),
                    string(credentialsId: 'SMTP_PASSWORD', variable: 'SMTP_PASSWORD')
                ]) {
                    sh """
                      ansible-playbook -i ${env.ANSIBLE_INVENTORY} ansible/playbooks/rollback-k8s.yml \
                        -e target_env=${params.DEPLOY_ENV} \
                        -e project_src_dir=\$PWD \
                        --vault-password-file "\$VAULT_FILE" \
                        --private-key "\$ANSIBLE_KEY" -u "vishnu-dholu" || true
                    """
                }
            }
        }
        always {
            sh 'kubectl get pods -n smart-order 2>/dev/null || true'
            sh 'kubectl get deployments -n smart-order 2>/dev/null || true'
        }
        cleanup {
            cleanWs(deleteDirs: true, notFailBuild: true)
        }
        success {
            echo "Kubernetes deployment succeeded for ${params.DEPLOY_ENV} with image tag ${env.IMAGE_TAG ?: 'n/a'}"
        }
    }
}
