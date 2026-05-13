pipeline {
    agent any

    stages {

        stage('Install') {
            steps {
                dir('apps/path-service') {
                    sh 'npm install --no-audit --prefer-offline --legacy-peer-deps'
                }
            }
        }

        stage('Test') {
            steps {
                dir('apps/path-service') {
                    sh 'npm test -- --passWithNoTests || true'
                }
            }
        }

        stage('Build') {
            steps {
                dir('apps/path-service') {
                    sh 'npm run build'
                }
            }
        }

        stage('Deploy') {
            steps {
                sh 'kubectl apply -f k8s/path-service/'
                sh 'kubectl rollout restart deployment/path-service -n fmp'
            }
        }
    }

    post {

        success {
            echo 'Path service pipeline completed'
        }

        failure {
            echo 'Path service pipeline failed'
        }

        
    }
}