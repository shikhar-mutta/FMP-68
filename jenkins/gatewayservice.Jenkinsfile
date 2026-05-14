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
    string(credentialsId: 'GOOGLE_CLIENT_ID', variable: 'GOOGLE_CLIENT_ID'),
    string(credentialsId: 'GOOGLE_CLIENT_SECRET', variable: 'GOOGLE_CLIENT_SECRET'),
    string(credentialsId: 'GOOGLE_CALLBACK_URL', variable: 'GOOGLE_CALLBACK_URL'),
    string(credentialsId: 'DATABASE_URL', variable: 'DATABASE_URL')        ]) {

            sh '''
                kubectl create secret generic gateway-secret \
                        --from-literal=DATABASE_URL="$DATABASE_URL" \
                        --from-literal=GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
                        --from-literal=GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
                        --from-literal=GOOGLE_CALLBACK_URL="$GOOGLE_CALLBACK_URL" \                  --namespace=fmp \
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