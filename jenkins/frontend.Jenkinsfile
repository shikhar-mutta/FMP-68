pipeline {
    agent any

    stages {

        stage('Install') {
            steps {
                dir('apps/frontend') {
                    sh 'npm install --no-audit --prefer-offline --legacy-peer-deps'
                }
            }
        }

        stage('Build') {
            steps {
                dir('apps/frontend') {
                    sh 'npm run build'
                }
            }
        }

        stage('Docker Build') {
            steps {
                sh '''
                eval $(minikube docker-env)
                docker build -t frontend:latest apps/frontend
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh 'kubectl apply -f k8s/frontend/'
                sh 'kubectl rollout restart deployment/frontend -n fmp'
            }
        }
    }

    post {

        success {
            echo 'Frontend pipeline completed'
        }

        failure {
            echo 'Frontend pipeline failed'
        }

        
    }
}