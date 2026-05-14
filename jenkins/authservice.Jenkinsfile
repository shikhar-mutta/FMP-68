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

                withCredentials([
                    string(credentialsId: 'google-client-id', variable: 'GOOGLE_CLIENT_ID'),
                    string(credentialsId: 'google-client-secret', variable: 'GOOGLE_CLIENT_SECRET'),
                    string(credentialsId: 'google-callback-url', variable: 'GOOGLE_CALLBACK_URL'),
                    string(credentialsId: 'database-url', variable: 'DATABASE_URL')
                ]) {

                    sh '''
                        kubectl create secret generic auth-secret \
                        --from-literal=DATABASE_URL="$DATABASE_URL" \
                        --from-literal=GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
                        --from-literal=GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
                        --from-literal=GOOGLE_CALLBACK_URL="$GOOGLE_CALLBACK_URL" \
                        --namespace=fmp \
                        --dry-run=client -o yaml | kubectl apply -f -
                    '''

                    sh 'kubectl apply -f k8s/auth-service/'
                    sh 'kubectl rollout restart deployment/auth-service -n fmp'
                }
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

        
    }
}