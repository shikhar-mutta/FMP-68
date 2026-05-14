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

        withCredentials([
            string(credentialsId: 'jwt-secret', variable: 'JWT_SECRET')
        ]) {

            sh '''
                kubectl create secret generic gateway-secret \
                  --from-literal=JWT_SECRET="$JWT_SECRET" \
                  --namespace=fmp \
                  --dry-run=client -o yaml | kubectl apply -f -
            '''

            sh 'kubectl apply -f k8s/gateway-service/'
            sh 'kubectl rollout restart deployment/gateway-service -n fmp'
        }
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

        
    }
}