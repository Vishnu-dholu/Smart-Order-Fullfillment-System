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
        parallelsAlwaysFailFast()
    }

    parameters {
        choice(name: 'DEPLOY_ENV', choices: ['dev', 'stage', 'prod'], description: 'Target deployment environment')
        booleanParam(name: 'SKIP_TESTS', defaultValue: false, description: 'Skip test stages')
        booleanParam(name: 'ROLLBACK_ONLY', defaultValue: false, description: 'Run rollback playbook only')
    }

    environment {
        REGISTRY = 'localhost:5001/smart-order'
        IMAGE_TAG = 'unset'
        COMPOSE_PROJECT_NAME = "smart-order-${params.DEPLOY_ENV}"
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

        stage('03 - Build Images (Parallel)') {
            when {
                expression { !params.ROLLBACK_ONLY }
            }
            failFast true
            parallel {
                stage('03.1 - Build Frontend') {
                    steps {
                        sh """
                          docker build \
                            --build-arg BUILDKIT_INLINE_CACHE=1 \
                            -t ${REGISTRY}/frontend:${IMAGE_TAG} \
                            -f frontend/Dockerfile frontend
                        """
                    }
                }
                stage('03.2 - Build Spring Services') {
                    failFast true
                    parallel {
                        stage('Build api-gateway') { steps { sh "docker build --build-arg BUILDKIT_INLINE_CACHE=1 -t ${REGISTRY}/api-gateway:${IMAGE_TAG} -f services/spring/api-gateway/Dockerfile services/spring/api-gateway" } }
                        stage('Build auth-service') { steps { sh "docker build --build-arg BUILDKIT_INLINE_CACHE=1 -t ${REGISTRY}/auth-service:${IMAGE_TAG} -f services/spring/auth-service/Dockerfile services/spring/auth-service" } }
                        stage('Build inventory-service') { steps { sh "docker build --build-arg BUILDKIT_INLINE_CACHE=1 -t ${REGISTRY}/inventory-service:${IMAGE_TAG} -f services/spring/inventory-service/Dockerfile services/spring/inventory-service" } }
                        stage('Build order-service') { steps { sh "docker build --build-arg BUILDKIT_INLINE_CACHE=1 -t ${REGISTRY}/order-service:${IMAGE_TAG} -f services/spring/order-service/Dockerfile services/spring/order-service" } }
                    }
                }
                stage('03.3 - Build Go Services') {
                    failFast true
                    parallel {
                        stage('Build warehouse-service') { steps { sh "docker build --build-arg BUILDKIT_INLINE_CACHE=1 -t ${REGISTRY}/warehouse-service:${IMAGE_TAG} -f services/go/warehouse-service/Dockerfile services/go/warehouse-service" } }
                        stage('Build delivery-service') { steps { sh "docker build --build-arg BUILDKIT_INLINE_CACHE=1 -t ${REGISTRY}/delivery-service:${IMAGE_TAG} -f services/go/delivery-service/Dockerfile services/go/delivery-service" } }
                        stage('Build notification-service') { steps { sh "docker build --build-arg BUILDKIT_INLINE_CACHE=1 -t ${REGISTRY}/notification-service:${IMAGE_TAG} -f services/go/notification-service/Dockerfile services/go/notification-service" } }
                    }
                }
            }
        }

        stage('04 - Unit & Integration Tests (Parallel)') {
            when {
                allOf {
                    expression { !params.ROLLBACK_ONLY }
                    expression { !params.SKIP_TESTS }
                }
            }
            failFast true
            parallel {
                stage('04.1 - Frontend Tests') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci --no-audit --no-fund'
                            sh 'npm run build'
                        }
                    }
                }
                stage('04.2 - Spring Tests') {
                    failFast true
                    parallel {
                        stage('Test auth-service') { steps { dir('services/spring/auth-service') { sh './mvnw -B -ntp test' } } }
                        stage('Test inventory-service') { steps { dir('services/spring/inventory-service') { sh './mvnw -B -ntp test' } } }
                        stage('Test order-service') { steps { dir('services/spring/order-service') { sh './mvnw -B -ntp test' } } }
                        stage('Test api-gateway') { steps { dir('services/spring/api-gateway') { sh '[ -x ./mvnw ] && ./mvnw -B -ntp test || mvn -B -ntp test' } } }
                    }
                }
                stage('04.3 - Go Tests') {
                    failFast true
                    parallel {
                        stage('Test warehouse-service') { steps { dir('services/go/warehouse-service') { sh 'go test ./... -count=1' } } }
                        stage('Test delivery-service') { steps { dir('services/go/delivery-service') { sh 'go test ./... -count=1' } } }
                        stage('Test notification-service') { steps { dir('services/go/notification-service') { sh 'go test ./... -count=1' } } }
                    }
                }
            }
        }

        stage('05 - Push Images (Parallel)') {
            when {
                expression { !params.ROLLBACK_ONLY }
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'DOCKER_REGISTRY_CREDS', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh 'echo "$DOCKER_PASS" | docker login localhost:5001 -u "$DOCKER_USER" --password-stdin'
                    script {
                        def pushStages = [:]
                        allServices.each { svc ->
                            pushStages["Push ${svc}"] = {
                                sh "docker push ${REGISTRY}/${svc}:${IMAGE_TAG}"
                                sh "docker tag ${REGISTRY}/${svc}:${IMAGE_TAG} ${REGISTRY}/${svc}:latest-ci"
                                sh "docker push ${REGISTRY}/${svc}:latest-ci"
                            }
                        }
                        parallel pushStages
                    }
                }
            }
        }

        stage('06 - Deploy via Ansible') {
            steps {
                script {
                    withCredentials([
                        file(credentialsId: 'ANSIBLE_VAULT_PASSWORD_FILE', variable: 'VAULT_FILE'),
                        sshUserPrivateKey(credentialsId: 'ANSIBLE_SSH_KEY', keyFileVariable: 'ANSIBLE_KEY', usernameVariable: 'ANSIBLE_USER'),
                        string(credentialsId: 'JWT_SECRET', variable: 'JWT_SECRET'),
                        string(credentialsId: 'INTERNAL_SERVICE_TOKEN', variable: 'INTERNAL_SERVICE_TOKEN'),
                        string(credentialsId: 'GOOGLE_CLIENT_ID', variable: 'GOOGLE_CLIENT_ID'),
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
vault_google_client_id: "${GOOGLE_CLIENT_ID}"
vault_auth_db_url: "${AUTH_DB_URL}"
vault_order_db_url: "${ORDER_DB_URL}"
vault_inventory_db_url: "${INVENTORY_DB_URL}"
vault_warehouse_db_url: "${WAREHOUSE_DB_URL}"
vault_delivery_db_url: "${DELIVERY_DB_URL}"
vault_notification_db_url: "${NOTIFICATION_DB_URL}"
vault_smtp_email: "${SMTP_EMAIL}"
vault_smtp_password: "${SMTP_PASSWORD}"
EOF
                          ansible-vault encrypt --vault-password-file "$VAULT_FILE" ansible/group_vars/${params.DEPLOY_ENV}/vault.yml
                        """

                        try {
                            if (params.ROLLBACK_ONLY) {
                                sh """
                                  ansible-playbook -i ${ANSIBLE_INVENTORY} ansible/playbooks/rollback.yml \
                                    -e target_env=${params.DEPLOY_ENV} \
                                    --vault-password-file "$VAULT_FILE" \
                                    --private-key "$ANSIBLE_KEY" -u "$ANSIBLE_USER"
                                """
                            } else {
                                sh """
                                  ansible-playbook -i ${ANSIBLE_INVENTORY} ansible/playbooks/deploy.yml \
                                    -e target_env=${params.DEPLOY_ENV} \
                                    -e image_tag=${IMAGE_TAG} \
                                    --vault-password-file "$VAULT_FILE" \
                                    --private-key "$ANSIBLE_KEY" -u "$ANSIBLE_USER"
                                """
                            }
                        } finally {
                            sh "rm -f ansible/group_vars/${params.DEPLOY_ENV}/vault.yml || true"
                        }
                    }
                }
            }
        }

        stage('07 - Verify (Ansible Health Checks)') {
            when {
                expression { !params.ROLLBACK_ONLY }
            }
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: 'ANSIBLE_SSH_KEY', keyFileVariable: 'ANSIBLE_KEY', usernameVariable: 'ANSIBLE_USER')
                ]) {
                    sh """
                      ansible-playbook -i ${ANSIBLE_INVENTORY} ansible/playbooks/verify.yml \
                        -e target_env=${params.DEPLOY_ENV} \
                        --private-key "$ANSIBLE_KEY" -u "$ANSIBLE_USER"
                    """
                }
            }
        }
    }

    post {
        failure {
            script {
                echo 'Pipeline failed. Attempting rollback playbook...'
                withCredentials([
                    file(credentialsId: 'ANSIBLE_VAULT_PASSWORD_FILE', variable: 'VAULT_FILE'),
                    sshUserPrivateKey(credentialsId: 'ANSIBLE_SSH_KEY', keyFileVariable: 'ANSIBLE_KEY', usernameVariable: 'ANSIBLE_USER')
                ]) {
                    sh """
                      ansible-playbook -i ${ANSIBLE_INVENTORY} ansible/playbooks/rollback.yml \
                        -e target_env=${params.DEPLOY_ENV} \
                        --vault-password-file "$VAULT_FILE" \
                        --private-key "$ANSIBLE_KEY" -u "$ANSIBLE_USER" || true
                    """
                }
            }
        }
        always {
            sh 'docker images --format "{{.Repository}}:{{.Tag}} {{.Size}}" | rg "smart-order" || true'
            sh 'docker compose ps || true'
            cleanWs(deleteDirs: true, notFailBuild: true)
        }
        success {
            echo "Deployment succeeded for ${params.DEPLOY_ENV} with image tag ${IMAGE_TAG}"
        }
    }
}
