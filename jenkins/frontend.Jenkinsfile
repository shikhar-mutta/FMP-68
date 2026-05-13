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
    }

    post {

        success {
            echo 'Frontend pipeline completed'
        }

        failure {
            echo 'Frontend pipeline failed'
        }

        always {
            cleanWs()
        }
    }   
}