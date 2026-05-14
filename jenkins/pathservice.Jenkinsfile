pipeline {
    agent any

    environment {
        IMAGE_NAME = '<your-dockerhub-username>/path-service'
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

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

        stage('Docker Login') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'Dockerhub cred',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )
                ]) {

                    sh '''
                        echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin
                    '''
                }
            }
        }

        stage('Docker Build') {
            steps {
                sh '''
                    docker build \
                    -t $IMAGE_NAME:$IMAGE_TAG \
                    apps/path-service
                '''
            }
        }

        stage('Docker Push') {
            steps {
                sh '''
                    docker push $IMAGE_NAME:$IMAGE_TAG
                '''
            }
        }

        stage('Deploy') {
            steps {

                withCredentials([
                    string(credentialsId: 'GOOGLE_CLIENT_ID', variable: 'GOOGLE_CLIENT_ID'),
                    string(credentialsId: 'GOOGLE_CLIENT_SECRET', variable: 'GOOGLE_CLIENT_SECRET'),
                    string(credentialsId: 'GOOGLE_CALLBACK_URL', variable: 'GOOGLE_CALLBACK_URL'),
                    string(credentialsId: 'DATABASE_URL', variable: 'DATABASE_URL')
                ]) {

                    sh '''
                        kubectl create secret generic path-service-secret \
                        --from-literal=DATABASE_URL="$DATABASE_URL" \
                        --from-literal=GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
                        --from-literal=GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
                        --from-literal=GOOGLE_CALLBACK_URL="$GOOGLE_CALLBACK_URL" \
                        --namespace=fmp \
                        --dry-run=client -o yaml | kubectl apply -f -
                    '''

                    sh 'kubectl apply -f k8s/path-service/'

                    sh '''
                        kubectl set image deployment/path-service \
                        path-service=$IMAGE_NAME:$IMAGE_TAG \
                        -n fmp
                    '''
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