#!/bin/bash

# TalkToMachine Deployment Script
set -e

echo "🚀 Starting TalkToMachine deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking requirements..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        print_error "git is not installed"
        exit 1
    fi
    
    print_status "All requirements satisfied ✅"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm ci
    print_status "Dependencies installed ✅"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    npm test
    print_status "All tests passed ✅"
}

# Build application
build_app() {
    print_status "Building application..."
    npm run build
    print_status "Application built ✅"
}

# Deploy to production
deploy_production() {
    print_status "Deploying to production..."
    
    # Add your deployment commands here
    # Examples:
    # - Deploy to Heroku: git push heroku master
    # - Deploy to AWS: aws deploy create-deployment ...
    # - Deploy to Docker: docker build -t talktomachine . && docker run ...
    
    print_status "Production deployment completed ✅"
}

# Main deployment flow
main() {
    print_status "TalkToMachine Deployment Pipeline"
    print_status "================================="
    
    check_requirements
    install_dependencies
    run_tests
    build_app
    
    # Ask for confirmation before production deployment
    read -p "Deploy to production? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        deploy_production
        print_status "🎉 Deployment completed successfully!"
    else
        print_warning "Production deployment skipped"
    fi
}

# Run main function
main "$@"