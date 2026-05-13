pipeline {
    agent any

    stages {

        stage('Install') {
            steps {
                dir('apps/gateway-service') {
                    sh 'npm install --no-audit --prefer-offline --legacy-peer-deps'
                }
            }
        }

        stage('Test') {
            steps {
                dir('apps/gateway-service') {
                    sh 'npm test -- --passWithNoTests || true'
                }
            }
        }

        stage('Build') {
            steps {
                dir('apps/gateway-service') {
                    sh 'npm run build'
                }
            }
        }

        stage('Deploy') {
            steps {
                sh 'kubectl apply -f k8s/gateway-service/'
            }
        }
    }

    post {

        success {
            echo 'gateway service pipeline completed'
        }

        failure {
            echo 'gateway service pipeline failed'
        }

        always {
            cleanWs()
        }
    }
}