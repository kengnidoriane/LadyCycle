module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.{ts,tsx}',
    '**/src/**/*.test.{ts,tsx}',
    '**/src/**/*.spec.{ts,tsx}',
  ],
};
