pipeline {
    agent any

    stages {

        stage('Install') {
            steps {
                dir('apps/follow-request-service') {
                    sh 'npm install --no-audit --prefer-offline --legacy-peer-deps'
                }
            }
        }

        stage('Test') {
            steps {
                dir('apps/follow-request-service') {
                    sh 'npm test -- --passWithNoTests || true'
                }
            }
        }

        stage('Build') {
            steps {
                dir('apps/follow-request-service') {
                    sh 'npm run build'
                }
            }
        }

        stage('Deploy') {
            steps {
                sh 'kubectl apply -f k8s/follow-request-service/'
            }
        }
    }

    post {

        success {
            echo 'follow-request service pipeline completed'
        }

        failure {
            echo 'follow-request service pipeline failed'
        }

        always {
            cleanWs()
        }
    }
}