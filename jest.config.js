module.exports = {
  testEnvironment: "jest-environment-jsdom",
  testMatch: ["**/test/javascript/**/*.test.js"],
  transform: { "^.+\\.js$": "babel-jest" },
  moduleNameMapper: {
    "^controllers/(.*)$": "<rootDir>/app/javascript/controllers/$1",
  },
}
