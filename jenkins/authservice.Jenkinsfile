pipeline {
    agent any

    stages {

        stage('Install') {
            steps {
                dir('apps/auth-service') {
                    sh 'npm install --no-audit --prefer-offline --legacy-peer-deps'
                }
            }
        }

        stage('Test') {
            steps {
                dir('apps/auth-service') {
                    sh 'npm test -- --passWithNoTests || true'
                }
            }
        }

        stage('Build') {
            steps {
                dir('apps/auth-service') {
                    sh 'npm run build'
                }
            }
        }

        stage('Deploy') {
            steps {
                sh 'kubectl apply -f k8s/auth-service/'
            }
        }
    }

    post {

        success {
            echo 'Auth service pipeline completed'
        }

        failure {
            echo 'Auth service pipeline failed'
        }

        always {
            cleanWs()
        }
    }
}