# Testing the Privy Signing Endpoints

You can test the new functionality in two ways: by directly calling the API endpoints using a tool like `curl`, or by using the MCP tools that have been exposed.

### Prerequisites: Get a `userId` and `walletId`

Before you can test the signing methods, you need a user and a wallet associated with that user.

**Step 1: Create a User**
Use the `import_user` tool to create a new user. You only need to provide one identifier (like an email).

*   **Tool**: `import_user`
*   **Parameters**:
    *   `email`: `"test.user@example.com"`
*   **Result**: This will return a `userId`. Make a note of it for the next step.

**Step 2: Create a Wallet**
Use the `create_wallet` tool with the `userId` you just received.

*   **Tool**: `create_wallet`
*   **Parameters**:
    *   `userId`: The `userId` from Step 1.
    *   `chainType`: `"ethereum"` (or `"solana"` if you want to test Solana methods).
*   **Result**: This will return a wallet object containing an `id` (this is your `walletId`).

### Method 1: Testing with `curl`

You can send requests directly to the running Cloudflare worker. Make sure the worker is running locally (usually with `npx wrangler dev`).

**Example: Test `personal_sign` (Ethereum)**
Replace `YOUR_WALLET_ID` with the Ethereum wallet ID from Step 2.

```bash
curl -X POST http://localhost:8787/v1/wallets/YOUR_WALLET_ID/rpc \
-H "Content-Type: application/json" \
-d '{
  "method": "personal_sign",
  "params": {
    "message": "0xdeadbeef"
  }
}'
```

**Example: Test `signMessage` (Solana)**
First, create a Solana wallet by repeating Step 2 with `chainType: "solana"`. Then, use that new `walletId`.

```bash
curl -X POST http://localhost:8787/v1/wallets/YOUR_SOLANA_WALLET_ID/rpc \
-H "Content-Type: application/json" \
-d '{
  "method": "signMessage",
  "params": {
    "message": "This is a test message for Solana."
  }
}'
```

### Method 2: Testing with MCP Tools

You can also use the tools directly from the MCP agent panel.

1.  Select the tool you want to test from the list (e.g., `personal_sign`).
2.  Fill in the required parameters:
    *   `walletId`: The `walletId` you created.
    *   `message`: The message you want to sign (e.g., `"0xdeadbeef"`).
3.  Run the tool.

The result from the Privy API will be displayed. You can follow this same process for all the other signing tools that were added, such as `sign_typed_data` and `solana_sign_transaction`.