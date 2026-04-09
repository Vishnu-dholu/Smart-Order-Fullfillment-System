pipeline {
    // Run on any available Jenkins agent
    agent any

    // Keep the Jenkins server clean by only saving the last 5 build logs
    options {
        buildDiscarder(logRotator(numToKeepStr: '5'))
        disableConcurrentBuilds()
    }

    stages {
        stage(' Checkout Code') {
            steps {
                checkout scm
            }
        }

        // Build the images in parallel to save massive amounts of time
        stage(' Build Polyglot Fleet') {
            failFast true
            parallel {
                stage(' Frontend (Node/Vite)') {
                    steps {
                        echo "Building React Application..."
                        sh 'docker compose build frontend'
                    }
                }

                stage(' Java Core (Maven)') {
                    steps {
                        echo "Building Spring Boot Services..."
                        sh 'docker compose build auth-service inventory-service order-service'
                    }
                }

                stage(' Go Fleet (Gin)') {
                    steps {
                        echo "Building Go Microservices..."
                        sh 'docker compose build warehouse-service delivery-service notification-service'
                    }
                }
            }
        }

        stage('Deploy to Local Server') {
            steps {
                echo "Deploying the freshly built containers..."

                withCredentials([
                    string(credentialsId: 'WAREHOUSE_DB_URL', variable: 'WAREHOUSE_DB_URL'),
                    string(credentialsId: 'DELIVERY_DB_URL', variable: 'DELIVERY_DB_URL'),
                    string(credentialsId: 'NOTIFICATION_DB_URL', variable: 'NOTIFICATION_DB_URL')
                ]) {
                    sh '''
                    echo "Creating .env files for Go microservices..."

                    echo "DB_URL=${WAREHOUSE_DB_URL}" > ./services/go/warehouse-service/.env
                    echo "DB_URL=${DELIVERY_DB_URL}" > ./services/go/delivery-service/.env
                    echo "DB_URL=${NOTIFICATION_DB_URL}" > ./services/go/notification-service/.env

                    echo "Force-killing any global ghost containers..."
                    docker rm -f smart-order-frontend auth-service inventory-service order-service warehouse-service delivery-service notification-service || true

                    docker compose down
                    docker compose up -d
                    '''
                }
            }
        }
    }

    post {
        always {
            // Print out the running containers so you can see the status in the Jenkins UI
            sh 'docker compose ps'
        }
        failure {
            echo " Pipeline failed! Check the logs above."
        }
        success {
            echo " Pipeline completed successfully! The Smart Order fleet is running."
        }
    }
}
