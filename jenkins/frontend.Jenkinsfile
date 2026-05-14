pipeline {
    agent any

    environment {
        IMAGE_NAME = '<your-dockerhub-username>/frontend'
        IMAGE_TAG = "${BUILD_NUMBER}"
    }

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

        stage('Docker Login') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-creds',
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
                    apps/frontend
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

                sh 'kubectl apply -f k8s/frontend/'

                sh '''
                    kubectl set image deployment/frontend \
                    frontend=$IMAGE_NAME:$IMAGE_TAG \
                    -n fmp
                '''
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