#!/bin/bash

# Test script for Eagles Drama Club Register - Phase 0

echo "=== Testing Eagles Drama Club Register Setup ==="

echo "\n1. Checking project structure..."
if [ -f "package.json" ] && [ -f "next.config.js" ] && [ -f "prisma/schema.prisma" ]; then
  echo "✓ Project structure is correct"
else
  echo "✗ Project structure is incomplete"
  exit 1
fi

if [ -d "node_modules" ]; then
  echo "✓ Dependencies installed"
else
  echo "⚠ Dependencies not installed - run: npm install"
fi

echo "\n2. Checking TypeScript configuration..."
if [ -f "tsconfig.json" ]; then
  echo "✓ TypeScript config exists"
else
  echo "✗ TypeScript config missing"
fi

echo "\n3. Checking Prisma schema..."
if grep -q "model User" "prisma/schema.prisma"; then
  echo "✓ Prisma schema exists with User model"
else
  echo "✗ Prisma schema missing User model"
fi

if grep -q "model Member" "prisma/schema.prisma"; then
  echo "✓ Prisma schema exists with Member model"
else
  echo "✗ Prisma schema missing Member model"
fi

if grep -q "enum UserRole" "prisma/schema.prisma"; then
  echo "✓ Prisma schema exists with UserRole enum"
else
  echo "✗ Prisma schema missing UserRole enum"
fi

echo "\n4. Checking validation schemas..."
if [ -f "src/lib/validation/index.ts" ]; then
  echo "✓ Validation schemas exist"
else
  echo "✗ Validation schemas missing"
fi

echo "\n5. Checking date helpers..."
if [ -f "src/lib/dates.ts" ]; then
  echo "✓ Date helpers exist"
else
  echo "✗ Date helpers missing"
fi

echo "\n6. Checking seed data..."
if [ -f "prisma/seed.ts" ]; then
  echo "✓ Seed data exists"
else
  echo "✗ Seed data missing"
fi

echo "\n7. Checking home page..."
if [ -f "src/app/page.tsx" ]; then
  echo "✓ Home page exists"
else
  echo "✗ Home page missing"
fi

echo "\n8. Checking API routes..."
if [ -f "src/server.ts" ]; then
  echo "✓ API routes exist"
else
  echo "✗ API routes missing"
fi

echo "\n=== Setup Test Complete ==="
echo "\nTo complete the setup, run:"
echo "1. npm install (install dependencies)"
echo "2. npm run db:migrate (create database tables)"
echo "3. npm run db:seed (populate with sample data)"
echo "4. npm run typecheck (type check)"
echo "5. npm run build (build application)"
echo "\nThen start the development server with: npm run dev"