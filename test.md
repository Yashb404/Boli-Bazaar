## PROGRAM -10: Test Case Development and Implementation

### Aim
Develop and document test cases; implement and run tests for the project’s bidding and auction functionality.

### Theoretical Description
A test case defines inputs, execution conditions, and expected results for a specific scenario. For a sample scenario like “Check Login Functionality,” representative test cases include:

- **Test Case 1**: Check results on entering valid User ID and Password
- **Test Case 2**: Check results on entering invalid User ID and Password
- **Test Case 3**: Check response when User ID is empty and Login button is pressed

Example (concise):

| Test Case ID | Description                               | Test Data                               | Steps                                                                 | Expected Result                               | Actual Result | Pass/Fail |
|--------------|-------------------------------------------|------------------------------------------|-----------------------------------------------------------------------|-----------------------------------------------|---------------|-----------|
| TU01         | Login with valid data                      | UserId=guru99, Password=pass99           | 1) Go to http://demo.guru99.com  2) Enter UserId  3) Enter Password  4) Click Submit | User should login into application             | As Expected   | Pass      |
| TU02         | Login with invalid data                    | UserId=guru99, Password=glass99          | 1) Go to http://demo.guru99.com  2) Enter UserId  3) Enter Password  4) Click Submit | User should not login into application         | As Expected   | Pass      |

Step-by-step illustration for a valid login:

- **Step 1 (Define case)**: Check response when valid email and password is entered
- **Step 2 (Test data)**: Email: guru99@email.com, Password: lNf9^Oti7^2h
- **Step 3 (Actions)**:
  - Enter Email Address
  - Enter Password
  - Click Sign in

Documenting steps and data ensures repeatability, reviewability, and handover readiness.

### Algorithm
NA

### Source Code
NA (theoretical examples above). The project implementation below demonstrates practical automated tests for a bidding system.

### Project Implementation
This project includes two automated test scripts that operationalize the above testing principles for a reverse-auction bidding system.

- **scripts/test-api-integrations.ts**: End-to-end API integration tests against live HTTP endpoints
  - Prerequisites: database setup; run the Next.js dev server (`npm run dev`)
  - Suggested run command: `npm run test:api` (as indicated in the script header)
  - What it does:
    - Creates unique test data (cities, areas, products, suppliers—both verified and unverified)
    - Calls REST endpoints and validates status codes, payloads, and error handling
    - Cleans up test data after completion
  - Key suites:
    - GET /api/pooled-orders: list and filter by status/area group
    - GET /api/pooled-orders/:id: fetch by ID, invalid ID, nonexistent ID
    - POST /api/bids: submit valid bid, enforce reverse auction (lower bids), reject unverified supplier, reject bids on closed auctions
    - GET /api/pooled-orders/:id/bids: list bids per order, sorted by price
    - GET /api/suppliers/bids: list a supplier’s bids with computed status (WINNING/OUTBID)
    - Full Bidding Flow: end-to-end from placing bids to verifying lowest bid
  - Notes captured in code:
    - Validation error handling (Zod) requires improved detection to return 400 instead of 500 for invalid input
    - Test isolation consideration for supplier-bid listings when prior data persists

- **scripts/test-bidding-logic.ts**: Service-level logic tests (no HTTP), using the project’s services
  - Suggested run command: `npm run test:logic` (typical; ensure your runner supports TypeScript execution)
  - What it does:
    - Cleans the database before/after
    - Creates controlled test data
    - Calls service functions (e.g., submitBid, getSupplierBidStatus, calculateMinNextBid, awardAuction)
  - Key suites:
    - Basic bid submission: first bid is winning and matches lowest
    - Reverse auction logic: lower bids replace higher bids; equal/higher bids are rejected
    - Minimum decrement: enforces a required decrement (e.g., ₹50)
    - Auction status validation: rejects bids on closed/expired auctions; verifies activity checks
    - Supplier verification: rejects unverified suppliers
    - Auction awarding: awards lowest bid after expiry; prevents awarding active auctions; handles no-bid auctions
    - Multiple suppliers bidding: simulates bidding war and verifies final state
    - Edge cases: negative/zero prices, non-existent entities, min-bid computation with no existing bids

### How to Run
1) Start the app server (required for API tests):

```bash
npm run dev
```

2) Run API integration tests (ensure the server and DB are ready):

```bash
npm run test:api
```

3) Run logic/service tests (no server required, DB required):

```bash
npm run test:logic
```

If your project does not yet have these npm scripts, run the TypeScript files via your preferred runner (e.g., ts-node/tsx) or add scripts accordingly.

### Test Data Strategy
- Uses unique names/IDs (timestamps or test-prefixed IDs) to avoid collisions
- Performs cleanup before and after test execution to maintain isolation
- For API tests, cleanup also nulls foreign keys before deleting dependent rows to respect constraints

### Known Issues and Improvements
- **Validation error handling**: Improve Zod error detection in API routes so invalid inputs return HTTP 400 (VALIDATION_ERROR) instead of 500
- **Test isolation for supplier bids**: Scope queries or perform inter-suite cleanup to ensure counts do not include previous suites’ data

### Output
Students learn how to write test cases and implement them in an automated fashion, covering happy paths, error handling, edge cases, and full flows for a reverse-auction system.

### Conclusion
The test suites in `scripts/test-api-integrations.ts` and `scripts/test-bidding-logic.ts` demonstrate practical application of test-case theory. They define clear scenarios, structured data setup, deterministic steps, and explicit expected outcomes, providing a repeatable and maintainable testing foundation for the project.


