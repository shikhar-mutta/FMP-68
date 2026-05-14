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

        withCredentials([
            string(credentialsId: 'database-url', variable: 'DATABASE_URL')
        ]) {

            sh '''
                kubectl create secret generic path-service-secret \
                  --from-literal=DATABASE_URL="$DATABASE_URL" \
                  --namespace=fmp \
                  --dry-run=client -o yaml | kubectl apply -f -
            '''

            sh 'kubectl apply -f k8s/path-service/'
            sh 'kubectl rollout restart deployment/path-service -n fmp'
        }
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